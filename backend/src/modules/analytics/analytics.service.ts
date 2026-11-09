import mongoose from 'mongoose';
import { Tenant } from '../../models/Tenant.model';
import { Job, JobServiceType } from '../../models/Job.model';
import { Customer } from '../../models/Customer.model';
import { User } from '../../models/User.model';
import { PaymentTransaction } from '../../models/Subscription.model';

export class AnalyticsService {
  /**
   * Super Admin Platform-Wide Analytics
   */
  public async getPlatformAnalytics(): Promise<Record<string, any>> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 1. Shop Statistics
    const [
      totalShops,
      activeShops,
      trialShops,
      expiredShops,
      suspendedShops,
    ] = await Promise.all([
      Tenant.countDocuments(),
      Tenant.countDocuments({ 'subscription.status': 'ACTIVE', isActive: true }),
      Tenant.countDocuments({ 'subscription.status': 'TRIALING', isActive: true }),
      Tenant.countDocuments({ 'subscription.status': { $in: ['EXPIRED', 'PAST_DUE'] } }),
      Tenant.countDocuments({ isActive: false }),
    ]);

    // 2. Revenue Aggregations
    const [
      totalRevAgg,
      monthlyRevAgg,
      todayRevAgg,
    ] = await Promise.all([
      PaymentTransaction.aggregate([
        { $match: { paymentStatus: 'SUCCESS' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      PaymentTransaction.aggregate([
        { $match: { paymentStatus: 'SUCCESS', paidAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      PaymentTransaction.aggregate([
        { $match: { paymentStatus: 'SUCCESS', paidAt: { $gte: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    const totalRevenue = totalRevAgg[0]?.total || 0;
    const monthlyRevenue = monthlyRevAgg[0]?.total || 0;
    const todayRevenue = todayRevAgg[0]?.total || 0;

    // Monthly Recurring Revenue (MRR) & Annualized Run Rate (ARR)
    const mrr = monthlyRevenue;
    const arr = monthlyRevenue * 12;
    const arpu = activeShops > 0 ? Math.round(mrr / activeShops) : 0;

    // 3. Plan Distribution
    const planDistribution = await Tenant.aggregate([
      { $group: { _id: '$subscription.plan', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // 4. Platform-Wide Usage
    const [totalPlatformJobs, totalPlatformCustomers, storageAgg] = await Promise.all([
      Job.countDocuments(),
      Customer.countDocuments(),
      Tenant.aggregate([
        {
          $group: {
            _id: null,
            totalUsedBytes: { $sum: '$quotas.storageUsedBytes' },
            totalLimitBytes: { $sum: '$quotas.storageLimitBytes' },
          },
        },
      ]),
    ]);

    const totalStorageUsedBytes = storageAgg[0]?.totalUsedBytes || 0;
    const totalStorageLimitBytes = storageAgg[0]?.totalLimitBytes || 0;

    return {
      shops: {
        total: totalShops,
        active: activeShops,
        trial: trialShops,
        expired: expiredShops,
        suspended: suspendedShops,
        activeRatePercent: totalShops > 0 ? Math.round((activeShops / totalShops) * 100) : 0,
      },
      revenue: {
        totalRevenue,
        monthlyRevenue,
        todayRevenue,
        mrr,
        arr,
        arpu,
        currency: 'BDT',
      },
      plans: planDistribution.map((p) => ({
        plan: p._id || 'FREE',
        count: p.count,
      })),
      usage: {
        totalJobs: totalPlatformJobs,
        totalCustomers: totalPlatformCustomers,
        storageUsedGB: (totalStorageUsedBytes / (1024 * 1024 * 1024)).toFixed(2),
        storageLimitGB: (totalStorageLimitBytes / (1024 * 1024 * 1024)).toFixed(0),
      },
      timestamp: new Date().toISOString(),
    };
  }

  private async resolveTenantId(tenantId: string | mongoose.Types.ObjectId): Promise<mongoose.Types.ObjectId> {
    if (tenantId instanceof mongoose.Types.ObjectId) return tenantId;
    if (mongoose.Types.ObjectId.isValid(tenantId)) return new mongoose.Types.ObjectId(tenantId);
    const tenant = await Tenant.findOne({ subdomain: tenantId }).select('_id');
    return tenant ? (tenant._id as mongoose.Types.ObjectId) : new mongoose.Types.ObjectId();
  }

  /**
   * Shop-Specific Analytics (Strict Tenant Isolated)
   */
  public async getShopAnalytics(
    tenantId: string | mongoose.Types.ObjectId,
    days: number = 30
  ): Promise<Record<string, any>> {
    const tId = await this.resolveTenantId(tenantId);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 1. Overall Job Status Breakdown
    const [
      totalJobs,
      completedJobs,
      pendingJobs,
      cancelledJobs,
      processingJobs,
    ] = await Promise.all([
      Job.countDocuments({ tenantId: tId }),
      Job.countDocuments({ tenantId: tId, status: 'COMPLETED' }),
      Job.countDocuments({
        tenantId: tId,
        status: { $in: ['PENDING', 'DRAFT', 'NEW', 'REVIEW', 'READY_FOR_REVIEW', 'QUEUED'] },
      }),
      Job.countDocuments({ tenantId: tId, status: 'CANCELLED' }),
      Job.countDocuments({ tenantId: tId, status: { $in: ['PROCESSING', 'PRINTING', 'PRINT_READY'] } }),
    ]);

    const completionRatePercent = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;

    // 2. Service-Wise Usage Breakdown
    const serviceDistributionRaw = await Job.aggregate([
      { $match: { tenantId: tId } },
      {
        $group: {
          _id: '$serviceType',
          jobCount: { $sum: 1 },
          totalRevenue: { $sum: '$paidAmount' },
        },
      },
      { $sort: { jobCount: -1 } },
    ]);

    const serviceDisplayNames: Record<string, string> = {
      PASSPORT_PHOTO: 'Passport & Visa Photos',
      DOCUMENT_A4: 'Document A4 & Multi-Page',
      ID_CARD: 'Smart NID & Identity Cards',
      CV_RESUME: 'CV, Resume & Bio-Data',
      OCR: 'Bengali Handwriting OCR',
      PRINT_ONLY: 'Direct Document Print',
      CUSTOM: 'Custom Studio Order',
    };

    const serviceWiseUsage = serviceDistributionRaw.map((s) => ({
      type: s._id || 'OTHER',
      displayName: serviceDisplayNames[s._id] || s._id,
      count: s.jobCount,
      revenue: s.totalRevenue || 0,
      percentage: totalJobs > 0 ? Math.round((s.jobCount / totalJobs) * 100) : 0,
    }));

    // 3. Staff Activity Breakdown
    const staffActivityRaw = await Job.aggregate([
      { $match: { tenantId: tId, assignedTo: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$assignedTo',
          totalAssigned: { $sum: 1 },
          completedJobs: {
            $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] },
          },
          revenueGenerated: { $sum: '$paidAmount' },
        },
      },
      { $sort: { totalAssigned: -1 } },
      { $limit: 10 },
    ]);

    const staffUserIds = staffActivityRaw.map((s) => s._id);
    const staffUsers = await User.find({ _id: { $in: staffUserIds } }).select('fullName email role').lean();
    const staffUserMap = new Map(staffUsers.map((u) => [u._id.toString(), u]));

    const staffActivity = staffActivityRaw.map((s) => {
      const u = staffUserMap.get(s._id.toString());
      return {
        staffId: s._id,
        fullName: u?.fullName || 'Assigned Staff',
        email: u?.email || 'staff@docustudio.io',
        role: u?.role || 'OPERATOR',
        totalAssigned: s.totalAssigned,
        completedJobs: s.completedJobs,
        revenueGenerated: s.revenueGenerated,
      };
    });

    // 4. Customer Growth & Repeat Ratios
    const [
      totalCustomers,
      newCustomersInPeriod,
      repeatCustomerAgg,
    ] = await Promise.all([
      Customer.countDocuments({ tenantId: tId, isActive: true }),
      Customer.countDocuments({ tenantId: tId, createdAt: { $gte: startDate }, isActive: true }),
      Customer.aggregate([
        { $match: { tenantId: tId, totalOrdersCount: { $gt: 1 } } },
        { $count: 'repeatCount' },
      ]),
    ]);

    const repeatCustomers = repeatCustomerAgg[0]?.repeatCount || 0;
    const repeatCustomerRate = totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 100) : 0;

    // 5. Daily Revenue & Order Trend (Last N days)
    const dailyTrendRaw = await Job.aggregate([
      {
        $match: {
          tenantId: tId,
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          ordersCount: { $sum: 1 },
          dailyRevenue: { $sum: '$paidAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      periodDays: days,
      overview: {
        totalJobs,
        completedJobs,
        pendingJobs,
        cancelledJobs,
        processingJobs,
        completionRatePercent,
      },
      serviceWiseUsage,
      staffActivity,
      customers: {
        totalCustomers,
        newCustomersInPeriod,
        repeatCustomers,
        repeatCustomerRate,
      },
      dailyTrend: dailyTrendRaw.map((d) => ({
        date: d._id,
        orders: d.ordersCount,
        revenue: d.dailyRevenue,
      })),
      timestamp: new Date().toISOString(),
    };
  }
}

export const analyticsService = new AnalyticsService();
