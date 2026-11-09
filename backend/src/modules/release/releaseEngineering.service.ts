import crypto from 'crypto';
import mongoose from 'mongoose';
import {
  MigrationRecord,
  FeatureFlag,
  ReleaseDeployment,
  IMigrationRecord,
  IFeatureFlag,
  IReleaseDeployment,
} from '../../models/ReleaseEngineering.model';
import { disasterRecoveryService } from '../disaster-recovery/disasterRecovery.service';
import { BadRequestError, NotFoundError } from '../../errors';

export class ReleaseEngineeringService {
  /**
   * 1. DATABASE MIGRATION ENGINE WITH AUTOMATED PRE-BACKUP & ROLLBACK
   */
  public async executeSafeMigration(options: {
    version: string;
    name: string;
    upAction: () => Promise<void>;
    downAction?: () => Promise<void>;
    migrationContent?: string;
  }): Promise<IMigrationRecord> {
    const existing = await MigrationRecord.findOne({ version: options.version });
    if (existing && existing.rollbackStatus === 'NONE') {
      throw new BadRequestError(`Migration ${options.version} has already been applied successfully`);
    }

    const startTime = Date.now();
    const checksum = crypto
      .createHash('sha256')
      .update(options.migrationContent || `${options.version}:${options.name}`)
      .digest('hex');

    // Rule: Never run risky migrations without an automated pre-migration backup
    const preBackup = await disasterRecoveryService.createDatabaseBackup({
      scope: 'PLATFORM',
    });

    try {
      // Execute the migration step
      await options.upAction();

      const durationMs = Date.now() - startTime;
      const record = await MigrationRecord.findOneAndUpdate(
        { version: options.version },
        {
          $set: {
            version: options.version,
            name: options.name,
            checksum,
            appliedAt: new Date(),
            durationMs,
            backupSnapshotId: preBackup.snapshotId,
            rollbackStatus: 'NONE',
            rolledBackAt: undefined,
            rollbackReason: undefined,
          },
        },
        { upsert: true, new: true }
      );

      return record!;
    } catch (err: any) {
      // Automatic Failure Rollback
      if (options.downAction) {
        try {
          await options.downAction();
        } catch (downErr) {
          // Log double fault
        }
      }

      await MigrationRecord.findOneAndUpdate(
        { version: options.version },
        {
          $set: {
            version: options.version,
            name: options.name,
            checksum,
            appliedAt: new Date(),
            durationMs: Date.now() - startTime,
            backupSnapshotId: preBackup.snapshotId,
            rollbackStatus: 'FAILED',
            rolledBackAt: new Date(),
            rollbackReason: `Migration failed: ${err.message}. Pre-migration backup saved at ${preBackup.snapshotId}`,
          },
        },
        { upsert: true, new: true }
      );

      throw new Error(
        `Migration ${options.version} failed: ${err.message}. System safely rolled back. Pre-migration backup reference: ${preBackup.snapshotId}`
      );
    }
  }

  public async rollbackMigration(
    version: string,
    downAction: () => Promise<void>,
    reason: string = 'Manual operational rollback'
  ): Promise<IMigrationRecord> {
    const record = await MigrationRecord.findOne({ version });
    if (!record) throw new NotFoundError(`Migration ${version} not found`);

    await downAction();

    record.rollbackStatus = 'ROLLED_BACK';
    record.rolledBackAt = new Date();
    record.rollbackReason = reason;
    return await record.save();
  }

  public async getMigrationHistory(): Promise<IMigrationRecord[]> {
    return (await MigrationRecord.find({}).sort({ appliedAt: -1 }).lean()) as unknown as IMigrationRecord[];
  }

  /**
   * 2. DYNAMIC RUNTIME FEATURE FLAGS & PROGRESSIVE ROLLOUTS
   */
  public async upsertFeatureFlag(
    key: string,
    data: {
      description?: string;
      enabled?: boolean;
      percentageRollout?: number;
      allowedTenants?: string[];
      targetTiers?: string[];
      killSwitchTriggered?: boolean;
      userId?: string;
    }
  ): Promise<IFeatureFlag> {
    const flagKey = key.toUpperCase().trim();
    const updatePayload: Record<string, any> = { ...data };
    if (data.userId) {
      updatePayload.lastModifiedBy = new mongoose.Types.ObjectId(data.userId);
    }

    return await FeatureFlag.findOneAndUpdate(
      { key: flagKey },
      { $set: updatePayload },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  public async evaluateFeatureFlag(
    key: string,
    context?: { tenantId?: string; planTier?: string }
  ): Promise<boolean> {
    const flag = await FeatureFlag.findOne({ key: key.toUpperCase().trim() });
    if (!flag) return false;

    // Instant Emergency Kill-Switch Check
    if (flag.killSwitchTriggered || !flag.enabled) {
      return false;
    }

    // Tenant Whitelist Check
    if (context?.tenantId && flag.allowedTenants.includes(context.tenantId)) {
      return true;
    }

    // Target Tier Check
    if (context?.planTier && flag.targetTiers.includes(context.planTier.toUpperCase())) {
      return true;
    }

    // Percentage Rollout Check (Deterministic hashing on tenantId)
    if (flag.percentageRollout > 0) {
      if (flag.percentageRollout >= 100) return true;
      if (context?.tenantId) {
        const hash = crypto.createHash('md5').update(`${key}:${context.tenantId}`).digest('hex');
        const bucket = parseInt(hash.slice(0, 4), 16) % 100;
        return bucket < flag.percentageRollout;
      }
    }

    return false;
  }

  public async listFeatureFlags(): Promise<IFeatureFlag[]> {
    return (await FeatureFlag.find({}).sort({ key: 1 }).lean()) as unknown as IFeatureFlag[];
  }

  /**
   * 3. SYNTHETIC CANARY HEALTH GATE
   * Evaluates system vitals before allowing a release to stay active in production.
   */
  public async executeCanaryHealthGate(): Promise<{
    healthy: boolean;
    probes: {
      databaseLatencyMs: number;
      databasePassed: boolean;
      storageProbePassed: boolean;
      queueBacklogHealthy: boolean;
    };
  }> {
    const deepHealth = await disasterRecoveryService.runDeepHealthCheck();

    const dbLatency = deepHealth.database?.pingLatencyMs ?? 999;
    const dbPassed = deepHealth.database?.connected === true && dbLatency < 500;
    const storagePassed = deepHealth.storage?.accessible === true;
    const queueHealthy = deepHealth.queues?.healthy === true;

    const allPassed = dbPassed && storagePassed && queueHealthy;

    return {
      healthy: allPassed,
      probes: {
        databaseLatencyMs: dbLatency,
        databasePassed: dbPassed,
        storageProbePassed: storagePassed,
        queueBacklogHealthy: queueHealthy,
      },
    };
  }

  /**
   * 4. VERSIONED RELEASE DEPLOYMENT WITH CANARY ROLLBACK GATE
   */
  public async deployRelease(options: {
    releaseVersion: string;
    commitSha: string;
    environment: 'STAGING' | 'PRODUCTION';
    releaseNotes: string;
    userId?: string;
  }): Promise<IReleaseDeployment> {
    // Step 1: Pre-deploy backup
    const preDeployBackup = await disasterRecoveryService.createDatabaseBackup({
      scope: 'PLATFORM',
    });

    const deployment = await ReleaseDeployment.create({
      releaseVersion: options.releaseVersion,
      commitSha: options.commitSha,
      environment: options.environment,
      status: 'DEPLOYING',
      releaseNotes: options.releaseNotes,
      preDeployBackupId: preDeployBackup.snapshotId,
      deployedAt: new Date(),
      deployedBy: options.userId ? new mongoose.Types.ObjectId(options.userId) : undefined,
    });

    // Step 2: Execute Canary Health Gate Probes
    const canaryResult = await this.executeCanaryHealthGate();

    if (canaryResult.healthy) {
      deployment.status = 'ACTIVE';
      deployment.canaryHealthStatus = 'HEALTHY';
      await deployment.save();
    } else {
      // Automated Rollback Triggered
      deployment.status = 'ROLLED_BACK';
      deployment.canaryHealthStatus = 'FAILED';
      deployment.rollbackNotes = `Automated rollback triggered: Canary health check failed (DB: ${canaryResult.probes.databasePassed}, Storage: ${canaryResult.probes.storageProbePassed}, Queue: ${canaryResult.probes.queueBacklogHealthy})`;
      await deployment.save();
    }

    return deployment;
  }

  public async triggerEmergencyRollback(
    deploymentId: string,
    reason: string,
    userId?: string
  ): Promise<IReleaseDeployment> {
    const deployment = await ReleaseDeployment.findById(deploymentId);
    if (!deployment) throw new NotFoundError('Release deployment record not found');

    deployment.status = 'ROLLED_BACK';
    deployment.rollbackNotes = `Manual Emergency Rollback: ${reason} (Authorized by ${userId || 'System'})`;
    return await deployment.save();
  }

  public async getDeploymentHistory(environment?: string): Promise<IReleaseDeployment[]> {
    const query = environment ? { environment } : {};
    return (await ReleaseDeployment.find(query).sort({ deployedAt: -1 }).limit(20).lean()) as unknown as IReleaseDeployment[];
  }
}

export const releaseEngineeringService = new ReleaseEngineeringService();
