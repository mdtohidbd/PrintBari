import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { tenantContextMiddleware } from './middleware/tenantContext';
import { errorHandler } from './middleware/errorHandler';
import { apiRateLimiter } from './middleware/rateLimiter';
import { NotFoundError } from './errors';
import { healthRouter } from './modules/health/health.router';
import { authRouter } from './modules/auth/auth.router';
import { tenantRouter } from './modules/tenant/tenant.router';
import { dashboardRouter } from './modules/dashboard/dashboard.router';
import { jobRouter } from './modules/job/job.router';
import { passportRouter } from './modules/passport/passport.router';
import { documentRouter } from './modules/document/document.router';
import { idCardRouter } from './modules/idcard/idcard.router';
import { cvRouter } from './modules/cv/cv.router';
import { ocrRouter } from './modules/ocr/ocr.router';
import { customerRouter } from './modules/customer/customer.router';
import { printerRouter } from './modules/printer/printer.router';
import { subscriptionRouter } from './modules/subscription/subscription.router';
import { superAdminRouter } from './modules/superadmin/superadmin.router';
import { serviceRouter } from './modules/service/service.router';
import { notificationRouter } from './modules/notification/notification.router';
import { analyticsRouter } from './modules/analytics/analytics.router';
import { supportRouter } from './modules/support/support.router';
import { monitoringRouter } from './modules/monitoring/monitoring.router';
import { onboardingRouter } from './modules/onboarding/onboarding.router';
import { shopFinanceRouter } from './modules/shop-finance/shop-finance.router';
import { privacyRouter } from './modules/privacy/privacy.router';
import { enterpriseRouter } from './modules/enterprise/enterprise.router';
import { developerRouter } from './modules/developer/developer.router';
import { publicApiRouter } from './modules/public-api/publicApi.router';
import { growthRouter } from './modules/growth/growth.router';
import { disasterRecoveryRouter } from './modules/disaster-recovery/disasterRecovery.router';
import { releaseEngineeringRouter } from './modules/release/releaseEngineering.router';
import productIntelligenceRouter from './modules/product-intelligence/productIntelligence.router';

export const createApp = (): Application => {
  const app: Application = express();

  // Security & Optimization Middlewares
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-tenant-id',
        'x-target-tenant',
        'x-api-key',
        'Idempotency-Key',
        'X-Idempotency-Key',
      ],
    })
  );
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // HTTP Request Logging
  app.use(requestLogger);

  // Multi-Tenant Context Resolution
  app.use(tenantContextMiddleware);

  // API Versioning & Route Registration
  const apiV1 = express.Router();
  apiV1.use(apiRateLimiter);
  apiV1.use('/health', healthRouter);
  apiV1.use('/auth', authRouter);
  apiV1.use('/tenants', tenantRouter);
  apiV1.use('/dashboard', dashboardRouter);
  apiV1.use('/jobs', jobRouter);
  apiV1.use('/passport', passportRouter);
  apiV1.use('/document', documentRouter);
  apiV1.use('/idcard', idCardRouter);
  apiV1.use('/cv', cvRouter);
  apiV1.use('/ocr', ocrRouter);
  apiV1.use('/customers', customerRouter);
  apiV1.use('/printers', printerRouter);
  apiV1.use('/subscription', subscriptionRouter);
  apiV1.use('/services', serviceRouter);
  apiV1.use('/superadmin', superAdminRouter);
  apiV1.use('/notifications', notificationRouter);
  apiV1.use('/analytics', analyticsRouter);
  apiV1.use('/support', supportRouter);
  apiV1.use('/monitoring', monitoringRouter);
  apiV1.use('/onboarding', onboardingRouter);
  apiV1.use('/finance', shopFinanceRouter);
  apiV1.use('/privacy', privacyRouter);
  apiV1.use('/enterprise', enterpriseRouter);
  apiV1.use('/developer', developerRouter);
  apiV1.use('/public', publicApiRouter);
  apiV1.use('/growth', growthRouter);
  apiV1.use('/disaster-recovery', disasterRecoveryRouter);
  apiV1.use('/release', releaseEngineeringRouter);
  apiV1.use('/product-intelligence', productIntelligenceRouter);

  app.use('/api/v1', apiV1);

  // 404 Route Catch-all
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`Cannot find endpoint ${req.method} ${req.originalUrl}`));
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
};

