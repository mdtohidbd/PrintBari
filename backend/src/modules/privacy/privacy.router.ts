import { Router } from 'express';
import { privacyController } from './privacy.controller';
import { authenticate } from '../../middleware/auth';
import { authorizeRoles } from '../../middleware/rbac';
import { enforceTenantIsolation } from '../../middleware/tenantIsolation';

const router = Router();

// Tenant Isolation & Authentication required for all privacy compliance operations
router.use(authenticate, enforceTenantIsolation);

// 1. Citizen Consent Management (Counter Staff & Owner)
router.post('/consent', privacyController.recordConsent);
router.get('/consent/:phone', privacyController.getConsentStatus);
router.post('/consent/revoke', privacyController.revokeConsent);

// 2. Data Subject Requests (DSR / DSAR)
router.post('/dsr', privacyController.createDSR);
router.post('/dsr/verify', privacyController.verifyDSR);
router.get(
  '/dsr',
  authorizeRoles('OWNER', 'MANAGER', 'SUPER_ADMIN'),
  privacyController.listDSRs
);
router.patch(
  '/dsr/:id',
  authorizeRoles('OWNER', 'MANAGER', 'SUPER_ADMIN'),
  privacyController.processDSR
);

// 3. Citizen Machine-Readable Data Export (SAR)
router.get(
  '/export/:phone',
  authorizeRoles('OWNER', 'MANAGER', 'SUPER_ADMIN'),
  privacyController.exportCitizenData
);

// 4. Automated Retention Purge Engine (24-Hour Policy)
router.post(
  '/purge/run',
  authorizeRoles('OWNER', 'MANAGER', 'SUPER_ADMIN'),
  privacyController.executeRetentionPurge
);

// 5. Privacy Notice Version History
router.get('/policies', privacyController.getPrivacyNoticeVersions);

export const privacyRouter = router;

