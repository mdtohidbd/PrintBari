import { Router } from 'express';
import multer from 'multer';
import { passportController } from './passport.controller';
import { authenticate } from '../../middleware/auth';
import { enforceTenantIsolation } from '../../middleware/tenantIsolation';
import { enforceModuleAccess } from '../../middleware/featureAccess';
import { BadRequestError } from '../../errors';

const router = Router();

// Multer memory storage configuration with 15MB limit
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
      cb(new BadRequestError('Only JPEG, PNG, or WebP images are supported'));
    }
  },
});

router.use(authenticate, enforceTenantIsolation, enforceModuleAccess('PASSPORT'));

// Presets catalogue
router.get('/presets', passportController.getPresets);
router.post('/presets/custom', passportController.createCustomPreset);

// Processing & Layout
router.post('/process', upload.single('image'), passportController.processPhoto);
router.post('/sheet', upload.single('image'), passportController.generateSheet);
router.post('/export-pdf', upload.single('image'), passportController.exportPdf);

// MongoDB Job persistence & retrieval
router.post('/jobs', passportController.saveJob);
router.get('/jobs', passportController.listJobs);
router.get('/jobs/:jobId', passportController.getJob);

export const passportRouter = router;

