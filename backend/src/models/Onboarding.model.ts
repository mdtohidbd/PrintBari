import mongoose, { Document, Schema, Model } from 'mongoose';

export type OnboardingStepName =
  | 'WELCOME'
  | 'BUSINESS_PROFILE'
  | 'SHOP_LOGO'
  | 'CONFIGURE_SERVICES'
  | 'SERVICE_PRICING'
  | 'INVITE_STAFF'
  | 'PRINT_SETTINGS'
  | 'FIRST_CUSTOMER'
  | 'FIRST_JOB'
  | 'COMPLETE_FIRST_JOB';

export const ONBOARDING_STEPS_ORDER: OnboardingStepName[] = [
  'WELCOME',
  'BUSINESS_PROFILE',
  'SHOP_LOGO',
  'CONFIGURE_SERVICES',
  'SERVICE_PRICING',
  'INVITE_STAFF',
  'PRINT_SETTINGS',
  'FIRST_CUSTOMER',
  'FIRST_JOB',
  'COMPLETE_FIRST_JOB',
];

export interface IActivationEvent {
  event: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface IOnboardingState extends Document {
  tenantId: mongoose.Types.ObjectId;
  currentStep: number; // 1 to 10
  currentStepName: OnboardingStepName;
  completedSteps: number[];
  skippedSteps: number[];
  isCompleted: boolean;
  completedAt?: Date;
  tourCompleted: boolean;
  tourCompletedAt?: Date;
  stepData: {
    businessProfile?: {
      shopName: string;
      phone: string;
      address?: string;
      currency?: string;
      timezone?: string;
      taxId?: string;
    };
    logoUrl?: string;
    servicesConfigured?: string[];
    servicePricing?: Array<{
      serviceType: string;
      price: number;
      paperType?: string;
    }>;
    staffInvited?: Array<{
      email: string;
      fullName: string;
      role: string;
      invitedAt: Date;
    }>;
    printSettings?: {
      defaultPaperSize: string;
      defaultDpi: number;
      printerModel?: string;
      marginOffsetXmm: number;
      marginOffsetYmm: number;
    };
    firstCustomerId?: mongoose.Types.ObjectId;
    firstJobId?: mongoose.Types.ObjectId;
  };
  checklist: {
    shopProfileCompleted: boolean;
    pricingConfigured: boolean;
    firstStaffInvited: boolean;
    firstCustomerCreated: boolean;
    firstJobCreated: boolean;
    firstJobCompleted: boolean;
    firstPrintExported: boolean;
  };
  hasSampleData: boolean;
  sampleCustomerIds: mongoose.Types.ObjectId[];
  sampleJobIds: mongoose.Types.ObjectId[];
  activationEvents: IActivationEvent[];
  createdAt: Date;
  updatedAt: Date;
}

const ActivationEventSchema = new Schema<IActivationEvent>(
  {
    event: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const OnboardingStateSchema = new Schema<IOnboardingState>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      unique: true,
      index: true,
    },
    currentStep: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
      max: 10,
    },
    currentStepName: {
      type: String,
      required: true,
      default: 'WELCOME',
      enum: ONBOARDING_STEPS_ORDER,
    },
    completedSteps: {
      type: [Number],
      default: [],
    },
    skippedSteps: {
      type: [Number],
      default: [],
    },
    isCompleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    completedAt: {
      type: Date,
    },
    tourCompleted: {
      type: Boolean,
      default: false,
    },
    tourCompletedAt: {
      type: Date,
    },
    stepData: {
      businessProfile: {
        shopName: { type: String },
        phone: { type: String },
        address: { type: String },
        currency: { type: String, default: 'BDT' },
        timezone: { type: String, default: 'Asia/Dhaka' },
        taxId: { type: String },
      },
      logoUrl: { type: String },
      servicesConfigured: { type: [String], default: [] },
      servicePricing: [
        {
          serviceType: { type: String, required: true },
          price: { type: Number, required: true },
          paperType: { type: String },
        },
      ],
      staffInvited: [
        {
          email: { type: String, required: true },
          fullName: { type: String, required: true },
          role: { type: String, default: 'STAFF' },
          invitedAt: { type: Date, default: Date.now },
        },
      ],
      printSettings: {
        defaultPaperSize: { type: String, default: 'A4' },
        defaultDpi: { type: Number, default: 300 },
        printerModel: { type: String, default: 'Epson L805' },
        marginOffsetXmm: { type: Number, default: 0 },
        marginOffsetYmm: { type: Number, default: 0 },
      },
      firstCustomerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
      firstJobId: { type: Schema.Types.ObjectId, ref: 'Job' },
    },
    checklist: {
      shopProfileCompleted: { type: Boolean, default: false },
      pricingConfigured: { type: Boolean, default: false },
      firstStaffInvited: { type: Boolean, default: false },
      firstCustomerCreated: { type: Boolean, default: false },
      firstJobCreated: { type: Boolean, default: false },
      firstJobCompleted: { type: Boolean, default: false },
      firstPrintExported: { type: Boolean, default: false },
    },
    hasSampleData: {
      type: Boolean,
      default: false,
    },
    sampleCustomerIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Customer',
      },
    ],
    sampleJobIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Job',
      },
    ],
    activationEvents: [ActivationEventSchema],
  },
  {
    timestamps: true,
  }
);

export const OnboardingState: Model<IOnboardingState> = mongoose.model<IOnboardingState>(
  'OnboardingState',
  OnboardingStateSchema
);

