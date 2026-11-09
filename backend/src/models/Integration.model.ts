import mongoose, { Document, Schema, Model } from 'mongoose';

// ============================================================================
// 1. API KEY MODEL (DEVELOPER PLATFORM)
// ============================================================================
export type ApiKeyScope =
  | 'jobs:read'
  | 'jobs:write'
  | 'customers:read'
  | 'customers:write'
  | 'finance:read'
  | 'finance:write'
  | 'printers:read'
  | 'webhooks:manage'
  | 'integrations:manage'
  | 'analytics:read';

export interface IApiKey extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  keyPrefix: string; // e.g. "dcu_live_a1b2"
  keyHash: string; // SHA-256 hash of full raw key
  scopes: ApiKeyScope[];
  rateLimitRpm: number; // requests per minute
  expiresAt?: Date | null;
  lastUsedAt?: Date;
  isActive: boolean;
  revokedAt?: Date;
  revocationReason?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ApiKeySchema = new Schema<IApiKey>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    keyPrefix: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    keyHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    scopes: {
      type: [String],
      required: true,
      default: ['jobs:read', 'customers:read'],
    },
    rateLimitRpm: {
      type: Number,
      default: 300,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    lastUsedAt: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    revokedAt: {
      type: Date,
    },
    revocationReason: {
      type: String,
      default: '',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

ApiKeySchema.index({ tenantId: 1, isActive: 1 });

export const ApiKey: Model<IApiKey> = mongoose.model<IApiKey>('ApiKey', ApiKeySchema);

// ============================================================================
// 2. WEBHOOK SUBSCRIPTION MODEL
// ============================================================================
export type WebhookEventTopic =
  | 'job.created'
  | 'job.assigned'
  | 'job.ready_for_review'
  | 'job.approved'
  | 'job.completed'
  | 'job.printed'
  | 'customer.created'
  | 'customer.updated'
  | 'payment.received'
  | 'payment.refunded'
  | 'subscription.expiring'
  | 'integration.alert';

export interface IWebhookSubscription extends Document {
  tenantId: mongoose.Types.ObjectId;
  targetUrl: string;
  secret: string; // HMAC-SHA256 signing secret
  subscribedEvents: WebhookEventTopic[];
  isActive: boolean;
  description?: string;
  failedAttempts: number;
  circuitBreaker: {
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    trippedAt?: Date;
    resetAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const WebhookSubscriptionSchema = new Schema<IWebhookSubscription>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    targetUrl: {
      type: String,
      required: true,
      trim: true,
      match: [/^https?:\/\//, 'targetUrl must start with http:// or https://'],
    },
    secret: {
      type: String,
      required: true,
    },
    subscribedEvents: {
      type: [String],
      required: true,
      default: ['job.completed', 'payment.received'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
    },
    failedAttempts: {
      type: Number,
      default: 0,
    },
    circuitBreaker: {
      state: {
        type: String,
        enum: ['CLOSED', 'OPEN', 'HALF_OPEN'],
        default: 'CLOSED',
      },
      trippedAt: { type: Date },
      resetAt: { type: Date },
    },
  },
  { timestamps: true }
);

WebhookSubscriptionSchema.index({ tenantId: 1, isActive: 1 });

export const WebhookSubscription: Model<IWebhookSubscription> =
  mongoose.model<IWebhookSubscription>('WebhookSubscription', WebhookSubscriptionSchema);

// ============================================================================
// 3. WEBHOOK DELIVERY LOG MODEL
// ============================================================================
export type WebhookDeliveryStatus = 'DELIVERED' | 'FAILED' | 'RETRYING' | 'DEAD_LETTER';

export interface IWebhookDeliveryLog extends Document {
  tenantId: mongoose.Types.ObjectId;
  subscriptionId: mongoose.Types.ObjectId;
  eventId: string;
  eventType: string;
  payload: Record<string, any>;
  statusCode?: number;
  responseBodySnippet?: string;
  durationMs: number;
  attemptNumber: number;
  signatureHeader: string;
  deliveryStatus: WebhookDeliveryStatus;
  nextRetryAt?: Date | null;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookDeliveryLogSchema = new Schema<IWebhookDeliveryLog>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'WebhookSubscription',
      required: true,
      index: true,
    },
    eventId: {
      type: String,
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    statusCode: {
      type: Number,
    },
    responseBodySnippet: {
      type: String,
      maxlength: 1000,
    },
    durationMs: {
      type: Number,
      default: 0,
    },
    attemptNumber: {
      type: Number,
      default: 1,
    },
    signatureHeader: {
      type: String,
      required: true,
    },
    deliveryStatus: {
      type: String,
      enum: ['DELIVERED', 'FAILED', 'RETRYING', 'DEAD_LETTER'],
      default: 'DELIVERED',
      index: true,
    },
    nextRetryAt: {
      type: Date,
      default: null,
    },
    idempotencyKey: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

WebhookDeliveryLogSchema.index({ tenantId: 1, createdAt: -1 });

export const WebhookDeliveryLog: Model<IWebhookDeliveryLog> =
  mongoose.model<IWebhookDeliveryLog>('WebhookDeliveryLog', WebhookDeliveryLogSchema);

// ============================================================================
// 4. TENANT THIRD-PARTY INTEGRATION CONFIGURATION MODEL
// ============================================================================
export type IntegrationCategory =
  | 'PAYMENT'
  | 'EMAIL'
  | 'SMS'
  | 'WHATSAPP'
  | 'STORAGE'
  | 'GOOGLE_DRIVE'
  | 'ACCOUNTING';

export type IntegrationProvider =
  | 'BKASH'
  | 'NAGAD'
  | 'SSLCOMMERZ'
  | 'STRIPE'
  | 'SENDGRID'
  | 'POSTMARK'
  | 'SMTP'
  | 'GREENWEB'
  | 'TWILIO'
  | 'SSLWIRELESS'
  | 'META_WHATSAPP'
  | 'INFOBIP'
  | 'AWS_S3'
  | 'MINIO'
  | 'GOOGLE_DRIVE'
  | 'TALLY'
  | 'QUICKBOOKS'
  | 'CSV_LEDGER';

export interface ITenantIntegrationConfig extends Document {
  tenantId: mongoose.Types.ObjectId;
  category: IntegrationCategory;
  provider: IntegrationProvider;
  name: string;
  isEnabled: boolean;
  isCustomCredentials: boolean; // true = shop uses own API keys, false = platform-managed gateway
  credentialsMasked: Record<string, string>; // e.g. { apiKey: "sk_live_...****" }
  credentialsEncrypted?: string; // AES-256-GCM ciphertext
  settings: Record<string, any>; // Provider-specific options e.g. { sandbox: true, defaultSender: "Studio" }
  health: {
    status: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNCONFIGURED';
    lastCheckedAt?: Date;
    lastSuccessAt?: Date;
    lastErrorMessage?: string;
    consecutiveFailures: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const TenantIntegrationConfigSchema = new Schema<ITenantIntegrationConfig>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['PAYMENT', 'EMAIL', 'SMS', 'WHATSAPP', 'STORAGE', 'GOOGLE_DRIVE', 'ACCOUNTING'],
      required: true,
      index: true,
    },
    provider: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    isEnabled: {
      type: Boolean,
      default: false,
      index: true,
    },
    isCustomCredentials: {
      type: Boolean,
      default: false,
    },
    credentialsMasked: {
      type: Schema.Types.Mixed,
      default: {},
    },
    credentialsEncrypted: {
      type: String,
    },
    settings: {
      type: Schema.Types.Mixed,
      default: {},
    },
    health: {
      status: {
        type: String,
        enum: ['HEALTHY', 'DEGRADED', 'DOWN', 'UNCONFIGURED'],
        default: 'UNCONFIGURED',
      },
      lastCheckedAt: { type: Date },
      lastSuccessAt: { type: Date },
      lastErrorMessage: { type: String, default: '' },
      consecutiveFailures: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

TenantIntegrationConfigSchema.index({ tenantId: 1, provider: 1 }, { unique: true });

export const TenantIntegrationConfig: Model<ITenantIntegrationConfig> =
  mongoose.model<ITenantIntegrationConfig>(
    'TenantIntegrationConfig',
    TenantIntegrationConfigSchema
  );

