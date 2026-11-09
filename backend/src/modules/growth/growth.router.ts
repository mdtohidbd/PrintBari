import { Router } from 'express';
import { growthController } from './growth.controller';
import { authenticate } from '../../middleware/auth';
import { authorizeRoles } from '../../middleware/rbac';

const router = Router();

// ─── Public Routes (Website Lead Capture, Demos, Referrals, Analytics) ───
router.post('/leads', growthController.captureLead);
router.post('/demos', growthController.scheduleDemo);
router.get('/referrals/validate/:code', growthController.validateReferral);
router.post('/analytics/events', growthController.recordEvent);
router.get('/nurture-templates', growthController.getNurtureTemplates);

// ─── Authenticated Tenant Routes ───
router.get('/referrals/my-program', authenticate, growthController.getMyReferralProgram);

// ─── Super Admin & Sales Pipeline Management ───
router.get(
  '/pipeline',
  authenticate,
  authorizeRoles('SUPER_ADMIN'),
  growthController.getPipeline
);

router.get(
  '/pipeline/stats',
  authenticate,
  authorizeRoles('SUPER_ADMIN'),
  growthController.getPipelineStats
);

router.put(
  '/leads/:leadId/status',
  authenticate,
  authorizeRoles('SUPER_ADMIN'),
  growthController.updateLeadStatus
);

router.post(
  '/leads/:leadId/follow-up',
  authenticate,
  authorizeRoles('SUPER_ADMIN'),
  growthController.addFollowUp
);

router.post(
  '/leads/:leadId/complete-demo',
  authenticate,
  authorizeRoles('SUPER_ADMIN'),
  growthController.completeDemo
);

router.get(
  '/analytics/funnel',
  authenticate,
  authorizeRoles('SUPER_ADMIN'),
  growthController.getFunnelAnalytics
);

export const growthRouter = router;

