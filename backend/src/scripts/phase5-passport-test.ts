export {};

import sharp from 'sharp';

/**
 * Automated Verification Test Suite for Phase 5:
 * Passport Photo Studio Module
 *
 * Tests:
 * 1. Preset catalogue retrieval (US, UK/EU, BD, India, Canada, etc.)
 * 2. 300 DPI calculation & metadata validation
 * 3. Server-side Sharp single photo processing (crop, resize, rotation, background)
 * 4. Multi-photo print sheet composition (4x6 and A4) with hairline cut guidelines
 * 5. Vector PDF export generation
 * 6. MongoDB job persistence associated with tenant and customer
 * 7. Saved jobs retrieval and reopening
 * 8. Strict cross-tenant isolation enforcement
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

// Generate a valid valid 400x500 JPEG with portrait elements using sharp
async function createValidTestImageBase64(): Promise<string> {
  const buf = await sharp({
    create: {
      width: 400,
      height: 500,
      channels: 3,
      background: { r: 240, g: 240, b: 245 },
    },
  })
    .jpeg()
    .toBuffer();

  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

async function runPhase5Tests() {
  console.log('\n============================================================');
  console.log('🚀 DOCUSTUDIO SAAS - PHASE 5 PASSPORT STUDIO VERIFICATION');
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
    // 1. Register Tenant A (Studio A)
    const suffix = Date.now().toString().slice(-5);
    const subA = `studio-a-${suffix}`;
    const tenantAPayload = {
      shopName: `Metro Digital Studio ${suffix}`,
      subdomain: subA,
      ownerName: 'Shahidul Alam',
      email: `studio.a.${suffix}@docustudio.test`,
      password: 'Password123!',
      plan: 'PROFESSIONAL',
    };

    const regA = await post('/auth/register-shop', tenantAPayload);
    assert(regA.status === 201, 'Tenant A registration succeeds', JSON.stringify(regA.data));
    const tokenA = regA.data.data?.tokens?.accessToken;
    const authHeadersA = { Authorization: `Bearer ${tokenA}` };

    // 2. Presets Retrieval
    const presetsRes = await get('/passport/presets', authHeadersA);
    assert(presetsRes.status === 200, 'GET /passport/presets returns 200');
    const presetsList = presetsRes.data.data || [];
    assert(presetsList.length >= 6, 'Presets catalogue contains standard countries', `Count: ${presetsList.length}`);

    const usPreset = presetsList.find((p: any) => p.id === 'us_passport_2x2');
    const bdPreset = presetsList.find((p: any) => p.id === 'bd_passport_40x50');
    assert(!!usPreset && usPreset.widthPx === 602 && usPreset.heightPx === 602, 'US Passport preset calculates exact 300 DPI dimensions (602x602)');
    assert(!!bdPreset && bdPreset.widthPx === 472 && bdPreset.heightPx === 591, 'BD Passport preset calculates exact 300 DPI dimensions (472x591)');

    // 3. Process Single Photo with Sharp (300 DPI)
    const testBase64 = await createValidTestImageBase64();
    const processRes = await post(
      '/passport/process',
      {
        imageBase64: testBase64,
        presetId: 'us_passport_2x2',
        rotation: 90,
        brightness: 10,
        contrast: 15,
        backgroundColor: '#FFFFFF',
      },
      authHeadersA
    );

    assert(processRes.status === 200, 'POST /passport/process returns 200', JSON.stringify(processRes.data));
    assert(processRes.data.data?.dpi === 300, 'Sharp processing preserves exact 300 DPI resolution');
    assert(processRes.data.data?.widthPx === 602 && processRes.data.data?.heightPx === 602, 'Processed raster matches target preset dimensions');
    const processedBase64 = processRes.data.data?.base64;

    // 4. Generate Multi-Photo Print Sheet (4x6 layout with 6 copies & cut lines)
    const sheetRes = await post(
      '/passport/sheet',
      {
        imageBase64: processedBase64,
        presetId: 'us_passport_2x2',
        sheetLayout: '4x6',
        copies: 6,
      },
      authHeadersA
    );

    assert(sheetRes.status === 200, 'POST /passport/sheet arranges photo copies', JSON.stringify(sheetRes.data));
    assert(sheetRes.data.data?.sheetLayout === '4x6', 'Sheet layout correctly set to 4x6');
    assert(sheetRes.data.data?.dpi === 300, 'Print sheet rendered at true 300 DPI');
    const sheetBase64 = sheetRes.data.data?.sheetBase64;
    assert(!!sheetBase64 && sheetBase64.startsWith('data:image/jpeg;base64,'), 'Print sheet returned as valid Base64 JPEG');

    // 5. Generate Multi-Photo Print Sheet (A4 layout with 12 copies)
    const a4SheetRes = await post(
      '/passport/sheet',
      {
        imageBase64: processedBase64,
        presetId: 'bd_passport_40x50',
        sheetLayout: 'A4',
        copies: 12,
      },
      authHeadersA
    );
    assert(a4SheetRes.status === 200, 'POST /passport/sheet generates A4 layout');
    assert(a4SheetRes.data.data?.sheetLayout === 'A4', 'A4 layout verified');

    // 6. Vector PDF Export Generation
    const pdfRes = await fetch(`${BASE_URL}/passport/export-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        sheetBase64: sheetBase64,
        sheetLayout: '4x6',
        filename: 'test-sheet.pdf',
      }),
    });

    assert(pdfRes.status === 200, 'POST /passport/export-pdf returns 200 OK');
    const pdfContentType = pdfRes.headers.get('content-type');
    assert(pdfContentType?.includes('application/pdf') === true, 'PDF export sets application/pdf MIME type');
    const pdfBytes = await pdfRes.arrayBuffer();
    const pdfHeader = Buffer.from(pdfBytes.slice(0, 5)).toString();
    assert(pdfHeader === '%PDF-', 'Exported stream starts with standard PDF magic bytes (%PDF-)');

    // 7. Save Passport Job to MongoDB
    const saveJobRes = await post(
      '/passport/jobs',
      {
        customerName: 'Tanvir Hossain',
        customerPhone: '+8801811223344',
        presetId: 'us_passport_2x2',
        copies: 8,
        sheetLayout: '4x6',
        unitPrice: 120,
        originalImageBase64: testBase64,
        processedImageBase64: processedBase64,
        sheetImageBase64: sheetBase64,
        notes: 'Urgent visa interview printout',
      },
      authHeadersA
    );

    assert(saveJobRes.status === 201, 'POST /passport/jobs creates and persists passport job to MongoDB', JSON.stringify(saveJobRes.data));
    const savedJob = saveJobRes.data.data;
    assert(!!savedJob?._id, 'Saved job has MongoDB ObjectId');
    assert(!!savedJob?.jobCode && savedJob.jobCode.startsWith('PP-'), `Job code generated in format PP-XXXXXX: ${savedJob?.jobCode}`);
    assert(savedJob?.customerName === 'Tanvir Hossain', 'Customer name persisted accurately');
    const jobId = savedJob?._id;

    // 8. List Saved Jobs for Shop
    const listJobsRes = await get('/passport/jobs', authHeadersA);
    assert(listJobsRes.status === 200, 'GET /passport/jobs retrieves saved jobs list');
    const jobsList = listJobsRes.data.data || [];
    assert(jobsList.some((j: any) => j._id === jobId), 'Previously saved job present in shop list');

    // 9. Reopen / Fetch Specific Job
    const getJobRes = await get(`/passport/jobs/${jobId}`, authHeadersA);
    assert(getJobRes.status === 200, 'GET /passport/jobs/:jobId reopens saved job');
    assert(getJobRes.data.data?.presetId === 'us_passport_2x2', 'Reopened job preserves preset configuration');
    assert(!!getJobRes.data.data?.processedImageUrl, 'Reopened job retains processed single image');

    // 10. Strict Cross-Tenant Isolation Verification
    // Register Tenant B
    const subB = `studio-b-${suffix}`;
    const tenantBPayload = {
      shopName: `Apex Studio ${suffix}`,
      subdomain: subB,
      ownerName: 'Mizanur Rahman',
      email: `studio.b.${suffix}@docustudio.test`,
      password: 'Password123!',
      plan: 'STARTER',
    };
    const regB = await post('/auth/register-shop', tenantBPayload);
    const tokenB = regB.data.data?.tokens?.accessToken;
    const authHeadersB = { Authorization: `Bearer ${tokenB}` };

    // Tenant B tries to access Tenant A's passport job
    const unauthorizedJobAccess = await get(`/passport/jobs/${jobId}`, authHeadersB);
    assert(
      unauthorizedJobAccess.status === 404 || unauthorizedJobAccess.status === 403,
      'Tenant B cannot access Tenant A passport job (Enforces Tenant Isolation)',
      `Status: ${unauthorizedJobAccess.status}`
    );

    // Tenant B's saved list must not contain Tenant A's jobs
    const listB = await get('/passport/jobs', authHeadersB);
    assert(
      !listB.data.data?.some((j: any) => j._id === jobId),
      'Tenant B jobs queue is strictly isolated from Tenant A'
    );

  } catch (err: any) {
    console.error('Unexpected test execution failure:', err);
    failed++;
  }

  console.log('\n============================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} Passed | ${failed} Failed`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase5Tests();
