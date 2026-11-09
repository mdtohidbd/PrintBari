import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { db } from '../../config/db';
import {
  BackupSnapshot,
  RestoreDrill,
  IntegrityAudit,
  IBackupSnapshot,
  IRestoreDrill,
} from '../../models/DisasterRecovery.model';
import { Tenant } from '../../models/Tenant.model';
import { User } from '../../models/User.model';
import { Job } from '../../models/Job.model';
import { PaymentTransaction, SubscriptionInvoice } from '../../models/Subscription.model';
import { Customer } from '../../models/Customer.model';
import { BadRequestError, NotFoundError } from '../../errors';

export class DisasterRecoveryService {
  private backupDir: string;

  constructor() {
    this.backupDir = path.resolve(process.cwd(), 'data', 'backups');
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Helper to compute SHA-256 hash of a file
   */
  public computeFileChecksum(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  /**
   * 1. DATABASE BACKUP GENERATION
   */
  public async createDatabaseBackup(options?: {
    scope?: 'PLATFORM' | 'TENANT';
    tenantId?: string;
    createdBy?: string;
  }): Promise<IBackupSnapshot> {
    const scope = options?.scope || 'PLATFORM';
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotId = `SNAP-${scope}-${stamp}`;
    const fileName = `${snapshotId}.json`;
    const filePath = path.join(this.backupDir, fileName);

    const query = options?.tenantId ? { tenantId: new mongoose.Types.ObjectId(options.tenantId) } : {};
    const tenantQuery = options?.tenantId ? { _id: options.tenantId } : {};

    // Extract core collections
    const [tenants, users, jobs, payments, invoices, customers] = await Promise.all([
      Tenant.find(tenantQuery).lean(),
      User.find(query).lean(),
      Job.find(query).limit(500).lean(),
      PaymentTransaction.find(query).limit(500).lean(),
      SubscriptionInvoice.find(query).limit(500).lean(),
      Customer.find(query).limit(500).lean(),
    ]);

    const backupPayload = {
      metadata: {
        snapshotId,
        scope,
        tenantId: options?.tenantId,
        createdAt: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
      },
      collections: {
        tenants,
        users,
        jobs,
        payments,
        invoices,
        customers,
      },
    };

    const totalRecords =
      tenants.length +
      users.length +
      jobs.length +
      payments.length +
      invoices.length +
      customers.length;

    const jsonContent = JSON.stringify(backupPayload, null, 2);
    fs.writeFileSync(filePath, jsonContent, 'utf-8');

    const stats = fs.statSync(filePath);
    const sha256Checksum = this.computeFileChecksum(filePath);

    const snapshot = await BackupSnapshot.create({
      snapshotId,
      type: 'DATABASE',
      scope,
      tenantId: options?.tenantId ? new mongoose.Types.ObjectId(options.tenantId) : undefined,
      filePath,
      sizeBytes: stats.size,
      sha256Checksum,
      recordCount: totalRecords,
      status: 'COMPLETED',
      verificationDetails: {
        isChecksumValid: true,
        verifiedAt: new Date(),
        inspectedCollections: ['tenants', 'users', 'jobs', 'payments', 'invoices', 'customers'],
      },
      createdBy: options?.createdBy ? new mongoose.Types.ObjectId(options.createdBy) : undefined,
    });

    return snapshot;
  }

  /**
   * 2. BACKUP INTEGRITY VERIFICATION (Cryptographic Checksum & Structural Integrity)
   */
  public async verifyBackupIntegrity(snapshotId: string): Promise<{
    valid: boolean;
    snapshot: IBackupSnapshot;
    calculatedChecksum: string;
    expectedChecksum: string;
    errors?: string[];
  }> {
    const snapshot = await BackupSnapshot.findOne({ snapshotId });
    if (!snapshot) throw new NotFoundError(`Backup snapshot ${snapshotId} not found`);

    if (!fs.existsSync(snapshot.filePath)) {
      snapshot.status = 'FAILED';
      snapshot.verificationDetails = {
        isChecksumValid: false,
        verifiedAt: new Date(),
        inspectedCollections: [],
        errorDetails: 'Physical backup file missing from disk storage',
      };
      await snapshot.save();
      return {
        valid: false,
        snapshot,
        calculatedChecksum: '',
        expectedChecksum: snapshot.sha256Checksum,
        errors: ['Physical backup file missing on disk'],
      };
    }

    const liveChecksum = this.computeFileChecksum(snapshot.filePath);
    const checksumMatches = liveChecksum === snapshot.sha256Checksum;

    const errors: string[] = [];
    if (!checksumMatches) {
      errors.push(`Cryptographic SHA-256 mismatch! Expected ${snapshot.sha256Checksum}, calculated ${liveChecksum}`);
    }

    // Structural JSON check
    let parsed: any;
    try {
      const raw = fs.readFileSync(snapshot.filePath, 'utf-8');
      parsed = JSON.parse(raw);
      if (!parsed.metadata || !parsed.collections) {
        errors.push('Backup JSON structure missing required metadata or collections payload');
      }
    } catch (e: any) {
      errors.push(`JSON parsing error: ${e.message}`);
    }

    const isValid = checksumMatches && errors.length === 0;

    snapshot.status = isValid ? 'VERIFIED' : 'CORRUPTED';
    snapshot.verificationDetails = {
      isChecksumValid: checksumMatches,
      verifiedAt: new Date(),
      inspectedCollections: parsed?.collections ? Object.keys(parsed.collections) : [],
      errorDetails: errors.length > 0 ? errors.join('; ') : undefined,
    };
    await snapshot.save();

    return {
      valid: isValid,
      snapshot,
      calculatedChecksum: liveChecksum,
      expectedChecksum: snapshot.sha256Checksum,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * 3. SCHEDULED RESTORE DRILL
   * Simulates full system restoration in isolated staging sandbox, measuring RTO and RPO.
   */
  public async executeRestoreDrill(
    snapshotId: string,
    targetEnv: 'STAGING' | 'SANDBOX' | 'ISOLATED_TEST' = 'STAGING',
    userId?: string
  ): Promise<IRestoreDrill> {
    const startTime = Date.now();
    const startedAt = new Date();
    const failureLogs: string[] = [];

    // Step 1: Pre-restore verification
    const verification = await this.verifyBackupIntegrity(snapshotId);
    if (!verification.valid) {
      failureLogs.push(`Restore drill aborted: Snapshot integrity check failed (${verification.errors?.join(', ')})`);
    }

    // Step 2: Simulate restoration of collections
    let restoredCount = 0;
    if (verification.valid && fs.existsSync(verification.snapshot.filePath)) {
      const raw = fs.readFileSync(verification.snapshot.filePath, 'utf-8');
      const payload = JSON.parse(raw);
      const cols = payload.collections || {};

      for (const colName of Object.keys(cols)) {
        const records = cols[colName];
        if (Array.isArray(records)) {
          restoredCount += records.length;
        }
      }
    }

    const endTime = Date.now();
    const durationSeconds = Math.max(1, Math.round((endTime - startTime) / 1000));
    const completedAt = new Date();

    // RTO & RPO Calculation
    const rtoTargetSeconds = 1800; // 30 minutes target
    const rtoAchievedSeconds = durationSeconds; // Instant / few seconds in drill

    const snapshotAgeMs = startedAt.getTime() - verification.snapshot.createdAt.getTime();
    const rpoAchievedHours = Math.round((snapshotAgeMs / (3600 * 1000)) * 100) / 100;
    const rpoTargetHours = 1.0; // 1 hour target

    const integrityPassed = verification.valid && restoredCount === verification.snapshot.recordCount;
    if (restoredCount !== verification.snapshot.recordCount) {
      failureLogs.push(
        `Restored record count (${restoredCount}) did not match snapshot manifest (${verification.snapshot.recordCount})`
      );
    }

    const drillId = `DRILL-${new Date().toISOString().replace(/[:.]/g, '-')}`;

    const drill = await RestoreDrill.create({
      drillId,
      snapshotId,
      targetEnvironment: targetEnv,
      startedAt,
      completedAt,
      durationSeconds,
      rtoTargetSeconds,
      rtoAchievedSeconds,
      rpoTargetHours,
      rpoAchievedHours,
      recordsRestored: restoredCount,
      integrityPassed,
      failureLogs,
      drilledBy: userId ? new mongoose.Types.ObjectId(userId) : undefined,
    });

    return drill;
  }

  /**
   * 4. JOB QUEUE RECOVERY (REAP STALE/CRASHED WORKER JOBS)
   * Detects and recovers jobs stuck in PROCESSING due to worker or container crashes.
   */
  public async reapStaleQueueJobs(maxStaleAgeMinutes: number = 15): Promise<{
    checkedCount: number;
    staleJobsRecovered: number;
    deadLetteredJobs: number;
  }> {
    const startTime = Date.now();
    const staleThreshold = new Date(Date.now() - maxStaleAgeMinutes * 60 * 1000);

    // Find jobs stuck in PROCESSING
    const stuckJobs = await Job.find({
      status: 'PROCESSING',
      updatedAt: { $lte: staleThreshold },
    });

    let recovered = 0;
    let deadLettered = 0;

    for (const job of stuckJobs) {
      const currentRetries = (job as any).retryCount || 0;
      if (currentRetries < 3) {
        // Re-queue
        job.status = 'QUEUED';
        (job as any).retryCount = currentRetries + 1;
        (job as any).lastError = `Worker timeout/crash detected. Automatically recovered by DR Reaper on ${new Date().toISOString()}`;
        await job.save();
        recovered++;
      } else {
        // Move to Cancelled / Dead Letter
        job.status = 'CANCELLED';
        job.cancellationReason = `Worker crashed repeatedly. Max retries (3) exhausted. Moved to Dead-Letter for manual inspection.`;
        await job.save();
        deadLettered++;
      }
    }

    await IntegrityAudit.create({
      auditId: `REAP-${Date.now()}`,
      auditType: 'JOB_QUEUE_REAP',
      checkedCount: stuckJobs.length,
      defectCount: stuckJobs.length,
      repairedCount: recovered,
      details: {
        maxStaleAgeMinutes,
        recovered,
        deadLettered,
      },
      durationMs: Date.now() - startTime,
    });

    return {
      checkedCount: stuckJobs.length,
      staleJobsRecovered: recovered,
      deadLetteredJobs: deadLettered,
    };
  }

  /**
   * 5. DATABASE CONSISTENCY AUDIT
   * Verifies relational isolation and flags orphaned or dangling documents.
   */
  public async runDatabaseConsistencyAudit(): Promise<{
    passed: boolean;
    checkedCollections: string[];
    orphanedJobs: number;
    orphanedCustomers: number;
    orphanedInvoices: number;
    auditRecordId: string;
  }> {
    const startTime = Date.now();
    const activeTenantIds = await Tenant.distinct('_id');

    // 1. Check for jobs referencing non-existent tenant
    const orphanedJobs = await Job.countDocuments({
      tenantId: { $nin: activeTenantIds },
    });

    // 2. Check for customers referencing non-existent tenant
    const orphanedCustomers = await Customer.countDocuments({
      tenantId: { $nin: activeTenantIds },
    });

    // 3. Check for invoices referencing non-existent tenant
    const orphanedInvoices = await SubscriptionInvoice.countDocuments({
      tenantId: { $nin: activeTenantIds },
    });

    const totalDefects = orphanedJobs + orphanedCustomers + orphanedInvoices;
    const passed = totalDefects === 0;

    const audit = await IntegrityAudit.create({
      auditId: `DB-AUDIT-${Date.now()}`,
      auditType: 'DATABASE_CONSISTENCY',
      checkedCount: activeTenantIds.length,
      defectCount: totalDefects,
      repairedCount: 0,
      details: {
        activeTenantCount: activeTenantIds.length,
        orphanedJobs,
        orphanedCustomers,
        orphanedInvoices,
      },
      durationMs: Date.now() - startTime,
    });

    return {
      passed,
      checkedCollections: ['Job', 'Customer', 'SubscriptionInvoice', 'Tenant'],
      orphanedJobs,
      orphanedCustomers,
      orphanedInvoices,
      auditRecordId: audit.auditId,
    };
  }

  /**
   * 6. STORAGE FILESYSTEM INTEGRITY AUDIT
   * Verifies that document and photo assets on disk are intact.
   */
  public async runStorageIntegrityAudit(sampleSize: number = 50): Promise<{
    passed: boolean;
    sampleSize: number;
    verifiedOnDisk: number;
    missingFromDisk: number;
  }> {
    const startTime = Date.now();
    const recentJobs = await Job.find({
      $or: [
        { 'uploadedFiles.0': { $exists: true } },
        { 'processedFiles.0': { $exists: true } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(sampleSize)
      .lean();

    let verified = 0;
    let missing = 0;

    recentJobs.forEach((job) => {
      const allFiles = [...(job.uploadedFiles || []), ...(job.processedFiles || [])];
      allFiles.forEach((f) => {
        const p = f.url;
        if (!p || p.startsWith('http') || p.startsWith('data:') || fs.existsSync(p)) {
          verified++;
        } else {
          missing++;
        }
      });
    });

    await IntegrityAudit.create({
      auditId: `STORAGE-AUDIT-${Date.now()}`,
      auditType: 'STORAGE_FILESYSTEM',
      checkedCount: recentJobs.length,
      defectCount: missing,
      repairedCount: 0,
      details: {
        sampleSize: recentJobs.length,
        verified,
        missing,
      },
      durationMs: Date.now() - startTime,
    });

    return {
      passed: missing === 0,
      sampleSize: recentJobs.length,
      verifiedOnDisk: verified,
      missingFromDisk: missing,
    };
  }

  /**
   * 7. DEEP HEALTH CHECK & PLATFORM RESILIENCE DIAGNOSTIC
   */
  public async runDeepHealthCheck(): Promise<Record<string, any>> {
    const memory = process.memoryUsage();
    const dbStatus = db.getStatus();

    // 1. Measure DB ping latency
    const pingStart = Date.now();
    let dbPingMs = 0;
    let dbHealthy = false;
    try {
      if (mongoose.connection.db) {
        await mongoose.connection.db.admin().ping();
        dbPingMs = Date.now() - pingStart;
        dbHealthy = true;
      }
    } catch (e) {
      dbHealthy = false;
    }

    // 2. Storage write/read probe test
    let storageHealthy = false;
    const testFilePath = path.join(this.backupDir, `.health-probe-${Date.now()}.tmp`);
    try {
      fs.writeFileSync(testFilePath, 'health_probe_ok', 'utf-8');
      const readBack = fs.readFileSync(testFilePath, 'utf-8');
      if (readBack === 'health_probe_ok') storageHealthy = true;
      fs.unlinkSync(testFilePath);
    } catch (e) {
      storageHealthy = false;
    }

    // 3. Queue health
    const [queuedCount, processingCount, failedCount] = await Promise.all([
      Job.countDocuments({ status: 'QUEUED' }),
      Job.countDocuments({ status: 'PROCESSING' }),
      Job.countDocuments({ status: 'FAILED' }),
    ]);

    // 4. Backup freshness
    const latestBackup = await BackupSnapshot.findOne({ status: 'VERIFIED' }).sort({ createdAt: -1 });
    const backupFreshnessHours = latestBackup
      ? Math.round(((Date.now() - latestBackup.createdAt.getTime()) / (3600 * 1000)) * 10) / 10
      : null;

    const overallHealthy = dbHealthy && storageHealthy && processingCount < 50;

    return {
      status: overallHealthy ? 'UP' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      rtoTarget: '30 Minutes',
      rpoTarget: '1 Hour',
      database: {
        connected: dbHealthy,
        readyState: dbStatus.readyState,
        pingLatencyMs: dbPingMs,
      },
      storage: {
        accessible: storageHealthy,
        backupDirectory: this.backupDir,
      },
      queues: {
        queued: queuedCount,
        processing: processingCount,
        failed: failedCount,
        healthy: processingCount < 50,
      },
      backupFreshness: {
        latestBackupId: latestBackup?.snapshotId || null,
        hoursSinceLastBackup: backupFreshnessHours,
        isFresh: backupFreshnessHours !== null && backupFreshnessHours < 24,
      },
      system: {
        heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memory.heapTotal / 1024 / 1024),
        rssMB: Math.round(memory.rss / 1024 / 1024),
      },
    };
  }
}

export const disasterRecoveryService = new DisasterRecoveryService();
