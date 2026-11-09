import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User, IUser } from '../../models/User.model';
import { Tenant } from '../../models/Tenant.model';
import { AuditLog } from '../../models/AuditLog.model';
import { ApiResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { BadRequestError, ConflictError, NotFoundError, ForbiddenError } from '../../errors';
import { env } from '../../config/env';

export class TenantController {
  /**
   * Get basic current tenant summary
   */
  public getCurrentTenant = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenant = req.tenant!;
    const activeStaffCount = await User.countDocuments({
      tenantId: tenant._id,
      isActive: true,
    });

    ApiResponse.success(
      res,
      {
        id: tenant._id,
        businessId: tenant.businessId,
        name: tenant.name,
        subdomain: tenant.subdomain,
        logoUrl: tenant.logoUrl,
        phone: tenant.phone,
        email: tenant.email,
        address: tenant.address,
        subscription: tenant.subscription,
        quotas: {
          ...tenant.quotas,
          activeStaffCount,
          seatsAvailable: Math.max(0, tenant.quotas.maxStaffSeats - activeStaffCount),
        },
        settings: tenant.settings,
        workingHours: tenant.workingHours,
        invoiceSettings: tenant.invoiceSettings,
        printSettings: tenant.printSettings,
        isActive: tenant.isActive,
      },
      'Current shop profile retrieved'
    );
  });

  /**
   * Update core shop profile (Name, Logo, Contact, Address)
   */
  public updateProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenant = req.tenant!;
    const { name, logoUrl, phone, email, address } = req.body;

    if (name) tenant.name = name.trim();
    if (logoUrl !== undefined) tenant.logoUrl = logoUrl;
    if (phone !== undefined) tenant.phone = phone.trim();
    if (email !== undefined) tenant.email = email.trim();
    if (address) {
      tenant.address = {
        street: address.street || '',
        city: address.city || '',
        state: address.state || '',
        postalCode: address.postalCode || '',
        country: address.country || '',
      };
    }

    await tenant.save();

    await AuditLog.create({
      tenantId: tenant._id,
      userId: req.user?._id,
      action: 'SHOP_PROFILE_UPDATED',
      details: { name: tenant.name, phone: tenant.phone },
      status: 'SUCCESS',
    });

    ApiResponse.success(res, tenant, 'Shop profile updated successfully');
  });

  /**
   * Update working hours schedule
   */
  public updateWorkingHours = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenant = req.tenant!;
    const workingHours = req.body.workingHours || req.body;

    if (!workingHours || typeof workingHours !== 'object') {
      throw new BadRequestError('Invalid working hours configuration');
    }

    tenant.workingHours = {
      ...tenant.workingHours,
      ...workingHours,
    };
    await tenant.save();

    await AuditLog.create({
      tenantId: tenant._id,
      userId: req.user?._id,
      action: 'WORKING_HOURS_UPDATED',
      status: 'SUCCESS',
    });

    ApiResponse.success(res, tenant.workingHours, 'Working hours updated successfully');
  });

  /**
   * Update invoice formatting & tax settings
   */
  public updateInvoiceSettings = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenant = req.tenant!;
    const { prefix, nextNumber, footerNote, taxId, taxRatePercent } = req.body;

    if (prefix) tenant.invoiceSettings.prefix = prefix.trim();
    if (nextNumber !== undefined) tenant.invoiceSettings.nextNumber = Number(nextNumber);
    if (footerNote !== undefined) tenant.invoiceSettings.footerNote = footerNote;
    if (taxId !== undefined) tenant.invoiceSettings.taxId = taxId.trim();
    if (taxRatePercent !== undefined) tenant.invoiceSettings.taxRatePercent = Number(taxRatePercent);

    await tenant.save();

    await AuditLog.create({
      tenantId: tenant._id,
      userId: req.user?._id,
      action: 'INVOICE_SETTINGS_UPDATED',
      status: 'SUCCESS',
    });

    ApiResponse.success(res, tenant.invoiceSettings, 'Invoice settings updated successfully');
  });

  /**
   * Update hardware print preferences
   */
  public updatePrintSettings = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenant = req.tenant!;
    const { defaultPaperSize, autoPrintReceipt, printerDpi, headerMarginMm } = req.body;

    if (defaultPaperSize) tenant.printSettings.defaultPaperSize = defaultPaperSize;
    if (autoPrintReceipt !== undefined) tenant.printSettings.autoPrintReceipt = Boolean(autoPrintReceipt);
    if (printerDpi !== undefined) tenant.printSettings.printerDpi = Number(printerDpi);
    if (headerMarginMm !== undefined) tenant.printSettings.headerMarginMm = Number(headerMarginMm);

    await tenant.save();

    await AuditLog.create({
      tenantId: tenant._id,
      userId: req.user?._id,
      action: 'PRINT_SETTINGS_UPDATED',
      status: 'SUCCESS',
    });

    ApiResponse.success(res, tenant.printSettings, 'Print settings updated successfully');
  });

  /**
   * List staff with optional search, role filter, and active/inactive filter
   */
  public listStaff = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const { search, role, status } = req.query;

    const query: any = { tenantId };

    if (status === 'ACTIVE') query.isActive = true;
    else if (status === 'INACTIVE') query.isActive = false;

    if (role && role !== 'ALL') query.role = role;

    if (search) {
      const searchRegex = new RegExp(String(search).trim(), 'i');
      query.$or = [{ fullName: searchRegex }, { email: searchRegex }, { phone: searchRegex }];
    }

    const staff = await User.find(query)
      .select('fullName email phone role isEmailVerified isActive lastLoginAt createdAt')
      .sort({ createdAt: -1 });

    ApiResponse.success(res, staff, 'Shop staff list retrieved');
  });

  /**
   * Add new staff member with seat quota check
   */
  public addStaff = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenant = req.tenant!;
    const { fullName, email, password, role, phone } = req.body;
    const cleanEmail = email.toLowerCase().trim();

    // 1. Check Staff Seat Quota
    const currentStaffCount = await User.countDocuments({
      tenantId: tenant._id,
      isActive: true,
    });

    if (currentStaffCount >= tenant.quotas.maxStaffSeats) {
      throw new ForbiddenError(
        `Staff seat limit (${tenant.quotas.maxStaffSeats}) reached for your ${tenant.subscription.plan} plan. Please upgrade your plan to add more operators.`
      );
    }

    // 2. Check if email is already registered in this tenant
    const existingUser = await User.findOne({ tenantId: tenant._id, email: cleanEmail });
    if (existingUser) {
      throw new ConflictError(`User with email "${cleanEmail}" is already registered in this shop`);
    }

    // 3. Hash password
    const salt = await bcrypt.genSalt(env.BCRYPT_SALT_ROUNDS);
    const passwordHash = await bcrypt.hash(password, salt);

    // 4. Create Staff User
    const newStaff = await User.create({
      tenantId: tenant._id,
      fullName: fullName.trim(),
      email: cleanEmail,
      phone,
      passwordHash,
      role,
      isEmailVerified: true,
      isActive: true,
    });

    await AuditLog.create({
      tenantId: tenant._id,
      userId: req.user?._id,
      action: 'STAFF_MEMBER_CREATED',
      details: { staffId: newStaff._id, role: newStaff.role, email: newStaff.email },
      status: 'SUCCESS',
    });

    ApiResponse.created(
      res,
      {
        id: newStaff._id,
        fullName: newStaff.fullName,
        email: newStaff.email,
        role: newStaff.role,
        phone: newStaff.phone,
        isActive: newStaff.isActive,
      },
      'Staff member added successfully'
    );
  });

  /**
   * Edit staff profile (name, phone, role)
   */
  public editStaff = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const { staffId } = req.params;
    const { fullName, phone, role } = req.body;

    const staff = await User.findOne({ _id: staffId, tenantId });
    if (!staff) {
      throw new NotFoundError('Staff member not found in your shop');
    }

    if (staff.role === 'OWNER' && role && role !== 'OWNER') {
      throw new ForbiddenError('Cannot change the role of the primary Shop Owner');
    }

    if (fullName) staff.fullName = fullName.trim();
    if (phone !== undefined) staff.phone = phone.trim();
    if (role && staff.role !== 'OWNER') staff.role = role;

    await staff.save();

    await AuditLog.create({
      tenantId,
      userId: req.user?._id,
      action: 'STAFF_MEMBER_UPDATED',
      details: { staffId, fullName: staff.fullName, role: staff.role },
      status: 'SUCCESS',
    });

    ApiResponse.success(res, staff, 'Staff details updated successfully');
  });

  /**
   * Toggle staff status (activate / deactivate)
   */
  public toggleStaffStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenant = req.tenant!;
    const { staffId } = req.params;

    const staff = await User.findOne({ _id: staffId, tenantId: tenant._id });
    if (!staff) {
      throw new NotFoundError('Staff member not found in your shop');
    }

    if (staff.role === 'OWNER') {
      throw new ForbiddenError('Cannot deactivate the primary Shop Owner account');
    }

    if (staff._id.toString() === req.user?._id.toString()) {
      throw new BadRequestError('You cannot deactivate your own account');
    }

    // If activating, verify quota limit
    if (!staff.isActive) {
      const activeCount = await User.countDocuments({ tenantId: tenant._id, isActive: true });
      if (activeCount >= tenant.quotas.maxStaffSeats) {
        throw new ForbiddenError(
          `Cannot activate staff. Seat limit (${tenant.quotas.maxStaffSeats}) reached.`
        );
      }
    }

    staff.isActive = !staff.isActive;
    await staff.save();

    await AuditLog.create({
      tenantId: tenant._id,
      userId: req.user?._id,
      action: staff.isActive ? 'STAFF_MEMBER_ACTIVATED' : 'STAFF_MEMBER_DEACTIVATED',
      details: { staffId, email: staff.email },
      status: 'SUCCESS',
    });

    ApiResponse.success(
      res,
      { id: staff._id, isActive: staff.isActive },
      `Staff member ${staff.isActive ? 'activated' : 'deactivated'} successfully`
    );
  });

  /**
   * Fetch activity history for a specific staff member
   */
  public getStaffActivity = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const { staffId } = req.params;

    const activities = await AuditLog.find({ tenantId, userId: staffId })
      .sort({ timestamp: -1 })
      .limit(20)
      .lean();

    ApiResponse.success(res, activities, 'Staff activity history retrieved');
  });
}

export const tenantController = new TenantController();
