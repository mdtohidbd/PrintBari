import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

import axios from 'axios';
import mongoose from 'mongoose';
import { db } from '../config/db';
import { Tenant } from '../models/Tenant.model';
import { User } from '../models/User.model';
import { Lead, ReferralProgram, FunnelEvent } from '../models/GrowthMarketing.model';
import { growthService } from '../modules/growth/growth.service';
import { TokenService } from '../utils/token';

const API_BASE = 'http://localhost:5000/api/v1';

let passedChecks = 0;
let totalChecks = 0;

function assert(condition: boolean, message: string) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('\n=============================================================');
  console.log('🚀 PHASE 36: SAAS GROWTH, MARKETING & SALES INFRASTRUCTURE TEST');
  console.log('=============================================================\n');

  await db.connect();

  const stamp = Date.now().toString(36);

  // Group 1: Inbound Lead Capture & Demo Scheduling
  console.log('▶ TEST GROUP 1: Inbound Lead Capture & Demo Scheduling');

  // Negative test: Consent required
  let consentBlocked = false;
  try {
    await growthService.captureLead({
      fullName: 'No Consent User',
      shopName: 'Blocked Studio',
      email: `noconsent-${stamp}@test.com`,
      phone: '01711000000',
      city: 'Dhaka',
      marketingConsent: false, // Invalid
    });
  } catch (err: any) {
    consentBlocked = true;
  }
  assert(consentBlocked, 'Lead capture without marketing consent is rejected (Data Privacy Compliance)');

  // Positive Lead Capture
  const lead1 = await growthService.captureLead({
    fullName: 'Mohammad Farhan',
    shopName: 'Farhan Digital Color Lab',
    email: `farhan-${stamp}@studio.test`,
    phone: '01712345678',
    city: 'Dhaka',
    district: 'Dhaka North',
    shopType: 'PHOTO_STUDIO',
    estimatedMonthlyJobs: 650,
    currentSoftware: 'Photoshop 7.0 & CS6',
    utmSource: 'nilkhet_field_sales',
    utmMedium: 'flyer_qr',
    utmCampaign: 'dhaka_studio_onboarding_q4',
    marketingConsent: true,
    ipAddress: '103.205.180.12',
    isDemoRequest: true,
    preferredDate: new Date(Date.now() + 48 * 3600 * 1000),
    demoNotes: 'Interested in Epson L805 passport 4R cut layout speed',
  });

  assert(!!lead1._id, 'Inbound demo lead captured successfully');
  assert(lead1.status === 'DEMO_SCHEDULED', 'Lead status initialized to DEMO_SCHEDULED');
  assert(lead1.followUps.length >= 1, 'Initial follow-up task automatically logged');

  // Schedule / Re-schedule Demo
  const demoDate = new Date(Date.now() + 72 * 3600 * 1000);
  const scheduledLead = await growthService.scheduleDemo(
    lead1._id.toString(),
    demoDate,
    'Confirmed 15-minute Google Meet link via WhatsApp'
  );
  assert(scheduledLead.demoScheduledAt?.getTime() === demoDate.getTime(), 'Demo date successfully scheduled');

  // Complete Demo
  const completedLead = await growthService.completeDemo(
    lead1._id.toString(),
    'Customer very impressed with 1-click NID dual stitching. Sent Starter Plan proposal.'
  );
  assert(completedLead.status === 'DEMO_COMPLETED', 'Demo successfully marked completed with outcome notes');

  // Group 2: Sales Pipeline Management & Follow-ups
  console.log('\n▶ TEST GROUP 2: Sales Pipeline Management & Conversion Tracking');

  // Advance stage to PROPOSAL_SENT
  const proposalLead = await growthService.updateLeadStatus(
    lead1._id.toString(),
    'PROPOSAL_SENT'
  );
  assert(proposalLead.status === 'PROPOSAL_SENT', 'Lead stage updated to PROPOSAL_SENT');

  // Add Follow-Up Note
  const followedUpLead = await growthService.addFollowUp(
    lead1._id.toString(),
    'Called owner on phone. Discussed annual 2-month discount option.',
    new Date(Date.now() + 24 * 3600 * 1000)
  );
  assert(followedUpLead.followUps.length >= 3, 'Multiple sales follow-up notes preserved with audit history');

  // Mark Won
  const wonTenantId = new mongoose.Types.ObjectId();
  const wonLead = await growthService.updateLeadStatus(
    lead1._id.toString(),
    'WON',
    undefined,
    wonTenantId.toString()
  );
  assert(wonLead.status === 'WON', 'Lead advanced to WON stage');
  assert(wonLead.convertedTenantId?.toString() === wonTenantId.toString(), 'Converted tenant reference linked to won lead');

  // Pipeline Statistics
  const pipelineStats = await growthService.getPipelineStatistics();
  assert(pipelineStats.totalLeads >= 1, `Pipeline tracks total leads: ${pipelineStats.totalLeads}`);
  assert(pipelineStats.stages.WON >= 1, `Won stage correctly counts converted leads: ${pipelineStats.stages.WON}`);
  assert(pipelineStats.winRatePercent > 0, `Win rate calculated: ${pipelineStats.winRatePercent}%`);
  assert(pipelineStats.sourceBreakdown.length >= 1, 'Source breakdown maps leads and conversions by UTM source');

  // Group 3: Automated Lifecycle Email & Onboarding Nurture
  console.log('\n▶ TEST GROUP 3: Automated Onboarding Nurture Sequences');
  const nurtureTemplates = growthService.getTrialNurtureTemplates();
  assert(nurtureTemplates.length === 6, 'Trial nurture sequence has 6 strategic lifecycle touchpoints');
  assert(nurtureTemplates[0].day === 0 && nurtureTemplates[0].ctaUrl === '/onboarding', 'Day 0 welcomes user to /onboarding');
  assert(nurtureTemplates[1].day === 2 && nurtureTemplates[1].ctaUrl === '/studio/passport', 'Day 2 drives Passport studio activation');
  assert(nurtureTemplates[2].day === 4 && nurtureTemplates[2].ctaUrl === '/printers', 'Day 4 prompts Hardware Spooler setup');
  assert(nurtureTemplates[4].day === 11 && nurtureTemplates[4].subject.includes('Save 2 Months'), 'Day 11 delivers annual prepaid incentive');

  // Group 4: Referral & Affiliate Program
  console.log('\n▶ TEST GROUP 4: Referral & Affiliate System');
  const referrerTenant = await Tenant.create({
    businessId: `REF-TEN-${stamp}`,
    name: `Star Copy Center ${stamp}`,
    subdomain: `star-${stamp}`,
    isActive: true,
    subscription: {
      plan: 'PRO',
      status: 'ACTIVE',
      trialEndsAt: new Date(Date.now() + 30 * 86400000),
    },
  });

  const referralProgram = await growthService.ensureReferralProgram(referrerTenant._id.toString());
  assert(!!referralProgram.referralCode, `Unique branded referral code generated: ${referralProgram.referralCode}`);

  const validation = await growthService.validateReferralCode(referralProgram.referralCode);
  assert(validation.valid === true, 'Referral code validated successfully via public lookup');

  // Prevent Self-Referral
  const selfReferral = await growthService.attributeReferral(
    referrerTenant._id.toString(),
    referralProgram.referralCode
  );
  assert(selfReferral === false, 'Self-referral correctly rejected');

  // Successful Friend Referral
  const newReferredTenant = await Tenant.create({
    businessId: `NEW-TEN-${stamp}`,
    name: `Friend Print ${stamp}`,
    subdomain: `friend-${stamp}`,
    isActive: true,
    subscription: {
      plan: 'STARTER',
      status: 'ACTIVE',
      trialEndsAt: new Date(Date.now() + 30 * 86400000),
    },
  });

  const attributed = await growthService.attributeReferral(
    newReferredTenant._id.toString(),
    referralProgram.referralCode
  );
  assert(attributed === true, 'Referral successfully attributed to referrer');

  const updatedProgram = await ReferralProgram.findOne({ tenantId: referrerTenant._id });
  assert(updatedProgram?.totalReferrals === 1, 'Referral count incremented');
  assert(updatedProgram?.rewardMonthsEarned === 1, 'Referrer awarded 1 free subscription credit month');

  // Group 5: Marketing Analytics & Funnel Tracking
  console.log('\n▶ TEST GROUP 5: Marketing Analytics & Funnel Tracking');
  const visitorId = `vis-${stamp}`;

  await growthService.recordFunnelEvent({
    visitorId,
    eventType: 'PAGE_VIEW',
    pagePath: '/',
    utmSource: 'google_search',
    utmCampaign: 'photocopy_software_bd',
  });

  await growthService.recordFunnelEvent({
    visitorId,
    eventType: 'LEAD_CAPTURED',
    pagePath: '/contact',
    utmSource: 'google_search',
    utmCampaign: 'photocopy_software_bd',
  });

  await growthService.recordFunnelEvent({
    visitorId,
    eventType: 'REGISTERED',
    pagePath: '/register',
    utmSource: 'google_search',
    utmCampaign: 'photocopy_software_bd',
  });

  await growthService.recordFunnelEvent({
    visitorId,
    eventType: 'TRIAL_ACTIVATED',
    pagePath: '/onboarding',
    utmSource: 'google_search',
    utmCampaign: 'photocopy_software_bd',
  });

  await growthService.recordFunnelEvent({
    visitorId,
    eventType: 'PAID_CONVERTED',
    pagePath: '/subscription',
    utmSource: 'google_search',
    utmCampaign: 'photocopy_software_bd',
  });

  const funnelReport = await growthService.getFunnelReport();
  assert(funnelReport.funnel.visitors >= 1, `Funnel tracks website visitors: ${funnelReport.funnel.visitors}`);
  assert(funnelReport.funnel.leads >= 1, `Funnel tracks captured leads: ${funnelReport.funnel.leads}`);
  assert(funnelReport.funnel.registrations >= 1, `Funnel tracks registrations: ${funnelReport.funnel.registrations}`);
  assert(funnelReport.conversionRates.visitorToLeadPercent > 0, `Visitor-to-Lead conversion calculated: ${funnelReport.conversionRates.visitorToLeadPercent}%`);
  assert(funnelReport.topChannels.length >= 1, 'Top acquisition channels identified with campaign attribution');

  // Group 6: HTTP API Endpoints Verification
  console.log('\n▶ TEST GROUP 6: HTTP API Endpoints Verification');

  // Create Super Admin user to test secured API
  const adminEmail = `growthadmin-${stamp}@docustudio.test`;
  const adminUser = await User.create({
    tenantId: referrerTenant._id,
    fullName: 'VP of Growth',
    email: adminEmail,
    passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
    role: 'SUPER_ADMIN',
    isActive: true,
  });

  const adminToken = TokenService.generateAccessToken({
    userId: adminUser._id.toString(),
    tenantId: referrerTenant._id.toString(),
    email: adminUser.email,
    role: 'SUPER_ADMIN',
  });

  const authHeaders = { Authorization: `Bearer ${adminToken}` };

  // 1. Public Lead Submission
  const leadRes = await axios.post(`${API_BASE}/growth/leads`, {
    fullName: 'Kazi Mofazzal',
    shopName: 'Mofazzal Computer Point',
    email: `mofazzal-${stamp}@test.com`,
    phone: '01899112233',
    city: 'Sylhet',
    shopType: 'COMPUTER_CENTER',
    marketingConsent: true,
    utmSource: 'sylhet_direct_mail',
  });
  assert(leadRes.status === 201, 'HTTP POST /growth/leads returns 201 Created');
  const capturedId = leadRes.data.data._id;

  // 2. Public Demo Schedule
  const demoRes = await axios.post(`${API_BASE}/growth/demos`, {
    leadId: capturedId,
    demoDate: new Date(Date.now() + 86400000).toISOString(),
    demoNotes: 'Wants to test Bengali OCR accuracy',
  });
  assert(demoRes.status === 200, 'HTTP POST /growth/demos returns 200');

  // 3. Public Referral Validation
  const valRes = await axios.get(`${API_BASE}/growth/referrals/validate/${referralProgram.referralCode}`);
  assert(valRes.status === 200 && valRes.data.data.valid === true, 'HTTP GET /growth/referrals/validate returns valid referral');

  // 4. Public Funnel Event Recording
  const evtRes = await axios.post(`${API_BASE}/growth/analytics/events`, {
    visitorId: 'web-anon-123',
    eventType: 'PAGE_VIEW',
    pagePath: '/features',
    utmSource: 'facebook_retargeting',
  });
  assert(evtRes.status === 200, 'HTTP POST /growth/analytics/events records event');

  // 5. Public Nurture Templates
  const nurtureRes = await axios.get(`${API_BASE}/growth/nurture-templates`);
  assert(nurtureRes.status === 200 && nurtureRes.data.data.length === 6, 'HTTP GET /growth/nurture-templates returns all templates');

  // 6. Super Admin Pipeline Query
  const pipeRes = await axios.get(`${API_BASE}/growth/pipeline`, { headers: authHeaders });
  assert(pipeRes.status === 200 && pipeRes.data.data.total >= 2, 'HTTP GET /growth/pipeline returns lead list');

  // 7. Super Admin Pipeline Stats
  const pipeStatsRes = await axios.get(`${API_BASE}/growth/pipeline/stats`, { headers: authHeaders });
  assert(pipeStatsRes.status === 200 && pipeStatsRes.data.data.totalLeads >= 2, 'HTTP GET /growth/pipeline/stats returns conversion rates');

  // 8. Super Admin Funnel Analytics
  const funnelRes = await axios.get(`${API_BASE}/growth/analytics/funnel`, { headers: authHeaders });
  assert(funnelRes.status === 200 && funnelRes.data.data.funnel.visitors >= 1, 'HTTP GET /growth/analytics/funnel returns full funnel metrics');

  // Cleanup
  await Tenant.deleteMany({ _id: { $in: [referrerTenant._id, newReferredTenant._id] } });
  await User.deleteOne({ _id: adminUser._id });
  await Lead.deleteMany({ _id: { $in: [lead1._id, capturedId] } });

  console.log('\n=============================================================');
  console.log(`🎉 ALL PHASE 36 GROWTH & SALES TESTS PASSED (${passedChecks}/${totalChecks})`);
  console.log('=============================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

runTests().catch(async (err) => {
  console.error('\n❌ TEST RUNNER FAILED WITH ERROR:', err);
  if (err.response) {
    console.error('Response status:', err.response.status);
    console.error('Response data:', JSON.stringify(err.response.data, null, 2));
  }
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

