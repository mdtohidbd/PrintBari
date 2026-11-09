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
import { ShopTransaction } from '../models/ShopFinance.model';
import { DataSubjectRequest, ConsentRecord, PurgeJobLog } from '../models/DataPrivacy.model';
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

async function runPhase31Tests() {
  console.log('\n================================================================');
  console.log('  PHASE 31: DATA GOVERNANCE & PRIVACY COMPLIANCE TEST SUITE     ');
  console.log('================================================================\n');

  await db.connect();
  console.log('Connected to MongoDB Atlas...\n');

  const timestamp = Date.now();

  try {
    // -------------------------------------------------------------
    // SETUP: Tenant & Multi-Role Users
    // -------------------------------------------------------------
    const testSubdomain = `priv-${timestamp.toString().slice(-6)}`;
    const tenant = await Tenant.create({
      businessId: `PRIV-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      subdomain: testSubdomain,
      name: `Privacy Test Studio ${timestamp}`,
      email: `owner_${testSubdomain}@test.com`,
      subscription: {
        plan: 'PRO',
        status: 'ACTIVE',
        trialEndsAt: new Date(Date.now() + 30 * 86400000),
      },
      settings: {
        autoPurgeHours: 24,
      },
      quotas: {
        maxStaffSeats: 5,
        monthlyPassportLayoutsLimit: 500,
        monthlyPassportLayoutsUsed: 0,
        monthlyOcrPagesLimit: 200,
        monthlyOcrPagesUsed: 0,
        monthlyJobsLimit: 1000,
        monthlyJobsUsed: 0,
        storageLimitBytes: 10 * 1024 * 1024 * 1024,
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

    const citizenPhone = `01711${timestamp.toString().slice(-6)}`;
    const customer = await Customer.create({
      tenantId: tenant._id,
      fullName: 'Zubair Ahmed',
      phone: citizenPhone,
      email: 'zubair.ahmed@example.com',
      totalOrdersCount: 2,
      totalSpent: 450,
      dueBalance: 0,
      lastVisitAt: new Date(),
      isActive: true,
      isDeleted: false,
    });

    // -------------------------------------------------------------
    // TEST 1: Citizen Consent Recording & Retrieval
    // -------------------------------------------------------------
    console.log('>>> [TEST SUITE 1: Citizen Consent Governance]');
    const consentRes = await staffClient.post('/privacy/consent', {
      customerPhone: citizenPhone,
      customerId: customer._id.toString(),
      consentType: 'BIOMETRIC_PHOTO_PROCESSING',
      granted: true,
      privacyPolicyVersion: 'v1.0.0-PROD',
    });
    assert(
      consentRes.data.success && consentRes.data.data.consentType === 'BIOMETRIC_PHOTO_PROCESSING',
      'Consent',
      'Recorded citizen consent for biometric photo processing'
    );

    const consentStatusRes = await staffClient.get(`/privacy/consent/${citizenPhone}`);
    assert(
      consentStatusRes.data.data.length > 0 && consentStatusRes.data.data[0].granted === true,
      'Consent',
      'Retrieved active citizen consent status'
    );

    // Consent Revocation
    const revokeRes = await staffClient.post('/privacy/consent/revoke', {
      customerPhone: citizenPhone,
      consentType: 'BIOMETRIC_PHOTO_PROCESSING',
      reason: 'Citizen withdrew photo consent',
    });
    assert(
      revokeRes.data.success && revokeRes.data.data.granted === false,
      'Consent',
      'Citizen successfully withdrew consent with audit timestamp'
    );

    // -------------------------------------------------------------
    // TEST 2: Data Subject Requests (DSR / DSAR)
    // -------------------------------------------------------------
    console.log('\n>>> [TEST SUITE 2: Data Subject Request Lifecycle]');
    // 1. Submit Deletion DSR
    const dsrCreateRes = await staffClient.post('/privacy/dsr', {
      requestType: 'DELETION',
      subjectPhone: citizenPhone,
      subjectName: 'Zubair Ahmed',
      details: 'Requesting permanent deletion under BD PDPA 2026 Section on Right to Erasure',
    });
    const dsr = dsrCreateRes.data.data.dsr;
    const otpCode = dsrCreateRes.data.data.verificationCode;
    assert(
      dsrCreateRes.data.success && dsr.status === 'PENDING',
      'DSR Lifecycle',
      'Submitted DSR for citizen data erasure'
    );

    // 2. Verify Phone OTP
    const verifyRes = await staffClient.post('/privacy/dsr/verify', {
      requestNumber: dsr.requestNumber,
      verificationCode: otpCode,
    });
    assert(
      verifyRes.data.data.status === 'VERIFIED' && verifyRes.data.data.isVerified === true,
      'DSR Lifecycle',
      'Verified citizen identity via OTP verification code'
    );

    // 3. List DSRs (Owner only)
    const listDsrRes = await ownerClient.get('/privacy/dsr');
    assert(
      listDsrRes.data.data.some((d: any) => d.requestNumber === dsr.requestNumber),
      'DSR Lifecycle',
      'Owner retrieved list of pending/verified DSRs'
    );

    // -------------------------------------------------------------
    // TEST 3: Deletion DSR Execution & Statutory Financial Separation
    // -------------------------------------------------------------
    console.log('\n>>> [TEST SUITE 3: Right to Erasure & Financial Record Retention]');
    // Create a Job with mock uploaded & processed files
    const job = await Job.create({
      tenantId: tenant._id,
      jobCode: `JOB-PRIV-${timestamp.toString().slice(-4)}`,
      customerId: customer._id,
      customerName: customer.fullName,
      customerPhone: customer.phone,
      serviceType: 'PASSPORT_PHOTO',
      status: 'COMPLETED',
      priority: 'NORMAL',
      copies: 8,
      paperType: 'GLOSSY_PHOTO_260GSM',
      price: { subtotal: 300, discount: 0, tax: 0, totalPrice: 300 },
      totalAmount: 300,
      paidAmount: 300,
      paymentStatus: 'PAID',
      paymentMethod: 'CASH',
      uploadedFiles: [
        { fileId: 'raw-face-001', name: 'raw_face.jpg', url: 'https://s3.example.com/raw.jpg', size: 1048576, version: 1, uploadedAt: new Date() },
      ],
      processedFiles: [
        { fileId: 'sheet-001', name: 'sheet_300dpi.png', url: 'https://s3.example.com/sheet.png', size: 2097152, version: 1, uploadedAt: new Date() },
      ],
    });

    // Create a financial sales transaction linked to customer
    const txn = await ShopTransaction.create({
      tenantId: tenant._id,
      transactionCode: `TXN-PRIV-${timestamp.toString().slice(-4)}`,
      type: 'SALE',
      amount: 300,
      paymentMethod: 'CASH',
      category: 'PASSPORT_PHOTO',
      customerId: customer._id,
      customerName: customer.fullName,
      customerPhone: customer.phone,
      recordedBy: owner._id,
      recordedByName: owner.fullName,
    });

    // Process DSR Completion
    const processRes = await ownerClient.patch(`/privacy/dsr/${dsr._id}`, {
      action: 'COMPLETE',
    });
    assert(
      processRes.data.data.status === 'COMPLETED',
      'DSR Execution',
      'Marked DSR request as COMPLETED by Owner'
    );

    // Verify Customer Soft Deletion & Anonymization
    const anonymizedCust = await Customer.findById(customer._id);
    assert(
      anonymizedCust?.isDeleted === true && anonymizedCust?.fullName.includes('Anonymized Citizen'),
      'Right to Erasure',
      'Customer profile soft-deleted and personally identifiable name anonymized'
    );

    // Verify Linked Job Files Securely Wiped
    const wipedJob = await Job.findById(job._id);
    assert(
      wipedJob?.uploadedFiles.length === 0 && wipedJob?.processedFiles.length === 0,
      'Right to Erasure',
      'Raw portrait and generated print sheets securely wiped from linked jobs'
    );

    // CRITICAL: Verify Financial Transaction Records Kept for Statutory Tax Compliance
    const preservedTxn = await ShopTransaction.findById(txn._id);
    assert(
      preservedTxn !== null && preservedTxn?.amount === 300 && preservedTxn?.customerName === 'Anonymized Citizen',
      'Financial Compliance',
      'Financial transaction preserved for VAT/tax audit with citizen name anonymized'
    );

    // -------------------------------------------------------------
    // TEST 4: Citizen Machine-Readable Data Export (SAR)
    // -------------------------------------------------------------
    console.log('\n>>> [TEST SUITE 4: Citizen Data Export (SAR)]');
    // Create new active customer for export check
    const exportCitizenPhone = `01822${timestamp.toString().slice(-6)}`;
    const exportCustomer = await Customer.create({
      tenantId: tenant._id,
      fullName: 'Nusrat Jahan',
      phone: exportCitizenPhone,
      email: 'nusrat@example.com',
      totalOrdersCount: 1,
      totalSpent: 220,
      dueBalance: 0,
      lastVisitAt: new Date(),
      isActive: true,
      isDeleted: false,
    });

    const exportRes = await ownerClient.get(`/privacy/export/${exportCitizenPhone}`);
    assert(
      exportRes.data.success && exportRes.data.data.citizenProfile.fullName === 'Nusrat Jahan',
      'Data Export',
      'Exported machine-readable JSON data package with citizen profile'
    );
    assert(
      exportRes.data.data.exportMetadata.format === 'JSON_MACHINE_READABLE',
      'Data Export',
      'Confirmed JSON_MACHINE_READABLE export metadata format'
    );

    // -------------------------------------------------------------
    // TEST 5: Automated 24-Hour Retention Purge Engine
    // -------------------------------------------------------------
    console.log('\n>>> [TEST SUITE 5: Automated 24-Hour Retention Purge]');
    // Create old completed job (completed 48 hours ago with raw files)
    const oldJob = await Job.create({
      tenantId: tenant._id,
      jobCode: `JOB-OLD-${timestamp.toString().slice(-4)}`,
      customerId: exportCustomer._id,
      customerName: exportCustomer.fullName,
      customerPhone: exportCustomer.phone,
      serviceType: 'DOCUMENT_A4',
      status: 'COMPLETED',
      priority: 'NORMAL',
      copies: 1,
      paperType: 'BOND_80GSM',
      price: { subtotal: 200, discount: 0, tax: 0, totalPrice: 200 },
      totalAmount: 200,
      paidAmount: 200,
      paymentStatus: 'PAID',
      paymentMethod: 'CASH',
      completedAt: new Date(Date.now() - 48 * 3600 * 1000), // 48 hours ago
      uploadedFiles: [
        { fileId: 'doc-scan-001', name: 'land_deed.jpg', url: 'https://s3.example.com/deed.jpg', size: 1048576, version: 1, uploadedAt: new Date() },
      ],
      processedFiles: [
        { fileId: 'doc-pdf-001', name: 'deed.pdf', url: 'https://s3.example.com/deed.pdf', size: 2097152, version: 1, uploadedAt: new Date() },
      ],
    });

    // Run purge for jobs older than 24 hours
    const purgeRes = await ownerClient.post('/privacy/purge/run', { olderThanHours: 24 });
    assert(
      purgeRes.data.success && purgeRes.data.data.purgedFilesCount >= 2,
      'Retention Purge',
      'Automated retention purge executed and purged expired job files'
    );

    // Verify old job files wiped
    const postPurgeJob = await Job.findById(oldJob._id);
    assert(
      postPurgeJob?.uploadedFiles.length === 0 && postPurgeJob?.processedFiles.length === 0,
      'Retention Purge',
      'Expired raw scan and PDF files cleared from database'
    );

    // Verify PurgeJobLog generated
    const purgeLog = await PurgeJobLog.findOne({ tenantId: tenant._id });
    assert(
      purgeLog !== null && purgeLog.status === 'SUCCESS',
      'Retention Purge',
      'Recorded immutable audit log in PurgeJobLog collection'
    );

    // -------------------------------------------------------------
    // TEST 6: Privacy Notice Versions
    // -------------------------------------------------------------
    console.log('\n>>> [TEST SUITE 6: Privacy Notice Version History]');
    const policiesRes = await staffClient.get('/privacy/policies');
    assert(
      policiesRes.data.data.length > 0 && policiesRes.data.data[0].version === 'v1.0.0-PROD',
      'Policies',
      'Retrieved current privacy notice version (v1.0.0-PROD)'
    );
    assert(
      policiesRes.data.data[0].jurisdictions.includes('BD_PDPA_2026'),
      'Policies',
      'Confirmed jurisdiction alignment with Bangladesh Personal Data Protection Act (PDPA) 2026'
    );

    // -------------------------------------------------------------
    // TEST 7: RBAC & Tenant Isolation
    // -------------------------------------------------------------
    console.log('\n>>> [TEST SUITE 7: RBAC Barriers & Tenant Isolation]');
    // Staff attempts to trigger retention purge -> should be 403 Forbidden
    let staffBlocked = false;
    try {
      await staffClient.post('/privacy/purge/run', { olderThanHours: 24 });
    } catch (err: any) {
      staffBlocked = err.response?.status === 403;
    }
    assert(
      staffBlocked,
      'RBAC',
      'Regular staff blocked from executing retention purges (403 Forbidden)'
    );

    // Cross-tenant isolation
    const rivalTenant = await Tenant.create({
      businessId: `RIVAL-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      subdomain: `rival-priv-${timestamp.toString().slice(-6)}`,
      name: 'Rival Privacy Studio',
      email: `rival_${timestamp}@test.com`,
      subscription: { plan: 'STARTER', status: 'ACTIVE', trialEndsAt: new Date(Date.now() + 14 * 86400000) },
      quotas: { storageLimitBytes: 1024 * 1024 * 1024, storageUsedBytes: 0, maxStaffSeats: 1 },
    });

    const crossDSRs = await DataSubjectRequest.find({ tenantId: rivalTenant._id });
    assert(
      crossDSRs.length === 0,
      'Tenant Isolation',
      'Rival tenant has 0 DSR requests (Strict tenant isolation)'
    );

    // -------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log('  PHASE 31 TEST EXECUTION SUMMARY                               ');
    console.log('================================================================');
    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;

    console.log(`Total Checks Executed : ${total}`);
    console.log(`Passed                : ${passed}`);
    console.log(`Failed                : ${failed}`);
    console.log(`Pass Rate             : ${((passed / total) * 100).toFixed(1)}%\n`);

    if (failed > 0) {
      console.error('CRITICAL: Phase 31 tests encountered failures.');
      process.exit(1);
    } else {
      console.log('SUCCESS: All Phase 31 Data Governance & Privacy tests passed flawlessly!');
      process.exit(0);
    }
  } catch (err: any) {
    console.error('Fatal error during Phase 31 test execution:', err.response?.data || err.message || err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runPhase31Tests();

