import { Router } from 'express';
import multer from 'multer';
import { idCardController } from './idcard.controller';
import { authenticate } from '../../middleware/auth';
import { enforceTenantIsolation } from '../../middleware/tenantIsolation';
import { enforceModuleAccess } from '../../middleware/featureAccess';
import { BadRequestError } from '../../errors';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestError('Only JPEG, PNG or WebP image files are supported'));
    }
  },
});

router.use(authenticate, enforceTenantIsolation, enforceModuleAccess('IDCARD'));

// Presets
router.get('/presets', idCardController.getPresets);

// Processing & Layout
router.post('/process-side', upload.single('image'), idCardController.processSide);
router.post('/compose-sheet', idCardController.composeSheet);
router.post('/export-pdf', idCardController.exportPdf);

// MongoDB Job persistence & retrieval
router.post('/jobs', idCardController.saveJob);
router.get('/jobs', idCardController.listJobs);
router.get('/jobs/:jobId', idCardController.getJob);

export const idCardRouter = router;

