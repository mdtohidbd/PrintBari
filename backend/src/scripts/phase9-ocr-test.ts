export {};

/**
 * Automated Verification Test Suite for Phase 9:
 * Handwriting to Word and OCR System
 *
 * Tests:
 * 1. Shop Tenant registration and authentication
 * 2. Preprocessing pipeline (contrast enhancement, sharpening, binarization)
 * 3. Handwriting OCR text extraction (English handwriting)
 * 4. Handwriting OCR text extraction (Bangla handwriting)
 * 5. Confidence score metrics & block-level detection
 * 6. Microsoft Word (.docx) generation with headings, paragraphs, and bullet points
 * 7. Printable Vector PDF generation
 * 8. MongoDB OCR job persistence with customer history & OCR-XXXXXX code
 * 9. OCR job retrieval and reopening
 * 10. OCR job update (manual transcription correction)
 * 11. Cross-Tenant isolation enforcement
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

// Generate a synthetic test handwriting image using Sharp
import sharp from 'sharp';

async function createTestHandwritingImage(text: string): Promise<string> {
  const svg = `
    <svg width="800" height="400" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#fffdfa"/>
      <line x1="40" y1="100" x2="760" y2="100" stroke="#e2e8f0" stroke-width="1.5"/>
      <line x1="40" y1="180" x2="760" y2="180" stroke="#e2e8f0" stroke-width="1.5"/>
      <line x1="40" y1="260" x2="760" y2="260" stroke="#e2e8f0" stroke-width="1.5"/>
      <text x="60" y="90" font-family="cursive, sans-serif" font-size="26" fill="#1e293b">${text}</text>
      <text x="60" y="170" font-family="cursive, sans-serif" font-size="22" fill="#334155">Official Handwriting Sample for OCR Verification</text>
      <text x="60" y="250" font-family="cursive, sans-serif" font-size="20" fill="#475569">DocuStudio SaaS Multi-Tenant Engine</text>
    </svg>
  `;
  const buffer = await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}

async function runPhase9Tests() {
  console.log('\n============================================================');
  console.log('🚀 DOCUSTUDIO SAAS - PHASE 9 OCR & HANDWRITING SYSTEM VERIFICATION');
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
    const subA = `ocr-shop-${suffix}`;
    const regResA = await post('/auth/register-shop', {
      shopName: `OCR Digital Studio ${suffix}`,
      subdomain: subA,
      ownerName: `Tohidur Rahman ${suffix}`,
      email: `ocr-owner-${suffix}@docustudio.test`,
      password: 'SecurePassword123!',
      plan: 'PROFESSIONAL',
    });

    assert(regResA.status === 201, 'Tenant A registration succeeds', JSON.stringify(regResA.data));
    const tokenA = regResA.data.data?.tokens?.accessToken;
    const authHeadersA = { Authorization: `Bearer ${tokenA}` };

    // 2. Preprocessing Test
    const sampleImageBase64 = await createTestHandwritingImage('To Whom It May Concern');
    const preprocessRes = await post(
      '/ocr/preprocess',
      {
        imageBase64: sampleImageBase64,
        grayscale: true,
        contrast: 1.3,
        binarize: true,
        denoise: true,
      },
      authHeadersA
    );

    assert(preprocessRes.status === 200, 'POST /ocr/preprocess returns 200');
    assert(
      typeof preprocessRes.data?.data?.preprocessedBase64 === 'string' &&
        preprocessRes.data.data.preprocessedBase64.startsWith('data:image/png;base64,'),
      'Sharp preprocessing returns valid high-contrast base64 image'
    );

    // 3. OCR Extraction (English Handwriting)
    const ocrEngRes = await post(
      '/ocr/extract',
      {
        imageBase64: sampleImageBase64,
        language: 'eng',
        engine: 'simulation',
        contrast: 1.25,
        grayscale: true,
      },
      authHeadersA
    );

    assert(ocrEngRes.status === 200, 'POST /ocr/extract (English) returns 200');
    const ocrDataEng = ocrEngRes.data?.data;
    assert(
      typeof ocrDataEng?.rawExtractedText === 'string' && ocrDataEng.rawExtractedText.length > 20,
      'Raw English text extracted successfully'
    );
    assert(
      typeof ocrDataEng?.overallConfidence === 'number' && ocrDataEng.overallConfidence >= 80,
      `Calculated realistic confidence rating: ${ocrDataEng?.overallConfidence}%`
    );
    assert(
      Array.isArray(ocrDataEng?.textBlocks) && ocrDataEng.textBlocks.length > 0,
      `Detected ${ocrDataEng?.textBlocks?.length} distinct text blocks with bounding boxes`
    );

    // 4. OCR Extraction (Bangla Handwriting)
    const sampleBanglaImage = await createTestHandwritingImage('বরাবর, উপজেলা নির্বাহী অফিসার');
    const ocrBenRes = await post(
      '/ocr/extract',
      {
        imageBase64: sampleBanglaImage,
        language: 'ben',
        engine: 'simulation',
        contrast: 1.3,
        binarize: false,
      },
      authHeadersA
    );

    assert(ocrBenRes.status === 200, 'POST /ocr/extract (Bangla) returns 200');
    const ocrDataBen = ocrBenRes.data?.data;
    assert(
      ocrDataBen?.rawExtractedText.includes('বরাবর') || ocrDataBen?.rawExtractedText.includes('আবেদন'),
      'Bangla handwriting extracted accurately with localized terms'
    );

    // 5. DOCX Generation (.docx)
    const docxRes = await fetch(`${BASE_URL}/ocr/export-docx`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeadersA,
      },
      body: JSON.stringify({
        title: 'Official Transcribed Document',
        content: [
          { type: 'title', text: 'Official Transcribed Document', bold: true, alignment: 'center' },
          { type: 'heading2', text: 'Subject: Land Deed Transcription', bold: true, alignment: 'left' },
          {
            type: 'paragraph',
            text: 'This document certifies that the handwritten notes have been digitized and verified.',
            alignment: 'justify',
          },
          { type: 'bullet', text: 'First milestone completed with 95% confidence', alignment: 'left' },
          { type: 'bullet', text: 'All signatures verified by authorized notary', alignment: 'left' },
        ],
        filename: 'transcribed-test.docx',
      }),
    });

    assert(docxRes.status === 200, 'POST /ocr/export-docx returns 200 OK');
    const docxContentType = docxRes.headers.get('content-type');
    assert(
      docxContentType?.includes('wordprocessingml.document') || false,
      `DOCX response header is correct OpenXML type: ${docxContentType}`
    );
    const docxBuffer = Buffer.from(await docxRes.arrayBuffer());
    assert(
      docxBuffer.length > 2000 && docxBuffer.slice(0, 4).toString('utf-8') === 'PK\x03\x04',
      'DOCX binary starts with valid ZIP magic bytes (PK\\x03\\x04)'
    );

    // 6. Vector PDF Generation
    const pdfRes = await fetch(`${BASE_URL}/ocr/export-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeadersA,
      },
      body: JSON.stringify({
        title: 'Transcribed Document PDF',
        content: [
          { type: 'title', text: 'Transcribed Document PDF', bold: true, alignment: 'center' },
          { type: 'paragraph', text: 'Processed text ready for direct high-resolution print.', alignment: 'left' },
        ],
      }),
    });

    assert(pdfRes.status === 200, 'POST /ocr/export-pdf returns 200 OK');
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    assert(
      pdfBuffer.slice(0, 5).toString('utf-8') === '%PDF-',
      'PDF stream begins with standard %PDF- magic bytes'
    );

    // 7. Save OCR Job to MongoDB
    const saveJobRes = await post(
      '/ocr/jobs',
      {
        customerName: 'Kazi Nazrul Islam',
        customerPhone: '01712345678',
        language: 'ben',
        engine: 'simulation',
        originalImage: sampleBanglaImage,
        preprocessedImage: preprocessRes.data.data.preprocessedBase64,
        overallConfidence: ocrDataBen.overallConfidence,
        textBlocks: ocrDataBen.textBlocks,
        rawExtractedText: ocrDataBen.rawExtractedText,
        editedText: ocrDataBen.rawExtractedText + '\n\n[Manually Verified by Operator]',
        notes: 'Handwriting transcription for official submission',
      },
      authHeadersA
    );

    assert(saveJobRes.status === 201, 'POST /ocr/jobs creates and persists OCR job');
    const savedJob = saveJobRes.data?.data;
    assert(Boolean(savedJob?._id), 'OCR job assigned a valid MongoDB ObjectId');
    assert(
      typeof savedJob?.jobCode === 'string' && savedJob.jobCode.startsWith('OCR-'),
      `Job code generated with OCR- prefix: ${savedJob?.jobCode}`
    );
    assert(savedJob?.customerName === 'Kazi Nazrul Islam', 'Customer name persisted accurately');

    // 8. List OCR Jobs
    const listRes = await get('/ocr/jobs', authHeadersA);
    assert(listRes.status === 200, 'GET /ocr/jobs returns 200');
    const jobs = listRes.data?.data?.jobs;
    assert(Array.isArray(jobs) && jobs.length > 0, 'Saved OCR job is present in shop job history');

    // 9. Reopen OCR Job by ID
    const getJobRes = await get(`/ocr/jobs/${savedJob._id}`, authHeadersA);
    assert(getJobRes.status === 200, 'GET /ocr/jobs/:jobId reopens saved OCR job');
    assert(
      getJobRes.data?.data?.jobCode === savedJob.jobCode,
      'Reopened job matches original job code'
    );
    assert(
      getJobRes.data?.data?.editedText.includes('[Manually Verified by Operator]'),
      'Reopened job preserves manual corrections'
    );

    // 10. Update OCR Job
    const updateRes = await put(
      `/ocr/jobs/${savedJob._id}`,
      {
        editedText: 'Updated transcription after customer proofreading.',
        status: 'COMPLETED',
      },
      authHeadersA
    );
    assert(updateRes.status === 200, 'PUT /ocr/jobs/:jobId updates job record');
    assert(updateRes.data?.data?.status === 'COMPLETED', 'Job status updated to COMPLETED');

    // 11. Multi-Tenant Cross-Access Isolation
    const subB = `competitor-${suffix}`;
    const regResB = await post('/auth/register-shop', {
      shopName: `Competitor Studio ${suffix}`,
      subdomain: subB,
      ownerName: `Other Owner ${suffix}`,
      email: `other-${suffix}@docustudio.test`,
      password: 'SecurePassword123!',
      plan: 'STARTER',
    });
    const tokenB = regResB.data.data?.tokens?.accessToken;
    const authHeadersB = { Authorization: `Bearer ${tokenB}` };

    const crossAccessRes = await get(`/ocr/jobs/${savedJob._id}`, authHeadersB);
    assert(
      crossAccessRes.status === 404,
      'Tenant B cannot access Tenant A OCR job (Enforces Tenant Isolation)'
    );

    const listResB = await get('/ocr/jobs', authHeadersB);
    const jobsB = listResB.data?.data?.jobs;
    const leakFound = jobsB?.some((j: any) => j._id === savedJob._id);
    assert(!leakFound, 'Tenant B job history is strictly isolated from Tenant A');

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

runPhase9Tests();
