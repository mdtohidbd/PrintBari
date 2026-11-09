import crypto from 'crypto';
import mongoose from 'mongoose';
import {
  ApiKey,
  WebhookSubscription,
  WebhookDeliveryLog,
  TenantIntegrationConfig,
  ApiKeyScope,
  WebhookEventTopic,
  IntegrationProvider,
  IntegrationCategory,
} from '../../models/Integration.model';
import { ShopTransaction } from '../../models/ShopFinance.model';
import { NotFoundError, BadRequestError } from '../../errors';
import { WebhookDispatcherService } from '../../services/webhookDispatcher.service';

export class DeveloperService {
  // ==========================================================================
  // 1. API KEY LIFECYCLE
  // ==========================================================================

  static async createApiKey(
    tenantId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    data: {
      name: string;
      scopes?: ApiKeyScope[];
      rateLimitRpm?: number;
      expiresAt?: Date | null;
    }
  ) {
    if (!data.name || data.name.trim().length === 0) {
      throw new BadRequestError('API key name is required');
    }

    // Generate high-entropy API key: dcu_live_...
    const randomBytes = crypto.randomBytes(24).toString('base64url');
    const rawKey = `dcu_live_${randomBytes}`;
    const keyPrefix = `dcu_live_${randomBytes.substring(0, 6)}...`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await ApiKey.create({
      tenantId,
      name: data.name.trim(),
      keyPrefix,
      keyHash,
      scopes: data.scopes || ['jobs:read', 'customers:read'],
      rateLimitRpm: data.rateLimitRpm || 300,
      expiresAt: data.expiresAt || null,
      createdBy: userId,
    });

    return {
      apiKey: {
        id: apiKey._id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
        rateLimitRpm: apiKey.rateLimitRpm,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      },
      rawKey, // Returned ONLY ONCE to the user
      warning: 'Store this key securely. It will NEVER be shown again.',
    };
  }

  static async listApiKeys(tenantId: string | mongoose.Types.ObjectId) {
    return ApiKey.find({ tenantId })
      .select('-keyHash')
      .sort({ createdAt: -1 })
      .lean();
  }

  static async rotateApiKey(
    tenantId: string | mongoose.Types.ObjectId,
    keyId: string,
    userId: string | mongoose.Types.ObjectId
  ) {
    const existing = await ApiKey.findOne({ _id: keyId, tenantId, isActive: true });
    if (!existing) {
      throw new NotFoundError('API key not found or already inactive');
    }

    // Revoke old key
    existing.isActive = false;
    existing.revokedAt = new Date();
    existing.revocationReason = 'Rotated by user';
    await existing.save();

    // Create new key preserving name, scopes, and rate limits
    return this.createApiKey(tenantId, userId, {
      name: `${existing.name} (Rotated ${new Date().toISOString().substring(0, 10)})`,
      scopes: existing.scopes,
      rateLimitRpm: existing.rateLimitRpm,
      expiresAt: existing.expiresAt,
    });
  }

  static async revokeApiKey(
    tenantId: string | mongoose.Types.ObjectId,
    keyId: string,
    reason: string = 'Revoked by user'
  ) {
    const key = await ApiKey.findOne({ _id: keyId, tenantId });
    if (!key) throw new NotFoundError('API key not found');

    key.isActive = false;
    key.revokedAt = new Date();
    key.revocationReason = reason;
    await key.save();

    return { id: key._id, status: 'REVOKED', revokedAt: key.revokedAt };
  }

  // ==========================================================================
  // 2. WEBHOOK SUBSCRIPTIONS & EVENT DISPATCHING
  // ==========================================================================

  static async createWebhookSubscription(
    tenantId: string | mongoose.Types.ObjectId,
    data: {
      targetUrl: string;
      subscribedEvents: WebhookEventTopic[];
      description?: string;
    }
  ) {
    if (!data.targetUrl || !data.targetUrl.startsWith('http')) {
      throw new BadRequestError('A valid HTTPS or HTTP targetUrl is required');
    }

    if (!data.subscribedEvents || data.subscribedEvents.length === 0) {
      throw new BadRequestError('At least one subscribed event topic is required');
    }

    // Cryptographic signing secret
    const secret = `whsec_${crypto.randomBytes(24).toString('base64url')}`;

    const sub = await WebhookSubscription.create({
      tenantId,
      targetUrl: data.targetUrl.trim(),
      secret,
      subscribedEvents: data.subscribedEvents,
      description: data.description || '',
    });

    return sub;
  }

  static async listWebhookSubscriptions(tenantId: string | mongoose.Types.ObjectId) {
    const subs = await WebhookSubscription.find({ tenantId }).sort({ createdAt: -1 }).lean();
    return subs.map((s) => ({
      ...s,
      secretMasked: `${s.secret.substring(0, 10)}...****`,
    }));
  }

  static async updateWebhookSubscription(
    tenantId: string | mongoose.Types.ObjectId,
    subId: string,
    data: Partial<{
      targetUrl: string;
      subscribedEvents: WebhookEventTopic[];
      isActive: boolean;
      description: string;
    }>
  ) {
    const sub = await WebhookSubscription.findOne({ _id: subId, tenantId });
    if (!sub) throw new NotFoundError('Webhook subscription not found');

    if (data.targetUrl) sub.targetUrl = data.targetUrl.trim();
    if (data.subscribedEvents) sub.subscribedEvents = data.subscribedEvents;
    if (data.isActive !== undefined) sub.isActive = data.isActive;
    if (data.description !== undefined) sub.description = data.description;

    await sub.save();
    return sub;
  }

  static async deleteWebhookSubscription(
    tenantId: string | mongoose.Types.ObjectId,
    subId: string
  ) {
    const res = await WebhookSubscription.deleteOne({ _id: subId, tenantId });
    if (res.deletedCount === 0) throw new NotFoundError('Webhook subscription not found');
    return { success: true };
  }

  static async rotateWebhookSecret(
    tenantId: string | mongoose.Types.ObjectId,
    subId: string
  ) {
    const sub = await WebhookSubscription.findOne({ _id: subId, tenantId });
    if (!sub) throw new NotFoundError('Webhook subscription not found');

    sub.secret = `whsec_${crypto.randomBytes(24).toString('base64url')}`;
    await sub.save();

    return {
      id: sub._id,
      newSecret: sub.secret,
      warning: 'Update your webhook receiver with this new HMAC secret immediately.',
    };
  }

  static async listDeliveryLogs(
    tenantId: string | mongoose.Types.ObjectId,
    query: {
      subscriptionId?: string;
      deliveryStatus?: string;
      limit?: number;
    }
  ) {
    const filter: any = { tenantId };
    if (query.subscriptionId) filter.subscriptionId = query.subscriptionId;
    if (query.deliveryStatus) filter.deliveryStatus = query.deliveryStatus;

    return WebhookDeliveryLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(query.limit || 50)
      .lean();
  }

  static async testPingWebhook(
    tenantId: string | mongoose.Types.ObjectId,
    subId: string
  ) {
    const sub = await WebhookSubscription.findOne({ _id: subId, tenantId });
    if (!sub) throw new NotFoundError('Webhook subscription not found');

    const testEventData = {
      message: 'Ping test event from DocuStudio developer platform',
      timestamp: new Date().toISOString(),
      studioId: tenantId.toString(),
    };

    await WebhookDispatcherService.dispatchEvent(tenantId, 'integration.alert', testEventData);

    return { success: true, message: 'Test ping event dispatched' };
  }

  // ==========================================================================
  // 3. THIRD-PARTY INTEGRATION HUB (CATALOG & TENANT SETTINGS)
  // ==========================================================================

  static async listTenantIntegrations(tenantId: string | mongoose.Types.ObjectId) {
    const configs = await TenantIntegrationConfig.find({ tenantId }).lean();

    const standardProviders: {
      category: IntegrationCategory;
      provider: IntegrationProvider;
      name: string;
      description: string;
      docsUrl: string;
    }[] = [
      {
        category: 'PAYMENT',
        provider: 'BKASH',
        name: 'bKash Merchant Gateway',
        description: 'Direct Bangladesh MFS automated checkout, payment tokenization & refunds',
        docsUrl: 'https://developer.bKash.com',
      },
      {
        category: 'PAYMENT',
        provider: 'STRIPE',
        name: 'Stripe Global Payments',
        description: 'International credit & debit card processing with 3D Secure 2',
        docsUrl: 'https://stripe.com/docs',
      },
      {
        category: 'EMAIL',
        provider: 'SENDGRID',
        name: 'Twilio SendGrid Email',
        description: 'Transactional email delivery for invoices, receipts and notifications',
        docsUrl: 'https://docs.sendgrid.com',
      },
      {
        category: 'SMS',
        provider: 'GREENWEB',
        name: 'Greenweb SMS Gateway',
        description: 'High-throughput local Bangladesh SMS gateway for order ready alerts',
        docsUrl: 'https://greenweb.com.bd',
      },
      {
        category: 'WHATSAPP',
        provider: 'META_WHATSAPP',
        name: 'WhatsApp Business Cloud API',
        description: 'Direct Meta cloud WhatsApp template notifications with PDF attachments',
        docsUrl: 'https://developers.facebook.com/docs/whatsapp',
      },
      {
        category: 'STORAGE',
        provider: 'AWS_S3',
        name: 'Amazon Web Services S3',
        description: 'Dedicated enterprise object storage bucket with zero cross-tenant bleed',
        docsUrl: 'https://aws.amazon.com/s3/',
      },
      {
        category: 'GOOGLE_DRIVE',
        provider: 'GOOGLE_DRIVE',
        name: 'Google Drive Cloud Sync',
        description: 'OAuth2 daily cloud document backup and archive export',
        docsUrl: 'https://developers.google.com/drive',
      },
      {
        category: 'ACCOUNTING',
        provider: 'TALLY',
        name: 'TallyPrime / Tally ERP 9 XML',
        description: 'Automated sales ledger XML export compliant with Tally accounting',
        docsUrl: 'https://tallysolutions.com',
      },
    ];

    return standardProviders.map((std) => {
      const match = configs.find((c) => c.provider === std.provider);
      return {
        ...std,
        isEnabled: match?.isEnabled || false,
        isConfigured: Boolean(match),
        healthStatus: match?.health.status || 'UNCONFIGURED',
        lastSuccessAt: match?.health.lastSuccessAt,
        settings: match?.settings || {},
      };
    });
  }

  static async configureIntegration(
    tenantId: string | mongoose.Types.ObjectId,
    data: {
      category: IntegrationCategory;
      provider: IntegrationProvider;
      name: string;
      isEnabled: boolean;
      isCustomCredentials?: boolean;
      credentials?: Record<string, string>;
      settings?: Record<string, any>;
    }
  ) {
    let config = await TenantIntegrationConfig.findOne({ tenantId, provider: data.provider });

    const maskedCredentials: Record<string, string> = {};
    if (data.credentials) {
      for (const [k, v] of Object.entries(data.credentials)) {
        maskedCredentials[k] =
          v.length > 8 ? `${v.substring(0, 4)}...${v.substring(v.length - 4)}` : '****';
      }
    }

    if (!config) {
      config = new TenantIntegrationConfig({
        tenantId,
        category: data.category,
        provider: data.provider,
        name: data.name,
        isEnabled: data.isEnabled,
        isCustomCredentials: data.isCustomCredentials || false,
        credentialsMasked: maskedCredentials,
        settings: data.settings || {},
        health: {
          status: data.isEnabled ? 'HEALTHY' : 'UNCONFIGURED',
          lastCheckedAt: new Date(),
          lastSuccessAt: data.isEnabled ? new Date() : undefined,
          consecutiveFailures: 0,
        },
      });
    } else {
      config.isEnabled = data.isEnabled;
      if (data.isCustomCredentials !== undefined) config.isCustomCredentials = data.isCustomCredentials;
      if (Object.keys(maskedCredentials).length > 0) config.credentialsMasked = maskedCredentials;
      if (data.settings) config.settings = { ...config.settings, ...data.settings };
      config.health.status = data.isEnabled ? 'HEALTHY' : 'UNCONFIGURED';
      config.health.lastCheckedAt = new Date();
    }

    await config.save();
    return config;
  }

  // ==========================================================================
  // 4. ACCOUNTING EXPORT GENERATOR (TALLY XML & CSV)
  // ==========================================================================

  static async exportAccounting(
    tenantId: string | mongoose.Types.ObjectId,
    format: 'TALLY_XML' | 'CSV',
    startDate?: Date,
    endDate?: Date
  ) {
    const filter: any = { tenantId };
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = startDate;
      if (endDate) filter.createdAt.$lte = endDate;
    }

    const transactions = await ShopTransaction.find(filter).sort({ createdAt: 1 }).lean();

    if (format === 'CSV') {
      const headers = ['TransactionCode', 'Date', 'Type', 'Amount', 'PaymentMethod', 'Category', 'Customer'];
      const rows = transactions.map((t) => [
        t.transactionCode,
        new Date(t.createdAt).toISOString().substring(0, 10),
        t.type,
        t.amount.toFixed(2),
        t.paymentMethod,
        t.category,
        t.customerName || 'Walk-in',
      ]);
      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      return {
        contentType: 'text/csv',
        filename: `accounting-export-${Date.now()}.csv`,
        content: csvContent,
      };
    }

    // Tally ERP 9 / TallyPrime XML standard envelope
    const tallyVouchers = transactions
      .map((t) => {
        const dateStr = new Date(t.createdAt).toISOString().substring(0, 10).replace(/-/g, '');
        return `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <VOUCHER VCHTYPE="Sales" ACTION="Create">
        <DATE>${dateStr}</DATE>
        <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
        <VOUCHERNUMBER>${t.transactionCode}</VOUCHERNUMBER>
        <PARTYLEDGERNAME>${t.paymentMethod === 'CASH' ? 'Cash' : 'Bank / MFS'}</PARTYLEDGERNAME>
        <NARRATION>DocuStudio ${t.category} Sale - Customer: ${t.customerName || 'Walk-in'}</NARRATION>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${t.paymentMethod === 'CASH' ? 'Cash' : 'Bank Accounts'}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>-${t.amount.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>Sales - Studio Services</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${t.amount.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
      </VOUCHER>
    </TALLYMESSAGE>`;
      })
      .join('');

    const tallyXml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>DocuStudio Shop</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${tallyVouchers}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    return {
      contentType: 'application/xml',
      filename: `tally-import-${Date.now()}.xml`,
      content: tallyXml,
    };
  }
}

