import { Router } from 'express';
import { dashboardController } from './dashboard.controller';
import { authenticate } from '../../middleware/auth';
import { enforceTenantIsolation } from '../../middleware/tenantIsolation';

const router = Router();

router.use(authenticate, enforceTenantIsolation);

router.get('/metrics', dashboardController.getMetrics);
router.post('/seed-demo', dashboardController.seedDemo);

export const dashboardRouter = router;

