import { Router } from 'express';
import { customerController } from './customer.controller';
import { authenticate } from '../../middleware/auth';
import { enforceTenantIsolation } from '../../middleware/tenantIsolation';

const router = Router();

router.use(authenticate, enforceTenantIsolation);

// Customer CRUD & Search
router.get('/', customerController.listCustomers);
router.get('/lookup', customerController.lookupCustomer);
router.post('/', customerController.createCustomer);
router.get('/:id', customerController.getCustomer);
router.get('/:id/activity', customerController.getCustomerActivity);
router.put('/:id', customerController.updateCustomer);
router.delete('/:id', customerController.deleteCustomer);
router.delete('/:id/purge', customerController.permanentPurgeCustomer);

// Customer Jobs & File Library
router.get('/:id/jobs', customerController.getCustomerJobs);
router.get('/:id/files', customerController.getCustomerFiles);
router.post('/:id/files', customerController.addCustomerFile);
router.delete('/:id/files/:fileId', customerController.deleteCustomerFile);

export const customerRouter = router;

