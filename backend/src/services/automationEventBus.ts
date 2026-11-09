import { EventEmitter } from 'events';
import mongoose from 'mongoose';
import { Notification, NotificationType, NotificationCategory, NotificationDeliveryStatus } from '../models/Notification.model';
import { WebhookDispatcherService } from './webhookDispatcher.service';
import { logger } from '../utils/logger';

export interface AutomationEventPayload {
  tenantId: string | mongoose.Types.ObjectId;
  jobId?: string | mongoose.Types.ObjectId;
  jobCode?: string;
  customerId?: string | mongoose.Types.ObjectId;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  staffId?: string | mongoose.Types.ObjectId;
  staffName?: string;
  reviewerId?: string | mongoose.Types.ObjectId;
  reviewerName?: string;
  serviceType?: string;
  totalAmount?: number;
  paidAmount?: number;
  notes?: string;
  metadata?: Record<string, any>;
}

export type AutomationEventType =
  | 'JOB_CREATED'
  | 'JOB_ASSIGNED'
  | 'JOB_READY_FOR_REVIEW'
  | 'JOB_APPROVED'
  | 'JOB_COMPLETED'
  | 'SUBSCRIPTION_EXPIRING'
  | 'PAYMENT_CONFIRMED';

export class AutomationEventBus extends EventEmitter {
  private static instance: AutomationEventBus;

  private constructor() {
    super();
    this.setupListeners();
  }

  public static getInstance(): AutomationEventBus {
    if (!AutomationEventBus.instance) {
      AutomationEventBus.instance = new AutomationEventBus();
    }
    return AutomationEventBus.instance;
  }

  private setupListeners(): void {
    this.on('JOB_CREATED', (payload: AutomationEventPayload) => this.handleJobCreated(payload));
    this.on('JOB_ASSIGNED', (payload: AutomationEventPayload) => this.handleJobAssigned(payload));
    this.on('JOB_READY_FOR_REVIEW', (payload: AutomationEventPayload) => this.handleJobReadyForReview(payload));
    this.on('JOB_APPROVED', (payload: AutomationEventPayload) => this.handleJobApproved(payload));
    this.on('JOB_COMPLETED', (payload: AutomationEventPayload) => this.handleJobCompleted(payload));
    this.on('SUBSCRIPTION_EXPIRING', (payload: AutomationEventPayload) => this.handleSubscriptionExpiring(payload));
    this.on('PAYMENT_CONFIRMED', (payload: AutomationEventPayload) => this.handlePaymentConfirmed(payload));
  }

  /**
   * Helper to safely persist a notification with idempotency check
   */
  public async createNotificationSafe(params: {
    tenantId: mongoose.Types.ObjectId | string;
    recipientId?: mongoose.Types.ObjectId | string;
    customerPhone?: string;
    customerEmail?: string;
    type: NotificationType;
    category: NotificationCategory;
    title: string;
    message: string;
    data?: Record<string, any>;
    idempotencyKey?: string;
  }): Promise<void> {
    try {
      if (params.idempotencyKey) {
        const existing = await Notification.findOne({
          tenantId: new mongoose.Types.ObjectId(params.tenantId),
          idempotencyKey: params.idempotencyKey,
        });
        if (existing) {
          logger.info(`[EventBus] Idempotent notification skipped for key: ${params.idempotencyKey}`);
          return;
        }
      }

      await Notification.create({
        tenantId: new mongoose.Types.ObjectId(params.tenantId),
        recipientId: params.recipientId ? new mongoose.Types.ObjectId(params.recipientId) : undefined,
        customerPhone: params.customerPhone,
        customerEmail: params.customerEmail,
        type: params.type,
        category: params.category,
        title: params.title,
        message: params.message,
        data: params.data || {},
        deliveryStatus: params.type === 'IN_APP' ? 'SENT' : 'DELIVERED',
        idempotencyKey: params.idempotencyKey,
        isRead: false,
        retryCount: 0,
      });

      logger.info(`[EventBus] Notification dispatched: [${params.type}] ${params.title}`);
    } catch (err: any) {
      logger.error(`[EventBus] Failed to dispatch notification: ${err.message}`);
    }
  }

  private async handleJobCreated(payload: AutomationEventPayload): Promise<void> {
    const { tenantId, jobCode, customerName, totalAmount } = payload;
    const idempotencyKey = `JOB_CREATED_${tenantId}_${jobCode}`;

    // In-app notification for shop staff
    await this.createNotificationSafe({
      tenantId,
      type: 'IN_APP',
      category: 'JOB_EVENT',
      title: `New Order: ${jobCode}`,
      message: `Order ${jobCode} created for ${customerName || 'Customer'} (Total: ${totalAmount || 0} BDT)`,
      data: { jobCode, customerName, totalAmount },
      idempotencyKey,
    });

    // Dispatch webhook to subscribers
    WebhookDispatcherService.dispatchEvent(tenantId, 'job.created', payload).catch((err) => {
      logger.error(`[EventBus] Webhook dispatch error for job.created: ${err.message}`);
    });
  }

  private async handleJobAssigned(payload: AutomationEventPayload): Promise<void> {
    const { tenantId, staffId, jobCode, staffName } = payload;
    if (!staffId) return;

    const idempotencyKey = `JOB_ASSIGNED_${tenantId}_${jobCode}_${staffId}`;

    await this.createNotificationSafe({
      tenantId,
      recipientId: staffId,
      type: 'IN_APP',
      category: 'JOB_EVENT',
      title: `Job Assigned: ${jobCode}`,
      message: `You have been assigned to handle job order ${jobCode}.`,
      data: { jobCode, staffName },
      idempotencyKey,
    });
  }

  private async handleJobReadyForReview(payload: AutomationEventPayload): Promise<void> {
    const { tenantId, reviewerId, jobCode, staffName } = payload;
    const idempotencyKey = `JOB_REVIEW_${tenantId}_${jobCode}_${reviewerId || 'ALL'}`;

    await this.createNotificationSafe({
      tenantId,
      recipientId: reviewerId,
      type: 'IN_APP',
      category: 'JOB_EVENT',
      title: `Review Requested: ${jobCode}`,
      message: `Job ${jobCode} submitted by ${staffName || 'Operator'} is ready for quality review.`,
      data: { jobCode, staffName },
      idempotencyKey,
    });
  }

  private async handleJobApproved(payload: AutomationEventPayload): Promise<void> {
    const { tenantId, staffId, jobCode, reviewerName } = payload;
    const idempotencyKey = `JOB_APPROVED_${tenantId}_${jobCode}`;

    await this.createNotificationSafe({
      tenantId,
      recipientId: staffId,
      type: 'IN_APP',
      category: 'JOB_EVENT',
      title: `Job Approved: ${jobCode}`,
      message: `Job ${jobCode} has been approved by ${reviewerName || 'Quality Lead'} and is ready for printing/delivery.`,
      data: { jobCode, reviewerName },
      idempotencyKey,
    });
  }

  private async handleJobCompleted(payload: AutomationEventPayload): Promise<void> {
    const { tenantId, jobCode, customerName, customerPhone } = payload;
    const idempotencyKey = `JOB_COMPLETED_${tenantId}_${jobCode}`;

    // Notify staff
    await this.createNotificationSafe({
      tenantId,
      type: 'IN_APP',
      category: 'JOB_EVENT',
      title: `Job Completed: ${jobCode}`,
      message: `Job ${jobCode} for ${customerName || 'Customer'} is now completed and ready for pickup.`,
      data: { jobCode, customerName },
      idempotencyKey: `${idempotencyKey}_STAFF`,
    });

    // Notify customer via SMS stub if phone number available
    if (customerPhone) {
      await this.createNotificationSafe({
        tenantId,
        customerPhone,
        type: 'SMS',
        category: 'JOB_EVENT',
        title: `Your Order is Ready: ${jobCode}`,
        message: `Hello ${customerName || 'Customer'}, your order ${jobCode} is printed and ready for pickup at our shop!`,
        data: { jobCode, customerPhone },
        idempotencyKey: `${idempotencyKey}_CUSTOMER_SMS`,
      });
    }

    // Dispatch webhook to subscribers
    WebhookDispatcherService.dispatchEvent(tenantId, 'job.completed', payload).catch((err) => {
      logger.error(`[EventBus] Webhook dispatch error for job.completed: ${err.message}`);
    });
  }

  private async handleSubscriptionExpiring(payload: AutomationEventPayload): Promise<void> {
    const { tenantId, metadata } = payload;
    const daysLeft = metadata?.daysLeft || 3;
    const idempotencyKey = `SUB_EXP_${tenantId}_${daysLeft}DAYS`;

    await this.createNotificationSafe({
      tenantId,
      type: 'IN_APP',
      category: 'SUBSCRIPTION',
      title: 'Subscription Expiring Soon',
      message: `Your shop plan will expire in ${daysLeft} days. Please renew to prevent service interruptions.`,
      data: { daysLeft },
      idempotencyKey,
    });
  }

  private async handlePaymentConfirmed(payload: AutomationEventPayload): Promise<void> {
    const { tenantId, jobCode, customerName, paidAmount } = payload;
    const idempotencyKey = `PAYMENT_${tenantId}_${jobCode}_${paidAmount}`;

    await this.createNotificationSafe({
      tenantId,
      type: 'IN_APP',
      category: 'PAYMENT',
      title: `Payment Received: ${jobCode}`,
      message: `Received payment of ${paidAmount} BDT for order ${jobCode} (${customerName || 'Customer'}).`,
      data: { jobCode, paidAmount, customerName },
      idempotencyKey,
    });

    // Dispatch webhook to subscribers
    WebhookDispatcherService.dispatchEvent(tenantId, 'payment.received', payload).catch((err) => {
      logger.error(`[EventBus] Webhook dispatch error for payment.received: ${err.message}`);
    });
  }
}

export const automationEventBus = AutomationEventBus.getInstance();

