import { Router } from 'express';
import { disasterRecoveryController } from './disasterRecovery.controller';
import { authenticate } from '../../middleware/auth';
import { authorizeRoles } from '../../middleware/rbac';

const router = Router();

// Public / Monitoring Deep Health
router.get('/deep-health', disasterRecoveryController.getDeepHealth);

// Super Admin Only: Disaster Recovery & Continuity Operations
router.use(authenticate, authorizeRoles('SUPER_ADMIN'));

router.post('/backups', disasterRecoveryController.createBackup);
router.post('/backups/:snapshotId/verify', disasterRecoveryController.verifyBackup);
router.post('/restore-drills', disasterRecoveryController.executeRestoreDrill);
router.post('/reap-queue', disasterRecoveryController.reapStaleQueue);
router.post('/audits/database', disasterRecoveryController.runDbAudit);
router.post('/audits/storage', disasterRecoveryController.runStorageAudit);

export const disasterRecoveryRouter = router;

