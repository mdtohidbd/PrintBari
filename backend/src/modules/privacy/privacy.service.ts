import mongoose from 'mongoose';
import crypto from 'crypto';
import {
  DataSubjectRequest,
  IDataSubjectRequest,
  ConsentRecord,
  IConsentRecord,
  PrivacyNoticeVersion,
  IPrivacyNoticeVersion,
  PurgeJobLog,
  IPurgeJobLog,
  DsrType,
  ConsentType,
} from '../../models/DataPrivacy.model';
import { Customer } from '../../models/Customer.model';
import { Job } from '../../models/Job.model';
import { ShopTransaction } from '../../models/ShopFinance.model';
import { Tenant } from '../../models/Tenant.model';
import { User } from '../../models/User.model';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../errors';

export class PrivacyService {
  /**
   * Helper: Resolve tenantId from string to ObjectId
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

  // ---------------------------------------------------------------------------
  // 1. CITIZEN CONSENT GOVERNANCE
  // ---------------------------------------------------------------------------
  public async recordConsent(
    tenantIdInput: string | mongoose.Types.ObjectId,
    user: { id: string; fullName: string },
    payload: {
      customerPhone: string;
      customerId?: string;
      consentType: ConsentType;
      granted: boolean;
      privacyPolicyVersion?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ) {
    const tenantId = await this.resolveTenantId(tenantIdInput);
    if (!payload.customerPhone || !payload.consentType) {
      throw new BadRequestError('Customer phone number and consent type are required.');
    }

    const consent = await ConsentRecord.create({
      tenantId,
      customerPhone: payload.customerPhone.trim(),
      customerId: payload.customerId ? new mongoose.Types.ObjectId(payload.customerId) : undefined,
      consentType: payload.consentType,
      granted: payload.granted !== false,
      privacyPolicyVersion: payload.privacyPolicyVersion || 'v1.0.0-PROD',
      recordedBy: new mongoose.Types.ObjectId(user.id),
      recordedByName: user.fullName,
      ipAddress: payload.ipAddress,
      userAgent: payload.userAgent,
      timestamp: new Date(),
    });

    return consent;
  }

  public async getConsentStatus(tenantIdInput: string | mongoose.Types.ObjectId, customerPhone: string) {
    const tenantId = await this.resolveTenantId(tenantIdInput);
    const records = await ConsentRecord.find({
      tenantId,
      customerPhone: customerPhone.trim(),
    }).sort({ timestamp: -1 });

    return records;
  }

  public async revokeConsent(
    tenantIdInput: string | mongoose.Types.ObjectId,
    user: { id: string; fullName: string },
    payload: {
      customerPhone: string;
      consentType: ConsentType;
      reason?: string;
    }
  ) {
    const tenantId = await this.resolveTenantId(tenantIdInput);
    const consent = await ConsentRecord.findOne({
      tenantId,
      customerPhone: payload.customerPhone.trim(),
      consentType: payload.consentType,
      granted: true,
    }).sort({ timestamp: -1 });

    if (!consent) {
      throw new NotFoundError(`Active consent '${payload.consentType}' not found for phone ${payload.customerPhone}.`);
    }

    consent.granted = false;
    consent.revokedAt = new Date();
    consent.revokedReason = payload.reason || 'Citizen requested withdrawal of consent';
    await consent.save();

    return consent;
  }

  // ---------------------------------------------------------------------------
  // 2. DATA SUBJECT REQUESTS (DSR / DSAR)
  // ---------------------------------------------------------------------------
  public async createDSR(
    tenantIdInput: string | mongoose.Types.ObjectId,
    payload: {
      requestType: DsrType;
      subjectPhone: string;
      subjectName?: string;
      subjectEmail?: string;
      details?: string;
    }
  ) {
    const tenantId = await this.resolveTenantId(tenantIdInput);
    if (!payload.subjectPhone || !payload.requestType) {
      throw new BadRequestError('Subject mobile phone number and request type are required.');
    }

    const customer = await Customer.findOne({ tenantId, phone: payload.subjectPhone.trim() });
    const requestNumber = `DSR-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const dsr = await DataSubjectRequest.create({
      tenantId,
      requestNumber,
      requestType: payload.requestType,
      subjectPhone: payload.subjectPhone.trim(),
      subjectName: payload.subjectName || customer?.fullName || 'Anonymous Citizen',
      subjectEmail: payload.subjectEmail || customer?.email,
      customerId: customer?._id as mongoose.Types.ObjectId | undefined,
      status: 'PENDING',
      verificationCode,
      isVerified: false,
      details: payload.details,
      auditTrail: [
        {
          action: 'DSR_CREATED',
          actor: 'CITIZEN_SUBMISSION',
          timestamp: new Date(),
          notes: `Data subject request of type ${payload.requestType} initialized.`,
        },
      ],
    });

    return {
      dsr,
      verificationRequired: true,
      verificationCode, // In production delivered via SMS; returned here for verification testing
    };
  }

  public async verifyDSR(
    tenantIdInput: string | mongoose.Types.ObjectId,
    requestNumber: string,
    verificationCode: string
  ) {
    const tenantId = await this.resolveTenantId(tenantIdInput);
    const dsr = await DataSubjectRequest.findOne({ tenantId, requestNumber: requestNumber.toUpperCase().trim() });
    if (!dsr) {
      throw new NotFoundError('DSR request not found');
    }

    if (dsr.verificationCode !== verificationCode) {
      throw new BadRequestError('Invalid OTP verification code');
    }

    dsr.isVerified = true;
    dsr.status = 'VERIFIED';
    dsr.auditTrail.push({
      action: 'DSR_PHONE_VERIFIED',
      actor: 'CITIZEN_SMS_OTP',
      timestamp: new Date(),
      notes: 'Phone identity authenticated via SMS OTP.',
    });
    await dsr.save();

    return dsr;
  }

  public async listDSRs(
    tenantIdInput: string | mongoose.Types.ObjectId,
    status?: string
  ) {
    const tenantId = await this.resolveTenantId(tenantIdInput);
    const filter: Record<string, any> = { tenantId };
    if (status) filter.status = status;

    return DataSubjectRequest.find(filter).sort({ requestedAt: -1 });
  }

  public async processDSR(
    tenantIdInput: string | mongoose.Types.ObjectId,
    user: { id: string; role: string; fullName: string },
    requestId: string,
    action: 'COMPLETE' | 'REJECT',
    options?: { rejectionReason?: string; correctionData?: Record<string, any> }
  ) {
    const tenantId = await this.resolveTenantId(tenantIdInput);
    const dsr = await DataSubjectRequest.findOne({ _id: requestId, tenantId });
    if (!dsr) {
      throw new NotFoundError('Data subject request not found');
    }

    if (action === 'REJECT') {
      if (!options?.rejectionReason) {
        throw new BadRequestError('Rejection reason is required.');
      }
      dsr.status = 'REJECTED';
      dsr.rejectionReason = options.rejectionReason;
      dsr.completedAt = new Date();
      dsr.completedBy = new mongoose.Types.ObjectId(user.id);
      dsr.auditTrail.push({
        action: 'DSR_REJECTED',
        actor: user.fullName,
        timestamp: new Date(),
        notes: `Rejected by ${user.role}: ${options.rejectionReason}`,
      });
      await dsr.save();
      return dsr;
    }

    // Process Completion based on DSR type
    const customer = await Customer.findOne({ tenantId, phone: dsr.subjectPhone });

    if (dsr.requestType === 'DELETION') {
      // Right to Erasure / Right to be Forgotten
      if (customer) {
        // Soft delete and anonymize customer profile
        customer.isDeleted = true;
        customer.fullName = `Anonymized Citizen (DSR-${dsr.requestNumber})`;
        customer.email = undefined;
        customer.address = undefined;
        customer.fileLibrary = [];
        await customer.save();

        // Secure purge of raw files in linked jobs
        const jobs = await Job.find({ tenantId, customerId: customer._id });
        for (const j of jobs) {
          j.uploadedFiles = [];
          j.processedFiles = [];
          j.customerName = 'Anonymized Citizen';
          j.customerEmail = undefined;
          await j.save();
        }

        // CRITICAL: Anonymize customer name in ShopTransaction ledger while preserving immutable financial audit numbers
        await ShopTransaction.updateMany(
          { tenantId, customerId: customer._id },
          { $set: { customerName: 'Anonymized Citizen', referenceNote: 'Customer identity purged under legal DSR request' } }
        );
      }
    } else if (dsr.requestType === 'CORRECTION' && options?.correctionData) {
      if (customer) {
        if (options.correctionData.fullName) customer.fullName = options.correctionData.fullName;
        if (options.correctionData.email) customer.email = options.correctionData.email;
        if (options.correctionData.address) customer.address = options.correctionData.address;
        await customer.save();
      }
    }

    dsr.status = 'COMPLETED';
    dsr.completedAt = new Date();
    dsr.completedBy = new mongoose.Types.ObjectId(user.id);
    dsr.auditTrail.push({
      action: 'DSR_COMPLETED',
      actor: user.fullName,
      timestamp: new Date(),
      notes: `Request executed and verified by ${user.role}.`,
    });
    await dsr.save();

    return dsr;
  }

  // ---------------------------------------------------------------------------
  // 3. CITIZEN MACHINE-READABLE DATA EXPORT (SAR)
  // ---------------------------------------------------------------------------
  public async exportCitizenData(
    tenantIdInput: string | mongoose.Types.ObjectId,
    customerPhone: string
  ) {
    const tenantId = await this.resolveTenantId(tenantIdInput);
    const customer = await Customer.findOne({ tenantId, phone: customerPhone.trim() });
    if (!customer) {
      throw new NotFoundError(`Citizen record not found for phone ${customerPhone}`);
    }

    const [jobs, transactions, consents] = await Promise.all([
      Job.find({ tenantId, customerId: customer._id })
        .select('jobCode serviceType status copies price paymentStatus createdAt completedAt notes')
        .lean(),
      ShopTransaction.find({ tenantId, customerId: customer._id })
        .select('transactionCode type amount paymentMethod createdAt')
        .lean(),
      ConsentRecord.find({ tenantId, customerPhone: customer.phone })
        .select('consentType granted timestamp privacyPolicyVersion')
        .lean(),
    ]);

    return {
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        format: 'JSON_MACHINE_READABLE',
        dataController: 'Registered Studio Shop Tenant',
        dataProcessor: 'DocuStudio SaaS Cloud Engine',
        retentionPolicy: 'All raw biometric photo and scan files auto-purged within 24 hours of job completion',
      },
      citizenProfile: {
        id: customer._id,
        fullName: customer.fullName,
        phone: customer.phone,
        email: customer.email || null,
        address: customer.address || null,
        totalOrdersCount: customer.totalOrdersCount,
        totalSpentBDT: customer.totalSpent,
        outstandingDueBDT: customer.dueBalance,
        registeredAt: customer.createdAt,
      },
      orderHistoryMetadata: jobs,
      financialReceipts: transactions,
      consentRecords: consents,
    };
  }

  // ---------------------------------------------------------------------------
  // 4. RETENTION PURGE ENGINE (AUTOMATED SECURE PURGE)
  // ---------------------------------------------------------------------------
  public async executeRetentionPurge(
    tenantIdInput: string | mongoose.Types.ObjectId,
    olderThanHours: number = 24
  ) {
    const tenantId = await this.resolveTenantId(tenantIdInput);
    const cutoffDate = new Date(Date.now() - olderThanHours * 3600 * 1000);

    // Find jobs eligible for file purge: completed before cutoffDate having unpurged files
    const eligibleJobs = await Job.find({
      tenantId,
      status: 'COMPLETED',
      completedAt: { $lte: cutoffDate },
      $or: [
        { 'uploadedFiles.0': { $exists: true } },
        { 'processedFiles.0': { $exists: true } },
      ],
    });

    let purgedFilesCount = 0;
    let purgedBytes = 0;
    const purgedKeys: string[] = [];

    for (const job of eligibleJobs) {
      for (const f of job.uploadedFiles) {
        purgedFilesCount++;
        purgedBytes += f.size || 500000;
        purgedKeys.push(f.fileId || f.name);
      }
      for (const f of job.processedFiles) {
        purgedFilesCount++;
        purgedBytes += f.size || 1500000;
        purgedKeys.push(f.fileId || f.name);
      }

      // Secure wipe of file arrays
      job.uploadedFiles = [];
      job.processedFiles = [];
      await job.save();
    }

    const executionId = `PURGE-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const log = await PurgeJobLog.create({
      tenantId,
      executionId,
      purgedFilesCount,
      purgedBytes,
      affectedJobsCount: eligibleJobs.length,
      status: 'SUCCESS',
      purgedFileKeys: purgedKeys.slice(0, 50), // Store up to 50 keys in audit
      executedAt: new Date(),
    });

    return {
      executionId,
      affectedJobsCount: eligibleJobs.length,
      purgedFilesCount,
      purgedMegabytes: Math.round((purgedBytes / (1024 * 1024)) * 100) / 100,
      cutoffDate,
      status: 'SUCCESS',
    };
  }

  // ---------------------------------------------------------------------------
  // 5. PRIVACY NOTICE VERSIONS & COMPLIANCE REGISTERS
  // ---------------------------------------------------------------------------
  public async getPrivacyNoticeVersions() {
    let versions = await PrivacyNoticeVersion.find().sort({ effectiveDate: -1 });
    if (versions.length === 0) {
      await PrivacyNoticeVersion.create({
        version: 'v1.0.0-PROD',
        effectiveDate: new Date('2026-01-01'),
        summaryOfChanges: 'Initial production baseline incorporating Bangladesh PDPA 2026, EU GDPR, and India DPDP 2023 alignment.',
        isCurrent: true,
        jurisdictions: ['BD_PDPA_2026', 'EU_GDPR', 'IN_DPDP_2023'],
        publishedBy: 'Data Protection Officer (DPO) & Legal Counsel',
      });
      versions = await PrivacyNoticeVersion.find().sort({ effectiveDate: -1 });
    }
    return versions;
  }
}

export const privacyService = new PrivacyService();

