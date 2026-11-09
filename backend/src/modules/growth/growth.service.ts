import mongoose from 'mongoose';
import { Lead, ReferralProgram, FunnelEvent, ILead, LeadStatus, FunnelEventType } from '../../models/GrowthMarketing.model';
import { Tenant } from '../../models/Tenant.model';
import { PaymentTransaction } from '../../models/Subscription.model';
import { BadRequestError, NotFoundError } from '../../errors';

export class GrowthService {
  /**
   * 1. LEAD CAPTURE & DEMO SCHEDULING
   */
  public async captureLead(data: {
    fullName: string;
    shopName: string;
    email: string;
    phone: string;
    city: string;
    district?: string;
    shopType?: any;
    estimatedMonthlyJobs?: number;
    currentSoftware?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    marketingConsent: boolean;
    ipAddress?: string;
    isDemoRequest?: boolean;
    preferredDate?: Date;
    demoNotes?: string;
  }): Promise<ILead> {
    if (!data.fullName || !data.phone || !data.shopName || !data.email) {
      throw new BadRequestError('Full name, phone, shop name, and email are required');
    }
    if (data.marketingConsent !== true) {
      throw new BadRequestError('Explicit marketing consent is required under personal data protection guidelines');
    }

    const status: LeadStatus = data.isDemoRequest ? 'DEMO_SCHEDULED' : 'NEW';

    const lead = await Lead.create({
      fullName: data.fullName,
      shopName: data.shopName,
      email: data.email.toLowerCase(),
      phone: data.phone,
      city: data.city || 'Dhaka',
      district: data.district,
      shopType: data.shopType || 'PHOTO_STUDIO',
      estimatedMonthlyJobs: data.estimatedMonthlyJobs || 300,
      currentSoftware: data.currentSoftware || 'Manual / Photoshop',
      status,
      demoScheduledAt: data.preferredDate,
      demoNotes: data.demoNotes,
      utmSource: data.utmSource || 'organic',
      utmMedium: data.utmMedium || 'direct',
      utmCampaign: data.utmCampaign,
      utmContent: data.utmContent,
      marketingConsent: true,
      consentTimestamp: new Date(),
      ipAddress: data.ipAddress,
      followUps: [
        {
          note: data.isDemoRequest
            ? `Demo requested via web portal for ${data.preferredDate ? new Date(data.preferredDate).toLocaleDateString() : 'earliest available slot'}`
            : 'Inbound lead captured via public contact/pricing form',
          scheduledFor: data.preferredDate || new Date(Date.now() + 24 * 3600 * 1000),
          completed: false,
          createdAt: new Date(),
        },
      ],
    });

    // Record Funnel Event
    await this.recordFunnelEvent({
      visitorId: data.phone,
      eventType: data.isDemoRequest ? 'DEMO_REQUESTED' : 'LEAD_CAPTURED',
      pagePath: data.isDemoRequest ? '/demo' : '/contact',
      utmSource: data.utmSource,
      utmMedium: data.utmMedium,
      utmCampaign: data.utmCampaign,
      metadata: { leadId: lead._id, shopType: data.shopType, city: data.city },
    });

    return lead;
  }

  public async scheduleDemo(
    leadId: string,
    demoDate: Date,
    demoNotes?: string
  ): Promise<ILead> {
    const lead = await Lead.findById(leadId);
    if (!lead) throw new NotFoundError('Lead not found');

    lead.status = 'DEMO_SCHEDULED';
    lead.demoScheduledAt = demoDate;
    if (demoNotes) lead.demoNotes = demoNotes;

    lead.followUps.push({
      note: `Demo officially scheduled for ${new Date(demoDate).toLocaleString()} BST. Notes: ${demoNotes || 'Standard Studio tour'}`,
      scheduledFor: demoDate,
      completed: false,
      createdAt: new Date(),
    });

    return await lead.save();
  }

  public async completeDemo(
    leadId: string,
    outcomeNotes: string,
    status: LeadStatus = 'DEMO_COMPLETED'
  ): Promise<ILead> {
    const lead = await Lead.findById(leadId);
    if (!lead) throw new NotFoundError('Lead not found');

    lead.status = status;
    lead.demoCompletedAt = new Date();
    lead.followUps.push({
      note: `Live demo completed. Outcome: ${outcomeNotes}`,
      completed: true,
      createdAt: new Date(),
    });

    return await lead.save();
  }

  /**
   * 2. SALES PIPELINE & FOLLOW-UPS
   */
  public async getLeadPipeline(query: {
    status?: string;
    search?: string;
    utmSource?: string;
    page?: number;
    limit?: number;
  }): Promise<{ leads: ILead[]; total: number; page: number; limit: number }> {
    const filter: Record<string, any> = {};
    if (query.status) {
      filter.status = query.status.toUpperCase();
    }
    if (query.utmSource) {
      filter.utmSource = query.utmSource;
    }
    if (query.search) {
      filter.$or = [
        { fullName: { $regex: query.search, $options: 'i' } },
        { shopName: { $regex: query.search, $options: 'i' } },
        { phone: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } },
        { city: { $regex: query.search, $options: 'i' } },
      ];
    }

    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 50;
    const skip = (page - 1) * limit;

    const [leads, total] = await Promise.all([
      Lead.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Lead.countDocuments(filter),
    ]);

    return { leads, total, page, limit };
  }

  public async updateLeadStatus(
    leadId: string,
    status: LeadStatus,
    lossReason?: string,
    convertedTenantId?: string
  ): Promise<ILead> {
    const lead = await Lead.findById(leadId);
    if (!lead) throw new NotFoundError('Lead not found');

    lead.status = status;
    if (status === 'LOST' && lossReason) {
      lead.lossReason = lossReason;
    }
    if (status === 'WON' && convertedTenantId) {
      lead.convertedTenantId = new mongoose.Types.ObjectId(convertedTenantId);
    }

    lead.followUps.push({
      note: `Pipeline stage updated to [${status}]${lossReason ? ` Reason: ${lossReason}` : ''}`,
      completed: true,
      createdAt: new Date(),
    });

    return await lead.save();
  }

  public async addFollowUp(
    leadId: string,
    note: string,
    scheduledFor?: Date,
    userId?: string
  ): Promise<ILead> {
    const lead = await Lead.findById(leadId);
    if (!lead) throw new NotFoundError('Lead not found');

    lead.followUps.push({
      note,
      scheduledFor,
      completed: false,
      createdBy: userId ? new mongoose.Types.ObjectId(userId) : undefined,
      createdAt: new Date(),
    });

    return await lead.save();
  }

  public async getPipelineStatistics(): Promise<Record<string, any>> {
    const stageCounts = await Lead.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const statsMap: Record<string, number> = {
      NEW: 0,
      CONTACTED: 0,
      DEMO_SCHEDULED: 0,
      DEMO_COMPLETED: 0,
      PROPOSAL_SENT: 0,
      WON: 0,
      LOST: 0,
    };

    let totalLeads = 0;
    stageCounts.forEach((s) => {
      statsMap[s._id] = s.count;
      totalLeads += s.count;
    });

    const wonCount = statsMap.WON || 0;
    const lostCount = statsMap.LOST || 0;
    const closedCount = wonCount + lostCount;
    const winRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 10000) / 100 : 0;

    // Source breakdown
    const sourceBreakdown = await Lead.aggregate([
      { $group: { _id: '$utmSource', count: { $sum: 1 }, won: { $sum: { $cond: [{ $eq: ['$status', 'WON'] }, 1, 0] } } } },
      { $sort: { count: -1 } },
    ]);

    return {
      totalLeads,
      stages: statsMap,
      winRatePercent: winRate,
      sourceBreakdown: sourceBreakdown.map((s) => ({
        source: s._id || 'direct',
        leads: s.count,
        won: s.won,
        conversionRate: s.count > 0 ? Math.round((s.won / s.count) * 10000) / 100 : 0,
      })),
    };
  }

  /**
   * 3. AUTOMATED LIFECYCLE EMAIL & ONBOARDING NURTURE
   */
  public getTrialNurtureTemplates(): Array<{
    day: number;
    subject: string;
    previewText: string;
    goal: string;
    ctaUrl: string;
  }> {
    return [
      {
        day: 0,
        subject: 'Welcome to DocuStudio — Complete Your 3-Minute Shop Setup 🚀',
        previewText: 'Welcome to the smart operating system for digital print & photo studios.',
        goal: 'Activate core profile, configure shop logo, and verify print margin defaults.',
        ctaUrl: '/onboarding',
      },
      {
        day: 2,
        subject: 'Master 10-Second Passport Photo Grids (4R / 300 DPI) 📸',
        previewText: 'Stop manual Photoshop slicing. Generate BD standard 35x45mm layouts in 1 click.',
        goal: 'Drive activation in Passport Photo Studio.',
        ctaUrl: '/studio/passport',
      },
      {
        day: 4,
        subject: 'Connect Your Epson, Canon, or HP Printers to Instant Spooler 🖨️',
        previewText: 'Zero printer dialog delays. Send jobs directly from counter to thermal/inkjet printers.',
        goal: 'Set up hardware spooler and eliminate queue bottlenecks.',
        ctaUrl: '/printers',
      },
      {
        day: 7,
        subject: 'Halfway Milestone: Invite Your Counter Operators & Staff 👥',
        previewText: 'Keep shift closing and cash register organized across multiple operators.',
        goal: 'Drive multi-user expansion and team seat adoption.',
        ctaUrl: '/staff',
      },
      {
        day: 11,
        subject: '3 Days Remaining on Your Trial — Save 2 Months with Annual Plans 🎁',
        previewText: 'Unlock uninterrupted cloud document archives and premium OCR.',
        goal: 'Pre-conversion discount incentive (2 months free on yearly billing).',
        ctaUrl: '/subscription',
      },
      {
        day: 14,
        subject: 'Your Pro Trial Has Converted to Free Tier — Upgrade Anytime 🛡️',
        previewText: 'Your customer records and templates are safe. Reactivate Pro anytime.',
        goal: 'Win-back retention and seamless upgrade path without data loss.',
        ctaUrl: '/subscription',
      },
    ];
  }

  /**
   * 4. REFERRAL & AFFILIATE ENGINE
   */
  public async ensureReferralProgram(tenantId: string): Promise<any> {
    let program = await ReferralProgram.findOne({ tenantId });
    if (!program) {
      const tenant = await Tenant.findById(tenantId);
      const prefix = tenant?.subdomain ? tenant.subdomain.slice(0, 4).toUpperCase() : 'SHOP';
      const rand = Math.floor(1000 + Math.random() * 9000);
      const code = `DOCU-${prefix}-${rand}`;

      program = await ReferralProgram.create({
        tenantId,
        referralCode: code,
        totalReferrals: 0,
        successfulConversions: 0,
        rewardMonthsEarned: 0,
        rewardMonthsRedeemed: 0,
        isAffiliate: false,
        affiliateCommissionPercent: 15,
        affiliateEarningsBDT: 0,
        affiliatePayoutBalanceBDT: 0,
      });
    }
    return program;
  }

  public async validateReferralCode(code: string): Promise<{ valid: boolean; program?: any }> {
    if (!code) return { valid: false };
    const program = await ReferralProgram.findOne({
      referralCode: code.toUpperCase().trim(),
    }).populate('tenantId', 'name subdomain');

    if (!program) return { valid: false };
    return { valid: true, program };
  }

  public async attributeReferral(referredTenantId: string, referralCode: string): Promise<boolean> {
    const { valid, program } = await this.validateReferralCode(referralCode);
    if (!valid || !program) return false;

    // Prevent self-referral
    if (program.tenantId._id.toString() === referredTenantId) return false;

    // Update referrer statistics
    program.totalReferrals += 1;
    program.successfulConversions += 1;
    program.rewardMonthsEarned += 1; // 1 month free credit awarded

    if (program.isAffiliate) {
      const commission = Math.round(1990 * (program.affiliateCommissionPercent / 100)); // standard 15% on Pro
      program.affiliateEarningsBDT += commission;
      program.affiliatePayoutBalanceBDT += commission;
    }

    await program.save();
    return true;
  }

  /**
   * 5. MARKETING ANALYTICS & FUNNEL TRACKING
   */
  public async recordFunnelEvent(event: {
    visitorId: string;
    sessionId?: string;
    tenantId?: string;
    eventType: FunnelEventType;
    pagePath: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    metadata?: Record<string, any>;
  }) {
    return await FunnelEvent.create({
      visitorId: event.visitorId,
      sessionId: event.sessionId,
      tenantId: event.tenantId ? new mongoose.Types.ObjectId(event.tenantId) : undefined,
      eventType: event.eventType,
      pagePath: event.pagePath,
      utmSource: event.utmSource || 'organic',
      utmMedium: event.utmMedium || 'direct',
      utmCampaign: event.utmCampaign,
      utmContent: event.utmContent,
      metadata: event.metadata,
      createdAt: new Date(),
    });
  }

  public async getFunnelReport(startDate?: Date, endDate?: Date): Promise<Record<string, any>> {
    const match: Record<string, any> = {};
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = startDate;
      if (endDate) match.createdAt.$lte = endDate;
    }

    const eventCounts = await FunnelEvent.aggregate([
      { $match: match },
      { $group: { _id: '$eventType', count: { $sum: 1 }, uniqueVisitors: { $addToSet: '$visitorId' } } },
    ]);

    const counts: Record<string, { total: number; unique: number }> = {
      PAGE_VIEW: { total: 0, unique: 0 },
      LEAD_CAPTURED: { total: 0, unique: 0 },
      DEMO_REQUESTED: { total: 0, unique: 0 },
      REGISTERED: { total: 0, unique: 0 },
      TRIAL_ACTIVATED: { total: 0, unique: 0 },
      PAID_CONVERTED: { total: 0, unique: 0 },
    };

    eventCounts.forEach((e) => {
      if (counts[e._id]) {
        counts[e._id].total = e.count;
        counts[e._id].unique = e.uniqueVisitors.length;
      }
    });

    const visitors = Math.max(1, counts.PAGE_VIEW.unique || counts.PAGE_VIEW.total);
    const leads = counts.LEAD_CAPTURED.unique + counts.DEMO_REQUESTED.unique;
    const registrations = counts.REGISTERED.unique;
    const activations = counts.TRIAL_ACTIVATED.unique;
    const paid = counts.PAID_CONVERTED.unique;

    const leadConversionRate = Math.round((leads / visitors) * 10000) / 100;
    const registrationConversionRate = Math.round((registrations / visitors) * 10000) / 100;
    const trialActivationRate = registrations > 0 ? Math.round((activations / registrations) * 10000) / 100 : 100;
    const paidConversionRate = activations > 0 ? Math.round((paid / activations) * 10000) / 100 : 0;

    // Top Acquisition Channels
    const topChannels = await FunnelEvent.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$utmSource',
          pageViews: { $sum: { $cond: [{ $eq: ['$eventType', 'PAGE_VIEW'] }, 1, 0] } },
          leads: { $sum: { $cond: [{ $in: ['$eventType', ['LEAD_CAPTURED', 'DEMO_REQUESTED']] }, 1, 0] } },
          conversions: { $sum: { $cond: [{ $eq: ['$eventType', 'PAID_CONVERTED'] }, 1, 0] } },
        },
      },
      { $sort: { pageViews: -1 } },
      { $limit: 10 },
    ]);

    return {
      funnel: {
        visitors,
        leads,
        registrations,
        activations,
        paid,
      },
      conversionRates: {
        visitorToLeadPercent: leadConversionRate,
        visitorToRegistrationPercent: registrationConversionRate,
        registrationToActivationPercent: trialActivationRate,
        activationToPaidPercent: paidConversionRate,
      },
      topChannels: topChannels.map((c) => ({
        channel: c._id || 'organic',
        pageViews: c.pageViews,
        leads: c.leads,
        conversions: c.conversions,
      })),
    };
  }
}

export const growthService = new GrowthService();

