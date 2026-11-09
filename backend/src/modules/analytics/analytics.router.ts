import { Router } from 'express';
import { analyticsController } from './analytics.controller';
import { authenticate } from '../../middleware/auth';
import { authorizeRoles } from '../../middleware/rbac';

export const analyticsRouter = Router();

analyticsRouter.use(authenticate);

// Super Admin Platform Analytics
analyticsRouter.get('/platform', authorizeRoles('SUPER_ADMIN'), analyticsController.getPlatformAnalytics);

// Shop-Level Analytics (Guarded for Shop Management)
analyticsRouter.get('/shop', authorizeRoles('SUPER_ADMIN', 'OWNER', 'MANAGER'), analyticsController.getShopAnalytics);
