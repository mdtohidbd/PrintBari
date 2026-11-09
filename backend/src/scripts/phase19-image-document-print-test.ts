import sharp from 'sharp';
import mongoose from 'mongoose';
import { Database } from '../config/db';
import { User } from '../models/User.model';
import { Tenant } from '../models/Tenant.model';
import { validateImageBuffer, detectMimeType, computeBufferHash } from '../utils/fileValidator';
import { PrintLayoutEngine, PaperSize, PageOrientation } from '../utils/printLayout';
import { backgroundWorker } from '../services/backgroundWorker';
import { passportService } from '../modules/passport/passport.service';
import { documentService } from '../modules/document/document.service';
import { idCardService } from '../modules/idcard/idcard.service';
import { cvService } from '../modules/cv/cv.service';
import { ocrService } from '../modules/ocr/ocr.service';
import { printerService } from '../modules/printer/printer.service';

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

async function runPhase19Tests() {
  console.log('\n=================================================================================');
  console.log('--- STARTING PHASE 19: ADVANCED IMAGE PROCESSING, DOCUMENT ENGINE & PRINT QUALITY ---');
  console.log('=================================================================================\n');

  const suffix = Date.now().toString().slice(-5);

  // 1. Setup Tenant Authentication
  console.log('--- TEST 1: Register Shop & Authenticate ---');
  const ownerEmail = `imgpro_${suffix}@docustudio.test`;
  const regShopRes = await post('/auth/register-shop', {
    shopName: `Studio Pro Imaging ${suffix}`,
    subdomain: `studio-pro-${suffix}`,
    ownerName: 'Tanvir Ahmed',
    email: ownerEmail,
    password: 'SecurePassword123!',
    plan: 'PRO',
  });
  assert(regShopRes.status === 201, `Shop registered successfully (status ${regShopRes.status})`);
  const ownerToken = regShopRes.data.data?.tokens?.accessToken;
  const headers = { Authorization: `Bearer ${ownerToken}` };
  const tenantId = regShopRes.data.data?.tenant?._id || regShopRes.data.data?.tenant?.id;

  // 2. Processing Architecture & File Validation
  console.log('\n--- TEST 2: Processing Architecture, File Validation & Duplicate Prevention ---');
  // Generate sample 400x400 test image in memory
  const testSampleBuffer = await sharp({
    create: {
      width: 400,
      height: 400,
      channels: 3,
      background: { r: 240, g: 240, b: 240 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();

  const validRes = await validateImageBuffer(testSampleBuffer);
  assert(validRes.isValid === true, `Valid JPEG detected and verified`);
  assert(validRes.mimeType === 'image/jpeg', `MIME type detected as image/jpeg`);
  assert(validRes.width === 400 && validRes.height === 400, `Dimensions accurately read: 400x400 px`);

  // Corrupted / invalid file test
  let caughtInvalid = false;
  try {
    await validateImageBuffer(Buffer.from('not an image at all!'));
  } catch (err: any) {
    caughtInvalid = true;
  }
  assert(caughtInvalid, `Corrupted or invalid payload rejected by magic-bytes validator`);

  // Background Worker test
  const hash1 = computeBufferHash(testSampleBuffer, { action: 'test' });
  const taskResult = await backgroundWorker.executeTask(
    tenantId,
    'PASSPORT',
    hash1,
    async (updateProgress) => {
      updateProgress(50);
      return { result: { processed: true }, metadata: { inputBytes: testSampleBuffer.length } };
    }
  );
  assert(taskResult.status === 'COMPLETED', `Background worker executed task to COMPLETED`);
  assert(taskResult.progress === 100, `Task progress reached 100%`);

  // Duplicate task check
  const duplicateTask = backgroundWorker.createTask({
    tenantId,
    taskType: 'PASSPORT',
    inputHash: hash1,
  });
  assert(duplicateTask.isDuplicate === true, `Duplicate processing detected and prevented via hash`);

  // 3. Passport Photo Module
  console.log('\n--- TEST 3: Advanced Passport Photo Engine ---');
  // A. Configurable custom dimensions (e.g. 33 x 48 mm)
  const passportCustom = await passportService.processSinglePhoto(testSampleBuffer, {
    customDimensions: { widthMm: 33, heightMm: 48 },
    dpi: 300,
    backgroundColor: '#FFFFFF',
  });
  // 33mm at 300 DPI = round(33 * 300 / 25.4) = 390 px; 48mm = round(48 * 300 / 25.4) = 567 px
  assert(passportCustom.widthPx === 390, `Custom width 33mm at 300 DPI calculated: 390px`);
  assert(passportCustom.heightPx === 567, `Custom height 48mm at 300 DPI calculated: 567px`);

  // B. Resolution control: 150 vs 300 vs 600 DPI
  const passport150 = await passportService.processSinglePhoto(testSampleBuffer, {
    presetId: 'uk_eu_35x45',
    dpi: 150,
  });
  const passport300 = await passportService.processSinglePhoto(testSampleBuffer, {
    presetId: 'uk_eu_35x45',
    dpi: 300,
  });
  const passport600 = await passportService.processSinglePhoto(testSampleBuffer, {
    presetId: 'uk_eu_35x45',
    dpi: 600,
  });
  // 35x45 mm: 150 DPI = 207x266, 300 DPI = 413x531, 600 DPI = 827x1063
  assert(passport150.widthPx === 207 && passport150.dpi === 150, `150 DPI resolution control: 207px width`);
  assert(passport300.widthPx === 413 && passport300.dpi === 300, `300 DPI resolution control: 413px width`);
  assert(passport600.widthPx === 827 && passport600.dpi === 600, `600 DPI resolution control: 827px width`);

  // C. Background replacement (e.g. #0284C7 Sky Blue)
  const passportBlueBg = await passportService.processSinglePhoto(testSampleBuffer, {
    presetId: 'bd_passport_40x50',
    backgroundColor: '#0284C7',
    dpi: 300,
  });
  assert(passportBlueBg.buffer.length > 1000, `Photo with background replacement generated (${passportBlueBg.buffer.length} bytes)`);

  // D. Export quality settings: PNG lossless
  const passportPng = await passportService.processSinglePhoto(testSampleBuffer, {
    presetId: 'us_passport_2x2',
    exportFormat: 'png',
  });
  assert(passportPng.exportFormat === 'png', `Export format PNG lossless supported`);
  assert(passportPng.buffer[0] === 0x89 && passportPng.buffer[1] === 0x50, `PNG magic bytes confirmed`);

  // E. Arranged Print Sheet Composition (A4 with 8 copies and cut marks)
  const passportSheetA4 = await passportService.composePrintSheet(passport300.buffer, {
    sheetLayout: 'A4',
    copies: 8,
    dpi: 300,
  });
  assert(passportSheetA4.sheetLayout === 'A4', `Print sheet generated for A4 format`);
  assert(passportSheetA4.copiesPlaced === 8, `Exact requested copies placed on sheet: 8`);
  assert(passportSheetA4.sheetWidth === 2480 && passportSheetA4.sheetHeight === 3508, `A4 300 DPI pixel dimensions: 2480x3508 px`);

  // F. Vector PDF Print Sheet wrapper
  const sheetPdf = await passportService.generateSheetPdf(passportSheetA4.buffer, 'A4');
  assert(sheetPdf.length > 5000 && sheetPdf.slice(0, 4).toString() === '%PDF', `Vector PDF print wrapper generated with valid %PDF header`);

  // 4. Document A4 Module
  console.log('\n--- TEST 4: Document Engine (Deskew, Perspective, Filters & Multi-Page PDF) ---');
  // A. Crop & Deskew
  const docDeskew = await documentService.processPage(testSampleBuffer, {
    deskewAngle: 2.5,
    cropBounds: { x: 10, y: 10, width: 350, height: 350 },
  });
  assert(docDeskew.width === 350 && docDeskew.height === 350, `Document crop applied: 350x350 px`);

  // B. Perspective correction / quadrilateral unwarping
  const docPerspective = await documentService.processPage(testSampleBuffer, {
    perspectiveBounds: {
      topLeft: { x: 20, y: 20 },
      topRight: { x: 380, y: 25 },
      bottomRight: { x: 375, y: 380 },
      bottomLeft: { x: 25, y: 370 },
    },
  });
  assert(docPerspective.width > 300 && docPerspective.height > 300, `Perspective 4-corner rectification completed`);

  // C. Document Filter modes: MAGIC_COLOR, GRAYSCALE, BW_PHOTOCOPY, SHADOW_CLEAN, CONTRAST_ENHANCE
  const filters: Array<'MAGIC_COLOR' | 'GRAYSCALE' | 'BW_PHOTOCOPY' | 'SHADOW_CLEAN' | 'CONTRAST_ENHANCE'> = [
    'MAGIC_COLOR',
    'GRAYSCALE',
    'BW_PHOTOCOPY',
    'SHADOW_CLEAN',
    'CONTRAST_ENHANCE',
  ];

  for (const f of filters) {
    const res = await documentService.processPage(testSampleBuffer, { filterMode: f });
    assert(res.filterApplied === f, `Document filter ${f} processed successfully`);
  }

  // D. Multi-Page PDF generation with A4, Legal, Letter settings
  const multiPagePdf = await documentService.generateMultiPagePdf(
    [testSampleBuffer, testSampleBuffer],
    {
      pageSize: 'A4',
      orientation: 'PORTRAIT',
      marginMm: 10,
    }
  );
  assert(multiPagePdf.length > 3000 && multiPagePdf.slice(0, 4).toString() === '%PDF', `Multi-page vector PDF generated (${multiPagePdf.length} bytes)`);

  // 5. ID Card Module
  console.log('\n--- TEST 5: ID Card Engine (Front/Back, Duplex Alignment & Multiple Sets) ---');
  const frontCard = await idCardService.processCardSide(testSampleBuffer, {
    filterMode: 'MAGIC_COLOR',
    widthMm: 85.6,
    heightMm: 54,
  });
  assert(frontCard.width === 1011 && frontCard.height === 638, `CR-80 Smart NID 300 DPI dimensions: 1011x638 px`);

  const backCard = await idCardService.processCardSide(testSampleBuffer, {
    filterMode: 'BW_PHOTOCOPY',
    widthMm: 85.6,
    heightMm: 54,
  });
  assert(backCard.width === 1011 && backCard.height === 638, `Back side processed at 1011x638 px`);

  // Dual card sheet side-by-side with cut guides
  const dualCardSheet = await idCardService.composeIdCardA4Sheet(frontCard.buffer, backCard.buffer, {
    arrangement: 'SIDE_BY_SIDE',
    copies: 2,
    showCutMarks: true,
  });
  assert(dualCardSheet.sheetWidth === 2480 && dualCardSheet.sheetHeight === 3508, `A4 dual card sheet generated`);
  assert(dualCardSheet.copies === 2, `Placed 2 card pairs with cut guidelines`);

  // Vector PDF for ID Card
  const idCardPdf = await idCardService.generateIdCardPdf(dualCardSheet.buffer);
  assert(idCardPdf.length > 5000 && idCardPdf.slice(0, 4).toString() === '%PDF', `Print-ready ID Card PDF generated`);

  // 6. CV and OCR Modules
  console.log('\n--- TEST 6: CV Engine (PDF Vector, DOCX Word Export & Bangla Typography) ---');
  const sampleCvData = {
    personalInfo: {
      fullName: 'কামরুল হাসান (Kamrul Hasan)',
      jobTitle: 'Senior Software Architect',
      email: 'kamrul.hasan@example.com',
      phone: '+880 1712-345678',
      address: 'ধানমন্ডি, ঢাকা-১২০৫, বাংলাদেশ',
      dateOfBirth: '1992-05-14',
      nationality: 'Bangladeshi',
    },
    objective: 'To design scalable cloud solutions and lead high-performing engineering teams.',
    experience: [
      {
        title: 'Lead Full-Stack Engineer',
        company: 'Cloud Innovations Ltd',
        startDate: '2020',
        current: true,
        description: 'Architected SaaS printing engine and distributed job queues.',
      },
    ],
    education: [
      {
        degree: 'B.Sc. in Computer Science',
        institution: 'Dhaka University',
        passingYear: '2014',
        result: '3.85 / 4.00',
      },
    ],
    skills: ['Node.js', 'TypeScript', 'MongoDB', 'React', 'Docker'],
  };

  // A. Generate CV Vector PDF with Bangla + English text
  const cvPdfBuffer = await cvService.generateCvPdf(sampleCvData as any, 'modern', {
    primaryColor: '#0F766E',
  });
  assert(cvPdfBuffer.length > 5000 && cvPdfBuffer.slice(0, 4).toString() === '%PDF', `CV Vector PDF generated with bilingual text (${cvPdfBuffer.length} bytes)`);

  // B. Generate CV Microsoft Word (.docx) document via API
  const cvDocxRes = await post(
    '/cv/export-docx',
    {
      cvData: sampleCvData,
      templateId: 'modern',
      theme: { primaryColor: '#1E3A8A' },
      filename: 'kamrul-hasan-cv.docx',
    },
    headers
  );
  assert(cvDocxRes.status === 200, `POST /cv/export-docx returns HTTP 200`);

  // Direct DOCX buffer verification
  const directDocx = await cvService.generateCvDocx(sampleCvData as any, 'modern');
  assert(directDocx.length > 3000, `DOCX buffer generated (${directDocx.length} bytes)`);
  assert(directDocx[0] === 0x50 && directDocx[1] === 0x4b, `DOCX has valid OpenXML PK zip header`);

  // 7. OCR Correction Workflow & Bilingual Support
  console.log('\n--- TEST 7: OCR Correction Workflow & Verified Text Editing ---');
  // Save an initial OCR job
  const ocrSaveRes = await post(
    '/ocr/jobs',
    {
      customerName: 'Monir Hossain',
      customerPhone: '01911223344',
      language: 'ben',
      engine: 'simulation',
      originalImage: 'data:image/jpeg;base64,' + testSampleBuffer.toString('base64'),
      overallConfidence: 89,
      textBlocks: [{ id: 'blk-1', text: 'জরুরি দরখাস্ত', confidence: 89 }],
      rawExtractedText: 'জরুরি দরখাস্ত (Raw Transcription)',
      editedText: 'জরুরি দরখাস্ত (Initial)',
    },
    headers
  );
  assert(ocrSaveRes.status === 201, `Initial OCR job created (HTTP 201)`);
  const ocrJobId = ocrSaveRes.data.data?._id;

  // Execute OCR correction workflow
  const correctionRes = await put(
    `/ocr/jobs/${ocrJobId}/correction`,
    {
      editedText: 'বরাবর,\nজেলা প্রশাসক মহোদয়, ঢাকা।\n\nবিষয়: এলাকার ড্রেনেজ ব্যবস্থা সংস্কারের আবেদন।',
      notes: 'Operator verified against handwritten physical document',
    },
    headers
  );
  assert(correctionRes.status === 200, `PUT /ocr/jobs/:jobId/correction returns HTTP 200`);
  assert(correctionRes.data.data?.overallConfidence === 100, `Operator correction verified confidence to 100%`);
  assert(correctionRes.data.data?.editedText.includes('জেলা প্রশাসক'), `Edited text correctly updated`);

  // Export OCR to PDF with Bengali text
  const ocrPdfBuffer = await ocrService.generatePdf(
    'সংশোধিত আবেদনপত্র',
    correctionRes.data.data?.editedText
  );
  assert(ocrPdfBuffer.length > 3000 && ocrPdfBuffer.slice(0, 4).toString() === '%PDF', `OCR transcribed PDF generated with Bengali text (${ocrPdfBuffer.length} bytes)`);

  // 8. Print Quality Calibration Engine
  console.log('\n--- TEST 8: Print Quality Calibration & Dimension Verification ---');
  // Check paper dimensions calculations
  const a4Dim = PrintLayoutEngine.getDimensionsMm({ paperSize: 'A4', orientation: 'PORTRAIT' });
  assert(a4Dim.widthMm === 210 && a4Dim.heightMm === 297, `A4 Portrait dimensions: 210 x 297 mm`);

  const fourRDim = PrintLayoutEngine.getDimensionsMm({ paperSize: '4R', orientation: 'LANDSCAPE' });
  assert(fourRDim.widthMm === 152.4 && fourRDim.heightMm === 101.6, `4R Photo Landscape dimensions: 152.4 x 101.6 mm`);

  const legalDim = PrintLayoutEngine.getDimensionsMm({ paperSize: 'LEGAL', orientation: 'PORTRAIT' });
  assert(legalDim.widthMm === 215.9 && legalDim.heightMm === 355.6, `Legal Portrait dimensions: 215.9 x 355.6 mm`);

  // Pixel layout at 300 DPI
  const pixelLayout300 = PrintLayoutEngine.calculatePixelLayout({
    paperSize: 'A4',
    orientation: 'PORTRAIT',
    marginsMm: { top: 10, bottom: 10, left: 10, right: 10 },
    dpi: 300,
    scaling: 'FIT_PAGE',
    colorMode: 'RGB',
    copies: 1,
  });
  assert(pixelLayout300.sheetWidthPx === 2480 && pixelLayout300.sheetHeightPx === 3508, `A4 300 DPI exact pixels: 2480x3508 px`);
  assert(pixelLayout300.printableWidthPx === 2244 && pixelLayout300.printableHeightPx === 3272, `A4 300 DPI 10mm margin printable area: 2244x3272 px`);

  // PDF layout in 72 DPI points
  const pdfLayout = PrintLayoutEngine.calculatePdfLayout({
    paperSize: 'A4',
    orientation: 'PORTRAIT',
    marginsMm: { top: 12.7, bottom: 12.7, left: 12.7, right: 12.7 }, // 0.5 inch margins = 36 pt
    dpi: 300,
    scaling: 'FIT_PAGE',
    colorMode: 'RGB',
    copies: 1,
  });
  // 210mm -> 595.28 pt, 297mm -> 841.89 pt, 12.7mm -> 36 pt
  assert(Math.round(pdfLayout.widthPt) === 595 && Math.round(pdfLayout.heightPt) === 842, `A4 PDF vector size: 595 x 842 pt`);
  assert(Math.round(pdfLayout.marginLeftPt) === 36, `0.5 inch margins exact: 36 pt`);

  console.log('\n=================================================================================');
  console.log(`--- TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED ---`);
  console.log('=================================================================================\n');

  await mongoose.disconnect();

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase19Tests().catch(async (err) => {
  console.error('Fatal error running Phase 19 tests:', err);
  await mongoose.disconnect();
  process.exit(1);
});
