import mongoose, { Document, Schema, Model } from 'mongoose';

// 1. Backup Snapshot Model
export type BackupType = 'DATABASE' | 'STORAGE' | 'FULL';
export type BackupScope = 'PLATFORM' | 'TENANT';
export type BackupStatus = 'COMPLETED' | 'VERIFIED' | 'CORRUPTED' | 'FAILED';

export interface IBackupSnapshot extends Document {
  snapshotId: string;
  type: BackupType;
  scope: BackupScope;
  tenantId?: mongoose.Types.ObjectId;
  filePath: string;
  sizeBytes: number;
  sha256Checksum: string;
  recordCount: number;
  status: BackupStatus;
  verificationDetails?: {
    isChecksumValid: boolean;
    verifiedAt: Date;
    inspectedCollections: string[];
    errorDetails?: string;
  };
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BackupSnapshotSchema = new Schema<IBackupSnapshot>(
  {
    snapshotId: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ['DATABASE', 'STORAGE', 'FULL'], required: true },
    scope: { type: String, enum: ['PLATFORM', 'TENANT'], default: 'PLATFORM' },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant' },
    filePath: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    sha256Checksum: { type: String, required: true },
    recordCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['COMPLETED', 'VERIFIED', 'CORRUPTED', 'FAILED'],
      default: 'COMPLETED',
      index: true,
    },
    verificationDetails: {
      isChecksumValid: { type: Boolean },
      verifiedAt: { type: Date },
      inspectedCollections: [{ type: String }],
      errorDetails: { type: String },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// 2. Restore Drill Log
export interface IRestoreDrill extends Document {
  drillId: string;
  snapshotId: string;
  targetEnvironment: 'STAGING' | 'SANDBOX' | 'ISOLATED_TEST';
  startedAt: Date;
  completedAt: Date;
  durationSeconds: number;
  rtoTargetSeconds: number; // Recovery Time Objective target
  rtoAchievedSeconds: number;
  rpoTargetHours: number; // Recovery Point Objective target
  rpoAchievedHours: number;
  recordsRestored: number;
  integrityPassed: boolean;
  failureLogs: string[];
  drilledBy?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const RestoreDrillSchema = new Schema<IRestoreDrill>(
  {
    drillId: { type: String, required: true, unique: true, index: true },
    snapshotId: { type: String, required: true, index: true },
    targetEnvironment: {
      type: String,
      enum: ['STAGING', 'SANDBOX', 'ISOLATED_TEST'],
      default: 'STAGING',
    },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date, required: true },
    durationSeconds: { type: Number, required: true },
    rtoTargetSeconds: { type: Number, default: 1800 }, // 30 mins
    rtoAchievedSeconds: { type: Number, required: true },
    rpoTargetHours: { type: Number, default: 1 }, // 1 hour
    rpoAchievedHours: { type: Number, required: true },
    recordsRestored: { type: Number, required: true },
    integrityPassed: { type: Boolean, required: true },
    failureLogs: [{ type: String }],
    drilledBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// 3. Database & Storage Integrity Audit Log
export interface IIntegrityAudit extends Document {
  auditId: string;
  auditType: 'DATABASE_CONSISTENCY' | 'STORAGE_FILESYSTEM' | 'JOB_QUEUE_REAP';
  checkedCount: number;
  defectCount: number;
  repairedCount: number;
  details: Record<string, any>;
  durationMs: number;
  createdAt: Date;
}

const IntegrityAuditSchema = new Schema<IIntegrityAudit>(
  {
    auditId: { type: String, required: true, unique: true, index: true },
    auditType: {
      type: String,
      enum: ['DATABASE_CONSISTENCY', 'STORAGE_FILESYSTEM', 'JOB_QUEUE_REAP'],
      required: true,
    },
    checkedCount: { type: Number, default: 0 },
    defectCount: { type: Number, default: 0 },
    repairedCount: { type: Number, default: 0 },
    details: { type: Schema.Types.Mixed },
    durationMs: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const BackupSnapshot: Model<IBackupSnapshot> = mongoose.model<IBackupSnapshot>(
  'BackupSnapshot',
  BackupSnapshotSchema
);
export const RestoreDrill: Model<IRestoreDrill> = mongoose.model<IRestoreDrill>(
  'RestoreDrill',
  RestoreDrillSchema
);
export const IntegrityAudit: Model<IIntegrityAudit> = mongoose.model<IIntegrityAudit>(
  'IntegrityAudit',
  IntegrityAuditSchema
);

