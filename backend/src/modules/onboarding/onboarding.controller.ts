import { Request, Response } from 'express';
import { onboardingService } from './onboarding.service';
import { ApiResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { BadRequestError } from '../../errors';

export class OnboardingController {
  public getState = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const data = await onboardingService.getOnboardingState(tenantId);
    ApiResponse.success(res, data, 'Onboarding state retrieved successfully');
  });

  public saveStep = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const user = {
      id: req.user!.id,
      role: req.user!.role,
      fullName: req.user!.fullName || 'Studio Operator',
    };

    const step = parseInt(req.body.step, 10);
    if (isNaN(step)) {
      throw new BadRequestError('Step number must be an integer between 1 and 10.');
    }

    const payload = req.body.payload || {};
    const data = await onboardingService.saveStep(tenantId, user, step, payload);
    ApiResponse.success(res, data, `Step ${step} saved successfully`);
  });

  public skipStep = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const step = parseInt(req.body.step, 10);
    if (isNaN(step)) {
      throw new BadRequestError('Step number to skip must be an integer.');
    }

    const data = await onboardingService.skipStep(tenantId, step);
    ApiResponse.success(res, data, `Step ${step} skipped successfully`);
  });

  public seedSampleWorkspace = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const data = await onboardingService.seedSampleWorkspace(tenantId);
    ApiResponse.success(res, data, 'Sample workspace demo data seeded successfully', 201);
  });

  public purgeSampleWorkspace = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const data = await onboardingService.purgeSampleWorkspace(tenantId);
    ApiResponse.success(res, data, 'Sample workspace data purged successfully');
  });

  public importFromCSV = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const csvContent = req.body.csvContent;
    if (!csvContent) {
      throw new BadRequestError('Field "csvContent" is required.');
    }

    const data = await onboardingService.importFromCSV(tenantId, csvContent);
    ApiResponse.success(res, data, 'CSV import processed successfully');
  });

  public completeTour = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const data = await onboardingService.completeTour(tenantId);
    ApiResponse.success(res, data, 'Product tour marked as completed');
  });
}

export const onboardingController = new OnboardingController();

