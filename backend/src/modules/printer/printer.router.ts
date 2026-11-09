import { Router } from 'express';
import { printerController } from './printer.controller';
import { authenticate } from '../../middleware/auth';
import { enforceTenantIsolation } from '../../middleware/tenantIsolation';
import { enforceModuleAccess } from '../../middleware/featureAccess';

const router = Router();

router.use(authenticate, enforceTenantIsolation, enforceModuleAccess('PRINT_QUEUE'));

// Hardware Printers Catalogue
router.get('/', printerController.listPrinters);

// Print Queue Management
router.get('/queue', printerController.getQueue);
router.post('/queue', printerController.enqueueJob);
router.put('/queue/reorder', printerController.reorderQueue);
router.patch('/queue/:id', printerController.updateSettings);
router.delete('/queue/:id', printerController.removeJob);

// Print Execution Status
router.post('/queue/:id/start', printerController.startPrint);
router.post('/queue/:id/complete', printerController.completePrint);

// Print History Archive
router.get('/history', printerController.getHistory);

// Print-ready Vector PDF Export
router.post('/export-pdf', printerController.downloadPrintPdf);

export const printerRouter = router;

