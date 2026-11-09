import mongoose, { Document, Schema, Model } from 'mongoose';

// 1. Subscription Plan Configuration (Configurable from Super Admin)
export interface IPlanConfig extends Document {
  planKey: string;
  displayName: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  storageLimitMB: number;
  staffLimit: number;
  monthlyJobLimit: number;
  enabledModules: string[];
  backupAvailability: 'NONE' | 'MANUAL' | 'WEEKLY' | 'DAILY';
  featureRestrictions: {
    watermark: boolean;
    highDpiExport: boolean;
    multiPrinterSpool: boolean;
    customBranding: boolean;
    apiAccess: boolean;
  };
  isPopular: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PlanConfigSchema = new Schema<IPlanConfig>(
  {
    planKey: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      index: true,
    },
    displayName: { type: String, required: true },
    description: { type: String, required: true },
    monthlyPrice: { type: Number, required: true, min: 0 },
    yearlyPrice: { type: Number, required: true, min: 0 },
    storageLimitMB: { type: Number, required: true, default: 5000 },
    staffLimit: { type: Number, required: true, default: 2 },
    monthlyJobLimit: { type: Number, required: true, default: 150 },
    enabledModules: {
      type: [String],
      default: ['PASSPORT', 'DOCUMENT', 'IDCARD', 'CV', 'OCR', 'PRINT_QUEUE', 'CRM'],
    },
    backupAvailability: {
      type: String,
      enum: ['NONE', 'MANUAL', 'WEEKLY', 'DAILY'],
      default: 'MANUAL',
    },
    featureRestrictions: {
      watermark: { type: Boolean, default: false },
      highDpiExport: { type: Boolean, default: true },
      multiPrinterSpool: { type: Boolean, default: true },
      customBranding: { type: Boolean, default: false },
      apiAccess: { type: Boolean, default: false },
    },
    isPopular: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// 2. Payment Transaction (bKash, Nagad, SSLCommerz, Manual)
export type PaymentProvider = 'BKASH' | 'NAGAD' | 'SSLCOMMERZ' | 'MANUAL';
export type PaymentStatus = 'INITIATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'REFUNDED';

export interface IPaymentTransaction extends Document {
  tenantId: mongoose.Types.ObjectId;
  transactionCode: string;
  planKey: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
  amount: number;
  currency: 'BDT' | 'USD';
  provider: PaymentProvider;
  providerTransactionId?: string;
  providerPaymentId?: string;
  paymentStatus: PaymentStatus;
  signature?: string;
  idempotencyKey: string;
  invoiceNumber: string;
  invoiceUrl?: string;
  paidAt?: Date;
  refundedAt?: Date;
  refundReason?: string;
  refundAmount?: number;
  refundProcessedBy?: mongoose.Types.ObjectId;
  retryCount: number;
  lastRetryAt?: Date;
  errorMessage?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentTransactionSchema = new Schema<IPaymentTransaction>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    transactionCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      index: true,
    },
    planKey: {
      type: String,
      required: true,
      uppercase: true,
    },
    billingCycle: {
      type: String,
      enum: ['MONTHLY', 'YEARLY'],
      required: true,
      default: 'MONTHLY',
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      enum: ['BDT', 'USD'],
      default: 'BDT',
    },
    provider: {
      type: String,
      enum: ['BKASH', 'NAGAD', 'SSLCOMMERZ', 'MANUAL'],
      required: true,
      index: true,
    },
    providerTransactionId: {
      type: String,
      trim: true,
      index: true,
    },
    providerPaymentId: {
      type: String,
      trim: true,
    },
    paymentStatus: {
      type: String,
      enum: ['INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED'],
      default: 'INITIATED',
      index: true,
    },
    signature: {
      type: String,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      index: true,
    },
    invoiceUrl: {
      type: String,
    },
    paidAt: {
      type: Date,
    },
    refundedAt: {
      type: Date,
    },
    refundReason: {
      type: String,
    },
    refundAmount: {
      type: Number,
    },
    refundProcessedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    lastRetryAt: {
      type: Date,
    },
    errorMessage: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

PaymentTransactionSchema.index({ tenantId: 1, createdAt: -1 });
PaymentTransactionSchema.index({ paymentStatus: 1, createdAt: -1 });
PaymentTransactionSchema.index({ provider: 1, paymentStatus: 1 });

// 3. Subscription Invoice
export interface ISubscriptionInvoice extends Document {
  invoiceNumber: string;
  tenantId: mongoose.Types.ObjectId;
  shopName: string;
  planName: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
  amount: number;
  vat: number;
  totalAmount: number;
  paymentMethod: string;
  transactionCode: string;
  periodStart: Date;
  periodEnd: Date;
  status: 'PAID' | 'VOID' | 'UNPAID' | 'REFUNDED';
  issuedAt: Date;
}

const SubscriptionInvoiceSchema = new Schema<ISubscriptionInvoice>(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    shopName: { type: String, required: true },
    planName: { type: String, required: true },
    billingCycle: { type: String, enum: ['MONTHLY', 'YEARLY'], default: 'MONTHLY' },
    amount: { type: Number, required: true },
    vat: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    paymentMethod: { type: String, required: true },
    transactionCode: { type: String, required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    status: { type: String, enum: ['PAID', 'VOID', 'UNPAID', 'REFUNDED'], default: 'PAID' },
    issuedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

SubscriptionInvoiceSchema.index({ tenantId: 1, issuedAt: -1 });
SubscriptionInvoiceSchema.index({ status: 1, issuedAt: -1 });

export const PlanConfig: Model<IPlanConfig> = mongoose.model<IPlanConfig>('PlanConfig', PlanConfigSchema);
export const PaymentTransaction: Model<IPaymentTransaction> = mongoose.model<IPaymentTransaction>(
  'PaymentTransaction',
  PaymentTransactionSchema
);
export const SubscriptionInvoice: Model<ISubscriptionInvoice> = mongoose.model<ISubscriptionInvoice>(
  'SubscriptionInvoice',
  SubscriptionInvoiceSchema
);

