import mongoose, { Document, Schema, Model } from 'mongoose';

// 1. Lead Pipeline & CRM Model
export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'DEMO_SCHEDULED'
  | 'DEMO_COMPLETED'
  | 'PROPOSAL_SENT'
  | 'WON'
  | 'LOST';

export interface IFollowUpNote {
  _id?: mongoose.Types.ObjectId;
  note: string;
  scheduledFor?: Date;
  completed: boolean;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
}

export interface ILead extends Document {
  fullName: string;
  shopName: string;
  email: string;
  phone: string;
  city: string;
  district?: string;
  shopType: 'PHOTO_STUDIO' | 'PHOTOCOPY_SHOP' | 'COMPUTER_CENTER' | 'CYBER_CAFE' | 'ENTERPRISE_PRESS' | 'OTHER';
  estimatedMonthlyJobs?: number;
  currentSoftware?: string;
  status: LeadStatus;
  lossReason?: string;
  demoScheduledAt?: Date;
  demoCompletedAt?: Date;
  demoNotes?: string;
  assignedSalesRep?: mongoose.Types.ObjectId;
  followUps: IFollowUpNote[];
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  marketingConsent: boolean;
  consentTimestamp: Date;
  ipAddress?: string;
  convertedTenantId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FollowUpNoteSchema = new Schema<IFollowUpNote>(
  {
    note: { type: String, required: true },
    scheduledFor: { type: Date },
    completed: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const LeadSchema = new Schema<ILead>(
  {
    fullName: { type: String, required: true, trim: true },
    shopName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    phone: { type: String, required: true, trim: true, index: true },
    city: { type: String, required: true, trim: true },
    district: { type: String, trim: true },
    shopType: {
      type: String,
      enum: ['PHOTO_STUDIO', 'PHOTOCOPY_SHOP', 'COMPUTER_CENTER', 'CYBER_CAFE', 'ENTERPRISE_PRESS', 'OTHER'],
      default: 'PHOTO_STUDIO',
    },
    estimatedMonthlyJobs: { type: Number, default: 300 },
    currentSoftware: { type: String, default: 'Manual / Photoshop' },
    status: {
      type: String,
      enum: ['NEW', 'CONTACTED', 'DEMO_SCHEDULED', 'DEMO_COMPLETED', 'PROPOSAL_SENT', 'WON', 'LOST'],
      default: 'NEW',
      index: true,
    },
    lossReason: { type: String },
    demoScheduledAt: { type: Date },
    demoCompletedAt: { type: Date },
    demoNotes: { type: String },
    assignedSalesRep: { type: Schema.Types.ObjectId, ref: 'User' },
    followUps: [FollowUpNoteSchema],
    utmSource: { type: String, trim: true, default: 'organic' },
    utmMedium: { type: String, trim: true, default: 'direct' },
    utmCampaign: { type: String, trim: true },
    utmContent: { type: String, trim: true },
    marketingConsent: { type: Boolean, default: true, required: true },
    consentTimestamp: { type: Date, default: Date.now },
    ipAddress: { type: String },
    convertedTenantId: { type: Schema.Types.ObjectId, ref: 'Tenant' },
  },
  { timestamps: true }
);

LeadSchema.index({ status: 1, createdAt: -1 });
LeadSchema.index({ utmSource: 1, utmCampaign: 1 });

// 2. Referral & Affiliate Tracking
export interface IReferralProgram extends Document {
  tenantId: mongoose.Types.ObjectId;
  referralCode: string;
  totalReferrals: number;
  successfulConversions: number;
  rewardMonthsEarned: number;
  rewardMonthsRedeemed: number;
  isAffiliate: boolean;
  affiliateCommissionPercent: number; // e.g. 15%
  affiliateEarningsBDT: number;
  affiliatePayoutBalanceBDT: number;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralProgramSchema = new Schema<IReferralProgram>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true, index: true },
    referralCode: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    totalReferrals: { type: Number, default: 0 },
    successfulConversions: { type: Number, default: 0 },
    rewardMonthsEarned: { type: Number, default: 0 },
    rewardMonthsRedeemed: { type: Number, default: 0 },
    isAffiliate: { type: Boolean, default: false },
    affiliateCommissionPercent: { type: Number, default: 15 },
    affiliateEarningsBDT: { type: Number, default: 0 },
    affiliatePayoutBalanceBDT: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// 3. Marketing Analytics & Funnel Event Log
export type FunnelEventType =
  | 'PAGE_VIEW'
  | 'LEAD_CAPTURED'
  | 'DEMO_REQUESTED'
  | 'REGISTERED'
  | 'TRIAL_ACTIVATED'
  | 'PAID_CONVERTED';

export interface IFunnelEvent extends Document {
  visitorId: string;
  sessionId?: string;
  tenantId?: mongoose.Types.ObjectId;
  eventType: FunnelEventType;
  pagePath: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const FunnelEventSchema = new Schema<IFunnelEvent>(
  {
    visitorId: { type: String, required: true, index: true },
    sessionId: { type: String },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant' },
    eventType: {
      type: String,
      enum: ['PAGE_VIEW', 'LEAD_CAPTURED', 'DEMO_REQUESTED', 'REGISTERED', 'TRIAL_ACTIVATED', 'PAID_CONVERTED'],
      required: true,
      index: true,
    },
    pagePath: { type: String, required: true },
    utmSource: { type: String, default: 'organic' },
    utmMedium: { type: String, default: 'direct' },
    utmCampaign: { type: String },
    utmContent: { type: String },
    metadata: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

FunnelEventSchema.index({ eventType: 1, createdAt: -1 });
FunnelEventSchema.index({ utmSource: 1, eventType: 1 });

export const Lead: Model<ILead> = mongoose.model<ILead>('Lead', LeadSchema);
export const ReferralProgram: Model<IReferralProgram> = mongoose.model<IReferralProgram>(
  'ReferralProgram',
  ReferralProgramSchema
);
export const FunnelEvent: Model<IFunnelEvent> = mongoose.model<IFunnelEvent>('FunnelEvent', FunnelEventSchema);

