import { Router } from 'express';
import { productIntelligenceController } from './productIntelligence.controller';
import { authenticate } from '../../middleware/auth';
import { authorizeRoles } from '../../middleware/rbac';

const router = Router();

// 1. Telemetry Event Ingestion (Authenticated or Enriched)
router.post(
  '/events',
  authenticate,
  productIntelligenceController.trackEvent
);

// 2. Feedback, Bug Reporting, Surveys, & Feature Requests
router.post(
  '/feedback',
  authenticate,
  productIntelligenceController.submitFeedback
);

router.get(
  '/feedback',
  authenticate,
  productIntelligenceController.listFeedback
);

router.post(
  '/feedback/:id/vote',
  authenticate,
  productIntelligenceController.voteFeedback
);

// 3. Product Leadership & Analytics Endpoints (Super Admin / Product Analytics Lead)
router.get(
  '/metrics',
  authenticate,
  authorizeRoles('SUPER_ADMIN'),
  productIntelligenceController.getMetrics
);

router.get(
  '/feature-adoption',
  authenticate,
  authorizeRoles('SUPER_ADMIN'),
  productIntelligenceController.getFeatureAdoption
);

router.get(
  '/ux-friction',
  authenticate,
  authorizeRoles('SUPER_ADMIN'),
  productIntelligenceController.getUXFriction
);

router.get(
  '/feedback-analytics',
  authenticate,
  authorizeRoles('SUPER_ADMIN'),
  productIntelligenceController.getFeedbackAnalytics
);

router.patch(
  '/feedback/:id/prioritize',
  authenticate,
  authorizeRoles('SUPER_ADMIN'),
  productIntelligenceController.prioritizeFeedback
);

export default router;
