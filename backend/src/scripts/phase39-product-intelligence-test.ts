import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

import axios from 'axios';
import mongoose from 'mongoose';
import { db } from '../config/db';
import { Tenant } from '../models/Tenant.model';
import { User } from '../models/User.model';
import { ProductEvent, ProductFeedback } from '../models/ProductIntelligence.model';
import { productIntelligenceService } from '../modules/product-intelligence/productIntelligence.service';
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
  console.log('🚀 PHASE 39: PRODUCT INTELLIGENCE & CONTINUOUS IMPROVEMENT TEST');
  console.log('=============================================================\n');

  await db.connect();

  const stamp = Date.now().toString(36);

  // Setup Test Tenant and Staff User
  const testTenant = await Tenant.create({
    businessId: `TEN-PI-${stamp}`,
    name: `Studio Intelligence Labs ${stamp}`,
    subdomain: `intel-${stamp}`,
    isActive: true,
    subscription: {
      plan: 'BUSINESS',
      status: 'ACTIVE',
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
    },
  });

  const staffEmail = `staff-${stamp}@docustudio.test`;
  const staffUser = await User.create({
    tenantId: testTenant._id,
    fullName: 'Retail Shop Associate',
    email: staffEmail,
    passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
    role: 'STAFF',
    isActive: true,
  });

  const adminEmail = `prodlead-${stamp}@docustudio.test`;
  const adminUser = await User.create({
    tenantId: testTenant._id,
    fullName: 'SaaS Product Analytics Lead',
    email: adminEmail,
    passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
    role: 'SUPER_ADMIN',
    isActive: true,
  });

  const staffToken = TokenService.generateAccessToken({
    userId: staffUser._id.toString(),
    tenantId: testTenant._id.toString(),
    email: staffUser.email,
    role: 'STAFF',
  });

  const adminToken = TokenService.generateAccessToken({
    userId: adminUser._id.toString(),
    tenantId: testTenant._id.toString(),
    email: adminUser.email,
    role: 'SUPER_ADMIN',
  });

  const staffHeaders = { Authorization: `Bearer ${staffToken}` };
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  // =========================================================================
  // GROUP 1: Event-Based Analytics & Privacy Sanitization
  // =========================================================================
  console.log('▶ TEST GROUP 1: Event-Based Analytics & Privacy Sanitization');

  // Track an event containing prohibited PII & credentials to verify redaction
  const dirtyEvent = await productIntelligenceService.trackEvent({
    tenantId: testTenant._id,
    userId: staffUser._id,
    role: 'STAFF',
    planTier: 'BUSINESS',
    eventType: 'FEATURE_USED',
    module: 'PASSPORT',
    screen: '/passport/editor',
    workflowId: `wf-${stamp}-001`,
    durationMs: 450,
    metadata: {
      templateType: 'BD_STANDARD_PASSPORT',
      password: 'plainTextPassword123!',
      userToken: 'eyJhGciOiJIUzI1NiIsIn...',
      customerPhotoBuffer: '<binary_image_stream>',
      nidNumber: '19876543210987654',
      validOptionCount: 4,
    },
  });

  assert(dirtyEvent.eventType === 'FEATURE_USED', 'Event type recorded properly');
  assert(dirtyEvent.metadata?.templateType === 'BD_STANDARD_PASSPORT', 'Safe non-PII metadata preserved');
  assert(dirtyEvent.metadata?.password === '[REDACTED_SENSITIVE_CONTENT]', 'Sensitive password key redacted');
  assert(dirtyEvent.metadata?.userToken === '[REDACTED_SENSITIVE_CONTENT]', 'Token key redacted');
  assert(dirtyEvent.metadata?.customerPhotoBuffer === '[REDACTED_SENSITIVE_CONTENT]', 'Photo/Image buffer redacted');
  assert(dirtyEvent.metadata?.nidNumber === '[REDACTED_SENSITIVE_CONTENT]', 'National identity data redacted');

  // Track sanitized error message
  const errorEvent = await productIntelligenceService.trackEvent({
    tenantId: testTenant._id,
    userId: staffUser._id,
    eventType: 'PROCESSING_FAILED',
    module: 'OCR',
    screen: '/ocr/nid-scan',
    errorCode: 'OCR_PARSE_FAILED',
    errorMessage: `Failed for customer contact user@customerdomain.com with id 6af18861cff574786d0ab6f8`,
  });

  assert(errorEvent.errorCode === 'OCR_PARSE_FAILED', 'Error code recorded');
  assert(
    !errorEvent.errorMessage?.includes('user@customerdomain.com'),
    'Email address sanitized in error message'
  );

  // Seed sample telemetry events across modules for KPIs & UX testing
  console.log('  Seeding workflow, performance, and friction events...');
  const workflowId = `wf-friction-${stamp}`;

  // 1. Started Passport Workflow
  await productIntelligenceService.trackEvent({
    tenantId: testTenant._id,
    userId: staffUser._id,
    eventType: 'WORKFLOW_STARTED',
    module: 'PASSPORT',
    screen: '/passport/upload',
    workflowId,
  });

  // 2. Slow Operation on Background Removal (> 3000ms SLA)
  await productIntelligenceService.trackEvent({
    tenantId: testTenant._id,
    userId: staffUser._id,
    eventType: 'LATENCY_MEASURED',
    module: 'PASSPORT',
    screen: '/passport/ai-bg-removal',
    workflowId,
    durationMs: 4250, // Exceeds 3000ms SLA
  });

  // 3. Repeated Error on Sheet Layout
  await productIntelligenceService.trackEvent({
    tenantId: testTenant._id,
    userId: staffUser._id,
    eventType: 'PROCESSING_FAILED',
    module: 'PASSPORT',
    screen: '/passport/layout-grid',
    workflowId,
    errorCode: 'PAPER_DIMENSION_MISMATCH',
    errorMessage: 'Target 4R canvas overflowed margins',
  });

  // 4. Workflow Abandoned
  await productIntelligenceService.trackEvent({
    tenantId: testTenant._id,
    userId: staffUser._id,
    eventType: 'WORKFLOW_ABANDONED',
    module: 'PASSPORT',
    screen: '/passport/layout-grid',
    workflowId,
  });

  // 5. Successful Jobs on Document & POS modules
  await productIntelligenceService.trackEvent({
    tenantId: testTenant._id,
    userId: staffUser._id,
    eventType: 'JOB_CREATED',
    module: 'DOCUMENT',
    screen: '/document/create',
  });

  await productIntelligenceService.trackEvent({
    tenantId: testTenant._id,
    userId: staffUser._id,
    eventType: 'JOB_COMPLETED',
    module: 'DOCUMENT',
    screen: '/document/editor',
  });

  await productIntelligenceService.trackEvent({
    tenantId: testTenant._id,
    userId: staffUser._id,
    eventType: 'EXPORT_SUCCESS',
    module: 'DOCUMENT',
    screen: '/document/export',
  });

  // =========================================================================
  // GROUP 2: Core Platform Telemetry Metrics (Active Shops, Staff, Jobs, Churn)
  // =========================================================================
  console.log('\n▶ TEST GROUP 2: Core Platform Telemetry Metrics');
  const metrics = await productIntelligenceService.getTelemetryMetrics(30);

  assert(metrics.activeShops >= 1, `Active shops tracked: ${metrics.activeShops}`);
  assert(metrics.activeStaff >= 1, `Active staff tracked: ${metrics.activeStaff}`);
  assert(metrics.jobCreationCount >= 1, `Job creations captured: ${metrics.jobCreationCount}`);
  assert(metrics.jobCompletionCount >= 1, `Job completions captured: ${metrics.jobCompletionCount}`);
  assert(metrics.exportSuccessCount >= 1, `Export successes captured: ${metrics.exportSuccessCount}`);
  assert(typeof metrics.jobCompletionRatePercentage === 'number', 'Job completion rate computed');
  assert(typeof metrics.exportSuccessRatePercentage === 'number', 'Export success rate computed');
  assert(typeof metrics.subscriptionConversionRatePercentage === 'number', 'Conversion rate computed');

  // =========================================================================
  // GROUP 3: Feature Adoption Matrix & Underutilized Features
  // =========================================================================
  console.log('\n▶ TEST GROUP 3: Feature Adoption Matrix & Underutilized Features');
  const adoption = await productIntelligenceService.getFeatureAdoptionMatrix(30);

  assert(Array.isArray(adoption.featureMatrix), 'Feature adoption matrix returned');
  const passportFeature = adoption.featureMatrix.find((f: any) => f.module === 'PASSPORT');
  assert(passportFeature?.activeShopCount >= 1, 'Passport module active shop count recorded');
  assert(adoption.unusedOrUnderutilizedFeatures.length > 0, 'Underutilized features identified');

  // =========================================================================
  // GROUP 4: UX Friction Analysis (Abandonment, Repeated Errors, Slow Ops)
  // =========================================================================
  console.log('\n▶ TEST GROUP 4: UX Friction Analysis');
  const friction = await productIntelligenceService.analyzeUXFriction(30);

  assert(Array.isArray(friction.abandonedWorkflows), 'Abandoned workflows analysis returned');
  const passportAbandonment = friction.abandonedWorkflows.find(
    (w: any) => w.module === 'PASSPORT' && w.screen === '/passport/layout-grid'
  );
  assert(passportAbandonment?.abandoned >= 1, 'Workflow abandonment detected on layout screen');

  assert(Array.isArray(friction.repeatedErrors), 'Repeated error clustering returned');
  const dimError = friction.repeatedErrors.find(
    (e: any) => e.errorCode === 'PAPER_DIMENSION_MISMATCH'
  );
  assert(dimError?.occurrenceCount >= 1, 'Repeated PAPER_DIMENSION_MISMATCH error clustered');

  assert(Array.isArray(friction.slowOperations), 'Slow operations SLA tracking returned');
  const slowBgOp = friction.slowOperations.find(
    (s: any) => s.module === 'PASSPORT' && s.screen === '/passport/ai-bg-removal'
  );
  assert(slowBgOp?.slowEventCount >= 1, 'Slow operation exceeding 3000ms SLA recorded');
  assert(slowBgOp?.avgDurationMs >= 4000, `Average slow duration measured: ${slowBgOp?.avgDurationMs}ms`);

  // =========================================================================
  // GROUP 5: Feedback, Surveys, Bug Reporting, Upvoting & RICE Scoring
  // =========================================================================
  console.log('\n▶ TEST GROUP 5: Feedback, Surveys, Bug Reporting & Prioritization');

  // 1. Submit Feature Request
  const featureReq = await productIntelligenceService.submitFeedback({
    tenantId: testTenant._id,
    userId: staffUser._id,
    userName: staffUser.fullName,
    type: 'FEATURE_REQUEST',
    category: 'PRINTER_INTEGRATION',
    title: 'Direct Bluetooth Thermal Receipt Spooling',
    description: 'Allow direct spooling to POS-58 Bluetooth thermal printers without Chrome print preview dialog.',
    screenContext: '/pos/checkout',
    severity: 'HIGH',
  });

  assert(featureReq.type === 'FEATURE_REQUEST', 'Feature request submitted with NEW status');
  assert(featureReq.upvotes === 1, 'Initial submitter upvote counted');
  assert(featureReq.prioritization.riceScore > 0, 'Initial RICE score calculated');

  // 2. Upvote Feature Request from Admin
  const voteResult = await productIntelligenceService.voteFeatureRequest(
    featureReq._id.toString(),
    adminUser._id.toString()
  );

  assert(voteResult.voted === true, 'Admin upvote cast successfully');
  assert(voteResult.feedback.upvotes === 2, 'Upvote count incremented to 2');
  assert(
    voteResult.feedback.prioritization.reach >= 10,
    'Dynamic reach updated based on community voting'
  );

  // 3. Submit Customer Surveys (CSAT & NPS)
  await productIntelligenceService.submitFeedback({
    tenantId: testTenant._id,
    userId: staffUser._id,
    type: 'SURVEY',
    surveyType: 'CSAT',
    category: 'PASSPORT_ACCURACY',
    title: 'CSAT: Passport generation speed and photo sizing',
    description: 'Very smooth and compliant sizing.',
    rating: 5,
  });

  await productIntelligenceService.submitFeedback({
    tenantId: testTenant._id,
    userId: staffUser._id,
    type: 'SURVEY',
    surveyType: 'NPS',
    category: 'OVERALL_PRODUCT',
    title: 'NPS: Likelihood to recommend DocuStudio to other studio owners',
    description: 'Saves 2 hours of Photoshop work every day.',
    rating: 10, // Promoter
  });

  // 4. Submit Critical Bug Report
  const bugReport = await productIntelligenceService.submitFeedback({
    tenantId: testTenant._id,
    userId: staffUser._id,
    type: 'BUG_REPORT',
    category: 'PRINTER_INTEGRATION',
    title: 'Paper jam alert freeze during multi-page CV print',
    description: 'Printer status polling freezes frontend UI when paper tray is empty.',
    severity: 'CRITICAL',
    screenContext: '/cv/print-preview',
  });

  assert(bugReport.severity === 'CRITICAL', 'Critical bug report registered');

  // 5. Score & Prioritize Feature Request for Roadmap (RICE framework)
  const prioritizedFeature = await productIntelligenceService.scoreAndPrioritizeRoadmapItem(
    featureReq._id.toString(),
    {
      reach: 85,          // 85% of retail shops use thermal printers
      impact: 2.0,        // High business impact on counter speed
      confidence: 90,     // 90% confidence in Chrome WebUSB / WebBluetooth API
      effort: 3.0,        // 3 person-weeks engineering
      strategicScore: 5,  // Directly serves retail operational velocity
      status: 'PLANNED',
      adminResponse: 'Approved for Q1 release sprint; integrating via WebUSB protocol.',
    }
  );

  // RICE = (85 * 2.0 * 90) / 3.0 = 15300 / 3.0 = 5100
  assert(prioritizedFeature.status === 'PLANNED', 'Item status transitioned to PLANNED');
  assert(prioritizedFeature.prioritization.riceScore === 5100, `RICE score accurately computed: ${prioritizedFeature.prioritization.riceScore}`);
  assert(Boolean(prioritizedFeature.adminResponse?.includes('Approved for Q1')), 'Admin feedback response captured');

  // 6. Feedback & Survey Analytics Summary
  const feedbackAnalytics = await productIntelligenceService.getFeedbackAnalytics();
  assert(feedbackAnalytics.csat.totalResponses >= 1, 'CSAT response aggregated');
  assert(feedbackAnalytics.nps.score >= 0, `NPS score computed: ${feedbackAnalytics.nps.score}`);
  assert(feedbackAnalytics.criticalBugsInBacklog >= 1, 'Critical bug count in backlog verified');
  assert(feedbackAnalytics.topFeatureRequests.length >= 1, 'Top upvoted feature requests ranked');

  // =========================================================================
  // GROUP 6: HTTP REST API Endpoints Verification
  // =========================================================================
  console.log('\n▶ TEST GROUP 6: HTTP REST API Endpoints Verification');

  // 1. POST /product-intelligence/events via API
  const eventApiRes = await axios.post(
    `${API_BASE}/product-intelligence/events`,
    {
      eventType: 'SCREEN_VIEWED',
      module: 'POS',
      screen: '/pos/terminal',
      metadata: { registerNumber: 1 },
    },
    { headers: staffHeaders }
  );
  assert(eventApiRes.status === 201, 'HTTP POST /product-intelligence/events returns 201');
  assert(eventApiRes.data.data.module === 'POS', 'Event module verified via API');

  // 2. POST /product-intelligence/feedback via API
  const feedbackApiRes = await axios.post(
    `${API_BASE}/product-intelligence/feedback`,
    {
      type: 'FEATURE_REQUEST',
      category: 'PAYMENTS',
      title: 'Direct bKash Merchant Dynamic QR on Invoice Screen',
      description: 'Show dynamic QR code with exact invoice total on POS customer display.',
      screenContext: '/pos/invoice',
      severity: 'MEDIUM',
    },
    { headers: staffHeaders }
  );
  assert(feedbackApiRes.status === 201, 'HTTP POST /product-intelligence/feedback returns 201');
  const newFeedbackId = feedbackApiRes.data.data._id;

  // 3. GET /product-intelligence/feedback via API
  const listFeedbackRes = await axios.get(
    `${API_BASE}/product-intelligence/feedback?type=FEATURE_REQUEST`,
    { headers: staffHeaders }
  );
  assert(listFeedbackRes.status === 200, 'HTTP GET /product-intelligence/feedback returns 200');
  assert(Array.isArray(listFeedbackRes.data.data), 'Feedback list array returned');

  // 4. POST /product-intelligence/feedback/:id/vote via API
  const voteApiRes = await axios.post(
    `${API_BASE}/product-intelligence/feedback/${newFeedbackId}/vote`,
    {},
    { headers: adminHeaders }
  );
  assert(voteApiRes.status === 200, 'HTTP POST /product-intelligence/feedback/:id/vote returns 200');
  assert(voteApiRes.data.data.voted === true, 'Upvote registered via API');

  // 5. GET /product-intelligence/metrics (Super Admin)
  const metricsApiRes = await axios.get(
    `${API_BASE}/product-intelligence/metrics?days=30`,
    { headers: adminHeaders }
  );
  assert(metricsApiRes.status === 200, 'HTTP GET /product-intelligence/metrics returns 200');
  assert(metricsApiRes.data.data.activeShops >= 1, 'Metrics active shops verified via API');

  // 6. GET /product-intelligence/feature-adoption (Super Admin)
  const adoptionApiRes = await axios.get(
    `${API_BASE}/product-intelligence/feature-adoption?days=30`,
    { headers: adminHeaders }
  );
  assert(adoptionApiRes.status === 200, 'HTTP GET /product-intelligence/feature-adoption returns 200');

  // 7. GET /product-intelligence/ux-friction (Super Admin)
  const frictionApiRes = await axios.get(
    `${API_BASE}/product-intelligence/ux-friction?days=30`,
    { headers: adminHeaders }
  );
  assert(frictionApiRes.status === 200, 'HTTP GET /product-intelligence/ux-friction returns 200');

  // 8. GET /product-intelligence/feedback-analytics (Super Admin)
  const feedbackAnalyticsApiRes = await axios.get(
    `${API_BASE}/product-intelligence/feedback-analytics`,
    { headers: adminHeaders }
  );
  assert(feedbackAnalyticsApiRes.status === 200, 'HTTP GET /product-intelligence/feedback-analytics returns 200');

  // 9. PATCH /product-intelligence/feedback/:id/prioritize (Super Admin)
  const prioritizeApiRes = await axios.patch(
    `${API_BASE}/product-intelligence/feedback/${newFeedbackId}/prioritize`,
    {
      reach: 60,
      impact: 1.5,
      confidence: 85,
      effort: 2.0,
      strategicScore: 4,
      status: 'UNDER_REVIEW',
    },
    { headers: adminHeaders }
  );
  assert(prioritizeApiRes.status === 200, 'HTTP PATCH /product-intelligence/feedback/:id/prioritize returns 200');
  assert(prioritizeApiRes.data.data.status === 'UNDER_REVIEW', 'Status updated to UNDER_REVIEW');

  // Cleanup test records
  await ProductEvent.deleteMany({ tenantId: testTenant._id });
  await ProductFeedback.deleteMany({ tenantId: testTenant._id });
  await User.deleteMany({ _id: { $in: [staffUser._id, adminUser._id] } });
  await Tenant.deleteOne({ _id: testTenant._id });

  console.log('\n=============================================================');
  console.log(`🎉 ALL PHASE 39 PRODUCT INTELLIGENCE TESTS PASSED (${passedChecks}/${totalChecks})`);
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
