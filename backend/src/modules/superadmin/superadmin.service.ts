import mongoose from 'mongoose';
import { Tenant, ITenant, SubscriptionPlan, SubscriptionStatus } from '../../models/Tenant.model';
import { User, IUser } from '../../models/User.model';
import { PlanConfig, PaymentTransaction, SubscriptionInvoice, IPlanConfig } from '../../models/Subscription.model';
import { Job } from '../../models/Job.model';
import { AuditLog } from '../../models/AuditLog.model';
import { PlatformSettings, IPlatformSettings } from '../../models/PlatformSettings.model';
import { BadRequestError, NotFoundError } from '../../errors';
import { subscriptionService } from '../subscription/subscription.service';
import { RolePermission } from '../../models/RolePermission.model';
import { PassportPresetModel } from '../../models/PassportPreset.model';
import { CvTemplateModel } from '../../models/CvTemplate.model';
import { ServiceItem } from '../../models/ServiceCatalog.model';
import { configCache } from '../../utils/configCache';

export class SuperAdminService {
  // ─────────────────────────────────────────────
  // 1. PLATFORM DASHBOARD ANALYTICS
  // ─────────────────────────────────────────────

  public async getDashboardStats(): Promise<Record<string, any>> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Shop Statistics
    const [totalShops, activeShops, trialShops, expiredShops, suspendedShops] = await Promise.all([
      Tenant.countDocuments(),
      Tenant.countDocuments({ 'subscription.status': 'ACTIVE', isActive: true }),
      Tenant.countDocuments({ 'subscription.status': 'TRIALING', isActive: true }),
      Tenant.countDocuments({ 'subscription.status': { $in: ['EXPIRED', 'PAST_DUE'] } }),
      Tenant.countDocuments({ isActive: false }),
    ]);

    // Revenue Statistics
    const [totalRevenuePipeline, monthlyRevenuePipeline, todayRevenuePipeline] = await Promise.all([
      PaymentTransaction.aggregate([
        { $match: { paymentStatus: 'SUCCESS' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      PaymentTransaction.aggregate([
        { $match: { paymentStatus: 'SUCCESS', paidAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      PaymentTransaction.aggregate([
        { $match: { paymentStatus: 'SUCCESS', paidAt: { $gte: startOfDay } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    const totalRevenue = totalRevenuePipeline[0]?.total || 0;
    const monthlyRevenue = monthlyRevenuePipeline[0]?.total || 0;
    const todayRevenue = todayRevenuePipeline[0]?.total || 0;

    // Payment Statistics
    const [totalPayments, successPayments, failedPayments, pendingPayments] = await Promise.all([
      PaymentTransaction.countDocuments(),
      PaymentTransaction.countDocuments({ paymentStatus: 'SUCCESS' }),
      PaymentTransaction.countDocuments({ paymentStatus: 'FAILED' }),
      PaymentTransaction.countDocuments({ paymentStatus: { $in: ['PENDING', 'INITIATED'] } }),
    ]);

    // Storage Statistics (aggregate across all tenants)
    const storagePipeline = await Tenant.aggregate([
      {
        $group: {
          _id: null,
          totalStorageUsed: { $sum: '$quotas.storageUsedBytes' },
          totalStorageLimit: { $sum: '$quotas.storageLimitBytes' },
        },
      },
    ]);
    const totalStorageUsed = storagePipeline[0]?.totalStorageUsed || 0;
    const totalStorageLimit = storagePipeline[0]?.totalStorageLimit || 0;

    // Plan Distribution
    const planDistribution = await Tenant.aggregate([
      { $group: { _id: '$subscription.plan', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Provider Distribution
    const providerDistribution = await PaymentTransaction.aggregate([
      { $match: { paymentStatus: 'SUCCESS' } },
      {
        $group: {
          _id: '$provider',
          count: { $sum: 1 },
          total: { $sum: '$amount' },
        },
      },
    ]);

    // Monthly Revenue Trend (last 6 months)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const revenueTrend = await PaymentTransaction.aggregate([
      { $match: { paymentStatus: 'SUCCESS', paidAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$paidAt' },
            month: { $month: '$paidAt' },
          },
          revenue: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Recent Activities (last 20 platform-level audit logs)
    const recentActivities = await AuditLog.find({})
      .sort({ timestamp: -1 })
      .limit(20)
      .populate('userId', 'fullName email role')
      .populate('tenantId', 'name subdomain')
      .lean();

    // Total users & jobs
    const [totalUsers, totalJobs] = await Promise.all([
      User.countDocuments(),
      Job.countDocuments(),
    ]);

    return {
      shops: {
        total: totalShops,
        active: activeShops,
        trialing: trialShops,
        expired: expiredShops,
        suspended: suspendedShops,
      },
      revenue: {
        totalRevenue,
        monthlyRevenue,
        todayRevenue,
        currency: 'BDT',
      },
      payments: {
        total: totalPayments,
        success: successPayments,
        failed: failedPayments,
        pending: pendingPayments,
      },
      storage: {
        totalUsedBytes: totalStorageUsed,
        totalLimitBytes: totalStorageLimit,
        utilizationPercent: totalStorageLimit > 0 ? Math.round((totalStorageUsed / totalStorageLimit) * 100) : 0,
      },
      planDistribution: planDistribution.map((p) => ({ plan: p._id, count: p.count })),
      providerDistribution: providerDistribution.map((p) => ({
        provider: p._id,
        count: p.count,
        totalRevenue: p.total,
      })),
      revenueTrend: revenueTrend.map((r) => ({
        year: r._id.year,
        month: r._id.month,
        revenue: r.revenue,
        transactions: r.count,
      })),
      recentActivities,
      totalUsers,
      totalJobs,
    };
  }

  // ─────────────────────────────────────────────
  // 2. SHOP MANAGEMENT (View, Approve, Suspend, Activate)
  // ─────────────────────────────────────────────

  public async getShops(query: {
    page?: number;
    limit?: number;
    status?: string;
    plan?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<{ shops: ITenant[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (query.status) {
      if (query.status === 'SUSPENDED') {
        filter.isActive = false;
      } else {
        filter['subscription.status'] = query.status.toUpperCase();
        filter.isActive = true;
      }
    }

    if (query.plan) {
      filter['subscription.plan'] = query.plan.toUpperCase();
    }

    if (query.search) {
      const regex = new RegExp(query.search, 'i');
      filter.$or = [{ name: regex }, { subdomain: regex }, { email: regex }, { phone: regex }];
    }

    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [shops, total] = await Promise.all([
      Tenant.find(filter)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      Tenant.countDocuments(filter),
    ]);

    return { shops: shops as unknown as ITenant[], total, page, limit };
  }

  public async getShopDetails(shopId: string): Promise<{
    shop: ITenant;
    owner: IUser | null;
    staffCount: number;
    jobCount: number;
    recentTransactions: any[];
    recentActivity: any[];
  }> {
    const shop = await Tenant.findById(shopId);
    if (!shop) throw new NotFoundError('Shop tenant not found');

    const [owner, staffCount, jobCount, recentTransactions, recentActivity] = await Promise.all([
      shop.ownerId ? User.findById(shop.ownerId).lean() : null,
      User.countDocuments({ tenantId: shop._id }),
      Job.countDocuments({ tenantId: shop._id }),
      PaymentTransaction.find({ tenantId: shop._id })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      AuditLog.find({ tenantId: shop._id })
        .sort({ timestamp: -1 })
        .limit(15)
        .populate('userId', 'fullName email role')
        .lean(),
    ]);

    return {
      shop,
      owner: owner as IUser | null,
      staffCount,
      jobCount,
      recentTransactions,
      recentActivity,
    };
  }

  public async suspendShop(shopId: string, adminUserId: string, reason: string): Promise<ITenant> {
    const shop = await Tenant.findById(shopId);
    if (!shop) throw new NotFoundError('Shop tenant not found');

    if (!shop.isActive) {
      throw new BadRequestError('Shop is already suspended');
    }

    shop.isActive = false;
    await shop.save();

    await AuditLog.create({
      tenantId: shop._id,
      userId: adminUserId,
      action: 'SUPERADMIN_SHOP_SUSPENDED',
      resource: 'TENANT',
      details: { shopName: shop.name, reason },
      status: 'SUCCESS',
    });

    return shop;
  }

  public async activateShop(shopId: string, adminUserId: string): Promise<ITenant> {
    const shop = await Tenant.findById(shopId);
    if (!shop) throw new NotFoundError('Shop tenant not found');

    if (shop.isActive) {
      throw new BadRequestError('Shop is already active');
    }

    shop.isActive = true;
    await shop.save();

    await AuditLog.create({
      tenantId: shop._id,
      userId: adminUserId,
      action: 'SUPERADMIN_SHOP_ACTIVATED',
      resource: 'TENANT',
      details: { shopName: shop.name },
      status: 'SUCCESS',
    });

    return shop;
  }

  public async updateShopSubscription(
    shopId: string,
    adminUserId: string,
    updates: {
      plan?: SubscriptionPlan;
      status?: SubscriptionStatus;
      currentPeriodEnd?: string;
    }
  ): Promise<ITenant> {
    const shop = await Tenant.findById(shopId);
    if (!shop) throw new NotFoundError('Shop tenant not found');

    const previousPlan = shop.subscription.plan;
    const previousStatus = shop.subscription.status;

    if (updates.plan) {
      shop.subscription.plan = updates.plan;
      // Sync quotas from plan config
      const planConfig = await PlanConfig.findOne({ planKey: updates.plan });
      if (planConfig) {
        shop.quotas.maxStaffSeats = planConfig.staffLimit;
        shop.quotas.storageLimitBytes = planConfig.storageLimitMB * 1024 * 1024;
        shop.quotas.monthlyPassportLayoutsLimit = planConfig.monthlyJobLimit * 10;
        shop.quotas.monthlyOcrPagesLimit = planConfig.monthlyJobLimit;
      }
    }

    if (updates.status) {
      shop.subscription.status = updates.status;
    }

    if (updates.currentPeriodEnd) {
      shop.subscription.currentPeriodEnd = new Date(updates.currentPeriodEnd);
    }

    await shop.save();

    await AuditLog.create({
      tenantId: shop._id,
      userId: adminUserId,
      action: 'SUPERADMIN_SUBSCRIPTION_MODIFIED',
      resource: 'TENANT',
      details: {
        shopName: shop.name,
        previousPlan,
        newPlan: shop.subscription.plan,
        previousStatus,
        newStatus: shop.subscription.status,
      },
      status: 'SUCCESS',
    });

    return shop;
  }

  // ─────────────────────────────────────────────
  // 3. PLAN MANAGEMENT (CRUD)
  // ─────────────────────────────────────────────

  public async getPlans(): Promise<IPlanConfig[]> {
    await subscriptionService.ensureDefaultPlans();
    return (await PlanConfig.find().sort({ monthlyPrice: 1 }).lean()) as unknown as IPlanConfig[];
  }

  public async createPlan(data: Partial<IPlanConfig>, adminUserId: string): Promise<IPlanConfig> {
    if (!data.planKey || !data.displayName || data.monthlyPrice == null) {
      throw new BadRequestError('planKey, displayName, and monthlyPrice are required');
    }

    const existing = await PlanConfig.findOne({ planKey: data.planKey.toUpperCase() });
    if (existing) {
      throw new BadRequestError(`Plan with key ${data.planKey} already exists`);
    }

    const plan = new PlanConfig({
      ...data,
      planKey: data.planKey.toUpperCase(),
    });
    await plan.save();
    configCache.invalidate(`plan:${plan.planKey.toUpperCase()}`);

    await AuditLog.create({
      userId: adminUserId,
      action: 'SUPERADMIN_PLAN_CREATED',
      resource: 'PLAN_CONFIG',
      details: { planKey: plan.planKey, displayName: plan.displayName },
      status: 'SUCCESS',
    });

    return plan;
  }

  public async updatePlan(planKey: string, updates: Partial<IPlanConfig>, adminUserId: string): Promise<IPlanConfig> {
    const plan = await PlanConfig.findOne({ planKey: planKey.toUpperCase() });
    if (!plan) throw new NotFoundError(`Plan ${planKey} not found`);

    const allowedFields = [
      'displayName', 'description', 'monthlyPrice', 'yearlyPrice',
      'storageLimitMB', 'staffLimit', 'monthlyJobLimit', 'enabledModules',
      'backupAvailability', 'featureRestrictions', 'isPopular', 'isActive',
    ];

    for (const field of allowedFields) {
      if ((updates as any)[field] !== undefined) {
        (plan as any)[field] = (updates as any)[field];
      }
    }

    await plan.save();
    configCache.invalidate(`plan:${plan.planKey.toUpperCase()}`);

    await AuditLog.create({
      userId: adminUserId,
      action: 'SUPERADMIN_PLAN_UPDATED',
      resource: 'PLAN_CONFIG',
      details: { planKey: plan.planKey, updates },
      status: 'SUCCESS',
    });

    return plan;
  }

  public async archivePlan(planKey: string, adminUserId: string): Promise<IPlanConfig> {
    const plan = await PlanConfig.findOne({ planKey: planKey.toUpperCase() });
    if (!plan) throw new NotFoundError(`Plan ${planKey} not found`);

    // Check if any active tenants are on this plan
    const activeTenantsOnPlan = await Tenant.countDocuments({
      'subscription.plan': planKey.toUpperCase(),
      'subscription.status': { $in: ['ACTIVE', 'TRIALING'] },
    });

    if (activeTenantsOnPlan > 0) {
      throw new BadRequestError(
        `Cannot archive plan ${planKey}: ${activeTenantsOnPlan} active tenant(s) are using it. Migrate them first.`
      );
    }

    plan.isActive = false;
    await plan.save();
    configCache.invalidate(`plan:${plan.planKey.toUpperCase()}`);

    await AuditLog.create({
      userId: adminUserId,
      action: 'SUPERADMIN_PLAN_ARCHIVED',
      resource: 'PLAN_CONFIG',
      details: { planKey: plan.planKey },
      status: 'SUCCESS',
    });

    return plan;
  }

  // ─────────────────────────────────────────────
  // 4. PAYMENT MANAGEMENT
  // ─────────────────────────────────────────────

  public async getTransactions(query: {
    page?: number;
    limit?: number;
    status?: string;
    provider?: string;
    search?: string;
  }): Promise<{ transactions: any[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (query.status) {
      filter.paymentStatus = query.status.toUpperCase();
    }

    if (query.provider) {
      filter.provider = query.provider.toUpperCase();
    }

    if (query.search) {
      const regex = new RegExp(query.search, 'i');
      filter.$or = [
        { transactionCode: regex },
        { invoiceNumber: regex },
        { providerTransactionId: regex },
      ];
    }

    const [transactions, total] = await Promise.all([
      PaymentTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('tenantId', 'name subdomain')
        .lean(),
      PaymentTransaction.countDocuments(filter),
    ]);

    return { transactions, total, page, limit };
  }

  public async getInvoices(query: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<{ invoices: any[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (query.status) filter.status = query.status.toUpperCase();

    const [invoices, total] = await Promise.all([
      SubscriptionInvoice.find(filter)
        .sort({ issuedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('tenantId', 'name subdomain')
        .lean(),
      SubscriptionInvoice.countDocuments(filter),
    ]);

    return { invoices, total, page, limit };
  }

  public async getPaymentStats(): Promise<Record<string, any>> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      monthlySuccessRevenue,
      monthlyFailedCount,
      totalRefunds,
      avgTransactionValue,
    ] = await Promise.all([
      PaymentTransaction.aggregate([
        { $match: { paymentStatus: 'SUCCESS', paidAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      PaymentTransaction.countDocuments({ paymentStatus: 'FAILED', createdAt: { $gte: startOfMonth } }),
      PaymentTransaction.countDocuments({ paymentStatus: 'CANCELLED' }),
      PaymentTransaction.aggregate([
        { $match: { paymentStatus: 'SUCCESS' } },
        { $group: { _id: null, avg: { $avg: '$amount' } } },
      ]),
    ]);

    return {
      monthlySuccessRevenue: monthlySuccessRevenue[0]?.total || 0,
      monthlySuccessCount: monthlySuccessRevenue[0]?.count || 0,
      monthlyFailedCount,
      totalRefunds,
      avgTransactionValue: Math.round(avgTransactionValue[0]?.avg || 0),
    };
  }

  // ─────────────────────────────────────────────
  // 5. PLATFORM SETTINGS
  // ─────────────────────────────────────────────

  public async ensureDefaultSettings(): Promise<void> {
    const count = await PlatformSettings.countDocuments();
    if (count > 0) return;

    const defaults: Partial<IPlatformSettings>[] = [
      // Website Settings
      { key: 'SITE_NAME', category: 'WEBSITE', value: 'DocuStudio SaaS', label: 'Platform Name', description: 'Main platform brand name', type: 'STRING' },
      { key: 'SITE_TAGLINE', category: 'WEBSITE', value: 'Smart Digital Studio Management for Bangladesh', label: 'Tagline', description: 'Marketing tagline shown on landing page', type: 'STRING' },
      { key: 'SUPPORT_EMAIL', category: 'WEBSITE', value: 'support@docustudio.io', label: 'Support Email', description: 'Customer support email address', type: 'STRING' },
      { key: 'SUPPORT_PHONE', category: 'WEBSITE', value: '+880-1700-000000', label: 'Support Phone', description: 'Customer support phone number', type: 'STRING' },

      // Email Settings
      { key: 'SMTP_HOST', category: 'EMAIL', value: 'smtp.gmail.com', label: 'SMTP Host', description: 'Outgoing email server', type: 'STRING' },
      { key: 'SMTP_PORT', category: 'EMAIL', value: 587, label: 'SMTP Port', description: 'SMTP connection port', type: 'NUMBER' },
      { key: 'EMAIL_FROM_NAME', category: 'EMAIL', value: 'DocuStudio', label: 'From Name', description: 'Sender display name for system emails', type: 'STRING' },
      { key: 'EMAIL_FROM_ADDRESS', category: 'EMAIL', value: 'noreply@docustudio.io', label: 'From Address', description: 'Sender email address', type: 'STRING' },

      // Notification Settings
      { key: 'ENABLE_EMAIL_NOTIFICATIONS', category: 'NOTIFICATION', value: true, label: 'Email Notifications', description: 'Enable system-wide email notifications', type: 'BOOLEAN' },
      { key: 'ENABLE_SMS_NOTIFICATIONS', category: 'NOTIFICATION', value: false, label: 'SMS Notifications', description: 'Enable SMS notifications (requires provider)', type: 'BOOLEAN' },
      { key: 'TRIAL_EXPIRY_REMINDER_DAYS', category: 'NOTIFICATION', value: 3, label: 'Trial Expiry Reminder', description: 'Days before trial ends to send reminder', type: 'NUMBER' },

      // Storage Settings
      { key: 'MAX_UPLOAD_SIZE_MB', category: 'STORAGE', value: 25, label: 'Max Upload Size (MB)', description: 'Maximum single file upload size', type: 'NUMBER' },
      { key: 'ALLOWED_FILE_TYPES', category: 'STORAGE', value: 'jpg,jpeg,png,pdf,webp', label: 'Allowed File Types', description: 'Comma-separated allowed extensions', type: 'STRING' },
      { key: 'AUTO_PURGE_HOURS', category: 'STORAGE', value: 24, label: 'Auto-Purge Timer (Hours)', description: 'Hours before processed files are auto-deleted', type: 'NUMBER' },

      // Security Settings
      { key: 'MAX_LOGIN_ATTEMPTS', category: 'SECURITY', value: 5, label: 'Max Login Attempts', description: 'Failed login attempts before rate limiting', type: 'NUMBER' },
      { key: 'SESSION_TIMEOUT_MINUTES', category: 'SECURITY', value: 30, label: 'Session Timeout (min)', description: 'Minutes of inactivity before session expires', type: 'NUMBER' },
      { key: 'REQUIRE_2FA_SUPERADMIN', category: 'SECURITY', value: false, label: 'Require 2FA for Admins', description: 'Mandate two-factor auth for Super Admins', type: 'BOOLEAN' },

      // Maintenance Settings
      { key: 'MAINTENANCE_MODE', category: 'MAINTENANCE', value: false, label: 'Maintenance Mode', description: 'Enable platform-wide maintenance mode', type: 'BOOLEAN' },
      { key: 'MAINTENANCE_MESSAGE', category: 'MAINTENANCE', value: 'DocuStudio is undergoing scheduled maintenance. We will be back shortly.', label: 'Maintenance Message', description: 'Message displayed during maintenance', type: 'STRING' },
    ];

    await PlatformSettings.insertMany(defaults);
  }

  public async getSettings(category?: string): Promise<IPlatformSettings[]> {
    await this.ensureDefaultSettings();
    const filter: Record<string, any> = {};
    if (category) filter.category = category.toUpperCase();
    return (await PlatformSettings.find(filter).sort({ category: 1, key: 1 }).lean()) as unknown as IPlatformSettings[];
  }

  public async updateSetting(key: string, value: any, adminUserId: string): Promise<IPlatformSettings> {
    const setting = await PlatformSettings.findOne({ key: key.toUpperCase() });
    if (!setting) throw new NotFoundError(`Platform setting ${key} not found`);

    const previousValue = setting.value;
    setting.value = value;
    setting.updatedBy = new mongoose.Types.ObjectId(adminUserId);
    await setting.save();

    await AuditLog.create({
      userId: adminUserId,
      action: 'SUPERADMIN_SETTING_UPDATED',
      resource: 'PLATFORM_SETTINGS',
      details: { key: setting.key, previousValue, newValue: value },
      status: 'SUCCESS',
    });

    return setting;
  }

  public async bulkUpdateSettings(
    updates: { key: string; value: any }[],
    adminUserId: string
  ): Promise<IPlatformSettings[]> {
    const results: IPlatformSettings[] = [];
    for (const u of updates) {
      const result = await this.updateSetting(u.key, u.value, adminUserId);
      results.push(result);
    }
    return results;
  }

  // ─────────────────────────────────────────────
  // 6. AUDIT LOG QUERIES
  // ─────────────────────────────────────────────

  public async getAuditLogs(query: {
    page?: number;
    limit?: number;
    action?: string;
    tenantId?: string;
    status?: string;
  }): Promise<{ logs: any[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 30));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (query.action) filter.action = new RegExp(query.action, 'i');
    if (query.tenantId) filter.tenantId = new mongoose.Types.ObjectId(query.tenantId);
    if (query.status) filter.status = query.status.toUpperCase();

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'fullName email role')
        .populate('tenantId', 'name subdomain')
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return { logs, total, page, limit };
  }

  // ─────────────────────────────────────────────
  // 7. DYNAMIC CONFIGURATION ENGINE
  // ─────────────────────────────────────────────

  // Role Permissions
  public async getRolePermissions(): Promise<any[]> {
    const list = await RolePermission.find().sort({ role: 1 }).lean();
    return list;
  }

  public async updateRolePermissions(
    role: string,
    permissions: string[],
    adminUserId: string
  ): Promise<any> {
    const validRole = role.toUpperCase();
    const doc = await RolePermission.findOneAndUpdate(
      { role: validRole },
      { $set: { permissions } },
      { new: true, upsert: true }
    );

    configCache.invalidate(`role_perm_${validRole}`);

    await AuditLog.create({
      userId: adminUserId,
      action: 'ROLE_PERMISSIONS_UPDATED',
      resource: 'ROLE_PERMISSION',
      details: { role: validRole, permissionsCount: permissions.length },
      status: 'SUCCESS',
    });

    return doc;
  }

  // Passport Presets
  public async getGlobalPresets(): Promise<any[]> {
    return PassportPresetModel.find({ tenantId: null }).sort({ country: 1, name: 1 }).lean();
  }

  public async upsertGlobalPreset(data: any, adminUserId: string): Promise<any> {
    const presetKey = String(data.presetKey).toLowerCase().trim();
    const widthMm = Number(data.widthMm);
    const heightMm = Number(data.heightMm);
    const widthPx = data.widthPx || Math.round((widthMm * 300) / 25.4);
    const heightPx = data.heightPx || Math.round((heightMm * 300) / 25.4);

    const preset = await PassportPresetModel.findOneAndUpdate(
      { presetKey, tenantId: null },
      {
        ...data,
        presetKey,
        tenantId: null,
        widthMm,
        heightMm,
        widthPx,
        heightPx,
        isSystem: true,
      },
      { new: true, upsert: true, runValidators: true }
    );

    configCache.invalidatePattern('passport_presets_');

    await AuditLog.create({
      userId: adminUserId,
      action: 'GLOBAL_PASSPORT_PRESET_SAVED',
      resource: 'PASSPORT_PRESET',
      details: { presetKey, country: preset.country },
      status: 'SUCCESS',
    });

    return preset;
  }

  public async deleteGlobalPreset(presetKey: string, adminUserId: string): Promise<void> {
    await PassportPresetModel.deleteOne({ presetKey: presetKey.toLowerCase(), tenantId: null });
    configCache.invalidatePattern('passport_presets_');

    await AuditLog.create({
      userId: adminUserId,
      action: 'GLOBAL_PASSPORT_PRESET_DELETED',
      resource: 'PASSPORT_PRESET',
      details: { presetKey },
      status: 'SUCCESS',
    });
  }

  // CV Templates
  public async getGlobalCvTemplates(): Promise<any[]> {
    return CvTemplateModel.find({ tenantId: null }).sort({ category: 1, name: 1 }).lean();
  }

  public async upsertGlobalCvTemplate(data: any, adminUserId: string): Promise<any> {
    const templateKey = String(data.templateKey).toUpperCase().trim();
    const template = await CvTemplateModel.findOneAndUpdate(
      { templateKey, tenantId: null },
      {
        ...data,
        templateKey,
        tenantId: null,
        isSystem: true,
      },
      { new: true, upsert: true, runValidators: true }
    );

    configCache.invalidatePattern('cv_templates_');

    await AuditLog.create({
      userId: adminUserId,
      action: 'GLOBAL_CV_TEMPLATE_SAVED',
      resource: 'CV_TEMPLATE',
      details: { templateKey, category: template.category },
      status: 'SUCCESS',
    });

    return template;
  }

  public async deleteGlobalCvTemplate(templateKey: string, adminUserId: string): Promise<void> {
    await CvTemplateModel.deleteOne({ templateKey: templateKey.toUpperCase(), tenantId: null });
    configCache.invalidatePattern('cv_templates_');

    await AuditLog.create({
      userId: adminUserId,
      action: 'GLOBAL_CV_TEMPLATE_DELETED',
      resource: 'CV_TEMPLATE',
      details: { templateKey },
      status: 'SUCCESS',
    });
  }

  // Global Service Catalog
  public async getGlobalServices(): Promise<any[]> {
    return ServiceItem.find({ tenantId: null }).sort({ category: 1, name: 1 }).lean();
  }

  public async upsertGlobalService(data: any, adminUserId: string): Promise<any> {
    const serviceCode = String(data.serviceCode).toUpperCase().trim();
    const service = await ServiceItem.findOneAndUpdate(
      { serviceCode, tenantId: null },
      {
        ...data,
        serviceCode,
        tenantId: null,
        isSystem: true,
      },
      { new: true, upsert: true, runValidators: true }
    );

    configCache.invalidatePattern('services_');

    await AuditLog.create({
      userId: adminUserId,
      action: 'GLOBAL_SERVICE_SAVED',
      resource: 'SERVICE_CATALOG',
      details: { serviceCode, unitPrice: service.unitPrice },
      status: 'SUCCESS',
    });

    return service;
  }
}

export const superAdminService = new SuperAdminService();

