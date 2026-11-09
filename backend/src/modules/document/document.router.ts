import { Router } from 'express';
import multer from 'multer';
import { documentController } from './document.controller';
import { authenticate } from '../../middleware/auth';
import { enforceTenantIsolation } from '../../middleware/tenantIsolation';
import { enforceModuleAccess } from '../../middleware/featureAccess';
import { BadRequestError } from '../../errors';

const router = Router();

// Multer memory storage configuration with 20MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestError('Only JPEG, PNG, WebP or PDF files are supported'));
    }
  },
});

router.use(authenticate, enforceTenantIsolation, enforceModuleAccess('DOCUMENT'));

// Page Processing & A4 Formatting
router.post('/process-page', upload.single('image'), documentController.processPage);
router.post('/compose-a4', upload.single('image'), documentController.composeA4);
router.post('/export-pdf', documentController.exportPdf);

// MongoDB Job persistence & retrieval
router.post('/jobs', documentController.saveJob);
router.get('/jobs', documentController.listJobs);
router.get('/jobs/:jobId', documentController.getJob);

export const documentRouter = router;

