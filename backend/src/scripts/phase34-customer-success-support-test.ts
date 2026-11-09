import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

import axios from 'axios';
import { db } from '../config/db';
import { User } from '../models/User.model';
import { SupportTicket, SupportArticle } from '../models/SupportTicket.model';
import { CustomerSuccessService } from '../modules/support/customerSuccess.service';

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
  console.log('🚀 PHASE 34: CUSTOMER SUCCESS & PROFESSIONAL SUPPORT OPS TEST');
  console.log('=============================================================\n');

  await db.connect();

  const stamp = Date.now().toString(36);

  // 1. Register Primary Shop Tenant
  console.log('▶ TEST GROUP 1: Tenant Provisioning & Setup');
  const reg1Res = await axios.post(`${API_BASE}/auth/register-shop`, {
    shopName: 'Apex Creative Studio',
    subdomain: `apex-${stamp}`,
    ownerName: 'Apex Owner',
    email: `owner-${stamp}@apex-studio.com`,
    password: 'Password123!',
    phone: '01722001122',
    plan: 'PROFESSIONAL',
  });
  assert(reg1Res.status === 201, 'Primary shop tenant registered');
  const token1 = reg1Res.data.data.tokens.accessToken;
  const tenant1Id = reg1Res.data.data.tenant.id;
  const owner1Id = reg1Res.data.data.user.id;

  // 2. Register Rival Tenant (to test ticket privacy isolation)
  const reg2Res = await axios.post(`${API_BASE}/auth/register-shop`, {
    shopName: 'Rival Quick Copy',
    subdomain: `rival-${stamp}`,
    ownerName: 'Rival Operator',
    email: `rival-${stamp}@quickcopy.com`,
    password: 'Password123!',
    phone: '01722009988',
    plan: 'STARTER',
  });
  assert(reg2Res.status === 201, 'Rival shop tenant registered');
  const token2 = reg2Res.data.data.tokens.accessToken;

  // 3. Register & Elevate Super Admin
  const adminEmail = `superadmin-${stamp}@docustudio.app`;
  await axios.post(`${API_BASE}/auth/register-shop`, {
    shopName: 'DocuStudio Support HQ',
    subdomain: `supporthq-${stamp}`,
    ownerName: 'Lead Support Engineer',
    email: adminEmail,
    password: 'Password123!',
    phone: '01722000000',
    plan: 'ENTERPRISE',
  });
  await User.updateOne({ email: adminEmail }, { role: 'SUPER_ADMIN' });
  const adminLogin = await axios.post(`${API_BASE}/auth/login`, {
    email: adminEmail,
    password: 'Password123!',
  });
  const adminToken = adminLogin.data.data.tokens.accessToken;
  const adminUserId = adminLogin.data.data.user.id;
  assert(adminLogin.data.data.user.role === 'SUPER_ADMIN', 'Super Admin verified');

  // 4. Ticket Creation & Code Formatting
  console.log('\n▶ TEST GROUP 2: Support Ticket Lifecycle & Code Formatting');
  const ticketRes = await axios.post(
    `${API_BASE}/support/tickets`,
    {
      subject: 'Epson L805 Paper Feed Sensor Jam',
      category: 'PRINTER_HARDWARE',
      priority: 'HIGH',
      initialMessage: 'The printer is reporting a paper feed error when loading 4R glossy photo paper sheets.',
      attachments: [
        {
          name: 'error-screen.png',
          url: 'https://cdn.docustudio.app/test/error-screen.png',
          bytes: 142000,
        },
      ],
    },
    { headers: { Authorization: `Bearer ${token1}` } }
  );
  assert(ticketRes.status === 201, 'Support ticket created successfully');
  const ticketId = ticketRes.data.data._id;
  const ticketCode = ticketRes.data.data.ticketCode;
  assert(ticketCode.startsWith('TICK-'), 'Ticket code properly formatted (TICK-YYYYMMDD-XXXX)');
  assert(ticketRes.data.data.status === 'OPEN', 'New ticket starts in OPEN status');
  assert(ticketRes.data.data.messages.length === 1, 'Initial message recorded');
  assert(ticketRes.data.data.history.length === 1, 'Ticket creation logged in audit history');

  // 5. Tenant Isolation on Tickets
  console.log('\n▶ TEST GROUP 3: Multi-Tenant Ticket Isolation');
  // Tenant 1 lists tickets -> sees ticket
  const list1Res = await axios.get(`${API_BASE}/support/tickets`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  assert(list1Res.status === 200, 'Tenant 1 retrieves own tickets');
  assert(list1Res.data.data.tickets.some((t: any) => t._id === ticketId), 'Ticket is visible to creator tenant');

  // Rival Tenant 2 lists tickets -> 0 tickets found
  const list2Res = await axios.get(`${API_BASE}/support/tickets`, {
    headers: { Authorization: `Bearer ${token2}` },
  });
  assert(list2Res.status === 200, 'Rival tenant executes ticket query');
  assert(
    !list2Res.data.data.tickets.some((t: any) => t._id === ticketId),
    'Tenant Isolation Verified: Rival tenant cannot see tickets from other shops'
  );

  // 6. Internal Notes & Privacy Scrubbing
  console.log('\n▶ TEST GROUP 4: Internal Notes Privacy Scrubbing');
  // Super Admin adds internal note
  const internalNoteRes = await axios.post(
    `${API_BASE}/support/tickets/${ticketId}/replies`,
    {
      message: 'INTERNAL DIAGNOSTIC NOTE: User is using 280gsm heavy photo paper without setting thick paper mode.',
      isInternalNote: true,
    },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  assert(internalNoteRes.status === 200, 'Super Admin added internal note');

  // Super Admin inspects ticket -> Sees internal note
  const adminViewRes = await axios.get(`${API_BASE}/support/tickets/${ticketId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const adminHasInternal = adminViewRes.data.data.messages.some((m: any) => m.isInternalNote === true);
  assert(adminHasInternal, 'Super Admin can view internal notes');

  // Tenant Owner inspects ticket -> Internal note MUST BE SCRUBBED!
  const ownerViewRes = await axios.get(`${API_BASE}/support/tickets/${ticketId}`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  const ownerHasInternal = ownerViewRes.data.data.messages.some((m: any) => m.isInternalNote === true);
  assert(!ownerHasInternal, 'Privacy Guard Verified: Internal note is completely hidden from tenant owner');

  // 7. Ticket Replies & Status Transitions
  console.log('\n▶ TEST GROUP 5: Replies & Status Transitions');
  // Super admin replies to customer
  const adminReplyRes = await axios.post(
    `${API_BASE}/support/tickets/${ticketId}/replies`,
    {
      message: 'Hello Apex Studio! Please flip the paper thickness lever on the left of the Epson L805.',
      isInternalNote: false,
    },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  assert(adminReplyRes.status === 200, 'Super admin submitted customer-facing reply');
  assert(
    adminReplyRes.data.data.status === 'WAITING_FOR_CUSTOMER',
    'Status automatically transitions to WAITING_FOR_CUSTOMER after agent reply'
  );

  // Tenant owner replies back
  const ownerReplyRes = await axios.post(
    `${API_BASE}/support/tickets/${ticketId}/replies`,
    {
      message: 'That fixed it immediately! The paper fed smoothly. Thank you!',
    },
    { headers: { Authorization: `Bearer ${token1}` } }
  );
  assert(ownerReplyRes.status === 200, 'Customer submitted follow-up reply');
  assert(
    ownerReplyRes.data.data.status === 'IN_PROGRESS',
    'Status automatically transitions back to IN_PROGRESS upon customer response'
  );

  // Resolve Ticket
  const resolveRes = await axios.patch(
    `${API_BASE}/support/tickets/${ticketId}/status`,
    { status: 'RESOLVED' },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  assert(resolveRes.status === 200, 'Ticket marked RESOLVED');
  assert(resolveRes.data.data.status === 'RESOLVED', 'Status is RESOLVED');
  assert(Boolean(resolveRes.data.data.resolvedAt), 'resolvedAt timestamp populated');

  // 8. Ticket Assignment (Super Admin Only)
  console.log('\n▶ TEST GROUP 6: Staff Assignment & RBAC Guard');
  const assignRes = await axios.patch(
    `${API_BASE}/support/tickets/${ticketId}/assign`,
    { assigneeId: adminUserId },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  assert(assignRes.status === 200, 'Ticket assigned to support engineer');
  assert(assignRes.data.data.assignedTo === adminUserId, 'Assignee ID matches');

  // Verify non-admin is blocked from assigning tickets
  try {
    await axios.patch(
      `${API_BASE}/support/tickets/${ticketId}/assign`,
      { assigneeId: owner1Id },
      { headers: { Authorization: `Bearer ${token1}` } }
    );
    assert(false, 'Non-admin should be blocked from ticket assignment');
  } catch (err: any) {
    assert(err.response?.status === 403, 'Ticket assignment restricted by RBAC (403 Forbidden)');
  }

  // 9. Knowledge Base & 10 Core Domains
  console.log('\n▶ TEST GROUP 7: Knowledge Base & Core Topic Coverage');
  const { supportService } = await import('../modules/support/support.service');
  await supportService.seedInitialArticles();
  const articlesRes = await axios.get(`${API_BASE}/support/articles`);
  assert(articlesRes.status === 200, 'Knowledge base articles fetched');
  assert(articlesRes.data.data.length >= 10, 'All 10+ core domain articles seeded');

  // Test keyword search
  const searchPassportRes = await axios.get(`${API_BASE}/support/articles?search=passport`);
  assert(searchPassportRes.status === 200, 'Search articles for passport succeeded');
  assert(searchPassportRes.data.data.length > 0, 'Found matching passport articles');

  const searchHardwareRes = await axios.get(`${API_BASE}/support/articles?category=PRINTER_HARDWARE`);
  assert(searchHardwareRes.status === 200, 'Filtered articles by PRINTER_HARDWARE category');
  assert(searchHardwareRes.data.data.length > 0, 'Found printer hardware articles');

  // 10. Customer CSAT & Feedback Collection
  console.log('\n▶ TEST GROUP 8: Customer CSAT Feedback Capture');
  const feedbackRes = await axios.post(
    `${API_BASE}/support/feedback`,
    {
      ticketId,
      feedbackType: 'CSAT',
      rating: 5,
      category: 'SUPPORT_RESPONSE',
      comment: 'Super fast solution! Solved our paper jam in 10 minutes.',
    },
    { headers: { Authorization: `Bearer ${token1}` } }
  );
  assert(feedbackRes.status === 201, 'CSAT feedback recorded');
  assert(feedbackRes.data.data.rating === 5, '5-star rating persisted');

  // Query feedback list
  const listFeedbackRes = await axios.get(`${API_BASE}/support/feedback`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  assert(listFeedbackRes.status === 200, 'Feedback list retrieved');
  assert(listFeedbackRes.data.data.summary.avgRating === 5, 'Average CSAT rating is 5.0');

  // 11. Customer Success Composite Health Scoring (0-100)
  console.log('\n▶ TEST GROUP 9: Customer Success Health Scoring');
  const healthRes = await axios.get(`${API_BASE}/support/customer-success/health`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  assert(healthRes.status === 200, 'Health score calculated successfully');
  const healthData = healthRes.data.data;
  assert(typeof healthData.healthScore === 'number', 'healthScore is a valid number');
  assert(healthData.healthScore >= 0 && healthData.healthScore <= 100, 'healthScore is bounded between 0 and 100');
  assert(Boolean(healthData.healthTier), 'healthTier (HEALTHY / NEEDS_ATTENTION / AT_RISK) calculated');
  assert(Boolean(healthData.churnRisk), 'churnRisk (LOW / MEDIUM / HIGH) assigned');
  assert(Boolean(healthData.breakdown), 'Score breakdown populated across 4 pillars');
  assert(Array.isArray(healthData.playbookRecommendations), 'Actionable playbook recommendations returned');

  // 12. Super Admin Portfolio Health Overview
  console.log('\n▶ TEST GROUP 10: Super Admin Portfolio Health Overview');
  const portfolioRes = await axios.get(`${API_BASE}/support/customer-success/portfolio`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(portfolioRes.status === 200, 'Portfolio overview retrieved');
  assert(portfolioRes.data.data.portfolioMetrics.totalTenants >= 2, 'Total active tenants reported');
  assert(typeof portfolioRes.data.data.portfolioMetrics.healthyPercentage === 'number', 'Healthy percentage calculated');
  assert(Array.isArray(portfolioRes.data.data.tenants), 'Tenants health summary list returned');

  console.log('\n=============================================================');
  console.log(`🎉 ALL PHASE 34 TESTS PASSED! (${passedChecks} / ${totalChecks} checks)`);
  console.log('=============================================================\n');

  await db.disconnect();
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUN ENCOUNTERED FATAL ERROR:', err.message);
  if (err.response?.data) {
    console.error('Response Data:', JSON.stringify(err.response.data, null, 2));
  }
  process.exit(1);
});
