import { Request, Response } from 'express';
import { analyticsService } from './analytics.service';
import { ApiResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';

export class AnalyticsController {
  public getPlatformAnalytics = asyncHandler(async (_req: Request, res: Response) => {
    const data = await analyticsService.getPlatformAnalytics();
    ApiResponse.success(res, data, 'Platform analytics retrieved successfully');
  });

  public getShopAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const days = Number(req.query.days) || 30;

    const data = await analyticsService.getShopAnalytics(tenantId, days);
    ApiResponse.success(res, data, `Shop analytics for the past ${days} days retrieved`);
  });
}

export const analyticsController = new AnalyticsController();

