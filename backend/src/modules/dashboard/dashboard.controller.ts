import { Request, Response } from 'express';
import { dashboardService } from './dashboard.service';
import { ApiResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';

export class DashboardController {
  public getMetrics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const userRole = req.user!.role;

    const data = await dashboardService.getDashboardMetrics(tenantId, userRole);
    ApiResponse.success(res, data, 'Shop dashboard metrics calculated');
  });

  public seedDemo = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const ownerId = req.user!._id.toString();

    const result = await dashboardService.seedDemoData(tenantId, ownerId);
    ApiResponse.success(res, result, result.message);
  });
}

export const dashboardController = new DashboardController();

