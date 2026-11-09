import { Router } from 'express';
import { serviceCatalogController } from './service.controller';
import { authenticate } from '../../middleware/auth';
import { authorizeRoles } from '../../middleware/rbac';
import { enforceTenantIsolation } from '../../middleware/tenantIsolation';

const router = Router();

// All service routes require authentication
router.use(authenticate);

// Publicly available to all authenticated tenant staff
router.get('/catalog', serviceCatalogController.getCatalog);

// Shop Owner & Manager Custom Services
router.post(
  '/custom',
  enforceTenantIsolation,
  authorizeRoles('OWNER', 'MANAGER'),
  serviceCatalogController.addCustomService
);

router.put(
  '/custom/:serviceId',
  enforceTenantIsolation,
  authorizeRoles('OWNER', 'MANAGER'),
  serviceCatalogController.updateCustomService
);

router.delete(
  '/custom/:serviceId',
  enforceTenantIsolation,
  authorizeRoles('OWNER'),
  serviceCatalogController.deleteCustomService
);

// Super Admin Global Service Catalog Management
router.post(
  '/global',
  authorizeRoles('SUPER_ADMIN'),
  serviceCatalogController.upsertGlobalService
);

export const serviceRouter = router;

