import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

import axios from 'axios';
import mongoose from 'mongoose';
import { db } from '../config/db';
import { Tenant } from '../models/Tenant.model';
import { User } from '../models/User.model';
import { MigrationRecord, FeatureFlag, ReleaseDeployment } from '../models/ReleaseEngineering.model';
import { releaseEngineeringService } from '../modules/release/releaseEngineering.service';
import { TokenService } from '../utils/token';

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
  console.log('🚀 PHASE 38: PROFESSIONAL RELEASE ENGINEERING & CI/CD TEST');
  console.log('=============================================================\n');

  await db.connect();

  const stamp = Date.now().toString(36);

  // Group 1: Safe Migration Execution with Pre-Backup & Rollback
  console.log('▶ TEST GROUP 1: Safe Database Migrations & Automated Rollback');
  const migrationVersion = `20261109-001-${stamp}`;

  // 1. Successful Safe Migration
  let schemaAltered: any = false;
  const successfulMigration = await releaseEngineeringService.executeSafeMigration({
    version: migrationVersion,
    name: 'Add composite index to tenant usage',
    upAction: async () => {
      schemaAltered = true;
    },
    downAction: async () => {
      schemaAltered = false;
    },
  });

  assert(successfulMigration.version === migrationVersion, 'Migration version recorded in audit ledger');
  assert(!!successfulMigration.backupSnapshotId, `Pre-migration safety backup created: ${successfulMigration.backupSnapshotId}`);
  assert(successfulMigration.rollbackStatus === 'NONE', 'Successful migration status marked NONE');
  assert(schemaAltered === true, 'Migration upAction executed successfully');

  // Duplicate prevention check
  let duplicateBlocked: any = false;
  try {
    await releaseEngineeringService.executeSafeMigration({
      version: migrationVersion,
      name: 'Duplicate attempt',
      upAction: async () => {},
    });
  } catch (err) {
    duplicateBlocked = true;
  }
  assert(duplicateBlocked, 'Duplicate execution of already applied migration is blocked');

  // 2. Failing Migration with Automated Rollback
  console.log('  ⚠️  Simulating Risky Migration Failure Scenario...');
  const failingVersion = `20261109-FAIL-${stamp}`;
  let rollbackExecuted: any = false;
  let errorCaught: any = false;

  try {
    await releaseEngineeringService.executeSafeMigration({
      version: failingVersion,
      name: 'Risky destructive column drop',
      upAction: async () => {
        throw new Error('Database integrity violation: Constraint conflict');
      },
      downAction: async () => {
        rollbackExecuted = true;
      },
    });
  } catch (err: any) {
    errorCaught = true;
  }

  assert(errorCaught === true, 'Failing migration thrown error caught');
  assert(rollbackExecuted === true, 'Automated downAction rollback triggered immediately');
  const failedRecord = await MigrationRecord.findOne({ version: failingVersion });
  assert(failedRecord?.rollbackStatus === 'FAILED', 'Failed migration recorded with FAILED status and backup reference');

  // 3. Manual Rollback
  const rolledBackRecord = await releaseEngineeringService.rollbackMigration(
    migrationVersion,
    async () => {
      schemaAltered = false;
    },
    'Reverting index to optimize memory'
  );
  assert(rolledBackRecord.rollbackStatus === 'ROLLED_BACK', 'Migration rolled back cleanly');
  assert(schemaAltered === false, 'downAction executed and state reverted');

  // Group 2: Dynamic Feature Flags & Progressive Rollouts
  console.log('\n▶ TEST GROUP 2: Dynamic Feature Flags & Progressive Canary Rollouts');
  const flagKey = `FLAG_CANARY_SPOOLER_${stamp.toUpperCase()}`;

  // 1. Create Feature Flag with Kill-Switch
  const flag = await releaseEngineeringService.upsertFeatureFlag(flagKey, {
    description: 'High-speed desktop print bridge direct spooling v2',
    enabled: true,
    percentageRollout: 50,
    targetTiers: ['PRO', 'BUSINESS'],
    allowedTenants: ['TEN-VIP-001'],
    killSwitchTriggered: false,
  });

  assert(flag.key === flagKey, 'Feature flag created with 50% rollout & tier rules');

  // 2. Evaluate for whitelisted tenant
  const vipEval = await releaseEngineeringService.evaluateFeatureFlag(flagKey, {
    tenantId: 'TEN-VIP-001',
    planTier: 'STARTER',
  });
  assert(vipEval === true, 'Whitelisted tenant evaluates to TRUE regardless of tier');

  // 3. Evaluate for targeted tier
  const tierEval = await releaseEngineeringService.evaluateFeatureFlag(flagKey, {
    tenantId: 'TEN-OTHER-999',
    planTier: 'PRO',
  });
  assert(tierEval === true, 'Targeted tier (PRO) evaluates to TRUE');

  // 4. Emergency Kill-Switch Evaluation
  await releaseEngineeringService.upsertFeatureFlag(flagKey, {
    killSwitchTriggered: true,
  });
  const killEval = await releaseEngineeringService.evaluateFeatureFlag(flagKey, {
    tenantId: 'TEN-VIP-001',
    planTier: 'PRO',
  });
  assert(killEval === false, 'Emergency Kill-Switch immediately disables feature for all tenants');

  // Group 3: Synthetic Canary Health Gate
  console.log('\n▶ TEST GROUP 3: Synthetic Canary Health Gate Probes');
  const canaryGate = await releaseEngineeringService.executeCanaryHealthGate();
  assert(canaryGate.healthy === true, 'Canary synthetic probes passed');
  assert(canaryGate.probes.databasePassed === true, 'Database latency probe within acceptable bounds');
  assert(canaryGate.probes.storageProbePassed === true, 'Storage filesystem probe passed');
  assert(canaryGate.probes.queueBacklogHealthy === true, 'Queue backlog probe healthy');

  // Group 4: Versioned Release Deployment & Rollback Gate
  console.log('\n▶ TEST GROUP 4: Versioned Release Deployment & Automated Rollback');
  const releaseVer = '1.4.0';
  const commitSha = 'c7a8b9e1f2d34567890abcdef1234567890abcde';

  const deployment = await releaseEngineeringService.deployRelease({
    releaseVersion: releaseVer,
    commitSha,
    environment: 'STAGING',
    releaseNotes: 'Phase 38: Release Engineering, Canary Health Gate, Feature Flags',
  });

  assert(deployment.releaseVersion === releaseVer, 'Release deployment registered with SemVer version');
  assert(deployment.status === 'ACTIVE', 'Deployment verified and marked ACTIVE following canary pass');
  assert(!!deployment.preDeployBackupId, `Automated pre-deploy backup snapshot saved: ${deployment.preDeployBackupId}`);

  // Manual Emergency Rollback
  const rollbackDeployment = await releaseEngineeringService.triggerEmergencyRollback(
    deployment._id.toString(),
    'Synthetic canary alert detected memory leak'
  );
  assert(rollbackDeployment.status === 'ROLLED_BACK', 'Emergency rollback transition executed');
  assert(Boolean(rollbackDeployment.rollbackNotes?.includes('Synthetic canary alert')), 'Rollback audit trail captured');

  // Group 5: HTTP API Endpoints Verification
  console.log('\n▶ TEST GROUP 5: HTTP API Endpoints Verification');

  // Create active Tenant & Super Admin user to test secured API
  const adminTenant = await Tenant.create({
    businessId: `TEN-ADMIN-${stamp}`,
    name: `DevOps Admin Shop ${stamp}`,
    subdomain: `devops-${stamp}`,
    isActive: true,
    subscription: {
      plan: 'BUSINESS',
      status: 'ACTIVE',
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
    },
  });

  const adminEmail = `devopsadmin-${stamp}@docustudio.test`;
  const adminUser = await User.create({
    tenantId: adminTenant._id,
    fullName: 'Release Engineering Lead',
    email: adminEmail,
    passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
    role: 'SUPER_ADMIN',
    isActive: true,
  });

  const adminToken = TokenService.generateAccessToken({
    userId: adminUser._id.toString(),
    tenantId: adminTenant._id.toString(),
    email: adminUser.email,
    role: 'SUPER_ADMIN',
  });

  const authHeaders = { Authorization: `Bearer ${adminToken}` };

  // 1. Canary Health Status (Public / Internal)
  const canaryHttp = await axios.get(`${API_BASE}/release/canary/status`);
  assert(canaryHttp.status === 200, 'HTTP GET /release/canary/status returns 200');
  assert(canaryHttp.data.data.healthy === true, 'Canary reports healthy status');

  // 2. Evaluate Flag via API
  const flagEvalHttp = await axios.get(
    `${API_BASE}/release/flags/${flagKey}/evaluate?planTier=PRO`,
    { headers: authHeaders }
  );
  assert(flagEvalHttp.status === 200, 'HTTP GET /release/flags/:key/evaluate returns 200');

  // 3. List Migrations via API
  const migHttp = await axios.get(`${API_BASE}/release/migrations`, { headers: authHeaders });
  assert(migHttp.status === 200, 'HTTP GET /release/migrations returns migration ledger');

  // 4. List Feature Flags via API
  const flagsHttp = await axios.get(`${API_BASE}/release/flags`, { headers: authHeaders });
  assert(flagsHttp.status === 200, 'HTTP GET /release/flags returns feature flag list');

  // 5. Deploy Release via API
  const deployHttp = await axios.post(
    `${API_BASE}/release/deployments`,
    {
      releaseVersion: '1.4.1',
      commitSha: '9876543210abcdef1234567890abcdef12345678',
      environment: 'STAGING',
      releaseNotes: 'API test release',
    },
    { headers: authHeaders }
  );
  assert(deployHttp.status === 201, 'HTTP POST /release/deployments creates deployment with canary');
  const apiDeployId = deployHttp.data.data._id;

  // 6. Rollback Deployment via API
  const rollbackHttp = await axios.post(
    `${API_BASE}/release/deployments/${apiDeployId}/rollback`,
    { reason: 'API verified emergency test rollback' },
    { headers: authHeaders }
  );
  assert(rollbackHttp.status === 200, 'HTTP POST /release/deployments/:id/rollback executes rollback');
  assert(rollbackHttp.data.data.status === 'ROLLED_BACK', 'Deployment status confirmed ROLLED_BACK via API');

  // Cleanup
  await MigrationRecord.deleteMany({ version: { $in: [migrationVersion, failingVersion] } });
  await FeatureFlag.deleteOne({ key: flagKey });
  await ReleaseDeployment.deleteMany({ _id: { $in: [deployment._id, apiDeployId] } });
  await User.deleteOne({ _id: adminUser._id });
  await Tenant.deleteOne({ _id: adminTenant._id });

  console.log('\n=============================================================');
  console.log(`🎉 ALL PHASE 38 RELEASE ENGINEERING TESTS PASSED (${passedChecks}/${totalChecks})`);
  console.log('=============================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

runTests().catch(async (err) => {
  console.error('\n❌ TEST RUNNER FAILED WITH ERROR:', err);
  if (err.response) {
    console.error('Response status:', err.response.status);
    console.error('Response data:', JSON.stringify(err.response.data, null, 2));
  }
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
