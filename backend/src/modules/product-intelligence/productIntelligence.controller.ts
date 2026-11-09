import { Request, Response } from 'express';
import { productIntelligenceService } from './productIntelligence.service';
import { ProductFeedback } from '../../models/ProductIntelligence.model';
import { ApiResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { BadRequestError } from '../../errors';

export class ProductIntelligenceController {
  /**
   * POST /api/v1/product-intelligence/events
   * Track telemetry event with automatic tenant/user enrichment from token if present
   */
  public trackEvent = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || req.body.tenantId;
    const userId = req.user?._id || req.body.userId;
    const role = req.user?.role || req.body.role;

    const event = await productIntelligenceService.trackEvent({
      tenantId,
      userId,
      role,
      planTier: req.tenant?.subscription?.plan || req.body.planTier,
      eventType: req.body.eventType,
      module: req.body.module,
      screen: req.body.screen,
      workflowId: req.body.workflowId,
      stepName: req.body.stepName,
      durationMs: req.body.durationMs,
      errorCode: req.body.errorCode,
      errorMessage: req.body.errorMessage,
      metadata: req.body.metadata,
    });

    return ApiResponse.created(res, event, 'Product event tracked successfully');
  });

  /**
   * GET /api/v1/product-intelligence/metrics
   * Telemetry KPIs: Active shops/staff, job completions, exports, conversion, churn
   */
  public getMetrics = asyncHandler(async (req: Request, res: Response) => {
    const days = req.query.days ? parseInt(String(req.query.days), 10) : 30;
    const metrics = await productIntelligenceService.getTelemetryMetrics(days);
    return ApiResponse.success(res, metrics, 'Telemetry metrics retrieved');
  });

  /**
   * GET /api/v1/product-intelligence/feature-adoption
   * Module adoption matrix and unused/underutilized feature identification
   */
  public getFeatureAdoption = asyncHandler(async (req: Request, res: Response) => {
    const days = req.query.days ? parseInt(String(req.query.days), 10) : 30;
    const matrix = await productIntelligenceService.getFeatureAdoptionMatrix(days);
    return ApiResponse.success(res, matrix, 'Feature adoption matrix retrieved');
  });

  /**
   * GET /api/v1/product-intelligence/ux-friction
   * Workflow drop-offs, repeated errors, and slow operations
   */
  public getUXFriction = asyncHandler(async (req: Request, res: Response) => {
    const days = req.query.days ? parseInt(String(req.query.days), 10) : 30;
    const friction = await productIntelligenceService.analyzeUXFriction(days);
    return ApiResponse.success(res, friction, 'UX friction analysis retrieved');
  });

  /**
   * POST /api/v1/product-intelligence/feedback
   * Submit in-app feedback, bug report, survey, or feature request
   */
  public submitFeedback = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || req.body.tenantId;
    const userId = req.user?._id || req.body.userId;

    if (!tenantId || !userId) {
      throw new BadRequestError('tenantId and userId are required to submit feedback');
    }

    const feedback = await productIntelligenceService.submitFeedback({
      tenantId,
      userId,
      userName: req.user?.fullName || req.body.userName,
      type: req.body.type,
      category: req.body.category,
      title: req.body.title,
      description: req.body.description,
      rating: req.body.rating,
      surveyType: req.body.surveyType,
      screenContext: req.body.screenContext,
      severity: req.body.severity,
    });

    return ApiResponse.created(res, feedback, 'Feedback submitted successfully');
  });

  /**
   * GET /api/v1/product-intelligence/feedback
   * List feedback items with type, status, and category filtering
   */
  public listFeedback = asyncHandler(async (req: Request, res: Response) => {
    const { type, status, category } = req.query;
    const filter: Record<string, any> = {};

    if (type) filter.type = String(type);
    if (status) filter.status = String(status);
    if (category) filter.category = String(category);

    const items = await ProductFeedback.find(filter)
      .sort({ upvotes: -1, 'prioritization.riceScore': -1, createdAt: -1 })
      .limit(100)
      .lean();

    return ApiResponse.success(res, items, 'Feedback items retrieved');
  });

  /**
   * POST /api/v1/product-intelligence/feedback/:id/vote
   * Cast or toggle upvote on a feature request
   */
  public voteFeedback = asyncHandler(async (req: Request, res: Response) => {
    const feedbackId = String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    const userId = req.user?._id?.toString() || req.body.userId;

    if (!userId) {
      throw new BadRequestError('userId is required to vote');
    }

    const result = await productIntelligenceService.voteFeatureRequest(feedbackId, userId);
    return ApiResponse.success(
      res,
      result,
      result.voted ? 'Upvote registered successfully' : 'Upvote removed successfully'
    );
  });

  /**
   * PATCH /api/v1/product-intelligence/feedback/:id/prioritize
   * Update RICE scores and roadmap status (Super Admin / Product Lead)
   */
  public prioritizeFeedback = asyncHandler(async (req: Request, res: Response) => {
    const feedbackId = String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    const updated = await productIntelligenceService.scoreAndPrioritizeRoadmapItem(
      feedbackId,
      req.body
    );
    return ApiResponse.success(res, updated, 'Item prioritization updated successfully');
  });

  /**
   * GET /api/v1/product-intelligence/feedback-analytics
   * CSAT, NPS, CES and top voted backlog summary
   */
  public getFeedbackAnalytics = asyncHandler(async (_req: Request, res: Response) => {
    const analytics = await productIntelligenceService.getFeedbackAnalytics();
    return ApiResponse.success(res, analytics, 'Feedback analytics retrieved');
  });
}

export const productIntelligenceController = new ProductIntelligenceController();
