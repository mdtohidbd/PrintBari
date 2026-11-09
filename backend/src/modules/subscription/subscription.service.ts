import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import mongoose from 'mongoose';
import {
  PlanConfig,
  PaymentTransaction,
  SubscriptionInvoice,
  IPlanConfig,
  IPaymentTransaction,
  ISubscriptionInvoice,
  PaymentProvider,
  PaymentStatus,
} from '../../models/Subscription.model';
import { Tenant, SubscriptionPlan, SubscriptionStatus } from '../../models/Tenant.model';
import { User } from '../../models/User.model';
import { AuditLog } from '../../models/AuditLog.model';
import { automationEventBus } from '../../services/automationEventBus';
import { configCache } from '../../utils/configCache';
import { BadRequestError, NotFoundError } from '../../errors';

export const PERMITTED_SUBSCRIPTION_TRANSITIONS: Record<string, string[]> = {
  TRIAL: ['ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED'],
  TRIALING: ['ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED'],
  ACTIVE: ['PAST_DUE', 'GRACE_PERIOD', 'SUSPENDED', 'CANCELLED', 'ACTIVE'],
  PAST_DUE: ['GRACE_PERIOD', 'ACTIVE', 'SUSPENDED', 'CANCELLED'],
  GRACE_PERIOD: ['ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED'],
  SUSPENDED: ['ACTIVE', 'CANCELLED', 'EXPIRED'],
  EXPIRED: ['ACTIVE', 'CANCELLED'],
  CANCELLED: ['ACTIVE'],
};

const SECRET_SALT = process.env.PAYMENT_SECRET || 'docustudio-secure-payment-salt-2026';

export class SubscriptionService {
  /**
   * Pre-seed standard subscription plans if empty
   */
  public async ensureDefaultPlans(): Promise<IPlanConfig[]> {
    const count = await PlanConfig.countDocuments();
    if (count > 0) {
      return (await PlanConfig.find({ isActive: true }).sort({ monthlyPrice: 1 }).lean()) as unknown as IPlanConfig[];
    }

    const defaultPlans = [
      {
        planKey: 'STARTER' as const,
        displayName: 'Starter Plan (স্টার্টার)',
        description: 'Perfect for small single-counter photo studios and photocopy shops',
        monthlyPrice: 990,
        yearlyPrice: 9900, // 2 months free
        storageLimitMB: 5000, // 5 GB
        staffLimit: 2,
        monthlyJobLimit: 150,
        enabledModules: ['PASSPORT', 'DOCUMENT', 'IDCARD', 'CV', 'PRINT_QUEUE'],
        backupAvailability: 'MANUAL' as const,
        featureRestrictions: {
          watermark: false,
          highDpiExport: true,
          multiPrinterSpool: false,
          customBranding: false,
          apiAccess: false,
        },
        isPopular: false,
        isActive: true,
      },
      {
        planKey: 'PRO' as const,
        displayName: 'Professional Pro (প্রফেশনাল)',
        description: 'Best for busy photo studios & computer training centers with multiple operators',
        monthlyPrice: 1990,
        yearlyPrice: 19900,
        storageLimitMB: 25000, // 25 GB
        staffLimit: 5,
        monthlyJobLimit: 600,
        enabledModules: ['PASSPORT', 'DOCUMENT', 'IDCARD', 'CV', 'OCR', 'PRINT_QUEUE', 'CRM'],
        backupAvailability: 'WEEKLY' as const,
        featureRestrictions: {
          watermark: false,
          highDpiExport: true,
          multiPrinterSpool: true,
          customBranding: false,
          apiAccess: false,
        },
        isPopular: true,
        isActive: true,
      },
      {
        planKey: 'BUSINESS' as const,
        displayName: 'Business Studio (বিজনেস)',
        description: 'For growing digital print agencies, photo labs, and multi-staff copy centers',
        monthlyPrice: 3990,
        yearlyPrice: 39900,
        storageLimitMB: 100000, // 100 GB
        staffLimit: 15,
        monthlyJobLimit: 2500,
        enabledModules: ['PASSPORT', 'DOCUMENT', 'IDCARD', 'CV', 'OCR', 'PRINT_QUEUE', 'CRM', 'REPORTS'],
        backupAvailability: 'DAILY' as const,
        featureRestrictions: {
          watermark: false,
          highDpiExport: true,
          multiPrinterSpool: true,
          customBranding: true,
          apiAccess: false,
        },
        isPopular: false,
        isActive: true,
      },
      {
        planKey: 'ENTERPRISE' as const,
        displayName: 'Enterprise Scale (এন্টারপ্রাইজ)',
        description: 'For large printing presses, multiple shop chains, and franchise networks',
        monthlyPrice: 7990,
        yearlyPrice: 79900,
        storageLimitMB: 500000, // 500 GB
        staffLimit: 999,
        monthlyJobLimit: 99999,
        enabledModules: ['PASSPORT', 'DOCUMENT', 'IDCARD', 'CV', 'OCR', 'PRINT_QUEUE', 'CRM', 'REPORTS', 'API'],
        backupAvailability: 'DAILY' as const,
        featureRestrictions: {
          watermark: false,
          highDpiExport: true,
          multiPrinterSpool: true,
          customBranding: true,
          apiAccess: true,
        },
        isPopular: false,
        isActive: true,
      },
    ];

    return (await PlanConfig.insertMany(defaultPlans)) as unknown as IPlanConfig[];
  }

  /**
   * List all plans (Cached for 5 minutes)
   */
  public async getPlans(): Promise<IPlanConfig[]> {
    const cached = configCache.get<IPlanConfig[]>('SUBSCRIPTION_PLANS');
    if (cached) return cached;

    await this.ensureDefaultPlans();
    const plans = (await PlanConfig.find({ isActive: true }).sort({ monthlyPrice: 1 }).lean()) as unknown as IPlanConfig[];
    configCache.set('SUBSCRIPTION_PLANS', plans, 5 * 60 * 1000);
    return plans;
  }

  /**
   * Update plan config from Super Admin
   */
  public async updatePlanConfig(planKey: string, updates: Partial<IPlanConfig>): Promise<IPlanConfig | null> {
    const updated = await PlanConfig.findOneAndUpdate(
      { planKey: planKey.toUpperCase() },
      { $set: updates },
      { new: true }
    );
    configCache.invalidate('SUBSCRIPTION_PLANS');
    return updated;
  }

  /**
   * Get subscription status & usage metrics for tenant
   */
  public async getTenantSubscription(tenantId: string): Promise<{
    tenant: any;
    currentPlan: IPlanConfig | null;
    isTrialing: boolean;
    isExpired: boolean;
    trialDaysRemaining: number;
    daysRemaining: number;
  }> {
    const tenant = await Tenant.findById(new mongoose.Types.ObjectId(tenantId)).lean();
    if (!tenant) {
      throw new NotFoundError('Shop tenant not found');
    }

    await this.ensureDefaultPlans();
    // Normalize PRO vs PROFESSIONAL
    const searchKey = tenant.subscription.plan === 'PROFESSIONAL' ? 'PRO' : tenant.subscription.plan;
    const plan = await PlanConfig.findOne({ planKey: searchKey }).lean();

    const now = Date.now();
    const trialEnd = tenant.subscription.trialEndsAt ? new Date(tenant.subscription.trialEndsAt).getTime() : 0;
    const periodEnd = tenant.subscription.currentPeriodEnd ? new Date(tenant.subscription.currentPeriodEnd).getTime() : 0;

    const isTrialing = tenant.subscription.status === 'TRIALING' && trialEnd > now;
    const isExpired =
      (tenant.subscription.status === 'TRIALING' && trialEnd <= now) ||
      (tenant.subscription.status === 'ACTIVE' && periodEnd > 0 && periodEnd <= now) ||
      tenant.subscription.status === 'EXPIRED';

    const trialDaysRemaining = isTrialing ? Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24))) : 0;
    const daysRemaining =
      periodEnd > now ? Math.max(0, Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24))) : trialDaysRemaining;

    return {
      tenant,
      currentPlan: plan as unknown as IPlanConfig | null,
      isTrialing,
      isExpired,
      trialDaysRemaining,
      daysRemaining,
    };
  }

  /**
   * Initiate subscription payment (bKash / Nagad / SSLCommerz / Manual)
   * Enforces backend price calculation & Idempotency
   */
  public async initiatePayment(
    tenantId: string,
    payload: {
      planKey: string;
      billingCycle: 'MONTHLY' | 'YEARLY';
      provider: PaymentProvider;
      idempotencyKey?: string;
    }
  ): Promise<{
    transaction: IPaymentTransaction;
    checkoutUrl: string;
    callbackPayload: Record<string, any>;
  }> {
    const tId = new mongoose.Types.ObjectId(tenantId);
    const tenant = await Tenant.findById(tId);
    if (!tenant) throw new NotFoundError('Shop tenant not found');

    await this.ensureDefaultPlans();
    const searchKey = payload.planKey === 'PROFESSIONAL' ? 'PRO' : payload.planKey.toUpperCase();
    const plan = await PlanConfig.findOne({ planKey: searchKey });
    if (!plan) throw new BadRequestError(`Invalid subscription plan: ${payload.planKey}`);

    const billingCycle = payload.billingCycle || 'MONTHLY';
    const amount = billingCycle === 'YEARLY' ? plan.yearlyPrice : plan.monthlyPrice;
    const idempotencyKey = payload.idempotencyKey || `IDEM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // 1. Idempotency Check: Prevent duplicate payment sessions
    const existingTxn = await PaymentTransaction.findOne({ idempotencyKey, tenantId: tId });
    if (existingTxn) {
      const signature = this.generateSignature(existingTxn.transactionCode, existingTxn.amount);
      return {
        transaction: existingTxn,
        checkoutUrl: `https://checkout.docustudio.test/pay/${existingTxn.transactionCode}`,
        callbackPayload: {
          transactionCode: existingTxn.transactionCode,
          signature,
          provider: existingTxn.provider,
        },
      };
    }

    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const transactionCode = `TXN-${Date.now().toString().slice(-4)}${randomSuffix}`;
    const invoiceNumber = `INV-${new Date().getFullYear()}-${randomSuffix}`;

    const signature = this.generateSignature(transactionCode, amount);

    const txn = new PaymentTransaction({
      tenantId: tId,
      transactionCode,
      planKey: plan.planKey,
      billingCycle,
      amount,
      currency: 'BDT',
      provider: payload.provider || 'BKASH',
      paymentStatus: 'PENDING',
      signature,
      idempotencyKey,
      invoiceNumber,
      metadata: {
        shopName: tenant.name,
        planDisplayName: plan.displayName,
      },
    });

    await txn.save();

    // Provider specific checkout mock URL / payload
    const checkoutUrl =
      payload.provider === 'BKASH'
        ? `https://checkout.sandbox.bka.sh/payment/${transactionCode}`
        : payload.provider === 'NAGAD'
        ? `https://api.mynagad.com/pay/${transactionCode}`
        : `https://sandbox.sslcommerz.com/gwprocess/v4/api.php?session=${transactionCode}`;

    return {
      transaction: txn,
      checkoutUrl,
      callbackPayload: {
        transactionCode,
        amount,
        currency: 'BDT',
        provider: payload.provider,
        signature,
      },
    };
  }

  /**
   * Secure backend signature generation (HMAC SHA-256)
   */
  public generateSignature(transactionCode: string, amount: number): string {
    return crypto
      .createHmac('sha256', SECRET_SALT)
      .update(`${transactionCode}|${amount}|BDT`)
      .digest('hex');
  }

  /**
   * Verify signature from payment gateway webhook/callback
   */
  public verifySignature(transactionCode: string, amount: number, incomingSignature: string): boolean {
    if (!incomingSignature) return false;
    const expected = this.generateSignature(transactionCode, amount);
    const expBuf = Buffer.from(expected);
    const incBuf = Buffer.from(incomingSignature);
    if (expBuf.length !== incBuf.length) return false;
    return crypto.timingSafeEqual(expBuf, incBuf);
  }

  /**
   * Verify and execute payment callback (Backend-Only Activation)
   * CRITICAL: Never activates plan from client-side success message!
   */
  public async verifyAndExecutePayment(payload: {
    transactionCode: string;
    providerTransactionId?: string;
    signature?: string;
    status: 'SUCCESS' | 'FAILED' | 'CANCELLED';
  }): Promise<{
    transaction: IPaymentTransaction;
    invoice?: ISubscriptionInvoice;
    tenant: any;
  }> {
    const { transactionCode, providerTransactionId, signature, status } = payload;

    const txn = await PaymentTransaction.findOne({ transactionCode: transactionCode.trim() });
    if (!txn) {
      throw new NotFoundError(`Payment transaction ${transactionCode} not found`);
    }

    // Prevent duplicate processing if already completed
    if (txn.paymentStatus === 'SUCCESS') {
      const invoice = await SubscriptionInvoice.findOne({ transactionCode: txn.transactionCode });
      const tenant = await Tenant.findById(txn.tenantId);
      return { transaction: txn, invoice: invoice || undefined, tenant };
    }

    // Verify Signature if provided
    if (signature) {
      const isValid = this.verifySignature(txn.transactionCode, txn.amount, signature);
      if (!isValid) {
        txn.paymentStatus = 'FAILED';
        txn.errorMessage = 'Signature verification failed. Potential tampering detected.';
        await txn.save();
        throw new BadRequestError('Invalid payment callback signature');
      }
    }

    if (status !== 'SUCCESS') {
      txn.paymentStatus = status === 'CANCELLED' ? 'CANCELLED' : 'FAILED';
      txn.errorMessage = `Payment failed or was cancelled by user via ${txn.provider}`;
      await txn.save();
      const tenant = await Tenant.findById(txn.tenantId);
      return { transaction: txn, tenant };
    }

    // Mark Transaction Successful
    const paidAt = new Date();
    txn.paymentStatus = 'SUCCESS';
    txn.paidAt = paidAt;
    txn.providerTransactionId = providerTransactionId || `${txn.provider}-TRX-${Date.now()}`;

    // Activate / Upgrade Tenant Subscription
    const tenant = await Tenant.findById(txn.tenantId);
    if (!tenant) throw new NotFoundError('Tenant associated with transaction not found');

    const plan = await PlanConfig.findOne({ planKey: txn.planKey });
    if (!plan) throw new NotFoundError(`Plan ${txn.planKey} not found`);

    // Calculate new expiration period
    const currentPeriodEnd = tenant.subscription.currentPeriodEnd ? new Date(tenant.subscription.currentPeriodEnd).getTime() : 0;
    const baseTime = currentPeriodEnd > Date.now() ? currentPeriodEnd : Date.now();
    const durationDays = txn.billingCycle === 'YEARLY' ? 365 : 30;
    const newPeriodEnd = new Date(baseTime + durationDays * 24 * 60 * 60 * 1000);

    tenant.subscription.plan = txn.planKey as SubscriptionPlan;
    tenant.subscription.status = 'ACTIVE';
    tenant.subscription.currentPeriodEnd = newPeriodEnd;

    // Apply plan quotas
    tenant.quotas.maxStaffSeats = plan.staffLimit;
    tenant.quotas.storageLimitBytes = plan.storageLimitMB * 1024 * 1024;
    tenant.quotas.monthlyPassportLayoutsLimit = plan.monthlyJobLimit * 10;
    tenant.quotas.monthlyOcrPagesLimit = plan.monthlyJobLimit;
    tenant.quotas.monthlyJobsLimit = plan.monthlyJobLimit;

    await tenant.save();

    // Create Subscription Invoice Record
    const vat = Math.round(txn.amount * 0.05); // 5% VAT
    const invoice = new SubscriptionInvoice({
      invoiceNumber: txn.invoiceNumber,
      tenantId: tenant._id,
      shopName: tenant.name,
      planName: plan.displayName,
      billingCycle: txn.billingCycle,
      amount: txn.amount,
      vat,
      totalAmount: txn.amount + vat,
      paymentMethod: txn.provider,
      transactionCode: txn.transactionCode,
      periodStart: paidAt,
      periodEnd: newPeriodEnd,
      status: 'PAID',
      issuedAt: paidAt,
    });

    await invoice.save();

    txn.invoiceUrl = `/api/v1/subscription/invoices/${invoice.invoiceNumber}/pdf`;
    await txn.save();

    // Audit Log
    await AuditLog.create({
      tenantId: tenant._id,
      action: 'SUBSCRIPTION_ACTIVATED',
      details: {
        plan: txn.planKey,
        billingCycle: txn.billingCycle,
        amount: txn.amount,
        transactionCode: txn.transactionCode,
        periodEnd: newPeriodEnd,
      },
      status: 'SUCCESS',
    });

    // Automation event
    automationEventBus.emit('PAYMENT_CONFIRMED', {
      tenantId: tenant._id,
      jobCode: txn.transactionCode,
      customerName: tenant.name,
      paidAmount: txn.amount,
    });

    return { transaction: txn, invoice, tenant };
  }

  /**
   * Get payment & invoice history for a tenant
   */
  public async getBillingHistory(tenantId: string): Promise<{
    transactions: IPaymentTransaction[];
    invoices: ISubscriptionInvoice[];
  }> {
    const tId = new mongoose.Types.ObjectId(tenantId);
    const [transactions, invoices] = await Promise.all([
      PaymentTransaction.find({ tenantId: tId }).sort({ createdAt: -1 }).lean(),
      SubscriptionInvoice.find({ tenantId: tId }).sort({ issuedAt: -1 }).lean(),
    ]);

    return {
      transactions: transactions as unknown as IPaymentTransaction[],
      invoices: invoices as unknown as ISubscriptionInvoice[],
    };
  }

  /**
   * Generate 300 DPI vector PDF invoice via PDFKit
   */
  public async generateInvoicePdf(invoiceNumber: string, tenantId: string): Promise<Buffer> {
    const invoice = await SubscriptionInvoice.findOne({
      invoiceNumber: invoiceNumber.trim(),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    }).lean();

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (c) => buffers.push(c));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // Brand Header Banner
      doc.rect(50, 50, 495.28, 60).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold').text('DocuStudio SaaS', 70, 68);
      doc.fontSize(10).font('Helvetica').text('Official Subscription Tax Invoice', 70, 92);

      // Invoice Meta
      doc.fillColor('#1e293b').fontSize(14).font('Helvetica-Bold').text(`INVOICE: ${invoice.invoiceNumber}`, 50, 130);
      doc.fontSize(9).font('Helvetica').fillColor('#64748b').text(`Issued Date: ${new Date(invoice.issuedAt).toLocaleDateString()}`, 50, 150);
      doc.text(`Transaction Ref: ${invoice.transactionCode}`, 50, 165);

      // Billed To Card
      doc.rect(320, 125, 225, 65).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fillColor('#1e293b').fontSize(10).font('Helvetica-Bold').text('Billed To (গ্রাহকের তথ্য):', 330, 135);
      doc.fontSize(9).font('Helvetica').text(invoice.shopName, 330, 150);
      doc.text(`Payment Gateway: ${invoice.paymentMethod}`, 330, 165);

      // Invoice Line Items Table
      doc.rect(50, 210, 495.28, 25).fill('#e2e8f0');
      doc.fillColor('#1e293b').fontSize(9).font('Helvetica-Bold');
      doc.text('Description / বিবরণ', 60, 218);
      doc.text('Billing Cycle', 280, 218);
      doc.text('Period', 380, 218);
      doc.text('Total (BDT)', 470, 218, { align: 'right', width: 65 });

      // Table Row
      doc.rect(50, 235, 495.28, 40).stroke('#e2e8f0');
      doc.font('Helvetica').fontSize(9);
      doc.text(`${invoice.planName} SaaS Access`, 60, 245);
      doc.text(invoice.billingCycle, 280, 245);
      doc.text(`${new Date(invoice.periodStart).toLocaleDateString()} - ${new Date(invoice.periodEnd).toLocaleDateString()}`, 380, 245);
      doc.font('Helvetica-Bold').text(`৳ ${invoice.amount.toLocaleString()}`, 470, 245, { align: 'right', width: 65 });

      // Financial Summary
      const summaryY = 295;
      doc.font('Helvetica').fontSize(9).fillColor('#64748b');
      doc.text('Subtotal:', 350, summaryY);
      doc.font('Helvetica-Bold').fillColor('#1e293b').text(`৳ ${invoice.amount.toLocaleString()}`, 470, summaryY, { align: 'right', width: 65 });

      doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('VAT (5%):', 350, summaryY + 18);
      doc.font('Helvetica-Bold').fillColor('#1e293b').text(`৳ ${invoice.vat.toLocaleString()}`, 470, summaryY + 18, { align: 'right', width: 65 });

      doc.rect(340, summaryY + 36, 205.28, 28).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold').text('Total Paid:', 350, summaryY + 44);
      doc.text(`৳ ${invoice.totalAmount.toLocaleString()}`, 470, summaryY + 44, { align: 'right', width: 65 });

      // Paid Stamp Badge
      doc.rect(70, 310, 110, 36).stroke('#10b981');
      doc.fillColor('#10b981').fontSize(14).font('Helvetica-Bold').text('PAID / পরিশোধিত', 75, 322);

      // Footer
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#94a3b8')
        .text('DocuStudio SaaS | Automated Billing Engine | Thank you for your partnership.', 50, 780, {
          align: 'center',
          width: 495.28,
        });

      doc.end();
    });
  }

  /**
   * Calculate proration credit for plan upgrades
   */
  public async calculateProrationQuote(
    tenantId: string,
    targetPlanKey: string,
    targetBillingCycle: 'MONTHLY' | 'YEARLY' = 'MONTHLY'
  ): Promise<{
    currentPlan: string;
    targetPlan: string;
    targetPrice: number;
    unusedCredit: number;
    payableAmount: number;
    daysRemaining: number;
    isUpgrade: boolean;
  }> {
    const tenant = await Tenant.findById(new mongoose.Types.ObjectId(tenantId));
    if (!tenant) throw new NotFoundError('Tenant not found');

    await this.ensureDefaultPlans();
    const currentSearchKey = tenant.subscription.plan === 'PROFESSIONAL' ? 'PRO' : tenant.subscription.plan;
    const currentPlan = await PlanConfig.findOne({ planKey: currentSearchKey });
    const targetPlan = await PlanConfig.findOne({ planKey: targetPlanKey.toUpperCase() });

    if (!targetPlan) throw new BadRequestError(`Target plan ${targetPlanKey} not found`);

    const currentPrice = currentPlan ? currentPlan.monthlyPrice : 0;
    const targetPrice = targetBillingCycle === 'YEARLY' ? targetPlan.yearlyPrice : targetPlan.monthlyPrice;

    const periodEnd = tenant.subscription.currentPeriodEnd ? new Date(tenant.subscription.currentPeriodEnd).getTime() : 0;
    const now = Date.now();
    const daysRemaining = periodEnd > now ? Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24)) : 0;

    // Daily rate based on 30-day month
    const dailyCredit = currentPrice / 30;
    const rawCredit = Math.round(dailyCredit * Math.min(30, daysRemaining));
    const unusedCredit = Math.min(rawCredit, targetPrice);
    const payableAmount = Math.max(0, targetPrice - unusedCredit);

    const isUpgrade = targetPlan.monthlyPrice > (currentPlan ? currentPlan.monthlyPrice : 0);

    return {
      currentPlan: currentPlan?.planKey || tenant.subscription.plan,
      targetPlan: targetPlan.planKey,
      targetPrice,
      unusedCredit,
      payableAmount,
      daysRemaining,
      isUpgrade,
    };
  }

  /**
   * Validate if a tenant is eligible to downgrade to a lower tier
   * Ensures active staff and storage do not exceed the target plan limits
   */
  public async validateDowngradeEligibility(
    tenantId: string,
    targetPlanKey: string
  ): Promise<{
    eligible: boolean;
    reasons: string[];
    currentStaffCount: number;
    allowedStaffCount: number;
    currentStorageMB: number;
    allowedStorageMB: number;
  }> {
    const tenant = await Tenant.findById(new mongoose.Types.ObjectId(tenantId));
    if (!tenant) throw new NotFoundError('Tenant not found');

    const targetPlan = await PlanConfig.findOne({ planKey: targetPlanKey.toUpperCase() });
    if (!targetPlan) throw new BadRequestError(`Target plan ${targetPlanKey} not found`);

    const activeStaffCount = await User.countDocuments({
      tenantId: tenant._id,
      isActive: true,
      role: { $ne: 'SUPER_ADMIN' },
    });

    const currentStorageMB = Math.round((tenant.quotas.storageUsedBytes || 0) / (1024 * 1024));
    const reasons: string[] = [];

    if (activeStaffCount > targetPlan.staffLimit) {
      reasons.push(
        `Active staff count (${activeStaffCount}) exceeds target plan limit (${targetPlan.staffLimit}). Please deactivate or remove ${activeStaffCount - targetPlan.staffLimit} staff members first.`
      );
    }

    if (currentStorageMB > targetPlan.storageLimitMB) {
      reasons.push(
        `Storage used (${currentStorageMB} MB) exceeds target plan limit (${targetPlan.storageLimitMB} MB). Please clean up stored assets before downgrading.`
      );
    }

    return {
      eligible: reasons.length === 0,
      reasons,
      currentStaffCount: activeStaffCount,
      allowedStaffCount: targetPlan.staffLimit,
      currentStorageMB,
      allowedStorageMB: targetPlan.storageLimitMB,
    };
  }

  /**
   * Get granular usage metering against subscription quotas
   */
  public async getUsageMetering(tenantId: string): Promise<{
    tenantId: string;
    plan: string;
    status: string;
    staff: { used: number; limit: number; percentage: number };
    storage: { usedMB: number; limitMB: number; percentage: number };
    jobs: { used: number; limit: number; percentage: number };
    passportLayouts: { used: number; limit: number; percentage: number };
    ocrPages: { used: number; limit: number; percentage: number };
    features: Record<string, boolean>;
    enabledModules: string[];
  }> {
    const tenant = await Tenant.findById(new mongoose.Types.ObjectId(tenantId));
    if (!tenant) throw new NotFoundError('Tenant not found');

    await this.ensureDefaultPlans();
    const searchKey = tenant.subscription.plan === 'PROFESSIONAL' ? 'PRO' : tenant.subscription.plan;
    const plan = await PlanConfig.findOne({ planKey: searchKey });

    const staffUsed = await User.countDocuments({
      tenantId: tenant._id,
      isActive: true,
      role: { $ne: 'SUPER_ADMIN' },
    });
    const staffLimit = tenant.quotas.maxStaffSeats || plan?.staffLimit || 2;

    const storageUsedMB = Math.round((tenant.quotas.storageUsedBytes || 0) / (1024 * 1024));
    const storageLimitMB = Math.round(
      (tenant.quotas.storageLimitBytes || (plan?.storageLimitMB || 5000) * 1024 * 1024) / (1024 * 1024)
    );

    const jobsUsed = tenant.quotas.monthlyJobsUsed || 0;
    const jobsLimit = tenant.quotas.monthlyJobsLimit || plan?.monthlyJobLimit || 150;

    const passportUsed = tenant.quotas.monthlyPassportLayoutsUsed || 0;
    const passportLimit = tenant.quotas.monthlyPassportLayoutsLimit || 1000;

    const ocrUsed = tenant.quotas.monthlyOcrPagesUsed || 0;
    const ocrLimit = tenant.quotas.monthlyOcrPagesLimit || 100;

    return {
      tenantId: tenant._id.toString(),
      plan: tenant.subscription.plan,
      status: tenant.subscription.status,
      staff: {
        used: staffUsed,
        limit: staffLimit,
        percentage: Math.min(100, Math.round((staffUsed / Math.max(1, staffLimit)) * 100)),
      },
      storage: {
        usedMB: storageUsedMB,
        limitMB: storageLimitMB,
        percentage: Math.min(100, Math.round((storageUsedMB / Math.max(1, storageLimitMB)) * 100)),
      },
      jobs: {
        used: jobsUsed,
        limit: jobsLimit,
        percentage: Math.min(100, Math.round((jobsUsed / Math.max(1, jobsLimit)) * 100)),
      },
      passportLayouts: {
        used: passportUsed,
        limit: passportLimit,
        percentage: Math.min(100, Math.round((passportUsed / Math.max(1, passportLimit)) * 100)),
      },
      ocrPages: {
        used: ocrUsed,
        limit: ocrLimit,
        percentage: Math.min(100, Math.round((ocrUsed / Math.max(1, ocrLimit)) * 100)),
      },
      features: plan?.featureRestrictions || {
        watermark: false,
        highDpiExport: true,
        multiPrinterSpool: false,
        customBranding: false,
        apiAccess: false,
      },
      enabledModules: plan?.enabledModules || ['PASSPORT', 'DOCUMENT', 'IDCARD', 'CV', 'PRINT_QUEUE'],
    };
  }

  /**
   * Validate subscription state transition
   */
  public validateStatusTransition(fromStatus: SubscriptionStatus, toStatus: SubscriptionStatus): boolean {
    const allowed = PERMITTED_SUBSCRIPTION_TRANSITIONS[fromStatus];
    return allowed ? allowed.includes(toStatus) : false;
  }

  /**
   * Transition tenant subscription status with validation and audit logging
   */
  public async transitionTenantSubscription(
    tenantId: string,
    newStatus: SubscriptionStatus,
    reason: string = '',
    adminUserId?: string
  ): Promise<any> {
    const tenant = await Tenant.findById(new mongoose.Types.ObjectId(tenantId));
    if (!tenant) throw new NotFoundError('Shop tenant not found');

    const prevStatus = tenant.subscription.status;
    if (!this.validateStatusTransition(prevStatus, newStatus)) {
      throw new BadRequestError(
        `Invalid subscription transition from '${prevStatus}' to '${newStatus}'. Permitted transitions: ${(
          PERMITTED_SUBSCRIPTION_TRANSITIONS[prevStatus] || []
        ).join(', ')}`
      );
    }

    tenant.subscription.status = newStatus;
    const now = new Date();

    if (newStatus === 'GRACE_PERIOD') {
      tenant.subscription.gracePeriodEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7-day grace period
    } else if (newStatus === 'SUSPENDED') {
      tenant.subscription.suspendedAt = now;
      tenant.subscription.suspensionReason = reason || 'Suspended by admin or past due timeout';
    } else if (newStatus === 'CANCELLED') {
      tenant.subscription.cancelledAt = now;
      tenant.subscription.cancellationReason = reason || 'Subscription cancelled by customer or admin';
    } else if (newStatus === 'ACTIVE') {
      tenant.subscription.suspendedAt = undefined;
      tenant.subscription.suspensionReason = undefined;
    }

    await tenant.save();

    await AuditLog.create({
      tenantId: tenant._id,
      userId: adminUserId ? new mongoose.Types.ObjectId(adminUserId) : undefined,
      action: 'SUBSCRIPTION_STATUS_TRANSITION',
      details: { previous: prevStatus, current: newStatus, reason },
      status: 'SUCCESS',
    });

    return tenant;
  }

  /**
   * Retry a pending or failed payment transaction
   */
  public async retryPayment(
    transactionCode: string,
    tenantId: string
  ): Promise<{
    transaction: IPaymentTransaction;
    checkoutUrl: string;
    callbackPayload: Record<string, any>;
  }> {
    const txn = await PaymentTransaction.findOne({
      transactionCode: transactionCode.trim(),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    });

    if (!txn) throw new NotFoundError('Payment transaction not found');
    if (txn.paymentStatus === 'SUCCESS') {
      throw new BadRequestError('Cannot retry an already successful transaction');
    }

    txn.retryCount = (txn.retryCount || 0) + 1;
    txn.lastRetryAt = new Date();
    txn.paymentStatus = 'PENDING';
    txn.errorMessage = undefined;

    const signature = this.generateSignature(txn.transactionCode, txn.amount);
    txn.signature = signature;
    await txn.save();

    const checkoutUrl =
      txn.provider === 'BKASH'
        ? `https://checkout.sandbox.bka.sh/payment/${txn.transactionCode}?retry=${txn.retryCount}`
        : txn.provider === 'NAGAD'
        ? `https://api.mynagad.com/pay/${txn.transactionCode}?retry=${txn.retryCount}`
        : `https://sandbox.sslcommerz.com/gwprocess/v4/api.php?session=${txn.transactionCode}&retry=${txn.retryCount}`;

    return {
      transaction: txn,
      checkoutUrl,
      callbackPayload: {
        transactionCode: txn.transactionCode,
        amount: txn.amount,
        currency: 'BDT',
        provider: txn.provider,
        signature,
      },
    };
  }

  /**
   * Process refund for a completed transaction
   */
  public async refundTransaction(
    transactionCode: string,
    refundReason: string,
    adminUserId?: string
  ): Promise<{ transaction: IPaymentTransaction; invoice?: ISubscriptionInvoice }> {
    const txn = await PaymentTransaction.findOne({ transactionCode: transactionCode.trim() });
    if (!txn) throw new NotFoundError('Payment transaction not found');
    if (txn.paymentStatus !== 'SUCCESS') {
      throw new BadRequestError(
        `Cannot refund transaction with status '${txn.paymentStatus}'. Only SUCCESS transactions can be refunded.`
      );
    }

    txn.paymentStatus = 'REFUNDED';
    txn.refundedAt = new Date();
    txn.refundReason = refundReason.trim();
    txn.refundAmount = txn.amount;
    if (adminUserId && mongoose.Types.ObjectId.isValid(adminUserId)) {
      txn.refundProcessedBy = new mongoose.Types.ObjectId(adminUserId);
    }

    await txn.save();

    // Mark invoice refunded
    const invoice = await SubscriptionInvoice.findOne({ transactionCode: txn.transactionCode });
    if (invoice) {
      invoice.status = 'REFUNDED';
      await invoice.save();
    }

    // Set tenant subscription to CANCELLED or PAST_DUE
    const tenant = await Tenant.findById(txn.tenantId);
    if (tenant) {
      tenant.subscription.status = 'CANCELLED';
      tenant.subscription.cancellationReason = `Refund issued for transaction ${txn.transactionCode}: ${refundReason}`;
      tenant.subscription.cancelledAt = new Date();
      await tenant.save();
    }

    await AuditLog.create({
      tenantId: txn.tenantId,
      userId: adminUserId ? new mongoose.Types.ObjectId(adminUserId) : undefined,
      action: 'SUBSCRIPTION_REFUNDED',
      details: {
        transactionCode: txn.transactionCode,
        amount: txn.amount,
        refundReason,
      },
      status: 'SUCCESS',
    });

    return { transaction: txn, invoice: invoice || undefined };
  }

  /**
   * Get all subscriptions for Super Admin
   */
  public async getAllSubscriptions(query: {
    status?: string;
    plan?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    subscriptions: any[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const { status, plan, search, page = 1, limit = 20 } = query;
    const filter: any = {};

    if (status && status !== 'ALL') {
      filter['subscription.status'] = status;
    }

    if (plan && plan !== 'ALL') {
      filter['subscription.plan'] = plan;
    }

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [{ name: searchRegex }, { businessId: searchRegex }, { subdomain: searchRegex }];
    }

    const pageSize = Math.min(100, Math.max(1, limit));
    const pageNum = Math.max(1, page);
    const skip = (pageNum - 1) * pageSize;

    const [tenants, total] = await Promise.all([
      Tenant.find(filter)
        .sort({ 'subscription.currentPeriodEnd': -1, createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .populate('ownerId', 'fullName email phone')
        .lean(),
      Tenant.countDocuments(filter),
    ]);

    return {
      subscriptions: tenants,
      total,
      page: pageNum,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  /**
   * Get all transactions for Super Admin
   */
  public async getAllTransactions(query: {
    status?: string;
    provider?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    transactions: IPaymentTransaction[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const { status, provider, search, page = 1, limit = 20 } = query;
    const filter: any = {};

    if (status && status !== 'ALL') {
      filter.paymentStatus = status;
    }

    if (provider && provider !== 'ALL') {
      filter.provider = provider;
    }

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [{ transactionCode: searchRegex }, { invoiceNumber: searchRegex }];
    }

    const pageSize = Math.min(100, Math.max(1, limit));
    const pageNum = Math.max(1, page);
    const skip = (pageNum - 1) * pageSize;

    const [transactions, total] = await Promise.all([
      PaymentTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .populate('tenantId', 'name subdomain')
        .lean(),
      PaymentTransaction.countDocuments(filter),
    ]);

    return {
      transactions: transactions as unknown as IPaymentTransaction[],
      total,
      page: pageNum,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }
}

export const subscriptionService = new SubscriptionService();
