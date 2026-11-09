import { Request, Response } from 'express';
import { systemMonitor } from '../../services/systemMonitor';
import { ApiResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';

export class MonitoringController {
  public getMetrics = asyncHandler(async (_req: Request, res: Response) => {
    const metrics = await systemMonitor.getMonitoringMetrics();
    ApiResponse.success(res, metrics, 'Real-time system monitoring telemetry retrieved');
  });
}

export const monitoringController = new MonitoringController();

