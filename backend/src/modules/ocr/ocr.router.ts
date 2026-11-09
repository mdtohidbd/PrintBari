import { Router } from 'express';
import multer from 'multer';
import { ocrController } from './ocr.controller';
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
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestError('Only JPEG, PNG or WebP images are supported for handwriting OCR'));
    }
  },
});

router.use(authenticate, enforceTenantIsolation, enforceModuleAccess('OCR'));

// Image Preprocessing & OCR Extraction
router.post('/preprocess', upload.single('image'), ocrController.preprocessImage);
router.post('/extract', upload.single('image'), ocrController.extractText);

// Document Generation & Export
router.post('/export-docx', ocrController.exportDocx);
router.post('/export-pdf', ocrController.exportPdf);

// MongoDB Job persistence & retrieval
router.post('/jobs', ocrController.saveJob);
router.get('/jobs', ocrController.listJobs);
router.get('/jobs/:jobId', ocrController.getJob);
router.put('/jobs/:jobId', ocrController.updateJob);
router.put('/jobs/:jobId/correction', ocrController.saveCorrection);

export const ocrRouter = router;

