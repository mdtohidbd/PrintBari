import { Router } from 'express';
import { jobController } from './job.controller';
import { authenticate } from '../../middleware/auth';
import { enforceTenantIsolation } from '../../middleware/tenantIsolation';

const router = Router();

router.use(authenticate, enforceTenantIsolation);

// List & Create Jobs
router.get('/', jobController.listJobs);
router.post('/', jobController.createJob);

// Staff Productivity & Assigned Queues (Must precede /:jobId)
router.get('/my-jobs', jobController.getMyJobs);
router.get('/staff-metrics', jobController.getStaffMetrics);

// Specific Job Detail & Edit
router.get('/:jobId', jobController.getJob);
router.put('/:jobId', jobController.updateJob);

// Status Workflow & Assignments
router.patch('/:jobId/status', jobController.updateStatus);
router.put('/:jobId/status', jobController.updateStatus);
router.patch('/:jobId/assign', jobController.assignStaff);
router.put('/:jobId/assign', jobController.assignStaff);

// Review & Approval Workflow
router.put('/:jobId/reviewer', jobController.assignReviewer);
router.put('/:jobId/approve', jobController.approveJob);

// Internal Job Comments
router.get('/:jobId/comments', jobController.getJobComments);
router.post('/:jobId/comments', jobController.addJobComment);

// Job Duplication & File Version Management
router.post('/:jobId/duplicate', jobController.duplicateJob);
router.post('/:jobId/files', jobController.addJobFile);

export const jobRouter = router;
