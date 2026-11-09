import { Router } from 'express';
import { cvController } from './cv.controller';
import { authenticate } from '../../middleware/auth';
import { enforceTenantIsolation } from '../../middleware/tenantIsolation';
import { enforceModuleAccess } from '../../middleware/featureAccess';

const router = Router();

router.use(authenticate, enforceTenantIsolation, enforceModuleAccess('CV'));

// CV Builder Routes
router.get('/cv-templates', cvController.listCvTemplates);
router.post('/export-pdf', cvController.exportCvPdf);
router.post('/export-docx', cvController.exportCvDocx);
router.post('/jobs', cvController.saveCvJob);
router.get('/jobs', cvController.listCvJobs);
router.get('/jobs/:jobId', cvController.getCvJob);

// Ready-Made Document Templates
router.get('/templates', cvController.listTemplates);
router.get('/templates/:templateId', cvController.getTemplate);
router.post('/render-document', cvController.renderDocument);
router.post('/export-doc-pdf', cvController.exportDocPdf);
router.post('/ready-docs', cvController.saveReadyDocJob);
router.get('/ready-docs', cvController.listReadyDocJobs);

export const cvRouter = router;

