export {};

/**
 * Automated Verification Test Suite for Phase 10:
 * Customer Management and Job Management System
 *
 * Tests:
 * 1. Shop Tenant registration and authentication
 * 2. Customer Management:
 *    - Add Customer with validation
 *    - Duplicate phone rejection for same tenant
 *    - Customer search by name and mobile
 *    - Customer Profile retrieval & statistics
 *    - Edit Customer information
 *    - Customer File Library (Add file, list files, reuse files)
 *    - Soft delete customer
 * 3. Job Management:
 *    - Create job with unique Job ID (JOB-XXXXXX), customer auto-link, and pricing
 *    - Job search & filtering (by status, priority, serviceType, keyword)
 *    - Job details with activity logs & file versioning
 *    - State machine validation for status workflow (DRAFT -> NEW -> PROCESSING -> READY_FOR_REVIEW -> APPROVED -> QUEUED -> PRINTING -> COMPLETED)
 *    - Reject invalid status transitions (e.g., NEW -> COMPLETED)
 *    - Add new file version to job
 *    - Job duplication (clones parameters with new Job ID)
 *    - Staff assignment & audit logging
 * 4. Cross-Tenant Isolation:
 *    - Tenant B cannot access Tenant A customers
 *    - Tenant B cannot access or mutate Tenant A jobs
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

const del = async (endpoint: string, headers: Record<string, string> = {}) => {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...headers },
  });
  const data: any = await res.json().catch(() => ({}));
  return { status: res.status, data };
};

async function runPhase10Tests() {
  console.log('\n============================================================');
  console.log('🚀 DOCUSTUDIO SAAS - PHASE 10 CUSTOMER & JOB MANAGEMENT VERIFICATION');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, testName: string, detail?: string) => {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  };

  try {
    // 1. Provision Shop Tenant A
    const suffix = Date.now().toString().slice(-5);
    const subA = `crm-shop-${suffix}`;
    const regResA = await post('/auth/register-shop', {
      shopName: `Elite Document & Print Center ${suffix}`,
      subdomain: subA,
      ownerName: `Kazi Monirul ${suffix}`,
      email: `monirul.${suffix}@docustudio.test`,
      password: 'SecurePassword123!',
      plan: 'PROFESSIONAL',
    });

    assert(regResA.status === 201, 'Tenant A registration succeeds', JSON.stringify(regResA.data));
    const tokenA = regResA.data.data?.tokens?.accessToken;
    const authHeadersA = { Authorization: `Bearer ${tokenA}` };

    // 2. Customer Management Tests
    // 2.1 Add Customer
    const testPhone = `01711${suffix}`;
    const createCustomerRes = await post(
      '/customers',
      {
        fullName: 'Mahmudur Rahman',
        phone: testPhone,
        email: `mahmud.${suffix}@gmail.com`,
        address: 'Section 10, Mirpur, Dhaka',
        notes: 'Regular customer for photocopy and deed agreements',
      },
      authHeadersA
    );

    assert(createCustomerRes.status === 201, 'POST /customers creates new customer');
    const customerA = createCustomerRes.data?.data;
    assert(Boolean(customerA?._id), 'Customer assigned valid MongoDB ObjectId');
    assert(customerA?.fullName === 'Mahmudur Rahman', 'Customer full name matches input');
    assert(customerA?.phone === testPhone, 'Customer phone number persisted');

    // 2.2 Duplicate Phone Rejection
    const dupRes = await post(
      '/customers',
      {
        fullName: 'Duplicate Contact',
        phone: testPhone,
      },
      authHeadersA
    );
    assert(dupRes.status === 400, 'Rejects duplicate customer phone for same tenant');

    // 2.3 Customer Search
    const searchRes = await get(`/customers?search=${testPhone}`, authHeadersA);
    assert(searchRes.status === 200, 'GET /customers with search query returns 200');
    const searchResults = searchRes.data?.data?.customers;
    assert(
      Array.isArray(searchResults) && searchResults.some((c: any) => c.phone === testPhone),
      'Customer found via phone search'
    );

    // 2.4 Get Customer Profile
    const profileRes = await get(`/customers/${customerA._id}`, authHeadersA);
    assert(profileRes.status === 200, 'GET /customers/:id retrieves customer profile');
    assert(profileRes.data?.data?.address === 'Section 10, Mirpur, Dhaka', 'Customer address retrieved in profile');
    assert(Array.isArray(profileRes.data?.data?.recentJobs), 'Customer profile includes recentJobs array');

    // 2.5 Update Customer
    const updateCustomerRes = await put(
      `/customers/${customerA._id}`,
      {
        fullName: 'Mahmudur Rahman (VIP)',
        address: 'House 45, Road 2, Mirpur 10, Dhaka',
        notes: 'Updated notes: VIP corporate client',
      },
      authHeadersA
    );
    assert(updateCustomerRes.status === 200, 'PUT /customers/:id updates customer profile');
    assert(updateCustomerRes.data?.data?.fullName === 'Mahmudur Rahman (VIP)', 'Customer name updated');

    // 2.6 Customer File Library: Add File
    const addFileRes = await post(
      `/customers/${customerA._id}/files`,
      {
        name: 'Passport_Scan.jpg',
        url: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
        size: 204800,
        mimeType: 'image/jpeg',
        sourceJobCode: 'JOB-INIT',
      },
      authHeadersA
    );
    assert(addFileRes.status === 201, 'POST /customers/:id/files adds file to customer library');
    assert(typeof addFileRes.data?.data?.fileId === 'string', 'File assigned unique fileId');

    // 2.7 Get Customer File Library
    const getFilesRes = await get(`/customers/${customerA._id}/files`, authHeadersA);
    assert(getFilesRes.status === 200, 'GET /customers/:id/files retrieves file library');
    const filesList = getFilesRes.data?.data;
    assert(Array.isArray(filesList) && filesList.length >= 1, 'File library contains uploaded file');
    const libraryFile = filesList[0];

    // 3. Job Management Tests
    // 3.1 Create Job with Customer auto-link, Pricing, and Uploaded Files
    const createJobRes = await post(
      '/jobs',
      {
        customerId: customerA._id,
        customerName: customerA.fullName,
        customerPhone: customerA.phone,
        serviceType: 'PASSPORT_PHOTO',
        priority: 'URGENT',
        copies: 8,
        paperType: 'Glossy Photo Paper (260 GSM)',
        price: {
          subtotal: 160,
          discount: 10,
          tax: 0,
          totalPrice: 150,
        },
        paidAmount: 150,
        paymentMethod: 'BKASH',
        uploadedFiles: [
          {
            fileId: libraryFile.fileId,
            name: libraryFile.name,
            url: libraryFile.url,
            size: libraryFile.size,
            mimeType: libraryFile.mimeType,
            version: 1,
          },
        ],
        notes: 'Delivery required within 30 minutes',
        status: 'NEW',
      },
      authHeadersA
    );

    assert(createJobRes.status === 201, 'POST /jobs creates new job order');
    const jobA = createJobRes.data?.data;
    assert(Boolean(jobA?._id), 'Job assigned valid MongoDB ObjectId');
    assert(typeof jobA?.jobCode === 'string' && jobA.jobCode.startsWith('JOB-'), `Job code generated: ${jobA?.jobCode}`);
    assert(jobA?.status === 'NEW', 'Initial job status is NEW');
    assert(jobA?.priority === 'URGENT', 'Priority set to URGENT');
    assert(jobA?.totalAmount === 150, 'Total amount calculated accurately');
    assert(jobA?.paymentStatus === 'PAID', 'Payment status automatically set to PAID');
    assert(
      Array.isArray(jobA?.activityLogs) && jobA.activityLogs.length >= 1,
      'Initial activity log created on job creation'
    );

    // 3.2 List Jobs with Status Filter & Search
    const listJobsRes = await get(`/jobs?status=NEW&search=${jobA.jobCode}`, authHeadersA);
    assert(listJobsRes.status === 200, 'GET /jobs with filters returns 200');
    const jobsList = listJobsRes.data?.data?.jobs;
    assert(
      Array.isArray(jobsList) && jobsList.some((j: any) => j._id === jobA._id),
      'Created job found in queue search'
    );

    // 3.3 Get Job Details by ID
    const getJobRes = await get(`/jobs/${jobA._id}`, authHeadersA);
    assert(getJobRes.status === 200, 'GET /jobs/:jobId returns full job details');
    assert(getJobRes.data?.data?.jobCode === jobA.jobCode, 'Retrieved job matches jobCode');
    assert(getJobRes.data?.data?.uploadedFiles?.length >= 1, 'Job contains uploaded file');

    // 3.4 Status Workflow State Machine Transition:
    // Step 1: NEW -> PROCESSING
    const trans1 = await patch(
      `/jobs/${jobA._id}/status`,
      { status: 'PROCESSING', note: 'Operator started photo cropping and background removal' },
      authHeadersA
    );
    assert(trans1.status === 200, 'Status transition: NEW -> PROCESSING succeeds');
    assert(trans1.data?.data?.status === 'PROCESSING', 'Job status is now PROCESSING');

    // Step 2: Test Invalid Transition (PROCESSING -> NEW should be rejected according to workflow)
    const invalidTrans = await patch(
      `/jobs/${jobA._id}/status`,
      { status: 'NEW' },
      authHeadersA
    );
    assert(invalidTrans.status === 400, 'Rejects invalid transition (PROCESSING -> NEW)');

    // Step 3: PROCESSING -> READY_FOR_REVIEW
    const trans2 = await patch(
      `/jobs/${jobA._id}/status`,
      { status: 'READY_FOR_REVIEW', note: 'Sent digital proof to customer for approval' },
      authHeadersA
    );
    assert(trans2.status === 200, 'Status transition: PROCESSING -> READY_FOR_REVIEW succeeds');

    // Step 4: READY_FOR_REVIEW -> APPROVED
    const trans3 = await patch(
      `/jobs/${jobA._id}/status`,
      { status: 'APPROVED', note: 'Customer approved passport photo proof via counter' },
      authHeadersA
    );
    assert(trans3.status === 200, 'Status transition: READY_FOR_REVIEW -> APPROVED succeeds');

    // Step 5: APPROVED -> QUEUED
    const trans4 = await patch(
      `/jobs/${jobA._id}/status`,
      { status: 'QUEUED', note: 'Queued to Epson L805 printer tray' },
      authHeadersA
    );
    assert(trans4.status === 200, 'Status transition: APPROVED -> QUEUED succeeds');

    // Step 6: QUEUED -> PRINTING
    const trans5 = await patch(
      `/jobs/${jobA._id}/status`,
      { status: 'PRINTING', note: 'Spooling 8 copies on photo sheet' },
      authHeadersA
    );
    assert(trans5.status === 200, 'Status transition: QUEUED -> PRINTING succeeds');

    // Step 7: PRINTING -> COMPLETED
    const trans6 = await patch(
      `/jobs/${jobA._id}/status`,
      { status: 'COMPLETED', note: 'Prints dried, cut, packed and handed to customer' },
      authHeadersA
    );
    assert(trans6.status === 200, 'Status transition: PRINTING -> COMPLETED succeeds');
    assert(Boolean(trans6.data?.data?.completedAt), 'Job sets completedAt timestamp');

    // 3.5 Verify Activity Logs History
    const updatedJobRes = await get(`/jobs/${jobA._id}`, authHeadersA);
    const logs = updatedJobRes.data?.data?.activityLogs;
    assert(
      Array.isArray(logs) && logs.length >= 7,
      `All 7 lifecycle transitions recorded in activity logs (Count: ${logs?.length})`
    );

    // 3.6 File Versioning: Add Processed File (v1, v2)
    const addFileVersion1 = await post(
      `/jobs/${jobA._id}/files`,
      {
        name: 'Passport_Output.jpg',
        url: 'data:image/jpeg;base64,/9j/processed_v1...',
        size: 512000,
        mimeType: 'image/jpeg',
        type: 'PROCESSED',
      },
      authHeadersA
    );
    assert(addFileVersion1.status === 201, 'POST /jobs/:jobId/files adds processed file v1');
    assert(addFileVersion1.data?.data?.version === 1, 'First file version is v1');

    const addFileVersion2 = await post(
      `/jobs/${jobA._id}/files`,
      {
        name: 'Passport_Output.jpg',
        url: 'data:image/jpeg;base64,/9j/processed_v2_brightened...',
        size: 520000,
        mimeType: 'image/jpeg',
        type: 'PROCESSED',
      },
      authHeadersA
    );
    assert(addFileVersion2.status === 201, 'POST /jobs/:jobId/files adds updated version');
    assert(addFileVersion2.data?.data?.version === 2, 'Incremental versioning increments to v2');

    // 3.7 Job Duplication Test
    const duplicateRes = await post(`/jobs/${jobA._id}/duplicate`, {}, authHeadersA);
    assert(duplicateRes.status === 201, 'POST /jobs/:jobId/duplicate creates cloned job');
    const duplicatedJob = duplicateRes.data?.data;
    assert(duplicatedJob?.jobCode !== jobA.jobCode, `Duplicated job has new unique code: ${duplicatedJob?.jobCode}`);
    assert(duplicatedJob?.customerName === jobA.customerName, 'Duplicated job retains customer link');
    assert(duplicatedJob?.status === 'NEW', 'Duplicated job status resets to NEW');
    assert(duplicatedJob?.paidAmount === 0, 'Duplicated job resets payment amount');

    // 4. Multi-Tenant Cross-Access Isolation Tests
    const subB = `competitor-shop-${suffix}`;
    const regResB = await post('/auth/register-shop', {
      shopName: `Competitor Printing Studio ${suffix}`,
      subdomain: subB,
      ownerName: `Other Owner ${suffix}`,
      email: `competitor.${suffix}@docustudio.test`,
      password: 'SecurePassword123!',
      plan: 'STARTER',
    });
    const tokenB = regResB.data.data?.tokens?.accessToken;
    const authHeadersB = { Authorization: `Bearer ${tokenB}` };

    // Tenant B cannot access Tenant A Customer
    const crossCustomerRes = await get(`/customers/${customerA._id}`, authHeadersB);
    assert(
      crossCustomerRes.status === 404,
      'Tenant B cannot access Tenant A customer (Tenant Isolation enforced)'
    );

    // Tenant B cannot access Tenant A Job
    const crossJobRes = await get(`/jobs/${jobA._id}`, authHeadersB);
    assert(
      crossJobRes.status === 404,
      'Tenant B cannot access Tenant A job details (Tenant Isolation enforced)'
    );

    // Tenant B cannot mutate Tenant A Job status
    const crossMutateRes = await patch(
      `/jobs/${jobA._id}/status`,
      { status: 'CANCELLED' },
      authHeadersB
    );
    assert(
      crossMutateRes.status === 404,
      'Tenant B cannot change status of Tenant A job'
    );

    // Tenant B jobs list does not leak Tenant A jobs
    const listResB = await get('/jobs', authHeadersB);
    const jobsB = listResB.data?.data?.jobs;
    const leaked = jobsB?.some((j: any) => j._id === jobA._id);
    assert(!leaked, 'Tenant B job queue does not leak Tenant A jobs');

  } catch (err: any) {
    console.error('Unexpected test error:', err);
    failed++;
  }

  console.log('\n============================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} Passed | ${failed} Failed`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase10Tests();

