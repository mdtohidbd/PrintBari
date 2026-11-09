import mongoose, { Document, Schema, Model } from 'mongoose';

// 1. Cost Structure Configuration (SaaS Infrastructure & Variable Cost Drivers)
export interface ICostStructureConfig extends Document {
  key: string; // usually 'DEFAULT'
  hostingCostBaseMonthly: number; // Base node/cluster infra in BDT (e.g. 5000)
  storageCostPerGbMonthly: number; // BDT per GB/month (e.g. 2.50)
  imageProcessingCostPerJob: number; // BDT per AI photo background / layout render (e.g. 0.15)
  ocrCostPerPage: number; // BDT per OCR page processed (e.g. 0.40)
  smsUnitCost: number; // BDT per SMS sent (e.g. 0.35)
  emailUnitCost: number; // BDT per transactional email (e.g. 0.05)
  paymentGatewayFeePercent: {
    BKASH: number; // 1.5%
    NAGAD: number; // 1.5%
    SSLCOMMERZ: number; // 2.5%
    MANUAL: number; // 0%
  };
  supportCostPerTicket: number; // Allocated customer support cost per handled ticket (e.g. 45.0)
  monthlyOverheadBuffer: number; // Third party observability, domain, SSL (e.g. 1000)
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CostStructureConfigSchema = new Schema<ICostStructureConfig>(
  {
    key: { type: String, required: true, unique: true, default: 'DEFAULT' },
    hostingCostBaseMonthly: { type: Number, default: 5000 },
    storageCostPerGbMonthly: { type: Number, default: 2.5 },
    imageProcessingCostPerJob: { type: Number, default: 0.15 },
    ocrCostPerPage: { type: Number, default: 0.4 },
    smsUnitCost: { type: Number, default: 0.35 },
    emailUnitCost: { type: Number, default: 0.05 },
    paymentGatewayFeePercent: {
      BKASH: { type: Number, default: 1.5 },
      NAGAD: { type: Number, default: 1.5 },
      SSLCOMMERZ: { type: Number, default: 2.5 },
      MANUAL: { type: Number, default: 0 },
    },
    supportCostPerTicket: { type: Number, default: 45.0 },
    monthlyOverheadBuffer: { type: Number, default: 1000 },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// 2. Sales & Marketing Spend for CAC (Customer Acquisition Cost) Tracking
export interface IMarketingSalesExpense extends Document {
  period: string; // 'YYYY-MM'
  adSpend: number; // Facebook/Google Ads spend in BDT
  salesCommissions: number;
  marketingPersonnel: number;
  toolsAndSoftware: number;
  totalMarketingSpend: number;
  newPayingCustomersAcquired: number;
  cac: number; // totalMarketingSpend / newPayingCustomersAcquired
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MarketingSalesExpenseSchema = new Schema<IMarketingSalesExpense>(
  {
    period: { type: String, required: true, unique: true, index: true },
    adSpend: { type: Number, default: 0, min: 0 },
    salesCommissions: { type: Number, default: 0, min: 0 },
    marketingPersonnel: { type: Number, default: 0, min: 0 },
    toolsAndSoftware: { type: Number, default: 0, min: 0 },
    totalMarketingSpend: { type: Number, default: 0, min: 0 },
    newPayingCustomersAcquired: { type: Number, default: 0, min: 0 },
    cac: { type: Number, default: 0, min: 0 },
    notes: { type: String },
  },
  { timestamps: true }
);

// 3. Tenant Granular Cost Allocation & Unit Economics
export interface ITenantCostAllocation extends Document {
  tenantId: mongoose.Types.ObjectId;
  period: string; // 'YYYY-MM'
  usageMetrics: {
    storageBytesUsed: number;
    passportLayoutsGenerated: number;
    ocrPagesProcessed: number;
    printJobsExecuted: number;
    smsSent: number;
    emailsSent: number;
    ticketsCount: number;
  };
  costBreakdown: {
    storageCost: number;
    computeCost: number;
    ocrCost: number;
    imageProcCost: number;
    messagingCost: number;
    paymentGatewayFees: number;
    supportCost: number;
    totalCogs: number;
  };
  revenueRecognized: number; // Recognized subscription revenue for the month
  grossProfit: number; // revenueRecognized - totalCogs
  grossMarginPercent: number; // (grossProfit / revenueRecognized) * 100
  calculatedAt: Date;
}

const TenantCostAllocationSchema = new Schema<ITenantCostAllocation>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    period: { type: String, required: true, index: true },
    usageMetrics: {
      storageBytesUsed: { type: Number, default: 0 },
      passportLayoutsGenerated: { type: Number, default: 0 },
      ocrPagesProcessed: { type: Number, default: 0 },
      printJobsExecuted: { type: Number, default: 0 },
      smsSent: { type: Number, default: 0 },
      emailsSent: { type: Number, default: 0 },
      ticketsCount: { type: Number, default: 0 },
    },
    costBreakdown: {
      storageCost: { type: Number, default: 0 },
      computeCost: { type: Number, default: 0 },
      ocrCost: { type: Number, default: 0 },
      imageProcCost: { type: Number, default: 0 },
      messagingCost: { type: Number, default: 0 },
      paymentGatewayFees: { type: Number, default: 0 },
      supportCost: { type: Number, default: 0 },
      totalCogs: { type: Number, default: 0 },
    },
    revenueRecognized: { type: Number, default: 0 },
    grossProfit: { type: Number, default: 0 },
    grossMarginPercent: { type: Number, default: 0 },
    calculatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

TenantCostAllocationSchema.index({ tenantId: 1, period: 1 }, { unique: true });

// 4. Monthly SaaS Revenue Period Snapshot
export interface IRevenuePeriodSnapshot extends Document {
  period: string; // 'YYYY-MM'
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue (mrr * 12)
  newMrr: number; // From brand-new paying subscriptions
  expansionMrr: number; // From upgrades
  churnedMrr: number; // From cancellations / downgrades
  netNewMrr: number; // newMrr + expansionMrr - churnedMrr
  activeTenantsCount: number;
  payingTenantsCount: number;
  newPayingTenantsCount: number;
  churnedTenantsCount: number;
  logoChurnRate: number; // %
  revenueChurnRate: number; // %
  trialToPaidConversionRate: number; // %
  cac: number; // Customer Acquisition Cost in BDT
  arpu: number; // Average Revenue Per User/Tenant
  ltv: number; // Customer Lifetime Value in BDT
  cashReceived: number; // Total Cash collected / Billings in period
  recognizedRevenue: number; // GAAP/IFRS-15 recognized revenue
  deferredRevenue: number; // Unearned subscription liability balance
  refundsTotal: number;
  refundRate: number; // % of cash received
  paymentFailureRate: number; // % of transaction attempts
  totalCogs: number; // Cost of Goods Sold (infra, support, third-party)
  grossProfit: number;
  grossMarginPercent: number; // %
  calculatedAt: Date;
}

const RevenuePeriodSnapshotSchema = new Schema<IRevenuePeriodSnapshot>(
  {
    period: { type: String, required: true, unique: true, index: true },
    mrr: { type: Number, default: 0 },
    arr: { type: Number, default: 0 },
    newMrr: { type: Number, default: 0 },
    expansionMrr: { type: Number, default: 0 },
    churnedMrr: { type: Number, default: 0 },
    netNewMrr: { type: Number, default: 0 },
    activeTenantsCount: { type: Number, default: 0 },
    payingTenantsCount: { type: Number, default: 0 },
    newPayingTenantsCount: { type: Number, default: 0 },
    churnedTenantsCount: { type: Number, default: 0 },
    logoChurnRate: { type: Number, default: 0 },
    revenueChurnRate: { type: Number, default: 0 },
    trialToPaidConversionRate: { type: Number, default: 0 },
    cac: { type: Number, default: 0 },
    arpu: { type: Number, default: 0 },
    ltv: { type: Number, default: 0 },
    cashReceived: { type: Number, default: 0 },
    recognizedRevenue: { type: Number, default: 0 },
    deferredRevenue: { type: Number, default: 0 },
    refundsTotal: { type: Number, default: 0 },
    refundRate: { type: Number, default: 0 },
    paymentFailureRate: { type: Number, default: 0 },
    totalCogs: { type: Number, default: 0 },
    grossProfit: { type: Number, default: 0 },
    grossMarginPercent: { type: Number, default: 0 },
    calculatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const CostStructureConfig: Model<ICostStructureConfig> = mongoose.model<ICostStructureConfig>(
  'CostStructureConfig',
  CostStructureConfigSchema
);

export const MarketingSalesExpense: Model<IMarketingSalesExpense> = mongoose.model<IMarketingSalesExpense>(
  'MarketingSalesExpense',
  MarketingSalesExpenseSchema
);

export const TenantCostAllocation: Model<ITenantCostAllocation> = mongoose.model<ITenantCostAllocation>(
  'TenantCostAllocation',
  TenantCostAllocationSchema
);

export const RevenuePeriodSnapshot: Model<IRevenuePeriodSnapshot> = mongoose.model<IRevenuePeriodSnapshot>(
  'RevenuePeriodSnapshot',
  RevenuePeriodSnapshotSchema
);

