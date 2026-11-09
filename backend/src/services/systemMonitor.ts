import os from 'os';
import { db } from '../config/db';
import { Tenant } from '../models/Tenant.model';
import { Job } from '../models/Job.model';
import { PaymentTransaction } from '../models/Subscription.model';
import { backgroundWorker } from './backgroundWorker';

export interface ApiMetricSample {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  timestamp: Date;
  error?: string;
}

export class SystemMonitor {
  private static instance: SystemMonitor;
  private recentRequests: ApiMetricSample[] = [];
  private totalRequests = 0;
  private total4xxErrors = 0;
  private total5xxErrors = 0;
  private recentErrors: Array<{ timestamp: Date; path: string; message: string; statusCode: number }> = [];

  private constructor() {}

  public static getInstance(): SystemMonitor {
    if (!SystemMonitor.instance) {
      SystemMonitor.instance = new SystemMonitor();
    }
    return SystemMonitor.instance;
  }

  /**
   * Record HTTP request metric from middleware
   */
  public recordMetric(method: string, path: string, statusCode: number, durationMs: number, errorMsg?: string) {
    this.totalRequests++;

    if (statusCode >= 500) {
      this.total5xxErrors++;
      this.recentErrors.unshift({
        timestamp: new Date(),
        path: `${method} ${path}`,
        message: errorMsg || `Internal Server Error (${statusCode})`,
        statusCode,
      });
      if (this.recentErrors.length > 50) this.recentErrors.pop();
    } else if (statusCode >= 400) {
      this.total4xxErrors++;
    }

    this.recentRequests.push({
      method,
      path,
      statusCode,
      durationMs,
      timestamp: new Date(),
      error: errorMsg,
    });

    // Retain rolling window of 1,000 samples
    if (this.recentRequests.length > 1000) {
      this.recentRequests.shift();
    }
  }

  /**
   * Aggregate complete platform monitoring telemetry
   */
  public async getMonitoringMetrics(): Promise<Record<string, any>> {
    const memory = process.memoryUsage();
    const dbStatus = db.getStatus();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 1. API Latency & Error Rates
    const sampleCount = this.recentRequests.length;
    let avgLatencyMs = 0;
    let slowRequestsCount = 0;

    if (sampleCount > 0) {
      const sumLatency = this.recentRequests.reduce((acc, r) => acc + r.durationMs, 0);
      avgLatencyMs = Math.round(sumLatency / sampleCount);
      slowRequestsCount = this.recentRequests.filter((r) => r.durationMs > 1000).length;
    }

    const errorRatePercent =
      this.totalRequests > 0
        ? Number((((this.total4xxErrors + this.total5xxErrors) / this.totalRequests) * 100).toFixed(2))
        : 0;

    // 2. Database Connection & Replica Stats
    const dbConnected = dbStatus.isConnected;
    const dbReadyState = dbStatus.readyState;

    // 3. Background Processing Worker Monitoring
    const workerCapacity = backgroundWorker.getCapacity?.() || {
      maxConcurrent: 4,
      activeWorkers: 0,
      queuedJobs: 0,
    };

    const [
      activeProcessingJobs,
      queuedJobsCount,
      failedJobsCount,
    ] = await Promise.all([
      Job.countDocuments({ status: { $in: ['PROCESSING', 'PRINTING'] } }),
      Job.countDocuments({ status: 'QUEUED' }),
      Job.countDocuments({ status: 'CANCELLED', createdAt: { $gte: startOfToday } }),
    ]);

    // 4. Storage Quota Monitoring (Tenants exceeding 85% capacity threshold)
    const storageAlertThreshold = 0.85;
    const highStorageTenants = await Tenant.find({
      $expr: {
        $gt: [
          '$quotas.storageUsedBytes',
          { $multiply: ['$quotas.storageLimitBytes', storageAlertThreshold] },
        ],
      },
    })
      .select('name subdomain quotas')
      .lean();

    const storageAlerts = highStorageTenants.map((t) => ({
      tenantId: t._id,
      shopName: t.name,
      subdomain: t.subdomain,
      usedMB: (t.quotas.storageUsedBytes / (1024 * 1024)).toFixed(1),
      limitMB: (t.quotas.storageLimitBytes / (1024 * 1024)).toFixed(1),
      usagePercent: Math.round((t.quotas.storageUsedBytes / t.quotas.storageLimitBytes) * 100),
      severity: t.quotas.storageUsedBytes >= t.quotas.storageLimitBytes ? 'CRITICAL' : 'WARNING',
    }));

    // 5. Payment Failure Alerts
    const recentFailedTransactions = await PaymentTransaction.find({
      paymentStatus: 'FAILED',
      createdAt: { $gte: startOfToday },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('tenantId', 'name subdomain')
      .lean();

    const paymentFailureRateAgg = await PaymentTransaction.aggregate([
      { $match: { createdAt: { $gte: startOfToday } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          failed: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'FAILED'] }, 1, 0] },
          },
        },
      },
    ]);

    const totalTodayTx = paymentFailureRateAgg[0]?.total || 0;
    const failedTodayTx = paymentFailureRateAgg[0]?.failed || 0;
    const paymentFailureRatePercent =
      totalTodayTx > 0 ? Number(((failedTodayTx / totalTodayTx) * 100).toFixed(1)) : 0;

    return {
      server: {
        status: dbConnected ? 'UP' : 'DEGRADED',
        environment: process.env.NODE_ENV || 'production',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: now.toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        memory: {
          heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(memory.heapTotal / 1024 / 1024),
          rssMB: Math.round(memory.rss / 1024 / 1024),
          systemFreeMB: Math.round(os.freemem() / 1024 / 1024),
          systemTotalMB: Math.round(os.totalmem() / 1024 / 1024),
        },
      },
      api: {
        totalRequests: this.totalRequests,
        total4xxErrors: this.total4xxErrors,
        total5xxErrors: this.total5xxErrors,
        errorRatePercent,
        avgLatencyMs,
        slowRequestsCount,
        recentErrors: this.recentErrors.slice(0, 10),
      },
      database: {
        type: 'MongoDB Atlas',
        connected: dbConnected,
        readyState: dbReadyState,
      },
      backgroundWorkers: {
        maxConcurrent: workerCapacity.maxConcurrent || 4,
        activeWorkers: activeProcessingJobs,
        queuedJobs: queuedJobsCount,
        failedJobsToday: failedJobsCount,
      },
      storageAlerts: {
        thresholdPercent: 85,
        alertCount: storageAlerts.length,
        tenantsAtRisk: storageAlerts,
      },
      paymentAlerts: {
        failedTransactionsToday: failedTodayTx,
        failureRatePercent: paymentFailureRatePercent,
        recentFailures: recentFailedTransactions.map((tx) => ({
          transactionCode: tx.transactionCode,
          provider: tx.provider,
          amount: tx.amount,
          errorReason: tx.metadata?.error || 'Provider Gateway Reject',
          timestamp: tx.createdAt,
        })),
      },
    };
  }
}

export const systemMonitor = SystemMonitor.getInstance();

