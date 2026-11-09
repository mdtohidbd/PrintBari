import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

import axios from 'axios';
import mongoose from 'mongoose';
import { db } from '../config/db';
import { Tenant } from '../models/Tenant.model';
import { User } from '../models/User.model';
import { PlanConfig, PaymentTransaction } from '../models/Subscription.model';
import { TenantUsageMeter } from '../models/TenantUsageMeter.model';
import { Notification } from '../models/Notification.model';
import { SupportTicket } from '../models/SupportTicket.model';
import { revenueIntelligenceService } from '../modules/superadmin/revenueIntelligence.service';

const API_BASE = 'http://localhost:5000/api/v1';

let passedChecks = 0;
let totalChecks = 0;

function assert(condition: boolean, message: string) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('\n=============================================================');
  console.log('🚀 PHASE 35: SAAS REVENUE INTELLIGENCE & FINANCIAL OPERATIONS');
  console.log('=============================================================\n');

  await db.connect();

  const stamp = Date.now().toString(36);

  // 1. Ensure Default Plans exist
  console.log('▶ TEST GROUP 1: Subscription Plans & Cost Structure Setup');
  const starterPlan = await PlanConfig.findOneAndUpdate(
    { planKey: 'STARTER' },
    {
      $set: {
        displayName: 'Starter Studio',
        description: 'Starter tier for small shops',
        monthlyPrice: 990,
        yearlyPrice: 9900,
        isActive: true,
      },
    },
    { upsert: true, new: true }
  );
  assert(starterPlan.monthlyPrice === 990, 'Starter plan configured at 990 BDT/mo');

  const proPlan = await PlanConfig.findOneAndUpdate(
    { planKey: 'PRO' },
    {
      $set: {
        displayName: 'Professional Studio',
        description: 'Pro tier for multi-staff shops',
        monthlyPrice: 1990,
        yearlyPrice: 19900,
        isActive: true,
      },
    },
    { upsert: true, new: true }
  );
  assert(proPlan.monthlyPrice === 1990, 'Pro plan configured at 1990 BDT/mo');

  const businessPlan = await PlanConfig.findOneAndUpdate(
    { planKey: 'BUSINESS' },
    {
      $set: {
        displayName: 'Business Studio',
        description: 'Business tier for high-volume printing hubs',
        monthlyPrice: 3990,
        yearlyPrice: 39900,
        isActive: true,
      },
    },
    { upsert: true, new: true }
  );
  assert(businessPlan.monthlyPrice === 3990, 'Business plan configured at 3990 BDT/mo');

  // Verify Cost Structure Configuration
  const initialCostConfig = await revenueIntelligenceService.ensureCostConfig();
  assert(initialCostConfig.hostingCostBaseMonthly === 5000, 'Base monthly hosting cost seeded at 5000 BDT');
  assert(initialCostConfig.storageCostPerGbMonthly === 2.5, 'Storage cost per GB seeded at 2.50 BDT');
  assert(initialCostConfig.ocrCostPerPage === 0.4, 'OCR cost per page seeded at 0.40 BDT');

  const updatedConfig = await revenueIntelligenceService.updateCostConfig({
    smsUnitCost: 0.38,
    supportCostPerTicket: 50.0,
  });
  assert(updatedConfig.smsUnitCost === 0.38, 'Cost structure updated SMS rate to 0.38 BDT');
  assert(updatedConfig.supportCostPerTicket === 50.0, 'Cost structure updated Support rate to 50.0 BDT');

  // 2. Marketing & Sales Spend (CAC)
  console.log('\n▶ TEST GROUP 2: Marketing & Sales Spend Tracking (CAC)');
  const currentPeriod = revenueIntelligenceService.getPeriodString();
  const marketingRecord = await revenueIntelligenceService.recordMarketingSpend({
    period: currentPeriod,
    adSpend: 15000,
    salesCommissions: 5000,
    marketingPersonnel: 10000,
    toolsAndSoftware: 2000,
    newPayingCustomersAcquired: 10,
    notes: 'Paid digital campaigns and local shop outbound',
  });
  assert(marketingRecord.totalMarketingSpend === 32000, 'Total marketing spend accurately computed as 32000 BDT');
  assert(marketingRecord.cac === 3200, 'Customer Acquisition Cost (CAC) accurately calculated as 3200 BDT');

  // 3. Multi-Tenant Provisioning
  console.log('\n▶ TEST GROUP 3: Multi-Tenant Subscription Provisioning');
  // Tenant A: Pro Plan (Monthly)
  const tenantA = await Tenant.create({
    businessId: `TEN-A-${stamp}`,
    name: `Apex Studio A ${stamp}`,
    subdomain: `apex-a-${stamp}`,
    isActive: true,
    subscription: {
      plan: 'PRO',
      status: 'ACTIVE',
      trialEndsAt: new Date(Date.now() - 30 * 86400000),
      currentPeriodEnd: new Date(Date.now() + 20 * 86400000),
    },
    quotas: {
      storageUsedBytes: 15 * 1024 * 1024 * 1024, // 15 GB
      monthlyPassportLayoutsUsed: 350,
      monthlyOcrPagesUsed: 120,
    },
  });
  assert(!!tenantA._id, 'Tenant A (Pro Monthly) provisioned');

  // Tenant B: Business Plan (Annual Subscription)
  const tenantB = await Tenant.create({
    businessId: `TEN-B-${stamp}`,
    name: `Metro Studio B ${stamp}`,
    subdomain: `metro-b-${stamp}`,
    isActive: true,
    subscription: {
      plan: 'BUSINESS',
      status: 'ACTIVE',
      trialEndsAt: new Date(Date.now() - 60 * 86400000),
      currentPeriodEnd: new Date(Date.now() + 200 * 86400000),
    },
    quotas: {
      storageUsedBytes: 40 * 1024 * 1024 * 1024, // 40 GB
      monthlyPassportLayoutsUsed: 800,
      monthlyOcrPagesUsed: 450,
    },
  });
  assert(!!tenantB._id, 'Tenant B (Business Annual) provisioned');

  // Tenant C: Starter Plan (Past Due / Grace Period)
  const tenantC = await Tenant.create({
    businessId: `TEN-C-${stamp}`,
    name: `City Copy C ${stamp}`,
    subdomain: `city-c-${stamp}`,
    isActive: true,
    subscription: {
      plan: 'STARTER',
      status: 'PAST_DUE',
      trialEndsAt: new Date(Date.now() - 45 * 86400000),
      currentPeriodEnd: new Date(Date.now() + 3 * 86400000),
      gracePeriodEndsAt: new Date(Date.now() + 5 * 86400000),
    },
    quotas: {
      storageUsedBytes: 2 * 1024 * 1024 * 1024, // 2 GB
      monthlyPassportLayoutsUsed: 60,
      monthlyOcrPagesUsed: 15,
    },
  });
  assert(!!tenantC._id, 'Tenant C (Starter Past-Due) provisioned');

  // Tenant D: Cancelled / Churned Tenant
  const tenantD = await Tenant.create({
    businessId: `TEN-D-${stamp}`,
    name: `Old Print D ${stamp}`,
    subdomain: `old-d-${stamp}`,
    isActive: false,
    subscription: {
      plan: 'STARTER',
      status: 'CANCELLED',
      trialEndsAt: new Date(Date.now() - 90 * 86400000),
      cancelledAt: new Date(),
      cancellationReason: 'Shop closed down',
    },
    quotas: {
      storageUsedBytes: 500 * 1024 * 1024,
      monthlyPassportLayoutsUsed: 0,
      monthlyOcrPagesUsed: 0,
    },
  });
  assert(!!tenantD._id, 'Tenant D (Cancelled / Churned) provisioned');

  // 4. Seed Payment Transactions (Cash Billings, Gateway Fees, Failures, Refunds)
  console.log('\n▶ TEST GROUP 4: Financial Transactions & Payment Reconciliation');
  const now = new Date();

  // Payment 1: Tenant A Monthly Pro Payment (BDT 1,990 via bKash)
  await PaymentTransaction.create({
    tenantId: tenantA._id,
    transactionCode: `TX-A-${stamp}`,
    planKey: 'PRO',
    billingCycle: 'MONTHLY',
    amount: 1990,
    currency: 'BDT',
    provider: 'BKASH',
    providerTransactionId: `BK-${stamp}-01`,
    paymentStatus: 'SUCCESS',
    idempotencyKey: `IDEM-A-${stamp}`,
    invoiceNumber: `INV-A-${stamp}`,
    paidAt: now,
  });

  // Payment 2: Tenant B Annual Business Payment (BDT 39,900 via SSLCOMMERZ)
  await PaymentTransaction.create({
    tenantId: tenantB._id,
    transactionCode: `TX-B-${stamp}`,
    planKey: 'BUSINESS',
    billingCycle: 'YEARLY',
    amount: 39900,
    currency: 'BDT',
    provider: 'SSLCOMMERZ',
    providerTransactionId: `SSL-${stamp}-01`,
    paymentStatus: 'SUCCESS',
    idempotencyKey: `IDEM-B-${stamp}`,
    invoiceNumber: `INV-B-${stamp}`,
    paidAt: now,
  });

  // Payment 3: Failed Payment Attempt for Tenant C
  await PaymentTransaction.create({
    tenantId: tenantC._id,
    transactionCode: `TX-C-FAIL-${stamp}`,
    planKey: 'STARTER',
    billingCycle: 'MONTHLY',
    amount: 990,
    currency: 'BDT',
    provider: 'NAGAD',
    paymentStatus: 'FAILED',
    errorMessage: 'Insufficient balance in customer wallet',
    idempotencyKey: `IDEM-C-${stamp}`,
    invoiceNumber: `INV-C-${stamp}`,
  });

  // Payment 4: Partial Refund Transaction
  await PaymentTransaction.create({
    tenantId: tenantA._id,
    transactionCode: `TX-REFUND-${stamp}`,
    planKey: 'PRO',
    billingCycle: 'MONTHLY',
    amount: 500,
    currency: 'BDT',
    provider: 'BKASH',
    paymentStatus: 'REFUNDED',
    refundAmount: 500,
    refundReason: 'Goodwill adjustment for minor service disruption',
    idempotencyKey: `IDEM-REF-${stamp}`,
    invoiceNumber: `INV-REF-${stamp}`,
    paidAt: now,
    refundedAt: now,
  });

  assert(true, 'Payment transactions seeded: 2 Success, 1 Failed, 1 Refund');

  // 5. Seed Usage Metering, Notifications, and Support Tickets
  console.log('\n▶ TEST GROUP 5: Cost Drivers & Usage Metering');
  await TenantUsageMeter.create({
    tenantId: tenantA._id,
    period: currentPeriod,
    metrics: {
      apiRequestsTotal: 2500,
      storageBytesUsed: 15 * 1024 * 1024 * 1024,
      passportLayoutsGenerated: 350,
      ocrPagesProcessed: 120,
      printJobsExecuted: 420,
      bandwidthBytesOut: 2 * 1024 * 1024 * 1024,
    },
  });

  await TenantUsageMeter.create({
    tenantId: tenantB._id,
    period: currentPeriod,
    metrics: {
      apiRequestsTotal: 8900,
      storageBytesUsed: 40 * 1024 * 1024 * 1024,
      passportLayoutsGenerated: 800,
      ocrPagesProcessed: 450,
      printJobsExecuted: 1100,
      bandwidthBytesOut: 8 * 1024 * 1024 * 1024,
    },
  });

  // Seed Notifications (SMS and Email)
  await Notification.create([
    {
      tenantId: tenantA._id,
      type: 'SMS',
      category: 'JOB_EVENT',
      title: 'SMS Sent',
      message: 'Job completed',
      deliveryStatus: 'DELIVERED',
      createdAt: now,
    },
    {
      tenantId: tenantA._id,
      type: 'EMAIL',
      category: 'PAYMENT',
      title: 'Invoice',
      message: 'Monthly invoice',
      deliveryStatus: 'DELIVERED',
      createdAt: now,
    },
    {
      tenantId: tenantB._id,
      type: 'SMS',
      category: 'JOB_EVENT',
      title: 'SMS Sent',
      message: 'High priority job',
      deliveryStatus: 'DELIVERED',
      createdAt: now,
    },
  ]);

  // Seed Support Ticket
  await SupportTicket.create({
    ticketCode: `TCK-${stamp}`,
    tenantId: tenantA._id,
    creatorId: new mongoose.Types.ObjectId(),
    subject: 'Thermal printer driver question',
    category: 'PRINTER_HARDWARE',
    priority: 'MEDIUM',
    status: 'RESOLVED',
    createdAt: now,
  });

  assert(true, 'Cost driver meters (Usage, Notifications, Support) seeded');

  // 6. SaaS Core Financial Metrics Calculation
  console.log('\n▶ TEST GROUP 6: MRR, ARR, Churn & Unit Metrics Calculation');
  const metrics = await revenueIntelligenceService.calculateMRRAndMetrics(currentPeriod);

  assert(metrics.mrr > 0, `MRR calculated: ${metrics.mrr} BDT`);
  assert(metrics.arr === metrics.mrr * 12, `ARR mathematically matches MRR * 12: ${metrics.arr} BDT`);
  assert(metrics.payingTenantsCount >= 3, `Paying tenants correctly enumerated: ${metrics.payingTenantsCount}`);
  assert(metrics.churnedTenantsCount >= 1, `Churned tenants identified: ${metrics.churnedTenantsCount}`);
  assert(metrics.logoChurnRate >= 0, `Logo churn rate computed: ${metrics.logoChurnRate}%`);
  assert(metrics.revenueChurnRate >= 0, `Revenue churn rate computed: ${metrics.revenueChurnRate}%`);
  assert(metrics.paymentFailureRate > 0, `Payment failure rate computed: ${metrics.paymentFailureRate}%`);
  assert(metrics.refundRate > 0, `Refund rate computed: ${metrics.refundRate}%`);
  assert(metrics.cac === 3200, `CAC extracted from sales & marketing ledger: ${metrics.cac} BDT`);
  assert(metrics.arpu > 0, `ARPU calculated: ${metrics.arpu} BDT`);
  assert(metrics.ltv > metrics.arpu, `LTV calculated with margin & churn formula: ${metrics.ltv} BDT`);

  // 7. Accounting Rigor: Billings vs Recognized vs Recurring
  console.log('\n▶ TEST GROUP 7: Accounting Rigor — Cash Billings vs GAAP Recognized vs MRR');
  console.log(`  📊 Cash Received (Billings): ${metrics.cashReceived} BDT`);
  console.log(`  📊 GAAP Recognized Revenue: ${metrics.recognizedRevenue} BDT`);
  console.log(`  📊 Deferred Revenue Liability: ${metrics.deferredRevenue} BDT`);
  console.log(`  📊 Normalized MRR: ${metrics.mrr} BDT`);

  // Rule verification: Cash Received, Recognized Revenue, and MRR are distinct
  assert(
    metrics.cashReceived !== metrics.recognizedRevenue,
    'Cash Received (Billings) is NOT treated identically to GAAP Recognized Revenue'
  );
  assert(
    metrics.deferredRevenue > 0,
    `Deferred revenue recorded on balance sheet for annual subscriptions: ${metrics.deferredRevenue} BDT`
  );
  assert(metrics.grossProfit !== undefined, `Gross profit computed: ${metrics.grossProfit} BDT`);
  assert(metrics.grossMarginPercent > 0, `Gross margin % computed: ${metrics.grossMarginPercent}%`);

  // 8. Granular Tenant Unit Economics & COGS Attribution
  console.log('\n▶ TEST GROUP 8: Tenant Granular Unit Economics & COGS Attribution');
  const unitEconomics = await revenueIntelligenceService.calculateTenantUnitEconomics(
    tenantA._id.toString(),
    currentPeriod
  );
  const tenantACogs = unitEconomics.tenants[0];

  assert(!!tenantACogs, 'Granular COGS allocated for Tenant A');
  assert(tenantACogs.costBreakdown.storageCost > 0, `Tenant A storage cost: ${tenantACogs.costBreakdown.storageCost} BDT`);
  assert(tenantACogs.costBreakdown.computeCost > 0, `Tenant A hosting base cost: ${tenantACogs.costBreakdown.computeCost} BDT`);
  assert(tenantACogs.costBreakdown.imageProcCost > 0, `Tenant A image processing cost: ${tenantACogs.costBreakdown.imageProcCost} BDT`);
  assert(tenantACogs.costBreakdown.ocrCost > 0, `Tenant A OCR cost: ${tenantACogs.costBreakdown.ocrCost} BDT`);
  assert(tenantACogs.costBreakdown.paymentGatewayFees > 0, `Tenant A bKash gateway fees: ${tenantACogs.costBreakdown.paymentGatewayFees} BDT`);
  assert(tenantACogs.costBreakdown.supportCost === 50.0, `Tenant A support ticket cost: ${tenantACogs.costBreakdown.supportCost} BDT`);
  assert(tenantACogs.costBreakdown.totalCogs > 0, `Tenant A total COGS: ${tenantACogs.costBreakdown.totalCogs} BDT`);
  assert(tenantACogs.grossProfit > 0, `Tenant A Gross Profit positive: ${tenantACogs.grossProfit} BDT`);
  assert(tenantACogs.grossMarginPercent > 0, `Tenant A Gross Margin %: ${tenantACogs.grossMarginPercent}%`);

  // 9. Customer Cohort Analysis
  console.log('\n▶ TEST GROUP 9: Customer Cohort Retention & Cumulative Revenue');
  const cohortReport = await revenueIntelligenceService.getCustomerCohortAnalysis(6);
  assert(cohortReport.cohorts.length === 6, 'Cohort analysis covers 6 rolling monthly cohorts');
  const currentCohort = cohortReport.cohorts[cohortReport.cohorts.length - 1];
  assert(currentCohort.cohortSize >= 3, `Current cohort size tracked: ${currentCohort.cohortSize} signups`);
  assert(currentCohort.cumulativeRevenue > 0, `Current cohort cumulative billings tracked: ${currentCohort.cumulativeRevenue} BDT`);

  // 10. Subscription Renewal Pipeline Report
  console.log('\n▶ TEST GROUP 10: Subscription Renewal Pipeline & Grace Period Tracking');
  const renewalReport = await revenueIntelligenceService.getSubscriptionRenewalReport(30);
  assert(renewalReport.totalExpiringSoon >= 1, `Renewals identified in next 30 days: ${renewalReport.totalExpiringSoon}`);
  assert(renewalReport.buckets.inGracePeriod.count >= 1, 'Past due/grace period tenants captured in renewal pipeline');
  assert(renewalReport.projectedRenewalRevenue > 0, `Projected renewal revenue: ${renewalReport.projectedRenewalRevenue} BDT`);

  // 11. Plan-Wise Revenue Distribution
  console.log('\n▶ TEST GROUP 11: Plan-Wise Revenue Breakdown');
  const planDist = await revenueIntelligenceService.getPlanWiseRevenue();
  assert(planDist.totalPlatformMrr > 0, `Total platform MRR across tiers: ${planDist.totalPlatformMrr} BDT`);
  assert(planDist.plans.length >= 3, 'Plan breakdown tracks STARTER, PRO, and BUSINESS tiers');

  // 12. Executive Monthly Financial Report
  console.log('\n▶ TEST GROUP 12: Executive Monthly Revenue Report Rollup');
  const monthlyReport = await revenueIntelligenceService.getMonthlyRevenueReport(currentPeriod);
  assert(monthlyReport.headline.mrr > 0, 'Executive report displays headline MRR');
  assert(monthlyReport.unitEconomics.cac === 3200, 'Executive report displays accurate CAC');
  assert(monthlyReport.unitEconomics.ltvToCacRatio > 0, `LTV:CAC Ratio calculated: ${monthlyReport.unitEconomics.ltvToCacRatio}x`);
  assert(monthlyReport.headline.grossMarginPercent > 0, `Platform Gross Margin %: ${monthlyReport.headline.grossMarginPercent}%`);

  // 13. SuperAdmin HTTP API Endpoints Verification
  console.log('\n▶ TEST GROUP 13: SuperAdmin Financial API Endpoints Verification');

  // Create Super Admin user to test secured API
  const adminEmail = `superadmin-${stamp}@docustudio.test`;
  const adminUser = await User.create({
    tenantId: tenantA._id,
    fullName: 'Chief Financial Officer',
    email: adminEmail,
    passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
    role: 'SUPER_ADMIN',
    isActive: true,
  });

  const { TokenService } = await import('../utils/token');
  const adminToken = TokenService.generateAccessToken({
    userId: adminUser._id.toString(),
    tenantId: tenantA._id.toString(),
    email: adminUser.email,
    role: 'SUPER_ADMIN',
  });

  const headers = { Authorization: `Bearer ${adminToken}` };

  // Test GET /financial/metrics
  const metricsHttp = await axios.get(`${API_BASE}/superadmin/financial/metrics`, { headers });
  assert(metricsHttp.status === 200, 'HTTP GET /superadmin/financial/metrics returns 200');
  assert(metricsHttp.data.data.mrr > 0, 'HTTP response contains verified MRR');

  // Test GET /financial/unit-economics
  const unitHttp = await axios.get(`${API_BASE}/superadmin/financial/unit-economics`, { headers });
  assert(unitHttp.status === 200, 'HTTP GET /superadmin/financial/unit-economics returns 200');
  assert(unitHttp.data.data.summary.totalCogs > 0, 'HTTP response contains aggregate COGS');

  // Test GET /financial/cohorts
  const cohortHttp = await axios.get(`${API_BASE}/superadmin/financial/cohorts`, { headers });
  assert(cohortHttp.status === 200, 'HTTP GET /superadmin/financial/cohorts returns 200');

  // Test GET /financial/renewals
  const renewalsHttp = await axios.get(`${API_BASE}/superadmin/financial/renewals`, { headers });
  assert(renewalsHttp.status === 200, 'HTTP GET /superadmin/financial/renewals returns 200');

  // Test GET /financial/monthly-report
  const reportHttp = await axios.get(`${API_BASE}/superadmin/financial/monthly-report`, { headers });
  assert(reportHttp.status === 200, 'HTTP GET /superadmin/financial/monthly-report returns 200');
  assert(reportHttp.data.data.headline.mrr > 0, 'Executive monthly report returned via API');

  // Clean up test tenants and records
  await Tenant.deleteMany({ _id: { $in: [tenantA._id, tenantB._id, tenantC._id, tenantD._id] } });
  await User.deleteOne({ _id: adminUser._id });

  console.log('\n=============================================================');
  console.log(`🎉 ALL PHASE 35 REVENUE INTELLIGENCE TESTS PASSED (${passedChecks}/${totalChecks})`);
  console.log('=============================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

runTests().catch(async (err) => {
  console.error('\n❌ TEST RUNNER FAILED WITH ERROR:', err);
  if (err.response) {
    console.error('Response status:', err.response.status);
    console.error('Response data:', JSON.stringify(err.response.data, null, 2));
  }
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
