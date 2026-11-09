import { Request, Response } from 'express';
import { releaseEngineeringService } from './releaseEngineering.service';
import { ApiResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { BadRequestError } from '../../errors';

export class ReleaseEngineeringController {
  // ─── Migrations ───
  public getMigrations = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const history = await releaseEngineeringService.getMigrationHistory();
    ApiResponse.success(res, history, 'Migration history retrieved');
  });

  public applyMigration = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { version, name } = req.body;
    if (!version || !name) throw new BadRequestError('version and name are required');

    const record = await releaseEngineeringService.executeSafeMigration({
      version,
      name,
      upAction: async () => {
        // Safe standard verification step
      },
    });
    ApiResponse.success(res, record, 'Migration executed safely with pre-backup', 201);
  });

  // ─── Feature Flags ───
  public listFeatureFlags = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const flags = await releaseEngineeringService.listFeatureFlags();
    ApiResponse.success(res, flags, 'Feature flags retrieved');
  });

  public upsertFeatureFlag = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const key = String(Array.isArray(req.params.key) ? req.params.key[0] : req.params.key);
    const flag = await releaseEngineeringService.upsertFeatureFlag(key, {
      ...req.body,
      userId: req.user!._id.toString(),
    });
    ApiResponse.success(res, flag, 'Feature flag saved successfully');
  });

  public evaluateFeatureFlag = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const key = String(Array.isArray(req.params.key) ? req.params.key[0] : req.params.key);
    const { tenantId, planTier } = req.query as { tenantId?: string; planTier?: string };
    const enabled = await releaseEngineeringService.evaluateFeatureFlag(key, {
      tenantId: tenantId || req.user?.tenantId?.toString(),
      planTier,
    });
    ApiResponse.success(res, { key, enabled }, 'Feature flag evaluated');
  });

  // ─── Deployments & Canary ───
  public deployRelease = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { releaseVersion, commitSha, environment, releaseNotes } = req.body;
    if (!releaseVersion || !commitSha || !environment) {
      throw new BadRequestError('releaseVersion, commitSha, and environment are required');
    }

    const deployment = await releaseEngineeringService.deployRelease({
      releaseVersion,
      commitSha,
      environment,
      releaseNotes: releaseNotes || 'Standard scheduled release',
      userId: req.user!._id.toString(),
    });
    ApiResponse.success(res, deployment, 'Release deployed with canary health gate', 201);
  });

  public rollbackDeployment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const deploymentId = String(
      Array.isArray(req.params.deploymentId) ? req.params.deploymentId[0] : req.params.deploymentId
    );
    const { reason } = req.body;
    if (!reason) throw new BadRequestError('Rollback reason is required');

    const deployment = await releaseEngineeringService.triggerEmergencyRollback(
      deploymentId,
      reason,
      req.user!._id.toString()
    );
    ApiResponse.success(res, deployment, 'Emergency rollback executed successfully');
  });

  public getDeployments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { environment } = req.query as { environment?: string };
    const history = await releaseEngineeringService.getDeploymentHistory(environment);
    ApiResponse.success(res, history, 'Deployment history retrieved');
  });

  public getCanaryStatus = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const status = await releaseEngineeringService.executeCanaryHealthGate();
    ApiResponse.success(res, status, 'Canary synthetic probe health status');
  });
}

export const releaseEngineeringController = new ReleaseEngineeringController();
