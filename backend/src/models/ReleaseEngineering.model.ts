import mongoose, { Document, Schema, Model } from 'mongoose';

// 1. Schema Migration History & Rollback Journal
export interface IMigrationRecord extends Document {
  version: string; // e.g. '20261109-001-job-retry-index'
  name: string;
  checksum: string;
  appliedAt: Date;
  durationMs: number;
  backupSnapshotId?: string; // Pre-migration safety backup
  rollbackStatus: 'NONE' | 'ROLLED_BACK' | 'FAILED';
  rolledBackAt?: Date;
  rollbackReason?: string;
  createdAt: Date;
}

const MigrationRecordSchema = new Schema<IMigrationRecord>(
  {
    version: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    checksum: { type: String, required: true },
    appliedAt: { type: Date, default: Date.now },
    durationMs: { type: Number, default: 0 },
    backupSnapshotId: { type: String },
    rollbackStatus: {
      type: String,
      enum: ['NONE', 'ROLLED_BACK', 'FAILED'],
      default: 'NONE',
    },
    rolledBackAt: { type: Date },
    rollbackReason: { type: String },
  },
  { timestamps: true }
);

// 2. Dynamic Runtime Feature Flags & Canary Toggles
export interface IFeatureFlag extends Document {
  key: string; // e.g. 'EXPERIMENTAL_BENGALI_OCR', 'CANARY_DIRECT_SPOOL'
  description: string;
  enabled: boolean;
  percentageRollout: number; // 0 to 100
  allowedTenants: string[]; // Whitelist by tenantId or subdomain
  targetTiers: string[]; // ['PRO', 'BUSINESS', 'ENTERPRISE']
  killSwitchTriggered: boolean;
  lastModifiedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FeatureFlagSchema = new Schema<IFeatureFlag>(
  {
    key: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    description: { type: String, required: true },
    enabled: { type: Boolean, default: false },
    percentageRollout: { type: Number, default: 0, min: 0, max: 100 },
    allowedTenants: [{ type: String }],
    targetTiers: [{ type: String, uppercase: true }],
    killSwitchTriggered: { type: Boolean, default: false },
    lastModifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// 3. Versioned Release Deployment Audit
export interface IReleaseDeployment extends Document {
  releaseVersion: string; // SemVer e.g. '1.4.0'
  commitSha: string;
  environment: 'STAGING' | 'PRODUCTION';
  status: 'PENDING_APPROVAL' | 'DEPLOYING' | 'ACTIVE' | 'ROLLED_BACK' | 'FAILED';
  releaseNotes: string;
  preDeployBackupId?: string;
  canaryHealthStatus: 'HEALTHY' | 'DEGRADED' | 'FAILED';
  deployedAt: Date;
  deployedBy?: mongoose.Types.ObjectId;
  rollbackNotes?: string;
}

const ReleaseDeploymentSchema = new Schema<IReleaseDeployment>(
  {
    releaseVersion: { type: String, required: true, index: true },
    commitSha: { type: String, required: true },
    environment: { type: String, enum: ['STAGING', 'PRODUCTION'], required: true },
    status: {
      type: String,
      enum: ['PENDING_APPROVAL', 'DEPLOYING', 'ACTIVE', 'ROLLED_BACK', 'FAILED'],
      default: 'PENDING_APPROVAL',
      index: true,
    },
    releaseNotes: { type: String, required: true },
    preDeployBackupId: { type: String },
    canaryHealthStatus: {
      type: String,
      enum: ['HEALTHY', 'DEGRADED', 'FAILED'],
      default: 'HEALTHY',
    },
    deployedAt: { type: Date, default: Date.now },
    deployedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rollbackNotes: { type: String },
  },
  { timestamps: true }
);

export const MigrationRecord: Model<IMigrationRecord> = mongoose.model<IMigrationRecord>(
  'MigrationRecord',
  MigrationRecordSchema
);

export const FeatureFlag: Model<IFeatureFlag> = mongoose.model<IFeatureFlag>(
  'FeatureFlag',
  FeatureFlagSchema
);

export const ReleaseDeployment: Model<IReleaseDeployment> = mongoose.model<IReleaseDeployment>(
  'ReleaseDeployment',
  ReleaseDeploymentSchema
);

