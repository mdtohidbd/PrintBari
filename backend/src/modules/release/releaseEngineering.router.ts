import { Router } from 'express';
import { releaseEngineeringController } from './releaseEngineering.controller';
import { authenticate } from '../../middleware/auth';
import { authorizeRoles } from '../../middleware/rbac';

const router = Router();

// Authenticated flag evaluation
router.get('/flags/:key/evaluate', authenticate, releaseEngineeringController.evaluateFeatureFlag);
router.get('/canary/status', releaseEngineeringController.getCanaryStatus);

// Super Admin Only: Release Engineering, Migrations & Deployments
router.use(authenticate, authorizeRoles('SUPER_ADMIN'));

// Migrations
router.get('/migrations', releaseEngineeringController.getMigrations);
router.post('/migrations', releaseEngineeringController.applyMigration);

// Feature Flags
router.get('/flags', releaseEngineeringController.listFeatureFlags);
router.put('/flags/:key', releaseEngineeringController.upsertFeatureFlag);

// Deployments & Rollbacks
router.get('/deployments', releaseEngineeringController.getDeployments);
router.post('/deployments', releaseEngineeringController.deployRelease);
router.post('/deployments/:deploymentId/rollback', releaseEngineeringController.rollbackDeployment);

export const releaseEngineeringRouter = router;

