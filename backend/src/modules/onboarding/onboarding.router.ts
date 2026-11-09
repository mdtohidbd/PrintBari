import { Router } from 'express';
import { onboardingController } from './onboarding.controller';
import { authenticate } from '../../middleware/auth';
import { authorizeRoles } from '../../middleware/rbac';
import { enforceTenantIsolation } from '../../middleware/tenantIsolation';

const router = Router();

// All onboarding routes require active authentication & tenant isolation
router.use(authenticate, enforceTenantIsolation);

// Get current tenant onboarding state & checklist
router.get('/state', onboardingController.getState);

// Save progress on a step (Save & Resume)
router.post('/step', onboardingController.saveStep);

// Skip an optional step
router.post('/skip', onboardingController.skipStep);

// Demo Workspace Sample Data: Seed and Purge (Owner & Manager)
router.post(
  '/demo/seed',
  authorizeRoles('OWNER', 'MANAGER', 'SUPER_ADMIN'),
  onboardingController.seedSampleWorkspace
);
router.post(
  '/demo/purge',
  authorizeRoles('OWNER', 'MANAGER', 'SUPER_ADMIN'),
  onboardingController.purgeSampleWorkspace
);

// CSV Bulk Import for Customers & Jobs
router.post(
  '/import/csv',
  authorizeRoles('OWNER', 'MANAGER', 'STAFF', 'SUPER_ADMIN'),
  onboardingController.importFromCSV
);

// Complete Interactive Tour
router.post('/tour/complete', onboardingController.completeTour);

export const onboardingRouter = router;

