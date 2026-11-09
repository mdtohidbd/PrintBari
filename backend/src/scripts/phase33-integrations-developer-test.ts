import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

import http from 'http';
import axios from 'axios';
import crypto from 'crypto';
import { db } from '../config/db';
import { ApiKey, WebhookSubscription, TenantIntegrationConfig } from '../models/Integration.model';
import { WebhookDispatcherService } from '../services/webhookDispatcher.service';
import { DeveloperService } from '../modules/developer/developer.service';

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
  console.log('🚀 PHASE 33: THIRD-PARTY INTEGRATIONS & DEVELOPER PLATFORM');
  console.log('=============================================================\n');

  await db.connect();

  const stamp = Date.now().toString(36);

  // 1. Setup Tenant & Auth
  console.log('▶ TEST GROUP 1: Tenant Provisioning & Auth Token');
  const regRes = await axios.post(`${API_BASE}/auth/register-shop`, {
    shopName: 'Integration Developer Studio',
    subdomain: `dev-studio-${stamp}`,
    ownerName: 'Integration Lead',
    email: `dev-${stamp}@integration-test.com`,
    password: 'Password123!',
    phone: '01719999001',
    plan: 'ENTERPRISE',
  });
  assert(regRes.status === 201, 'Tenant registered for developer platform');
  const token = regRes.data.data.tokens.accessToken;
  const tenantId = regRes.data.data.tenant.id;

  // 2. API Key Management (Create, List, Hash Verification)
  console.log('\n▶ TEST GROUP 2: API Key Generation & Cryptographic Hashing');
  const createKeyRes = await axios.post(
    `${API_BASE}/developer/keys`,
    {
      name: 'Mobile POS Integration Key',
      scopes: ['jobs:read', 'jobs:write', 'customers:read', 'customers:write'],
      rateLimitRpm: 500,
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  assert(createKeyRes.status === 201, 'API key created successfully');
  const rawApiKey = createKeyRes.data.data.rawKey;
  const apiKeyId = createKeyRes.data.data.apiKey.id;
  assert(rawApiKey.startsWith('dcu_live_'), 'Raw key has proper dcu_live_ prefix');
  assert(Boolean(createKeyRes.data.data.warning), 'Warning returned to store raw key securely');

  // Verify hash in database
  const dbKey = await ApiKey.findById(apiKeyId);
  assert(Boolean(dbKey), 'API Key record found in database');
  const expectedHash = crypto.createHash('sha256').update(rawApiKey).digest('hex');
  assert(dbKey?.keyHash === expectedHash, 'Key stored as SHA-256 hash (never plain text)');

  // List keys (verify keyHash is never exposed in response)
  const listKeysRes = await axios.get(`${API_BASE}/developer/keys`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(listKeysRes.status === 200, 'API keys listed successfully');
  assert(listKeysRes.data.data.keys.length >= 1, 'Key list contains created key');
  assert(listKeysRes.data.data.keys[0].keyHash === undefined, 'Raw keyHash is masked from API responses');

  // 3. Public Developer REST API (x-api-key & Bearer auth)
  console.log('\n▶ TEST GROUP 3: Public Developer REST API Ingestion');
  // Query jobs via x-api-key header
  const pubJobsRes = await axios.get(`${API_BASE}/public/jobs`, {
    headers: { 'x-api-key': rawApiKey },
  });
  assert(pubJobsRes.status === 200, 'Public API jobs queried with x-api-key');
  assert(Array.isArray(pubJobsRes.data.data.jobs), 'Jobs array returned');

  // Create customer via public API using Authorization Bearer dcu_live_...
  const pubCustomerRes = await axios.post(
    `${API_BASE}/public/customers`,
    {
      name: 'Rahim Uddin',
      phone: `01811${Math.floor(100000 + Math.random() * 900000)}`,
      email: 'rahim@citizen.bd',
      notes: 'Created via Public Developer API',
    },
    { headers: { Authorization: `Bearer ${rawApiKey}` } }
  );
  assert(pubCustomerRes.status === 201, 'Customer created via Public API with Bearer token');
  const createdCustomerId = pubCustomerRes.data.data._id;
  assert(Boolean(createdCustomerId), 'Created customer has database ID');

  // Create job via public API
  const pubCreateJobRes = await axios.post(
    `${API_BASE}/public/jobs`,
    {
      serviceType: 'PASSPORT_PHOTO',
      customerName: 'Rahim Uddin',
      customerPhone: pubCustomerRes.data.data.phone,
      totalAmount: 250,
      notes: 'Urgent biometric 35x45 Schengen visa photo',
    },
    { headers: { 'x-api-key': rawApiKey } }
  );
  assert(pubCreateJobRes.status === 201, 'Job created via Public API');
  const createdJobCode = pubCreateJobRes.data.data.jobCode;
  assert(createdJobCode.startsWith('JOB-'), 'Job code generated successfully');

  // Retrieve single job by code
  const getJobRes = await axios.get(`${API_BASE}/public/jobs/${createdJobCode}`, {
    headers: { 'x-api-key': rawApiKey },
  });
  assert(getJobRes.status === 200, 'Single job retrieved by jobCode');
  assert(getJobRes.data.data.jobCode === createdJobCode, 'Job details match requested jobCode');

  // 4. API Scope Enforcement & Privilege Boundaries
  console.log('\n▶ TEST GROUP 4: API Scope Authorization Enforcement');
  // Attempt to call finance endpoint without 'finance:read' scope
  try {
    await axios.get(`${API_BASE}/public/finance/transactions`, {
      headers: { 'x-api-key': rawApiKey },
    });
    assert(false, 'Should have blocked access due to missing finance:read scope');
  } catch (err: any) {
    assert(err.response?.status === 403, 'Missing scope blocked with 403 Forbidden');
    assert(
      err.response?.data?.message?.includes('Insufficient API Key scopes'),
      'Detailed scope error message returned'
    );
  }

  // 5. API Key Rotation & Revocation
  console.log('\n▶ TEST GROUP 5: API Key Rotation and Revocation');
  const rotateRes = await axios.post(
    `${API_BASE}/developer/keys/${apiKeyId}/rotate`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  assert(rotateRes.status === 200, 'API key rotated');
  const rotatedRawKey = rotateRes.data.data.rawKey;
  assert(rotatedRawKey !== rawApiKey, 'Rotated key has distinct secret from previous key');

  // Old key should now be rejected (deactivated)
  try {
    await axios.get(`${API_BASE}/public/jobs`, {
      headers: { 'x-api-key': rawApiKey },
    });
    assert(false, 'Old rotated key should be rejected');
  } catch (err: any) {
    assert(err.response?.status === 401, 'Old rotated key blocked with 401 Unauthorized');
  }

  // New rotated key should work
  const newKeyRes = await axios.get(`${API_BASE}/public/jobs`, {
    headers: { 'x-api-key': rotatedRawKey },
  });
  assert(newKeyRes.status === 200, 'New rotated key authenticates successfully');

  // Revoke the new key
  const newKeyId = rotateRes.data.data.apiKey.id;
  const revokeRes = await axios.delete(`${API_BASE}/developer/keys/${newKeyId}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { reason: 'Decommissioning integration' },
  });
  assert(revokeRes.status === 200, 'Key revoked successfully');

  try {
    await axios.get(`${API_BASE}/public/jobs`, {
      headers: { 'x-api-key': rotatedRawKey },
    });
    assert(false, 'Revoked key should be rejected');
  } catch (err: any) {
    assert(err.response?.status === 401, 'Revoked key blocked with 401 Unauthorized');
  }

  // 6. Webhook Subscriptions & HMAC Signature Verification
  console.log('\n▶ TEST GROUP 6: Webhook Subscriptions & HMAC-SHA256 Signing');
  const webhookUrl = 'http://localhost:5999/webhook';
  const subRes = await axios.post(
    `${API_BASE}/developer/webhooks`,
    {
      targetUrl: webhookUrl,
      subscribedEvents: ['job.created', 'job.completed', 'payment.received', 'integration.alert'],
      description: 'Studio POS Webhook Receiver',
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  assert(subRes.status === 201, 'Webhook subscription created');
  const subId = subRes.data.data._id;
  const webhookSecret = subRes.data.data.secret;
  assert(webhookSecret.startsWith('whsec_'), 'Webhook secret format valid (whsec_...)');

  // Verify HMAC-SHA256 signature generation and timing-safe verification
  const samplePayload = JSON.stringify({ id: 'evt_123', type: 'job.created', status: 'PENDING' });
  const validSignature = WebhookDispatcherService.generateSignature(samplePayload, webhookSecret);
  assert(validSignature.includes('t=') && validSignature.includes('v1='), 'Signature header formatted t=...,v1=...');

  const isValid = WebhookDispatcherService.verifySignature(samplePayload, validSignature, webhookSecret);
  assert(isValid === true, 'WebhookDispatcherService.verifySignature accepts authentic signature');

  // Verify tampered payload fails
  const tamperedPayload = JSON.stringify({ id: 'evt_123', type: 'job.created', status: 'COMPLETED' });
  const isTamperedValid = WebhookDispatcherService.verifySignature(tamperedPayload, validSignature, webhookSecret);
  assert(isTamperedValid === false, 'Tampered payload rejected by HMAC verification');

  // Verify expired timestamp fails replay protection
  const staleTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
  const staleSignature = WebhookDispatcherService.generateSignature(samplePayload, webhookSecret, staleTimestamp);
  const isStaleValid = WebhookDispatcherService.verifySignature(samplePayload, staleSignature, webhookSecret, 300);
  assert(isStaleValid === false, 'Expired timestamp (>300s) rejected by replay attack protection');

  // 7. Webhook Dispatch & Local HTTP Receiver Test
  console.log('\n▶ TEST GROUP 7: Live Webhook Dispatch & Delivery Logging');
  let receivedWebhookHeaders: any = null;
  let receivedWebhookBody: any = null;

  // Spin up temporary HTTP receiver on port 5999
  const receiverServer = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      receivedWebhookHeaders = req.headers;
      receivedWebhookBody = JSON.parse(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ received: true }));
    });
  });

  await new Promise<void>((resolve) => receiverServer.listen(5999, resolve));

  // Dispatch ping test webhook
  const pingRes = await axios.post(
    `${API_BASE}/developer/webhooks/${subId}/ping`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  assert(pingRes.status === 200, 'Webhook ping test initiated');

  // Wait 500ms for delivery to complete
  await new Promise((r) => setTimeout(r, 600));

  receiverServer.close();

  assert(receivedWebhookHeaders !== null, 'Local receiver captured live webhook request');
  assert(Boolean(receivedWebhookHeaders['x-docustudio-signature']), 'X-DocuStudio-Signature header delivered');
  assert(receivedWebhookHeaders['x-docustudio-event-type'] === 'integration.alert', 'Event type header delivered');
  assert(receivedWebhookBody?.data?.message?.includes('DocuStudio'), 'Webhook event payload body received');

  // Query delivery logs
  const logsRes = await axios.get(`${API_BASE}/developer/webhooks/deliveries?subscriptionId=${subId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(logsRes.status === 200, 'Delivery logs retrieved');
  assert(logsRes.data.data.logs.length >= 1, 'Delivery log record created');
  assert(logsRes.data.data.logs[0].deliveryStatus === 'DELIVERED', 'Delivery status is DELIVERED');
  assert(logsRes.data.data.logs[0].statusCode === 200, 'HTTP 200 response logged');

  // 8. Third-Party Integrations Catalog & Settings
  console.log('\n▶ TEST GROUP 8: Third-Party Integration Catalog & Credential Masking');
  const integrationsRes = await axios.get(`${API_BASE}/developer/integrations`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(integrationsRes.status === 200, 'Integration catalog retrieved');
  assert(integrationsRes.data.data.integrations.length >= 8, 'Catalog includes all 8 core standard providers');

  // Configure bKash Integration
  const bkashConfigRes = await axios.post(
    `${API_BASE}/developer/integrations`,
    {
      category: 'PAYMENT',
      provider: 'BKASH',
      name: 'bKash Merchant Gateway',
      isEnabled: true,
      isCustomCredentials: true,
      credentials: {
        appKey: 'bkash_app_key_secret_12345678',
        appSecret: 'bkash_secret_token_987654321',
      },
      settings: {
        sandbox: true,
        merchantNumber: '01700000000',
      },
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  assert(bkashConfigRes.status === 200, 'bKash integration configured');
  assert(bkashConfigRes.data.data.isEnabled === true, 'bKash enabled');
  // Check credentials masking
  const maskedKey = bkashConfigRes.data.data.credentialsMasked.appKey;
  assert(maskedKey.includes('...'), 'Credentials masked properly (e.g. bkas...5678)');
  assert(!maskedKey.includes('secret_123'), 'Plain-text secret never exposed in response');

  // 9. Accounting Export Engine (Tally XML & CSV)
  console.log('\n▶ TEST GROUP 9: Accounting Export Engine');
  // Tally XML Export
  const tallyRes = await axios.get(`${API_BASE}/developer/accounting/export?format=TALLY_XML`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(tallyRes.status === 200, 'Tally XML export generated');
  assert(String(tallyRes.headers['content-type'] || '').includes('xml'), 'Content-Type is XML');
  assert(tallyRes.data.includes('<ENVELOPE>'), 'XML contains Tally ENVELOPE tag');
  assert(tallyRes.data.includes('<TALLYREQUEST>Import Data</TALLYREQUEST>'), 'XML contains Tally Import Data request');

  // CSV Export
  const csvRes = await axios.get(`${API_BASE}/developer/accounting/export?format=CSV`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(csvRes.status === 200, 'CSV export generated');
  assert(String(csvRes.headers['content-type'] || '').includes('csv'), 'Content-Type is CSV');
  assert(csvRes.data.startsWith('TransactionCode,Date,Type,Amount'), 'CSV contains standard header line');

  // 10. Idempotency Guard Verification
  console.log('\n▶ TEST GROUP 10: Idempotency Protection for Public API');
  // Create another API key for idempotency testing
  const tempKeyRes = await DeveloperService.createApiKey(tenantId, regRes.data.data.user.id, {
    name: 'Idempotency Test Key',
    scopes: ['jobs:write', 'jobs:read'],
  });
  const idemKey = `idem_${Date.now()}_abc`;

  const req1 = await axios.post(
    `${API_BASE}/public/jobs`,
    {
      serviceType: 'DOCUMENT_A4',
      customerName: 'Idempotent Customer',
      customerPhone: '01711223344',
      totalAmount: 100,
    },
    {
      headers: {
        'x-api-key': tempKeyRes.rawKey,
        'Idempotency-Key': idemKey,
      },
    }
  );
  assert(req1.status === 201, 'Initial request succeeds with 201 Created');
  const jobCode1 = req1.data.data.jobCode;

  // Dispatch identical request with same Idempotency-Key
  const req2 = await axios.post(
    `${API_BASE}/public/jobs`,
    {
      serviceType: 'DOCUMENT_A4',
      customerName: 'Idempotent Customer',
      customerPhone: '01711223344',
      totalAmount: 100,
    },
    {
      headers: {
        'x-api-key': tempKeyRes.rawKey,
        'Idempotency-Key': idemKey,
      },
    }
  );
  assert(req2.status === 201, 'Duplicate idempotent request returns same 201 status code');
  assert(req2.headers['x-cache-lookup'] === 'IDEMPOTENT_HIT', 'X-Cache-Lookup is IDEMPOTENT_HIT');
  assert(req2.data.data.jobCode === jobCode1, 'Identical job entity returned without duplicate creation');

  console.log('\n=============================================================');
  console.log(`🎉 ALL PHASE 33 TESTS PASSED! (${passedChecks} / ${totalChecks} checks)`);
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
