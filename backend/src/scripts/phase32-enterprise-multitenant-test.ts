import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

import axios from 'axios';
import { db } from '../config/db';
import { User } from '../models/User.model';
import { Tenant } from '../models/Tenant.model';
import { TenantContextService } from '../services/tenantContext.service';

const API_BASE = 'http://localhost:5000/api/v1';

let passedChecks = 0;
let totalChecks = 0;

function assert(condition: boolean, message: string) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('\n=============================================================');
  console.log('🚀 PHASE 32: ENTERPRISE MULTI-TENANT SAAS ARCHITECTURE TEST');
  console.log('=============================================================\n');

  await db.connect();

  const stamp = Date.now().toString(36);

  // 1. Register Primary Enterprise Shop Tenant
  console.log('▶ TEST GROUP 1: Tenant Provisioning & Identity Context');
  const tenant1Subdomain = `ent-alpha-${stamp}`;
  const reg1Res = await axios.post(`${API_BASE}/auth/register-shop`, {
    shopName: 'Alpha Enterprise Studio Group',
    subdomain: tenant1Subdomain,
    ownerName: 'Alpha Managing Director',
    email: `director-${stamp}@alpha-ent.com`,
    password: 'Password123!',
    phone: '01711000001',
    plan: 'ENTERPRISE',
  });
  assert(reg1Res.status === 201, 'Primary enterprise tenant registered successfully');
  const token1 = reg1Res.data.data.tokens.accessToken;
  const tenant1Id = reg1Res.data.data.tenant.id;
  const business1Id = reg1Res.data.data.tenant.businessId;

  // 2. Register Secondary Rival Shop Tenant (for cross-tenant tests)
  const tenant2Subdomain = `ent-beta-${stamp}`;
  const reg2Res = await axios.post(`${API_BASE}/auth/register-shop`, {
    shopName: 'Beta Photocopy Center',
    subdomain: tenant2Subdomain,
    ownerName: 'Beta Shop Owner',
    email: `owner-${stamp}@beta-shop.com`,
    password: 'Password123!',
    phone: '01711000002',
    plan: 'STARTER',
  });
  assert(reg2Res.status === 201, 'Secondary rival tenant registered successfully');
  const token2 = reg2Res.data.data.tokens.accessToken;
  const tenant2Id = reg2Res.data.data.tenant.id;

  // 3. Register Super Admin for Administrative Controls
  const superAdminEmail = `superadmin-${stamp}@docustudio.app`;
  const superReg = await axios.post(`${API_BASE}/auth/register-shop`, {
    shopName: 'DocuStudio HQ',
    subdomain: `hq-${stamp}`,
    ownerName: 'Super Administrator',
    email: superAdminEmail,
    password: 'Password123!',
    phone: '01711000099',
    plan: 'ENTERPRISE',
  });
  // Manually elevate to SUPER_ADMIN in MongoDB directly
  await User.updateOne({ email: superAdminEmail }, { role: 'SUPER_ADMIN' });
  const superLogin = await axios.post(`${API_BASE}/auth/login`, {
    email: superAdminEmail,
    password: 'Password123!',
  });
  const superToken = superLogin.data.data.tokens.accessToken;
  assert(superLogin.data.data.user.role === 'SUPER_ADMIN', 'Super Admin privileges verified');

  // 4. Test AsyncLocalStorage Tenant Context
  console.log('\n▶ TEST GROUP 2: AsyncLocalStorage Context Propagation');
  await TenantContextService.run(
    { tenantId: tenant1Id, businessId: business1Id, plan: 'ENTERPRISE', userId: 'usr-123' },
    async () => {
      const activeCtx = TenantContextService.getContext();
      assert(activeCtx?.tenantId === tenant1Id, 'AsyncLocalStorage context correctly retrieved inside execution fiber');
      assert(activeCtx?.businessId === business1Id, 'BusinessId correctly scoped in fiber');
      assert(TenantContextService.isEnterprise() === true, 'isEnterprise() returns true for ENTERPRISE context');
      assert(TenantContextService.getRequiredTenantId() === tenant1Id, 'getRequiredTenantId() returns active tenantId');
    }
  );

  // 5. Test Cross-Tenant Data Access & IDOR Block
  console.log('\n▶ TEST GROUP 3: Cross-Tenant Data Access & IDOR Protection');
  try {
    await axios.post(
      `${API_BASE}/enterprise/branches`,
      {
        action: 'ADD',
        branchData: { name: 'Rival Branch', code: 'RIV' },
        tenantId: tenant2Id, // Attempting to inject rival tenantId in payload!
      },
      { headers: { Authorization: `Bearer ${token1}` } }
    );
    assert(false, 'Should have blocked cross-tenant injection');
  } catch (err: any) {
    assert(err.response?.status === 403, 'Cross-tenant payload manipulation blocked with 403 Forbidden');
    assert(
      err.response?.data?.message?.includes('Cross-tenant'),
      'Detailed cross-tenant security error message returned'
    );
  }

  // Also test x-target-tenant header breach attempt
  try {
    await axios.get(`${API_BASE}/enterprise/metering`, {
      headers: {
        Authorization: `Bearer ${token1}`,
        'x-target-tenant': tenant2Id,
      },
    });
    assert(false, 'Should have blocked header-based cross-tenant attempt');
  } catch (err: any) {
    assert(err.response?.status === 403, 'Header-based cross-tenant attack blocked with 403 Forbidden');
  }

  // 6. Test Enterprise Custom Branding & White-Label
  console.log('\n▶ TEST GROUP 4: Enterprise Custom Branding & White-Label');
  const brandingRes = await axios.patch(
    `${API_BASE}/enterprise/branding`,
    {
      primaryColor: '#4f46e5',
      accentColor: '#1e1b4b',
      customLogoUrl: 'https://cdn.alpha-ent.com/assets/logo.png',
      customFaviconUrl: 'https://cdn.alpha-ent.com/assets/favicon.ico',
      whiteLabel: true,
    },
    { headers: { Authorization: `Bearer ${token1}` } }
  );
  assert(brandingRes.status === 200, 'Enterprise branding updated successfully');
  assert(brandingRes.data.data.primaryColor === '#4f46e5', 'Primary brand color persisted');
  assert(brandingRes.data.data.whiteLabel === true, 'White-label flag activated');

  // 7. Test Custom Domain Configuration & DNS Verification
  console.log('\n▶ TEST GROUP 5: Custom Domain Lifecycle');
  const customDomain = `studio-${stamp}.alpha-group.com`;
  const domainConfigRes = await axios.post(
    `${API_BASE}/enterprise/custom-domain`,
    { customDomain },
    { headers: { Authorization: `Bearer ${token1}` } }
  );
  assert(domainConfigRes.status === 200, 'Custom domain configured');
  assert(domainConfigRes.data.data.verified === false, 'New custom domain starts unverified');
  assert(
    domainConfigRes.data.data.verificationTarget === 'cname.docustudio.app',
    'DNS CNAME target provided'
  );

  const domainVerifyRes = await axios.post(
    `${API_BASE}/enterprise/custom-domain/verify`,
    {},
    { headers: { Authorization: `Bearer ${token1}` } }
  );
  assert(domainVerifyRes.status === 200, 'Custom domain verified');
  assert(domainVerifyRes.data.data.verified === true, 'Domain active status confirmed');

  // 8. Test Multi-Branch Hierarchy
  console.log('\n▶ TEST GROUP 6: Multi-Branch Management');
  const addBranchRes = await axios.post(
    `${API_BASE}/enterprise/branches`,
    {
      action: 'ADD',
      branchData: {
        name: 'Gulshan 2 Hub',
        code: 'GLS',
        address: 'Road 11, Block D, Gulshan 2, Dhaka',
        phone: '01711999888',
      },
    },
    { headers: { Authorization: `Bearer ${token1}` } }
  );
  assert(addBranchRes.status === 200, 'Multi-tenant branch added successfully');
  assert(addBranchRes.data.data.branches.length === 1, 'Branch count is 1');
  const branchId = addBranchRes.data.data.branches[0].branchId;
  assert(branchId.startsWith('BR-'), 'Branch ID format valid');

  // Update Branch
  const updateBranchRes = await axios.post(
    `${API_BASE}/enterprise/branches`,
    {
      action: 'UPDATE',
      branchData: {
        branchId,
        name: 'Gulshan 2 Flagship Mega Studio',
        code: 'GLS-MEGA',
      },
    },
    { headers: { Authorization: `Bearer ${token1}` } }
  );
  assert(
    updateBranchRes.data.data.branches[0].name === 'Gulshan 2 Flagship Mega Studio',
    'Branch name updated'
  );

  // 9. Test Dedicated AWS S3 Storage Isolation
  console.log('\n▶ TEST GROUP 7: Dedicated Storage Configuration');
  const storageRes = await axios.post(
    `${API_BASE}/enterprise/storage/dedicated`,
    {
      enabled: true,
      s3BucketName: `docustudio-ent-alpha-${stamp}`,
      s3Region: 'ap-southeast-1',
    },
    { headers: { Authorization: `Bearer ${token1}` } }
  );
  assert(storageRes.status === 200, 'Dedicated storage configured');
  assert(storageRes.data.data.enabled === true, 'Dedicated storage enabled');
  assert(storageRes.data.data.s3BucketName === `docustudio-ent-alpha-${stamp}`, 'S3 bucket name persisted');

  // 10. Test Real-Time Usage Metering
  console.log('\n▶ TEST GROUP 8: Tenant Usage Metering');
  const meterRes = await axios.get(`${API_BASE}/enterprise/metering`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  assert(meterRes.status === 200, 'Metering data retrieved successfully');
  assert(meterRes.data.data.businessId === business1Id, 'Metering correctly scoped to tenant');
  assert(typeof meterRes.data.data.metrics.apiRequestsTotal === 'number', 'API requests meter tracked');

  // 11. Test Tenant-Aware Rate Limiting & Noisy-Neighbor Shield
  console.log('\n▶ TEST GROUP 9: Tenant Rate Limiting & Noisy-Neighbor Protection');
  // Configure tight rate limit on Tenant 2 for deterministic test
  await Tenant.findByIdAndUpdate(tenant2Id, {
    'enterpriseConfig.rateLimits': { requestsPerMinute: 60, burstLimit: 3 },
  });

  let rateLimited = false;
  // Rapid fire 6 requests to exhaust burst limit of 3
  for (let i = 0; i < 6; i++) {
    try {
      await axios.get(`${API_BASE}/enterprise/metering`, {
        headers: { Authorization: `Bearer ${token2}` },
      });
    } catch (err: any) {
      if (err.response?.status === 429) {
        rateLimited = true;
        assert(
          err.response.data.errorCode === 'TENANT_RATE_LIMIT_EXCEEDED',
          'ErrorCode is TENANT_RATE_LIMIT_EXCEEDED'
        );
        break;
      }
    }
  }
  assert(rateLimited, 'Noisy-Neighbor Shield rate-limited aggressive tenant with 429');

  // Crucial: Verify that quiet Tenant 1 is NOT blocked while Tenant 2 is rate-limited!
  const quietTenantRes = await axios.get(`${API_BASE}/enterprise/metering`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  assert(
    quietTenantRes.status === 200,
    'Noisy-Neighbor Isolation verified: Neighbor tenant unaffected by burst limit'
  );

  // 12. Test Administrative Suspension & Recovery
  console.log('\n▶ TEST GROUP 10: Administrative Suspension & Recovery');
  const suspendRes = await axios.post(
    `${API_BASE}/enterprise/suspend`,
    {
      tenantId: tenant2Id,
      reason: 'Delinquent subscription invoice over 30 days',
    },
    { headers: { Authorization: `Bearer ${superToken}` } }
  );
  assert(suspendRes.status === 200, 'Super admin suspended tenant');
  assert(suspendRes.data.data.status === 'SUSPENDED', 'Tenant status set to SUSPENDED');

  // Verify that suspended tenant is blocked from operational APIs
  try {
    await axios.get(`${API_BASE}/enterprise/metering`, {
      headers: { Authorization: `Bearer ${token2}` },
    });
    assert(false, 'Suspended tenant should have been blocked');
  } catch (err: any) {
    assert(err.response?.status === 403, 'Suspended tenant blocked with 403 Forbidden');
    assert(
      err.response?.data?.message?.includes('suspended'),
      'Suspension message returned to tenant'
    );
  }

  // Recover tenant
  const recoverRes = await axios.post(
    `${API_BASE}/enterprise/recover`,
    { tenantId: tenant2Id },
    { headers: { Authorization: `Bearer ${superToken}` } }
  );
  assert(recoverRes.status === 200, 'Super admin recovered tenant');
  assert(recoverRes.data.data.status === 'ACTIVE', 'Tenant status restored to ACTIVE');

  // Verify access restored
  const postRecoverRes = await axios.get(`${API_BASE}/enterprise/metering`, {
    headers: { Authorization: `Bearer ${token2}` },
  });
  assert(postRecoverRes.status === 200, 'Restored tenant resumes operational access');

  // 13. Test Comprehensive Tenant Data Export (Offboarding)
  console.log('\n▶ TEST GROUP 11: Tenant Export & Offboarding Package');
  const exportRes = await axios.get(`${API_BASE}/enterprise/export`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  assert(exportRes.status === 200, 'Export package generated');
  assert(Boolean(exportRes.data.data.checksumSha256), 'SHA-256 package checksum included');
  assert(exportRes.data.data.bundle.tenant.businessId === business1Id, 'Exported tenant matches authenticated tenant');
  assert(Array.isArray(exportRes.data.data.bundle.data.users), 'Exported bundle includes user entities');
  assert(Array.isArray(exportRes.data.data.bundle.data.auditLogs), 'Exported bundle includes audit history');

  // 14. Test Immutable Tenant Audit Trail
  console.log('\n▶ TEST GROUP 12: Immutable Tenant Audit History');
  const auditRes = await axios.get(`${API_BASE}/enterprise/audit-logs`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  assert(auditRes.status === 200, 'Audit history retrieved');
  assert(auditRes.data.data.logs.length > 0, 'Audit records populated for previous actions');
  const hasBrandingAudit = auditRes.data.data.logs.some(
    (l: any) => l.action === 'ENTERPRISE_BRANDING_UPDATED'
  );
  assert(hasBrandingAudit, 'Branding update captured in audit trail');

  console.log('\n=============================================================');
  console.log(`🎉 ALL PHASE 32 TESTS PASSED! (${passedChecks} / ${totalChecks} checks)`);
  console.log('=============================================================\n');

  await db.disconnect();
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUN ENCOUNTERED FATAL ERROR:', err.message);
  if (err.response?.data) {
    console.error('Response Data:', JSON.stringify(err.response.data, null, 2));
  }
  process.exit(1);
});
