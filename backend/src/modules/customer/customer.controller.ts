import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Customer, ICustomer, ICustomerFile } from '../../models/Customer.model';
import { Job } from '../../models/Job.model';
import { AuditLog } from '../../models/AuditLog.model';
import { ApiResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../errors';

export class CustomerController {
  /**
   * List customers with search, pagination, and sorting
   */
  public listCustomers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const { search, page = '1', limit = '20', activeOnly } = req.query;

    const query: any = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    };

    if (activeOnly === 'true') {
      query.isActive = true;
    }

    if (search) {
      const searchRegex = new RegExp(String(search).trim(), 'i');
      query.$or = [
        { fullName: searchRegex },
        { phone: searchRegex },
        { email: searchRegex },
      ];
    }

    const pageSize = Math.min(100, Math.max(1, parseInt(String(limit))));
    const pageNum = Math.max(1, parseInt(String(page)));
    const skip = (pageNum - 1) * pageSize;

    const [customers, totalCount] = await Promise.all([
      Customer.find(query)
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      Customer.countDocuments(query),
    ]);

    ApiResponse.success(
      res,
      {
        customers,
        pagination: {
          total: totalCount,
          page: pageNum,
          pageSize,
          totalPages: Math.ceil(totalCount / pageSize) || 1,
        },
      },
      'Customers list retrieved'
    );
  });

  /**
   * Create a new customer
   */
  public createCustomer = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const { fullName, phone, email, address = '', notes = '' } = req.body;

    if (!fullName || !fullName.trim()) {
      throw new BadRequestError('Customer full name is required');
    }

    if (!phone || !phone.trim()) {
      throw new BadRequestError('Customer phone number is required');
    }

    // Check duplicate phone in same tenant
    const existing = await Customer.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      phone: phone.trim(),
      isDeleted: false,
    });

    if (existing) {
      throw new BadRequestError(`Customer with phone ${phone.trim()} already exists in this shop`);
    }

    const customer = await Customer.create({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : undefined,
      address: address.trim(),
      notes: notes.trim(),
      totalOrdersCount: 0,
      totalSpent: 0,
      lastVisitAt: new Date(),
      isActive: true,
      isDeleted: false,
      fileLibrary: [],
    });

    await AuditLog.create({
      tenantId,
      userId: req.user?._id,
      action: 'CUSTOMER_CREATED',
      details: { customerId: customer._id, fullName: customer.fullName, phone: customer.phone },
      status: 'SUCCESS',
    });

    ApiResponse.created(res, customer, 'Customer created successfully');
  });

  /**
   * Get single customer profile with full statistics and file library
   */
  public getCustomer = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const id = String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid customer ID');
    }

    const customer = await Customer.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    }).lean();

    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    // Also fetch recent jobs for this customer
    const recentJobs = await Job.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      customerId: new mongoose.Types.ObjectId(id),
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    ApiResponse.success(
      res,
      {
        ...customer,
        recentJobs,
      },
      'Customer profile retrieved'
    );
  });

  /**
   * Update customer information
   */
  public updateCustomer = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const id = String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    const { fullName, phone, email, address, notes, isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid customer ID');
    }

    const customer = await Customer.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    });

    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    // If phone updated, ensure no collision with another customer
    if (phone && phone.trim() !== customer.phone) {
      const collision = await Customer.findOne({
        _id: { $ne: customer._id },
        tenantId: new mongoose.Types.ObjectId(tenantId),
        phone: phone.trim(),
        isDeleted: false,
      });
      if (collision) {
        throw new BadRequestError(`Another customer already has phone number ${phone.trim()}`);
      }
      customer.phone = phone.trim();
    }

    if (fullName !== undefined) customer.fullName = fullName.trim();
    if (email !== undefined) customer.email = email ? email.trim() : undefined;
    if (address !== undefined) customer.address = address.trim();
    if (notes !== undefined) customer.notes = notes.trim();
    if (isActive !== undefined) customer.isActive = Boolean(isActive);

    customer.lastVisitAt = new Date();
    await customer.save();

    await AuditLog.create({
      tenantId,
      userId: req.user?._id,
      action: 'CUSTOMER_UPDATED',
      details: { customerId: customer._id, fullName: customer.fullName },
      status: 'SUCCESS',
    });

    ApiResponse.success(res, customer, 'Customer profile updated');
  });

  /**
   * Delete customer (soft delete)
   */
  public deleteCustomer = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const id = String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid customer ID');
    }

    const customer = await Customer.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    });

    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    customer.isDeleted = true;
    customer.isActive = false;
    await customer.save();

    await AuditLog.create({
      tenantId,
      userId: req.user?._id,
      action: 'CUSTOMER_DELETED',
      details: { customerId: customer._id, fullName: customer.fullName },
      status: 'SUCCESS',
    });

    ApiResponse.success(res, null, 'Customer deleted successfully');
  });

  /**
   * GDPR / Privacy: Permanent Purge (Right to be Forgotten)
   * Scrubs PII while maintaining financial order consistency
   */
  public permanentPurgeCustomer = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const id = String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid customer ID');
    }

    // Role check: Only OWNER or SUPER_ADMIN
    if (req.user?.role !== 'OWNER' && req.user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('Only Shop Owners or Super Admins are authorized to permanently purge customer data');
    }

    const customer = await Customer.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    });

    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    // Anonymize and redact all PII
    const redactedPhone = `PURGED-${customer._id.toString().slice(-6)}`;
    customer.fullName = 'Purged Customer (GDPR)';
    customer.phone = redactedPhone;
    customer.email = undefined;
    customer.address = '';
    customer.notes = '[Purged upon customer privacy request]';
    customer.fileLibrary = [];
    customer.isDeleted = true;
    customer.isActive = false;

    await customer.save();

    await AuditLog.create({
      tenantId,
      userId: req.user?._id,
      action: 'CUSTOMER_PERMANENTLY_PURGED',
      details: { customerId: customer._id, reason: 'Right to be forgotten request' },
      status: 'SUCCESS',
    });

    ApiResponse.success(res, { customerId: customer._id, status: 'PURGED' }, 'Customer PII permanently purged');
  });

  /**
   * Get all past jobs for this customer
   */
  public getCustomerJobs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const id = String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    const { page = '1', limit = '20' } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid customer ID');
    }

    const pageSize = Math.min(100, Math.max(1, parseInt(String(limit))));
    const pageNum = Math.max(1, parseInt(String(page)));
    const skip = (pageNum - 1) * pageSize;

    const query = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      customerId: new mongoose.Types.ObjectId(id),
    };

    const [jobs, totalCount] = await Promise.all([
      Job.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .populate('assignedTo', 'fullName role')
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
      'Customer jobs history retrieved'
    );
  });

  /**
   * Get customer file library
   */
  public getCustomerFiles = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const id = String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid customer ID');
    }

    const customer = await Customer.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    }).lean();

    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    ApiResponse.success(res, customer.fileLibrary || [], 'Customer file library retrieved');
  });

  /**
   * Add file to customer file library
   */
  public addCustomerFile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const id = String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    const { name, url, size = 0, mimeType = 'application/octet-stream', sourceJobCode } = req.body;

    if (!name || !url) {
      throw new BadRequestError('File name and url are required');
    }

    const customer = await Customer.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    });

    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    const fileId = `FILE-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const newFile: ICustomerFile = {
      fileId,
      name: name.trim(),
      url: url.trim(),
      size: Number(size) || 0,
      mimeType: mimeType.trim(),
      sourceJobCode: sourceJobCode ? sourceJobCode.trim() : undefined,
      addedAt: new Date(),
    };

    customer.fileLibrary.unshift(newFile);
    await customer.save();

    ApiResponse.created(res, newFile, 'File added to customer library');
  });

  /**
   * Delete file from customer library
   */
  public deleteCustomerFile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const id = String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    const fileId = String(Array.isArray(req.params.fileId) ? req.params.fileId[0] : req.params.fileId);

    const customer = await Customer.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    });

    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    customer.fileLibrary = customer.fileLibrary.filter((f) => f.fileId !== fileId);
    await customer.save();

    ApiResponse.success(res, null, 'File removed from customer library');
  });

  /**
   * Fast customer search / phone lookup for shop counter
   */
  public lookupCustomer = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const { phone, query } = req.query;

    const searchTerm = (phone || query || '').toString().trim();
    if (!searchTerm) {
      throw new BadRequestError('Phone number or search query is required');
    }

    // Try exact phone match first (indexed)
    let customer = await Customer.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      phone: searchTerm,
      isDeleted: false,
    }).lean();

    // If not exact match, search by regex on phone or name
    if (!customer) {
      const searchRegex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      customer = await Customer.findOne({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        isDeleted: false,
        $or: [{ phone: searchRegex }, { fullName: searchRegex }],
      }).lean();
    }

    if (!customer) {
      ApiResponse.success(res, { found: false, customer: null }, 'Customer not found');
      return;
    }

    // Fetch recent 5 jobs for counter convenience
    const recentJobs = await Job.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      customerId: customer._id,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('jobCode serviceType status totalAmount paidAmount createdAt')
      .lean();

    ApiResponse.success(
      res,
      {
        found: true,
        customer,
        recentJobs,
      },
      'Customer found'
    );
  });

  /**
   * Get complete customer activity timeline (orders, notes, file library, audit logs)
   */
  public getCustomerActivity = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const id = String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid customer ID');
    }

    const customer = await Customer.findOne({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    }).lean();

    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    // Fetch jobs for customer
    const jobs = await Job.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      customerId: new mongoose.Types.ObjectId(id),
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Fetch customer audit logs
    const auditLogs = await AuditLog.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      'details.customerId': new mongoose.Types.ObjectId(id),
    })
      .sort({ timestamp: -1 })
      .limit(30)
      .lean();

    // Construct unified activity timeline
    const activities: Array<{
      id: string;
      type: 'JOB' | 'FILE' | 'AUDIT';
      title: string;
      description: string;
      timestamp: Date;
      data?: Record<string, any>;
    }> = [];

    // Add job events
    for (const j of jobs) {
      activities.push({
        id: `job-${j._id}`,
        type: 'JOB',
        title: `Job ${j.jobCode} (${j.serviceType})`,
        description: `Status: ${j.status}, Amount: ${j.totalAmount} BDT (Paid: ${j.paidAmount} BDT)`,
        timestamp: j.createdAt,
        data: { jobId: j._id, jobCode: j.jobCode, status: j.status },
      });
    }

    // Add customer file uploads
    if (Array.isArray(customer.fileLibrary)) {
      for (const f of customer.fileLibrary) {
        activities.push({
          id: `file-${f.fileId}`,
          type: 'FILE',
          title: `File Saved: ${f.name}`,
          description: `Source: ${f.sourceJobCode || 'Uploaded directly'}, Size: ${f.size || 0} bytes`,
          timestamp: f.addedAt,
          data: { fileId: f.fileId, url: f.url },
        });
      }
    }

    // Add audit log events
    for (const a of auditLogs) {
      activities.push({
        id: `audit-${a._id}`,
        type: 'AUDIT',
        title: a.action,
        description: `Customer account event: ${a.action}`,
        timestamp: a.timestamp,
        data: a.details,
      });
    }

    // Sort combined timeline by timestamp descending
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    ApiResponse.success(
      res,
      {
        customer: {
          _id: customer._id,
          fullName: customer.fullName,
          phone: customer.phone,
          notes: customer.notes,
          totalOrdersCount: customer.totalOrdersCount,
          totalSpent: customer.totalSpent,
          lastVisitAt: customer.lastVisitAt,
        },
        activityCount: activities.length,
        activities,
      },
      'Customer activity timeline retrieved'
    );
  });
}

export const customerController = new CustomerController();
