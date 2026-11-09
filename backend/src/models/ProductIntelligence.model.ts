import mongoose, { Document, Schema, Types } from 'mongoose';

export type ProductEventType =
  | 'WORKFLOW_STARTED'
  | 'WORKFLOW_STEP_COMPLETED'
  | 'WORKFLOW_ABANDONED'
  | 'FEATURE_USED'
  | 'JOB_CREATED'
  | 'JOB_COMPLETED'
  | 'EXPORT_SUCCESS'
  | 'PROCESSING_FAILED'
  | 'LATENCY_MEASURED'
  | 'SCREEN_VIEWED';

export type ProductModule =
  | 'PASSPORT'
  | 'DOCUMENT'
  | 'IDCARD'
  | 'CV'
  | 'OCR'
  | 'POS'
  | 'PRINTER'
  | 'BILLING'
  | 'SETTINGS'
  | 'ONBOARDING'
  | 'SUPPORT';

export interface IProductEvent extends Document {
  tenantId?: Types.ObjectId;
  userId?: Types.ObjectId;
  role?: string;
  planTier?: string;
  eventType: ProductEventType;
  module: ProductModule;
  screen: string;
  workflowId?: string;
  stepName?: string;
  durationMs?: number;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

const ProductEventSchema = new Schema<IProductEvent>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    role: { type: String, default: 'STAFF' },
    planTier: { type: String, default: 'STARTER' },
    eventType: {
      type: String,
      required: true,
      index: true,
      enum: [
        'WORKFLOW_STARTED',
        'WORKFLOW_STEP_COMPLETED',
        'WORKFLOW_ABANDONED',
        'FEATURE_USED',
        'JOB_CREATED',
        'JOB_COMPLETED',
        'EXPORT_SUCCESS',
        'PROCESSING_FAILED',
        'LATENCY_MEASURED',
        'SCREEN_VIEWED',
      ],
    },
    module: {
      type: String,
      required: true,
      index: true,
      enum: [
        'PASSPORT',
        'DOCUMENT',
        'IDCARD',
        'CV',
        'OCR',
        'POS',
        'PRINTER',
        'BILLING',
        'SETTINGS',
        'ONBOARDING',
        'SUPPORT',
      ],
    },
    screen: { type: String, required: true, index: true },
    workflowId: { type: String, index: true },
    stepName: { type: String },
    durationMs: { type: Number, default: 0 },
    errorCode: { type: String, index: true },
    errorMessage: { type: String },
    metadata: { type: Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// TTL Index for events: Retain telemetry for 90 days to comply with data minimization
ProductEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 86400 });
ProductEventSchema.index({ tenantId: 1, eventType: 1, timestamp: -1 });
ProductEventSchema.index({ module: 1, eventType: 1 });

export type FeedbackType = 'FEEDBACK' | 'BUG_REPORT' | 'FEATURE_REQUEST' | 'SURVEY';
export type SurveyType = 'CSAT' | 'NPS' | 'CES' | 'NONE';
export type FeedbackSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RoadmapStatus =
  | 'NEW'
  | 'UNDER_REVIEW'
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'SHIPPED'
  | 'DECLINED';

export interface IProductFeedback extends Document {
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  userName?: string;
  type: FeedbackType;
  category: string;
  title: string;
  description: string;
  rating?: number; // 1-5 for CSAT, 0-10 for NPS, 1-7 for CES
  surveyType: SurveyType;
  screenContext?: string;
  severity: FeedbackSeverity;
  upvotes: number;
  voters: Types.ObjectId[];
  status: RoadmapStatus;
  adminResponse?: string;
  prioritization: {
    reach: number;        // Estimated tenants impacted (1-100)
    impact: number;       // 0.25 (minimal), 0.5 (low), 1 (medium), 2 (high), 3 (massive)
    confidence: number;   // 0 - 100%
    effort: number;       // Person-weeks (1-10)
    strategicScore: number; // 1 - 5 alignment with core vision
    securityRiskScore: number; // 1 - 5 risk level
    riceScore: number;    // (Reach * Impact * Confidence) / Effort
  };
  createdAt: Date;
  updatedAt: Date;
}

const ProductFeedbackSchema = new Schema<IProductFeedback>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userName: { type: String },
    type: {
      type: String,
      required: true,
      enum: ['FEEDBACK', 'BUG_REPORT', 'FEATURE_REQUEST', 'SURVEY'],
      index: true,
    },
    category: {
      type: String,
      required: true,
      index: true,
      default: 'USABILITY',
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    rating: { type: Number, min: 0, max: 10 },
    surveyType: {
      type: String,
      enum: ['CSAT', 'NPS', 'CES', 'NONE'],
      default: 'NONE',
    },
    screenContext: { type: String },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
    },
    upvotes: { type: Number, default: 1, index: true },
    voters: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    status: {
      type: String,
      enum: ['NEW', 'UNDER_REVIEW', 'PLANNED', 'IN_PROGRESS', 'SHIPPED', 'DECLINED'],
      default: 'NEW',
      index: true,
    },
    adminResponse: { type: String },
    prioritization: {
      reach: { type: Number, default: 10 },
      impact: { type: Number, default: 1.0 },
      confidence: { type: Number, default: 80 },
      effort: { type: Number, default: 2.0 },
      strategicScore: { type: Number, default: 3 },
      securityRiskScore: { type: Number, default: 1 },
      riceScore: { type: Number, default: 400, index: true },
    },
  },
  {
    timestamps: true,
  }
);

ProductFeedbackSchema.index({ type: 1, status: 1 });
ProductFeedbackSchema.index({ 'prioritization.riceScore': -1 });

export const ProductEvent = mongoose.model<IProductEvent>('ProductEvent', ProductEventSchema);
export const ProductFeedback = mongoose.model<IProductFeedback>(
  'ProductFeedback',
  ProductFeedbackSchema
);
