import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Job, IJob, JobStatus, JobServiceType, IJobFile, IJobActivity, IJobComment } from '../../models/Job.model';
import { Customer } from '../../models/Customer.model';
import { User } from '../../models/User.model';
import { AuditLog } from '../../models/AuditLog.model';
import { automationEventBus } from '../../services/automationEventBus';
import { ApiResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../errors';

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['NEW', 'PROCESSING', 'CANCELLED'],
  NEW: ['PROCESSING', 'QUEUED', 'READY_FOR_REVIEW', 'CANCELLED', 'DRAFT'],
  PENDING: ['PROCESSING', 'QUEUED', 'REVIEW', 'READY_FOR_REVIEW', 'CANCELLED'],
  PROCESSING: ['READY_FOR_REVIEW', 'REVIEW', 'QUEUED', 'PRINTING', 'COMPLETED', 'CANCELLED'],
  READY_FOR_REVIEW: ['APPROVED', 'PROCESSING', 'CANCELLED'],
  REVIEW: ['APPROVED', 'PRINT_READY', 'PROCESSING', 'CANCELLED'],
  APPROVED: ['QUEUED', 'PRINTING', 'PRINT_READY', 'COMPLETED', 'CANCELLED'],
  QUEUED: ['PRINTING', 'PRINT_READY', 'CANCELLED'],
  PRINTING: ['COMPLETED', 'PRINT_READY', 'CANCELLED'],
  PRINT_READY: ['PRINTING', 'COMPLETED', 'CANCELLED'],
  COMPLETED: ['CANCELLED', 'PROCESSING', 'NEW'],
  CANCELLED: ['DRAFT', 'NEW', 'PROCESSING'],
};

export class JobController {
  /**
   * List jobs with rich filtering, search, and pagination
   */
  public listJobs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const {
      status,
      serviceType,
      assignedTo,
      paymentStatus,
      priority,
      search,
      customerId,
      limit = '20',
      page = '1',
    } = req.query;

    const query: any = { tenantId: new mongoose.Types.ObjectId(tenantId) };

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (serviceType && serviceType !== 'ALL') {
      query.serviceType = serviceType;
    }

    if (assignedTo && assignedTo !== 'ALL' && mongoose.Types.ObjectId.isValid(String(assignedTo))) {
      query.assignedTo = new mongoose.Types.ObjectId(String(assignedTo));
    }

    if (paymentStatus && paymentStatus !== 'ALL') {
      query.paymentStatus = paymentStatus;
    }

    if (priority && priority !== 'ALL') {
      query.priority = priority;
    }

    if (customerId && mongoose.Types.ObjectId.isValid(String(customerId))) {
      query.customerId = new mongoose.Types.ObjectId(String(customerId));
    }

    if (search) {
      const searchRegex = new RegExp(String(search).trim(), 'i');
      query.$or = [
        { jobCode: searchRegex },
        { customerName: searchRegex },
        { customerPhone: searchRegex },
        { notes: searchRegex },
      ];
    }

    const pageSize = Math.min(100, Math.max(1, parseInt(String(limit))));
    const pageNum = Math.max(1, parseInt(String(page)));
    const skip = (pageNum - 1) * pageSize;

    const [jobs, totalCount] = await Promise.all([
      Job.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .populate('assignedTo', 'fullName email role')
        .populate('customerId', 'fullName phone email address')
        .lean(),
      Job.countDocuments(query),
    ]);

    ApiResponse.success(
      res,
      {
        jobs,
        pagination: {
          total: totalCount,
          page: pageNum,
          pageSize,
          totalPages: Math.ceil(totalCount / pageSize) || 1,
        },
      },
      'Jobs list retrieved'
    );
  });

  /**
   * Get single job details with activity logs & file history
   */
  public getJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const jobId = String(Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId);

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      throw new BadRequestError('Invalid job ID');
    }

    const job = await Job.findOne({
      _id: new mongoose.Types.ObjectId(jobId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    })
      .populate('assignedTo', 'fullName email role phone')
      .populate('customerId')
      .lean();

    if (!job) {
      throw new NotFoundError('Job order not found in your shop');
    }

    ApiResponse.success(res, job, 'Job details retrieved');
  });

  /**
   * Create a new job with customer auto-linking & activity logging
   */
  public createJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenant = req.tenant!;
    const {
      customerId: existingCustomerId,
      customerName,
      customerPhone,
      customerEmail,
      serviceType = 'CUSTOM_PRINT',
      status = 'NEW',
      priority = 'NORMAL',
      assignedTo,
      copies = 1,
      paperType = 'A4 Standard',
      price,
      totalAmount = 0,
      paidAmount = 0,
      paymentMethod = 'CASH',
      uploadedFiles = [],
      processedFiles = [],
      notes = '',
    } = req.body;

    // Dynamic Quota Check: enforce monthly job limit from plan/tenant
    const jobLimit = tenant.quotas?.monthlyJobsLimit || 500;
    const jobsUsed = tenant.quotas?.monthlyJobsUsed || 0;
    if (jobsUsed >= jobLimit && req.user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError(
        `Monthly job limit reached (${jobsUsed}/${jobLimit}) for your ${tenant.subscription.plan} plan. Please upgrade your plan in Subscription Settings.`
      );
    }

    if (!customerName || !customerPhone) {
      throw new BadRequestError('Customer name and phone number are required');
    }

    // 1. Auto-generate unique job code: JOB-<timestamp-last4><random3>
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const jobCode = `JOB-${Date.now().toString().slice(-4)}${randomSuffix}`;

    // 2. Lookup or create customer
    let customer: any = null;
    if (existingCustomerId && mongoose.Types.ObjectId.isValid(existingCustomerId)) {
      customer = await Customer.findOne({
        _id: new mongoose.Types.ObjectId(existingCustomerId),
        tenantId: tenant._id,
      });
    }

    if (!customer) {
      customer = await Customer.findOne({ tenantId: tenant._id, phone: customerPhone.trim(), isDeleted: false });
    }

    const actualPaid = Number(paidAmount) || 0;
    const subtotal = price?.subtotal !== undefined ? Number(price.subtotal) : Number(totalAmount) || 0;
    const discount = price?.discount !== undefined ? Number(price.discount) : 0;
    const tax = price?.tax !== undefined ? Number(price.tax) : 0;
    const totalPrice = price?.totalPrice !== undefined ? Number(price.totalPrice) : Math.max(0, subtotal - discount + tax);

    if (!customer) {
      customer = await Customer.create({
        tenantId: tenant._id,
        fullName: customerName.trim(),
        phone: customerPhone.trim(),
        email: customerEmail ? customerEmail.trim() : undefined,
        totalOrdersCount: 1,
        totalSpent: actualPaid,
        lastVisitAt: new Date(),
        isActive: true,
        fileLibrary: [],
      });
    } else {
      customer.totalOrdersCount += 1;
      customer.totalSpent += actualPaid;
      customer.lastVisitAt = new Date();
      await customer.save();
    }

    // Determine payment status
    const paymentStatus =
      actualPaid >= totalPrice && totalPrice > 0
        ? 'PAID'
        : actualPaid > 0
        ? 'PARTIAL'
        : 'UNPAID';

    // Initial activity log
    const initialActivity: IJobActivity = {
      activityId: `ACT-${Date.now()}-${Math.floor(10 + Math.random() * 90)}`,
      action: 'JOB_CREATED',
      newStatus: status,
      changedById: req.user?._id,
      changedByName: req.user?.fullName || 'Shop Staff',
      role: req.user?.role || 'STAFF',
      note: `Job created with initial status ${status}`,
      timestamp: new Date(),
    };

    // 3. Create Job
    const job = new Job({
      tenantId: tenant._id,
      jobCode,
      customerId: customer._id,
      customerName: customer.fullName,
      customerPhone: customer.phone,
      customerEmail: customer.email,
      serviceType,
      status,
      priority,
      assignedTo: assignedTo && mongoose.Types.ObjectId.isValid(assignedTo) ? new mongoose.Types.ObjectId(assignedTo) : req.user?._id,
      copies: Number(copies) || 1,
      paperType,
      price: {
        subtotal,
        discount,
        tax,
        totalPrice,
      },
      totalAmount: totalPrice,
      paidAmount: actualPaid,
      paymentStatus,
      paymentMethod,
      uploadedFiles,
      processedFiles,
      activityLogs: [initialActivity],
      notes,
    });

    await job.save();

    // Sync any uploaded files to customer's file library
    if (Array.isArray(uploadedFiles) && uploadedFiles.length > 0) {
      for (const file of uploadedFiles) {
        if (file.url) {
          customer.fileLibrary.unshift({
            fileId: file.fileId || `FILE-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
            name: file.name || 'Job File',
            url: file.url,
            size: file.size || 0,
            mimeType: file.mimeType || 'application/octet-stream',
            sourceJobCode: jobCode,
            addedAt: new Date(),
          });
        }
      }
      await customer.save();
    }

    // 4. Update tenant quotas
    tenant.quotas.monthlyJobsUsed = (tenant.quotas.monthlyJobsUsed || 0) + 1;
    if (serviceType === 'PASSPORT_PHOTO') {
      tenant.quotas.monthlyPassportLayoutsUsed += 1;
    }
    await tenant.save();

    // 5. System Audit Log
    await AuditLog.create({
      tenantId: tenant._id,
      userId: req.user?._id,
      action: 'JOB_CREATED',
      details: { jobCode, serviceType, totalPrice },
      status: 'SUCCESS',
    });

    // 6. Automation Event Dispatches
    automationEventBus.emit('JOB_CREATED', {
      tenantId: tenant._id,
      jobId: job._id,
      jobCode,
      customerId: customer._id,
      customerName: customer.fullName,
      customerPhone: customer.phone,
      customerEmail: customer.email,
      serviceType,
      totalAmount: totalPrice,
      paidAmount: actualPaid,
      staffId: job.assignedTo,
    });

    if (job.assignedTo && job.assignedTo.toString() !== req.user?._id?.toString()) {
      automationEventBus.emit('JOB_ASSIGNED', {
        tenantId: tenant._id,
        jobId: job._id,
        jobCode,
        staffId: job.assignedTo,
        customerName: customer.fullName,
      });
    }

    if (actualPaid > 0) {
      automationEventBus.emit('PAYMENT_CONFIRMED', {
        tenantId: tenant._id,
        jobId: job._id,
        jobCode,
        customerName: customer.fullName,
        paidAmount: actualPaid,
      });
    }

    ApiResponse.created(res, job, `Order ${jobCode} created successfully`);
  });

  /**
   * Update job status with state machine validation & activity logging
   */
  public updateStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const jobId = String(Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId);
    const { status, note, cancellationReason } = req.body;

    if (!status) {
      throw new BadRequestError('Status is required');
    }

    const job = await Job.findOne({
      _id: new mongoose.Types.ObjectId(jobId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    });

    if (!job) {
      throw new NotFoundError('Job order not found in your shop');
    }

    const prevStatus = job.status;

    // Validate transition
    const allowed = VALID_STATUS_TRANSITIONS[prevStatus];
    if (allowed && !allowed.includes(status) && prevStatus !== status) {
      throw new BadRequestError(
        `Invalid status transition from '${prevStatus}' to '${status}'. Allowed transitions: ${allowed.join(', ')}`
      );
    }

    // Cancellation Reason Requirement
    if (status === 'CANCELLED') {
      const reason = cancellationReason || note;
      if (!reason || !reason.trim()) {
        throw new BadRequestError('A cancellation reason is required when cancelling a job order');
      }
      job.cancellationReason = reason.trim();
    }

    // Reopen Guard: Only OWNER, MANAGER, or SUPER_ADMIN can reopen completed or cancelled jobs
    if ((prevStatus === 'COMPLETED' || prevStatus === 'CANCELLED') && status !== prevStatus) {
      const userRole = req.user?.role || '';
      if (!['OWNER', 'MANAGER', 'SUPER_ADMIN'].includes(userRole)) {
        throw new ForbiddenError(
          'Only Shop Owners, Managers, or Super Admins are authorized to reopen completed or cancelled jobs'
        );
      }
    }

    job.status = status;
    if (status === 'COMPLETED' && !job.completedAt) {
      job.completedAt = new Date();
    }

    // Record activity log
    const activity: IJobActivity = {
      activityId: `ACT-${Date.now()}-${Math.floor(10 + Math.random() * 90)}`,
      action: 'STATUS_CHANGED',
      oldStatus: prevStatus,
      newStatus: status,
      changedById: req.user?._id,
      changedByName: req.user?.fullName || 'Shop Staff',
      role: req.user?.role || 'STAFF',
      note: note || `Status transitioned from ${prevStatus} to ${status}`,
      timestamp: new Date(),
    };

    job.activityLogs.unshift(activity);
    await job.save();

    await AuditLog.create({
      tenantId,
      userId: req.user?._id,
      action: 'JOB_STATUS_UPDATED',
      details: { jobCode: job.jobCode, previous: prevStatus, current: status, note, cancellationReason: job.cancellationReason },
      status: 'SUCCESS',
    });

    // Automation Events
    if (status === 'READY_FOR_REVIEW') {
      automationEventBus.emit('JOB_READY_FOR_REVIEW', {
        tenantId,
        jobId: job._id,
        jobCode: job.jobCode,
        reviewerId: job.reviewerId,
        staffName: req.user?.fullName,
      });
    } else if (status === 'APPROVED') {
      automationEventBus.emit('JOB_APPROVED', {
        tenantId,
        jobId: job._id,
        jobCode: job.jobCode,
        staffId: job.assignedTo,
        reviewerName: req.user?.fullName,
      });
    } else if (status === 'COMPLETED') {
      automationEventBus.emit('JOB_COMPLETED', {
        tenantId,
        jobId: job._id,
        jobCode: job.jobCode,
        customerName: job.customerName,
        customerPhone: job.customerPhone,
      });
    }

    ApiResponse.success(res, job, `Job status transitioned to ${status}`);
  });

  /**
   * Update job details (notes, priority, price, payment)
   */
  public updateJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const jobId = String(Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId);
    const {
      serviceType,
      priority,
      copies,
      paperType,
      price,
      totalAmount,
      paidAmount,
      paymentMethod,
      notes,
      assignedTo,
    } = req.body;

    const job = await Job.findOne({
      _id: new mongoose.Types.ObjectId(jobId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    });

    if (!job) {
      throw new NotFoundError('Job order not found in your shop');
    }

    if (serviceType) job.serviceType = serviceType;
    if (priority) job.priority = priority;
    if (copies !== undefined) job.copies = Number(copies);
    if (paperType) job.paperType = paperType;
    if (notes !== undefined) job.notes = notes;

    if (assignedTo !== undefined) {
      job.assignedTo = assignedTo && mongoose.Types.ObjectId.isValid(assignedTo)
        ? new mongoose.Types.ObjectId(assignedTo)
        : undefined;
    }

    if (price) {
      job.price = {
        subtotal: Number(price.subtotal) || 0,
        discount: Number(price.discount) || 0,
        tax: Number(price.tax) || 0,
        totalPrice: Number(price.totalPrice) || 0,
      };
      job.totalAmount = job.price.totalPrice;
    } else if (totalAmount !== undefined) {
      job.totalAmount = Number(totalAmount);
      if (job.price) job.price.totalPrice = Number(totalAmount);
    }

    if (paidAmount !== undefined) {
      job.paidAmount = Number(paidAmount);
      const targetTotal = job.price?.totalPrice || job.totalAmount;
      job.paymentStatus =
        job.paidAmount >= targetTotal && targetTotal > 0
          ? 'PAID'
          : job.paidAmount > 0
          ? 'PARTIAL'
          : 'UNPAID';
    }

    if (paymentMethod) job.paymentMethod = paymentMethod;

    job.activityLogs.unshift({
      activityId: `ACT-${Date.now()}-${Math.floor(10 + Math.random() * 90)}`,
      action: 'JOB_UPDATED',
      changedById: req.user?._id,
      changedByName: req.user?.fullName || 'Shop Staff',
      role: req.user?.role || 'STAFF',
      note: 'Job details updated',
      timestamp: new Date(),
    });

    await job.save();

    ApiResponse.success(res, job, 'Job updated successfully');
  });

  /**
   * Duplicate a job (creates a clone with a fresh Job ID)
   */
  public duplicateJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const jobId = String(Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId);

    const sourceJob = await Job.findOne({
      _id: new mongoose.Types.ObjectId(jobId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    }).lean();

    if (!sourceJob) {
      throw new NotFoundError('Source job not found');
    }

    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const newJobCode = `JOB-${Date.now().toString().slice(-4)}${randomSuffix}`;

    const newActivity: IJobActivity = {
      activityId: `ACT-${Date.now()}-${Math.floor(10 + Math.random() * 90)}`,
      action: 'JOB_DUPLICATED',
      newStatus: 'NEW',
      changedById: req.user?._id,
      changedByName: req.user?.fullName || 'Shop Staff',
      role: req.user?.role || 'STAFF',
      note: `Duplicated from source job ${sourceJob.jobCode}`,
      timestamp: new Date(),
    };

    const duplicatedJob = new Job({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      jobCode: newJobCode,
      customerId: sourceJob.customerId,
      customerName: sourceJob.customerName,
      customerPhone: sourceJob.customerPhone,
      customerEmail: sourceJob.customerEmail,
      serviceType: sourceJob.serviceType,
      status: 'NEW',
      priority: sourceJob.priority,
      assignedTo: req.user?._id,
      copies: sourceJob.copies,
      paperType: sourceJob.paperType,
      price: sourceJob.price,
      totalAmount: sourceJob.totalAmount,
      paidAmount: 0,
      paymentStatus: 'UNPAID',
      paymentMethod: sourceJob.paymentMethod,
      uploadedFiles: sourceJob.uploadedFiles || [],
      processedFiles: [],
      activityLogs: [newActivity],
      notes: `[Duplicated from ${sourceJob.jobCode}] ${sourceJob.notes || ''}`.trim(),
    });

    await duplicatedJob.save();

    ApiResponse.created(res, duplicatedJob, `Job duplicated successfully as ${newJobCode}`);
  });

  /**
   * Assign or reassign staff member with optional due date and priority
   */
  public assignStaff = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const jobId = String(Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId);
    const { staffId, assignedTo, dueDate, priority } = req.body;
    const targetStaffId = staffId || assignedTo;

    const job = await Job.findOne({
      _id: new mongoose.Types.ObjectId(jobId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    });

    if (!job) {
      throw new NotFoundError('Job order not found');
    }

    let staffName = 'Unassigned';
    if (targetStaffId && mongoose.Types.ObjectId.isValid(targetStaffId)) {
      const staffUser = await User.findOne({
        _id: new mongoose.Types.ObjectId(targetStaffId),
        tenantId: new mongoose.Types.ObjectId(tenantId),
      });
      if (!staffUser) {
        throw new NotFoundError('Staff member not found in your shop');
      }
      job.assignedTo = staffUser._id;
      staffName = staffUser.fullName;
    } else if (targetStaffId === null || targetStaffId === '') {
      job.assignedTo = undefined;
    }

    if (dueDate) {
      job.dueDate = new Date(dueDate);
    }

    if (priority && ['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(priority)) {
      job.priority = priority;
    }

    job.activityLogs.unshift({
      activityId: `ACT-${Date.now()}-${Math.floor(10 + Math.random() * 90)}`,
      action: 'STAFF_ASSIGNED',
      changedById: req.user?._id,
      changedByName: req.user?.fullName || 'Shop Staff',
      role: req.user?.role || 'STAFF',
      note: `Job assigned to ${staffName}${job.dueDate ? ` (Due: ${job.dueDate.toISOString().slice(0, 10)})` : ''}`,
      timestamp: new Date(),
    });

    await job.save();

    if (job.assignedTo) {
      automationEventBus.emit('JOB_ASSIGNED', {
        tenantId,
        jobId: job._id,
        jobCode: job.jobCode,
        staffId: job.assignedTo,
        staffName,
      });
    }

    ApiResponse.success(res, job, `Staff assignment updated: ${staffName}`);
  });

  /**
   * Assign reviewer and request quality review
   */
  public assignReviewer = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const jobId = String(Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId);
    const { reviewerId, note } = req.body;

    const job = await Job.findOne({
      _id: new mongoose.Types.ObjectId(jobId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    });

    if (!job) {
      throw new NotFoundError('Job order not found');
    }

    let reviewerUser = null;
    if (reviewerId && mongoose.Types.ObjectId.isValid(reviewerId)) {
      reviewerUser = await User.findOne({
        _id: new mongoose.Types.ObjectId(reviewerId),
        tenantId: new mongoose.Types.ObjectId(tenantId),
      });
      if (!reviewerUser) {
        throw new NotFoundError('Reviewer not found in your shop');
      }
    }

    job.reviewerId = reviewerUser ? reviewerUser._id : req.user?._id;
    job.reviewerName = reviewerUser ? reviewerUser.fullName : req.user?.fullName;
    job.status = 'READY_FOR_REVIEW';

    job.activityLogs.unshift({
      activityId: `ACT-${Date.now()}-${Math.floor(10 + Math.random() * 90)}`,
      action: 'REVIEW_REQUESTED',
      oldStatus: job.status,
      newStatus: 'READY_FOR_REVIEW',
      changedById: req.user?._id,
      changedByName: req.user?.fullName || 'Shop Staff',
      role: req.user?.role || 'STAFF',
      note: note || `Review requested from ${job.reviewerName}`,
      timestamp: new Date(),
    });

    await job.save();

    automationEventBus.emit('JOB_READY_FOR_REVIEW', {
      tenantId,
      jobId: job._id,
      jobCode: job.jobCode,
      reviewerId: job.reviewerId,
      reviewerName: job.reviewerName,
      staffName: req.user?.fullName,
    });

    ApiResponse.success(res, job, `Job submitted for review to ${job.reviewerName}`);
  });

  /**
   * Reviewer approves the job quality
   */
  public approveJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const jobId = String(Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId);
    const { note } = req.body;

    const job = await Job.findOne({
      _id: new mongoose.Types.ObjectId(jobId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    });

    if (!job) {
      throw new NotFoundError('Job order not found');
    }

    const prevStatus = job.status;
    job.status = 'APPROVED';

    job.activityLogs.unshift({
      activityId: `ACT-${Date.now()}-${Math.floor(10 + Math.random() * 90)}`,
      action: 'JOB_APPROVED',
      oldStatus: prevStatus,
      newStatus: 'APPROVED',
      changedById: req.user?._id,
      changedByName: req.user?.fullName || 'Reviewer',
      role: req.user?.role || 'MANAGER',
      note: note || 'Quality approved and ready for output',
      timestamp: new Date(),
    });

    await job.save();

    automationEventBus.emit('JOB_APPROVED', {
      tenantId,
      jobId: job._id,
      jobCode: job.jobCode,
      staffId: job.assignedTo,
      reviewerName: req.user?.fullName,
    });

    ApiResponse.success(res, job, `Job ${job.jobCode} approved successfully`);
  });

  /**
   * Add internal staff comment to job
   */
  public addJobComment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const jobId = String(Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId);
    const { text } = req.body;

    if (!text || !text.trim()) {
      throw new BadRequestError('Comment text cannot be empty');
    }

    const job = await Job.findOne({
      _id: new mongoose.Types.ObjectId(jobId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    });

    if (!job) {
      throw new NotFoundError('Job order not found');
    }

    const comment: IJobComment = {
      commentId: `CMT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      userId: req.user!._id,
      userName: req.user?.fullName || 'Shop Staff',
      role: req.user?.role || 'STAFF',
      text: text.trim(),
      createdAt: new Date(),
    };

    if (!job.internalComments) {
      job.internalComments = [];
    }
    job.internalComments.push(comment);

    await job.save();

    ApiResponse.created(res, comment, 'Comment added successfully');
  });

  /**
   * Get internal comments for a job
   */
  public getJobComments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const jobId = String(Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId);

    const job = await Job.findOne({
      _id: new mongoose.Types.ObjectId(jobId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    }).select('internalComments jobCode');

    if (!job) {
      throw new NotFoundError('Job order not found');
    }

    ApiResponse.success(res, job.internalComments || [], 'Job comments retrieved');
  });

  /**
   * Staff specific dashboard: Get jobs assigned to current user
   */
  public getMyJobs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const userId = req.user!._id;
    const { status, limit = '50' } = req.query;

    const baseQuery: any = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      assignedTo: new mongoose.Types.ObjectId(userId),
    };

    if (status && status !== 'ALL') {
      baseQuery.status = status;
    }

    const pageSize = Math.min(100, Math.max(1, parseInt(String(limit))));

    const [allAssigned, pendingCount, inReviewCount, completedCount] = await Promise.all([
      Job.find(baseQuery)
        .sort({ priority: -1, createdAt: -1 })
        .limit(pageSize)
        .populate('customerId', 'fullName phone')
        .lean(),
      Job.countDocuments({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        assignedTo: new mongoose.Types.ObjectId(userId),
        status: { $in: ['NEW', 'PENDING', 'PROCESSING', 'QUEUED', 'PRINTING'] },
      }),
      Job.countDocuments({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        assignedTo: new mongoose.Types.ObjectId(userId),
        status: { $in: ['READY_FOR_REVIEW', 'REVIEW'] },
      }),
      Job.countDocuments({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        assignedTo: new mongoose.Types.ObjectId(userId),
        status: 'COMPLETED',
      }),
    ]);

    const categorized = {
      pending: allAssigned.filter((j) =>
        ['NEW', 'PENDING', 'PROCESSING', 'QUEUED', 'PRINTING'].includes(j.status)
      ),
      inReview: allAssigned.filter((j) => ['READY_FOR_REVIEW', 'REVIEW'].includes(j.status)),
      completed: allAssigned.filter((j) => j.status === 'COMPLETED'),
      counts: {
        total: allAssigned.length,
        pending: pendingCount,
        inReview: inReviewCount,
        completed: completedCount,
      },
    };

    ApiResponse.success(res, categorized, 'Staff assigned jobs retrieved');
  });

  /**
   * Staff productivity metrics
   */
  public getStaffMetrics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const userId = req.user!._id;

    const [totalAssigned, completed, inProgress, urgentPending] = await Promise.all([
      Job.countDocuments({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        assignedTo: new mongoose.Types.ObjectId(userId),
      }),
      Job.countDocuments({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        assignedTo: new mongoose.Types.ObjectId(userId),
        status: 'COMPLETED',
      }),
      Job.countDocuments({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        assignedTo: new mongoose.Types.ObjectId(userId),
        status: { $in: ['PROCESSING', 'QUEUED', 'PRINTING', 'READY_FOR_REVIEW'] },
      }),
      Job.countDocuments({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        assignedTo: new mongoose.Types.ObjectId(userId),
        priority: 'URGENT',
        status: { $ne: 'COMPLETED' },
      }),
    ]);

    const completionRate = totalAssigned > 0 ? Math.round((completed / totalAssigned) * 100) : 100;

    ApiResponse.success(
      res,
      {
        totalAssigned,
        completed,
        inProgress,
        urgentPending,
        completionRatePercent: completionRate,
      },
      'Staff metrics retrieved'
    );
  });

  /**
   * Add a new file version to the job
   */
  public addJobFile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const jobId = String(Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId);
    const { name, url, size = 0, mimeType = 'application/octet-stream', type = 'PROCESSED' } = req.body;

    if (!name || !url) {
      throw new BadRequestError('File name and url are required');
    }

    const job = await Job.findOne({
      _id: new mongoose.Types.ObjectId(jobId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    });

    if (!job) {
      throw new NotFoundError('Job order not found');
    }

    const targetList = type === 'UPLOADED' ? job.uploadedFiles : job.processedFiles;
    const currentVersion = targetList.filter((f) => f.name === name).length + 1;
    const fileId = `FILE-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const newFile: IJobFile = {
      fileId,
      name: name.trim(),
      url: url.trim(),
      size: Number(size) || 0,
      mimeType: mimeType.trim(),
      version: currentVersion,
      uploadedAt: new Date(),
    };

    targetList.push(newFile);

    job.activityLogs.unshift({
      activityId: `ACT-${Date.now()}-${Math.floor(10 + Math.random() * 90)}`,
      action: 'FILE_ADDED',
      changedById: req.user?._id,
      changedByName: req.user?.fullName || 'Shop Staff',
      role: req.user?.role || 'STAFF',
      note: `Added ${type.toLowerCase()} file: ${name} (v${currentVersion})`,
      timestamp: new Date(),
    });

    await job.save();

    // Also sync to customer file library if linked
    if (job.customerId) {
      await Customer.updateOne(
        { _id: job.customerId, tenantId: new mongoose.Types.ObjectId(tenantId) },
        {
          $push: {
            fileLibrary: {
              fileId,
              name: name.trim(),
              url: url.trim(),
              size: Number(size) || 0,
              mimeType: mimeType.trim(),
              sourceJobCode: job.jobCode,
              addedAt: new Date(),
            },
          },
        }
      );
    }

    ApiResponse.created(res, newFile, `File version v${currentVersion} added to job`);
  });
}

export const jobController = new JobController();
