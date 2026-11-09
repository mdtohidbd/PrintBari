import { Router } from 'express';
import { tenantController } from './tenant.controller';
import { authenticate } from '../../middleware/auth';
import { authorizeRoles } from '../../middleware/rbac';
import { enforceTenantIsolation } from '../../middleware/tenantIsolation';

const router = Router();

// All tenant routes require active authentication & tenant isolation enforcement
router.use(authenticate, enforceTenantIsolation);

// Current Shop Profile (Available to all authenticated staff of this tenant)
router.get('/current', tenantController.getCurrentTenant);

// Shop Profile & Settings Updates (Owner & Manager only)
router.put('/profile', authorizeRoles('OWNER', 'MANAGER'), tenantController.updateProfile);
router.put('/working-hours', authorizeRoles('OWNER', 'MANAGER'), tenantController.updateWorkingHours);
router.put('/invoice-settings', authorizeRoles('OWNER', 'MANAGER'), tenantController.updateInvoiceSettings);
router.put('/print-settings', authorizeRoles('OWNER', 'MANAGER'), tenantController.updatePrintSettings);

// Staff Directory (Owner & Manager can view)
router.get('/staff', authorizeRoles('OWNER', 'MANAGER'), tenantController.listStaff);

// Staff Activity History (Owner & Manager)
router.get('/staff/:staffId/activity', authorizeRoles('OWNER', 'MANAGER'), tenantController.getStaffActivity);

// Staff Operations (Owner only)
router.post('/staff', authorizeRoles('OWNER'), tenantController.addStaff);
router.put('/staff/:staffId', authorizeRoles('OWNER'), tenantController.editStaff);
router.patch('/staff/:staffId/toggle-status', authorizeRoles('OWNER'), tenantController.toggleStaffStatus);

export const tenantRouter = router;
