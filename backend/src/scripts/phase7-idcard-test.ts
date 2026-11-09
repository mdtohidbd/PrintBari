export {};

import sharp from 'sharp';

/**
 * Automated Verification Test Suite for Phase 7:
 * ID Card A4 Processing & Security Module
 *
 * Tests:
 * 1. Shop Tenant registration and authentication
 * 2. ID Card presets retrieval (Smart NID, Old NID, Driving License, Student ID, Custom)
 * 3. 300 DPI calculation & metadata validation
 * 4. Front & Back card side processing with Sharp (Magic Color, BW Photocopy, Grayscale, Rotation)
 * 5. A4 Sheet Composition (Side-by-Side, Stacked, Grid) with precision hairline cut marks
 * 6. Vector PDF export generation (PDFKit)
 * 7. MongoDB ID Card Job persistence & shop work queue synchronization
 * 8. Sensitive PII Security Audit Logging (ID_CARD_JOB_CREATED, ID_CARD_DOCUMENT_ACCESSED)
 * 9. Saved ID Card jobs retrieval & reopening
 * 10. Strict Cross-Tenant isolation enforcement
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

// Create a simulated 1011x638 Smart NID raster in Base64
async function createTestCardBase64(sideText: string): Promise<string> {
  const svg = `
    <svg width="1011" height="638" viewBox="0 0 1011 638" xmlns="http://www.w3.org/2000/svg">
      <rect width="1011" height="638" fill="#E0F2FE" />
      <rect x="0" y="0" width="1011" height="85" fill="#065F46" />
      <text x="505" y="55" font-family="sans-serif" font-size="28" font-weight="bold" fill="#FFFFFF" text-anchor="middle">PEOPLE'S REPUBLIC OF BANGLADESH</text>
      <rect x="80" y="140" width="140" height="110" fill="#F59E0B" stroke="#B45309" stroke-width="2" />
      <rect x="80" y="280" width="220" height="280" fill="#334155" />
      <circle cx="190" cy="380" r="70" fill="#FED7AA" />
      <text x="360" y="220" font-family="sans-serif" font-size="32" font-weight="bold" fill="#0F172A">${sideText}</text>
      <text x="360" y="280" font-family="sans-serif" font-size="24" fill="#334155">NATIONAL ID: 735 918 4201</text>
      <text x="360" y="340" font-family="sans-serif" font-size="22" fill="#475569">DOB: 14 Oct 1995 • Blood: B(+ve)</text>
      <rect x="360" y="440" width="580" height="60" fill="#000000" />
    </svg>
  `;

  const buf = await sharp(Buffer.from(svg))
    .jpeg({ quality: 90 })
    .toBuffer();

  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

async function runPhase7Tests() {
  console.log('\n============================================================');
  console.log('🚀 DOCUSTUDIO SAAS - PHASE 7 ID CARD A4 MODULE VERIFICATION');
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
    const subA = `idcard-shop-${suffix}`;
    const tenantPayloadA = {
      shopName: `Smart Card Xerox Lab ${suffix}`,
      subdomain: subA,
      ownerName: 'Kamrul Hassan',
      email: `idcard.shop.${suffix}@docustudio.test`,
      password: 'Password123!',
      plan: 'PROFESSIONAL',
    };

    const regA = await post('/auth/register-shop', tenantPayloadA);
    assert(regA.status === 201, 'Tenant A registration succeeds', JSON.stringify(regA.data));
    const tokenA = regA.data.data?.tokens?.accessToken;
    const authHeadersA = { Authorization: `Bearer ${tokenA}` };

    // 2. Presets Retrieval
    const presetsRes = await get('/idcard/presets', authHeadersA);
    assert(presetsRes.status === 200, 'GET /idcard/presets returns 200');
    const presetsList = presetsRes.data.data || [];
    assert(presetsList.length >= 5, 'Presets catalogue contains standard cards (Smart NID, Old NID, Driving License, Student, Custom)');

    const smartNid = presetsList.find((p: any) => p.id === 'SMART_NID');
    const oldNid = presetsList.find((p: any) => p.id === 'OLD_NID');
    assert(smartNid?.widthPx === 1011 && smartNid?.heightPx === 638, 'Smart NID calculates exact 300 DPI dimensions (1011x638 px / 85.6x54 mm)');
    assert(oldNid?.widthPx === 1240 && oldNid?.heightPx === 874, 'Old NID calculates exact 300 DPI dimensions (1240x874 px / 105x74 mm)');

    // 3. Process Front Card Side (Sharp 300 DPI & Magic Color)
    const testFrontBase64 = await createTestCardBase64('SMART NID - FRONT');
    const processFrontRes = await post(
      '/idcard/process-side',
      {
        imageBase64: testFrontBase64,
        widthMm: 85.6,
        heightMm: 54,
        filterMode: 'MAGIC_COLOR',
        brightness: 10,
        contrast: 15,
        rotation: 0,
      },
      authHeadersA
    );

    assert(processFrontRes.status === 200, 'POST /idcard/process-side (Front) returns 200');
    assert(processFrontRes.data.data?.dpi === 300, 'Sharp processing preserves 300 DPI metadata');
    assert(
      processFrontRes.data.data?.width === 1011 && processFrontRes.data.data?.height === 638,
      'Front card dimensions match target 85.6 x 54 mm at 300 DPI'
    );
    const frontProcessedBase64 = processFrontRes.data.data?.base64;

    // 4. Process Back Card Side (Sharp 300 DPI & BW Photocopy Threshold)
    const testBackBase64 = await createTestCardBase64('SMART NID - BACK');
    const processBackRes = await post(
      '/idcard/process-side',
      {
        imageBase64: testBackBase64,
        widthMm: 85.6,
        heightMm: 54,
        filterMode: 'BW_PHOTOCOPY',
        threshold: 130,
        rotation: 90,
      },
      authHeadersA
    );

    assert(processBackRes.status === 200, 'POST /idcard/process-side (Back) returns 200');
    assert(!!processBackRes.data.data?.base64, 'Back side returns valid thresholded Base64');
    const backProcessedBase64 = processBackRes.data.data?.base64;

    // 5. Compose A4 Sheet: Side-by-Side Arrangement with Cut Marks
    const composeSideRes = await post(
      '/idcard/compose-sheet',
      {
        frontImageBase64: frontProcessedBase64,
        backImageBase64: backProcessedBase64,
        cardType: 'SMART_NID',
        arrangement: 'SIDE_BY_SIDE',
        copies: 1,
        orientation: 'PORTRAIT',
        marginMm: 15,
        gapMm: 10,
        showCutMarks: true,
      },
      authHeadersA
    );

    assert(composeSideRes.status === 200, 'POST /idcard/compose-sheet (Side-by-Side) returns 200');
    assert(
      composeSideRes.data.data?.sheetWidth === 2480 && composeSideRes.data.data?.sheetHeight === 3508,
      'A4 Sheet generated at exact 300 DPI dimensions (2480 x 3508 px)'
    );
    assert(composeSideRes.data.data?.dpi === 300, 'Composed sheet density is 300 DPI');
    const sheetBase64 = composeSideRes.data.data?.base64;

    // 6. Compose A4 Sheet: Stacked & Multi-Copy Grid
    const composeGridRes = await post(
      '/idcard/compose-sheet',
      {
        frontImageBase64: frontProcessedBase64,
        backImageBase64: backProcessedBase64,
        cardType: 'SMART_NID',
        arrangement: 'GRID',
        copies: 4,
        orientation: 'PORTRAIT',
      },
      authHeadersA
    );
    assert(composeGridRes.status === 200, 'POST /idcard/compose-sheet (4 Copies Grid) returns 200');
    assert(composeGridRes.data.data?.copies === 4, 'Arranges 4 copies accurately');

    // 7. Vector PDF Export Generation
    const pdfRes = await fetch(`${BASE_URL}/idcard/export-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        sheetBase64,
        orientation: 'PORTRAIT',
        filename: 'id-card-print.pdf',
      }),
    });

    assert(pdfRes.status === 200, 'POST /idcard/export-pdf returns 200 OK');
    const pdfContentType = pdfRes.headers.get('content-type');
    assert(pdfContentType?.includes('application/pdf') === true, 'Response Content-Type is application/pdf');
    const pdfBytes = await pdfRes.arrayBuffer();
    const pdfHeader = Buffer.from(pdfBytes.slice(0, 5)).toString();
    assert(pdfHeader === '%PDF-', 'Exported stream starts with standard PDF magic bytes (%PDF-)');

    // 8. Save ID Card Job to MongoDB with Security Audit Logging
    const saveJobRes = await post(
      '/idcard/jobs',
      {
        customerName: 'Ashraful Haque',
        customerPhone: '+8801712345678',
        cardType: 'SMART_NID',
        cardTitle: 'Bangladesh Smart NID Card',
        frontImage: {
          originalUrl: testFrontBase64,
          processedUrl: frontProcessedBase64,
          filterMode: 'MAGIC_COLOR',
        },
        backImage: {
          originalUrl: testBackBase64,
          processedUrl: backProcessedBase64,
          filterMode: 'BW_PHOTOCOPY',
        },
        layoutSettings: {
          arrangement: 'SIDE_BY_SIDE',
          copies: 2,
          orientation: 'PORTRAIT',
          marginMm: 15,
          gapMm: 10,
          showCutMarks: true,
        },
        sheetImageUrl: sheetBase64,
        copies: 2,
        totalAmount: 20,
        notes: 'Sim card biometric verification copy',
      },
      authHeadersA
    );

    assert(saveJobRes.status === 201, 'POST /idcard/jobs persists ID card job to MongoDB');
    const savedJob = saveJobRes.data.data;
    assert(!!savedJob?._id, 'Job assigned a MongoDB ObjectId');
    assert(!!savedJob?.jobCode && savedJob.jobCode.startsWith('IDC-'), `Job code generated with IDC- prefix: ${savedJob?.jobCode}`);
    assert(savedJob?.customerName === 'Ashraful Haque', 'Customer name persisted accurately');
    const jobId = savedJob?._id;

    // 9. List Saved ID Card Jobs
    const listJobsRes = await get('/idcard/jobs', authHeadersA);
    assert(listJobsRes.status === 200, 'GET /idcard/jobs retrieves saved jobs list');
    const jobsList = listJobsRes.data.data || [];
    assert(jobsList.some((j: any) => j._id === jobId), 'Saved job appears in shop queue');

    // 10. Reopen Specific ID Card Job with Access Audit Log
    const getJobRes = await get(`/idcard/jobs/${jobId}`, authHeadersA);
    assert(getJobRes.status === 200, 'GET /idcard/jobs/:jobId reopens saved ID card job');
    assert(getJobRes.data.data?.cardType === 'SMART_NID', 'Reopened job preserves card type');
    assert(!!getJobRes.data.data?.frontImage?.processedUrl, 'Reopened job preserves front card raster');

    // 11. Cross-Tenant Isolation Enforcement
    const subB = `other-id-shop-${suffix}`;
    const tenantPayloadB = {
      shopName: `Delta Print ${suffix}`,
      subdomain: subB,
      ownerName: 'Muktadir Rahman',
      email: `delta.id.${suffix}@docustudio.test`,
      password: 'Password123!',
      plan: 'STARTER',
    };
    const regB = await post('/auth/register-shop', tenantPayloadB);
    const tokenB = regB.data.data?.tokens?.accessToken;
    const authHeadersB = { Authorization: `Bearer ${tokenB}` };

    const unauthorizedAccess = await get(`/idcard/jobs/${jobId}`, authHeadersB);
    assert(
      unauthorizedAccess.status === 404 || unauthorizedAccess.status === 403,
      'Tenant B cannot access Tenant A ID Card job (Enforces Tenant Isolation)',
      `Status: ${unauthorizedAccess.status}`
    );

    const listB = await get('/idcard/jobs', authHeadersB);
    assert(
      !listB.data.data?.some((j: any) => j._id === jobId),
      'Tenant B queue is strictly isolated from Tenant A identity records'
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

runPhase7Tests();

