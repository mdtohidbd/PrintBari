import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { enforceTenantIsolation } from '../../middleware/tenantIsolation';
import { authorizeRoles } from '../../middleware/rbac';
import { DeveloperController } from './developer.controller';

const router = Router();

// Base middleware for dashboard management of Developer tools
router.use(authenticate);
router.use(enforceTenantIsolation);

// API Keys
router.post('/keys', authorizeRoles('OWNER', 'SUPER_ADMIN'), DeveloperController.createApiKey);
router.get('/keys', authorizeRoles('OWNER', 'SUPER_ADMIN', 'MANAGER'), DeveloperController.listApiKeys);
router.post('/keys/:keyId/rotate', authorizeRoles('OWNER', 'SUPER_ADMIN'), DeveloperController.rotateApiKey);
router.delete('/keys/:keyId', authorizeRoles('OWNER', 'SUPER_ADMIN'), DeveloperController.revokeApiKey);

// Webhook Subscriptions
router.post('/webhooks', authorizeRoles('OWNER', 'SUPER_ADMIN'), DeveloperController.createWebhook);
router.get('/webhooks', authorizeRoles('OWNER', 'SUPER_ADMIN', 'MANAGER'), DeveloperController.listWebhooks);
router.patch('/webhooks/:subId', authorizeRoles('OWNER', 'SUPER_ADMIN'), DeveloperController.updateWebhook);
router.delete('/webhooks/:subId', authorizeRoles('OWNER', 'SUPER_ADMIN'), DeveloperController.deleteWebhook);
router.post('/webhooks/:subId/rotate-secret', authorizeRoles('OWNER', 'SUPER_ADMIN'), DeveloperController.rotateWebhookSecret);
router.post('/webhooks/:subId/ping', authorizeRoles('OWNER', 'SUPER_ADMIN'), DeveloperController.testPingWebhook);
router.get('/webhooks/deliveries', authorizeRoles('OWNER', 'SUPER_ADMIN', 'MANAGER'), DeveloperController.listDeliveryLogs);

// Third-Party Integration Management
router.get('/integrations', authorizeRoles('OWNER', 'SUPER_ADMIN', 'MANAGER'), DeveloperController.listIntegrations);
router.post('/integrations', authorizeRoles('OWNER', 'SUPER_ADMIN'), DeveloperController.configureIntegration);

// Accounting Ledger Export (Tally XML / CSV)
router.get('/accounting/export', authorizeRoles('OWNER', 'SUPER_ADMIN', 'MANAGER'), DeveloperController.exportAccounting);

export { router as developerRouter };

