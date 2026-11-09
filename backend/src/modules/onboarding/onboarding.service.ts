import mongoose from 'mongoose';
import { OnboardingState, IOnboardingState, ONBOARDING_STEPS_ORDER } from '../../models/Onboarding.model';
import { Tenant } from '../../models/Tenant.model';
import { User } from '../../models/User.model';
import { Customer } from '../../models/Customer.model';
import { Job, JobServiceType, JobStatus, JobPriority } from '../../models/Job.model';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../errors';

export class OnboardingService {
  /**
   * Helper: Resolve tenantId from string (subdomain or 24-char ObjectId) to ObjectId
   */
  private async resolveTenantId(tenantId: string | mongoose.Types.ObjectId): Promise<mongoose.Types.ObjectId> {
    if (tenantId instanceof mongoose.Types.ObjectId) {
      return tenantId;
    }
    if (mongoose.Types.ObjectId.isValid(tenantId) && tenantId.length === 24) {
      return new mongoose.Types.ObjectId(tenantId);
    }
    const tenant = await Tenant.findOne({ subdomain: tenantId }).select('_id');
    if (!tenant) {
      throw new NotFoundError(`Tenant '${tenantId}' not found`);
    }
    return tenant._id as mongoose.Types.ObjectId;
  }

  /**
   * Get or initialize Onboarding State for a tenant
   */
  public async getOnboardingState(tenantIdInput: string | mongoose.Types.ObjectId) {
    const tenantId = await this.resolveTenantId(tenantIdInput);
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    let state = await OnboardingState.findOne({ tenantId });
    if (!state) {
      state = await OnboardingState.create({
        tenantId,
        currentStep: 1,
        currentStepName: 'WELCOME',
        completedSteps: [],
        skippedSteps: [],
        isCompleted: false,
        stepData: {
          businessProfile: {
            shopName: tenant.name,
            phone: tenant.phone || '',
            address: tenant.address?.street || '',
            currency: tenant.settings?.currency || 'BDT',
            timezone: tenant.settings?.timezone || 'Asia/Dhaka',
          },
          servicesConfigured: ['PASSPORT_PHOTO', 'ID_CARD_A4', 'DOCUMENT_A4'],
          servicePricing: [
            { serviceType: 'PASSPORT_PHOTO', price: 300, paperType: 'GLOSSY_PHOTO_260GSM' },
            { serviceType: 'ID_CARD_A4', price: 150, paperType: 'LAMINATION_POUCH_150MIC' },
            { serviceType: 'DOCUMENT_A4', price: 20, paperType: 'BOND_80GSM' },
            { serviceType: 'CV_BUILDER', price: 120, paperType: 'MATTE_120GSM' },
            { serviceType: 'HANDWRITING_OCR', price: 50, paperType: 'DIGITAL_EXPORT' },
          ],
          printSettings: {
            defaultPaperSize: tenant.printSettings?.defaultPaperSize || 'A4',
            defaultDpi: tenant.printSettings?.printerDpi || 300,
            printerModel: 'Epson L805',
            marginOffsetXmm: 0,
            marginOffsetYmm: 0,
          },
        },
        checklist: {
          shopProfileCompleted: false,
          pricingConfigured: false,
          firstStaffInvited: false,
          firstCustomerCreated: false,
          firstJobCreated: false,
          firstJobCompleted: false,
          firstPrintExported: false,
        },
      });
    }

    // Refresh checklist from actual database activity if not already completed
    if (!state.checklist.firstCustomerCreated) {
      const custCount = await Customer.countDocuments({ tenantId, isDeleted: false });
      if (custCount > 0) state.checklist.firstCustomerCreated = true;
    }
    if (!state.checklist.firstStaffInvited) {
      const staffCount = await User.countDocuments({ tenantId, role: { $in: ['STAFF', 'OPERATOR', 'MANAGER'] } });
      if (staffCount > 0) state.checklist.firstStaffInvited = true;
    }
    if (!state.checklist.firstJobCreated) {
      const jobCount = await Job.countDocuments({ tenantId });
      if (jobCount > 0) state.checklist.firstJobCreated = true;
    }
    if (!state.checklist.firstJobCompleted) {
      const compCount = await Job.countDocuments({ tenantId, status: 'COMPLETED' });
      if (compCount > 0) {
        state.checklist.firstJobCompleted = true;
        state.checklist.firstPrintExported = true;
      }
    }

    // Calculate completion metrics
    const totalSteps = 10;
    const progressPercent = Math.round((state.completedSteps.length / totalSteps) * 100);

    return {
      state,
      progressPercent,
      tenantDetails: {
        id: tenant._id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        plan: tenant.subscription.plan,
        maxStaffSeats: tenant.quotas.maxStaffSeats,
      },
    };
  }

  /**
   * Save Step Progress (Save & Resume Workflow)
   */
  public async saveStep(
    tenantIdInput: string | mongoose.Types.ObjectId,
    user: { id: string; role: string; fullName: string },
    stepNumber: number,
    payload: Record<string, any>
  ) {
    if (stepNumber < 1 || stepNumber > 10) {
      throw new BadRequestError('Invalid step number. Must be between 1 and 10.');
    }

    const tenantId = await this.resolveTenantId(tenantIdInput);
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant not found');

    const stateDoc = await OnboardingState.findOne({ tenantId });
    if (!stateDoc) throw new NotFoundError('Onboarding state not found. Initialize first.');

    // RBAC: Steps 2-7 configure shop-wide settings, requiring OWNER or MANAGER
    if ([2, 3, 4, 5, 6, 7].includes(stepNumber)) {
      if (!['OWNER', 'SHOP_OWNER', 'MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
        throw new ForbiddenError('Shop Owner or Manager permission required to configure shop settings.');
      }
    }

    // Apply Step-Specific Actions
    switch (stepNumber) {
      case 1: // WELCOME
        // Just acknowledged
        break;

      case 2: // BUSINESS_PROFILE
        if (payload.shopName) tenant.name = payload.shopName;
        if (payload.phone) tenant.phone = payload.phone;
        if (payload.address) {
          tenant.address = {
            street: payload.address,
            city: payload.city || 'Dhaka',
            state: payload.state || 'Dhaka',
            postalCode: payload.postalCode || '1205',
            country: 'Bangladesh',
          };
        }
        if (payload.currency) tenant.settings.currency = payload.currency;
        if (payload.timezone) tenant.settings.timezone = payload.timezone;
        await tenant.save();

        stateDoc.stepData.businessProfile = {
          shopName: tenant.name,
          phone: tenant.phone || '',
          address: tenant.address?.street || '',
          currency: tenant.settings.currency,
          timezone: tenant.settings.timezone,
          taxId: payload.taxId || '',
        };
        stateDoc.checklist.shopProfileCompleted = true;
        this.recordActivationEvent(stateDoc, 'SHOP_PROFILE_UPDATED', { shopName: tenant.name });
        break;

      case 3: // SHOP_LOGO
        if (payload.logoUrl) {
          tenant.logoUrl = payload.logoUrl;
          await tenant.save();
          stateDoc.stepData.logoUrl = payload.logoUrl;
          this.recordActivationEvent(stateDoc, 'LOGO_UPLOADED');
        }
        break;

      case 4: // CONFIGURE_SERVICES
        if (Array.isArray(payload.services)) {
          stateDoc.stepData.servicesConfigured = payload.services;
          this.recordActivationEvent(stateDoc, 'SERVICES_CONFIGURED', { count: payload.services.length });
        }
        break;

      case 5: // SERVICE_PRICING
        if (Array.isArray(payload.pricing)) {
          stateDoc.stepData.servicePricing = payload.pricing;
          stateDoc.checklist.pricingConfigured = true;
          this.recordActivationEvent(stateDoc, 'SERVICE_PRICING_CONFIGURED');
        }
        break;

      case 6: // INVITE_STAFF
        if (payload.staff && Array.isArray(payload.staff)) {
          const activeStaffCount = await User.countDocuments({
            tenantId,
            role: { $in: ['STAFF', 'OPERATOR', 'MANAGER'] },
          });

          if (activeStaffCount + payload.staff.length > tenant.quotas.maxStaffSeats) {
            throw new BadRequestError(
              `Adding ${payload.staff.length} staff exceeds your current plan quota (${tenant.quotas.maxStaffSeats} seats). Upgrade plan to add more.`
            );
          }

          const invitedList = [];
          for (const s of payload.staff) {
            if (!s.email || !s.fullName) continue;
            // Create user if not existing
            const existing = await User.findOne({ email: s.email.toLowerCase() });
            if (!existing) {
              await User.create({
                tenantId,
                fullName: s.fullName,
                email: s.email.toLowerCase(),
                passwordHash: '$2b$10$temporaryDefaultPasswordHash123456',
                role: s.role || 'STAFF',
                isActive: true,
                isEmailVerified: true,
              });
            }
            invitedList.push({
              email: s.email.toLowerCase(),
              fullName: s.fullName,
              role: s.role || 'STAFF',
              invitedAt: new Date(),
            });
          }

          stateDoc.stepData.staffInvited = invitedList;
          if (invitedList.length > 0) {
            stateDoc.checklist.firstStaffInvited = true;
            this.recordActivationEvent(stateDoc, 'FIRST_STAFF_INVITED', { count: invitedList.length });
          }
        }
        break;

      case 7: // PRINT_SETTINGS
        if (payload.printSettings) {
          tenant.printSettings = {
            defaultPaperSize: payload.printSettings.defaultPaperSize || 'A4',
            autoPrintReceipt: Boolean(payload.printSettings.autoPrintReceipt),
            printerDpi: Number(payload.printSettings.defaultDpi) || 300,
            headerMarginMm: Number(payload.printSettings.marginOffsetYmm) || 0,
          };
          await tenant.save();

          stateDoc.stepData.printSettings = {
            defaultPaperSize: payload.printSettings.defaultPaperSize || 'A4',
            defaultDpi: Number(payload.printSettings.defaultDpi) || 300,
            printerModel: payload.printSettings.printerModel || 'Epson L805',
            marginOffsetXmm: Number(payload.printSettings.marginOffsetXmm) || 0,
            marginOffsetYmm: Number(payload.printSettings.marginOffsetYmm) || 0,
          };
          this.recordActivationEvent(stateDoc, 'PRINT_SETTINGS_CONFIGURED');
        }
        break;

      case 8: // FIRST_CUSTOMER
        if (payload.customer) {
          const { fullName, phone, email } = payload.customer;
          if (!fullName || !phone) {
            throw new BadRequestError('Customer full name and mobile phone are required.');
          }

          let customer = await Customer.findOne({ tenantId, phone });
          if (!customer) {
            customer = await Customer.create({
              tenantId,
              fullName,
              phone,
              email: email || '',
              totalOrdersCount: 0,
              totalSpent: 0,
              lastVisitAt: new Date(),
              isActive: true,
              isDeleted: false,
            });
          }

          stateDoc.stepData.firstCustomerId = customer._id as mongoose.Types.ObjectId;
          stateDoc.checklist.firstCustomerCreated = true;
          this.recordActivationEvent(stateDoc, 'FIRST_CUSTOMER_CREATED', { customerId: customer._id });
        }
        break;

      case 9: // FIRST_JOB
        if (payload.job) {
          const { customerId, serviceType, title, price } = payload.job;
          let targetCust = customerId ? await Customer.findById(customerId) : null;
          if (!targetCust && stateDoc.stepData.firstCustomerId) {
            targetCust = await Customer.findById(stateDoc.stepData.firstCustomerId);
          }

          if (!targetCust) {
            targetCust = await Customer.create({
              tenantId,
              fullName: 'First Walk-in Customer',
              phone: `01700${Date.now().toString().slice(-6)}`,
              totalOrdersCount: 1,
              totalSpent: price || 300,
              lastVisitAt: new Date(),
              isActive: true,
              isDeleted: false,
            });
          }

          const jobCode = `JOB-${tenant.businessId.slice(-4)}-0001`;
          const job = await Job.create({
            tenantId,
            jobCode,
            customerId: targetCust._id,
            customerName: targetCust.fullName,
            customerPhone: targetCust.phone,
            serviceType: (serviceType as JobServiceType) || 'PASSPORT_PHOTO',
            status: 'PROCESSING',
            priority: 'NORMAL',
            copies: 8,
            paperType: 'GLOSSY_PHOTO_260GSM',
            price: { subtotal: price || 300, discount: 0, tax: 0, totalPrice: price || 300 },
            totalAmount: price || 300,
            paidAmount: price || 300,
            paymentStatus: 'PAID',
            paymentMethod: 'CASH',
            notes: title || 'First studio job from guided onboarding',
          });

          stateDoc.stepData.firstJobId = job._id as mongoose.Types.ObjectId;
          stateDoc.checklist.firstJobCreated = true;
          this.recordActivationEvent(stateDoc, 'FIRST_JOB_CREATED', { jobCode: job.jobCode });
        }
        break;

      case 10: // COMPLETE_FIRST_JOB
        if (stateDoc.stepData.firstJobId) {
          const job = await Job.findById(stateDoc.stepData.firstJobId);
          if (job) {
            job.status = 'COMPLETED';
            job.completedAt = new Date();
            await job.save();
          }
        }
        stateDoc.checklist.firstJobCompleted = true;
        stateDoc.checklist.firstPrintExported = true;
        stateDoc.isCompleted = true;
        stateDoc.completedAt = new Date();
        this.recordActivationEvent(stateDoc, 'FIRST_JOB_COMPLETED');
        this.recordActivationEvent(stateDoc, 'SHOP_SETUP_COMPLETED');
        break;
    }

    // Mark step completed
    if (!stateDoc.completedSteps.includes(stepNumber)) {
      stateDoc.completedSteps.push(stepNumber);
      stateDoc.completedSteps.sort((a, b) => a - b);
    }
    // Remove from skipped if completed now
    stateDoc.skippedSteps = stateDoc.skippedSteps.filter((s) => s !== stepNumber);

    // Advance currentStep to next incomplete step (or step 10 if done)
    if (stepNumber < 10) {
      stateDoc.currentStep = stepNumber + 1;
      stateDoc.currentStepName = ONBOARDING_STEPS_ORDER[stepNumber];
    } else {
      stateDoc.currentStep = 10;
      stateDoc.currentStepName = 'COMPLETE_FIRST_JOB';
    }

    await stateDoc.save();
    return this.getOnboardingState(tenantId);
  }

  /**
   * Skip an optional step (e.g. Logo upload, Staff Invite, CSV import)
   */
  public async skipStep(tenantIdInput: string | mongoose.Types.ObjectId, stepNumber: number) {
    if (stepNumber < 1 || stepNumber > 10) {
      throw new BadRequestError('Invalid step number to skip.');
    }

    const tenantId = await this.resolveTenantId(tenantIdInput);
    const stateDoc = await OnboardingState.findOne({ tenantId });
    if (!stateDoc) throw new NotFoundError('Onboarding state not found.');

    if (!stateDoc.skippedSteps.includes(stepNumber)) {
      stateDoc.skippedSteps.push(stepNumber);
    }

    if (stepNumber < 10) {
      stateDoc.currentStep = stepNumber + 1;
      stateDoc.currentStepName = ONBOARDING_STEPS_ORDER[stepNumber];
    }

    await stateDoc.save();
    return this.getOnboardingState(tenantId);
  }

  /**
   * Seed Demo Workspace with Synthetic Sample Data
   */
  public async seedSampleWorkspace(tenantIdInput: string | mongoose.Types.ObjectId) {
    const tenantId = await this.resolveTenantId(tenantIdInput);
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant not found');

    const stateDoc = await OnboardingState.findOne({ tenantId });
    if (!stateDoc) throw new NotFoundError('Onboarding state not found');

    if (stateDoc.hasSampleData) {
      return { message: 'Sample workspace already seeded', hasSampleData: true };
    }

    const timestamp = Date.now();
    // 1. Create 2 synthetic sample customers
    const cust1 = await Customer.create({
      tenantId,
      fullName: 'Demo Customer: Rafiqul Islam (Sample)',
      phone: `01799${timestamp.toString().slice(-6)}`,
      email: 'demo.rafiqul@example.com',
      totalOrdersCount: 2,
      totalSpent: 450,
      notes: '[SAMPLE DATA] Safe to remove at any time.',
      lastVisitAt: new Date(),
      isActive: true,
      isDeleted: false,
    });

    const cust2 = await Customer.create({
      tenantId,
      fullName: 'Demo Customer: Salma Begum (Sample)',
      phone: `01899${timestamp.toString().slice(-6)}`,
      email: 'demo.salma@example.com',
      totalOrdersCount: 1,
      totalSpent: 150,
      notes: '[SAMPLE DATA] Safe to remove at any time.',
      lastVisitAt: new Date(),
      isActive: true,
      isDeleted: false,
    });

    // 2. Create 2 sample jobs
    const job1 = await Job.create({
      tenantId,
      jobCode: `SAMPLE-JOB-${timestamp.toString().slice(-4)}-01`,
      customerId: cust1._id,
      customerName: cust1.fullName,
      customerPhone: cust1.phone,
      serviceType: 'PASSPORT_PHOTO',
      status: 'PRINT_READY',
      priority: 'HIGH',
      copies: 8,
      paperType: 'GLOSSY_PHOTO_260GSM',
      price: { subtotal: 300, discount: 0, tax: 0, totalPrice: 300 },
      totalAmount: 300,
      paidAmount: 300,
      paymentStatus: 'PAID',
      paymentMethod: 'CASH',
      notes: '[SAMPLE DATA] Schengen Visa 35x45mm (8 Copies White BG)',
    });

    const job2 = await Job.create({
      tenantId,
      jobCode: `SAMPLE-JOB-${timestamp.toString().slice(-4)}-02`,
      customerId: cust2._id,
      customerName: cust2.fullName,
      customerPhone: cust2.phone,
      serviceType: 'ID_CARD_A4',
      status: 'COMPLETED',
      priority: 'NORMAL',
      copies: 2,
      paperType: 'LAMINATION_POUCH_150MIC',
      price: { subtotal: 150, discount: 0, tax: 0, totalPrice: 150 },
      totalAmount: 150,
      paidAmount: 150,
      paymentStatus: 'PAID',
      paymentMethod: 'BKASH',
      notes: '[SAMPLE DATA] Smart NID Dual-Sided Lamination',
    });

    stateDoc.hasSampleData = true;
    stateDoc.sampleCustomerIds = [cust1._id as mongoose.Types.ObjectId, cust2._id as mongoose.Types.ObjectId];
    stateDoc.sampleJobIds = [job1._id as mongoose.Types.ObjectId, job2._id as mongoose.Types.ObjectId];
    await stateDoc.save();

    return {
      success: true,
      message: 'Demo workspace populated with 2 sample customers and 2 sample jobs.',
      sampleCustomersCount: 2,
      sampleJobsCount: 2,
    };
  }

  /**
   * 1-Click Purge of Sample Data
   */
  public async purgeSampleWorkspace(tenantIdInput: string | mongoose.Types.ObjectId) {
    const tenantId = await this.resolveTenantId(tenantIdInput);
    const stateDoc = await OnboardingState.findOne({ tenantId });
    if (!stateDoc) throw new NotFoundError('Onboarding state not found');

    if (!stateDoc.hasSampleData) {
      return { success: true, message: 'No sample data present in workspace.' };
    }

    // Delete sample jobs
    if (stateDoc.sampleJobIds.length > 0) {
      await Job.deleteMany({ _id: { $in: stateDoc.sampleJobIds }, tenantId });
    }

    // Delete sample customers
    if (stateDoc.sampleCustomerIds.length > 0) {
      await Customer.deleteMany({ _id: { $in: stateDoc.sampleCustomerIds }, tenantId });
    }

    const purgedJobs = stateDoc.sampleJobIds.length;
    const purgedCustomers = stateDoc.sampleCustomerIds.length;

    stateDoc.hasSampleData = false;
    stateDoc.sampleCustomerIds = [];
    stateDoc.sampleJobIds = [];
    await stateDoc.save();

    return {
      success: true,
      message: `Sample data removed successfully (${purgedCustomers} customers, ${purgedJobs} jobs purged).`,
      purgedCustomers,
      purgedJobs,
    };
  }

  /**
   * Customer & Job CSV Import with Strict Validation
   */
  public async importFromCSV(tenantIdInput: string | mongoose.Types.ObjectId, csvContent: string) {
    const tenantId = await this.resolveTenantId(tenantIdInput);
    if (!csvContent || typeof csvContent !== 'string') {
      throw new BadRequestError('CSV content must be provided as text.');
    }

    const lines = csvContent
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      throw new BadRequestError('CSV must contain a header row and at least one data row.');
    }

    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const nameIdx = header.findIndex((h) => h === 'fullname' || h === 'name' || h === 'customername');
    const phoneIdx = header.findIndex((h) => h === 'phone' || h === 'mobile' || h === 'contact');
    const emailIdx = header.findIndex((h) => h === 'email');
    const serviceIdx = header.findIndex((h) => h === 'service' || h === 'servicetype');

    if (nameIdx === -1 || phoneIdx === -1) {
      throw new BadRequestError('CSV header must contain "name" (or "fullName") and "phone" columns.');
    }

    let importedCount = 0;
    let skippedCount = 0;
    const errors: Array<{ row: number; reason: string }> = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim());
      const fullName = parts[nameIdx];
      const phone = parts[phoneIdx]?.replace(/[^0-9]/g, '');
      const email = emailIdx !== -1 ? parts[emailIdx] : '';
      const service = serviceIdx !== -1 ? parts[serviceIdx]?.toUpperCase() : null;

      if (!fullName || fullName.length < 2) {
        errors.push({ row: i + 1, reason: 'Invalid or missing name' });
        skippedCount++;
        continue;
      }

      if (!phone || phone.length < 10 || phone.length > 15) {
        errors.push({ row: i + 1, reason: `Invalid phone format: ${parts[phoneIdx]}` });
        skippedCount++;
        continue;
      }

      try {
        let customer = await Customer.findOne({ tenantId, phone });
        if (!customer) {
          customer = await Customer.create({
            tenantId,
            fullName,
            phone,
            email: email || '',
            totalOrdersCount: service ? 1 : 0,
            totalSpent: 0,
            lastVisitAt: new Date(),
            isActive: true,
            isDeleted: false,
          });
          importedCount++;
        } else {
          // Update customer name if empty
          if (!customer.fullName) customer.fullName = fullName;
          await customer.save();
          skippedCount++;
        }
      } catch (err: any) {
        errors.push({ row: i + 1, reason: err.message });
        skippedCount++;
      }
    }

    return {
      totalRows: lines.length - 1,
      importedCount,
      skippedCount,
      errors,
    };
  }

  /**
   * Mark Product Tour Completed
   */
  public async completeTour(tenantIdInput: string | mongoose.Types.ObjectId) {
    const tenantId = await this.resolveTenantId(tenantIdInput);
    const stateDoc = await OnboardingState.findOne({ tenantId });
    if (!stateDoc) throw new NotFoundError('Onboarding state not found');

    stateDoc.tourCompleted = true;
    stateDoc.tourCompletedAt = new Date();
    await stateDoc.save();

    return { success: true, message: 'Interactive product tour completed' };
  }

  /**
   * Helper: Record an Activation Event without sensitive document contents
   */
  private recordActivationEvent(
    stateDoc: IOnboardingState,
    event: string,
    metadata?: Record<string, any>
  ) {
    stateDoc.activationEvents.push({
      event,
      timestamp: new Date(),
      metadata,
    });
  }
}

export const onboardingService = new OnboardingService();

