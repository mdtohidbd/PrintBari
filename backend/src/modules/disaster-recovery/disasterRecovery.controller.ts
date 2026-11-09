import { Request, Response } from 'express';
import { disasterRecoveryService } from './disasterRecovery.service';
import { ApiResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { BadRequestError } from '../../errors';

export class DisasterRecoveryController {
  // ─── Backups ───
  public createBackup = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { scope, tenantId } = req.body;
    const snapshot = await disasterRecoveryService.createDatabaseBackup({
      scope,
      tenantId,
      createdBy: req.user!._id.toString(),
    });
    ApiResponse.success(res, snapshot, 'Backup snapshot generated successfully', 201);
  });

  public verifyBackup = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const snapshotId = String(Array.isArray(req.params.snapshotId) ? req.params.snapshotId[0] : req.params.snapshotId);
    const result = await disasterRecoveryService.verifyBackupIntegrity(snapshotId);
    ApiResponse.success(res, result, 'Backup integrity verification completed');
  });

  // ─── Restore Drills ───
  public executeRestoreDrill = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { snapshotId, targetEnvironment } = req.body;
    if (!snapshotId) throw new BadRequestError('snapshotId is required for restore drill');
    const drill = await disasterRecoveryService.executeRestoreDrill(
      snapshotId,
      targetEnvironment,
      req.user!._id.toString()
    );
    ApiResponse.success(res, drill, 'Restore drill executed successfully');
  });

  // ─── Operational Resilience ───
  public reapStaleQueue = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { maxStaleAgeMinutes } = req.query as { maxStaleAgeMinutes?: string };
    const age = maxStaleAgeMinutes ? parseInt(maxStaleAgeMinutes, 10) : 15;
    const result = await disasterRecoveryService.reapStaleQueueJobs(age);
    ApiResponse.success(res, result, 'Stale job queue reaped and recovered');
  });

  public runDbAudit = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const result = await disasterRecoveryService.runDatabaseConsistencyAudit();
    ApiResponse.success(res, result, 'Database consistency audit completed');
  });

  public runStorageAudit = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sampleSize } = req.query as { sampleSize?: string };
    const size = sampleSize ? parseInt(sampleSize, 10) : 50;
    const result = await disasterRecoveryService.runStorageIntegrityAudit(size);
    ApiResponse.success(res, result, 'Storage filesystem audit completed');
  });

  public getDeepHealth = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const health = await disasterRecoveryService.runDeepHealthCheck();
    ApiResponse.success(res, health, 'Deep resilience diagnostic retrieved');
  });
}

export const disasterRecoveryController = new DisasterRecoveryController();

