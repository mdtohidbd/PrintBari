import { Request, Response } from 'express';
import { privacyService } from './privacy.service';
import { ApiResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { BadRequestError } from '../../errors';

export class PrivacyController {
  public recordConsent = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const user = {
      id: req.user!.id,
      fullName: req.user!.fullName || 'Studio Operator',
    };

    const data = await privacyService.recordConsent(tenantId, user, req.body);
    ApiResponse.success(res, data, 'Citizen consent record created successfully', 201);
  });

  public getConsentStatus = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const phone = req.params.phone as string;
    if (!phone) {
      throw new BadRequestError('Phone number parameter is required');
    }

    const data = await privacyService.getConsentStatus(tenantId, phone);
    ApiResponse.success(res, data, 'Consent records retrieved successfully');
  });

  public revokeConsent = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const user = {
      id: req.user!.id,
      fullName: req.user!.fullName || 'Studio Operator',
    };

    const data = await privacyService.revokeConsent(tenantId, user, req.body);
    ApiResponse.success(res, data, 'Citizen consent withdrawn successfully');
  });

  public createDSR = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const data = await privacyService.createDSR(tenantId, req.body);
    ApiResponse.success(res, data, 'Data subject request submitted successfully', 201);
  });

  public verifyDSR = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const { requestNumber, verificationCode } = req.body;
    if (!requestNumber || !verificationCode) {
      throw new BadRequestError('Request number and verification OTP code are required.');
    }

    const data = await privacyService.verifyDSR(tenantId, requestNumber, verificationCode);
    ApiResponse.success(res, data, 'Data subject request verified successfully');
  });

  public listDSRs = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const status = req.query.status as string | undefined;
    const data = await privacyService.listDSRs(tenantId, status);
    ApiResponse.success(res, data, 'Data subject requests retrieved successfully');
  });

  public processDSR = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const user = {
      id: req.user!.id,
      role: req.user!.role,
      fullName: req.user!.fullName || 'Studio Manager',
    };
    const requestId = req.params.id as string;
    const { action, rejectionReason, correctionData } = req.body;

    if (!action || !['COMPLETE', 'REJECT'].includes(action)) {
      throw new BadRequestError('Action must be either COMPLETE or REJECT.');
    }

    const data = await privacyService.processDSR(tenantId, user, requestId, action, {
      rejectionReason,
      correctionData,
    });
    ApiResponse.success(res, data, `Data subject request ${action.toLowerCase()}d successfully`);
  });

  public exportCitizenData = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const phone = req.params.phone as string;
    if (!phone) {
      throw new BadRequestError('Citizen phone number is required.');
    }

    const data = await privacyService.exportCitizenData(tenantId, phone);
    ApiResponse.success(res, data, 'Machine-readable citizen data package generated successfully');
  });

  public executeRetentionPurge = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const olderThanHours = req.body.olderThanHours ? Number(req.body.olderThanHours) : 24;

    const data = await privacyService.executeRetentionPurge(tenantId, olderThanHours);
    ApiResponse.success(res, data, 'Retention file purge executed successfully');
  });

  public getPrivacyNoticeVersions = asyncHandler(async (_req: Request, res: Response) => {
    const data = await privacyService.getPrivacyNoticeVersions();
    ApiResponse.success(res, data, 'Privacy notice versions retrieved successfully');
  });
}

export const privacyController = new PrivacyController();

