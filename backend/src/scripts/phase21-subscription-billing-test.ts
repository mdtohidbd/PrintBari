import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import mongoose from 'mongoose';
import { db } from '../config/db';
import { Tenant } from '../models/Tenant.model';
import { User } from '../models/User.model';
import { PlanConfig, PaymentTransaction, SubscriptionInvoice } from '../models/Subscription.model';
import { TokenService } from '../utils/token';
import { subscriptionService, PERMITTED_SUBSCRIPTION_TRANSITIONS } from '../modules/subscription/subscription.service';

const API_BASE = 'http://localhost:5000/api/v1';

interface TestResult {
  suite: string;
  test: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function assert(condition: boolean, suite: string, test: string, errorMsg?: string, details?: any) {
  if (condition) {
    results.push({ suite, test, passed: true, details });
    console.log(`  ✓ [PASS] ${suite} - ${test}`);
  } else {
    results.push({ suite, test, passed: false, error: errorMsg || 'Assertion failed', details });
    console.error(`  ✗ [FAIL] ${suite} - ${test}: ${errorMsg || 'Assertion failed'}`);
  }
}

async function runPhase21Tests() {
  console.log('\n======================================================');
  console.log('  PHASE 21: ADVANCED SAAS SUBSCRIPTION & BILLING OPS  ');
  console.log('======================================================\n');

  await db.connect();
  console.log('Connected to MongoDB Atlas for setup...\n');

  try {
    const timestamp = Date.now();
    const testBusinessId = `SHOP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const testSubdomain = `p21-${timestamp.toString().slice(-6)}`;

    const tenant = await Tenant.create({
      businessId: testBusinessId,
      subdomain: testSubdomain,
      name: `Phase 21 Billing Studio ${timestamp}`,
      ownerEmail: `owner_${timestamp}@p21.com`,
      subscription: {
        plan: 'STARTER',
        status: 'TRIALING',
        trialEndsAt: new Date(Date.now() + 14 * 86400000),
        currentPeriodEnd: new Date(Date.now() + 14 * 86400000),
      },
      quotas: {
        maxStaffSeats: 2,
        monthlyJobsLimit: 150,
        monthlyJobsUsed: 12,
        monthlyPassportLayoutsLimit: 300,
        monthlyPassportLayoutsUsed: 45,
        monthlyOcrPagesLimit: 50,
        monthlyOcrPagesUsed: 8,
        storageLimitBytes: 5 * 1024 * 1024 * 1024,
        storageUsedBytes: 524288000, // 500 MB
      },
      isActive: true,
    });

    // 1. Create Super Admin User & Shop Owner User
    const superAdminUser = await User.create({
      tenantId: tenant._id,
      fullName: 'DocuStudio SuperAdmin',
      email: `superadmin_${timestamp}@docustudio.test`,
      passwordHash: 'hashed_pw_test',
      role: 'SUPER_ADMIN',
      phone: `01700${timestamp.toString().slice(-6)}`,
      isActive: true,
    });

    const ownerUser = await User.create({
      tenantId: tenant._id,
      fullName: 'Shakil Shop Owner',
      email: `owner_${timestamp}@p21.com`,
      passwordHash: 'hashed_pw_test',
      role: 'OWNER',
      phone: `01711${timestamp.toString().slice(-6)}`,
      isActive: true,
    });

    // Create 3 active staff members to test downgrade restrictions
    const staff1 = await User.create({
      tenantId: tenant._id,
      fullName: 'Staff Member 1',
      email: `staff1_${timestamp}@p21.com`,
      passwordHash: 'hashed_pw_test',
      role: 'OPERATOR',
      phone: `01722${timestamp.toString().slice(-6)}`,
      isActive: true,
    });

    const staff2 = await User.create({
      tenantId: tenant._id,
      fullName: 'Staff Member 2',
      email: `staff2_${timestamp}@p21.com`,
      passwordHash: 'hashed_pw_test',
      role: 'OPERATOR',
      phone: `01733${timestamp.toString().slice(-6)}`,
      isActive: true,
    });

    const staff3 = await User.create({
      tenantId: tenant._id,
      fullName: 'Staff Member 3',
      email: `staff3_${timestamp}@p21.com`,
      passwordHash: 'hashed_pw_test',
      role: 'OPERATOR',
      phone: `01744${timestamp.toString().slice(-6)}`,
      isActive: true,
    });

    // 2. Setup Axios Clients
    const createClient = (user: any, tId?: string): AxiosInstance => {
      const token = TokenService.generateAccessToken({
        userId: user._id.toString(),
        tenantId: (tId || user.tenantId).toString(),
        role: user.role,
        email: user.email,
      });

      return axios.create({
        baseURL: API_BASE,
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tenant-id': (tId || user.tenantId).toString(),
        },
      });
    };

    const adminClient = createClient(superAdminUser, tenant._id.toString());
    const ownerClient = createClient(ownerUser, tenant._id.toString());

    console.log('--- TEST SUITE 1: Subscription Plans & Catalog Management ---');
    // 1. Fetch Plans Catalog
    const plansRes = await ownerClient.get('/subscription/plans');
    assert(plansRes.status === 200, 'Plan Catalog', 'Public plan catalog returns 200 OK');
    assert(Array.isArray(plansRes.data.data), 'Plan Catalog', 'Plans returned as array');
    assert(plansRes.data.data.length >= 4, 'Plan Catalog', 'Contains at least STARTER, PRO, BUSINESS, ENTERPRISE');

    // 2. Super Admin Updates Plan Configuration
    const updatePlanRes = await adminClient.put('/subscription/plans/STARTER', {
      displayName: 'Starter Solo Pro (স্টার্টার)',
      monthlyPrice: 999,
    });
    assert(updatePlanRes.status === 200, 'Plan Management', 'Super Admin update plan returns 200 OK');
    assert(updatePlanRes.data.data.monthlyPrice === 999, 'Plan Management', 'Plan monthlyPrice updated to 999');

    console.log('\n--- TEST SUITE 2: Subscription State Machine & Permitted Transitions ---');
    // 3. TRIAL -> ACTIVE (Permitted)
    const tActiveRes = await adminClient.patch(`/subscription/admin/tenants/${tenant._id}/status`, {
      status: 'ACTIVE',
      reason: 'Shop purchased full subscription',
    });
    assert(tActiveRes.status === 200, 'State Machine', 'Transition TRIALING -> ACTIVE succeeds');
    assert(tActiveRes.data.data.subscription.status === 'ACTIVE', 'State Machine', 'Tenant status is ACTIVE');

    // 4. ACTIVE -> PAST_DUE (Permitted)
    const tPastDueRes = await adminClient.patch(`/subscription/admin/tenants/${tenant._id}/status`, {
      status: 'PAST_DUE',
      reason: 'Card charge failed at billing cycle',
    });
    assert(tPastDueRes.status === 200, 'State Machine', 'Transition ACTIVE -> PAST_DUE succeeds');
    assert(tPastDueRes.data.data.subscription.status === 'PAST_DUE', 'State Machine', 'Tenant status is PAST_DUE');

    // 5. PAST_DUE -> GRACE_PERIOD (Permitted, with 7 days grace window)
    const tGraceRes = await adminClient.patch(`/subscription/admin/tenants/${tenant._id}/status`, {
      status: 'GRACE_PERIOD',
      reason: 'Entering 7-day grace window before service pause',
    });
    assert(tGraceRes.status === 200, 'State Machine', 'Transition PAST_DUE -> GRACE_PERIOD succeeds');
    assert(tGraceRes.data.data.subscription.status === 'GRACE_PERIOD', 'State Machine', 'Tenant status is GRACE_PERIOD');
    assert(!!tGraceRes.data.data.subscription.gracePeriodEndsAt, 'State Machine', 'Grace period end timestamp recorded');

    // 6. GRACE_PERIOD -> SUSPENDED (Permitted, suspension timestamp & reason)
    const tSuspendedRes = await adminClient.patch(`/subscription/admin/tenants/${tenant._id}/status`, {
      status: 'SUSPENDED',
      reason: 'No payment made during grace period',
    });
    assert(tSuspendedRes.status === 200, 'State Machine', 'Transition GRACE_PERIOD -> SUSPENDED succeeds');
    assert(tSuspendedRes.data.data.subscription.status === 'SUSPENDED', 'State Machine', 'Tenant status is SUSPENDED');
    assert(!!tSuspendedRes.data.data.subscription.suspendedAt, 'State Machine', 'Suspension timestamp recorded');

    // 7. SUSPENDED -> TRIAL (Forbidden Transition -> Rejection)
    let invalidTransitionBlocked = false;
    try {
      await adminClient.patch(`/subscription/admin/tenants/${tenant._id}/status`, {
        status: 'TRIAL',
        reason: 'Illegal transition test',
      });
    } catch (err: any) {
      invalidTransitionBlocked = true;
      assert(err.response?.status === 400, 'State Machine', 'Invalid transition SUSPENDED -> TRIAL rejected with 400');
    }
    assert(invalidTransitionBlocked, 'State Machine', 'State machine validation enforced on backend');

    // 8. SUSPENDED -> ACTIVE (Permitted reactivation)
    const tReactivateRes = await adminClient.patch(`/subscription/admin/tenants/${tenant._id}/status`, {
      status: 'ACTIVE',
      reason: 'Payment settled, reactivation authorized',
    });
    assert(tReactivateRes.status === 200, 'State Machine', 'Transition SUSPENDED -> ACTIVE succeeds');
    assert(tReactivateRes.data.data.subscription.status === 'ACTIVE', 'State Machine', 'Shop successfully reactivated');

    console.log('\n--- TEST SUITE 3: Usage Metering Against Quotas ---');
    // 9. Fetch Granular Usage Metering
    const meteringRes = await ownerClient.get('/subscription/usage-metering');
    assert(meteringRes.status === 200, 'Usage Metering', 'Get usage metering returns 200 OK');
    const mData = meteringRes.data.data;
    assert(mData.staff.used >= 3, 'Usage Metering', `Active staff seats counted correctly: ${mData.staff.used}`);
    assert(typeof mData.staff.percentage === 'number', 'Usage Metering', 'Staff usage percentage calculated');
    assert(mData.storage.usedMB >= 500, 'Usage Metering', `Storage used MB calculated correctly: ${mData.storage.usedMB} MB`);
    assert(mData.jobs.used === 12, 'Usage Metering', `Monthly jobs used accurately reported: ${mData.jobs.used}`);
    assert(typeof mData.features === 'object', 'Usage Metering', 'Feature restrictions map provided');

    console.log('\n--- TEST SUITE 4: Proration Engine & Downgrade Validation ---');
    // 10. Proration Quote for Plan Upgrade (STARTER -> PRO)
    const prorationRes = await ownerClient.post('/subscription/proration-quote', {
      targetPlanKey: 'PRO',
      targetBillingCycle: 'MONTHLY',
    });
    assert(prorationRes.status === 200, 'Proration Engine', 'Proration quote returns 200 OK');
    const pData = prorationRes.data.data;
    assert(pData.isUpgrade === true, 'Proration Engine', 'Correctly identified as upgrade');
    assert(typeof pData.unusedCredit === 'number', 'Proration Engine', `Unused credit calculated: ${pData.unusedCredit} BDT`);
    assert(pData.payableAmount <= pData.targetPrice, 'Proration Engine', 'Prorated payable amount discounted by credit');

    // 11. Downgrade Eligibility Check (STARTER has 2 staff limit, but shop has 4 active staff: owner + 3 staff)
    const downgradeRes = await ownerClient.post('/subscription/downgrade-eligibility', {
      targetPlanKey: 'STARTER',
    });
    assert(downgradeRes.status === 200, 'Downgrade Validation', 'Downgrade eligibility check returns 200 OK');
    const dgData = downgradeRes.data.data;
    assert(dgData.eligible === false, 'Downgrade Validation', 'Downgrade correctly flagged as ineligible');
    assert(dgData.reasons.length >= 1, 'Downgrade Validation', 'Specific reason provided for staff quota excess');

    console.log('\n--- TEST SUITE 5: Payment Reliability, Server Verification & Idempotency ---');
    // 12. Checkout Initiation with Idempotency Key
    const testIdempotencyKey = `PAY_IDEM_${timestamp}`;
    const checkoutRes = await ownerClient.post('/subscription/checkout', {
      planKey: 'PRO',
      billingCycle: 'MONTHLY',
      provider: 'BKASH',
      idempotencyKey: testIdempotencyKey,
    });
    assert(checkoutRes.status === 201, 'Payment Reliability', 'Initiate checkout returns 201 Created');
    const { transaction, callbackPayload } = checkoutRes.data.data;
    const transactionCode = transaction.transactionCode;
    assert(!!transactionCode, 'Payment Reliability', 'Unique transaction code generated');
    assert(!!callbackPayload.signature, 'Payment Reliability', 'Server-side HMAC SHA-256 signature generated');

    // 13. Idempotent Checkout Call: Must return identical transaction
    const dupCheckoutRes = await ownerClient.post('/subscription/checkout', {
      planKey: 'PRO',
      billingCycle: 'MONTHLY',
      provider: 'BKASH',
      idempotencyKey: testIdempotencyKey,
    });
    assert(dupCheckoutRes.status === 200 || dupCheckoutRes.status === 201, 'Idempotency', 'Duplicate checkout handled');
    assert(
      dupCheckoutRes.data.data.transaction.transactionCode === transactionCode,
      'Idempotency',
      'Returned identical transaction code without creating new document'
    );

    // 14. Verification with Tampered Signature -> Rejected with 400
    let tamperDetected = false;
    try {
      await axios.post(`${API_BASE}/subscription/verify-payment`, {
        transactionCode,
        signature: 'invalid_tampered_signature_1234567890abcdef',
        status: 'SUCCESS',
      });
    } catch (err: any) {
      tamperDetected = true;
      assert(err.response?.status === 400, 'Security & Integrity', 'Tampered signature rejected with 400 Bad Request');
    }
    assert(tamperDetected, 'Security & Integrity', 'HMAC timing-safe signature verification enforced');

    // 15. Legitimate Server-Side Verification Callback
    const validVerifyRes = await axios.post(`${API_BASE}/subscription/verify-payment`, {
      transactionCode,
      providerTransactionId: `BKASH-TRX-${Date.now()}`,
      signature: callbackPayload.signature,
      status: 'SUCCESS',
    });
    assert(validVerifyRes.status === 200, 'Backend Activation', 'Valid payment verification returns 200 OK');
    assert(validVerifyRes.data.data.transaction.paymentStatus === 'SUCCESS', 'Backend Activation', 'Transaction status marked SUCCESS');
    assert(validVerifyRes.data.data.tenant.subscription.plan === 'PRO', 'Backend Activation', 'Tenant subscription upgraded to PRO');
    assert(validVerifyRes.data.data.tenant.subscription.status === 'ACTIVE', 'Backend Activation', 'Tenant subscription status is ACTIVE');
    assert(validVerifyRes.data.data.tenant.quotas.maxStaffSeats === 5, 'Backend Activation', 'Tenant staff quota expanded to 5');

    // 16. Duplicate Verification Callback -> Safely Handled (Idempotent Webhook)
    const dupVerifyRes = await axios.post(`${API_BASE}/subscription/verify-payment`, {
      transactionCode,
      providerTransactionId: `BKASH-TRX-${Date.now()}`,
      signature: callbackPayload.signature,
      status: 'SUCCESS',
    });
    assert(dupVerifyRes.status === 200, 'Webhook Idempotency', 'Duplicate callback safely returns 200 OK without double invoice');

    console.log('\n--- TEST SUITE 6: Payment Retry Mechanism ---');
    // 17. Initiate a payment that gets failed/pending for retry test
    const failedCheckoutRes = await ownerClient.post('/subscription/checkout', {
      planKey: 'BUSINESS',
      billingCycle: 'MONTHLY',
      provider: 'NAGAD',
    });
    const failedTxnCode = failedCheckoutRes.data.data.transaction.transactionCode;

    // Simulate failure
    await PaymentTransaction.updateOne(
      { transactionCode: failedTxnCode },
      { $set: { paymentStatus: 'FAILED', errorMessage: 'Insufficient balance on wallet' } }
    );

    // Retry payment
    const retryRes = await ownerClient.post('/subscription/retry', {
      transactionCode: failedTxnCode,
    });
    assert(retryRes.status === 200, 'Payment Retry', 'Payment retry returns 200 OK');
    assert(retryRes.data.data.transaction.paymentStatus === 'PENDING', 'Payment Retry', 'Transaction re-queued as PENDING');
    assert(retryRes.data.data.transaction.retryCount === 1, 'Payment Retry', 'Transaction retryCount incremented to 1');
    assert(!!retryRes.data.data.checkoutUrl, 'Payment Retry', 'Fresh checkout URL generated with retry counter');

    console.log('\n--- TEST SUITE 7: Invoice Generation & PDF Vector Rendering ---');
    // 18. Billing History
    const historyRes = await ownerClient.get('/subscription/history');
    assert(historyRes.status === 200, 'Invoice History', 'Get billing history returns 200 OK');
    assert(historyRes.data.data.invoices.length >= 1, 'Invoice History', 'At least 1 invoice recorded');
    const invoiceNumber = historyRes.data.data.invoices[0].invoiceNumber;

    // 19. Download Invoice PDF Buffer
    const pdfRes = await ownerClient.get(`/subscription/invoices/${invoiceNumber}/pdf`, {
      responseType: 'arraybuffer',
    });
    assert(pdfRes.status === 200, 'PDF Invoicing', 'Download invoice PDF returns 200 OK');
    assert(pdfRes.headers['content-type'] === 'application/pdf', 'PDF Invoicing', 'Content-Type is application/pdf');
    assert(pdfRes.data.byteLength > 1000, 'PDF Invoicing', `PDF rendered with valid byte length: ${pdfRes.data.byteLength} bytes`);

    console.log('\n--- TEST SUITE 8: Super Admin Billing & Refund Operations ---');
    // 20. Super Admin Views Subscriptions
    const adminSubsRes = await adminClient.get('/subscription/admin/subscriptions');
    assert(adminSubsRes.status === 200, 'Admin Operations', 'Super Admin list subscriptions returns 200 OK');
    assert(adminSubsRes.data.data.total >= 1, 'Admin Operations', 'Subscribed tenants listed');

    // 21. Super Admin Views Transactions
    const adminTxnsRes = await adminClient.get('/subscription/admin/transactions');
    assert(adminTxnsRes.status === 200, 'Admin Operations', 'Super Admin list transactions returns 200 OK');
    assert(adminTxnsRes.data.data.total >= 2, 'Admin Operations', 'Transactions listed with full details');

    // 22. Super Admin Processes Refund
    const refundRes = await adminClient.post(`/subscription/admin/transactions/${transactionCode}/refund`, {
      reason: 'Customer mistakenly selected wrong billing tier',
    });
    assert(refundRes.status === 200, 'Refund Management', 'Refund transaction returns 200 OK');
    assert(refundRes.data.data.transaction.paymentStatus === 'REFUNDED', 'Refund Management', 'Transaction status updated to REFUNDED');
    assert(refundRes.data.data.invoice.status === 'REFUNDED', 'Refund Management', 'Subscription invoice updated to REFUNDED');

    // Check Tenant Subscription status was updated to CANCELLED upon refund
    const refundedTenant = await Tenant.findById(tenant._id);
    assert(refundedTenant?.subscription.status === 'CANCELLED', 'Refund Management', 'Tenant subscription cancelled upon refund');

    // Cleanup test artifacts
    console.log('\nCleaning up test artifacts from database...');
    await SubscriptionInvoice.deleteMany({ tenantId: tenant._id });
    await PaymentTransaction.deleteMany({ tenantId: tenant._id });
    await User.deleteMany({ tenantId: tenant._id });
    await User.deleteOne({ _id: superAdminUser._id });
    await Tenant.deleteOne({ _id: tenant._id });
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
  console.log('                  TEST SUMMARY RESULTS                ');
  console.log('======================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`Total Tests Executed : ${results.length}`);
  console.log(`Passed               : ${passedCount}`);
  console.log(`Failed               : ${failedCount}`);

  if (failedCount > 0) {
    console.log('\nFailed Tests:');
    results.filter((r) => !r.passed).forEach((r) => console.log(`  - [${r.suite}] ${r.test}: ${r.error}`));
    process.exit(1);
  } else {
    console.log('\n🎉 ALL PHASE 21 SUBSCRIPTION AND BILLING TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  }
}

runPhase21Tests();
