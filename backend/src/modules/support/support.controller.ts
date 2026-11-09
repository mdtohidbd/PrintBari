import { Request, Response } from 'express';
import { supportService } from './support.service';
import { CustomerSuccessService } from './customerSuccess.service';
import { ApiResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { BadRequestError } from '../../errors';

export class SupportController {
  public createTicket = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const user = {
      id: req.user!.id,
      fullName: req.user!.fullName || 'Studio Operator',
      role: req.user!.role,
    };

    const { subject, category, priority, initialMessage, attachments } = req.body;
    if (!subject || !initialMessage) {
      throw new BadRequestError('Subject and initial message are required');
    }

    const ticket = await supportService.createTicket(tenantId, user, {
      subject,
      category,
      priority,
      initialMessage,
      attachments,
    });

    ApiResponse.success(res, ticket, 'Support ticket created successfully', 201);
  });

  public listTickets = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const userRole = req.user!.role;

    const data = await supportService.listTickets(tenantId, userRole, req.query);
    ApiResponse.success(res, data, 'Support tickets retrieved successfully');
  });

  public getTicketById = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const userRole = req.user!.role;
    const id = req.params.id as string;

    const ticket = await supportService.getTicketById(tenantId, userRole, id);
    ApiResponse.success(res, ticket, 'Support ticket details retrieved');
  });

  public addReply = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const user = {
      id: req.user!.id,
      fullName: req.user!.fullName || 'Support Participant',
      role: req.user!.role,
    };
    const id = req.params.id as string;
    const { message, isInternalNote, attachments } = req.body;

    if (!message) {
      throw new BadRequestError('Reply message cannot be empty');
    }

    const updated = await supportService.addReply(tenantId, user, id, {
      message,
      isInternalNote,
      attachments,
    });

    ApiResponse.success(res, updated, 'Reply added to ticket');
  });

  public updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const user = {
      id: req.user!.id,
      fullName: req.user!.fullName || 'Support Participant',
      role: req.user!.role,
    };
    const id = req.params.id as string;
    const { status } = req.body;

    if (!status) {
      throw new BadRequestError('Target status is required');
    }

    const updated = await supportService.updateTicketStatus(tenantId, user, id, status);
    ApiResponse.success(res, updated, `Ticket status updated to ${status}`);
  });

  public assignTicket = asyncHandler(async (req: Request, res: Response) => {
    const user = {
      id: req.user!.id,
      fullName: req.user!.fullName || 'Super Admin',
      role: req.user!.role,
    };
    const id = req.params.id as string;
    const { assigneeId } = req.body;

    if (!assigneeId) {
      throw new BadRequestError('Assignee ID is required');
    }

    const updated = await supportService.assignTicket(user, id, assigneeId);
    ApiResponse.success(res, updated, 'Ticket assigned successfully');
  });

  public getArticles = asyncHandler(async (req: Request, res: Response) => {
    const { category, search } = req.query as { category?: string; search?: string };
    const articles = await supportService.getHelpArticles(category, search);
    ApiResponse.success(res, articles, 'Help center articles retrieved');
  });

  // Customer Success & CSAT
  public recordFeedback = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant!._id;
    const userId = req.user!._id;
    const result = await CustomerSuccessService.recordFeedback(tenantId, userId, req.body);
    ApiResponse.created(res, result, 'Feedback recorded successfully');
  });

  public listFeedback = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant!._id;
    const result = await CustomerSuccessService.listFeedback(tenantId);
    ApiResponse.success(res, result, 'Feedback retrieved');
  });

  public getTenantHealth = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant!._id;
    const health = await CustomerSuccessService.calculateTenantHealth(tenantId);
    ApiResponse.success(res, health, 'Tenant health score calculated');
  });

  public getPortfolioHealth = asyncHandler(async (_req: Request, res: Response) => {
    const overview = await CustomerSuccessService.getPortfolioHealthOverview();
    ApiResponse.success(res, overview, 'Portfolio health overview retrieved');
  });
}

export const supportController = new SupportController();
