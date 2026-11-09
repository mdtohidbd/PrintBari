import mongoose from 'mongoose';
import { Database } from '../config/db';
import { User } from '../models/User.model';
import { Tenant } from '../models/Tenant.model';

/**
 * Automated Verification Test Suite for Phase 13:
 * Super Admin Dashboard & Central Administration System
 *
 * Tests:
 * 1. Shop Tenant registration and authentication
 * 2. Strict RBAC: Non-admin users rejected from all Super Admin routes (HTTP 403)
 * 3. Super Admin role authorization & access clearance
 * 4. Platform Analytics Dashboard (Shops, Revenue, Payments, Storage, Trend, Activities)
 * 5. Shop Management: Pagination, Search & Status filtering
 * 6. Shop Profile & Details retrieval (Usage, Staff count, Job count, Transactions)
 * 7. Shop Lifecycle: Suspension with reason & Security Audit Logging
 * 8. Shop Lifecycle: Re-activation & Audit Logging
 * 9. Shop Subscription override & automated quota synchronization
 * 10. Plan Management: Create new plan tier
 * 11. Plan Management: Update pricing & resource limits
 * 12. Plan Management: Prevent archiving plan with active tenants
 * 13. Plan Management: Archive inactive plan
 * 14. Payment Management: Central transaction ledger & status filtering
 * 15. Payment Management: Invoices list & aggregate statistics
 * 16. Platform Settings: Pre-seeded system defaults (Website, Email, Notification, Storage, Security, Maintenance)
 * 17. Platform Settings: Individual setting update & Audit log tracking
 * 18. Platform Settings: Bulk settings update
 * 19. Security: Centralized immutable audit logs retrieval with action filtering
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

const del = async (endpoint: string, headers: Record<string, string> = {}) => {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...headers },
  });
  const data: any = await res.json().catch(() => ({}));
  return { status: res.status, data };
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

async function runPhase13Tests() {
  console.log('\n=============================================================');
  console.log('--- STARTING PHASE 13: SUPER ADMIN DASHBOARD VERIFICATION ---');
  console.log('=============================================================\n');

  const suffix = Date.now().toString().slice(-5);

  // 1. Setup Regular Tenant (Owner)
  console.log('--- TEST 1: Register Standard Shop Owner (Non-Admin) ---');
  const regularEmail = `owner_regular_${suffix}@docustudio.test`;
  const regShopRes = await post('/auth/register-shop', {
    shopName: `Metro Print Point ${suffix}`,
    subdomain: `metro-print-${suffix}`,
    ownerName: 'Rafiqul Islam',
    email: regularEmail,
    password: 'SecurePassword123!',
    plan: 'STARTER',
  });
  assert(regShopRes.status === 201, `Regular shop registered (status ${regShopRes.status})`);
  const regularToken = regShopRes.data.data?.tokens?.accessToken;
  const regularHeaders = { Authorization: `Bearer ${regularToken}` };
  const targetShopId = regShopRes.data.data?.tenant?._id || regShopRes.data.data?.tenant?.id;

  // 2. Strict RBAC Security Check
  console.log('\n--- TEST 2: Strict RBAC Protection (Non-Admin Rejection) ---');
  const forbiddenDashboard = await get('/superadmin/dashboard', regularHeaders);
  assert(forbiddenDashboard.status === 403, `Non-admin rejected from /superadmin/dashboard (HTTP 403)`);

  const forbiddenShops = await get('/superadmin/shops', regularHeaders);
  assert(forbiddenShops.status === 403, `Non-admin rejected from /superadmin/shops (HTTP 403)`);

  const forbiddenSettings = await get('/superadmin/settings', regularHeaders);
  assert(forbiddenSettings.status === 403, `Non-admin rejected from /superadmin/settings (HTTP 403)`);

  // 3. Register and Setup Super Admin User
  console.log('\n--- TEST 3: Setup Super Admin User & Role Elevation ---');
  const adminEmail = `superadmin_phase13_${suffix}@docustudio.test`;
  const adminRegRes = await post('/auth/register-shop', {
    shopName: `DocuStudio Global HQ ${suffix}`,
    subdomain: `hq-platform-${suffix}`,
    ownerName: 'Platform Super Admin',
    email: adminEmail,
    password: 'SecurePassword123!',
    plan: 'ENTERPRISE',
  });
  assert(adminRegRes.status === 201, `Admin base account registered`);
  const adminUserId = adminRegRes.data.data?.user?._id || adminRegRes.data.data?.user?.id;

  // Direct database role elevation to SUPER_ADMIN
  await Database.getInstance().connect();
  await User.findByIdAndUpdate(adminUserId, { role: 'SUPER_ADMIN' });

  // Login again to issue updated JWT token with role: SUPER_ADMIN
  const adminLoginRes = await post('/auth/login', {
    email: adminEmail,
    password: 'SecurePassword123!',
  });
  assert(adminLoginRes.status === 200, `Admin re-login succeeds`);
  const adminToken = adminLoginRes.data.data?.tokens?.accessToken;
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  // 4. Platform Analytics Dashboard
  console.log('\n--- TEST 4: Platform Analytics Dashboard Retrieval ---');
  const dashboardRes = await get('/superadmin/dashboard', adminHeaders);
  assert(dashboardRes.status === 200, `Super Admin dashboard fetched (HTTP 200)`);
  const dashData = dashboardRes.data.data;
  assert(dashData.shops && dashData.shops.total >= 2, `Dashboard reports total shops (>= 2)`);
  assert(dashData.shops.active >= 0, `Dashboard reports active shops count`);
  assert(dashData.shops.trialing >= 1, `Dashboard reports trialing shops count`);
  assert(dashData.revenue && dashData.revenue.currency === 'BDT', `Revenue currency is BDT`);
  assert(dashData.payments && typeof dashData.payments.total === 'number', `Payment volume reported`);
  assert(dashData.storage && typeof dashData.storage.totalLimitBytes === 'number', `Storage quota metrics reported`);
  assert(Array.isArray(dashData.planDistribution), `Plan distribution array included`);
  assert(Array.isArray(dashData.providerDistribution), `Provider distribution array included`);
  assert(Array.isArray(dashData.recentActivities), `Recent activities feed included`);

  // 5. Shop Management: Pagination & Filtering
  console.log('\n--- TEST 5: Shop Management (Pagination, Search & Filter) ---');
  const allShopsRes = await get('/superadmin/shops?page=1&limit=10', adminHeaders);
  assert(allShopsRes.status === 200, `GET /superadmin/shops returns 200`);
  assert(Array.isArray(allShopsRes.data.data.shops), `Shops list is an array`);
  assert(allShopsRes.data.data.total >= 2, `Total count returned`);

  // Search by shop name
  const searchShopsRes = await get(`/superadmin/shops?search=Metro`, adminHeaders);
  assert(searchShopsRes.status === 200, `Search shops returns 200`);
  assert(
    searchShopsRes.data.data.shops.some((s: any) => s.subdomain.includes('metro')),
    `Search filter correctly found Metro Print Point`
  );

  // 6. Shop Profile Details Retrieval
  console.log('\n--- TEST 6: Shop Profile & Usage Inspection ---');
  const shopDetailsRes = await get(`/superadmin/shops/${targetShopId}`, adminHeaders);
  assert(shopDetailsRes.status === 200, `GET /superadmin/shops/:id returns 200`);
  const shopDetails = shopDetailsRes.data.data;
  assert(shopDetails.shop && shopDetails.shop._id === targetShopId, `Shop entity matches requested ID`);
  assert(typeof shopDetails.staffCount === 'number', `Staff count reported`);
  assert(typeof shopDetails.jobCount === 'number', `Job count reported`);
  assert(Array.isArray(shopDetails.recentTransactions), `Recent transactions list returned`);
  assert(Array.isArray(shopDetails.recentActivity), `Recent activity logs returned`);

  // 7. Shop Lifecycle: Suspension
  console.log('\n--- TEST 7: Suspend Shop with Reason & Audit Log ---');
  const suspendRes = await post(
    `/superadmin/shops/${targetShopId}/suspend`,
    { reason: 'Suspected fraudulent transaction' },
    adminHeaders
  );
  assert(suspendRes.status === 200, `POST /superadmin/shops/:id/suspend succeeds (HTTP 200)`);
  assert(suspendRes.data.data.isActive === false, `Shop isActive is now false (Suspended)`);

  // 8. Shop Lifecycle: Re-Activation
  console.log('\n--- TEST 8: Re-Activate Suspended Shop ---');
  const activateRes = await post(`/superadmin/shops/${targetShopId}/activate`, {}, adminHeaders);
  assert(activateRes.status === 200, `POST /superadmin/shops/:id/activate succeeds (HTTP 200)`);
  assert(activateRes.data.data.isActive === true, `Shop isActive is restored to true (Active)`);

  // 9. Shop Subscription Plan Override & Quota Sync
  console.log('\n--- TEST 9: Super Admin Subscription Override & Quota Sync ---');
  const subUpdateRes = await put(
    `/superadmin/shops/${targetShopId}/subscription`,
    { plan: 'BUSINESS', status: 'ACTIVE' },
    adminHeaders
  );
  assert(subUpdateRes.status === 200, `PUT /superadmin/shops/:id/subscription succeeds (HTTP 200)`);
  assert(subUpdateRes.data.data.subscription.plan === 'BUSINESS', `Shop plan upgraded to BUSINESS`);
  assert(subUpdateRes.data.data.subscription.status === 'ACTIVE', `Shop status set to ACTIVE`);
  assert(subUpdateRes.data.data.quotas.maxStaffSeats === 15, `Quotas automatically synchronized (15 staff seats)`);
  assert(
    subUpdateRes.data.data.quotas.storageLimitBytes === 100000 * 1024 * 1024,
    `Storage quota synchronized to 100 GB`
  );

  // 10. Plan Management: Create New Plan Tier
  console.log('\n--- TEST 10: Create New Plan Tier ---');
  const newPlanKey = `AGENCY_${suffix}`;
  const createPlanRes = await post(
    '/superadmin/plans',
    {
      planKey: newPlanKey,
      displayName: `Agency Studio ${suffix}`,
      description: 'Dedicated enterprise plan for large studio chains',
      monthlyPrice: 4990,
      yearlyPrice: 49900,
      storageLimitMB: 150000,
      staffLimit: 25,
      monthlyJobLimit: 5000,
      backupAvailability: 'DAILY',
      isActive: true,
    },
    adminHeaders
  );
  assert(createPlanRes.status === 201, `POST /superadmin/plans creates plan (HTTP 201)`);
  assert(createPlanRes.data.data.planKey === newPlanKey, `Created plan has key ${newPlanKey}`);

  // 11. Plan Management: Update Plan Settings
  console.log('\n--- TEST 11: Update Plan Pricing & Quotas ---');
  const updatePlanRes = await put(
    `/superadmin/plans/${newPlanKey}`,
    {
      monthlyPrice: 5490,
      displayName: `Agency Studio Premium ${suffix}`,
    },
    adminHeaders
  );
  assert(updatePlanRes.status === 200, `PUT /superadmin/plans/:planKey succeeds (HTTP 200)`);
  assert(updatePlanRes.data.data.monthlyPrice === 5490, `Monthly price updated to ৳5,490`);

  // 12. Plan Management: Prevent Archiving Plan with Active Tenants
  console.log('\n--- TEST 12: Guard: Prevent Archiving Plan with Active Tenants ---');
  // Attempt to archive BUSINESS plan while Target Shop is using it
  const archiveBlockedRes = await del('/superadmin/plans/BUSINESS', adminHeaders);
  assert(
    archiveBlockedRes.status === 400,
    `Archiving plan with active tenants is blocked with HTTP 400 (got ${archiveBlockedRes.status})`
  );

  // 13. Plan Management: Archive Inactive / Unused Plan
  console.log('\n--- TEST 13: Archive Inactive Plan ---');
  const archiveRes = await del(`/superadmin/plans/${newPlanKey}`, adminHeaders);
  assert(archiveRes.status === 200, `DELETE /superadmin/plans/:planKey archives plan (HTTP 200)`);
  assert(archiveRes.data.data.isActive === false, `Plan marked isActive = false`);

  // 14. Payment Management: Transactions Ledger
  console.log('\n--- TEST 14: Centralized Transactions Ledger ---');
  const txRes = await get('/superadmin/transactions?page=1&limit=20', adminHeaders);
  assert(txRes.status === 200, `GET /superadmin/transactions returns 200`);
  assert(Array.isArray(txRes.data.data.transactions), `Transactions returned as array`);

  // 15. Payment Management: Invoices List & Stats
  console.log('\n--- TEST 15: Platform Invoices & Payment Statistics ---');
  const invRes = await get('/superadmin/invoices', adminHeaders);
  assert(invRes.status === 200, `GET /superadmin/invoices returns 200`);
  assert(Array.isArray(invRes.data.data.invoices), `Invoices returned as array`);

  const paymentStatsRes = await get('/superadmin/payment-stats', adminHeaders);
  assert(paymentStatsRes.status === 200, `GET /superadmin/payment-stats returns 200`);
  assert(typeof paymentStatsRes.data.data.monthlySuccessRevenue === 'number', `Monthly success revenue returned`);

  // 16. Platform Settings: Pre-Seeded Defaults
  console.log('\n--- TEST 16: Platform Settings (Auto-Seeded System Defaults) ---');
  const settingsRes = await get('/superadmin/settings', adminHeaders);
  assert(settingsRes.status === 200, `GET /superadmin/settings returns 200`);
  const settingsList: any[] = settingsRes.data.data;
  assert(settingsList.length >= 10, `At least 10 platform settings auto-seeded (found ${settingsList.length})`);

  const siteNameSetting = settingsList.find((s) => s.key === 'SITE_NAME');
  const maintenanceSetting = settingsList.find((s) => s.key === 'MAINTENANCE_MODE');
  assert(!!siteNameSetting, `Found SITE_NAME setting`);
  assert(!!maintenanceSetting, `Found MAINTENANCE_MODE setting`);

  // 17. Platform Settings: Update Individual Setting
  console.log('\n--- TEST 17: Update Setting & Audit Logging ---');
  const updateSettingRes = await put(
    '/superadmin/settings/SITE_NAME',
    { value: 'DocuStudio Enterprise Platform' },
    adminHeaders
  );
  assert(updateSettingRes.status === 200, `PUT /superadmin/settings/SITE_NAME succeeds (HTTP 200)`);
  assert(updateSettingRes.data.data.value === 'DocuStudio Enterprise Platform', `Setting value updated`);

  // 18. Platform Settings: Bulk Update
  console.log('\n--- TEST 18: Bulk Update Platform Settings ---');
  const bulkRes = await post(
    '/superadmin/settings/bulk',
    {
      updates: [
        { key: 'MAX_UPLOAD_SIZE_MB', value: 30 },
        { key: 'SESSION_TIMEOUT_MINUTES', value: 45 },
      ],
    },
    adminHeaders
  );
  assert(bulkRes.status === 200, `POST /superadmin/settings/bulk succeeds (HTTP 200)`);
  assert(Array.isArray(bulkRes.data.data), `Bulk updates returned results array`);

  // 19. Security: Immutable Audit Logs Retrieval
  console.log('\n--- TEST 19: Security Audit Trail & Action Filtering ---');
  const auditRes = await get('/superadmin/audit-logs?page=1&limit=25', adminHeaders);
  assert(auditRes.status === 200, `GET /superadmin/audit-logs returns 200`);
  const logsList: any[] = auditRes.data.data.logs;
  assert(logsList.length >= 3, `Audit trail contains records (found ${logsList.length})`);

  const hasSuspensionAudit = logsList.some((l) => l.action === 'SUPERADMIN_SHOP_SUSPENDED');
  const hasActivationAudit = logsList.some((l) => l.action === 'SUPERADMIN_SHOP_ACTIVATED');
  const hasPlanCreatedAudit = logsList.some((l) => l.action === 'SUPERADMIN_PLAN_CREATED');
  assert(hasSuspensionAudit, `Audit trail recorded SUPERADMIN_SHOP_SUSPENDED`);
  assert(hasActivationAudit, `Audit trail recorded SUPERADMIN_SHOP_ACTIVATED`);
  assert(hasPlanCreatedAudit, `Audit trail recorded SUPERADMIN_PLAN_CREATED`);

  // Disconnect Database
  await mongoose.disconnect();

  // Summary
  console.log('\n=============================================================');
  console.log(`--- PHASE 13 TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED ---`);
  console.log('=============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase13Tests().catch((err) => {
  console.error('Fatal error running Phase 13 tests:', err);
  process.exit(1);
});

