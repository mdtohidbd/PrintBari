export {};

/**
 * Automated Verification Test Suite for Phase 11:
 * Print Queue and Print Management System
 *
 * Tests:
 * 1. Shop Tenant registration and authentication
 * 2. Hardware Printers auto-provisioning & catalogue retrieval
 * 3. Enqueue jobs into print spooler queue (PRN-XXXXXX generation)
 * 4. Queue priority reordering (Move Up / Down)
 * 5. Update print parameters (copies, paper size, orientation, quality, printer)
 * 6. Accidental duplicate print protection (blocks unintended duplicates within window)
 * 7. Allow explicit duplicate reprint when confirmed by operator
 * 8. Print execution lifecycle (QUEUED -> PRINTING -> COMPLETED)
 * 9. Queue job cancellation & removal
 * 10. Print history archive & audit log tracking
 * 11. Downloadable print-ready vector PDF generation
 * 12. Cross-Tenant isolation enforcement
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

async function runPhase11Tests() {
  console.log('\n============================================================');
  console.log('🚀 DOCUSTUDIO SAAS - PHASE 11 PRINT QUEUE & HARDWARE SPOOLER VERIFICATION');
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
    const subA = `print-shop-${suffix}`;
    const regResA = await post('/auth/register-shop', {
      shopName: `DocuStudio Print & Copy Lab ${suffix}`,
      subdomain: subA,
      ownerName: `Shorif Hossain ${suffix}`,
      email: `shorif.${suffix}@docustudio.test`,
      password: 'SecurePassword123!',
      plan: 'PROFESSIONAL',
    });

    assert(regResA.status === 201, 'Tenant A registration succeeds');
    const tokenA = regResA.data.data?.tokens?.accessToken;
    const authHeadersA = { Authorization: `Bearer ${tokenA}` };

    // 2. Hardware Printers Discovery
    const printersRes = await get('/printers', authHeadersA);
    assert(printersRes.status === 200, 'GET /printers returns 200');
    const printersList = printersRes.data?.data;
    assert(
      Array.isArray(printersList) && printersList.length >= 3,
      'Auto-provisions standard studio printers (Epson Photo, Canon Color, HP LaserJet)'
    );

    const epsonPhoto = printersList.find((p: any) => p.type === 'PHOTO');
    assert(Boolean(epsonPhoto), 'Found Photo printer (Epson L805 EcoTank)');
    assert(epsonPhoto?.currentInkLevels?.black > 0, 'Printer reports real hardware ink levels');

    // 3. Print Spool Queue Operations
    // 3.1 Enqueue Job 1
    const testDocBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const enqueue1 = await post(
      '/printers/queue',
      {
        jobCode: `JOB-PP-${suffix}`,
        customerName: 'Ashraful Islam',
        customerPhone: '01722334455',
        printerId: epsonPhoto._id,
        serviceType: 'PASSPORT_PHOTO',
        documentUrl: testDocBase64,
        documentTitle: 'Passport Photo 4x6 Sheet',
        settings: {
          copies: 4,
          paperSize: '4x6',
          orientation: 'PORTRAIT',
          colorMode: 'COLOR',
          quality: 'PHOTO_FINE',
        },
      },
      authHeadersA
    );

    assert(enqueue1.status === 201, 'POST /printers/queue enqueues Job 1');
    const job1 = enqueue1.data?.data;
    assert(Boolean(job1?._id), 'Print job assigned valid MongoDB ObjectId');
    assert(typeof job1?.printJobCode === 'string' && job1.printJobCode.startsWith('PRN-'), `Print code generated: ${job1?.printJobCode}`);
    assert(job1?.queuePosition === 1, 'Job 1 assigned priority queue position #1');
    assert(job1?.status === 'QUEUED', 'Job 1 initial status is QUEUED');

    // 3.2 Enqueue Job 2
    const enqueue2 = await post(
      '/printers/queue',
      {
        jobCode: `JOB-DOC-${suffix}`,
        customerName: 'Nusrat Jahan',
        customerPhone: '01899887766',
        printerId: epsonPhoto._id,
        serviceType: 'DOCUMENT_A4',
        documentUrl: testDocBase64,
        documentTitle: 'Contract Document A4',
        settings: {
          copies: 2,
          paperSize: 'A4',
          orientation: 'PORTRAIT',
          colorMode: 'COLOR',
          quality: 'NORMAL',
        },
      },
      authHeadersA
    );

    assert(enqueue2.status === 201, 'POST /printers/queue enqueues Job 2');
    const job2 = enqueue2.data?.data;
    assert(job2?.queuePosition === 2, 'Job 2 assigned queue position #2');

    // 3.3 Fetch Active Queue
    const queueRes = await get('/printers/queue', authHeadersA);
    assert(queueRes.status === 200, 'GET /printers/queue returns 200');
    const queueList = queueRes.data?.data;
    assert(Array.isArray(queueList) && queueList.length >= 2, 'Active queue contains both spooled jobs');

    // 4. Reorder Queue Priority
    const reorderRes = await put(
      '/printers/queue/reorder',
      { orderedIds: [job2._id, job1._id] },
      authHeadersA
    );
    assert(reorderRes.status === 200, 'PUT /printers/queue/reorder returns 200');
    const reorderedQueue = reorderRes.data?.data;
    assert(reorderedQueue[0]._id === job2._id, 'Job 2 promoted to priority #1 in queue');
    assert(reorderedQueue[1]._id === job1._id, 'Job 1 moved to position #2 in queue');

    // 5. Update Print Settings in Queue
    const updateSettingsRes = await patch(
      `/printers/queue/${job1._id}`,
      {
        copies: 10,
        paperSize: 'A4',
        orientation: 'LANDSCAPE',
        quality: 'HIGH',
      },
      authHeadersA
    );
    assert(updateSettingsRes.status === 200, 'PATCH /printers/queue/:id updates settings');
    assert(updateSettingsRes.data?.data?.settings?.copies === 10, 'Copies updated to 10');
    assert(updateSettingsRes.data?.data?.settings?.paperSize === 'A4', 'Paper size updated to A4');
    assert(updateSettingsRes.data?.data?.settings?.orientation === 'LANDSCAPE', 'Orientation updated to LANDSCAPE');

    // 6. Accidental Duplicate Print Protection
    const duplicateAttempt = await post(
      '/printers/queue',
      {
        jobCode: `JOB-PP-${suffix}`, // same job code
        customerName: 'Ashraful Islam',
        documentUrl: testDocBase64,
      },
      authHeadersA
    );
    // Should be rejected by duplicate detection
    assert(
      duplicateAttempt.status === 400,
      'Blocks accidental duplicate print submission for recent job code'
    );

    // 7. Explicit Duplicate Override
    const allowedDuplicate = await post(
      '/printers/queue',
      {
        jobCode: `JOB-PP-${suffix}`,
        customerName: 'Ashraful Islam',
        documentUrl: testDocBase64,
        allowDuplicate: true, // explicit operator override
      },
      authHeadersA
    );
    assert(allowedDuplicate.status === 201, 'Allows duplicate reprint when allowDuplicate=true');
    const jobDuplicate = allowedDuplicate.data?.data;

    // 8. Print Execution Lifecycle (Job 1)
    // 8.1 Mark Printing Started
    const startRes = await post(`/printers/queue/${job1._id}/start`, {}, authHeadersA);
    assert(startRes.status === 200, 'POST /printers/queue/:id/start begins printing');
    assert(startRes.data?.data?.status === 'PRINTING', 'Status transitioned to PRINTING');

    // 8.2 Mark Printing Completed
    const completeRes = await post(
      `/printers/queue/${job1._id}/complete`,
      { printedCopies: 10 },
      authHeadersA
    );
    assert(completeRes.status === 200, 'POST /printers/queue/:id/complete finishes print job');
    assert(completeRes.data?.data?.status === 'COMPLETED', 'Status transitioned to COMPLETED');
    assert(completeRes.data?.data?.printedCopies === 10, 'Printed copies recorded in archive');

    // 9. Cancel Job from Queue (Job Duplicate)
    const removeRes = await del(`/printers/queue/${jobDuplicate._id}`, authHeadersA);
    assert(removeRes.status === 200, 'DELETE /printers/queue/:id removes job from active queue');

    // Verify Active Queue now has only Job 2
    const currentQueue = (await get('/printers/queue', authHeadersA)).data?.data;
    assert(
      !currentQueue.some((j: any) => j._id === job1._id || j._id === jobDuplicate._id),
      'Completed and cancelled jobs automatically cleared from active queue'
    );

    // 10. Print History Archive & Audit Log
    const historyRes = await get('/printers/history', authHeadersA);
    assert(historyRes.status === 200, 'GET /printers/history returns 200');
    const historyList = historyRes.data?.data?.history;
    assert(Array.isArray(historyList) && historyList.length >= 2, 'History contains completed and cancelled jobs');
    assert(
      historyList.some((h: any) => h._id === job1._id && h.status === 'COMPLETED'),
      'Completed job archived with full customer & printer metadata'
    );

    // 11. Downloadable Print-Ready Vector PDF
    const pdfRes = await fetch(`${BASE_URL}/printers/export-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeadersA,
      },
      body: JSON.stringify({
        title: 'Passport Sheet Vector Export',
        paperSize: '4x6',
        orientation: 'PORTRAIT',
        imageBase64: testDocBase64,
      }),
    });

    assert(pdfRes.status === 200, 'POST /printers/export-pdf returns 200 OK');
    const pdfContentType = pdfRes.headers.get('content-type');
    assert(pdfContentType?.includes('application/pdf') || false, 'Content-Type header is application/pdf');
    const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
    assert(pdfBuf.slice(0, 5).toString('utf-8') === '%PDF-', 'PDF stream begins with %PDF-');

    // 12. Cross-Tenant Isolation
    const subB = `competitor-printer-${suffix}`;
    const regResB = await post('/auth/register-shop', {
      shopName: `Competitor Printing Service ${suffix}`,
      subdomain: subB,
      ownerName: `Another Owner ${suffix}`,
      email: `competitor.${suffix}@docustudio.test`,
      password: 'SecurePassword123!',
      plan: 'STARTER',
    });
    const tokenB = regResB.data.data?.tokens?.accessToken;
    const authHeadersB = { Authorization: `Bearer ${tokenB}` };

    const crossQueue = await get('/printers/queue', authHeadersB);
    const leakedQueue = crossQueue.data?.data?.some((j: any) => j._id === job2._id);
    assert(!leakedQueue, 'Tenant B cannot see Tenant A active print queue');

    const crossCancel = await del(`/printers/queue/${job2._id}`, authHeadersB);
    assert(crossCancel.status === 404, 'Tenant B cannot cancel or tamper with Tenant A print queue');

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

runPhase11Tests();

