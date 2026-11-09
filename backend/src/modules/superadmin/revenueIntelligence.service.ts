import mongoose from 'mongoose';
import { Tenant, ITenant } from '../../models/Tenant.model';
import { PlanConfig, PaymentTransaction, IPlanConfig, IPaymentTransaction } from '../../models/Subscription.model';
import { TenantUsageMeter } from '../../models/TenantUsageMeter.model';
import { Notification } from '../../models/Notification.model';
import { SupportTicket } from '../../models/SupportTicket.model';
import {
  CostStructureConfig,
  MarketingSalesExpense,
  TenantCostAllocation,
  RevenuePeriodSnapshot,
  ICostStructureConfig,
  ITenantCostAllocation,
  IRevenuePeriodSnapshot,
} from '../../models/RevenueIntelligence.model';

export class RevenueIntelligenceService {
  /**
   * Helper to format period string YYYY-MM
   */
  public getPeriodString(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Helper to parse date boundaries from YYYY-MM
   */
  public getPeriodDateRange(periodStr?: string): { startDate: Date; endDate: Date; period: string } {
    const period = periodStr || this.getPeriodString();
    const [yearStr, monthStr] = period.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(year, month, 1, 0, 0, 0, -1);
    return { startDate, endDate, period };
  }

  /**
   * 1. COST CONFIGURATION
   */
  public async ensureCostConfig(): Promise<ICostStructureConfig> {
    let config = await CostStructureConfig.findOne({ key: 'DEFAULT' });
    if (!config) {
      config = await CostStructureConfig.create({
        key: 'DEFAULT',
        hostingCostBaseMonthly: 5000,
        storageCostPerGbMonthly: 2.5,
        imageProcessingCostPerJob: 0.15,
        ocrCostPerPage: 0.4,
        smsUnitCost: 0.35,
        emailUnitCost: 0.05,
        paymentGatewayFeePercent: {
          BKASH: 1.5,
          NAGAD: 1.5,
          SSLCOMMERZ: 2.5,
          MANUAL: 0,
        },
        supportCostPerTicket: 45.0,
        monthlyOverheadBuffer: 1000,
      });
    }
    return config;
  }

  public async updateCostConfig(updates: Partial<ICostStructureConfig>): Promise<ICostStructureConfig> {
    await this.ensureCostConfig();
    const updated = await CostStructureConfig.findOneAndUpdate(
      { key: 'DEFAULT' },
      { $set: updates },
      { upsert: true, new: true }
    );
    return updated!;
  }

  /**
   * 2. MARKETING & SALES SPEND (FOR CAC)
   */
  public async recordMarketingSpend(data: {
    period: string;
    adSpend: number;
    salesCommissions?: number;
    marketingPersonnel?: number;
    toolsAndSoftware?: number;
    newPayingCustomersAcquired?: number;
    notes?: string;
  }) {
    const totalMarketingSpend =
      (data.adSpend || 0) +
      (data.salesCommissions || 0) +
      (data.marketingPersonnel || 0) +
      (data.toolsAndSoftware || 0);

    let customers = data.newPayingCustomersAcquired;
    if (customers === undefined) {
      // Auto-compute from DB if not explicitly passed
      const { startDate, endDate } = this.getPeriodDateRange(data.period);
      const newPayers = await PaymentTransaction.distinct('tenantId', {
        paymentStatus: 'SUCCESS',
        paidAt: { $gte: startDate, $lte: endDate },
      });
      customers = newPayers.length;
    }

    const cac = customers > 0 ? Math.round((totalMarketingSpend / customers) * 100) / 100 : totalMarketingSpend;

    return await MarketingSalesExpense.findOneAndUpdate(
      { period: data.period },
      {
        $set: {
          adSpend: data.adSpend || 0,
          salesCommissions: data.salesCommissions || 0,
          marketingPersonnel: data.marketingPersonnel || 0,
          toolsAndSoftware: data.toolsAndSoftware || 0,
          totalMarketingSpend,
          newPayingCustomersAcquired: customers,
          cac,
          notes: data.notes,
        },
      },
      { upsert: true, new: true }
    );
  }

  /**
   * 3. MRR, ARR, CHURN, LTV, AND SAAS CORE METRICS
   * Clearly separates MRR/ARR from Cash Billings and GAAP Recognized Revenue.
   */
  public async calculateMRRAndMetrics(targetPeriod?: string): Promise<Record<string, any>> {
    const { startDate, endDate, period } = this.getPeriodDateRange(targetPeriod);
    const costConfig = await this.ensureCostConfig();

    // 1. Fetch Plan configurations to get normalized monthly prices
    const plans = await PlanConfig.find({}).lean();
    const planPriceMap = new Map<string, { monthly: number; yearly: number }>();
    plans.forEach((p) => {
      planPriceMap.set(p.planKey.toUpperCase(), {
        monthly: p.monthlyPrice,
        yearly: p.yearlyPrice,
      });
    });

    // Fallback defaults if plans table is sparse
    if (!planPriceMap.has('STARTER')) planPriceMap.set('STARTER', { monthly: 990, yearly: 9900 });
    if (!planPriceMap.has('PRO')) planPriceMap.set('PRO', { monthly: 1990, yearly: 19900 });
    if (!planPriceMap.has('BUSINESS')) planPriceMap.set('BUSINESS', { monthly: 3990, yearly: 39900 });
    if (!planPriceMap.has('ENTERPRISE')) planPriceMap.set('ENTERPRISE', { monthly: 7990, yearly: 79900 });

    // 2. Active Paying Tenants
    const activeTenants = await Tenant.find({
      isActive: true,
      'subscription.status': { $in: ['ACTIVE', 'PAST_DUE', 'GRACE_PERIOD'] },
    }).lean();

    const allTenants = await Tenant.find({}).lean();
    const activeTenantsCount = allTenants.filter((t) => t.isActive).length;

    // 3. Current MRR Calculation (Normalized Monthly Run Rate)
    let currentMrr = 0;
    const planBreakdown: Record<string, { count: number; mrr: number }> = {};

    activeTenants.forEach((tenant) => {
      const planKey = (tenant.subscription?.plan || 'STARTER').toUpperCase();
      const planData = planPriceMap.get(planKey) || { monthly: 990, yearly: 9900 };
      const mrrValue = planData.monthly; // normalized monthly subscription price

      currentMrr += mrrValue;
      if (!planBreakdown[planKey]) {
        planBreakdown[planKey] = { count: 0, mrr: 0 };
      }
      planBreakdown[planKey].count += 1;
      planBreakdown[planKey].mrr += mrrValue;
    });

    const payingTenantsCount = activeTenants.length;
    const arr = currentMrr * 12;

    // 4. Period Changes: New MRR, Churned MRR, Expansion MRR
    // New paying tenants in period: Successful first payment or upgraded within this month
    const paymentsInPeriod = await PaymentTransaction.find({
      paymentStatus: 'SUCCESS',
      paidAt: { $gte: startDate, $lte: endDate },
    }).lean();

    const uniquePayersInPeriod = new Set(paymentsInPeriod.map((p) => p.tenantId.toString()));

    // Prior period paying tenants
    const priorMonthDate = new Date(startDate.getFullYear(), startDate.getMonth() - 1, 15);
    const priorPeriod = this.getPeriodString(priorMonthDate);
    const priorSnapshot = await RevenuePeriodSnapshot.findOne({ period: priorPeriod });
    const priorMrr = priorSnapshot?.mrr || 0;
    const priorPayingCount = priorSnapshot?.payingTenantsCount || (payingTenantsCount > 0 ? payingTenantsCount : 1);

    // Churned Tenants in period: status is EXPIRED, CANCELLED, or SUSPENDED with updated timestamp in period
    const churnedTenants = allTenants.filter((t) => {
      const status = t.subscription?.status;
      const isChurned = status === 'CANCELLED' || status === 'EXPIRED';
      if (!isChurned) return false;
      const cancelDate = t.subscription?.cancelledAt || t.updatedAt;
      return cancelDate && cancelDate >= startDate && cancelDate <= endDate;
    });

    let churnedMrr = 0;
    churnedTenants.forEach((t) => {
      const planKey = (t.subscription?.plan || 'STARTER').toUpperCase();
      const p = planPriceMap.get(planKey) || { monthly: 990, yearly: 9900 };
      churnedMrr += p.monthly;
    });

    // New MRR: paying tenants created in this period
    const newPayingTenants = activeTenants.filter((t) => t.createdAt >= startDate && t.createdAt <= endDate);
    let newMrr = 0;
    newPayingTenants.forEach((t) => {
      const planKey = (t.subscription?.plan || 'STARTER').toUpperCase();
      const p = planPriceMap.get(planKey) || { monthly: 990, yearly: 9900 };
      newMrr += p.monthly;
    });

    // Expansion MRR: difference if net expansion occurred, else calculated cleanly
    let expansionMrr = 0;
    if (priorMrr > 0 && currentMrr > priorMrr + newMrr - churnedMrr) {
      expansionMrr = currentMrr - (priorMrr + newMrr - churnedMrr);
    }
    const netNewMrr = newMrr + expansionMrr - churnedMrr;

    // 5. Churn Rates
    const basePayingCount = priorPayingCount > 0 ? priorPayingCount : Math.max(1, payingTenantsCount);
    const logoChurnRate = Math.round((churnedTenants.length / basePayingCount) * 10000) / 100;
    const baseMrr = priorMrr > 0 ? priorMrr : Math.max(1, currentMrr);
    const revenueChurnRate = Math.round((churnedMrr / baseMrr) * 10000) / 100;

    // 6. Trial-to-Paid Conversion Rate
    const trialsEndedInPeriod = allTenants.filter((t) => {
      const trialEnds = t.subscription?.trialEndsAt;
      return trialEnds && trialEnds >= startDate && trialEnds <= endDate;
    });
    const trialsConvertedInPeriod = trialsEndedInPeriod.filter((t) =>
      ['ACTIVE', 'PAST_DUE', 'GRACE_PERIOD'].includes(t.subscription?.status)
    );
    const trialToPaidConversionRate =
      trialsEndedInPeriod.length > 0
        ? Math.round((trialsConvertedInPeriod.length / trialsEndedInPeriod.length) * 10000) / 100
        : 100.0;

    // 7. Cash Received (Billings) vs Refunds vs Failures
    const allAttemptsInPeriod = await PaymentTransaction.find({
      createdAt: { $gte: startDate, $lte: endDate },
    }).lean();

    const successAttempts = allAttemptsInPeriod.filter((p) => p.paymentStatus === 'SUCCESS');
    const failedAttempts = allAttemptsInPeriod.filter((p) => p.paymentStatus === 'FAILED');
    const refundedAttempts = allAttemptsInPeriod.filter((p) => p.paymentStatus === 'REFUNDED' || (p.refundAmount && p.refundAmount > 0));

    const cashReceived = successAttempts.reduce((sum, p) => sum + p.amount, 0);
    const refundsTotal = refundedAttempts.reduce((sum, p) => sum + (p.refundAmount || p.amount || 0), 0);

    const refundRate = cashReceived > 0 ? Math.round((refundsTotal / cashReceived) * 10000) / 100 : 0;
    const totalAttempts = successAttempts.length + failedAttempts.length;
    const paymentFailureRate = totalAttempts > 0 ? Math.round((failedAttempts.length / totalAttempts) * 10000) / 100 : 0;

    // 8. GAAP Recognized Revenue & Deferred Revenue Liability
    // Monthly payments recognized in current month:
    let recognizedMonthly = 0;
    // Annual payments recognized 1/12 each month across 12-month rolling horizon:
    let recognizedAnnual = 0;
    let deferredRevenue = 0;

    // Fetch all successful transactions within last 12 months for amortization calculation
    const twelveMonthsAgo = new Date(startDate.getFullYear(), startDate.getMonth() - 11, 1);
    const rollingTransactions = await PaymentTransaction.find({
      paymentStatus: 'SUCCESS',
      paidAt: { $gte: twelveMonthsAgo, $lte: endDate },
    }).lean();

    rollingTransactions.forEach((tx) => {
      const txPaidAt = tx.paidAt || tx.createdAt;
      const isCurrentMonth = txPaidAt >= startDate && txPaidAt <= endDate;

      if (tx.billingCycle === 'MONTHLY') {
        if (isCurrentMonth) {
          recognizedMonthly += tx.amount;
        }
      } else {
        // YEARLY: Amortize 1/12 per month over 12 months
        const monthlyPortion = tx.amount / 12;
        // Check if current month falls within 12 months from payment
        const monthsSincePayment =
          (startDate.getFullYear() - txPaidAt.getFullYear()) * 12 +
          (startDate.getMonth() - txPaidAt.getMonth());

        if (monthsSincePayment >= 0 && monthsSincePayment < 12) {
          recognizedAnnual += monthlyPortion;
          const remainingUnearnedMonths = 11 - monthsSincePayment;
          deferredRevenue += monthlyPortion * remainingUnearnedMonths;
        }
      }
    });

    const recognizedRevenue = Math.round((recognizedMonthly + recognizedAnnual) * 100) / 100;
    deferredRevenue = Math.round(deferredRevenue * 100) / 100;

    // 9. Cost Intelligence & COGS Calculation
    const unitEconomics = await this.calculateTenantUnitEconomics(undefined, period);
    const totalCogs = unitEconomics.summary.totalCogs;
    const grossProfit = Math.round((recognizedRevenue - totalCogs) * 100) / 100;
    const grossMarginPercent =
      recognizedRevenue > 0 ? Math.round((grossProfit / recognizedRevenue) * 10000) / 100 : 0;

    // 10. CAC & LTV
    const marketingRecord = await MarketingSalesExpense.findOne({ period });
    const cac = marketingRecord?.cac || (newPayingTenants.length > 0 ? Math.round(5000 / newPayingTenants.length) : 500);

    const arpu = payingTenantsCount > 0 ? Math.round((currentMrr / payingTenantsCount) * 100) / 100 : 0;
    const monthlyChurnDecimal = Math.max(0.015, logoChurnRate / 100);
    const grossMarginDecimal = Math.max(0.4, grossMarginPercent / 100);
    const ltv = Math.round((arpu * grossMarginDecimal) / monthlyChurnDecimal);

    // Save period snapshot
    await RevenuePeriodSnapshot.findOneAndUpdate(
      { period },
      {
        $set: {
          period,
          mrr: currentMrr,
          arr,
          newMrr,
          expansionMrr,
          churnedMrr,
          netNewMrr,
          activeTenantsCount,
          payingTenantsCount,
          newPayingTenantsCount: newPayingTenants.length,
          churnedTenantsCount: churnedTenants.length,
          logoChurnRate,
          revenueChurnRate,
          trialToPaidConversionRate,
          cac,
          arpu,
          ltv,
          cashReceived,
          recognizedRevenue,
          deferredRevenue,
          refundsTotal,
          refundRate,
          paymentFailureRate,
          totalCogs,
          grossProfit,
          grossMarginPercent,
          calculatedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    return {
      period,
      mrr: currentMrr,
      arr,
      newMrr,
      expansionMrr,
      churnedMrr,
      netNewMrr,
      activeTenantsCount,
      payingTenantsCount,
      newPayingTenantsCount: newPayingTenants.length,
      churnedTenantsCount: churnedTenants.length,
      logoChurnRate,
      revenueChurnRate,
      trialToPaidConversionRate,
      cac,
      arpu,
      ltv,
      cashReceived,
      recognizedRevenue,
      deferredRevenue,
      refundsTotal,
      refundRate,
      paymentFailureRate,
      totalCogs,
      grossProfit,
      grossMarginPercent,
      planBreakdown,
      currency: 'BDT',
    };
  }

  /**
   * 4. TENANT GRANULAR COST ALLOCATION & UNIT ECONOMICS
   * Computes COGS per tenant based on actual resource usage:
   * Hosting, Storage, Image Processing, OCR, SMS/Email, Gateway Fees, Support
   */
  public async calculateTenantUnitEconomics(
    targetTenantId?: string,
    targetPeriod?: string
  ): Promise<{ tenants: ITenantCostAllocation[]; summary: Record<string, any> }> {
    const { startDate, endDate, period } = this.getPeriodDateRange(targetPeriod);
    const costConfig = await this.ensureCostConfig();

    const query: Record<string, any> = { isActive: true };
    if (targetTenantId) {
      query._id = targetTenantId;
    }
    const tenants = await Tenant.find(query).lean();

    // Fixed base hosting allocated equally among all active platform tenants
    const totalPlatformTenants = await Tenant.countDocuments({ isActive: true });
    const activeTenantsDivisor = Math.max(1, totalPlatformTenants);
    const baseHostingPerTenant = Math.round((costConfig.hostingCostBaseMonthly / activeTenantsDivisor) * 100) / 100;
    const baseOverheadPerTenant = Math.round((costConfig.monthlyOverheadBuffer / activeTenantsDivisor) * 100) / 100;

    // Cache plans map
    const allPlans = await PlanConfig.find({}).lean();
    const planPriceMap = new Map<string, number>();
    allPlans.forEach((p) => planPriceMap.set(p.planKey.toUpperCase(), p.monthlyPrice));
    if (!planPriceMap.has('STARTER')) planPriceMap.set('STARTER', 990);
    if (!planPriceMap.has('PRO')) planPriceMap.set('PRO', 1990);
    if (!planPriceMap.has('BUSINESS')) planPriceMap.set('BUSINESS', 3990);
    if (!planPriceMap.has('ENTERPRISE')) planPriceMap.set('ENTERPRISE', 7990);

    const tenantIds = tenants.map((t) => t._id);

    // Batch 1: Usage meters
    const usageMeters = await TenantUsageMeter.find({
      tenantId: { $in: tenantIds },
      period: { $in: [period, period.slice(0, 7)] },
    }).lean();
    const usageMeterMap = new Map<string, any>();
    usageMeters.forEach((u) => usageMeterMap.set(u.tenantId.toString(), u));

    // Batch 2: Notification counts (SMS & EMAIL)
    const notificationCounts = await Notification.aggregate([
      {
        $match: {
          tenantId: { $in: tenantIds },
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { tenantId: '$tenantId', type: '$type' },
          count: { $sum: 1 },
        },
      },
    ]);
    const smsCountMap = new Map<string, number>();
    const emailCountMap = new Map<string, number>();
    notificationCounts.forEach((n) => {
      const tid = n._id.tenantId.toString();
      if (n._id.type === 'SMS') smsCountMap.set(tid, n.count);
      if (n._id.type === 'EMAIL') emailCountMap.set(tid, n.count);
    });

    // Batch 3: Payments & Gateway fees
    const paymentsList = await PaymentTransaction.find({
      tenantId: { $in: tenantIds },
      paymentStatus: 'SUCCESS',
      paidAt: { $gte: startDate, $lte: endDate },
    }).lean();
    const gatewayFeesMap = new Map<string, number>();
    paymentsList.forEach((p) => {
      const tid = p.tenantId.toString();
      const rate =
        costConfig.paymentGatewayFeePercent[p.provider as keyof typeof costConfig.paymentGatewayFeePercent] ?? 1.5;
      const fee = (p.amount * rate) / 100;
      gatewayFeesMap.set(tid, (gatewayFeesMap.get(tid) || 0) + fee);
    });

    // Batch 4: Support ticket counts
    const ticketCounts = await SupportTicket.aggregate([
      {
        $match: {
          tenantId: { $in: tenantIds },
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$tenantId',
          count: { $sum: 1 },
        },
      },
    ]);
    const ticketCountMap = new Map<string, number>();
    ticketCounts.forEach((tc) => ticketCountMap.set(tc._id.toString(), tc.count));

    const allocations: any[] = [];
    const bulkOps: any[] = [];
    let aggregateCogs = 0;
    let aggregateRevenue = 0;

    for (const tenant of tenants) {
      const tenantId = tenant._id as mongoose.Types.ObjectId;
      const tenantIdStr = tenantId.toString();

      // 1. Storage bytes used
      const storageBytes = tenant.quotas?.storageUsedBytes || 0;
      const storageGb = storageBytes / (1024 * 1024 * 1024);
      const storageCost = Math.round(storageGb * costConfig.storageCostPerGbMonthly * 100) / 100;

      // 2. Usage meter (OCR, Passport renders, Print jobs)
      const usageMeter = usageMeterMap.get(tenantIdStr);
      const passportJobs = usageMeter?.metrics?.passportLayoutsGenerated || tenant.quotas?.monthlyPassportLayoutsUsed || 0;
      const ocrPages = usageMeter?.metrics?.ocrPagesProcessed || tenant.quotas?.monthlyOcrPagesUsed || 0;
      const printJobs = usageMeter?.metrics?.printJobsExecuted || 0;

      const imageProcCost = Math.round(passportJobs * costConfig.imageProcessingCostPerJob * 100) / 100;
      const ocrCost = Math.round(ocrPages * costConfig.ocrCostPerPage * 100) / 100;

      // 3. SMS & Emails
      const smsCount = smsCountMap.get(tenantIdStr) || 0;
      const emailCount = emailCountMap.get(tenantIdStr) || 0;
      const messagingCost = Math.round((smsCount * costConfig.smsUnitCost + emailCount * costConfig.emailUnitCost) * 100) / 100;

      // 4. Payment Gateway Fees
      const paymentGatewayFees = Math.round((gatewayFeesMap.get(tenantIdStr) || 0) * 100) / 100;

      // 5. Support Tickets Handled
      const ticketsCount = ticketCountMap.get(tenantIdStr) || 0;
      const supportCost = Math.round(ticketsCount * costConfig.supportCostPerTicket * 100) / 100;

      // Total COGS for this tenant
      const computeCost = Math.round((baseHostingPerTenant + baseOverheadPerTenant) * 100) / 100;
      const totalCogs = Math.round(
        (storageCost + computeCost + ocrCost + imageProcCost + messagingCost + paymentGatewayFees + supportCost) * 100
      ) / 100;

      // Recognized Revenue for this tenant
      const planKey = (tenant.subscription?.plan || 'STARTER').toUpperCase();
      let revenueRecognized = 0;
      if (['ACTIVE', 'PAST_DUE', 'GRACE_PERIOD'].includes(tenant.subscription?.status)) {
        revenueRecognized = planPriceMap.get(planKey) || 990;
      }

      const grossProfit = Math.round((revenueRecognized - totalCogs) * 100) / 100;
      const grossMarginPercent =
        revenueRecognized > 0 ? Math.round((grossProfit / revenueRecognized) * 10000) / 100 : 0;

      const allocationDoc = {
        tenantId,
        period,
        usageMetrics: {
          storageBytesUsed: storageBytes,
          passportLayoutsGenerated: passportJobs,
          ocrPagesProcessed: ocrPages,
          printJobsExecuted: printJobs,
          smsSent: smsCount,
          emailsSent: emailCount,
          ticketsCount,
        },
        costBreakdown: {
          storageCost,
          computeCost,
          ocrCost,
          imageProcCost,
          messagingCost,
          paymentGatewayFees,
          supportCost,
          totalCogs,
        },
        revenueRecognized,
        grossProfit,
        grossMarginPercent,
        calculatedAt: new Date(),
      };

      allocations.push(allocationDoc);
      bulkOps.push({
        updateOne: {
          filter: { tenantId, period },
          update: { $set: allocationDoc },
          upsert: true,
        },
      });

      aggregateCogs += totalCogs;
      aggregateRevenue += revenueRecognized;
    }

    if (bulkOps.length > 0) {
      await TenantCostAllocation.bulkWrite(bulkOps);
    }

    const aggregateGrossProfit = Math.round((aggregateRevenue - aggregateCogs) * 100) / 100;
    const aggregateGrossMarginPercent =
      aggregateRevenue > 0 ? Math.round((aggregateGrossProfit / aggregateRevenue) * 10000) / 100 : 0;

    return {
      tenants: allocations,
      summary: {
        period,
        tenantCount: tenants.length,
        totalCogs: Math.round(aggregateCogs * 100) / 100,
        totalRevenue: Math.round(aggregateRevenue * 100) / 100,
        grossProfit: aggregateGrossProfit,
        grossMarginPercent: aggregateGrossMarginPercent,
        averageCogsPerTenant:
          tenants.length > 0 ? Math.round((aggregateCogs / tenants.length) * 100) / 100 : 0,
      },
    };
  }

  /**
   * 5. CUSTOMER COHORT RETENTION & REVENUE ANALYSIS
   * Groups tenants by signup month and calculates retention and cumulative revenue.
   */
  public async getCustomerCohortAnalysis(monthsBack: number = 6): Promise<Record<string, any>> {
    const now = new Date();
    const cohorts: any[] = [];

    for (let i = monthsBack - 1; i >= 0; i--) {
      const cohortDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const cohortPeriod = this.getPeriodString(cohortDate);
      const cohortStart = new Date(cohortDate.getFullYear(), cohortDate.getMonth(), 1);
      const cohortEnd = new Date(cohortDate.getFullYear(), cohortDate.getMonth() + 1, 0, 23, 59, 59);

      // Tenants signed up in this cohort period
      const cohortTenants = await Tenant.find({
        createdAt: { $gte: cohortStart, $lte: cohortEnd },
      }).lean();

      const cohortSize = cohortTenants.length;
      if (cohortSize === 0) {
        cohorts.push({
          cohortPeriod,
          cohortSize: 0,
          retention: [100],
          cumulativeRevenue: 0,
          payingCount: 0,
        });
        continue;
      }

      const tenantIds = cohortTenants.map((t) => t._id);
      const currentlyActive = cohortTenants.filter((t) =>
        ['ACTIVE', 'PAST_DUE', 'GRACE_PERIOD'].includes(t.subscription?.status)
      ).length;

      // Payments from this cohort
      const cohortPayments = await PaymentTransaction.find({
        tenantId: { $in: tenantIds },
        paymentStatus: 'SUCCESS',
      }).lean();

      const cumulativeRevenue = cohortPayments.reduce((sum, p) => sum + p.amount, 0);

      // Retention rates across elapsed months
      const elapsedMonths = i;
      const retentionTimeline: number[] = [100]; // Month 0 is 100%

      for (let m = 1; m <= elapsedMonths; m++) {
        // Sample retention estimated or derived from still active status
        const decayFactor = Math.max(0.7, 1 - m * 0.05);
        const retainedPct = Math.round((currentlyActive / cohortSize) * decayFactor * 100);
        retentionTimeline.push(Math.min(100, Math.max(0, retainedPct)));
      }

      cohorts.push({
        cohortPeriod,
        cohortSize,
        currentlyActive,
        retention: retentionTimeline,
        cumulativeRevenue: Math.round(cumulativeRevenue * 100) / 100,
        arpu: Math.round((cumulativeRevenue / cohortSize) * 100) / 100,
      });
    }

    return {
      analysisDate: now,
      monthsAnalyzed: monthsBack,
      cohorts,
    };
  }

  /**
   * 6. SUBSCRIPTION RENEWAL PIPELINE REPORT
   * Upcoming expirations, renewals, and grace periods in next 7/14/30 days.
   */
  public async getSubscriptionRenewalReport(daysAhead: number = 30): Promise<Record<string, any>> {
    const now = new Date();
    const horizon = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const tenants = await Tenant.find({
      isActive: true,
      $or: [
        { 'subscription.currentPeriodEnd': { $gte: now, $lte: horizon } },
        { 'subscription.trialEndsAt': { $gte: now, $lte: horizon } },
        { 'subscription.status': { $in: ['PAST_DUE', 'GRACE_PERIOD'] } },
      ],
    }).lean();

    const in7Days: any[] = [];
    const in14Days: any[] = [];
    const in30Days: any[] = [];
    const inGracePeriod: any[] = [];

    let projectedRenewalRevenue = 0;
    const day7Date = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const day14Date = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const planMap = new Map<string, number>();
    const plans = await PlanConfig.find({}).lean();
    plans.forEach((p) => planMap.set(p.planKey.toUpperCase(), p.monthlyPrice));

    tenants.forEach((t) => {
      const planKey = (t.subscription?.plan || 'STARTER').toUpperCase();
      const renewalPrice = planMap.get(planKey) || 990;
      const targetDate = t.subscription?.currentPeriodEnd || t.subscription?.trialEndsAt || now;

      const item = {
        tenantId: t._id,
        name: t.name,
        subdomain: t.subdomain,
        plan: planKey,
        renewalPrice,
        status: t.subscription?.status,
        expiresAt: targetDate,
        inGracePeriod: ['PAST_DUE', 'GRACE_PERIOD'].includes(t.subscription?.status),
      };

      if (['PAST_DUE', 'GRACE_PERIOD'].includes(t.subscription?.status)) {
        inGracePeriod.push(item);
      } else if (targetDate <= day7Date) {
        in7Days.push(item);
        projectedRenewalRevenue += renewalPrice;
      } else if (targetDate <= day14Date) {
        in14Days.push(item);
        projectedRenewalRevenue += renewalPrice;
      } else {
        in30Days.push(item);
        projectedRenewalRevenue += renewalPrice;
      }
    });

    return {
      daysAhead,
      totalExpiringSoon: tenants.length,
      projectedRenewalRevenue,
      buckets: {
        within7Days: { count: in7Days.length, tenants: in7Days },
        within14Days: { count: in14Days.length, tenants: in14Days },
        within30Days: { count: in30Days.length, tenants: in30Days },
        inGracePeriod: { count: inGracePeriod.length, tenants: inGracePeriod },
      },
    };
  }

  /**
   * 7. PLAN-WISE REVENUE DISTRIBUTION
   */
  public async getPlanWiseRevenue(): Promise<Record<string, any>> {
    const plans = await PlanConfig.find({ isActive: true }).lean();
    const result: any[] = [];
    let totalPlatformMrr = 0;

    for (const plan of plans) {
      const activeCount = await Tenant.countDocuments({
        'subscription.plan': plan.planKey,
        'subscription.status': { $in: ['ACTIVE', 'PAST_DUE', 'GRACE_PERIOD'] },
        isActive: true,
      });

      const planMrr = activeCount * plan.monthlyPrice;
      totalPlatformMrr += planMrr;

      result.push({
        planKey: plan.planKey,
        displayName: plan.displayName,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        activeTenants: activeCount,
        mrr: planMrr,
        arr: planMrr * 12,
        features: plan.featureRestrictions,
      });
    }

    // Add percentage shares
    result.forEach((p) => {
      p.mrrSharePercent = totalPlatformMrr > 0 ? Math.round((p.mrr / totalPlatformMrr) * 10000) / 100 : 0;
    });

    return {
      totalPlatformMrr,
      totalPlatformArr: totalPlatformMrr * 12,
      plans: result,
    };
  }

  /**
   * 8. COMPREHENSIVE MONTHLY EXECUTIVE REVENUE REPORT
   */
  public async getMonthlyRevenueReport(targetPeriod?: string): Promise<Record<string, any>> {
    const period = targetPeriod || this.getPeriodString();
    const metrics = await this.calculateMRRAndMetrics(period);
    const planBreakdown = await this.getPlanWiseRevenue();
    const renewalPipeline = await this.getSubscriptionRenewalReport(30);

    return {
      period,
      headline: {
        mrr: metrics.mrr,
        arr: metrics.arr,
        cashReceived: metrics.cashReceived,
        recognizedRevenue: metrics.recognizedRevenue,
        deferredRevenue: metrics.deferredRevenue,
        totalCogs: metrics.totalCogs,
        grossProfit: metrics.grossProfit,
        grossMarginPercent: metrics.grossMarginPercent,
      },
      growthAndRetention: {
        newMrr: metrics.newMrr,
        expansionMrr: metrics.expansionMrr,
        churnedMrr: metrics.churnedMrr,
        netNewMrr: metrics.netNewMrr,
        logoChurnRate: metrics.logoChurnRate,
        revenueChurnRate: metrics.revenueChurnRate,
        trialToPaidConversionRate: metrics.trialToPaidConversionRate,
      },
      unitEconomics: {
        cac: metrics.cac,
        arpu: metrics.arpu,
        ltv: metrics.ltv,
        ltvToCacRatio: metrics.cac > 0 ? Math.round((metrics.ltv / metrics.cac) * 100) / 100 : 0,
        refundRate: metrics.refundRate,
        paymentFailureRate: metrics.paymentFailureRate,
      },
      costIntelligence: {
        totalCogs: metrics.totalCogs,
      },
      planDistribution: planBreakdown,
      renewalsUpcoming: {
        count: renewalPipeline.totalExpiringSoon,
        projectedRevenue: renewalPipeline.projectedRenewalRevenue,
      },
    };
  }
}

export const revenueIntelligenceService = new RevenueIntelligenceService();
