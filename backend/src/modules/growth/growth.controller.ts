import { Request, Response } from 'express';
import { growthService } from './growth.service';
import { ApiResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { BadRequestError } from '../../errors';

export class GrowthController {
  // ─── Public Lead Capture & Demo Requests ───
  public captureLead = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const lead = await growthService.captureLead({
      ...req.body,
      ipAddress,
    });
    ApiResponse.success(res, lead, 'Thank you! Your inquiry has been received.', 201);
  });

  public scheduleDemo = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { leadId, demoDate, demoNotes } = req.body;
    if (!leadId || !demoDate) {
      throw new BadRequestError('leadId and demoDate are required');
    }
    const lead = await growthService.scheduleDemo(leadId, new Date(demoDate), demoNotes);
    ApiResponse.success(res, lead, 'Live product demo scheduled successfully');
  });

  public validateReferral = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const code = String(Array.isArray(req.params.code) ? req.params.code[0] : req.params.code);
    const result = await growthService.validateReferralCode(code);
    ApiResponse.success(res, result, 'Referral code evaluated');
  });

  public recordEvent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const event = await growthService.recordFunnelEvent(req.body);
    ApiResponse.success(res, event, 'Funnel event logged');
  });

  public getNurtureTemplates = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const templates = growthService.getTrialNurtureTemplates();
    ApiResponse.success(res, templates, 'Trial nurture sequence templates retrieved');
  });

  // ─── Shop Tenant Referral Portal ───
  public getMyReferralProgram = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.user!.tenantId.toString();
    const program = await growthService.ensureReferralProgram(tenantId);
    ApiResponse.success(res, program, 'Referral program retrieved');
  });

  // ─── Super Admin & Sales Pipeline CRM ───
  public getPipeline = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status, search, utmSource, page, limit } = req.query as Record<string, string>;
    const result = await growthService.getLeadPipeline({
      status,
      search,
      utmSource,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    ApiResponse.success(res, result, 'Lead pipeline retrieved');
  });

  public updateLeadStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const leadId = String(Array.isArray(req.params.leadId) ? req.params.leadId[0] : req.params.leadId);
    const { status, lossReason, convertedTenantId } = req.body;
    if (!status) throw new BadRequestError('status is required');
    const lead = await growthService.updateLeadStatus(leadId, status, lossReason, convertedTenantId);
    ApiResponse.success(res, lead, 'Lead status updated');
  });

  public addFollowUp = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const leadId = String(Array.isArray(req.params.leadId) ? req.params.leadId[0] : req.params.leadId);
    const { note, scheduledFor } = req.body;
    if (!note) throw new BadRequestError('note is required');
    const lead = await growthService.addFollowUp(
      leadId,
      note,
      scheduledFor ? new Date(scheduledFor) : undefined,
      req.user!._id.toString()
    );
    ApiResponse.success(res, lead, 'Follow-up logged successfully');
  });

  public completeDemo = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const leadId = String(Array.isArray(req.params.leadId) ? req.params.leadId[0] : req.params.leadId);
    const { outcomeNotes, status } = req.body;
    if (!outcomeNotes) throw new BadRequestError('outcomeNotes is required');
    const lead = await growthService.completeDemo(leadId, outcomeNotes, status);
    ApiResponse.success(res, lead, 'Demo marked as completed');
  });

  public getPipelineStats = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const stats = await growthService.getPipelineStatistics();
    ApiResponse.success(res, stats, 'Pipeline statistics retrieved');
  });

  public getFunnelAnalytics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { startDate, endDate } = req.query as Record<string, string>;
    const report = await growthService.getFunnelReport(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );
    ApiResponse.success(res, report, 'Marketing funnel report retrieved');
  });
}

export const growthController = new GrowthController();

