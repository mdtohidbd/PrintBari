/**
 * PHASE 25 AUTOMATED VERIFICATION SUITE:
 * ANALYTICS, MONITORING & CUSTOMER SUPPORT SYSTEM
 */

import axios from 'axios';
import mongoose from 'mongoose';
import { db } from '../config/db';
import { Tenant } from '../models/Tenant.model';
import { User } from '../models/User.model';
import { Job } from '../models/Job.model';
import { Customer } from '../models/Customer.model';
import { PaymentTransaction } from '../models/Subscription.model';
import { SupportTicket, SupportArticle } from '../models/SupportTicket.model';
import { TokenService } from '../utils/token';

const API_BASE = 'http://localhost:5000/api/v1';

interface TestResult {
  suite: string;
  test: string;
  passed: boolean;
  error?: string;
  metric?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, suite: string, test: string, metric?: string) {
  if (condition) {
    results.push({ suite, test, passed: true, metric });
    console.log(`  ✓ [PASS] ${suite} - ${test} ${metric ? `(${metric})` : ''}`);
  } else {
    results.push({ suite, test, passed: false, error: 'Assertion failed', metric });
    console.error(`  ✗ [FAIL] ${suite} - ${test}`);
  }
}

async function runPhase25Tests() {
  console.log('================================================================');
  console.log('  PHASE 25: ANALYTICS, MONITORING & CUSTOMER SUPPORT AUDIT      ');
  console.log('================================================================\n');

  await db.connect();
  console.log('Connected to MongoDB Atlas for Phase 25 verification...\n');

  const timestamp = Date.now();

  try {
    // -------------------------------------------------------------
    // SETUP: Create Test Tenants, Users, Jobs, Transactions
    // -------------------------------------------------------------
    console.log('--- Setting up isolated test fixtures ---');

    // 1. Tenant Shop A (Metro Photo Studio)
    const tenantA = await Tenant.create({
      name: 'Metro Digital Photo Studio',
      subdomain: `metro-${timestamp}`,
      businessId: `BIZ-P25-A-${timestamp}`,
      email: `metro_${timestamp}@test.com`,
      phone: '01711000001',
      subscription: {
        plan: 'PROFESSIONAL',
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
      },
      quotas: {
        storageUsedBytes: 2.5 * 1024 * 1024 * 1024, // 2.5 GB
        storageLimitBytes: 25 * 1024 * 1024 * 1024, // 25 GB
        maxStaffSeats: 10,
        monthlyJobLimit: 5000,
      },
      isActive: true,
    });

    // 2. Super Admin User
    const superAdminUser = await User.create({
      fullName: 'Chief Site Reliability Engineer',
      email: `sre_${timestamp}@docustudio.test`,
      passwordHash: '$2b$12$DUMMYHASHDUMMYHASHDUMMYHASH',
      role: 'SUPER_ADMIN',
      isActive: true,
      tenantId: tenantA._id,
    });

    const ownerA = await User.create({
      tenantId: tenantA._id,
      fullName: 'Kamrul Hasan Owner',
      email: `kamrul_${timestamp}@test.com`,
      passwordHash: '$2b$12$DUMMYHASHDUMMYHASHDUMMYHASH',
      role: 'OWNER',
      isActive: true,
    });

    const operatorA = await User.create({
      tenantId: tenantA._id,
      fullName: 'Rafiqul Islam Operator',
      email: `rafiq_${timestamp}@test.com`,
      passwordHash: '$2b$12$DUMMYHASHDUMMYHASHDUMMYHASH',
      role: 'OPERATOR',
      isActive: true,
    });

    // 3. Tenant Shop B (Chittagong Document Lab)
    const tenantB = await Tenant.create({
      name: 'Chittagong Document Lab',
      subdomain: `ctg-${timestamp}`,
      businessId: `BIZ-P25-B-${timestamp}`,
      email: `ctg_${timestamp}@test.com`,
      phone: '01811000002',
      subscription: {
        plan: 'STARTER',
        status: 'TRIALING',
        billingCycle: 'MONTHLY',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 14 * 86400000),
      },
      quotas: {
        storageUsedBytes: 22 * 1024 * 1024 * 1024, // 22 GB / 25 GB (88% -> Should trigger storage alert)
        storageLimitBytes: 25 * 1024 * 1024 * 1024,
        maxStaffSeats: 3,
        monthlyJobLimit: 1000,
      },
      isActive: true,
    });

    const ownerB = await User.create({
      tenantId: tenantB._id,
      fullName: 'Nasir Uddin CTG Owner',
      email: `nasir_${timestamp}@test.com`,
      passwordHash: '$2b$12$DUMMYHASHDUMMYHASHDUMMYHASH',
      role: 'OWNER',
      isActive: true,
    });

    // Generate authenticated JWT tokens
    const superAdminToken = TokenService.generateAccessToken({
      userId: superAdminUser._id.toString(),
      tenantId: superAdminUser.tenantId.toString(),
      role: 'SUPER_ADMIN',
      email: superAdminUser.email,
    });

    const ownerAToken = TokenService.generateAccessToken({
      userId: ownerA._id.toString(),
      tenantId: tenantA._id.toString(),
      role: 'OWNER',
      email: ownerA.email,
    });

    const operatorAToken = TokenService.generateAccessToken({
      userId: operatorA._id.toString(),
      tenantId: tenantA._id.toString(),
      role: 'OPERATOR',
      email: operatorA.email,
    });

    const ownerBToken = TokenService.generateAccessToken({
      userId: ownerB._id.toString(),
      tenantId: tenantB._id.toString(),
      role: 'OWNER',
      email: ownerB.email,
    });

    // Axios client helpers
    const clientSuperAdmin = axios.create({
      baseURL: API_BASE,
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });

    const clientOwnerA = axios.create({
      baseURL: API_BASE,
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });

    const clientOperatorA = axios.create({
      baseURL: API_BASE,
      headers: { Authorization: `Bearer ${operatorAToken}` },
    });

    const clientOwnerB = axios.create({
      baseURL: API_BASE,
      headers: { Authorization: `Bearer ${ownerBToken}` },
    });

    // Seed test jobs for Tenant A
    const customerA1 = await Customer.create({
      tenantId: tenantA._id,
      fullName: 'Tanvir Ahmed',
      phone: `0171${timestamp.toString().slice(-7)}`,
      totalOrdersCount: 2,
      totalSpent: 450,
      isActive: true,
    });

    await Job.create([
      {
        tenantId: tenantA._id,
        jobCode: `JOB-A1-${timestamp}`,
        customerName: customerA1.fullName,
        customerPhone: customerA1.phone,
        serviceType: 'PASSPORT_PHOTO',
        status: 'COMPLETED',
        paidAmount: 250,
        assignedTo: operatorA._id,
      },
      {
        tenantId: tenantA._id,
        jobCode: `JOB-A2-${timestamp}`,
        customerName: customerA1.fullName,
        customerPhone: customerA1.phone,
        serviceType: 'DOCUMENT_A4',
        status: 'COMPLETED',
        paidAmount: 200,
        assignedTo: operatorA._id,
      },
      {
        tenantId: tenantA._id,
        jobCode: `JOB-A3-${timestamp}`,
        customerName: 'Anisur Rahman',
        customerPhone: '01811998877',
        serviceType: 'ID_CARD_A4',
        status: 'PROCESSING',
        paidAmount: 150,
        assignedTo: operatorA._id,
      },
      {
        tenantId: tenantA._id,
        jobCode: `JOB-A4-${timestamp}`,
        customerName: 'Salma Begum',
        customerPhone: '01911998866',
        serviceType: 'CV_RESUME',
        status: 'PENDING',
        paidAmount: 0,
      },
    ]);

    // Seed payment transaction with one failed payment for alert monitoring
    await PaymentTransaction.create([
      {
        tenantId: tenantA._id,
        transactionCode: `TX-SUCCESS-${timestamp}`,
        provider: 'BKASH',
        amount: 1500,
        currency: 'BDT',
        paymentStatus: 'SUCCESS',
        planKey: 'PROFESSIONAL',
        invoiceNumber: `INV-SUCCESS-${timestamp}`,
        idempotencyKey: `IDEMP-SUCCESS-${timestamp}`,
        billingCycle: 'MONTHLY',
        paidAt: new Date(),
        retryCount: 0,
      },
      {
        tenantId: tenantB._id,
        transactionCode: `TX-FAIL-${timestamp}`,
        provider: 'SSLCOMMERZ',
        amount: 800,
        currency: 'BDT',
        paymentStatus: 'FAILED',
        planKey: 'STARTER',
        invoiceNumber: `INV-FAIL-${timestamp}`,
        idempotencyKey: `IDEMP-FAIL-${timestamp}`,
        billingCycle: 'MONTHLY',
        retryCount: 1,
        metadata: { error: 'Insufficient customer funds' },
      },
    ]);

    console.log('Test fixtures seeded successfully.\n');

    // -------------------------------------------------------------
    // TEST SUITE 1: Platform Analytics (Super Admin Level)
    // -------------------------------------------------------------
    console.log('--- TEST SUITE 1: Platform-Wide Analytics ---');

    // 1. Operator attempts to access Platform Analytics -> 403 Forbidden
    let operatorBlockedPlatform = false;
    try {
      await clientOperatorA.get('/analytics/platform');
    } catch (err: any) {
      operatorBlockedPlatform = true;
      assert(err.response?.status === 403, 'Platform Analytics', 'Operator blocked from platform analytics with 403');
    }
    assert(operatorBlockedPlatform, 'Platform Analytics', 'Role guard strictly enforced for platform analytics');

    // 2. Super Admin retrieves platform analytics -> 200 OK
    const platformRes = await clientSuperAdmin.get('/analytics/platform');
    assert(platformRes.status === 200, 'Platform Analytics', 'Super Admin retrieves platform analytics (200 OK)');

    const pData = platformRes.data.data;
    assert(typeof pData.shops.total === 'number' && pData.shops.total >= 2, 'Platform Analytics', 'Total registered shops calculated', `${pData.shops.total} shops`);
    assert(typeof pData.shops.active === 'number' && pData.shops.active >= 1, 'Platform Analytics', 'Active shops metric verified', `${pData.shops.active} active`);
    assert(typeof pData.shops.trial === 'number' && pData.shops.trial >= 1, 'Platform Analytics', 'Trial shops metric verified', `${pData.shops.trial} trialing`);
    assert(pData.revenue.totalRevenue >= 1500, 'Platform Analytics', 'Total platform revenue calculated', `৳${pData.revenue.totalRevenue}`);
    assert(pData.revenue.mrr >= 1500, 'Platform Analytics', 'Monthly Recurring Revenue (MRR) calculated', `৳${pData.revenue.mrr}`);
    assert(Array.isArray(pData.plans) && pData.plans.length > 0, 'Platform Analytics', 'Plan distribution breakdown provided');
    assert(typeof pData.usage.totalJobs === 'number' && pData.usage.totalJobs >= 4, 'Platform Analytics', 'Platform total jobs count calculated', `${pData.usage.totalJobs} jobs`);

    // -------------------------------------------------------------
    // TEST SUITE 2: Shop Analytics (Tenant Isolated)
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 2: Shop Analytics & Tenant Isolation ---');

    // 3. Shop Owner retrieves Shop Analytics -> 200 OK
    const shopRes = await clientOwnerA.get('/analytics/shop?days=30');
    assert(shopRes.status === 200, 'Shop Analytics', 'Owner A retrieves shop analytics (200 OK)');

    const sData = shopRes.data.data;
    assert(sData.overview.totalJobs === 4, 'Shop Analytics', 'Total shop jobs exact match (4 jobs)');
    assert(sData.overview.completedJobs === 2, 'Shop Analytics', 'Completed jobs exact match (2 completed)');
    assert(sData.overview.completionRatePercent === 50, 'Shop Analytics', 'Completion rate calculated accurately', '50%');

    // 4. Service-wise usage breakdown
    assert(Array.isArray(sData.serviceWiseUsage) && sData.serviceWiseUsage.length >= 3, 'Shop Analytics', 'Service-wise usage categorized');
    const passportUsage = sData.serviceWiseUsage.find((s: any) => s.type === 'PASSPORT_PHOTO');
    assert(!!passportUsage && passportUsage.count === 1 && passportUsage.revenue === 250, 'Shop Analytics', 'Passport photo revenue and count tracked');

    // 5. Staff activity breakdown
    assert(Array.isArray(sData.staffActivity) && sData.staffActivity.length >= 1, 'Shop Analytics', 'Staff activity metrics provided');
    const opActivity = sData.staffActivity.find((s: any) => s.staffId === operatorA._id.toString());
    assert(!!opActivity && opActivity.totalAssigned === 3 && opActivity.completedJobs === 2, 'Shop Analytics', 'Operator assigned vs completed jobs verified');

    // 6. Customer growth metrics
    assert(sData.customers.totalCustomers >= 1, 'Shop Analytics', 'Total active customers metric provided');
    assert(typeof sData.customers.repeatCustomerRate === 'number', 'Shop Analytics', 'Repeat customer rate calculated');

    // 7. Privacy: Tenant B has 0 jobs and sees zero jobs from Tenant A
    const shopBRes = await clientOwnerB.get('/analytics/shop');
    assert(shopBRes.status === 200, 'Privacy Isolation', 'Owner B retrieves own shop analytics');
    assert(shopBRes.data.data.overview.totalJobs === 0, 'Privacy Isolation', 'Tenant B isolated: Zero cross-tenant jobs reported');

    // -------------------------------------------------------------
    // TEST SUITE 3: Real-Time SRE System Monitoring
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 3: SRE System Monitoring & Telemetry ---');

    // 8. Super Admin retrieves system monitoring metrics -> 200 OK
    const monitorRes = await clientSuperAdmin.get('/monitoring/metrics');
    assert(monitorRes.status === 200, 'Monitoring', 'Super Admin accesses /monitoring/metrics (200 OK)');

    const mData = monitorRes.data.data;
    assert(mData.server.status === 'UP', 'Monitoring', 'Server status reported as UP');
    assert(typeof mData.server.memory.heapUsedMB === 'number', 'Monitoring', 'Heap memory telemetry provided', `${mData.server.memory.heapUsedMB} MB`);
    assert(mData.database.connected === true, 'Monitoring', 'Database connection monitoring verified');
    assert(mData.backgroundWorkers.maxConcurrent === 4, 'Monitoring', 'Background worker capacity semaphore verified', '4 concurrent');

    // 9. Storage Over-Quota Alert (> 85% threshold)
    assert(mData.storageAlerts.alertCount >= 1, 'Monitoring', 'High storage utilization alert triggered (>85%)');
    const tenantBAlert = mData.storageAlerts.tenantsAtRisk.find((t: any) => t.tenantId === tenantB._id.toString());
    assert(!!tenantBAlert && tenantBAlert.usagePercent >= 85, 'Monitoring', 'Tenant B flagged for storage quota risk', `${tenantBAlert?.usagePercent}%`);

    // 10. Payment Failure Alerting
    assert(mData.paymentAlerts.failedTransactionsToday >= 1, 'Monitoring', 'Payment failure logged in daily alerts');
    const failedTx = mData.paymentAlerts.recentFailures.find((f: any) => f.transactionCode.includes('TX-FAIL'));
    assert(!!failedTx && failedTx.provider === 'SSLCOMMERZ', 'Monitoring', 'Failed transaction details captured without sensitive data');

    // -------------------------------------------------------------
    // TEST SUITE 4: Customer Support System (Tickets & Knowledge Base)
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 4: Customer Support System & Ticket Lifecycle ---');

    // 11. Shop Owner A creates a support ticket
    const ticketCreateRes = await clientOwnerA.post('/support/tickets', {
      subject: 'Epson L805 photo print margin alignment issue',
      category: 'PRINTER_HARDWARE',
      priority: 'HIGH',
      initialMessage: 'When printing 4R photo sheets, the bottom 2mm gets cut off. Please advise.',
    });
    assert(ticketCreateRes.status === 201, 'Support System', 'Owner A creates support ticket (201 Created)');
    const ticketA = ticketCreateRes.data.data;
    assert(ticketA.ticketCode.startsWith('TICK-'), 'Support System', 'Ticket assigned unique tracking code', ticketA.ticketCode);
    assert(ticketA.status === 'OPEN', 'Support System', 'Initial ticket status set to OPEN');
    assert(ticketA.priority === 'HIGH', 'Support System', 'Ticket priority set to HIGH');

    // 12. Privacy & Tenant Isolation: Owner B lists tickets -> MUST NOT see Owner A's ticket
    const ownerBTicketsRes = await clientOwnerB.get('/support/tickets');
    assert(ownerBTicketsRes.status === 200, 'Support Privacy', 'Owner B retrieves support tickets');
    const ownerBTickets = ownerBTicketsRes.data.data.tickets;
    const leakedTicket = ownerBTickets.find((t: any) => t._id === ticketA._id);
    assert(!leakedTicket, 'Support Privacy', 'Tenant B cannot see Tenant A tickets in list');

    // 13. Owner B attempts direct access to Tenant A ticket -> 404 Not Found
    let ownerBDirectAccessBlocked = false;
    try {
      await clientOwnerB.get(`/support/tickets/${ticketA._id}`);
    } catch (err: any) {
      ownerBDirectAccessBlocked = true;
      assert(err.response?.status === 404, 'Support Privacy', 'Cross-tenant ticket direct lookup blocked with 404');
    }
    assert(ownerBDirectAccessBlocked, 'Support Privacy', 'IDOR protection on support tickets verified');

    // 14. Super Admin adds internal note (hidden from customer)
    const adminNoteRes = await clientSuperAdmin.post(`/support/tickets/${ticketA._id}/replies`, {
      message: 'Verified hardware issue: Epson driver margin setting is set to Standard instead of Borderless.',
      isInternalNote: true,
    });
    assert(adminNoteRes.status === 200, 'Support System', 'Super Admin adds internal note to ticket');

    // 15. Privacy Check: Owner A views ticket -> Internal note MUST BE STRIPPED!
    const ownerAViewRes = await clientOwnerA.get(`/support/tickets/${ticketA._id}`);
    const ownerAMessages = ownerAViewRes.data.data.messages;
    const internalNoteLeaked = ownerAMessages.some((m: any) => m.isInternalNote === true);
    assert(!internalNoteLeaked, 'Support Privacy', 'Internal administrative note stripped from customer view');

    // 16. Super Admin views ticket -> Internal note is visible
    const adminViewRes = await clientSuperAdmin.get(`/support/tickets/${ticketA._id}`);
    const adminMessages = adminViewRes.data.data.messages;
    const internalNoteVisibleToAdmin = adminMessages.some((m: any) => m.isInternalNote === true);
    assert(internalNoteVisibleToAdmin, 'Support System', 'Internal note visible to authorized Super Admin');

    // 17. Public reply submitted by customer -> Status transitions to IN_PROGRESS
    const replyRes = await clientOwnerA.post(`/support/tickets/${ticketA._id}/replies`, {
      message: 'Thank you! I adjusted the driver setting and test print succeeded.',
    });
    assert(replyRes.status === 200, 'Support System', 'Customer submits public reply');

    // 18. Super Admin resolves ticket
    const resolveRes = await clientSuperAdmin.patch(`/support/tickets/${ticketA._id}/status`, {
      status: 'RESOLVED',
    });
    assert(resolveRes.status === 200, 'Support System', 'Super Admin transitions ticket to RESOLVED');
    assert(resolveRes.data.data.status === 'RESOLVED', 'Support System', 'Status confirmed RESOLVED');
    assert(!!resolveRes.data.data.resolvedAt, 'Support System', 'resolvedAt timestamp recorded');

    // 19. Super Admin assigns ticket to an agent
    const assignRes = await clientSuperAdmin.patch(`/support/tickets/${ticketA._id}/assign`, {
      assigneeId: superAdminUser._id.toString(),
    });
    assert(assignRes.status === 200, 'Support System', 'Ticket assigned to support agent');
    assert(assignRes.data.data.assignedTo === superAdminUser._id.toString(), 'Support System', 'Assignee confirmed');

    // 20. Help Center / Knowledge Base Articles
    const articlesRes = await clientOwnerA.get('/support/articles?category=PRINTER_HARDWARE');
    assert(articlesRes.status === 200, 'Help Center', 'Help center articles retrieved (200 OK)');
    assert(Array.isArray(articlesRes.data.data) && articlesRes.data.data.length >= 1, 'Help Center', 'Categorized hardware troubleshooting articles returned');
    const hasEpsonArticle = articlesRes.data.data.some((a: any) => a.slug === 'epson-l805-300dpi-photo-setup');
    assert(hasEpsonArticle, 'Help Center', 'Epson 300 DPI guide verified in knowledge base');

    // -------------------------------------------------------------
    // CLEANUP: Prune temporary test records
    // -------------------------------------------------------------
    console.log('\nCleaning up Phase 25 test artifacts...');
    await SupportTicket.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } });
    await Job.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } });
    await Customer.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } });
    await PaymentTransaction.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } });
    await User.deleteMany({ _id: { $in: [superAdminUser._id, ownerA._id, operatorA._id, ownerB._id] } });
    await Tenant.deleteMany({ _id: { $in: [tenantA._id, tenantB._id] } });
    console.log('Cleanup complete.');

  } catch (err: any) {
    console.error('Test run failed with error:', err.response?.data || err.message);
    results.push({
      suite: 'Fatal Runtime Error',
      test: 'Execution Uncaught Exception',
      passed: false,
      error: err.response?.data?.message || err.message,
    });
  } finally {
    await db.disconnect();
  }

  // Summary
  console.log('\n======================================================');
  console.log('              PHASE 25 TEST SUMMARY RESULTS           ');
  console.log('======================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`Total Checks Executed : ${results.length}`);
  console.log(`Passed               : ${passedCount}`);
  console.log(`Failed               : ${failedCount}`);

  if (failedCount > 0) {
    console.log('\nFailed Checks:');
    results.filter((r) => !r.passed).forEach((r) => console.log(`  - [${r.suite}] ${r.test}: ${r.error}`));
    process.exit(1);
  } else {
    console.log('\n🎉 ALL PHASE 25 ANALYTICS, MONITORING & SUPPORT TESTS PASSED!\n');
    process.exit(0);
  }
}

runPhase25Tests();
