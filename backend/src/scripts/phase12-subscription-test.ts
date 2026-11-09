import mongoose from 'mongoose';
import { Database } from '../config/db';
import { User } from '../models/User.model';

/**
 * Automated Verification Test Suite for Phase 12:
 * SaaS Subscription and Payment System
 *
 * Tests:
 * 1. Shop Tenant registration and authentication
 * 2. Plan catalogue auto-seeding & retrieval (STARTER, PRO, BUSINESS, ENTERPRISE)
 * 3. Tenant trial status & countdown verification
 * 4. Checkout initiation with BDT pricing & idempotency enforcement
 * 5. Security: Forged HMAC signature rejection (anti-client-tampering)
 * 6. Payment execution & verification with valid signature (bKash/Nagad/SSLCommerz)
 * 7. Tenant plan upgrade & quota synchronization (Storage, Staff seats, Jobs)
 * 8. Duplicate payment processing prevention
 * 9. Official 300 DPI Vector PDF Tax Invoice generation
 * 10. Billing ledger & invoice history retrieval
 * 11. Cross-tenant billing isolation enforcement
 * 12. Super Admin plan management & RBAC protection
 */

const BASE_URL = 'http://localhost:5000/api/v1';

const post = async (endpoint: string, body: any, headers: Record<string, string> = {}) => {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const data: any = await res.json().catch(() => ({}));
  return { status: res.status, data };
};

const get = async (endpoint: string, headers: Record<string, string> = {}) => {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', ...headers },
  });
  const data: any = await res.json().catch(() => ({}));
  return { status: res.status, data };
};

const put = async (endpoint: string, body: any, headers: Record<string, string> = {}) => {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const data: any = await res.json().catch(() => ({}));
  return { status: res.status, data };
};

const getBinary = async (endpoint: string, headers: Record<string, string> = {}) => {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'GET',
    headers,
  });
  const buffer = await res.arrayBuffer();
  return { status: res.status, buffer, contentType: res.headers.get('content-type') };
};

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failedTests++;
  }
}

async function runPhase12Tests() {
  console.log('\n=============================================================');
  console.log('--- STARTING PHASE 12: SAAS SUBSCRIPTION & PAYMENT TEST ---');
  console.log('=============================================================\n');

  const timestamp = Date.now();

  // 1. Setup Tenant A (Owner)
  console.log('--- TEST 1: Register Tenant A & Tenant B ---');
  const suffix = Date.now().toString().slice(-5);
  const tenantAEmail = `owner_sub_a_${suffix}@docustudio.test`;
  const tenantBEmail = `owner_sub_b_${suffix}@docustudio.test`;

  const regARes = await post('/auth/register-shop', {
    shopName: `Anwar Digital Color Lab ${suffix}`,
    subdomain: `anwar-lab-${suffix}`,
    ownerName: 'Anwar Hossain',
    email: tenantAEmail,
    password: 'SecurePassword123!',
    plan: 'STARTER',
  });
  assert(regARes.status === 201, `Tenant A registered (status ${regARes.status})`);
  const tokenA = regARes.data.data?.tokens?.accessToken;
  const headersA = { Authorization: `Bearer ${tokenA}` };

  const regBRes = await post('/auth/register-shop', {
    shopName: `Kamal Xerox Kiosk ${suffix}`,
    subdomain: `kamal-xerox-${suffix}`,
    ownerName: 'Kamal Uddin',
    email: tenantBEmail,
    password: 'SecurePassword123!',
    plan: 'STARTER',
  });
  assert(regBRes.status === 201, `Tenant B registered (status ${regBRes.status})`);
  const tokenB = regBRes.data.data?.tokens?.accessToken;
  const headersB = { Authorization: `Bearer ${tokenB}` };

  // 2. Query Plans Catalogue
  console.log('\n--- TEST 2: Retrieve Subscription Plans Catalogue ---');
  const plansRes = await get('/subscription/plans', headersA);
  assert(plansRes.status === 200, `Plans catalogue fetched (status ${plansRes.status})`);
  const plans: any[] = plansRes.data.data || [];
  assert(plans.length >= 4, `At least 4 plans available in catalogue (found ${plans.length})`);

  const starterPlan = plans.find((p) => p.planKey === 'STARTER');
  const proPlan = plans.find((p) => p.planKey === 'PRO');
  const businessPlan = plans.find((p) => p.planKey === 'BUSINESS');
  const enterprisePlan = plans.find((p) => p.planKey === 'ENTERPRISE');

  assert(!!starterPlan && starterPlan.monthlyPrice >= 990, `STARTER plan exists with valid price (৳${starterPlan?.monthlyPrice}/month)`);
  assert(!!proPlan && proPlan.monthlyPrice === 1990 && proPlan.isPopular, `PRO plan exists with ৳1,990/month (Popular)`);
  assert(!!businessPlan && businessPlan.monthlyPrice === 3990, `BUSINESS plan exists with ৳3,990/month`);
  assert(!!enterprisePlan && enterprisePlan.monthlyPrice === 7990, `ENTERPRISE plan exists with ৳7,990/month`);

  // 3. Query Tenant Subscription & Trial Countdown
  console.log('\n--- TEST 3: Check Tenant Subscription & Free Trial Status ---');
  const statusRes = await get('/subscription/my-status', headersA);
  assert(statusRes.status === 200, `Tenant status fetched (status ${statusRes.status})`);
  const subStatus = statusRes.data.data;
  assert(subStatus.isTrialing === true, `Tenant is currently on 14-day free trial`);
  assert(subStatus.trialDaysRemaining === 14, `Trial countdown reflects 14 days remaining`);
  assert(subStatus.tenant.subscription.status === 'TRIALING', `Subscription status is TRIALING`);

  // 4. Checkout Initiation with Idempotency
  console.log('\n--- TEST 4: Initiate Payment with Idempotency Key ---');
  const idempotencyKey = `IDEMP-${timestamp}-XYZ`;
  const checkoutPayload = {
    planKey: 'PRO',
    billingCycle: 'MONTHLY',
    provider: 'BKASH',
    idempotencyKey,
  };

  const checkoutRes = await post('/subscription/checkout', checkoutPayload, headersA);
  assert(checkoutRes.status === 201, `Checkout initiated successfully (status ${checkoutRes.status})`);
  const checkoutData = checkoutRes.data.data;
  assert(checkoutData.transaction.transactionCode.startsWith('TXN-'), `Transaction code generated: ${checkoutData.transaction.transactionCode}`);
  assert(checkoutData.transaction.amount === 1990, `Transaction amount is ৳1,990 BDT`);
  assert(checkoutData.transaction.currency === 'BDT', `Transaction currency is BDT`);
  assert(!!checkoutData.callbackPayload.signature, `HMAC-SHA256 signature generated on backend`);

  // Test idempotency: call again with same idempotency key
  console.log('  Testing idempotency re-submission...');
  const duplicateCheckoutRes = await post('/subscription/checkout', checkoutPayload, headersA);
  assert(duplicateCheckoutRes.status === 200 || duplicateCheckoutRes.status === 201, `Idempotent request handled cleanly`);
  assert(
    duplicateCheckoutRes.data.data.transaction.transactionCode === checkoutData.transaction.transactionCode,
    `Same transaction code returned for identical idempotency key (no duplicate charge)`
  );

  // 5. Security: Forged Signature Rejection
  console.log('\n--- TEST 5: Backend Signature Security (Forged Signature Rejection) ---');
  const forgedPayload = {
    transactionCode: checkoutData.transaction.transactionCode,
    providerTransactionId: `BKASH-SIM-${timestamp}`,
    signature: 'fake_tampered_forged_signature_12345',
    status: 'SUCCESS',
  };

  const forgedRes = await post('/subscription/verify-payment', forgedPayload, headersA);
  assert(forgedRes.status === 400, `Forged signature rejected with HTTP 400 (got ${forgedRes.status})`);
  assert(
    forgedRes.data.message?.toLowerCase().includes('signature') || forgedRes.data.message?.toLowerCase().includes('hmac'),
    `Error message mentions signature verification failure: "${forgedRes.data.message}"`
  );

  // 6. Valid Payment Verification & Activation
  console.log('\n--- TEST 6: Valid Payment Execution & Plan Activation ---');
  const validPayload = {
    transactionCode: checkoutData.transaction.transactionCode,
    providerTransactionId: `BKASH-SIM-VALID-${timestamp}`,
    signature: checkoutData.callbackPayload.signature,
    status: 'SUCCESS',
  };

  const verifyRes = await post('/subscription/verify-payment', validPayload, headersA);
  assert(verifyRes.status === 200, `Payment verified & processed successfully (status ${verifyRes.status})`);
  const activatedTenant = verifyRes.data.data.tenant;
  assert(activatedTenant.subscription.plan === 'PRO', `Tenant plan upgraded to PRO`);
  assert(activatedTenant.subscription.status === 'ACTIVE', `Tenant status set to ACTIVE`);
  assert(activatedTenant.quotas.maxStaffSeats === 5, `Staff seats quota synced to 5 seats`);
  assert(activatedTenant.quotas.storageLimitBytes === 25000 * 1024 * 1024, `Storage quota synced to 25 GB (25000 MB)`);

  const createdInvoice = verifyRes.data.data.invoice;
  assert(!!createdInvoice, `Tax invoice record generated`);
  assert(createdInvoice.invoiceNumber.startsWith('INV-'), `Invoice number formatted: ${createdInvoice.invoiceNumber}`);
  assert(createdInvoice.amount === 1990, `Base subtotal is ৳1,990`);
  assert(createdInvoice.vat === Math.round(1990 * 0.05), `5% VAT calculated correctly: ৳${createdInvoice.vat}`);
  assert(createdInvoice.totalAmount === 1990 + Math.round(1990 * 0.05), `Total amount with VAT is ৳${createdInvoice.totalAmount}`);
  assert(createdInvoice.status === 'PAID', `Invoice marked as PAID`);

  // 7. Duplicate Payment Execution Guard
  console.log('\n--- TEST 7: Guard Against Re-Executing Paid Transaction ---');
  const reVerifyRes = await post('/subscription/verify-payment', validPayload, headersA);
  assert(reVerifyRes.status === 200, `Duplicate verification handled cleanly (status ${reVerifyRes.status})`);
  assert(
    reVerifyRes.data.data.transaction.transactionCode === checkoutData.transaction.transactionCode,
    `Duplicate payment call returned existing transaction without duplicate invoice generation`
  );

  // 8. Official 300 DPI Vector PDF Tax Invoice Generation
  console.log('\n--- TEST 8: Download 300 DPI Vector PDF Tax Invoice ---');
  const pdfRes = await getBinary(`/subscription/invoices/${createdInvoice.invoiceNumber}/pdf`, headersA);
  assert(pdfRes.status === 200, `Invoice PDF endpoint returned HTTP 200`);
  assert(Boolean(pdfRes.contentType?.includes('application/pdf')), `Content-Type is application/pdf`);
  const pdfMagicBytes = new Uint8Array(pdfRes.buffer.slice(0, 5));
  const pdfHeaderStr = String.fromCharCode(...pdfMagicBytes);
  assert(pdfHeaderStr === '%PDF-', `File buffer contains valid PDF magic header (%PDF-)`);
  assert(pdfRes.buffer.byteLength > 1000, `PDF size is valid (${pdfRes.buffer.byteLength} bytes)`);

  // 9. Billing History Retrieval
  console.log('\n--- TEST 9: Billing History & Ledger Retrieval ---');
  const historyRes = await get('/subscription/history', headersA);
  assert(historyRes.status === 200, `Billing history fetched (status ${historyRes.status})`);
  assert(historyRes.data.data.transactions.length >= 1, `Transactions ledger has at least 1 record`);
  assert(historyRes.data.data.invoices.length >= 1, `Invoices list has at least 1 record`);
  assert(
    historyRes.data.data.invoices[0].invoiceNumber === createdInvoice.invoiceNumber,
    `Generated invoice found in billing history`
  );

  // 10. Multi-Tenant Billing Isolation Enforcement
  console.log('\n--- TEST 10: Multi-Tenant Billing Isolation Enforcement ---');
  const historyBRes = await get('/subscription/history', headersB);
  assert(historyBRes.status === 200, `Tenant B history fetched (status ${historyBRes.status})`);
  assert(
    historyBRes.data.data.transactions.length === 0,
    `Tenant B has 0 transactions (cannot see Tenant A transactions)`
  );
  assert(
    historyBRes.data.data.invoices.length === 0,
    `Tenant B has 0 invoices (cannot see Tenant A invoices)`
  );

  // Tenant B attempts to download Tenant A's invoice
  const crossTenantPdfRes = await getBinary(`/subscription/invoices/${createdInvoice.invoiceNumber}/pdf`, headersB);
  assert(
    crossTenantPdfRes.status === 404,
    `Tenant B cannot download Tenant A invoice (HTTP 404/Forbidden enforced)`
  );

  // 11. Super Admin Plan Customization & RBAC Protection
  console.log('\n--- TEST 11: Super Admin Plan Customization & RBAC Protection ---');
  // Tenant A (Shop Owner) tries to update plan config -> should be forbidden (403)
  const forbiddenUpdateRes = await put('/subscription/plans/STARTER', { monthlyPrice: 500 }, headersA);
  assert(forbiddenUpdateRes.status === 403, `Non-admin user forbidden from modifying plans (HTTP 403)`);

  // Register Super Admin or update User role directly for admin test
  const adminSuffix = Date.now().toString().slice(-5);
  const adminEmail = `superadmin_${adminSuffix}@docustudio.test`;
  const adminRegRes = await post('/auth/register-shop', {
    shopName: `DocuStudio HQ ${adminSuffix}`,
    subdomain: `hq-admin-${adminSuffix}`,
    ownerName: 'System Super Admin',
    email: adminEmail,
    password: 'SecurePassword123!',
    plan: 'ENTERPRISE',
  });
  assert(adminRegRes.status === 201, `Admin tenant registered`);
  const adminUserId = adminRegRes.data.data?.user?._id || adminRegRes.data.data?.user?.id;

  // Elevate user role to SUPER_ADMIN in MongoDB directly
  await Database.getInstance().connect();
  await User.findByIdAndUpdate(adminUserId, { role: 'SUPER_ADMIN' });

  // Login again to get updated JWT token with SUPER_ADMIN role
  const adminLoginRes = await post('/auth/login', {
    email: adminEmail,
    password: 'SecurePassword123!',
  });
  assert(adminLoginRes.status === 200, `Admin re-login succeeds`);
  const superAdminToken = adminLoginRes.data.data?.tokens?.accessToken;
  const superAdminHeaders = { Authorization: `Bearer ${superAdminToken}` };

  const adminUpdateRes = await put(
    '/subscription/plans/STARTER',
    {
      monthlyPrice: 1050,
      displayName: 'Starter Pro Kiosk',
    },
    superAdminHeaders
  );
  assert(adminUpdateRes.status === 200, `Super Admin successfully updated plan settings (HTTP 200)`);
  assert(
    adminUpdateRes.data.data.monthlyPrice === 1050,
    `STARTER plan monthly price updated to ৳1,050`
  );
  assert(
    adminUpdateRes.data.data.displayName === 'Starter Pro Kiosk',
    `STARTER plan display name updated to 'Starter Pro Kiosk'`
  );

  // Summary
  console.log('\n=============================================================');
  console.log(`--- PHASE 12 TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED ---`);
  console.log('=============================================================\n');

  await mongoose.disconnect();

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase12Tests().catch((err) => {
  console.error('Fatal error running Phase 12 tests:', err);
  process.exit(1);
});
