import { Router } from 'express';
import { subscriptionController } from './subscription.controller';
import { authenticate } from '../../middleware/auth';
import { enforceTenantIsolation } from '../../middleware/tenantIsolation';
import { authorizeRoles } from '../../middleware/rbac';

const router = Router();

// Public / Authenticated Plan Catalogue
router.get('/plans', subscriptionController.getPlans);

// Super-Admin Plan Configuration Management
router.put(
  '/plans/:planKey',
  authenticate,
  authorizeRoles('SUPER_ADMIN'),
  subscriptionController.updatePlan
);

// Super-Admin Subscription & Billing Operations
router.get(
  '/admin/subscriptions',
  authenticate,
  authorizeRoles('SUPER_ADMIN'),
  subscriptionController.adminGetSubscriptions
);

router.get(
  '/admin/transactions',
  authenticate,
  authorizeRoles('SUPER_ADMIN'),
  subscriptionController.adminGetTransactions
);

router.patch(
  '/admin/tenants/:tenantId/status',
  authenticate,
  authorizeRoles('SUPER_ADMIN'),
  subscriptionController.adminTransitionSubscription
);

router.post(
  '/admin/transactions/:transactionCode/refund',
  authenticate,
  authorizeRoles('SUPER_ADMIN'),
  subscriptionController.adminRefundTransaction
);

// Payment Callback / Webhook Verification (Signature Verified on Backend)
router.post('/verify-payment', subscriptionController.verifyPayment);

// Tenant-Authenticated Subscription & Billing Operations
router.use(authenticate, enforceTenantIsolation);

router.get('/my-status', subscriptionController.getMyStatus);
router.get('/usage-metering', subscriptionController.getUsageMetering);
router.post('/proration-quote', subscriptionController.getProrationQuote);
router.post('/downgrade-eligibility', subscriptionController.checkDowngradeEligibility);
router.post('/checkout', subscriptionController.initiateCheckout);
router.post('/retry', subscriptionController.retryPayment);
router.get('/history', subscriptionController.getBillingHistory);
router.get('/invoices/:invoiceNumber/pdf', subscriptionController.downloadInvoicePdf);

export const subscriptionRouter = router;

