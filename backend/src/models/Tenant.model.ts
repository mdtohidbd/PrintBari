import mongoose, { Document, Schema, Model } from 'mongoose';

export type SubscriptionPlan = 'STARTER' | 'PRO' | 'PROFESSIONAL' | 'BUSINESS' | 'ENTERPRISE' | string;
export type SubscriptionStatus =
  | 'TRIAL'
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'GRACE_PERIOD'
  | 'SUSPENDED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface IDayHours {
  open: string;
  close: string;
  isOpen: boolean;
}

export interface IEnterpriseBranch {
  branchId: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  managerUserId?: mongoose.Types.ObjectId;
  isActive: boolean;
}

export interface IEnterpriseConfig {
  customDomain?: string;
  customDomainVerified: boolean;
  customBranding: {
    primaryColor: string;
    accentColor: string;
    customLogoUrl?: string;
    customFaviconUrl?: string;
    whiteLabel: boolean;
  };
  dedicatedStorage?: {
    enabled: boolean;
    s3BucketName?: string;
    s3Region?: string;
  };
  branches: IEnterpriseBranch[];
  dedicatedDb?: {
    enabled: boolean;
    connectionUri?: string;
  };
  rateLimits?: {
    requestsPerMinute: number;
    burstLimit: number;
    concurrentJobsLimit: number;
  };
}

export interface ITenant extends Document {
  businessId: string;
  name: string;
  subdomain: string;
  ownerId?: mongoose.Types.ObjectId;
  logoUrl?: string;
  phone?: string;
  email?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  subscription: {
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    trialEndsAt: Date;
    currentPeriodEnd?: Date;
    gracePeriodEndsAt?: Date;
    suspendedAt?: Date;
    suspensionReason?: string;
    cancelledAt?: Date;
    cancellationReason?: string;
  };
  quotas: {
    maxStaffSeats: number;
    monthlyPassportLayoutsLimit: number;
    monthlyPassportLayoutsUsed: number;
    monthlyOcrPagesLimit: number;
    monthlyOcrPagesUsed: number;
    monthlyJobsLimit?: number;
    monthlyJobsUsed?: number;
    storageLimitBytes: number;
    storageUsedBytes: number;
  };
  settings: {
    currency: string;
    timezone: string;
    whatsappNotificationsEnabled: boolean;
    autoPurgeHours: number;
  };
  workingHours: {
    monday: IDayHours;
    tuesday: IDayHours;
    wednesday: IDayHours;
    thursday: IDayHours;
    friday: IDayHours;
    saturday: IDayHours;
    sunday: IDayHours;
  };
  invoiceSettings: {
    prefix: string;
    nextNumber: number;
    footerNote: string;
    taxId: string;
    taxRatePercent: number;
  };
  printSettings: {
    defaultPaperSize: string;
    autoPrintReceipt: boolean;
    printerDpi: number;
    headerMarginMm: number;
  };
  enterpriseConfig?: IEnterpriseConfig;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const defaultDayHours = { open: '09:00', close: '20:00', isOpen: true };

const TenantSchema = new Schema<ITenant>(
  {
    businessId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    subdomain: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 50,
      match: [/^[a-z0-9-]+$/, 'Subdomain can only contain lowercase alphanumeric characters and hyphens'],
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    logoUrl: {
      type: String,
      default: '',
    },
    phone: {
      type: String,
      default: '',
    },
    email: {
      type: String,
      default: '',
    },
    address: {
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      postalCode: { type: String, default: '' },
      country: { type: String, default: '' },
    },
    subscription: {
      plan: {
        type: String,
        default: 'PROFESSIONAL',
      },
      status: {
        type: String,
        enum: ['TRIAL', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'GRACE_PERIOD', 'SUSPENDED', 'EXPIRED', 'CANCELLED'],
        default: 'TRIALING',
        index: true,
      },
      trialEndsAt: {
        type: Date,
        default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
      },
      currentPeriodEnd: {
        type: Date,
      },
      gracePeriodEndsAt: {
        type: Date,
      },
      suspendedAt: {
        type: Date,
      },
      suspensionReason: {
        type: String,
        default: '',
      },
      cancelledAt: {
        type: Date,
      },
      cancellationReason: {
        type: String,
        default: '',
      },
    },
    quotas: {
      maxStaffSeats: { type: Number, default: 6 },
      monthlyPassportLayoutsLimit: { type: Number, default: 10000 },
      monthlyPassportLayoutsUsed: { type: Number, default: 0 },
      monthlyOcrPagesLimit: { type: Number, default: 300 },
      monthlyOcrPagesUsed: { type: Number, default: 0 },
      monthlyJobsLimit: { type: Number, default: 500 },
      monthlyJobsUsed: { type: Number, default: 0 },
      storageLimitBytes: { type: Number, default: 25 * 1024 * 1024 * 1024 }, // 25 GB
      storageUsedBytes: { type: Number, default: 0 },
    },
    settings: {
      currency: { type: String, default: 'USD', uppercase: true },
      timezone: { type: String, default: 'UTC' },
      whatsappNotificationsEnabled: { type: Boolean, default: true },
      autoPurgeHours: { type: Number, default: 24 }, // Zero-retention privacy
    },
    workingHours: {
      monday: { type: Object, default: defaultDayHours },
      tuesday: { type: Object, default: defaultDayHours },
      wednesday: { type: Object, default: defaultDayHours },
      thursday: { type: Object, default: defaultDayHours },
      friday: { type: Object, default: defaultDayHours },
      saturday: { type: Object, default: defaultDayHours },
      sunday: { type: Object, default: { open: '10:00', close: '16:00', isOpen: false } },
    },
    invoiceSettings: {
      prefix: { type: String, default: 'INV-' },
      nextNumber: { type: Number, default: 1001 },
      footerNote: { type: String, default: 'Thank you for choosing our digital studio!' },
      taxId: { type: String, default: '' },
      taxRatePercent: { type: Number, default: 0 },
    },
    printSettings: {
      defaultPaperSize: { type: String, default: 'A4' },
      autoPrintReceipt: { type: Boolean, default: true },
      printerDpi: { type: Number, default: 300 },
      headerMarginMm: { type: Number, default: 5 },
    },
    enterpriseConfig: {
      customDomain: { type: String, default: '', trim: true, lowercase: true },
      customDomainVerified: { type: Boolean, default: false },
      customBranding: {
        primaryColor: { type: String, default: '#0284c7' },
        accentColor: { type: String, default: '#0f172a' },
        customLogoUrl: { type: String, default: '' },
        customFaviconUrl: { type: String, default: '' },
        whiteLabel: { type: Boolean, default: false },
      },
      dedicatedStorage: {
        enabled: { type: Boolean, default: false },
        s3BucketName: { type: String, default: '' },
        s3Region: { type: String, default: 'ap-southeast-1' },
      },
      branches: [
        {
          branchId: { type: String, required: true },
          name: { type: String, required: true },
          code: { type: String, required: true },
          address: { type: String, default: '' },
          phone: { type: String, default: '' },
          managerUserId: { type: Schema.Types.ObjectId, ref: 'User' },
          isActive: { type: Boolean, default: true },
        },
      ],
      dedicatedDb: {
        enabled: { type: Boolean, default: false },
        connectionUri: { type: String, default: '' },
      },
      rateLimits: {
        requestsPerMinute: { type: Number, default: 300 },
        burstLimit: { type: Number, default: 60 },
        concurrentJobsLimit: { type: Number, default: 10 },
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Tenant: Model<ITenant> = mongoose.model<ITenant>('Tenant', TenantSchema);
