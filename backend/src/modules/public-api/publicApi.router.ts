import { Router } from 'express';
import {
  authenticateApiKey,
  requireApiScope,
  rateLimitApiKey,
  idempotencyGuard,
} from '../../middleware/apiKeyAuth';
import { PublicApiController } from './publicApi.controller';

const router = Router();

// Base Developer Public API middleware pipeline:
// 1. Authenticate API Key & enforce active tenant
// 2. Token-bucket rate limiter per API key
// 3. Idempotency guard for write operations
router.use(authenticateApiKey);
router.use(rateLimitApiKey);
router.use(idempotencyGuard);

// Jobs
router.get('/jobs', requireApiScope('jobs:read'), PublicApiController.listJobs);
router.post('/jobs', requireApiScope('jobs:write'), PublicApiController.createJob);
router.get('/jobs/:jobCode', requireApiScope('jobs:read'), PublicApiController.getJobByCode);

// Customers
router.get('/customers', requireApiScope('customers:read'), PublicApiController.listCustomers);
router.post('/customers', requireApiScope('customers:write'), PublicApiController.createCustomer);

// Finance
router.get('/finance/transactions', requireApiScope('finance:read'), PublicApiController.listTransactions);

export { router as publicApiRouter };

