import crypto from 'crypto';
import axios from 'axios';
import mongoose from 'mongoose';
import {
  WebhookSubscription,
  WebhookDeliveryLog,
  IWebhookSubscription,
  WebhookEventTopic,
  WebhookDeliveryStatus,
} from '../models/Integration.model';
import { logger } from '../config/logger';

export interface WebhookEventPayload {
  id: string;
  object: 'event';
  created: number;
  type: string;
  tenantId: string;
  data: Record<string, any>;
}

// Exponential backoff retry delays in milliseconds: 5m, 30m, 2h, 6h, 24h
const RETRY_DELAYS_MS = [
  5 * 60 * 1000,
  30 * 60 * 1000,
  2 * 60 * 60 * 1000,
  6 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
];

export class WebhookDispatcherService {
  /**
   * Generates timestamped HMAC-SHA256 signature string: t=timestamp,v1=signature
   */
  static generateSignature(payloadString: string, secret: string, timestamp?: number): string {
    const ts = timestamp || Math.floor(Date.now() / 1000);
    const signedPayload = `${ts}.${payloadString}`;
    const hmac = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
    return `t=${ts},v1=${hmac}`;
  }

  /**
   * Verify signature using constant-time comparison to prevent timing attacks
   */
  static verifySignature(
    payloadString: string,
    signatureHeader: string,
    secret: string,
    toleranceSeconds: number = 300
  ): boolean {
    try {
      const parts = signatureHeader.split(',');
      let timestamp: number | undefined;
      let signature: string | undefined;

      for (const part of parts) {
        const [k, v] = part.split('=');
        if (k === 't') timestamp = parseInt(v, 10);
        if (k === 'v1') signature = v;
      }

      if (!timestamp || !signature) return false;

      // Check replay attack tolerance
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - timestamp) > toleranceSeconds) {
        return false;
      }

      const expectedSignedPayload = `${timestamp}.${payloadString}`;
      const expectedHmac = crypto.createHmac('sha256', secret).update(expectedSignedPayload).digest('hex');

      const expectedBuf = Buffer.from(expectedHmac, 'hex');
      const actualBuf = Buffer.from(signature, 'hex');

      if (expectedBuf.length !== actualBuf.length) return false;
      return crypto.timingSafeEqual(expectedBuf, actualBuf);
    } catch {
      return false;
    }
  }

  /**
   * Dispatch an event to all matching webhook subscribers for a given tenant
   */
  static async dispatchEvent(
    tenantId: string | mongoose.Types.ObjectId,
    eventType: WebhookEventTopic,
    eventData: Record<string, any>
  ): Promise<void> {
    const subscriptions = await WebhookSubscription.find({
      tenantId,
      isActive: true,
      subscribedEvents: eventType,
    });

    if (!subscriptions || subscriptions.length === 0) {
      return;
    }

    const eventId = `evt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const timestamp = Math.floor(Date.now() / 1000);

    const eventPayload: WebhookEventPayload = {
      id: eventId,
      object: 'event',
      created: timestamp,
      type: eventType,
      tenantId: tenantId.toString(),
      data: eventData,
    };

    const payloadString = JSON.stringify(eventPayload);

    for (const sub of subscriptions) {
      // Check circuit breaker
      if (sub.circuitBreaker?.state === 'OPEN') {
        if (sub.circuitBreaker.resetAt && sub.circuitBreaker.resetAt.getTime() > Date.now()) {
          logger.warn(`[WebhookCircuitBreaker] Skipping delivery for sub ${sub._id} - Circuit is OPEN`);
          continue;
        } else {
          // Half-open check
          sub.circuitBreaker.state = 'HALF_OPEN';
          await sub.save();
        }
      }

      await this.deliverWebhook(sub, eventPayload, payloadString, 1);
    }
  }

  /**
   * Internal delivery helper that attempts HTTP POST and logs the result
   */
  private static async deliverWebhook(
    subscription: IWebhookSubscription,
    payload: WebhookEventPayload,
    payloadString: string,
    attemptNumber: number
  ): Promise<any> {
    const signatureHeader = this.generateSignature(payloadString, subscription.secret, payload.created);
    const idempotencyKey = `${payload.id}_${subscription._id}_att_${attemptNumber}`;

    const startTime = Date.now();
    let statusCode: number | undefined;
    let responseSnippet = '';
    let deliveryStatus: WebhookDeliveryStatus = 'DELIVERED';
    let nextRetryAt: Date | null = null;

    try {
      const response = await axios.post(subscription.targetUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'DocuStudio-Webhook/1.0',
          'X-DocuStudio-Signature': signatureHeader,
          'X-DocuStudio-Event-Id': payload.id,
          'X-DocuStudio-Event-Type': payload.type,
          'X-DocuStudio-Delivery-Attempt': attemptNumber.toString(),
        },
        timeout: 8000,
      });

      statusCode = response.status;
      responseSnippet = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      if (responseSnippet.length > 500) responseSnippet = responseSnippet.substring(0, 500) + '...';

      // Reset failure counts
      subscription.failedAttempts = 0;
      if (subscription.circuitBreaker) {
        subscription.circuitBreaker.state = 'CLOSED';
      }
      await subscription.save();
    } catch (err: any) {
      statusCode = err.response?.status || 500;
      responseSnippet = err.response?.data
        ? JSON.stringify(err.response.data).substring(0, 500)
        : err.message || 'Network Timeout';

      subscription.failedAttempts += 1;

      // Circuit breaker: trip after 5 failures
      if (subscription.failedAttempts >= 5) {
        subscription.circuitBreaker = {
          state: 'OPEN',
          trippedAt: new Date(),
          resetAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min cooldown
        };
      }
      await subscription.save();

      // Exponential retry scheduling
      if (attemptNumber < RETRY_DELAYS_MS.length) {
        deliveryStatus = 'RETRYING';
        nextRetryAt = new Date(Date.now() + RETRY_DELAYS_MS[attemptNumber - 1]);
      } else {
        deliveryStatus = 'DEAD_LETTER';
      }
    }

    const durationMs = Date.now() - startTime;

    const deliveryLog = await WebhookDeliveryLog.create({
      tenantId: subscription.tenantId,
      subscriptionId: subscription._id,
      eventId: payload.id,
      eventType: payload.type,
      payload,
      statusCode,
      responseBodySnippet: responseSnippet,
      durationMs,
      attemptNumber,
      signatureHeader,
      deliveryStatus,
      nextRetryAt,
      idempotencyKey,
    });

    return deliveryLog;
  }

  /**
   * Manually replay a delivery from log
   */
  static async replayDelivery(
    deliveryLogId: string | mongoose.Types.ObjectId,
    tenantId: string | mongoose.Types.ObjectId
  ): Promise<any> {
    const log = await WebhookDeliveryLog.findOne({ _id: deliveryLogId, tenantId });
    if (!log) throw new Error('Delivery log not found');

    const subscription = await WebhookSubscription.findById(log.subscriptionId);
    if (!subscription) throw new Error('Webhook subscription not found');

    const nextAttempt = log.attemptNumber + 1;
    const payloadString = JSON.stringify(log.payload);

    return this.deliverWebhook(subscription, log.payload as WebhookEventPayload, payloadString, nextAttempt);
  }
}

