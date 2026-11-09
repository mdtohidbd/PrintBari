import mongoose from 'mongoose';
import { Database } from '../config/db';
import { User } from '../models/User.model';
import { Tenant } from '../models/Tenant.model';
import { PlanConfig } from '../models/Subscription.model';
import { RolePermission } from '../models/RolePermission.model';
import { ServiceItem } from '../models/ServiceCatalog.model';
import { PassportPresetModel } from '../models/PassportPreset.model';
import { CvTemplateModel } from '../models/CvTemplate.model';
import { configCache } from '../utils/configCache';

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

async function runPhase18Tests() {
  console.log('\n======================================================================');
  console.log('--- STARTING PHASE 18: DYNAMIC BUSINESS LOGIC & CONFIGURATION ENGINE ---');
  console.log('======================================================================\n');

  const suffix = Date.now().toString().slice(-5);

  // 1. Setup Tenant and Super Admin accounts
  console.log('--- TEST 1: Register Tenant (Shop Owner) & Setup Super Admin ---');
  const ownerEmail = `dynowner_${suffix}@docustudio.test`;
  const regShopRes = await post('/auth/register-shop', {
    shopName: `Dynamic Print Works ${suffix}`,
    subdomain: `dyn-print-${suffix}`,
    ownerName: 'Tamim Iqbal',
    email: ownerEmail,
    password: 'SecurePassword123!',
    plan: 'STARTER',
  });
  assert(regShopRes.status === 201, `Shop registered successfully (status ${regShopRes.status})`);
  const ownerToken = regShopRes.data.data?.tokens?.accessToken;
  const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };
  const tenantId = regShopRes.data.data?.tenant?._id || regShopRes.data.data?.tenant?.id;

  // Super Admin setup
  const adminEmail = `dynadmin_${suffix}@docustudio.test`;
  const adminRegRes = await post('/auth/register-shop', {
    shopName: `DocuStudio Central Platform ${suffix}`,
    subdomain: `dyn-central-${suffix}`,
    ownerName: 'Platform Architect',
    email: adminEmail,
    password: 'SecurePassword123!',
    plan: 'ENTERPRISE',
  });
  assert(adminRegRes.status === 201, `Admin base account registered`);
  const adminUserId = adminRegRes.data.data?.user?._id || adminRegRes.data.data?.user?.id;

  await Database.getInstance().connect();
  await User.findByIdAndUpdate(adminUserId, { role: 'SUPER_ADMIN' });

  const adminLoginRes = await post('/auth/login', {
    email: adminEmail,
    password: 'SecurePassword123!',
  });
  assert(adminLoginRes.status === 200, `Admin logged in with SUPER_ADMIN role`);
  const adminToken = adminLoginRes.data.data?.tokens?.accessToken;
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  // 2. Dynamic Service Catalog
  console.log('\n--- TEST 2: Dynamic Service Catalog (Global & Shop-Custom) ---');
  const catalogRes = await get('/services/catalog', ownerHeaders);
  assert(catalogRes.status === 200, `Retrieved service catalog (HTTP 200)`);
  assert(Array.isArray(catalogRes.data.data) && catalogRes.data.data.length >= 6, `Catalog contains standard seeded services`);

  // Shop Owner creates custom service
  const customServiceRes = await post(
    '/services/custom',
    {
      serviceCode: `SPIRAL_BIND_${suffix}`,
      category: 'DOCUMENT',
      name: 'Spiral Document Binding',
      nameBn: 'স্পাইরাল বাইন্ডিং',
      unitPrice: 50,
      minPrice: 30,
      pricingUnit: 'PER_PIECE',
    },
    ownerHeaders
  );
  assert(customServiceRes.status === 201, `Shop Owner created custom service (HTTP 201)`);
  const customServiceId = customServiceRes.data.data?._id;

  // Shop Owner updates custom service price
  const updateServiceRes = await put(
    `/services/custom/${customServiceId}`,
    {
      unitPrice: 65,
      minPrice: 40,
    },
    ownerHeaders
  );
  assert(updateServiceRes.status === 200, `Shop Owner updated custom service unit price (HTTP 200)`);
  assert(updateServiceRes.data.data?.unitPrice === 65, `Custom service unit price updated to 65`);

  // Super Admin adds a global service
  const globalServiceRes = await post(
    '/superadmin/services',
    {
      serviceCode: `PLASTIC_LAMINATE_${suffix}`,
      category: 'FINISHING',
      name: 'High Gloss Plastic Lamination',
      nameBn: 'হাই গ্লস ল্যামিনেশন',
      unitPrice: 25,
      minPrice: 20,
      pricingUnit: 'PER_PAGE',
    },
    adminHeaders
  );
  assert(globalServiceRes.status === 200, `Super Admin upserted global service (HTTP 200)`);

  // Verify non-admin cannot access superadmin service route
  const nonAdminServiceRes = await post(
    '/superadmin/services',
    { serviceCode: 'UNAUTHORIZED_TEST', name: 'Unauthorized', unitPrice: 10 },
    ownerHeaders
  );
  assert(nonAdminServiceRes.status === 403, `Non-admin blocked from /superadmin/services (HTTP 403)`);

  // 3. Dynamic Passport Photo Presets
  console.log('\n--- TEST 3: Dynamic Passport Presets & 300 DPI Validation ---');
  const presetsRes = await get('/passport/presets', ownerHeaders);
  assert(presetsRes.status === 200, `Retrieved passport presets (HTTP 200)`);
  assert(Array.isArray(presetsRes.data.data) && presetsRes.data.data.length >= 8, `Presets include standard country sizes`);

  // Shop Owner creates custom preset
  const customPresetRes = await post(
    '/passport/presets/custom',
    {
      presetKey: `schengen_spec_${suffix}`,
      name: 'Schengen Specific Visa',
      country: 'Germany',
      widthMm: 35,
      heightMm: 45,
      bgColor: '#FFFFFF',
      description: 'Schengen biometric standard',
    },
    ownerHeaders
  );
  assert(customPresetRes.status === 201, `Shop Owner created custom preset (HTTP 201)`);
  // Verify 300 DPI auto-calculation: round(35 * 300 / 25.4) = 413, round(45 * 300 / 25.4) = 531
  assert(customPresetRes.data.data?.widthPx === 413, `Auto-calculated widthPx at 300 DPI: 413`);
  assert(customPresetRes.data.data?.heightPx === 531, `Auto-calculated heightPx at 300 DPI: 531`);

  // Super Admin creates a global preset
  const globalPresetRes = await post(
    '/superadmin/presets',
    {
      presetKey: `japan_business_${suffix}`,
      name: 'Japan Business Visa',
      country: 'Japan',
      widthMm: 45,
      heightMm: 45,
      bgColor: '#FFFFFF',
      description: 'Japan standard 45x45mm',
    },
    adminHeaders
  );
  assert(globalPresetRes.status === 200, `Super Admin created global passport preset (HTTP 200)`);
  assert(globalPresetRes.data.data?.widthPx === 531, `Global preset auto-calculated 45mm = 531px`);

  // 4. Dynamic CV Templates
  console.log('\n--- TEST 4: Dynamic CV Templates Catalog ---');
  const cvTemplatesRes = await get('/cv/cv-templates', ownerHeaders);
  assert(cvTemplatesRes.status === 200, `Retrieved CV templates catalog (HTTP 200)`);
  assert(Array.isArray(cvTemplatesRes.data.data) && cvTemplatesRes.data.data.length >= 5, `CV templates seeded across categories`);

  // Super Admin creates global CV template
  const newCvTemplateRes = await post(
    '/superadmin/cv-templates',
    {
      templateKey: `EXECUTIVE_PRO_${suffix}`,
      name: 'Executive Minimalist C-Suite',
      category: 'EXECUTIVE',
      description: 'Clean high-density executive profile',
      supportedColors: ['#0F172A', '#1E3A8A', '#065F46'],
    },
    adminHeaders
  );
  assert(newCvTemplateRes.status === 200, `Super Admin created global CV template (HTTP 200)`);

  // 5. Dynamic Feature Access Enforcement
  console.log('\n--- TEST 5: Dynamic Plan Feature Access Gatekeeping ---');
  // Super Admin disables OCR module for STARTER plan
  const disableModuleRes = await put(
    '/superadmin/plans/STARTER',
    {
      enabledModules: ['PASSPORT', 'DOCUMENT', 'IDCARD', 'CV', 'PRINT_QUEUE'],
    },
    adminHeaders
  );
  assert(disableModuleRes.status === 200, `Super Admin disabled OCR module for STARTER plan`);

  // Verify access is blocked with HTTP 403 Forbidden
  const ocrBlockedRes = await post('/ocr/extract', {}, ownerHeaders);
  assert(ocrBlockedRes.status === 403, `Access to /ocr/extract blocked when module disabled in plan (HTTP 403)`);

  // Super Admin re-enables OCR module for STARTER plan
  const enableModuleRes = await put(
    '/superadmin/plans/STARTER',
    {
      enabledModules: ['PASSPORT', 'DOCUMENT', 'IDCARD', 'CV', 'OCR', 'PRINT_QUEUE'],
    },
    adminHeaders
  );
  assert(enableModuleRes.status === 200, `Super Admin re-enabled OCR module for STARTER plan`);

  // Verify access is no longer blocked by plan feature check (returns 400 Bad Request due to missing file, not 403 Forbidden)
  const ocrEnabledRes = await post('/ocr/extract', {}, ownerHeaders);
  assert(ocrEnabledRes.status === 400, `Access allowed past feature gate (HTTP 400 validation error, not 403 forbidden)`);

  // 6. Dynamic Monthly Job Quotas Enforcement
  console.log('\n--- TEST 6: Dynamic Monthly Job Limits Enforcement ---');
  // Set tenant quota to limit of 2 and already used 2
  await Tenant.findByIdAndUpdate(tenantId, {
    'quotas.monthlyJobsLimit': 2,
    'quotas.monthlyJobsUsed': 2,
  });

  // Attempt to create a job
  const jobQuotaBlockedRes = await post(
    '/jobs',
    {
      customerName: 'Sohan Rahman',
      customerPhone: '01819998877',
      title: 'Quota Exceeded Job Test',
      serviceType: 'PHOTOCOPY',
      price: { subtotal: 10, totalPrice: 10 },
    },
    ownerHeaders
  );
  assert(jobQuotaBlockedRes.status === 403, `Job creation rejected when monthlyJobsUsed >= monthlyJobsLimit (HTTP 403)`);

  // Increase limit and test successful job creation
  await Tenant.findByIdAndUpdate(tenantId, {
    'quotas.monthlyJobsLimit': 100,
    'quotas.monthlyJobsUsed': 0,
  });

  const jobCreatedRes = await post(
    '/jobs',
    {
      customerName: 'Sohan Rahman',
      customerPhone: '01819998877',
      title: 'Valid Quota Job Test',
      serviceType: 'PHOTOCOPY',
      price: { subtotal: 20, totalPrice: 20 },
    },
    ownerHeaders
  );
  assert(jobCreatedRes.status === 201, `Job successfully created within quota limits (HTTP 201)`);

  // Verify monthlyJobsUsed was incremented in the database
  const updatedTenant = await Tenant.findById(tenantId).lean();
  assert(updatedTenant?.quotas?.monthlyJobsUsed === 1, `Tenant monthlyJobsUsed incremented to 1`);

  // 7. Dynamic Role-Permission Management
  console.log('\n--- TEST 7: Dynamic Role-Permissions Matrix (Super Admin) ---');
  const rolePermsRes = await get('/superadmin/roles/permissions', adminHeaders);
  assert(rolePermsRes.status === 200, `Super Admin retrieved role permission matrix (HTTP 200)`);

  // Update permissions for OPERATOR role
  const updatePermsRes = await put(
    '/superadmin/roles/OPERATOR/permissions',
    {
      permissions: ['JOBS_READ', 'JOBS_CREATE', 'JOBS_PRINT', 'CUSTOMERS_READ'],
    },
    adminHeaders
  );
  assert(updatePermsRes.status === 200, `Super Admin updated permissions for OPERATOR role (HTTP 200)`);
  assert(
    Array.isArray(updatePermsRes.data.data?.permissions) &&
      updatePermsRes.data.data.permissions.includes('JOBS_PRINT'),
    `OPERATOR has JOBS_PRINT permission`
  );

  // 8. Configuration Caching and Dynamic Invalidation
  console.log('\n--- TEST 8: Config Cache & Instant Invalidation ---');
  // First call seeds the cache
  const cachedCall1 = await get('/services/catalog', ownerHeaders);
  assert(cachedCall1.status === 200, `First catalog call succeeds`);

  // Second call retrieves from cache
  const cachedCall2 = await get('/services/catalog', ownerHeaders);
  assert(cachedCall2.status === 200, `Second call served directly from memory cache`);

  // Adding another custom service invalidates the tenant's cache
  const anotherServiceRes = await post(
    '/services/custom',
    {
      serviceCode: `INSTANT_PHOTO_${suffix}`,
      category: 'PASSPORT',
      name: 'Instant Photo Glossy 4x6',
      unitPrice: 120,
      minPrice: 100,
      pricingUnit: 'PER_SET',
    },
    ownerHeaders
  );
  assert(anotherServiceRes.status === 201, `Created new service and invalidated cache`);

  // Immediate catalog call retrieves fresh merged data including the new item
  const freshCatalog = await get('/services/catalog', ownerHeaders);
  const foundNewService = freshCatalog.data.data?.some(
    (item: any) => item.serviceCode === `INSTANT_PHOTO_${suffix}`
  );
  assert(foundNewService === true, `Fresh catalog query immediately includes invalidated item`);

  // 9. Preserving Security & Platform Invariants
  console.log('\n--- TEST 9: Security Invariants (Tenant Isolation & Authorization) ---');
  // Another shop tenant cannot see or modify the first shop's custom services
  const otherOwnerEmail = `dynother_${suffix}@docustudio.test`;
  const otherShopRes = await post('/auth/register-shop', {
    shopName: `Competitor Print Shop ${suffix}`,
    subdomain: `comp-print-${suffix}`,
    ownerName: 'Shakib Al Hasan',
    email: otherOwnerEmail,
    password: 'SecurePassword123!',
    plan: 'PRO',
  });
  const otherToken = otherShopRes.data.data?.tokens?.accessToken;
  const otherHeaders = { Authorization: `Bearer ${otherToken}` };

  const otherCatalogRes = await get('/services/catalog', otherHeaders);
  const leakedService = otherCatalogRes.data.data?.some(
    (item: any) => item.serviceCode === `INSTANT_PHOTO_${suffix}`
  );
  assert(leakedService === false, `Tenant isolation preserved: custom services are private to tenant`);

  // Other tenant cannot edit the first tenant's custom service
  const unauthorizedEdit = await put(
    `/services/custom/${customServiceId}`,
    { unitPrice: 1 },
    otherHeaders
  );
  assert(unauthorizedEdit.status === 404, `Cross-tenant edit prevented (HTTP 404 Not Found)`);

  console.log('\n======================================================================');
  console.log(`--- TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED ---`);
  console.log('======================================================================\n');

  await mongoose.disconnect();

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase18Tests().catch(async (err) => {
  console.error('Fatal error running Phase 18 tests:', err);
  await mongoose.disconnect();
  process.exit(1);
});
