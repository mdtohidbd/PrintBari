import { Router } from 'express';
import { monitoringController } from './monitoring.controller';
import { authenticate } from '../../middleware/auth';
import { authorizeRoles } from '../../middleware/rbac';

export const monitoringRouter = Router();

monitoringRouter.use(authenticate);

// Monitoring metrics dashboard (Restricted to Super Admin SREs)
monitoringRouter.get('/metrics', authorizeRoles('SUPER_ADMIN'), monitoringController.getMetrics);
