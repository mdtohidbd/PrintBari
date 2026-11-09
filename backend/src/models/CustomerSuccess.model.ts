import mongoose, { Document, Schema, Model } from 'mongoose';

// ============================================================================
// 1. CUSTOMER FEEDBACK & CSAT / NPS MODEL
// ============================================================================
export type FeedbackType = 'CSAT' | 'NPS' | 'PRODUCT_FEEDBACK';

export interface ICustomerFeedback extends Document {
  tenantId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  ticketId?: mongoose.Types.ObjectId;
  feedbackType: FeedbackType;
  rating: number; // 1-5 for CSAT, 0-10 for NPS
  category: string;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerFeedbackSchema = new Schema<ICustomerFeedback>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    ticketId: {
      type: Schema.Types.ObjectId,
      ref: 'SupportTicket',
    },
    feedbackType: {
      type: String,
      enum: ['CSAT', 'NPS', 'PRODUCT_FEEDBACK'],
      default: 'CSAT',
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 0,
      max: 10,
    },
    category: {
      type: String,
      default: 'GENERAL',
      trim: true,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

CustomerFeedbackSchema.index({ tenantId: 1, createdAt: -1 });

export const CustomerFeedback: Model<ICustomerFeedback> = mongoose.model<ICustomerFeedback>(
  'CustomerFeedback',
  CustomerFeedbackSchema
);

// ============================================================================
// 2. TENANT HEALTH SNAPSHOT (CUSTOMER SUCCESS SCORING)
// ============================================================================
export type HealthTier = 'HEALTHY' | 'NEEDS_ATTENTION' | 'AT_RISK';
export type ChurnRisk = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ITenantHealthSnapshot extends Document {
  tenantId: mongoose.Types.ObjectId;
  healthScore: number; // 0 - 100
  healthTier: HealthTier;
  churnRisk: ChurnRisk;
  breakdown: {
    onboardingScore: number; // max 25
    productUsageScore: number; // max 35
    supportHealthScore: number; // max 20
    subscriptionScore: number; // max 20
  };
  activationMilestones: {
    onboardingCompleted: boolean;
    firstStaffInvited: boolean;
    firstJobCompleted: boolean;
    firstPrintExecuted: boolean;
  };
  playbookRecommendations: string[];
  calculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TenantHealthSnapshotSchema = new Schema<ITenantHealthSnapshot>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    healthScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      index: true,
    },
    healthTier: {
      type: String,
      enum: ['HEALTHY', 'NEEDS_ATTENTION', 'AT_RISK'],
      required: true,
      index: true,
    },
    churnRisk: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH'],
      required: true,
      index: true,
    },
    breakdown: {
      onboardingScore: { type: Number, default: 0 },
      productUsageScore: { type: Number, default: 0 },
      supportHealthScore: { type: Number, default: 0 },
      subscriptionScore: { type: Number, default: 0 },
    },
    activationMilestones: {
      onboardingCompleted: { type: Boolean, default: false },
      firstStaffInvited: { type: Boolean, default: false },
      firstJobCompleted: { type: Boolean, default: false },
      firstPrintExecuted: { type: Boolean, default: false },
    },
    playbookRecommendations: [{ type: String }],
    calculatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

TenantHealthSnapshotSchema.index({ tenantId: 1, calculatedAt: -1 });

export const TenantHealthSnapshot: Model<ITenantHealthSnapshot> =
  mongoose.model<ITenantHealthSnapshot>('TenantHealthSnapshot', TenantHealthSnapshotSchema);

