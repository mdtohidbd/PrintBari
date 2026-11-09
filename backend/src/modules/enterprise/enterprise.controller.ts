import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { EnterpriseService } from './enterprise.service';
import { ApiResponse } from '../../utils/apiResponse';
import { BadRequestError } from '../../errors';

export class EnterpriseController {
  static updateBranding = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant!._id;
    const branding = req.body;
    const updated = await EnterpriseService.updateBranding(tenantId, branding, req.user?._id?.toString());
    ApiResponse.success(res, updated, 'Enterprise branding updated successfully');
  });

  static configureCustomDomain = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant!._id;
    const { customDomain } = req.body;
    if (!customDomain) throw new BadRequestError('customDomain is required');
    const result = await EnterpriseService.configureCustomDomain(tenantId, customDomain, req.user?._id?.toString());
    ApiResponse.success(res, result, 'Custom domain configured. Verification required.');
  });

  static verifyCustomDomain = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant!._id;
    const result = await EnterpriseService.verifyCustomDomain(tenantId, req.user?._id?.toString());
    ApiResponse.success(res, result, 'Custom domain verified and active');
  });

  static manageBranch = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant!._id;
    const { action, branchData } = req.body;
    if (!action || !['ADD', 'UPDATE', 'REMOVE'].includes(action)) {
      throw new BadRequestError('Invalid action. Must be ADD, UPDATE, or REMOVE');
    }
    const branches = await EnterpriseService.manageBranch(tenantId, action, branchData, req.user?._id?.toString());
    ApiResponse.success(res, { branches }, `Branch ${action} operation successful`);
  });

  static configureDedicatedStorage = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant!._id;
    const { enabled, s3BucketName, s3Region } = req.body;
    const result = await EnterpriseService.configureDedicatedStorage(
      tenantId,
      { enabled, s3BucketName, s3Region },
      req.user?._id?.toString()
    );
    ApiResponse.success(res, result, 'Dedicated storage settings updated');
  });

  static getUsageMetering = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant!._id;
    const period = req.query.period as string | undefined;
    const metering = await EnterpriseService.getUsageMetering(tenantId, period);
    ApiResponse.success(res, metering, 'Usage metering data retrieved');
  });

  static suspendTenant = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = (req.body.tenantId as string) || (req.params.tenantId as string) || req.tenant!._id;
    const { reason } = req.body;
    if (!reason) throw new BadRequestError('Suspension reason is required');
    const result = await EnterpriseService.suspendTenant(tenantId, reason, req.user?._id?.toString());
    ApiResponse.success(res, result, 'Tenant suspended');
  });

  static recoverTenant = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = (req.body.tenantId as string) || (req.params.tenantId as string) || req.tenant!._id;
    const result = await EnterpriseService.recoverTenant(tenantId, req.user?._id?.toString());
    ApiResponse.success(res, result, 'Tenant recovered and activated');
  });

  static exportTenantData = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant!._id;
    const exportResult = await EnterpriseService.exportTenantData(tenantId);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="tenant-${req.tenant!.businessId}-export.json"`
    );
    res.status(200).json({
      success: true,
      statusCode: 200,
      data: exportResult,
      timestamp: new Date().toISOString(),
    });
  });

  static getAuditHistory = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant!._id;
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await EnterpriseService.getTenantAuditHistory(tenantId, limit);
    ApiResponse.success(res, { logs, count: logs.length }, 'Tenant audit history retrieved');
  });
}
