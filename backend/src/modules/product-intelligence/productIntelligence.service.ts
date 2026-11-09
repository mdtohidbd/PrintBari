import mongoose, { Types } from 'mongoose';
import {
  ProductEvent,
  IProductEvent,
  ProductFeedback,
  IProductFeedback,
  ProductEventType,
  ProductModule,
  FeedbackType,
  SurveyType,
  FeedbackSeverity,
  RoadmapStatus,
} from '../../models/ProductIntelligence.model';
import { Tenant } from '../../models/Tenant.model';
import { User } from '../../models/User.model';
import { SupportTicket } from '../../models/SupportTicket.model';

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /buffer/i,
  /image/i,
  /photo/i,
  /nid/i,
  /nin/i,
  /passport/i,
  /credit/i,
  /cvv/i,
  /pin/i,
  /auth/i,
];

function sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
    if (isSensitiveKey) {
      clean[key] = '[REDACTED_SENSITIVE_CONTENT]';
      continue;
    }

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      clean[key] = sanitizeMetadata(value);
    } else if (typeof value === 'string' && value.length > 300) {
      // Truncate long strings to prevent accidental log-dump or base64 injection
      clean[key] = value.substring(0, 300) + '...[TRUNCATED]';
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export class ProductIntelligenceService {
  /**
   * Track Telemetry Event with strict privacy sanitization
   */
  public async trackEvent(input: {
    tenantId?: string | Types.ObjectId;
    userId?: string | Types.ObjectId;
    role?: string;
    planTier?: string;
    eventType: ProductEventType;
    module: ProductModule;
    screen: string;
    workflowId?: string;
    stepName?: string;
    durationMs?: number;
    errorCode?: string;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }): Promise<IProductEvent> {
    const sanitizedMeta = sanitizeMetadata(input.metadata);
    const sanitizedErrorMsg = input.errorMessage
      ? input.errorMessage.replace(/([0-9a-f]{24}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi, '[REDACTED]')
      : undefined;

    const event = await ProductEvent.create({
      tenantId: input.tenantId ? new Types.ObjectId(input.tenantId) : undefined,
      userId: input.userId ? new Types.ObjectId(input.userId) : undefined,
      role: input.role || 'STAFF',
      planTier: input.planTier || 'STARTER',
      eventType: input.eventType,
      module: input.module,
      screen: input.screen,
      workflowId: input.workflowId,
      stepName: input.stepName,
      durationMs: input.durationMs || 0,
      errorCode: input.errorCode,
      errorMessage: sanitizedErrorMsg,
      metadata: sanitizedMeta,
      timestamp: new Date(),
    });

    return event;
  }

  /**
   * Core Platform Telemetry Metrics
   */
  public async getTelemetryMetrics(timeWindowDays: number = 30): Promise<Record<string, any>> {
    const cutoffDate = new Date(Date.now() - timeWindowDays * 86400000);

    // 1. Active shops & staff in telemetry
    const [activeTenantsAgg, activeUsersAgg] = await Promise.all([
      ProductEvent.distinct('tenantId', {
        timestamp: { $gte: cutoffDate },
        tenantId: { $ne: null },
      }),
      ProductEvent.distinct('userId', {
        timestamp: { $gte: cutoffDate },
        userId: { $ne: null },
      }),
    ]);

    // 2. Job creation vs completion counts
    const [jobCreatedCount, jobCompletedCount, exportSuccessCount, processingFailuresCount] =
      await Promise.all([
        ProductEvent.countDocuments({
          eventType: 'JOB_CREATED',
          timestamp: { $gte: cutoffDate },
        }),
        ProductEvent.countDocuments({
          eventType: 'JOB_COMPLETED',
          timestamp: { $gte: cutoffDate },
        }),
        ProductEvent.countDocuments({
          eventType: 'EXPORT_SUCCESS',
          timestamp: { $gte: cutoffDate },
        }),
        ProductEvent.countDocuments({
          eventType: 'PROCESSING_FAILED',
          timestamp: { $gte: cutoffDate },
        }),
      ]);

    const totalExports = exportSuccessCount + processingFailuresCount;
    const exportSuccessRate =
      totalExports > 0 ? Number(((exportSuccessCount / totalExports) * 100).toFixed(2)) : 100.0;
    const jobCompletionRate =
      jobCreatedCount > 0 ? Number(((jobCompletedCount / jobCreatedCount) * 100).toFixed(2)) : 100.0;

    // 3. Subscription Conversion & Churn rates
    const [totalTenants, payingTenants, churnedTenants] = await Promise.all([
      Tenant.countDocuments(),
      Tenant.countDocuments({
        'subscription.status': 'ACTIVE',
        'subscription.plan': { $in: ['STARTER', 'PRO', 'BUSINESS'] },
      }),
      Tenant.countDocuments({
        'subscription.status': { $in: ['EXPIRED', 'PAST_DUE'] },
      }),
    ]);

    const conversionRate =
      totalTenants > 0 ? Number(((payingTenants / totalTenants) * 100).toFixed(2)) : 0;
    const churnRate =
      totalTenants > 0 ? Number(((churnedTenants / totalTenants) * 100).toFixed(2)) : 0;

    // 4. Support Volume Correlation
    const supportVolume = await SupportTicket.countDocuments({
      createdAt: { $gte: cutoffDate },
    });

    return {
      timeWindowDays,
      activeShops: activeTenantsAgg.length,
      activeStaff: activeUsersAgg.length,
      jobCreationCount: jobCreatedCount,
      jobCompletionCount: jobCompletedCount,
      jobCompletionRatePercentage: jobCompletionRate,
      exportSuccessCount,
      exportSuccessRatePercentage: exportSuccessRate,
      processingFailureCount: processingFailuresCount,
      subscriptionConversionRatePercentage: conversionRate,
      churnCount: churnedTenants,
      churnRatePercentage: churnRate,
      supportVolume,
    };
  }

  /**
   * Feature Adoption Matrix across Modules
   */
  public async getFeatureAdoptionMatrix(timeWindowDays: number = 30): Promise<Record<string, any>> {
    const cutoffDate = new Date(Date.now() - timeWindowDays * 86400000);

    const totalActiveShops = (
      await ProductEvent.distinct('tenantId', {
        timestamp: { $gte: cutoffDate },
        tenantId: { $ne: null },
      })
    ).length || 1;

    // Aggregate unique shops using each module
    const moduleUsageAgg = await ProductEvent.aggregate([
      {
        $match: {
          timestamp: { $gte: cutoffDate },
          tenantId: { $ne: null },
        },
      },
      {
        $group: {
          _id: '$module',
          uniqueShops: { $addToSet: '$tenantId' },
          totalEvents: { $sum: 1 },
          completedJobs: {
            $sum: { $cond: [{ $eq: ['$eventType', 'JOB_COMPLETED'] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          module: '$_id',
          activeShopCount: { $size: '$uniqueShops' },
          totalEvents: 1,
          completedJobs: 1,
        },
      },
      { $sort: { activeShopCount: -1 } },
    ]);

    const allModules: ProductModule[] = [
      'PASSPORT',
      'DOCUMENT',
      'IDCARD',
      'CV',
      'OCR',
      'POS',
      'PRINTER',
      'BILLING',
      'SETTINGS',
      'ONBOARDING',
      'SUPPORT',
    ];

    const matrix = allModules.map((mod) => {
      const found = moduleUsageAgg.find((m) => m.module === mod);
      const activeShops = found?.activeShopCount || 0;
      const adoptionRate = Number(((activeShops / totalActiveShops) * 100).toFixed(1));

      let tierCategory = 'UNUSED';
      if (adoptionRate >= 60) tierCategory = 'CORE_HIGH_ADOPTION';
      else if (adoptionRate >= 25) tierCategory = 'MODERATE_ADOPTION';
      else if (adoptionRate > 0) tierCategory = 'LOW_ADOPTION';

      return {
        module: mod,
        activeShopCount: activeShops,
        adoptionRatePercentage: adoptionRate,
        tierCategory,
        totalEvents: found?.totalEvents || 0,
        completedJobs: found?.completedJobs || 0,
      };
    });

    const unusedFeatures = matrix.filter((m) => m.tierCategory === 'UNUSED' || m.tierCategory === 'LOW_ADOPTION');

    return {
      timeWindowDays,
      totalActiveShops,
      featureMatrix: matrix,
      unusedOrUnderutilizedFeatures: unusedFeatures.map((u) => u.module),
    };
  }

  /**
   * UX Friction Analysis: Abandonment, Repeated Errors, Slow Operations
   */
  public async analyzeUXFriction(timeWindowDays: number = 30): Promise<Record<string, any>> {
    const cutoffDate = new Date(Date.now() - timeWindowDays * 86400000);

    // 1. Abandoned Workflows (Started vs Abandoned)
    const workflowFrictionAgg = await ProductEvent.aggregate([
      {
        $match: {
          timestamp: { $gte: cutoffDate },
          eventType: { $in: ['WORKFLOW_STARTED', 'WORKFLOW_ABANDONED', 'WORKFLOW_STEP_COMPLETED'] },
        },
      },
      {
        $group: {
          _id: { module: '$module', screen: '$screen' },
          started: { $sum: { $cond: [{ $eq: ['$eventType', 'WORKFLOW_STARTED'] }, 1, 0] } },
          abandoned: { $sum: { $cond: [{ $eq: ['$eventType', 'WORKFLOW_ABANDONED'] }, 1, 0] } },
          stepsCompleted: {
            $sum: { $cond: [{ $eq: ['$eventType', 'WORKFLOW_STEP_COMPLETED'] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          module: '$_id.module',
          screen: '$_id.screen',
          started: 1,
          abandoned: 1,
          abandonmentRatePercentage: {
            $cond: [
              { $gt: ['$started', 0] },
              { $multiply: [{ $divide: ['$abandoned', '$started'] }, 100] },
              0,
            ],
          },
        },
      },
      { $sort: { abandoned: -1 } },
    ]);

    // 2. Repeated Errors by ErrorCode & Screen
    const errorAgg = await ProductEvent.aggregate([
      {
        $match: {
          timestamp: { $gte: cutoffDate },
          errorCode: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: { errorCode: '$errorCode', screen: '$screen' },
          count: { $sum: 1 },
          sampleMessage: { $first: '$errorMessage' },
        },
      },
      {
        $project: {
          errorCode: '$_id.errorCode',
          screen: '$_id.screen',
          occurrenceCount: '$count',
          sampleMessage: 1,
        },
      },
      { $sort: { occurrenceCount: -1 } },
      { $limit: 10 },
    ]);

    // 3. Slow Operations (Operations exceeding 3000ms SLA)
    const slowOpsAgg = await ProductEvent.aggregate([
      {
        $match: {
          timestamp: { $gte: cutoffDate },
          durationMs: { $gt: 3000 },
        },
      },
      {
        $group: {
          _id: { module: '$module', screen: '$screen' },
          slowEventCount: { $sum: 1 },
          avgDurationMs: { $avg: '$durationMs' },
          maxDurationMs: { $max: '$durationMs' },
        },
      },
      {
        $project: {
          module: '$_id.module',
          screen: '$_id.screen',
          slowEventCount: 1,
          avgDurationMs: { $round: ['$avgDurationMs', 0] },
          maxDurationMs: 1,
        },
      },
      { $sort: { slowEventCount: -1 } },
    ]);

    return {
      timeWindowDays,
      abandonedWorkflows: workflowFrictionAgg,
      repeatedErrors: errorAgg,
      slowOperations: slowOpsAgg,
    };
  }

  /**
   * Submit In-App Feedback, Bug Report, Survey, or Feature Request
   */
  public async submitFeedback(input: {
    tenantId: string | Types.ObjectId;
    userId: string | Types.ObjectId;
    userName?: string;
    type: FeedbackType;
    category?: string;
    title: string;
    description: string;
    rating?: number;
    surveyType?: SurveyType;
    screenContext?: string;
    severity?: FeedbackSeverity;
  }): Promise<IProductFeedback> {
    const feedback = await ProductFeedback.create({
      tenantId: new Types.ObjectId(input.tenantId),
      userId: new Types.ObjectId(input.userId),
      userName: input.userName,
      type: input.type,
      category: input.category || 'USABILITY',
      title: input.title,
      description: input.description,
      rating: input.rating,
      surveyType: input.surveyType || 'NONE',
      screenContext: input.screenContext,
      severity: input.severity || 'MEDIUM',
      upvotes: 1,
      voters: [new Types.ObjectId(input.userId)],
      status: 'NEW',
      prioritization: {
        reach: 10,
        impact: 1.0,
        confidence: 80,
        effort: 2.0,
        strategicScore: 3,
        securityRiskScore: 1,
        riceScore: Math.round((10 * 1.0 * 80) / 2.0),
      },
    });

    return feedback;
  }

  /**
   * Vote for a Feature Request
   */
  public async voteFeatureRequest(
    feedbackId: string,
    userId: string
  ): Promise<{ feedback: IProductFeedback; voted: boolean }> {
    const feedback = await ProductFeedback.findById(feedbackId);
    if (!feedback) {
      throw new Error(`Feedback item ${feedbackId} not found`);
    }

    const uId = new Types.ObjectId(userId);
    const existingIndex = feedback.voters.findIndex((v) => v.equals(uId));

    let voted = false;
    if (existingIndex > -1) {
      // Toggle off / remove vote
      feedback.voters.splice(existingIndex, 1);
      feedback.upvotes = Math.max(0, feedback.upvotes - 1);
      voted = false;
    } else {
      // Cast upvote
      feedback.voters.push(uId);
      feedback.upvotes += 1;
      voted = true;
    }

    // Recalculate RICE score dynamically using updated upvotes as reach proxy
    const reach = Math.max(10, feedback.upvotes * 5);
    const impact = feedback.prioritization.impact || 1.0;
    const confidence = feedback.prioritization.confidence || 80;
    const effort = Math.max(0.5, feedback.prioritization.effort || 2.0);
    feedback.prioritization.reach = reach;
    feedback.prioritization.riceScore = Math.round((reach * impact * confidence) / effort);

    await feedback.save();
    return { feedback, voted };
  }

  /**
   * Prioritize Feature / Bug via RICE Scoring
   */
  public async scoreAndPrioritizeRoadmapItem(
    feedbackId: string,
    scores: {
      reach?: number;
      impact?: number;
      confidence?: number;
      effort?: number;
      strategicScore?: number;
      securityRiskScore?: number;
      status?: RoadmapStatus;
      adminResponse?: string;
    }
  ): Promise<IProductFeedback> {
    const item = await ProductFeedback.findById(feedbackId);
    if (!item) {
      throw new Error(`Item ${feedbackId} not found`);
    }

    const reach = scores.reach !== undefined ? scores.reach : item.prioritization.reach;
    const impact = scores.impact !== undefined ? scores.impact : item.prioritization.impact;
    const confidence = scores.confidence !== undefined ? scores.confidence : item.prioritization.confidence;
    const effort = scores.effort !== undefined ? Math.max(0.5, scores.effort) : item.prioritization.effort;

    const riceScore = Math.round((reach * impact * confidence) / effort);

    item.prioritization.reach = reach;
    item.prioritization.impact = impact;
    item.prioritization.confidence = confidence;
    item.prioritization.effort = effort;
    if (scores.strategicScore !== undefined) item.prioritization.strategicScore = scores.strategicScore;
    if (scores.securityRiskScore !== undefined) item.prioritization.securityRiskScore = scores.securityRiskScore;
    item.prioritization.riceScore = riceScore;

    if (scores.status) item.status = scores.status;
    if (scores.adminResponse) item.adminResponse = scores.adminResponse;

    await item.save();
    return item;
  }

  /**
   * Feedback & Survey Analytics Summary
   */
  public async getFeedbackAnalytics(): Promise<Record<string, any>> {
    const [csatAgg, npsAgg, cesAgg, topFeatureRequests, criticalBugsCount] = await Promise.all([
      // CSAT (1 to 5)
      ProductFeedback.aggregate([
        { $match: { surveyType: 'CSAT', rating: { $exists: true } } },
        {
          $group: {
            _id: null,
            averageScore: { $avg: '$rating' },
            count: { $sum: 1 },
          },
        },
      ]),
      // NPS (0 to 10)
      ProductFeedback.aggregate([
        { $match: { surveyType: 'NPS', rating: { $exists: true } } },
        {
          $group: {
            _id: null,
            promoters: { $sum: { $cond: [{ $gte: ['$rating', 9] }, 1, 0] } },
            passives: { $sum: { $cond: [{ $and: [{ $gte: ['$rating', 7] }, { $lte: ['$rating', 8] }] }, 1, 0] } },
            detractors: { $sum: { $cond: [{ $lte: ['$rating', 6] }, 1, 0] } },
            total: { $sum: 1 },
          },
        },
      ]),
      // CES (1 to 7)
      ProductFeedback.aggregate([
        { $match: { surveyType: 'CES', rating: { $exists: true } } },
        {
          $group: {
            _id: null,
            averageScore: { $avg: '$rating' },
            count: { $sum: 1 },
          },
        },
      ]),
      // Top 5 Upvoted Feature Requests
      ProductFeedback.find({ type: 'FEATURE_REQUEST' })
        .sort({ upvotes: -1, 'prioritization.riceScore': -1 })
        .limit(5)
        .lean(),
      // Critical Bugs Count
      ProductFeedback.countDocuments({
        type: 'BUG_REPORT',
        severity: 'CRITICAL',
        status: { $in: ['NEW', 'UNDER_REVIEW', 'IN_PROGRESS'] },
      }),
    ]);

    const npsData = npsAgg[0] || { promoters: 0, passives: 0, detractors: 0, total: 0 };
    const npsScore =
      npsData.total > 0
        ? Math.round(((npsData.promoters - npsData.detractors) / npsData.total) * 100)
        : 0;

    return {
      csat: {
        averageRating: csatAgg[0]?.averageScore ? Number(csatAgg[0].averageScore.toFixed(2)) : 4.5,
        totalResponses: csatAgg[0]?.count || 0,
      },
      nps: {
        score: npsScore,
        promoters: npsData.promoters,
        passives: npsData.passives,
        detractors: npsData.detractors,
        totalResponses: npsData.total,
      },
      ces: {
        averageEffortScore: cesAgg[0]?.averageScore ? Number(cesAgg[0].averageScore.toFixed(2)) : 2.1,
        totalResponses: cesAgg[0]?.count || 0,
      },
      criticalBugsInBacklog: criticalBugsCount,
      topFeatureRequests,
    };
  }
}

export const productIntelligenceService = new ProductIntelligenceService();
