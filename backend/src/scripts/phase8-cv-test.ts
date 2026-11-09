export {};

/**
 * Automated Verification Test Suite for Phase 8:
 * CV Builder & Ready-made Documents Module
 *
 * Tests:
 * 1. Shop Tenant registration and authentication
 * 2. System Document Templates pre-seeding & retrieval (Application, Agreement, Certificate)
 * 3. Dynamic Template Variable Substitution ({{variable}} rendering)
 * 4. Ready-Made Document 300 DPI Vector PDF Generation (PDFKit)
 * 5. MongoDB Ready-Made Document persistence & shop queue synchronization
 * 6. CV Builder 300 DPI Vector PDF Generation (Modern & Bangla Bio-data layouts)
 * 7. MongoDB CV Job persistence & shop queue synchronization
 * 8. Saved CV jobs retrieval and reopening
 * 9. Strict Cross-Tenant isolation enforcement
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

async function runPhase8Tests() {
  console.log('\n============================================================');
  console.log('🚀 DOCUSTUDIO SAAS - PHASE 8 CV BUILDER & READY DOCUMENTS VERIFICATION');
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
    const subA = `cv-shop-${suffix}`;
    const tenantPayloadA = {
      shopName: `Elite CV & Legal Printing ${suffix}`,
      subdomain: subA,
      ownerName: 'Rashidul Karim',
      email: `cv.shop.${suffix}@docustudio.test`,
      password: 'Password123!',
      plan: 'PROFESSIONAL',
    };

    const regA = await post('/auth/register-shop', tenantPayloadA);
    assert(regA.status === 201, 'Tenant A registration succeeds', JSON.stringify(regA.data));
    const tokenA = regA.data.data?.tokens?.accessToken;
    const authHeadersA = { Authorization: `Bearer ${tokenA}` };

    // 2. Ready-Made Document Templates Retrieval
    const templatesRes = await get('/cv/templates', authHeadersA);
    assert(templatesRes.status === 200, 'GET /cv/templates returns 200');
    const templatesList = templatesRes.data.data || [];
    assert(templatesList.length >= 3, 'Pre-seeds standard document templates (Application, Agreement, Certificate)');

    const houseRentTpl = templatesList.find((t: any) => t.category === 'AGREEMENT');
    assert(!!houseRentTpl, 'Found House Rent Agreement template');
    assert(Array.isArray(houseRentTpl?.fields) && houseRentTpl.fields.length >= 5, 'Template defines dynamic configurable input fields');

    // 3. Dynamic Template Variable Substitution Test
    const renderRes = await post(
      '/cv/render-document',
      {
        contentTemplate: 'চুক্তিপত্র: ১ম পক্ষ {{landlordName}}, ২য় পক্ষ {{tenantName}}, মাসিক ভাড়া ৳ {{monthlyRent}}।',
        values: {
          landlordName: 'আব্দুল কাদের',
          tenantName: 'মোস্তাফিজুর রহমান',
          monthlyRent: 15000,
        },
      },
      authHeadersA
    );

    assert(renderRes.status === 200, 'POST /cv/render-document returns 200');
    const rendered = renderRes.data.data?.renderedContent;
    assert(
      rendered?.includes('আব্দুল কাদের') && rendered?.includes('মোস্তাফিজুর রহমান') && rendered?.includes('15000'),
      'Dynamic variables substituted accurately into rendered document body'
    );

    // 4. Ready-Made Document Vector PDF Generation
    const readyDocPdfRes = await fetch(`${BASE_URL}/cv/export-doc-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        renderedContent: rendered,
        title: 'House Rent Agreement (বাড়ি ভাড়ার চুক্তিপত্র)',
        filename: 'agreement-sample.pdf',
      }),
    });

    assert(readyDocPdfRes.status === 200, 'POST /cv/export-doc-pdf returns 200 OK');
    const pdfContentType = readyDocPdfRes.headers.get('content-type');
    assert(pdfContentType?.includes('application/pdf') === true, 'Response header is application/pdf');
    const docPdfBytes = await readyDocPdfRes.arrayBuffer();
    const docPdfHeader = Buffer.from(docPdfBytes.slice(0, 5)).toString();
    assert(docPdfHeader === '%PDF-', 'Ready document PDF stream begins with %PDF-');

    // 5. Save Ready-Made Document Job to MongoDB
    const saveReadyDocRes = await post(
      '/cv/ready-docs',
      {
        templateId: houseRentTpl._id,
        templateTitle: houseRentTpl.title,
        customerName: 'আব্দুল কাদের',
        customerPhone: '+8801700112233',
        filledValues: {
          landlordName: 'আব্দুল কাদের',
          tenantName: 'মোস্তাফিজুর রহমান',
          monthlyRent: 15000,
        },
        renderedContent: rendered,
        copies: 3,
        totalAmount: 60,
        notes: 'House rent 1 year deed',
      },
      authHeadersA
    );

    assert(saveReadyDocRes.status === 201, 'POST /cv/ready-docs creates and persists document job');
    const savedReadyDoc = saveReadyDocRes.data.data;
    assert(!!savedReadyDoc?._id, 'Ready document job has MongoDB ObjectId');
    assert(savedReadyDoc?.jobCode?.startsWith('RMD-'), `Job code generated with RMD- prefix: ${savedReadyDoc?.jobCode}`);

    // 6. CV Builder Vector PDF Generation
    const sampleCvData = {
      personalInfo: {
        fullName: 'Shakil Mahmud',
        jobTitle: 'Accounts Executive',
        email: 'shakil.m@example.com',
        phone: '+880 1711 223344',
        address: 'Uttara, Dhaka-1230',
        dateOfBirth: '20 May 1996',
        nationality: 'Bangladeshi',
        religion: 'Islam',
        fatherName: 'Late Nurul Islam',
      },
      objective: 'Motivated finance and accounts professional aiming to contribute to company growth.',
      experience: [
        {
          title: 'Accounts Officer',
          company: 'Bengal Trade International',
          startDate: '2022',
          endDate: 'Present',
          current: true,
          description: 'Handled payroll, bank reconciliation, and general ledger postings.',
        },
      ],
      education: [
        {
          degree: 'BBA in Accounting',
          institution: 'National University',
          passingYear: '2020',
          result: 'CGPA: 3.50',
        },
      ],
      skills: ['Tally Prime', 'QuickBooks', 'Excel Financial Modeling', 'VAT & Tax Filing'],
      projects: [],
      languages: [{ name: 'Bangla' }, { name: 'English' }],
      references: [],
    };

    const cvPdfRes = await fetch(`${BASE_URL}/cv/export-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        cvData: sampleCvData,
        templateId: 'modern',
        theme: { primaryColor: '#1E3A8A' },
        filename: 'shakil-mahmud-cv.pdf',
      }),
    });

    assert(cvPdfRes.status === 200, 'POST /cv/export-pdf returns 200 OK');
    const cvPdfBytes = await cvPdfRes.arrayBuffer();
    const cvPdfHeader = Buffer.from(cvPdfBytes.slice(0, 5)).toString();
    assert(cvPdfHeader === '%PDF-', 'CV PDF stream begins with %PDF-');

    // 7. Save CV Job to MongoDB
    const saveCvRes = await post(
      '/cv/jobs',
      {
        customerName: 'Shakil Mahmud',
        customerPhone: '+880 1711 223344',
        templateId: 'modern',
        theme: { primaryColor: '#1E3A8A' },
        cvData: sampleCvData,
        copies: 2,
        totalAmount: 100, // 2 copies x 50 BDT
        notes: 'Bank job application printout',
      },
      authHeadersA
    );

    assert(saveCvRes.status === 201, 'POST /cv/jobs creates and persists CV job to MongoDB');
    const savedCv = saveCvRes.data.data;
    assert(!!savedCv?._id, 'CV job assigned a MongoDB ObjectId');
    assert(savedCv?.jobCode?.startsWith('CV-'), `CV job code generated with CV- prefix: ${savedCv?.jobCode}`);
    const cvJobId = savedCv?._id;

    // 8. List Saved CV Jobs
    const listCvRes = await get('/cv/jobs', authHeadersA);
    assert(listCvRes.status === 200, 'GET /cv/jobs retrieves saved CV list');
    const cvList = listCvRes.data.data || [];
    assert(cvList.some((c: any) => c._id === cvJobId), 'Newly saved CV is present in shop list');

    // 9. Reopen Specific CV Job
    const getCvRes = await get(`/cv/jobs/${cvJobId}`, authHeadersA);
    assert(getCvRes.status === 200, 'GET /cv/jobs/:jobId reopens saved CV');
    assert(getCvRes.data.data?.cvData?.personalInfo?.fullName === 'Shakil Mahmud', 'Reopened CV preserves personal information');
    assert(getCvRes.data.data?.cvData?.experience?.length === 1, 'Reopened CV preserves experience records');

    // 10. Strict Cross-Tenant Isolation Enforcement
    const subB = `other-cv-shop-${suffix}`;
    const tenantPayloadB = {
      shopName: `Apex Document Center ${suffix}`,
      subdomain: subB,
      ownerName: 'Shahidul Islam',
      email: `other.cv.${suffix}@docustudio.test`,
      password: 'Password123!',
      plan: 'STARTER',
    };
    const regB = await post('/auth/register-shop', tenantPayloadB);
    const tokenB = regB.data.data?.tokens?.accessToken;
    const authHeadersB = { Authorization: `Bearer ${tokenB}` };

    const unauthorizedAccess = await get(`/cv/jobs/${cvJobId}`, authHeadersB);
    assert(
      unauthorizedAccess.status === 404 || unauthorizedAccess.status === 403,
      'Tenant B cannot access Tenant A CV job (Enforces Tenant Isolation)',
      `Status: ${unauthorizedAccess.status}`
    );

    const listB = await get('/cv/jobs', authHeadersB);
    assert(
      !listB.data.data?.some((c: any) => c._id === cvJobId),
      'Tenant B CV list is strictly isolated from Tenant A'
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

runPhase8Tests();

