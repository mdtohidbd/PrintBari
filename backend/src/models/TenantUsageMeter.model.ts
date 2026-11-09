import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ITenantUsageMetrics {
  apiRequestsTotal: number;
  storageBytesUsed: number;
  passportLayoutsGenerated: number;
  ocrPagesProcessed: number;
  printJobsExecuted: number;
  bandwidthBytesOut: number;
}

export interface ITenantUsageMeter extends Document {
  tenantId: mongoose.Types.ObjectId;
  period: string; // 'YYYY-MM' or 'YYYY-MM-DD'
  metrics: ITenantUsageMetrics;
  lastCalculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TenantUsageMeterSchema = new Schema<ITenantUsageMeter>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    period: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    metrics: {
      apiRequestsTotal: { type: Number, default: 0 },
      storageBytesUsed: { type: Number, default: 0 },
      passportLayoutsGenerated: { type: Number, default: 0 },
      ocrPagesProcessed: { type: Number, default: 0 },
      printJobsExecuted: { type: Number, default: 0 },
      bandwidthBytesOut: { type: Number, default: 0 },
    },
    lastCalculatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

TenantUsageMeterSchema.index({ tenantId: 1, period: 1 }, { unique: true });

export const TenantUsageMeter: Model<ITenantUsageMeter> = mongoose.model<ITenantUsageMeter>(
  'TenantUsageMeter',
  TenantUsageMeterSchema
);

