import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import mongoose from 'mongoose';
import { db } from '../config/db';
import { Tenant } from '../models/Tenant.model';
import { User } from '../models/User.model';
import { Customer } from '../models/Customer.model';
import { Job } from '../models/Job.model';
import { AuditLog } from '../models/AuditLog.model';
import { TokenService } from '../utils/token';
import { detectMimeType } from '../utils/fileValidator';
import { createDatabaseBackup } from './backup-db';
import { logger } from '../config/logger';

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

async function runPhase23Tests() {
  console.log('\n================================================================');
  console.log('  PHASE 23: ADVANCED SECURITY, PRIVACY & RELIABILITY HARDENING  ');
  console.log('================================================================\n');

  await db.connect();
  console.log('Connected to MongoDB Atlas for security audit...\n');

  try {
    const timestamp = Date.now();

    // 1. Setup Two Distinct Tenants (Tenant A and Tenant B) to test Tenant Isolation & IDOR
    const tenantA = await Tenant.create({
      businessId: `SHOP-A-${timestamp}`,
      subdomain: `shop-a-${timestamp.toString().slice(-5)}`,
      name: `Security Hardened Shop A`,
      ownerEmail: `owner_a_${timestamp}@test.com`,
      subscription: {
        plan: 'PRO',
        status: 'ACTIVE',
        trialEndsAt: new Date(Date.now() + 30 * 86400000),
      },
      quotas: {
        maxStaffSeats: 5,
        monthlyJobsLimit: 500,
        monthlyJobsUsed: 0,
        monthlyPassportLayoutsLimit: 1000,
        monthlyPassportLayoutsUsed: 0,
        monthlyOcrPagesLimit: 100,
        monthlyOcrPagesUsed: 0,
        storageLimitBytes: 10 * 1024 * 1024 * 1024,
        storageUsedBytes: 0,
      },
      isActive: true,
    });

    const tenantB = await Tenant.create({
      businessId: `SHOP-B-${timestamp}`,
      subdomain: `shop-b-${timestamp.toString().slice(-5)}`,
      name: `Security Hardened Shop B`,
      ownerEmail: `owner_b_${timestamp}@test.com`,
      subscription: {
        plan: 'STARTER',
        status: 'ACTIVE',
        trialEndsAt: new Date(Date.now() + 30 * 86400000),
      },
      quotas: {
        maxStaffSeats: 2,
        monthlyJobsLimit: 150,
        monthlyJobsUsed: 0,
        monthlyPassportLayoutsLimit: 300,
        monthlyPassportLayoutsUsed: 0,
        monthlyOcrPagesLimit: 50,
        monthlyOcrPagesUsed: 0,
        storageLimitBytes: 5 * 1024 * 1024 * 1024,
        storageUsedBytes: 0,
      },
      isActive: true,
    });

    // Users for Tenant A
    const ownerA = await User.create({
      tenantId: tenantA._id,
      fullName: 'Owner A User',
      email: `owner_a_${timestamp}@test.com`,
      passwordHash: 'hashed_pw_test',
      role: 'OWNER',
      phone: `01711${timestamp.toString().slice(-6)}`,
      isActive: true,
    });

    const operatorA = await User.create({
      tenantId: tenantA._id,
      fullName: 'Operator A User',
      email: `operator_a_${timestamp}@test.com`,
      passwordHash: 'hashed_pw_test',
      role: 'OPERATOR',
      phone: `01722${timestamp.toString().slice(-6)}`,
      isActive: true,
    });

    // Users for Tenant B
    const ownerB = await User.create({
      tenantId: tenantB._id,
      fullName: 'Owner B User',
      email: `owner_b_${timestamp}@test.com`,
      passwordHash: 'hashed_pw_test',
      role: 'OWNER',
      phone: `01733${timestamp.toString().slice(-6)}`,
      isActive: true,
    });

    // Helper to generate authenticated client
    const createClient = (user: any, tenant: any): AxiosInstance => {
      const token = TokenService.generateAccessToken({
        userId: user._id.toString(),
        tenantId: tenant._id.toString(),
        role: user.role,
        email: user.email,
      });

      return axios.create({
        baseURL: API_BASE,
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tenant-id': tenant._id.toString(),
        },
      });
    };

    const clientOwnerA = createClient(ownerA, tenantA);
    const clientOperatorA = createClient(operatorA, tenantA);
    const clientOwnerB = createClient(ownerB, tenantB);

    // Create a private Customer and Job in Tenant B
    const customerB = await Customer.create({
      tenantId: tenantB._id,
      fullName: 'Secret VIP Customer B',
      phone: `01999${timestamp.toString().slice(-6)}`,
      email: `secret_b_${timestamp}@gmail.com`,
      notes: 'Contains sensitive financial documents',
      isActive: true,
    });

    const jobB = await Job.create({
      tenantId: tenantB._id,
      jobCode: `JOB-B-${timestamp.toString().slice(-4)}`,
      customerId: customerB._id,
      customerName: customerB.fullName,
      customerPhone: customerB.phone,
      serviceType: 'PASSPORT_PHOTO',
      copies: 4,
      totalAmount: 250,
      paidAmount: 250,
      paymentStatus: 'PAID',
    });

    // -------------------------------------------------------------
    // TEST SUITE 1: Tenant Isolation & IDOR Protection
    // -------------------------------------------------------------
    console.log('--- TEST SUITE 1: Tenant Isolation & IDOR Protection ---');

    // 1. Tenant A tries to read Tenant B's customer directly by ID -> Must 404
    let idorCustomerBlocked = false;
    try {
      await clientOwnerA.get(`/customers/${customerB._id}`);
    } catch (err: any) {
      idorCustomerBlocked = true;
      assert(err.response?.status === 404, 'IDOR Protection', 'Access to foreign tenant customer blocked with 404');
    }
    assert(idorCustomerBlocked, 'IDOR Protection', 'Cross-tenant customer IDOR prevented');

    // 2. Tenant A tries to read Tenant B's job directly by ID -> Must 404
    let idorJobBlocked = false;
    try {
      await clientOwnerA.get(`/jobs/${jobB._id}`);
    } catch (err: any) {
      idorJobBlocked = true;
      assert(err.response?.status === 404, 'IDOR Protection', 'Access to foreign tenant job blocked with 404');
    }
    assert(idorJobBlocked, 'IDOR Protection', 'Cross-tenant job IDOR prevented');

    // 3. Tenant A tries to inject targetTenantId in body/query to compromise Tenant B -> Blocked by enforceTenantIsolation
    let crossTenantInjectionBlocked = false;
    try {
      await clientOwnerA.post('/jobs', {
        tenantId: tenantB._id.toString(), // attempted spoofing
        customerName: 'Hacked Order',
        customerPhone: '01700000000',
        serviceType: 'PASSPORT_PHOTO',
      });
    } catch (err: any) {
      crossTenantInjectionBlocked = true;
      assert(err.response?.status === 403, 'Tenant Isolation', 'Cross-tenant parameter injection blocked with 403 Forbidden');
    }
    assert(crossTenantInjectionBlocked, 'Tenant Isolation', 'enforceTenantIsolation middleware caught spoofing attempt');

    // 4. Verify security violation was written to AuditLog
    const violationLog = await AuditLog.findOne({
      tenantId: tenantA._id,
      action: 'SECURITY_CROSS_TENANT_VIOLATION_BLOCKED',
    });
    assert(!!violationLog, 'Tenant Isolation', 'Security violation recorded in AuditLog');
    assert(violationLog?.status === 'BLOCKED', 'Tenant Isolation', 'Violation status marked BLOCKED in audit trail');

    // -------------------------------------------------------------
    // TEST SUITE 2: RBAC (Role-Based Access Control)
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 2: Role-Based Access Control (RBAC) ---');

    // 5. Operator attempts to access Super Admin route -> 403 Forbidden
    let superAdminRouteBlocked = false;
    try {
      await clientOperatorA.get('/subscription/admin/subscriptions');
    } catch (err: any) {
      superAdminRouteBlocked = true;
      assert(err.response?.status === 403, 'RBAC Enforcement', 'Operator blocked from Super Admin route with 403');
    }
    assert(superAdminRouteBlocked, 'RBAC Enforcement', 'Super Admin role required and verified');

    // 6. Operator attempts to update subscription plan -> 403 Forbidden
    let updatePlanBlocked = false;
    try {
      await clientOperatorA.put('/subscription/plans/PRO', {
        monthlyPrice: 500,
      });
    } catch (err: any) {
      updatePlanBlocked = true;
      assert(err.response?.status === 403, 'RBAC Enforcement', 'Operator blocked from editing plans with 403');
    }
    assert(updatePlanBlocked, 'RBAC Enforcement', 'Plan modification role guard enforced');

    // -------------------------------------------------------------
    // TEST SUITE 3: Privacy, Right-to-be-Forgotten & GDPR Purge
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 3: Privacy, GDPR Purge & Right to be Forgotten ---');

    // 7. Create Customer A with sensitive PII and files
    const customerA = await Customer.create({
      tenantId: tenantA._id,
      fullName: 'Monirul Islam Citizen',
      phone: `01788${timestamp.toString().slice(-6)}`,
      email: `monirul_${timestamp}@test.com`,
      address: 'Plot 10, Block C, Banani, Dhaka',
      notes: 'Customer passport copy attached',
      fileLibrary: [
        {
          fileId: `FILE-${timestamp}-1`,
          name: 'NID_Card_Front.jpg',
          url: 'https://storage.docustudio.test/nid-front.jpg',
          addedAt: new Date(),
        },
      ],
      totalOrdersCount: 3,
      totalSpent: 900,
      isActive: true,
    });

    // 8. Operator attempts permanent purge -> 403 Forbidden (Only Owner/SuperAdmin can purge)
    let operatorPurgeBlocked = false;
    try {
      await clientOperatorA.delete(`/customers/${customerA._id}/purge`);
    } catch (err: any) {
      operatorPurgeBlocked = true;
      assert(err.response?.status === 403, 'Privacy Guard', 'Operator blocked from permanent customer purge with 403');
    }
    assert(operatorPurgeBlocked, 'Privacy Guard', 'Customer purge permission strictly enforced');

    // 9. Owner executes GDPR permanent purge -> 200 OK
    const purgeRes = await clientOwnerA.delete(`/customers/${customerA._id}/purge`);
    assert(purgeRes.status === 200, 'Privacy Guard', 'Owner executes GDPR customer purge (200 OK)');
    assert(purgeRes.data.data.status === 'PURGED', 'Privacy Guard', 'Customer status returned as PURGED');

    // 10. Verify PII scrubbing in database
    const purgedInDb = await Customer.findById(customerA._id);
    assert(purgedInDb?.fullName === 'Purged Customer (GDPR)', 'Privacy Guard', 'Full name replaced with anonymized placeholder');
    assert(Boolean(purgedInDb?.phone.startsWith('PURGED-')), 'Privacy Guard', 'Phone number scrubbed and hashed');
    assert(purgedInDb?.email === undefined, 'Privacy Guard', 'Email address cleared');
    assert(Boolean(purgedInDb?.fileLibrary && purgedInDb.fileLibrary.length === 0), 'Privacy Guard', 'Sensitive file library permanently scrubbed');
    assert(purgedInDb?.totalSpent === 900, 'Privacy Guard', 'Financial totals preserved for accounting integrity');

    // 11. Verify purge recorded in AuditLog
    const purgeLog = await AuditLog.findOne({
      tenantId: tenantA._id,
      action: 'CUSTOMER_PERMANENTLY_PURGED',
    });
    assert(!!purgeLog, 'Privacy Guard', 'Permanent purge recorded in AuditLog');

    // -------------------------------------------------------------
    // TEST SUITE 4: File Validation & Magic Bytes Integrity
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 4: File Validation & Magic Bytes Anti-Spoofing ---');

    // 12. Valid JPEG magic bytes detection
    const validJPEGBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const detectedJPEG = detectMimeType(validJPEGBuffer);
    assert(detectedJPEG.mimeType === 'image/jpeg', 'File Security', 'Valid JPEG magic bytes detected');

    // 13. Valid PNG magic bytes detection
    const validPNGBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const detectedPNG = detectMimeType(validPNGBuffer);
    assert(detectedPNG.mimeType === 'image/png', 'File Security', 'Valid PNG magic bytes detected');

    // 14. Disguised Malicious File (EXE / Shell Script renamed as .jpg) -> Must Fail
    const fakeImageBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00', 'binary'); // Windows PE executable header
    let fakeFileRejected = false;
    try {
      detectMimeType(fakeImageBuffer);
    } catch (err: any) {
      fakeFileRejected = true;
      assert(err.message.includes('Unsupported file format'), 'File Security', 'Disguised executable rejected by magic bytes');
    }
    assert(fakeFileRejected, 'File Security', 'Anti-spoofing magic byte verification passed');

    // -------------------------------------------------------------
    // TEST SUITE 5: Reliability & Automated Database Backup/Restore Test
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 5: Automated Backup & Restore Integrity Test ---');

    // 15. Execute Automated Database Backup
    const backupFilePath = await createDatabaseBackup();
    assert(fs.existsSync(backupFilePath), 'Reliability', 'Database backup file created on disk');
    assert(backupFilePath.endsWith('.json.gz'), 'Reliability', 'Backup archive is gzip compressed');

    // 16. Verify Backup File Integrity & Decompression
    const compressedBuffer = fs.readFileSync(backupFilePath);
    assert(compressedBuffer.length > 500, 'Reliability', `Backup archive size verified (${compressedBuffer.length} bytes)`);

    const decompressedJson = zlib.gunzipSync(compressedBuffer).toString('utf-8');
    const parsedBackup = JSON.parse(decompressedJson);

    assert(parsedBackup.version === '1.0.0', 'Reliability', 'Backup version descriptor valid');
    assert(typeof parsedBackup.totalCollections === 'number', 'Reliability', 'totalCollections metadata present');
    assert(typeof parsedBackup.totalDocuments === 'number', 'Reliability', 'totalDocuments metadata present');
    assert(!!parsedBackup.data.tenants, 'Reliability', 'Tenants collection archived in backup');
    assert(!!parsedBackup.data.users, 'Reliability', 'Users collection archived in backup');
    assert(!!parsedBackup.data.jobs, 'Reliability', 'Jobs collection archived in backup');

    // 17. Restore Integrity Simulation (Dry Run / Test Collection Validation)
    // Verify an archived document can be parsed back into schema without data loss
    const archivedTenant = parsedBackup.data.tenants.find((t: any) => t._id === tenantA._id.toString());
    assert(!!archivedTenant, 'Reliability', 'Target tenant document verified in archive');
    assert(archivedTenant.businessId === tenantA.businessId, 'Reliability', 'Tenant businessId exact match in restore payload');

    // -------------------------------------------------------------
    // TEST SUITE 6: System Health Check & Connection Monitoring
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 6: System Health Check & Monitoring ---');

    // 18. API Health Check Endpoint
    const healthRes = await axios.get(`${API_BASE}/health`);
    assert(healthRes.status === 200, 'Monitoring', 'Health check endpoint returns 200 OK');
    assert(healthRes.data.data.status === 'UP', 'Monitoring', 'System status reported as UP');
    assert(healthRes.data.data.database.connected === true, 'Monitoring', 'Database connectivity reported as CONNECTED');
    assert(typeof healthRes.data.data.uptimeSeconds === 'number', 'Monitoring', 'Server uptime metric provided');

    // Cleanup test artifacts
    console.log('\nCleaning up test security artifacts...');
    await Job.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } });
    await Customer.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } });
    await AuditLog.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } });
    await User.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } });
    await Tenant.deleteMany({ _id: { $in: [tenantA._id, tenantB._id] } });

    // Clean up temporary backup file
    if (fs.existsSync(backupFilePath)) {
      fs.unlinkSync(backupFilePath);
      console.log('Temporary backup file pruned.');
    }
    console.log('Cleanup complete.');

  } catch (err: any) {
    console.error('Test run failed with error:', err.response?.data || err.message);
    results.push({
      suite: 'Fatal Runtime Error',
      test: 'Execution Uncaught Exception',
      passed: false,
      error: err.response?.data?.message || err.message,
    });
  } finally {
    await db.disconnect();
  }

  // Summary
  console.log('\n======================================================');
  console.log('                  TEST SUMMARY RESULTS                ');
  console.log('======================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`Total Tests Executed : ${results.length}`);
  console.log(`Passed               : ${passedCount}`);
  console.log(`Failed               : ${failedCount}`);

  if (failedCount > 0) {
    console.log('\nFailed Tests:');
    results.filter((r) => !r.passed).forEach((r) => console.log(`  - [${r.suite}] ${r.test}: ${r.error}`));
    process.exit(1);
  } else {
    console.log('\n🎉 ALL PHASE 23 SECURITY, PRIVACY & RELIABILITY TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  }
}

runPhase23Tests();
