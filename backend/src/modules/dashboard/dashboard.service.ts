import mongoose from 'mongoose';
import { Job, IJob, JobStatus } from '../../models/Job.model';
import { Customer } from '../../models/Customer.model';
import { AuditLog } from '../../models/AuditLog.model';
import { Tenant } from '../../models/Tenant.model';
import { User } from '../../models/User.model';

export class DashboardService {
  /**
   * Calculate live shop metrics from MongoDB
   */
  public async getDashboardMetrics(tenantId: string | mongoose.Types.ObjectId, userRole: string) {
    const tId = new mongoose.Types.ObjectId(tenantId);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. Job counts
    const [
      totalJobs,
      pendingJobs,
      completedJobs,
      todayOrders,
      totalCustomers,
      tenant,
    ] = await Promise.all([
      Job.countDocuments({ tenantId: tId }),
      Job.countDocuments({
        tenantId: tId,
        status: { $in: ['PENDING', 'PROCESSING', 'REVIEW', 'PRINT_READY'] },
      }),
      Job.countDocuments({ tenantId: tId, status: 'COMPLETED' }),
      Job.countDocuments({ tenantId: tId, createdAt: { $gte: startOfToday } }),
      Customer.countDocuments({ tenantId: tId, isActive: true }),
      Tenant.findById(tId),
    ]);

    // 2. Financial Metrics (Role-guarded: Only OWNER & MANAGER see full revenue)
    let monthlyRevenue = 0;
    let todayRevenue = 0;

    const canViewFinancials = ['SUPER_ADMIN', 'OWNER', 'MANAGER'].includes(userRole);

    if (canViewFinancials) {
      // Monthly Revenue
      const monthlyAgg = await Job.aggregate([
        { $match: { tenantId: tId, createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$paidAmount' } } },
      ]);
      monthlyRevenue = monthlyAgg[0]?.total || 0;

      // Today's Revenue
      const todayAgg = await Job.aggregate([
        { $match: { tenantId: tId, createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$paidAmount' } } },
      ]);
      todayRevenue = todayAgg[0]?.total || 0;
    }

    // 3. Status Distribution Breakdown
    const statusCountsRaw = await Job.aggregate([
      { $match: { tenantId: tId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const statusDistribution: Record<JobStatus, number> = {
      DRAFT: 0,
      NEW: 0,
      PENDING: 0,
      PROCESSING: 0,
      READY_FOR_REVIEW: 0,
      REVIEW: 0,
      APPROVED: 0,
      QUEUED: 0,
      PRINTING: 0,
      PRINT_READY: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };

    statusCountsRaw.forEach((item) => {
      if (item._id && statusDistribution.hasOwnProperty(item._id)) {
        statusDistribution[item._id as JobStatus] = item.count;
      }
    });

    // 4. Recent Jobs (latest 6)
    const recentJobs = await Job.find({ tenantId: tId })
      .sort({ createdAt: -1 })
      .limit(6)
      .populate('assignedTo', 'fullName role')
      .lean();

    // 5. Recent Shop Activities (Audit Logs)
    const recentActivities = await AuditLog.find({ tenantId: tId })
      .sort({ timestamp: -1 })
      .limit(8)
      .populate('userId', 'fullName role')
      .lean();

    // 6. Storage usage details
    const storageUsedBytes = tenant?.quotas.storageUsedBytes || 0;
    const storageLimitBytes = tenant?.quotas.storageLimitBytes || 25 * 1024 * 1024 * 1024;
    const storagePercent = Math.min(100, Math.round((storageUsedBytes / storageLimitBytes) * 100));

    return {
      metrics: {
        totalJobs,
        pendingJobs,
        completedJobs,
        todayOrders,
        totalCustomers,
        monthlyRevenue: canViewFinancials ? monthlyRevenue : null,
        todayRevenue: canViewFinancials ? todayRevenue : null,
        canViewFinancials,
      },
      storage: {
        usedBytes: storageUsedBytes,
        limitBytes: storageLimitBytes,
        usedMB: (storageUsedBytes / (1024 * 1024)).toFixed(2),
        limitGB: (storageLimitBytes / (1024 * 1024 * 1024)).toFixed(0),
        percentUsed: storagePercent,
      },
      statusDistribution,
      recentJobs,
      recentActivities,
      shop: {
        name: tenant?.name,
        businessId: tenant?.businessId,
        currency: tenant?.settings.currency || 'USD',
        plan: tenant?.subscription.plan,
        status: tenant?.subscription.status,
      },
    };
  }

  /**
   * Seed realistic sample walk-in orders & customers for a shop if empty
   */
  public async seedDemoData(tenantId: string | mongoose.Types.ObjectId, ownerId?: string) {
    const tId = new mongoose.Types.ObjectId(tenantId);

    // Only seed if zero jobs exist
    const count = await Job.countDocuments({ tenantId: tId });
    if (count > 0) {
      return { message: 'Shop already has active orders; skipping demo seed' };
    }

    // 1. Create sample customers
    const customer1 = await Customer.create({
      tenantId: tId,
      fullName: 'Kamal Hossain',
      phone: '+880 1711 234567',
      email: 'kamal@example.com',
      totalOrdersCount: 2,
      totalSpent: 9.5,
      lastVisitAt: new Date(),
    });

    const customer2 = await Customer.create({
      tenantId: tId,
      fullName: 'Sumona Akter',
      phone: '+880 1819 876543',
      email: 'sumona@example.com',
      totalOrdersCount: 1,
      totalSpent: 4.0,
      lastVisitAt: new Date(Date.now() - 3600000),
    });

    const customer3 = await Customer.create({
      tenantId: tId,
      fullName: 'Rashid Khan',
      phone: '+880 1912 345678',
      email: 'rashid.khan@example.com',
      totalOrdersCount: 3,
      totalSpent: 18.0,
      lastVisitAt: new Date(Date.now() - 7200000),
    });

    // 2. Create sample jobs
    const sampleJobs = [
      {
        tenantId: tId,
        jobCode: 'JOB-1001',
        customerId: customer1._id,
        customerName: customer1.fullName,
        customerPhone: customer1.phone,
        serviceType: 'PASSPORT_PHOTO',
        status: 'PRINT_READY',
        priority: 'URGENT',
        copies: 8,
        paperType: '4x6 Glossy Photo Paper',
        totalAmount: 5.5,
        paidAmount: 5.5,
        paymentStatus: 'PAID',
        paymentMethod: 'CASH',
        notes: 'US Visa 2x2 specification, white background',
      },
      {
        tenantId: tId,
        jobCode: 'JOB-1002',
        customerId: customer2._id,
        customerName: customer2.fullName,
        customerPhone: customer2.phone,
        serviceType: 'ID_CARD_A4',
        status: 'PROCESSING',
        priority: 'NORMAL',
        copies: 4,
        paperType: 'A4 Plain 80gsm',
        totalAmount: 4.0,
        paidAmount: 4.0,
        paymentStatus: 'PAID',
        paymentMethod: 'UPI_BKASH',
        notes: 'Front and Back Smart NID card combined on 1 page',
      },
      {
        tenantId: tId,
        jobCode: 'JOB-1003',
        customerId: customer3._id,
        customerName: customer3.fullName,
        customerPhone: customer3.phone,
        serviceType: 'CV_BUILDER',
        status: 'COMPLETED',
        priority: 'NORMAL',
        copies: 2,
        paperType: 'A4 Executive Bond',
        totalAmount: 8.0,
        paidAmount: 8.0,
        paymentStatus: 'PAID',
        paymentMethod: 'CASH',
        completedAt: new Date(),
        notes: 'Driver job bio-data in English and Bengali',
      },
      {
        tenantId: tId,
        jobCode: 'JOB-1004',
        customerId: customer1._id,
        customerName: customer1.fullName,
        customerPhone: customer1.phone,
        serviceType: 'DOCUMENT_A4',
        status: 'REVIEW',
        priority: 'NORMAL',
        copies: 1,
        paperType: 'A4 Plain',
        totalAmount: 4.0,
        paidAmount: 0,
        paymentStatus: 'UNPAID',
        notes: 'Academic certificate dewarping and contrast boost',
      },
      {
        tenantId: tId,
        jobCode: 'JOB-1005',
        customerName: 'Fatima Begum',
        customerPhone: '+880 1515 998877',
        serviceType: 'HANDWRITING_OCR',
        status: 'PENDING',
        priority: 'NORMAL',
        copies: 1,
        paperType: 'Digital .docx download',
        totalAmount: 6.0,
        paidAmount: 6.0,
        paymentStatus: 'PAID',
        paymentMethod: 'CASH',
        notes: 'Convert 3 handwritten legal pages to Word',
      },
    ];

    await Job.insertMany(sampleJobs);

    // Record audit log
    await AuditLog.create({
      tenantId: tId,
      action: 'DEMO_DATA_SEEDED',
      details: { ordersCreated: sampleJobs.length, customersCreated: 3 },
      status: 'SUCCESS',
    });

    return { message: '5 realistic demo jobs and 3 customers successfully populated' };
  }
}

export const dashboardService = new DashboardService();

