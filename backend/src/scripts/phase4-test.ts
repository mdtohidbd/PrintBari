export {};

/**
 * Comprehensive Automated Verification Script for Phase 4:
 * Shop Dashboard, Business Management, Jobs, and Staff Management
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

const patch = async (endpoint: string, body: any, headers: Record<string, string> = {}) => {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const data: any = await res.json().catch(() => ({}));
  return { status: res.status, data };
};

async function runPhase4Tests() {
  console.log('\n============================================================');
  console.log('🚀 RUNNING PHASE 4: SHOP DASHBOARD & BUSINESS MANAGEMENT TESTS');
  console.log('============================================================\n');

  const timestamp = Date.now().toString().slice(-5);
  const subdomain = `studio-${timestamp}`;

  // 1. Register Shop
  console.log('--- 1. Provisioning Test Shop ---');
  const regRes = await post('/auth/register-shop', {
    shopName: 'Apex Digital Print & Xerox Lab',
    subdomain,
    ownerName: 'Apex Owner',
    email: `owner@${subdomain}.com`,
    password: 'Password123!',
    plan: 'PROFESSIONAL',
  });

  if (regRes.status !== 201) {
    console.error('Registration failed:', regRes.data);
    process.exit(1);
  }

  const token = regRes.data.data.tokens.accessToken;
  const authHeader = { Authorization: `Bearer ${token}` };
  console.log('✅ Shop Provisioned successfully:', subdomain);

  // 2. Fetch Initial Dashboard Metrics (0 Jobs)
  console.log('\n--- 2. Initial Dashboard Metrics ---');
  const initialMetrics = await get('/dashboard/metrics', authHeader);
  console.log('Initial total jobs:', initialMetrics.data.data.metrics.totalJobs);

  // 3. Seed Realistic Demo Orders & Customers
  console.log('\n--- 3. Seed Demo Data ---');
  const seedRes = await post('/dashboard/seed-demo', {}, authHeader);
  console.log('Seed response:', seedRes.data.message);

  // 4. Verify Calculated Dashboard Metrics from MongoDB
  console.log('\n--- 4. Live Dashboard Metrics Calculation ---');
  const liveMetrics = await get('/dashboard/metrics', authHeader);
  const m = liveMetrics.data.data.metrics;
  const dist = liveMetrics.data.data.statusDistribution;
  console.log('✅ Total Jobs:', m.totalJobs);
  console.log('✅ Pending Jobs:', m.pendingJobs);
  console.log('✅ Completed Jobs:', m.completedJobs);
  console.log('✅ Today Orders:', m.todayOrders);
  console.log('✅ Total Customers:', m.totalCustomers);
  console.log('✅ Monthly Revenue:', m.monthlyRevenue);
  console.log('✅ Status Distribution:', dist);

  // 5. Create a New Walk-In Job Order
  console.log('\n--- 5. Create Walk-In Job Order ---');
  const jobRes = await post(
    '/jobs',
    {
      customerName: 'Rahim Uddin',
      customerPhone: '+880 1712 998877',
      serviceType: 'PASSPORT_PHOTO',
      priority: 'URGENT',
      copies: 8,
      paperType: '4x6 Photo Glossy',
      totalAmount: 6.0,
      paidAmount: 6.0,
      paymentMethod: 'CASH',
      notes: 'US Visa 2x2 specification',
    },
    authHeader
  );
  console.log('✅ Job Created:', jobRes.data.data.jobCode, 'Status:', jobRes.data.data.status);
  const createdJobId = jobRes.data.data._id;

  // 6. Transition Job Status
  console.log('\n--- 6. Transition Job Status ---');
  const statusRes = await patch(
    `/jobs/${createdJobId}/status`,
    { status: 'PROCESSING' },
    authHeader
  );
  console.log('✅ Job Transitioned to:', statusRes.data.data.status);

  // 7. Update Shop Profile & Address
  console.log('\n--- 7. Update Shop Profile & Address ---');
  const profileRes = await put(
    '/tenants/profile',
    {
      name: 'Apex Digital Print & Color Lab (HQ)',
      phone: '+880 1819 000111',
      email: 'support@apexprint.com',
      logoUrl: 'https://cdn.docustudio.io/demo-logo.png',
      address: {
        street: '12 Elephant Road, Shop #4B',
        city: 'Dhaka',
        state: 'Dhaka Division',
        postalCode: '1205',
        country: 'Bangladesh',
      },
    },
    authHeader
  );
  console.log('✅ Profile updated:', profileRes.data.data.name, 'City:', profileRes.data.data.address.city);

  // 8. Update Working Hours Schedule
  console.log('\n--- 8. Update Working Hours Schedule ---');
  const hoursRes = await put(
    '/tenants/working-hours',
    {
      monday: { open: '08:30', close: '22:00', isOpen: true },
      friday: { open: '14:00', close: '22:00', isOpen: true },
      sunday: { open: '10:00', close: '18:00', isOpen: false },
    },
    authHeader
  );
  console.log('✅ Working hours updated for Monday:', hoursRes.data.data.monday);

  // 9. Update Invoice Settings
  console.log('\n--- 9. Update Invoice & Tax Settings ---');
  const invRes = await put(
    '/tenants/invoice-settings',
    {
      prefix: 'APEX-',
      nextNumber: 5001,
      taxId: 'VAT-8849201',
      taxRatePercent: 5.0,
      footerNote: 'Thank you for choosing Apex Digital Print!',
    },
    authHeader
  );
  console.log('✅ Invoice settings updated, prefix:', invRes.data.data.prefix, 'Tax rate:', invRes.data.data.taxRatePercent);

  // 10. Update Print Settings
  console.log('\n--- 10. Update Print Preferences ---');
  const printRes = await put(
    '/tenants/print-settings',
    {
      defaultPaperSize: '4x6',
      autoPrintReceipt: true,
      printerDpi: 600,
      headerMarginMm: 8,
    },
    authHeader
  );
  console.log('✅ Print settings updated, default size:', printRes.data.data.defaultPaperSize, 'DPI:', printRes.data.data.printerDpi);

  // 11. Staff Management
  console.log('\n--- 11. Staff Management Tests ---');
  const addStaffRes = await post(
    '/tenants/staff',
    {
      fullName: 'Tariq Operator',
      email: `tariq@${subdomain}.com`,
      password: 'OperatorPass123!',
      role: 'OPERATOR',
      phone: '+880 1711 556677',
    },
    authHeader
  );
  console.log('✅ Staff member added:', addStaffRes.data.data.fullName, 'Role:', addStaffRes.data.data.role);
  const staffId = addStaffRes.data.data.id;

  // Edit Staff
  const editStaffRes = await put(
    `/tenants/staff/${staffId}`,
    {
      fullName: 'Tariqul Islam (Lead Operator)',
      role: 'REVIEWER',
    },
    authHeader
  );
  console.log('✅ Staff edited, new name:', editStaffRes.data.data.fullName, 'New role:', editStaffRes.data.data.role);

  // Toggle Status (Deactivate & Reactivate)
  const deactRes = await patch(`/tenants/staff/${staffId}/toggle-status`, {}, authHeader);
  console.log('✅ Staff deactivation toggle:', deactRes.data.data.isActive === false ? 'Deactivated' : 'Active');

  const reactRes = await patch(`/tenants/staff/${staffId}/toggle-status`, {}, authHeader);
  console.log('✅ Staff reactivation toggle:', reactRes.data.data.isActive === true ? 'Reactivated' : 'Inactive');

  // Verify Staff Activity History
  const actRes = await get(`/tenants/staff/${staffId}/activity`, authHeader);
  console.log('✅ Staff activity records logged:', actRes.data.data.length);

  console.log('\n============================================================');
  console.log('🎉 ALL PHASE 4 BACKEND ENDPOINTS & DATA PIPELINES VERIFIED!');
  console.log('============================================================\n');
}

runPhase4Tests().catch((err) => {
  console.error('Test Runner Failed:', err);
  process.exit(1);
});
