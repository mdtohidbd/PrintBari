import { Router } from 'express';
import { superAdminController } from './superadmin.controller';
import { authenticate } from '../../middleware/auth';
import { authorizeRoles } from '../../middleware/rbac';

const router = Router();

// All Super Admin routes require authentication + SUPER_ADMIN role
router.use(authenticate, authorizeRoles('SUPER_ADMIN'));

// Dashboard
router.get('/dashboard', superAdminController.getDashboard);

// Shop Management
router.get('/shops', superAdminController.getShops);
router.get('/shops/:shopId', superAdminController.getShopDetails);
router.post('/shops/:shopId/suspend', superAdminController.suspendShop);
router.post('/shops/:shopId/activate', superAdminController.activateShop);
router.put('/shops/:shopId/subscription', superAdminController.updateShopSubscription);

// Plan Management
router.get('/plans', superAdminController.getPlans);
router.post('/plans', superAdminController.createPlan);
router.put('/plans/:planKey', superAdminController.updatePlan);
router.delete('/plans/:planKey', superAdminController.archivePlan);

// Payment Management
router.get('/transactions', superAdminController.getTransactions);
router.get('/invoices', superAdminController.getInvoices);
router.get('/payment-stats', superAdminController.getPaymentStats);

// Platform Settings
router.get('/settings', superAdminController.getSettings);
router.put('/settings/:key', superAdminController.updateSetting);
router.post('/settings/bulk', superAdminController.bulkUpdateSettings);

// Audit Logs
router.get('/audit-logs', superAdminController.getAuditLogs);

// Role Permissions Matrix
router.get('/roles/permissions', superAdminController.getRolePermissions);
router.put('/roles/:role/permissions', superAdminController.updateRolePermissions);

// Global Passport Presets
router.get('/presets', superAdminController.getGlobalPresets);
router.post('/presets', superAdminController.upsertGlobalPreset);
router.delete('/presets/:presetKey', superAdminController.deleteGlobalPreset);

// Global CV Templates
router.get('/cv-templates', superAdminController.getGlobalCvTemplates);
router.post('/cv-templates', superAdminController.upsertGlobalCvTemplate);
router.delete('/cv-templates/:templateKey', superAdminController.deleteGlobalCvTemplate);

// Global Service Catalog
router.get('/services', superAdminController.getGlobalServices);
router.post('/services', superAdminController.upsertGlobalService);

// ─── Financial Intelligence & Revenue Operations ───
router.get('/financial/metrics', superAdminController.getRevenueMetrics);
router.get('/financial/unit-economics', superAdminController.getUnitEconomics);
router.get('/financial/cohorts', superAdminController.getCohortAnalysis);
router.get('/financial/renewals', superAdminController.getSubscriptionRenewals);
router.get('/financial/plan-distribution', superAdminController.getPlanDistribution);
router.get('/financial/monthly-report', superAdminController.getMonthlyFinancialReport);
router.get('/financial/cost-config', superAdminController.getCostConfig);
router.put('/financial/cost-config', superAdminController.updateCostConfig);
router.post('/financial/marketing-spend', superAdminController.recordMarketingSpend);

export const superAdminRouter = router;

