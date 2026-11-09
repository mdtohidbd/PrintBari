import { Request, Response } from 'express';
import { healthService } from './health.service';
import { ApiResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';

export class HealthController {
  public check = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const health = healthService.getHealthStatus();
    const statusCode = health.status === 'UP' ? 200 : 503;
    ApiResponse.success(res, health, 'DocuStudio SaaS API is operational', statusCode);
  });
}

export const healthController = new HealthController();

