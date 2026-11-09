import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { enforceTenantIsolation } from '../../middleware/tenantIsolation';
import { tenantAwareRateLimiter } from '../../middleware/tenantRateLimiter';
import { authorizeRoles } from '../../middleware/rbac';
import { EnterpriseController } from './enterprise.controller';

const router = Router();

// Base middleware chain: Auth -> Tenant Isolation -> Tenant-Aware Rate Limiting
router.use(authenticate);
router.use(enforceTenantIsolation);
router.use(tenantAwareRateLimiter);

// Enterprise Branding & White-Label
router.patch('/branding', authorizeRoles('OWNER', 'SUPER_ADMIN'), EnterpriseController.updateBranding);

// Custom Domain Management
router.post('/custom-domain', authorizeRoles('OWNER', 'SUPER_ADMIN'), EnterpriseController.configureCustomDomain);
router.post('/custom-domain/verify', authorizeRoles('OWNER', 'SUPER_ADMIN'), EnterpriseController.verifyCustomDomain);

// Multi-Branch Management
router.post('/branches', authorizeRoles('OWNER', 'MANAGER', 'SUPER_ADMIN'), EnterpriseController.manageBranch);

// Dedicated Enterprise Storage Bucket
router.post('/storage/dedicated', authorizeRoles('OWNER', 'SUPER_ADMIN'), EnterpriseController.configureDedicatedStorage);

// Real-Time Usage Metering & Quotas
router.get('/metering', authorizeRoles('OWNER', 'MANAGER', 'SUPER_ADMIN'), EnterpriseController.getUsageMetering);

// Administrative Suspension & Recovery
router.post('/suspend', authorizeRoles('SUPER_ADMIN'), EnterpriseController.suspendTenant);
router.post('/recover', authorizeRoles('SUPER_ADMIN'), EnterpriseController.recoverTenant);

// Comprehensive Tenant Export & Offboarding
router.get('/export', authorizeRoles('OWNER', 'SUPER_ADMIN'), EnterpriseController.exportTenantData);

// Tenant-Scoped Audit Trail
router.get('/audit-logs', authorizeRoles('OWNER', 'SUPER_ADMIN'), EnterpriseController.getAuditHistory);

export { router as enterpriseRouter };
