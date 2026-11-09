export {};

import sharp from 'sharp';

/**
 * Automated Verification Test Suite for Phase 6:
 * Document A4 Processing Module
 *
 * Tests:
 * 1. Shop Tenant registration and authentication
 * 2. Document page processing with Sharp:
 *    - MAGIC_COLOR (enhanced contrast & color scan)
 *    - BW_PHOTOCOPY (binary text thresholding)
 *    - GRAYSCALE (8-bit clean scan)
 *    - SHADOW_CLEAN (camera shadow reduction)
 *    - 90° rotation & 300 DPI metadata validation
 * 3. A4 Page Layout Composition:
 *    - A4 Portrait (2480 x 3508 px at 300 DPI)
 *    - Legal Landscape (4200 x 2550 px at 300 DPI)
 * 4. Multi-Page Vector PDF Generation (PDFKit)
 * 5. MongoDB Document Job persistence with multi-page details & queue synchronization
 * 6. Saved document jobs retrieval and search
 * 7. Reopening specific document job
 * 8. Strict Cross-Tenant isolation enforcement
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

// Create a simulated 800x1100 document image with text & stamp elements
async function createTestDocumentBase64(pageTitle: string = 'Test Page'): Promise<string> {
  const svg = `
    <svg width="800" height="1100" viewBox="0 0 800 1100" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="1100" fill="#F8FAFC" />
      <rect x="40" y="40" width="720" height="1020" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2" />
      <rect x="80" y="80" width="640" height="60" fill="#1E3A8A" />
      <text x="400" y="120" font-family="sans-serif" font-size="24" font-weight="bold" fill="#FFFFFF" text-anchor="middle">${pageTitle}</text>
      <rect x="80" y="180" width="400" height="16" fill="#334155" />
      <rect x="80" y="210" width="600" height="12" fill="#64748B" />
      <rect x="80" y="235" width="560" height="12" fill="#64748B" />
      <rect x="80" y="260" width="620" height="12" fill="#64748B" />
      <circle cx="600" cy="500" r="90" fill="none" stroke="#DC2626" stroke-width="4" />
      <text x="600" y="505" font-family="sans-serif" font-size="16" font-weight="bold" fill="#DC2626" text-anchor="middle">OFFICIAL SEAL</text>
    </svg>
  `;

  const buf = await sharp(Buffer.from(svg))
    .jpeg({ quality: 90 })
    .toBuffer();

  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

async function runPhase6Tests() {
  console.log('\n============================================================');
  console.log('🚀 DOCUSTUDIO SAAS - PHASE 6 DOCUMENT A4 PROCESSING VERIFICATION');
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
    const subA = `doc-shop-${suffix}`;
    const tenantPayloadA = {
      shopName: `Rapid Scan & Copy Lab ${suffix}`,
      subdomain: subA,
      ownerName: 'Nazmul Islam',
      email: `doc.shop.${suffix}@docustudio.test`,
      password: 'Password123!',
      plan: 'PROFESSIONAL',
    };

    const regA = await post('/auth/register-shop', tenantPayloadA);
    assert(regA.status === 201, 'Tenant A registration succeeds', JSON.stringify(regA.data));
    const tokenA = regA.data.data?.tokens?.accessToken;
    const authHeadersA = { Authorization: `Bearer ${tokenA}` };

    // 2. Test Document Page Processing: MAGIC_COLOR
    const testDocBase64 = await createTestDocumentBase64('Certificate of Merit - Page 1');
    const magicColorRes = await post(
      '/document/process-page',
      {
        imageBase64: testDocBase64,
        filterMode: 'MAGIC_COLOR',
        rotation: 0,
        brightness: 10,
        contrast: 15,
      },
      authHeadersA
    );

    assert(magicColorRes.status === 200, 'POST /document/process-page (MAGIC_COLOR) returns 200');
    assert(magicColorRes.data.data?.dpi === 300, 'Sharp processing preserves 300 DPI metadata');
    assert(!!magicColorRes.data.data?.base64, 'MAGIC_COLOR returns valid Base64 JPEG');
    const page1ProcessedBase64 = magicColorRes.data.data?.base64;

    // 3. Test Document Page Processing: BW_PHOTOCOPY (Text Thresholding)
    const bwRes = await post(
      '/document/process-page',
      {
        imageBase64: testDocBase64,
        filterMode: 'BW_PHOTOCOPY',
        threshold: 135,
        rotation: 90,
      },
      authHeadersA
    );

    assert(bwRes.status === 200, 'POST /document/process-page (BW_PHOTOCOPY) returns 200');
    assert(bwRes.data.data?.width === 1100 && bwRes.data.data?.height === 800, '90-degree rotation correctly swaps dimensions');
    assert(!!bwRes.data.data?.base64, 'BW_PHOTOCOPY returns thresholded binary Base64');

    // 4. Test Document Page Processing: GRAYSCALE & SHADOW_CLEAN
    const grayRes = await post(
      '/document/process-page',
      {
        imageBase64: testDocBase64,
        filterMode: 'GRAYSCALE',
      },
      authHeadersA
    );
    assert(grayRes.status === 200, 'POST /document/process-page (GRAYSCALE) returns 200');

    const shadowRes = await post(
      '/document/process-page',
      {
        imageBase64: testDocBase64,
        filterMode: 'SHADOW_CLEAN',
        brightness: 20,
        contrast: 25,
      },
      authHeadersA
    );
    assert(shadowRes.status === 200, 'POST /document/process-page (SHADOW_CLEAN) returns 200');

    // 5. Test A4 Sheet Composition (Portrait, Margin 5mm)
    const a4ComposeRes = await post(
      '/document/compose-a4',
      {
        imageBase64: page1ProcessedBase64,
        pageSize: 'A4',
        orientation: 'PORTRAIT',
        marginMm: 5,
        fitMode: 'FIT_PAGE',
      },
      authHeadersA
    );

    assert(a4ComposeRes.status === 200, 'POST /document/compose-a4 returns 200');
    assert(
      a4ComposeRes.data.data?.pageWidth === 2480 && a4ComposeRes.data.data?.pageHeight === 3508,
      'A4 Sheet generated at exact 300 DPI (2480 x 3508 px)'
    );
    assert(a4ComposeRes.data.data?.dpi === 300, 'A4 composition maintains 300 DPI density');
    const a4SheetBase64 = a4ComposeRes.data.data?.base64;

    // 6. Test Legal Sheet Composition (Landscape)
    const legalComposeRes = await post(
      '/document/compose-a4',
      {
        imageBase64: page1ProcessedBase64,
        pageSize: 'LEGAL',
        orientation: 'LANDSCAPE',
        marginMm: 10,
        fitMode: 'FIT_PAGE',
      },
      authHeadersA
    );

    assert(legalComposeRes.status === 200, 'POST /document/compose-a4 (Legal Landscape) returns 200');
    assert(
      legalComposeRes.data.data?.pageWidth === 4200 && legalComposeRes.data.data?.pageHeight === 2550,
      'Legal Landscape dimensions calculated accurately at 300 DPI (4200 x 2550 px)'
    );

    // 7. Multi-Page Vector PDF Export (3 pages)
    const page2DocBase64 = await createTestDocumentBase64('Bank Statement - Page 2');
    const page3DocBase64 = await createTestDocumentBase64('NID Card Copy - Page 3');

    const pdfRes = await fetch(`${BASE_URL}/document/export-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        pagesBase64: [page1ProcessedBase64, page2DocBase64, page3DocBase64],
        pageSize: 'A4',
        orientation: 'PORTRAIT',
        marginMm: 5,
        filename: 'client-scanned-package.pdf',
      }),
    });

    assert(pdfRes.status === 200, 'POST /document/export-pdf returns 200 OK');
    const pdfContentType = pdfRes.headers.get('content-type');
    assert(pdfContentType?.includes('application/pdf') === true, 'Response header Content-Type is application/pdf');
    const pdfBytes = await pdfRes.arrayBuffer();
    const pdfHeader = Buffer.from(pdfBytes.slice(0, 5)).toString();
    assert(pdfHeader === '%PDF-', 'Multi-page document PDF stream begins with %PDF-');

    // 8. Save Multi-Page Document Job to MongoDB
    const saveJobRes = await post(
      '/document/jobs',
      {
        customerName: 'Md. Al Amin',
        customerPhone: '+8801912345678',
        title: 'Land Deed & Registration Document',
        pages: [
          {
            pageNumber: 1,
            originalImageUrl: testDocBase64,
            processedImageUrl: page1ProcessedBase64,
            filterMode: 'MAGIC_COLOR',
            adjustments: { brightness: 10, contrast: 15, rotation: 0 },
          },
          {
            pageNumber: 2,
            originalImageUrl: page2DocBase64,
            processedImageUrl: page2DocBase64,
            filterMode: 'BW_PHOTOCOPY',
            adjustments: { brightness: 0, contrast: 10, rotation: 0, threshold: 128 },
          },
        ],
        pageSettings: {
          pageSize: 'A4',
          orientation: 'PORTRAIT',
          marginMm: 5,
          fitMode: 'FIT_PAGE',
        },
        copies: 2,
        totalAmount: 20, // 2 pages x 2 copies x 5 BDT
        notes: 'Urgent mutation application copy',
      },
      authHeadersA
    );

    assert(saveJobRes.status === 201, 'POST /document/jobs creates and persists document job to MongoDB');
    const savedJob = saveJobRes.data.data;
    assert(!!savedJob?._id, 'Document job assigned a MongoDB ObjectId');
    assert(!!savedJob?.jobCode && savedJob.jobCode.startsWith('DOC-'), `Job code generated with DOC- prefix: ${savedJob?.jobCode}`);
    assert(savedJob?.pages?.length === 2, '2 pages stored in document job record');
    assert(savedJob?.customerName === 'Md. Al Amin', 'Customer name persisted accurately');
    const jobId = savedJob?._id;

    // 9. List Saved Document Jobs
    const listJobsRes = await get('/document/jobs', authHeadersA);
    assert(listJobsRes.status === 200, 'GET /document/jobs retrieves saved jobs list');
    const jobsList = listJobsRes.data.data || [];
    assert(jobsList.some((j: any) => j._id === jobId), 'Saved job appears in shop document queue');

    // 10. Reopen Specific Document Job
    const getJobRes = await get(`/document/jobs/${jobId}`, authHeadersA);
    assert(getJobRes.status === 200, 'GET /document/jobs/:jobId reopens saved document job');
    assert(getJobRes.data.data?.title === 'Land Deed & Registration Document', 'Reopened job preserves document title');
    assert(getJobRes.data.data?.pages?.length === 2, 'Reopened job retains multi-page array');

    // 11. Cross-Tenant Isolation Enforcement
    // Register Tenant B
    const subB = `other-shop-${suffix}`;
    const tenantPayloadB = {
      shopName: `Elite Photocopy Center ${suffix}`,
      subdomain: subB,
      ownerName: 'Kazi Farhan',
      email: `other.shop.${suffix}@docustudio.test`,
      password: 'Password123!',
      plan: 'STARTER',
    };
    const regB = await post('/auth/register-shop', tenantPayloadB);
    const tokenB = regB.data.data?.tokens?.accessToken;
    const authHeadersB = { Authorization: `Bearer ${tokenB}` };

    // Tenant B attempts to fetch Tenant A's document job
    const unauthorizedJobAccess = await get(`/document/jobs/${jobId}`, authHeadersB);
    assert(
      unauthorizedJobAccess.status === 404 || unauthorizedJobAccess.status === 403,
      'Tenant B cannot access Tenant A document job (Enforces Tenant Isolation)',
      `Status: ${unauthorizedJobAccess.status}`
    );

    // Tenant B list does not contain Tenant A job
    const listB = await get('/document/jobs', authHeadersB);
    assert(
      !listB.data.data?.some((j: any) => j._id === jobId),
      'Tenant B document queue is strictly isolated from Tenant A'
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

runPhase6Tests();

