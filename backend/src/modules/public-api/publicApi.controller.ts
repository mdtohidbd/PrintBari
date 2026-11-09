import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { Job } from '../../models/Job.model';
import { Customer } from '../../models/Customer.model';
import { ShopTransaction } from '../../models/ShopFinance.model';
import { ApiResponse } from '../../utils/apiResponse';
import { BadRequestError, NotFoundError } from '../../errors';
import { automationEventBus } from '../../services/automationEventBus';

export class PublicApiController {
  // ==========================================================================
  // JOBS
  // ==========================================================================

  static listJobs = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant!._id;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
    const status = req.query.status as string | undefined;

    const query: any = { tenantId };
    if (status) query.status = status;

    const [jobs, total] = await Promise.all([
      Job.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Job.countDocuments(query),
    ]);

    ApiResponse.success(
      res,
      {
        jobs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      'Jobs retrieved successfully'
    );
  });

  static getJobByCode = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant!._id;
    const { jobCode } = req.params;

    const job = await Job.findOne({ tenantId, jobCode }).lean();
    if (!job) throw new NotFoundError(`Job order ${jobCode} not found`);

    ApiResponse.success(res, job, 'Job retrieved successfully');
  });

  static createJob = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant!._id;
    const { serviceType, customerName, customerPhone, totalAmount, notes } = req.body;

    if (!serviceType) {
      throw new BadRequestError('serviceType is required (e.g., PASSPORT_PHOTO, DOCUMENT_A4, ID_CARD)');
    }

    const jobCode = `JOB-${Date.now().toString(36).toUpperCase()}`;

    let customerId;
    if (customerPhone) {
      let customer = await Customer.findOne({ tenantId, phone: customerPhone });
      if (!customer && customerName) {
        customer = await Customer.create({
          tenantId,
          fullName: customerName,
          phone: customerPhone,
        });
      }
      if (customer) customerId = customer._id;
    }

    const newJob = await Job.create({
      tenantId,
      jobCode,
      serviceType,
      status: 'PENDING',
      customerId,
      customerName: customerName || 'Walk-in Customer',
      customerPhone: customerPhone || '',
      notes: notes || '',
      paymentStatus: 'UNPAID',
      totalAmount: totalAmount || 0,
      paidAmount: 0,
    });

    // Fire event bus (which also triggers webhooks)
    automationEventBus.emit('JOB_CREATED', {
      tenantId: tenantId.toString(),
      jobId: newJob._id.toString(),
      jobCode: newJob.jobCode,
      customerName: newJob.customerName,
      customerPhone: newJob.customerPhone,
      serviceType: newJob.serviceType,
      totalAmount: newJob.totalAmount,
    });

    ApiResponse.created(res, newJob, 'Job created successfully via Developer API');
  });

  // ==========================================================================
  // CUSTOMERS
  // ==========================================================================

  static listCustomers = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant!._id;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);

    const [customers, total] = await Promise.all([
      Customer.find({ tenantId, isDeleted: false })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Customer.countDocuments({ tenantId, isDeleted: false }),
    ]);

    ApiResponse.success(
      res,
      {
        customers,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
      'Customers retrieved'
    );
  });

  static createCustomer = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant!._id;
    const { name, fullName, phone, email, address, notes } = req.body;
    const customerFullName = (fullName || name || '').trim();

    if (!customerFullName || !phone) {
      throw new BadRequestError('Customer name/fullName and phone are required');
    }

    const customer = await Customer.create({
      tenantId,
      fullName: customerFullName,
      phone: phone.trim(),
      email: email?.trim(),
      address: address?.trim(),
      notes: notes?.trim(),
    });

    ApiResponse.created(res, customer, 'Customer created successfully via Developer API');
  });

  // ==========================================================================
  // FINANCE
  // ==========================================================================

  static listTransactions = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant!._id;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);

    const [transactions, total] = await Promise.all([
      ShopTransaction.find({ tenantId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ShopTransaction.countDocuments({ tenantId }),
    ]);

    ApiResponse.success(
      res,
      {
        transactions,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
      'Transactions retrieved'
    );
  });
}
