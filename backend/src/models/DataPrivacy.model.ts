import mongoose, { Document, Schema, Model } from 'mongoose';

// ---------------------------------------------------------------------------
// 1. DATA SUBJECT REQUESTS (DSR / DSAR)
// ---------------------------------------------------------------------------
export type DsrType = 'ACCESS' | 'CORRECTION' | 'EXPORT' | 'DELETION' | 'CONSENT_WITHDRAWAL';
export type DsrStatus = 'PENDING' | 'VERIFIED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';

export interface IDataSubjectRequest extends Document {
  tenantId: mongoose.Types.ObjectId;
  requestNumber: string; // e.g. DSR-2026-0001
  requestType: DsrType;
  subjectPhone: string;
  subjectName?: string;
  subjectEmail?: string;
  customerId?: mongoose.Types.ObjectId;
  status: DsrStatus;
  requestedAt: Date;
  verificationCode?: string;
  isVerified: boolean;
  completedAt?: Date;
  completedBy?: mongoose.Types.ObjectId;
  rejectionReason?: string;
  details?: string;
  auditTrail: Array<{
    action: string;
    actor: string;
    timestamp: Date;
    notes?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const DataSubjectRequestSchema = new Schema<IDataSubjectRequest>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    requestNumber: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    requestType: {
      type: String,
      required: true,
      enum: ['ACCESS', 'CORRECTION', 'EXPORT', 'DELETION', 'CONSENT_WITHDRAWAL'],
      index: true,
    },
    subjectPhone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    subjectName: {
      type: String,
      trim: true,
    },
    subjectEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    verificationCode: {
      type: String,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
    },
    completedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectionReason: {
      type: String,
    },
    details: {
      type: String,
    },
    auditTrail: [
      {
        action: { type: String, required: true },
        actor: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        notes: { type: String },
      },
    ],
  },
  {
    timestamps: true,
  }
);

DataSubjectRequestSchema.index({ tenantId: 1, requestNumber: 1 }, { unique: true });
DataSubjectRequestSchema.index({ tenantId: 1, subjectPhone: 1 });

// ---------------------------------------------------------------------------
// 2. CITIZEN CONSENT LOGGING
// ---------------------------------------------------------------------------
export type ConsentType =
  | 'BIOMETRIC_PHOTO_PROCESSING'
  | 'DOCUMENT_SCAN_ENHANCEMENT'
  | 'NID_LAMINATION_PROCESSING'
  | 'SMS_NOTIFICATIONS'
  | 'DATA_STORAGE_24HR';

export interface IConsentRecord extends Document {
  tenantId: mongoose.Types.ObjectId;
  customerPhone: string;
  customerId?: mongoose.Types.ObjectId;
  consentType: ConsentType;
  granted: boolean;
  privacyPolicyVersion: string;
  recordedBy: mongoose.Types.ObjectId;
  recordedByName: string;
  ipAddress?: string;
  userAgent?: string;
  revokedAt?: Date;
  revokedReason?: string;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ConsentRecordSchema = new Schema<IConsentRecord>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    customerPhone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      index: true,
    },
    consentType: {
      type: String,
      required: true,
      enum: [
        'BIOMETRIC_PHOTO_PROCESSING',
        'DOCUMENT_SCAN_ENHANCEMENT',
        'NID_LAMINATION_PROCESSING',
        'SMS_NOTIFICATIONS',
        'DATA_STORAGE_24HR',
      ],
      index: true,
    },
    granted: {
      type: Boolean,
      required: true,
      default: true,
    },
    privacyPolicyVersion: {
      type: String,
      required: true,
      default: 'v1.0.0-PROD',
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recordedByName: {
      type: String,
      required: true,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    revokedAt: {
      type: Date,
    },
    revokedReason: {
      type: String,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

ConsentRecordSchema.index({ tenantId: 1, customerPhone: 1, consentType: 1 });

// ---------------------------------------------------------------------------
// 3. PRIVACY NOTICE VERSION HISTORY
// ---------------------------------------------------------------------------
export interface IPrivacyNoticeVersion extends Document {
  version: string;
  effectiveDate: Date;
  summaryOfChanges: string;
  isCurrent: boolean;
  jurisdictions: string[]; // e.g. ['BD_PDPA_2026', 'EU_GDPR', 'IN_DPDP_2023']
  publishedBy: string;
  createdAt: Date;
}

const PrivacyNoticeVersionSchema = new Schema<IPrivacyNoticeVersion>(
  {
    version: {
      type: String,
      required: true,
      unique: true,
    },
    effectiveDate: {
      type: Date,
      required: true,
    },
    summaryOfChanges: {
      type: String,
      required: true,
    },
    isCurrent: {
      type: Boolean,
      default: false,
    },
    jurisdictions: {
      type: [String],
      default: ['BD_PDPA_2026'],
    },
    publishedBy: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// ---------------------------------------------------------------------------
// 4. RETENTION PURGE LOGS (AUDIT AUDITING)
// ---------------------------------------------------------------------------
export interface IPurgeJobLog extends Document {
  tenantId: mongoose.Types.ObjectId;
  executionId: string;
  purgedFilesCount: number;
  purgedBytes: number;
  affectedJobsCount: number;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  executedAt: Date;
  purgedFileKeys: string[];
  failureDetails?: string;
}

const PurgeJobLogSchema = new Schema<IPurgeJobLog>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    executionId: {
      type: String,
      required: true,
      unique: true,
    },
    purgedFilesCount: {
      type: Number,
      required: true,
      default: 0,
    },
    purgedBytes: {
      type: Number,
      required: true,
      default: 0,
    },
    affectedJobsCount: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'PARTIAL', 'FAILED'],
      default: 'SUCCESS',
    },
    executedAt: {
      type: Date,
      default: Date.now,
    },
    purgedFileKeys: {
      type: [String],
      default: [],
    },
    failureDetails: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// ---------------------------------------------------------------------------
// EXPORTS
// ---------------------------------------------------------------------------
export const DataSubjectRequest: Model<IDataSubjectRequest> = mongoose.model<IDataSubjectRequest>(
  'DataSubjectRequest',
  DataSubjectRequestSchema
);

export const ConsentRecord: Model<IConsentRecord> = mongoose.model<IConsentRecord>(
  'ConsentRecord',
  ConsentRecordSchema
);

export const PrivacyNoticeVersion: Model<IPrivacyNoticeVersion> = mongoose.model<IPrivacyNoticeVersion>(
  'PrivacyNoticeVersion',
  PrivacyNoticeVersionSchema
);

export const PurgeJobLog: Model<IPurgeJobLog> = mongoose.model<IPurgeJobLog>(
  'PurgeJobLog',
  PurgeJobLogSchema
);

