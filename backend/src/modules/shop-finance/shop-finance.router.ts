import { Router } from 'express';
import { shopFinanceController } from './shop-finance.controller';
import { authenticate } from '../../middleware/auth';
import { authorizeRoles } from '../../middleware/rbac';
import { enforceTenantIsolation } from '../../middleware/tenantIsolation';

const router = Router();

// Tenant Isolation & Authentication required for all financial operations
router.use(authenticate, enforceTenantIsolation);

// 1. POS & Sales Operations (Cashier, Staff, Owner)
router.post(
  '/pos/sales',
  authorizeRoles('OWNER', 'MANAGER', 'STAFF', 'OPERATOR', 'SUPER_ADMIN'),
  shopFinanceController.recordPOSSale
);

// 2. Customer Due Payment Collection
router.post(
  '/dues/collect',
  authorizeRoles('OWNER', 'MANAGER', 'STAFF', 'OPERATOR', 'SUPER_ADMIN'),
  shopFinanceController.collectCustomerDue
);

// 3. Shop Expenses (Owner & Manager only)
router.post(
  '/expenses',
  authorizeRoles('OWNER', 'MANAGER', 'SUPER_ADMIN'),
  shopFinanceController.recordExpense
);

// 4. Refunds & Adjustments (Owner & Manager only)
router.post(
  '/refunds',
  authorizeRoles('OWNER', 'MANAGER', 'SUPER_ADMIN'),
  shopFinanceController.recordRefundOrAdjustment
);

// 5. Daily Cash Register (View live state)
router.get(
  '/cash-register',
  authorizeRoles('OWNER', 'MANAGER', 'STAFF', 'OPERATOR', 'SUPER_ADMIN'),
  shopFinanceController.getDailyCashRegister
);

// Daily Cash Register (Close drawer with physical cash count - Owner & Manager)
router.post(
  '/cash-register/close',
  authorizeRoles('OWNER', 'MANAGER', 'SUPER_ADMIN'),
  shopFinanceController.closeDailyCashRegister
);

// 6. Financial Reports & Sales Analytics (Owner & Manager only)
router.get(
  '/reports',
  authorizeRoles('OWNER', 'MANAGER', 'SUPER_ADMIN'),
  shopFinanceController.getFinancialReports
);

// 7. Shop Inventory & Consumables
router.get(
  '/inventory',
  authorizeRoles('OWNER', 'MANAGER', 'STAFF', 'OPERATOR', 'SUPER_ADMIN'),
  shopFinanceController.listInventory
);

router.post(
  '/inventory',
  authorizeRoles('OWNER', 'MANAGER', 'SUPER_ADMIN'),
  shopFinanceController.addOrUpdateInventory
);

export const shopFinanceRouter = router;

