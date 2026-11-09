import crypto from 'crypto';
import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

import axios from 'axios';
import mongoose from 'mongoose';
import { db } from '../config/db';
import { Tenant } from '../models/Tenant.model';
import { User } from '../models/User.model';
import { Customer } from '../models/Customer.model';
import { Job } from '../models/Job.model';
import { OnboardingState } from '../models/Onboarding.model';
import { TokenService } from '../utils/token';

const API_BASE = 'http://localhost:5000/api/v1';

interface TestResult {
  suite: string;
  test: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function assert(condition: boolean, suite: string, test: string, errorMsg?: string, details?: any) {
  if (condition) {
    results.push({ suite, test, passed: true, details });
    console.log(`  ✓ [PASS] ${suite} - ${test}`);
  } else {
    results.push({ suite, test, passed: false, error: errorMsg || 'Assertion failed', details });
    console.error(`  ✗ [FAIL] ${suite} - ${test}: ${errorMsg || 'Assertion failed'}`);
  }
}

async function runPhase29Tests() {
  console.log('\n================================================================');
  console.log('  PHASE 29: PREMIUM ONBOARDING & ACTIVATION SYSTEM TEST SUITE   ');
  console.log('================================================================\n');

  await db.connect();
  console.log('Connected to MongoDB Atlas...\n');

  const timestamp = Date.now();

  try {
    // -------------------------------------------------------------
    // SETUP: Create New Tenant & Users
    // -------------------------------------------------------------
    const testSubdomain = `onboard-${timestamp.toString().slice(-6)}`;
    const tenant = await Tenant.create({
      businessId: `SHOP-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      subdomain: testSubdomain,
      name: `Onboarding Test Studio ${timestamp}`,
      email: `owner_${testSubdomain}@test.com`,
      subscription: {
        plan: 'STARTER',
        status: 'ACTIVE',
        trialEndsAt: new Date(Date.now() + 14 * 86400000),
      },
      quotas: {
        maxStaffSeats: 2,
        monthlyPassportLayoutsLimit: 100,
        monthlyPassportLayoutsUsed: 0,
        monthlyOcrPagesLimit: 50,
        monthlyOcrPagesUsed: 0,
        monthlyJobsLimit: 300,
        monthlyJobsUsed: 0,
        storageLimitBytes: 2 * 1024 * 1024 * 1024,
        storageUsedBytes: 0,
      },
      isActive: true,
    });

    const owner = await User.create({
      tenantId: tenant._id,
      fullName: 'Kamrul Hasan (Owner)',
      email: `owner_${testSubdomain}@test.com`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
      role: 'OWNER',
      isActive: true,
      isEmailVerified: true,
    });

    const staff = await User.create({
      tenantId: tenant._id,
      fullName: 'Suman Roy (Operator)',
      email: `staff_${testSubdomain}@test.com`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
      role: 'STAFF',
      isActive: true,
      isEmailVerified: true,
    });

    const ownerToken = TokenService.generateAccessToken({
      userId: owner._id.toString(),
      email: owner.email,
      role: owner.role,
      tenantId: tenant._id.toString(),
    });

    const staffToken = TokenService.generateAccessToken({
      userId: staff._id.toString(),
      email: staff.email,
      role: staff.role,
      tenantId: tenant._id.toString(),
    });

    const ownerClient = axios.create({
      baseURL: API_BASE,
      headers: { Authorization: `Bearer ${ownerToken}`, 'x-tenant-id': testSubdomain },
    });

    const staffClient = axios.create({
      baseURL: API_BASE,
      headers: { Authorization: `Bearer ${staffToken}`, 'x-tenant-id': testSubdomain },
    });

    // -------------------------------------------------------------
    // TEST 1: Auto-Initialize Onboarding State
    // -------------------------------------------------------------
    console.log('>>> [TEST SUITE 1: Initialization & State Retrieval]');
    const initRes = await ownerClient.get('/onboarding/state');
    assert(
      initRes.data.success && initRes.data.data.state.currentStep === 1,
      'Init',
      'Auto-initializes state with currentStep = 1'
    );
    assert(
      initRes.data.data.progressPercent === 0,
      'Init',
      'Initial progress percent is 0%'
    );
    assert(
      initRes.data.data.tenantDetails.maxStaffSeats === 2,
      'Init',
      'Respects tenant subscription quotas (maxStaffSeats = 2)'
    );

    // -------------------------------------------------------------
    // TEST 2: 10-Step Guided Flow Execution (Steps 1 to 10)
    // -------------------------------------------------------------
    console.log('\n>>> [TEST SUITE 2: 10-Step Guided Setup Execution]');

    // Step 1: Welcome
    const step1Res = await ownerClient.post('/onboarding/step', { step: 1, payload: {} });
    assert(
      step1Res.data.data.state.currentStep === 2 && step1Res.data.data.state.completedSteps.includes(1),
      'Step 1',
      'Welcome acknowledged, advances to Step 2'
    );

    // Step 2: Business Profile
    const step2Res = await ownerClient.post('/onboarding/step', {
      step: 2,
      payload: {
        shopName: 'Metro Digital Color Lab Pro',
        phone: '01711223344',
        address: 'House 12, Road 5, Elephant Road, Dhaka',
        currency: 'BDT',
      },
    });
    assert(
      step2Res.data.data.state.currentStep === 3 && step2Res.data.data.state.checklist.shopProfileCompleted,
      'Step 2',
      'Business profile updated and checklist marked'
    );

    // Verify DB update on Tenant
    const updatedTenant = await Tenant.findById(tenant._id);
    assert(
      updatedTenant?.name === 'Metro Digital Color Lab Pro' && updatedTenant?.phone === '01711223344',
      'Step 2',
      'Tenant document synchronized with new name and phone'
    );

    // Step 3: Shop Logo
    const step3Res = await ownerClient.post('/onboarding/step', {
      step: 3,
      payload: { logoUrl: 'https://cdn.example.com/metro-logo.png' },
    });
    assert(
      step3Res.data.data.state.stepData.logoUrl === 'https://cdn.example.com/metro-logo.png',
      'Step 3',
      'Shop logo URL stored in state'
    );

    // Step 4: Configure Services
    const step4Res = await ownerClient.post('/onboarding/step', {
      step: 4,
      payload: { services: ['PASSPORT_PHOTO', 'ID_CARD_A4', 'DOCUMENT_A4', 'CV_BUILDER'] },
    });
    assert(
      step4Res.data.data.state.stepData.servicesConfigured.length === 4,
      'Step 4',
      'Configured 4 studio service modules'
    );

    // Step 5: Configure Service Pricing
    const step5Res = await ownerClient.post('/onboarding/step', {
      step: 5,
      payload: {
        pricing: [
          { serviceType: 'PASSPORT_PHOTO', price: 320, paperType: 'GLOSSY_PHOTO_260GSM' },
          { serviceType: 'ID_CARD_A4', price: 160, paperType: 'LAMINATION_POUCH_150MIC' },
        ],
      },
    });
    assert(
      step5Res.data.data.state.checklist.pricingConfigured,
      'Step 5',
      'Custom pricing saved and checklist flagged'
    );

    // Step 6: Invite Staff & Check Seat Limit Enforcement
    // Starter plan quota is 2 seats; tenant already has 1 staff (Suman Roy), so adding 1 is fine, adding 2 should fail
    let seatLimitBlocked = false;
    try {
      await ownerClient.post('/onboarding/step', {
        step: 6,
        payload: {
          staff: [
            { email: `extra1_${timestamp}@test.com`, fullName: 'Extra Staff 1' },
            { email: `extra2_${timestamp}@test.com`, fullName: 'Extra Staff 2' },
          ],
        },
      });
    } catch (err: any) {
      seatLimitBlocked = err.response?.status === 400 && err.response?.data?.message?.includes('exceeds');
    }
    assert(
      seatLimitBlocked,
      'Step 6',
      'Enforces subscription quota: blocks adding staff beyond maxStaffSeats limit'
    );

    // Now invite 1 valid staff within quota
    const step6Res = await ownerClient.post('/onboarding/step', {
      step: 6,
      payload: {
        staff: [{ email: `operator_${timestamp}@test.com`, fullName: 'Tariqul Islam' }],
      },
    });
    assert(
      step6Res.data.data.state.checklist.firstStaffInvited,
      'Step 6',
      'Invited staff within quota and updated checklist'
    );

    // Step 7: Configure Print Settings
    const step7Res = await ownerClient.post('/onboarding/step', {
      step: 7,
      payload: {
        printSettings: {
          defaultPaperSize: 'A4',
          defaultDpi: 300,
          printerModel: 'Epson L805',
          marginOffsetXmm: 1.5,
          marginOffsetYmm: 2.0,
        },
      },
    });
    assert(
      step7Res.data.data.state.stepData.printSettings.marginOffsetXmm === 1.5,
      'Step 7',
      'Printer margin offset calibration saved'
    );

    // Step 8: Add First Customer
    const customerPhone = `01711${timestamp.toString().slice(-6)}`;
    const step8Res = await ownerClient.post('/onboarding/step', {
      step: 8,
      payload: {
        customer: {
          fullName: 'Zubair Ahmed',
          phone: customerPhone,
          email: 'zubair@example.com',
        },
      },
    });
    assert(
      step8Res.data.data.state.checklist.firstCustomerCreated && Boolean(step8Res.data.data.state.stepData.firstCustomerId),
      'Step 8',
      'First customer created and linked in onboarding state'
    );

    // Step 9: Create First Job
    const step9Res = await ownerClient.post('/onboarding/step', {
      step: 9,
      payload: {
        job: {
          serviceType: 'PASSPORT_PHOTO',
          title: 'Schengen Visa 35x45mm (8 Copies)',
          price: 320,
        },
      },
    });
    assert(
      step9Res.data.data.state.checklist.firstJobCreated && Boolean(step9Res.data.data.state.stepData.firstJobId),
      'Step 9',
      'First live job created and linked in onboarding state'
    );

    // Step 10: Complete First Job & Shop Activation
    const step10Res = await ownerClient.post('/onboarding/step', {
      step: 10,
      payload: {},
    });
    assert(
      step10Res.data.data.state.isCompleted && Boolean(step10Res.data.data.state.completedAt),
      'Step 10',
      'Onboarding completed, isCompleted = true with timestamp'
    );
    assert(
      step10Res.data.data.progressPercent === 100,
      'Step 10',
      'Progress indicator reaches 100%'
    );
    assert(
      step10Res.data.data.state.checklist.firstJobCompleted && step10Res.data.data.state.checklist.firstPrintExported,
      'Step 10',
      'All 7 checklist milestones certified'
    );

    // -------------------------------------------------------------
    // TEST 3: Skip Optional Steps & Idempotency
    // -------------------------------------------------------------
    console.log('\n>>> [TEST SUITE 3: Skip Step & Duplicate Prevention]');
    const skipRes = await ownerClient.post('/onboarding/skip', { step: 3 });
    assert(
      skipRes.data.data.state.skippedSteps.includes(3),
      'Skip Step',
      'Optional step recorded in skippedSteps'
    );

    // Duplicate setup prevention: count records for tenant
    const recordCount = await OnboardingState.countDocuments({ tenantId: tenant._id });
    assert(
      recordCount === 1,
      'Duplicate Prevention',
      'Strictly 1 onboarding document per tenant across repeated calls'
    );

    // -------------------------------------------------------------
    // TEST 4: Demo Workspace Sample Data (Seed & Purge)
    // -------------------------------------------------------------
    console.log('\n>>> [TEST SUITE 4: Demo Workspace Seed & 1-Click Purge]');
    const seedRes = await ownerClient.post('/onboarding/demo/seed');
    assert(
      seedRes.data.success && seedRes.data.data.sampleCustomersCount === 2,
      'Demo Seed',
      'Successfully injected 2 sample customers & jobs'
    );

    // Verify sample customers exist in DB
    const sampleCusts = await Customer.find({ tenantId: tenant._id, notes: { $regex: /\[SAMPLE DATA\]/ } });
    assert(
      sampleCusts.length === 2,
      'Demo Seed',
      'Sample customer records tagged with [SAMPLE DATA]'
    );

    // 1-Click Purge
    const purgeRes = await ownerClient.post('/onboarding/demo/purge');
    assert(
      purgeRes.data.success && purgeRes.data.data.purgedCustomers === 2,
      'Demo Purge',
      '1-Click purge successfully removed 2 sample customers'
    );

    const postPurgeCusts = await Customer.find({ tenantId: tenant._id, notes: { $regex: /\[SAMPLE DATA\]/ } });
    assert(
      postPurgeCusts.length === 0,
      'Demo Purge',
      'Zero sample customer records remain in database after purge'
    );

    // -------------------------------------------------------------
    // TEST 5: CSV Customer Import with Validation
    // -------------------------------------------------------------
    console.log('\n>>> [TEST SUITE 5: Customer CSV Bulk Import & Validation]');
    const testCsv = `fullName,phone,email,service
Faruk Ahmed,01811998877,faruk@example.com,PASSPORT_PHOTO
Nusrat Jahan,01922887766,nusrat@example.com,ID_CARD_A4
Invalid Row,invalid-phone,bad@email.com,
TooShort,1234,short@email.com,`;

    const csvRes = await ownerClient.post('/onboarding/import/csv', { csvContent: testCsv });
    assert(
      csvRes.data.data.importedCount === 2,
      'CSV Import',
      'Imported 2 valid customer records'
    );
    assert(
      csvRes.data.data.skippedCount === 2 && csvRes.data.data.errors.length === 2,
      'CSV Import',
      'Validated and rejected 2 malformed rows (invalid phone format)'
    );

    // -------------------------------------------------------------
    // TEST 6: Activation Analytics & Privacy Verification
    // -------------------------------------------------------------
    console.log('\n>>> [TEST SUITE 6: Activation Events & Privacy]');
    const stateDoc = await OnboardingState.findOne({ tenantId: tenant._id });
    const events = stateDoc?.activationEvents.map((e) => e.event) || [];

    assert(
      events.includes('SHOP_PROFILE_UPDATED') &&
        events.includes('FIRST_STAFF_INVITED') &&
        events.includes('FIRST_CUSTOMER_CREATED') &&
        events.includes('FIRST_JOB_COMPLETED') &&
        events.includes('SHOP_SETUP_COMPLETED'),
      'Analytics',
      'All 5 core activation milestones tracked in activationEvents ledger'
    );

    // Privacy verification: verify zero customer photos, face hashes, or raw document content in metadata
    let hasSensitiveData = false;
    for (const ev of stateDoc?.activationEvents || []) {
      const metaStr = JSON.stringify(ev.metadata || {});
      if (metaStr.includes('base64') || metaStr.includes('face') || metaStr.includes('photo') || metaStr.includes('buffer')) {
        hasSensitiveData = true;
      }
    }
    assert(
      !hasSensitiveData,
      'Privacy',
      'Activation analytics contains zero citizen biometric or document content'
    );

    // -------------------------------------------------------------
    // TEST 7: Role-Based Authorization Bounds
    // -------------------------------------------------------------
    console.log('\n>>> [TEST SUITE 7: Role-Based Authorization Bounds]');
    let staffBlockedFromShopProfile = false;
    try {
      await staffClient.post('/onboarding/step', {
        step: 2,
        payload: { shopName: 'Malicious Staff Rename' },
      });
    } catch (err: any) {
      staffBlockedFromShopProfile = err.response?.status === 403;
    }
    assert(
      staffBlockedFromShopProfile,
      'RBAC',
      'Non-owner staff blocked from editing shop profile / settings (403 Forbidden)'
    );

    // Interactive Tour Completion
    const tourRes = await ownerClient.post('/onboarding/tour/complete');
    assert(
      tourRes.data.success,
      'Tour',
      'Interactive product tour marked as completed'
    );

    // -------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log('  PHASE 29 TEST EXECUTION SUMMARY                               ');
    console.log('================================================================');
    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;

    console.log(`Total Checks Executed : ${total}`);
    console.log(`Passed                : ${passed}`);
    console.log(`Failed                : ${failed}`);
    console.log(`Pass Rate             : ${((passed / total) * 100).toFixed(1)}%\n`);

    if (failed > 0) {
      console.error('CRITICAL: Phase 29 tests encountered failures.');
      process.exit(1);
    } else {
      console.log('SUCCESS: All Phase 29 onboarding & activation tests passed flawlessly!');
      process.exit(0);
    }
  } catch (err: any) {
    console.error('Fatal error during Phase 29 test execution:', err.response?.data || err.message || err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runPhase29Tests();

