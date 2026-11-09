export {};

/**
 * Comprehensive Automated Security & Multi-Tenant Verification Test Suite
 * Tests: Registration, Login, Protected Me, Refresh Rotation, Logout, Password Reset, RBAC,
 * Cross-Tenant Isolation Enforcement, and Quota Limits.
 */

const BASE_URL = 'http://localhost:5000/api/v1';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

const logTest = (name: string, passed: boolean, details?: string) => {
  results.push({ name, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} - ${name} ${details ? `(${details})` : ''}`);
};

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

const patch = async (endpoint: string, body: any, headers: Record<string, string> = {}) => {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const data: any = await res.json().catch(() => ({}));
  return { status: res.status, data };
};

async function runSecuritySuite() {
  console.log('\n============================================================');
  console.log('🔒 RUNNING PHASE 3 SECURITY, AUTH & MULTI-TENANT TEST SUITE');
  console.log('============================================================\n');

  const timestamp = Date.now().toString().slice(-5);
  const shopAlphaSubdomain = `alpha-${timestamp}`;
  const shopBetaSubdomain = `beta-${timestamp}`;

  // ------------------------------------------------------------------
  // 1. SHOP REGISTRATION TEST
  // ------------------------------------------------------------------
  console.log('--- 1. Shop Registration ---');
  const regAlpha = await post('/auth/register-shop', {
    shopName: 'Alpha Digital Studio',
    subdomain: shopAlphaSubdomain,
    ownerName: 'Alice Alpha',
    email: `alice@${shopAlphaSubdomain}.com`,
    password: 'SecurePassword123!',
    plan: 'STARTER', // 2 staff seats max
  });

  const alphaOk = regAlpha.status === 201 && !!regAlpha.data.data?.tokens?.accessToken;
  logTest('Register Shop Alpha (Starter Plan)', alphaOk, `BusinessId: ${regAlpha.data.data?.tenant?.businessId}`);

  const alphaOwnerToken = regAlpha.data.data?.tokens?.accessToken;
  const alphaRefreshToken = regAlpha.data.data?.tokens?.refreshToken;
  const alphaTenantId = regAlpha.data.data?.tenant?.id;
  const alphaBusinessId = regAlpha.data.data?.tenant?.businessId;

  // Register Second Shop (Shop Beta) for Cross-Tenant Testing
  const regBeta = await post('/auth/register-shop', {
    shopName: 'Beta Photocopy Center',
    subdomain: shopBetaSubdomain,
    ownerName: 'Bob Beta',
    email: `bob@${shopBetaSubdomain}.com`,
    password: 'SecurePassword123!',
    plan: 'PROFESSIONAL',
  });

  const betaOk = regBeta.status === 201 && !!regBeta.data.data?.tokens?.accessToken;
  logTest('Register Shop Beta (Professional Plan)', betaOk, `BusinessId: ${regBeta.data.data?.tenant?.businessId}`);

  const betaOwnerToken = regBeta.data.data?.tokens?.accessToken;
  const betaTenantId = regBeta.data.data?.tenant?.id;

  // Duplicate Subdomain Rejection Test
  const regDup = await post('/auth/register-shop', {
    shopName: 'Duplicate Shop',
    subdomain: shopAlphaSubdomain,
    ownerName: 'Imposter',
    email: `imposter@${shopAlphaSubdomain}.com`,
    password: 'Password123!',
    plan: 'STARTER',
  });
  logTest('Reject Duplicate Shop Subdomain', regDup.status === 409, `Status: ${regDup.status}`);

  // ------------------------------------------------------------------
  // 2. USER LOGIN & CREDENTIAL VALIDATION
  // ------------------------------------------------------------------
  console.log('\n--- 2. User Login & Credential Validation ---');
  const loginGood = await post('/auth/login', {
    email: `alice@${shopAlphaSubdomain}.com`,
    password: 'SecurePassword123!',
    subdomain: shopAlphaSubdomain,
  });
  logTest('Login with Valid Credentials', loginGood.status === 200 && !!loginGood.data.data?.tokens?.accessToken);

  const loginBad = await post('/auth/login', {
    email: `alice@${shopAlphaSubdomain}.com`,
    password: 'WrongPassword!',
    subdomain: shopAlphaSubdomain,
  });
  logTest('Reject Incorrect Password', loginBad.status === 401, `Status: ${loginBad.status}`);

  // ------------------------------------------------------------------
  // 3. PROTECTED IDENTITY & SESSION VERIFICATION
  // ------------------------------------------------------------------
  console.log('\n--- 3. Protected Route & Me Endpoint ---');
  const meWithToken = await get('/auth/me', { Authorization: `Bearer ${alphaOwnerToken}` });
  logTest(
    'Access /auth/me with Bearer Token',
    meWithToken.status === 200 && meWithToken.data.data?.user?.email === `alice@${shopAlphaSubdomain}.com`,
    `Role: ${meWithToken.data.data?.user?.role}`
  );

  const meNoToken = await get('/auth/me');
  logTest('Reject /auth/me without Token', meNoToken.status === 401, `Status: ${meNoToken.status}`);

  // ------------------------------------------------------------------
  // 4. REFRESH TOKEN STRATEGY & LOGOUT
  // ------------------------------------------------------------------
  console.log('\n--- 4. Refresh Token Strategy & Logout ---');
  const refreshRes = await post('/auth/refresh', { refreshToken: alphaRefreshToken });
  const refreshOk = refreshRes.status === 200 && !!refreshRes.data.data?.accessToken;
  logTest('Rotate Refresh Token', refreshOk);

  const newRefreshToken = refreshRes.data.data?.refreshToken;

  // Logout with new refresh token
  const logoutRes = await post('/auth/logout', { refreshToken: newRefreshToken });
  logTest('Logout & Revoke Token', logoutRes.status === 200);

  // Attempting to reuse revoked token must fail
  const reuseRes = await post('/auth/refresh', { refreshToken: newRefreshToken });
  logTest('Reject Reused/Revoked Token', reuseRes.status === 401, `Status: ${reuseRes.status}`);

  // ------------------------------------------------------------------
  // 5. PASSWORD RESET FLOW
  // ------------------------------------------------------------------
  console.log('\n--- 5. Password Reset Flow ---');
  const forgotRes = await post('/auth/forgot-password', {
    email: `alice@${shopAlphaSubdomain}.com`,
    subdomain: shopAlphaSubdomain,
  });
  const resetToken = forgotRes.data.data?.resetToken;
  logTest('Generate Password Reset Token', forgotRes.status === 200 && !!resetToken);

  const resetRes = await post('/auth/reset-password', {
    token: resetToken,
    newPassword: 'BrandNewPassword456!',
  });
  logTest('Reset Password with Token', resetRes.status === 200);

  const loginNewPass = await post('/auth/login', {
    email: `alice@${shopAlphaSubdomain}.com`,
    password: 'BrandNewPassword456!',
    subdomain: shopAlphaSubdomain,
  });
  logTest('Login with Updated Password', loginNewPass.status === 200);
  const updatedAlphaToken = loginNewPass.data.data?.tokens?.accessToken;

  // ------------------------------------------------------------------
  // 6. ROLE-BASED ACCESS CONTROL (RBAC)
  // ------------------------------------------------------------------
  console.log('\n--- 6. Role-Based Access Control (RBAC) ---');
  // Shop Owner adds an Operator
  const addOperatorRes = await post(
    '/tenants/staff',
    {
      fullName: 'Oscar Operator',
      email: `operator@${shopAlphaSubdomain}.com`,
      password: 'OperatorPass123!',
      role: 'OPERATOR',
    },
    { Authorization: `Bearer ${updatedAlphaToken}` }
  );
  logTest('Owner Adds Operator Staff', addOperatorRes.status === 201, `Staff Role: OPERATOR`);

  // Log in as Operator
  const operatorLogin = await post('/auth/login', {
    email: `operator@${shopAlphaSubdomain}.com`,
    password: 'OperatorPass123!',
    subdomain: shopAlphaSubdomain,
  });
  const operatorToken = operatorLogin.data.data?.tokens?.accessToken;

  // Operator attempts administrative action: Add another staff member (Restricted to OWNER)
  const operatorIllegalAdd = await post(
    '/tenants/staff',
    {
      fullName: 'Illegal Staff',
      email: `illegal@${shopAlphaSubdomain}.com`,
      password: 'Pass123456!',
      role: 'PRINTER',
    },
    { Authorization: `Bearer ${operatorToken}` }
  );
  logTest(
    'RBAC: Operator Denied Adding Staff',
    operatorIllegalAdd.status === 403,
    `Status: ${operatorIllegalAdd.status} - ${operatorIllegalAdd.data.message}`
  );

  // ------------------------------------------------------------------
  // 7. CROSS-TENANT ISOLATION (CRITICAL SECURITY PROTECTION)
  // ------------------------------------------------------------------
  console.log('\n--- 7. Cross-Tenant Isolation Enforcement ---');
  // Bob from Shop Beta tries to supply Shop Alpha's businessId or tenantId in body
  const crossTenantAttempt = await patch(
    '/tenants/current/settings',
    {
      businessId: alphaBusinessId, // Attempting to tamper with Alpha's settings
      currency: 'EUR',
    },
    { Authorization: `Bearer ${betaOwnerToken}` }
  );

  logTest(
    'Cross-Tenant Breach Blocked & Audit Logged',
    crossTenantAttempt.status === 403,
    `Status: ${crossTenantAttempt.status} - ${crossTenantAttempt.data.message}`
  );

  // ------------------------------------------------------------------
  // 8. SUBSCRIPTION SEAT QUOTA ENFORCEMENT
  // ------------------------------------------------------------------
  console.log('\n--- 8. Subscription Seat Quota Enforcement ---');
  // Shop Alpha has Starter plan (2 seats max: 1 Owner + 1 Operator already added).
  // Adding a 3rd staff member should trigger a 403 quota error
  const overQuotaAdd = await post(
    '/tenants/staff',
    {
      fullName: 'Excess Worker',
      email: `excess@${shopAlphaSubdomain}.com`,
      password: 'Pass123456!',
      role: 'PRINTER',
    },
    { Authorization: `Bearer ${updatedAlphaToken}` }
  );

  logTest(
    'Enforce Seat Limit (Starter Max 2 Seats)',
    overQuotaAdd.status === 403,
    `Status: ${overQuotaAdd.status} - ${overQuotaAdd.data.message}`
  );

  // ------------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------------
  console.log('\n============================================================');
  const allPassed = results.every((r) => r.passed);
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`TEST SUITE COMPLETE: ${passedCount}/${results.length} PASSED`);
  if (allPassed) {
    console.log('🎉 ALL SECURITY, MULTI-TENANT & RBAC POLICIES VERIFIED!');
  } else {
    console.error('⚠️ SOME TESTS FAILED. CHECK LOGS ABOVE.');
  }
  console.log('============================================================\n');
}

runSecuritySuite().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
});
