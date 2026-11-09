import mongoose from 'mongoose';
import { Tenant } from '../../models/Tenant.model';
import { OnboardingState } from '../../models/Onboarding.model';
import { Job } from '../../models/Job.model';
import { User } from '../../models/User.model';
import { SupportTicket } from '../../models/SupportTicket.model';
import {
  CustomerFeedback,
  TenantHealthSnapshot,
  HealthTier,
  ChurnRisk,
  FeedbackType,
} from '../../models/CustomerSuccess.model';
import { NotFoundError, BadRequestError } from '../../errors';

export class CustomerSuccessService {
  /**
   * Calculate a comprehensive 0-100 composite Health Score for a tenant
   */
  static async calculateTenantHealth(tenantId: string | mongoose.Types.ObjectId) {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant not found');

    const [onboarding, staffCount, jobs, tickets, feedback] = await Promise.all([
      OnboardingState.findOne({ tenantId }).lean(),
      User.countDocuments({ tenantId, isActive: true }),
      Job.find({ tenantId }).sort({ createdAt: -1 }).limit(100).lean(),
      SupportTicket.find({ tenantId }).lean(),
      CustomerFeedback.find({ tenantId }).lean(),
    ]);

    // 1. Onboarding & Activation (Max: 25 points)
    let onboardingScore = 0;
    const isCompleted = onboarding?.isCompleted || false;
    const completedStepsCount = onboarding?.completedSteps?.length || 0;

    if (isCompleted) {
      onboardingScore = 25;
    } else {
      onboardingScore = Math.min(25, Math.round((completedStepsCount / 10) * 25));
    }

    // 2. Product Usage & Engagement (Max: 35 points)
    let productUsageScore = 0;
    const completedJobs = jobs.filter((j: any) => j.status === 'COMPLETED').length;

    if (completedJobs >= 25) productUsageScore += 25;
    else if (completedJobs >= 10) productUsageScore += 18;
    else if (completedJobs >= 1) productUsageScore += 10;

    // Recency factor
    if (jobs.length > 0) {
      const lastJobDate = new Date(jobs[0].createdAt).getTime();
      const daysSinceLastJob = (Date.now() - lastJobDate) / (1000 * 60 * 60 * 24);
      if (daysSinceLastJob <= 2) productUsageScore += 10;
      else if (daysSinceLastJob <= 7) productUsageScore += 6;
      else if (daysSinceLastJob <= 14) productUsageScore += 3;
    }

    // 3. Support & Service Experience (Max: 20 points)
    let supportHealthScore = 0;
    const openTickets = tickets.filter((t: any) => t.status === 'OPEN' || t.status === 'IN_PROGRESS');
    const urgentOpenTickets = openTickets.filter((t: any) => t.priority === 'URGENT');

    if (urgentOpenTickets.length === 0) supportHealthScore += 10;
    else supportHealthScore += 2;

    if (feedback.length > 0) {
      const avgRating = feedback.reduce((sum: number, f: any) => sum + f.rating, 0) / feedback.length;
      if (avgRating >= 4.0) supportHealthScore += 10;
      else if (avgRating >= 3.0) supportHealthScore += 6;
      else supportHealthScore += 2;
    } else {
      supportHealthScore += 8; // Neutral baseline when no ratings yet
    }

    // 4. Subscription & Commercial Health (Max: 20 points)
    let subscriptionScore = 0;
    const subStatus = tenant.subscription?.status || 'TRIAL';
    const plan = (tenant.subscription?.plan || 'TRIAL').toUpperCase();

    if (subStatus === 'ACTIVE') {
      if (plan === 'ENTERPRISE' || plan === 'BUSINESS') subscriptionScore = 20;
      else if (plan === 'PRO' || plan === 'PROFESSIONAL') subscriptionScore = 18;
      else subscriptionScore = 15;
    } else if (subStatus === 'TRIAL' || subStatus === 'TRIALING') {
      const trialEnds = tenant.subscription?.trialEndsAt
        ? new Date(tenant.subscription.trialEndsAt).getTime()
        : Date.now();
      const daysRemaining = (trialEnds - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysRemaining > 5) subscriptionScore = 12;
      else if (daysRemaining > 0) subscriptionScore = 6;
      else subscriptionScore = 2;
    } else if (subStatus === 'PAST_DUE' || subStatus === 'GRACE_PERIOD') {
      subscriptionScore = 4;
    } else {
      subscriptionScore = 0; // SUSPENDED or CANCELLED
    }

    const healthScore = Math.min(
      100,
      Math.max(0, onboardingScore + productUsageScore + supportHealthScore + subscriptionScore)
    );

    let healthTier: HealthTier = 'HEALTHY';
    let churnRisk: ChurnRisk = 'LOW';

    if (healthScore < 50) {
      healthTier = 'AT_RISK';
      churnRisk = 'HIGH';
    } else if (healthScore < 80) {
      healthTier = 'NEEDS_ATTENTION';
      churnRisk = 'MEDIUM';
    }

    // Actionable Recommendations (Customer Success Playbooks)
    const playbookRecommendations: string[] = [];

    if (!isCompleted) {
      playbookRecommendations.push(
        `Onboarding Incomplete: Shop has only completed ${completedStepsCount}/10 steps. Dispatch automated WhatsApp guide.`
      );
    }
    if (staffCount <= 1) {
      playbookRecommendations.push(
        'Single User Risk: Only 1 staff user active. Guide owner to invite counter operators.'
      );
    }
    if (urgentOpenTickets.length > 0) {
      playbookRecommendations.push(
        `Urgent Ticket Alert: ${urgentOpenTickets.length} urgent ticket(s) awaiting resolution. Escalate to Tier 2 engineering.`
      );
    }
    if (subStatus === 'TRIAL' || subStatus === 'TRIALING') {
      playbookRecommendations.push(
        'Trial Conversion Opportunity: Trigger in-app promo offering 20% discount on first 3 months of Pro plan.'
      );
    }
    if (healthTier === 'HEALTHY' && (plan === 'STARTER' || plan === 'PRO')) {
      playbookRecommendations.push(
        'Expansion Candidate: High usage and 0 open defects. Pitch Multi-Branch & Dedicated Storage Enterprise tier.'
      );
    }

    const snapshot = await TenantHealthSnapshot.create({
      tenantId: tenant._id,
      healthScore,
      healthTier,
      churnRisk,
      breakdown: {
        onboardingScore,
        productUsageScore,
        supportHealthScore,
        subscriptionScore,
      },
      activationMilestones: {
        onboardingCompleted: isCompleted,
        firstStaffInvited: staffCount > 1,
        firstJobCompleted: completedJobs > 0,
        firstPrintExecuted: jobs.some((j: any) => j.status === 'COMPLETED' || j.printCopies),
      },
      playbookRecommendations,
      calculatedAt: new Date(),
    });

    return snapshot;
  }

  /**
   * Record customer feedback (CSAT rating or NPS score)
   */
  static async recordFeedback(
    tenantId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    data: {
      feedbackType?: FeedbackType;
      rating: number;
      category?: string;
      comment?: string;
      ticketId?: string;
    }
  ) {
    if (data.rating === undefined || data.rating < 0 || data.rating > 10) {
      throw new BadRequestError('Rating must be a number between 0 and 10');
    }

    const feedback = await CustomerFeedback.create({
      tenantId,
      userId,
      ticketId: data.ticketId ? new mongoose.Types.ObjectId(data.ticketId) : undefined,
      feedbackType: data.feedbackType || 'CSAT',
      rating: data.rating,
      category: data.category || 'GENERAL',
      comment: data.comment?.trim() || '',
    });

    return feedback;
  }

  /**
   * List customer feedback with summary statistics
   */
  static async listFeedback(tenantId: string | mongoose.Types.ObjectId) {
    const feedbackList = await CustomerFeedback.find({ tenantId })
      .sort({ createdAt: -1 })
      .populate('userId', 'fullName email')
      .lean();

    const count = feedbackList.length;
    const avgRating =
      count > 0 ? Number((feedbackList.reduce((sum: number, f: any) => sum + f.rating, 0) / count).toFixed(2)) : 5.0;

    return {
      feedback: feedbackList,
      summary: {
        count,
        avgRating,
      },
    };
  }

  /**
   * Super-Admin cross-tenant portfolio health summary
   */
  static async getPortfolioHealthOverview() {
    const tenants = await Tenant.find({ isActive: true }).select('name subdomain subscription businessId').lean();

    const summaries = await Promise.all(
      tenants.map(async (t) => {
        const latestSnapshot = await TenantHealthSnapshot.findOne({ tenantId: t._id })
          .sort({ calculatedAt: -1 })
          .lean();

        return {
          tenantId: t._id,
          name: t.name,
          businessId: t.businessId,
          plan: t.subscription?.plan || 'TRIAL',
          subscriptionStatus: t.subscription?.status || 'TRIAL',
          healthScore: latestSnapshot?.healthScore ?? 65,
          healthTier: latestSnapshot?.healthTier ?? 'NEEDS_ATTENTION',
          churnRisk: latestSnapshot?.churnRisk ?? 'MEDIUM',
          lastCalculatedAt: latestSnapshot?.calculatedAt,
        };
      })
    );

    const totalTenants = summaries.length;
    const healthyCount = summaries.filter((s) => s.healthTier === 'HEALTHY').length;
    const needsAttentionCount = summaries.filter((s) => s.healthTier === 'NEEDS_ATTENTION').length;
    const atRiskCount = summaries.filter((s) => s.healthTier === 'AT_RISK').length;

    return {
      portfolioMetrics: {
        totalTenants,
        healthyCount,
        needsAttentionCount,
        atRiskCount,
        healthyPercentage: totalTenants > 0 ? Math.round((healthyCount / totalTenants) * 100) : 100,
      },
      tenants: summaries,
    };
  }
}
