import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ServiceItem, IServiceItem } from '../../models/ServiceCatalog.model';
import { AuditLog } from '../../models/AuditLog.model';
import { ApiResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { BadRequestError, NotFoundError } from '../../errors';
import { configCache } from '../../utils/configCache';

export const DEFAULT_SYSTEM_SERVICES = [
  {
    serviceCode: 'PASSPORT_PHOTO',
    category: 'STUDIO',
    name: 'Passport & Visa Photo Studio',
    nameBn: 'পাসপোর্ট ও ভিসা সাইজ ছবি',
    description: '300 DPI biometrics compliant passport and visa photos',
    unitPrice: 100,
    minPrice: 50,
    pricingUnit: 'PER_SET' as const,
    paperSizes: ['4x6', 'A4'],
    isSystem: true,
  },
  {
    serviceCode: 'DOCUMENT_A4',
    category: 'SCAN_PRINT',
    name: 'A4 Document Processing & Photocopy',
    nameBn: 'A4 ডকুমেন্ট স্ক্যান ও ফটোকপি',
    description: 'Perspective straightening, shadow cleanup, black & white photocopy',
    unitPrice: 10,
    minPrice: 5,
    pricingUnit: 'PER_PAGE' as const,
    paperSizes: ['A4', 'LEGAL'],
    isSystem: true,
  },
  {
    serviceCode: 'ID_CARD_A4',
    category: 'IDENTITY',
    name: 'ID Card & Smart NID Duplex Print',
    nameBn: 'স্মার্ট এনআইডি ও আইডি কার্ড ডুপ্লেক্স প্রিন্ট',
    description: 'Dual-sided national ID card layout on A4 paper with cut marks',
    unitPrice: 30,
    minPrice: 20,
    pricingUnit: 'PER_COPY' as const,
    paperSizes: ['A4'],
    isSystem: true,
  },
  {
    serviceCode: 'CV_BUILDER',
    category: 'DOCUMENTS',
    name: 'Professional CV & Agreement Maker',
    nameBn: 'প্রফেশনাল সিভি ও চুক্তিপত্র',
    description: 'Formatted resume builder and ready-made legal agreement drafting',
    unitPrice: 80,
    minPrice: 50,
    pricingUnit: 'PER_SET' as const,
    paperSizes: ['A4'],
    isSystem: true,
  },
  {
    serviceCode: 'HANDWRITING_OCR',
    category: 'AI_OCR',
    name: 'Handwriting OCR & Word (.docx) Extraction',
    nameBn: 'হস্তলিপি ও স্ক্যান থেকে ওয়ার্ড রূপান্তর',
    description: 'AI-assisted OCR text recognition in English and Bengali',
    unitPrice: 50,
    minPrice: 30,
    pricingUnit: 'PER_PAGE' as const,
    paperSizes: ['A4'],
    isSystem: true,
  },
  {
    serviceCode: 'LAMINATION',
    category: 'FINISHING',
    name: 'Document Lamination',
    nameBn: 'লেমিনেটিং সার্ভিস',
    description: '100 micron / 150 micron protective thermal lamination',
    unitPrice: 25,
    minPrice: 15,
    pricingUnit: 'PER_PIECE' as const,
    paperSizes: ['A4', 'LEGAL', 'ID_CARD'],
    isSystem: true,
  },
  {
    serviceCode: 'CUSTOM_PRINT',
    category: 'PRINTING',
    name: 'Custom Document Printing',
    nameBn: 'সাধারণ প্রিন্টিং',
    description: 'Laser black or color document printing on 80/100/120 GSM paper',
    unitPrice: 15,
    minPrice: 5,
    pricingUnit: 'PER_PAGE' as const,
    paperSizes: ['A4', 'LEGAL'],
    isSystem: true,
  },
];

export class ServiceCatalogController {
  /**
   * Seed default system services if database is empty
   */
  public async seedDefaultServices(): Promise<void> {
    const count = await ServiceItem.countDocuments({ isSystem: true, tenantId: null });
    if (count === 0) {
      await ServiceItem.insertMany(DEFAULT_SYSTEM_SERVICES);
    }
  }

  /**
   * Get merged service catalog for the authenticated shop
   */
  public getCatalog = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant?._id ? req.tenant._id.toString() : null;
    const cacheKey = tenantId ? `services:tenant:${tenantId}` : 'services:global';

    const cached = configCache.get<any[]>(cacheKey);
    if (cached) {
      ApiResponse.success(res, cached, 'Service catalog retrieved (cached)');
      return;
    }

    // Auto-seed if needed
    await this.seedDefaultServices();

    // Query global system services
    const globalServices = await ServiceItem.find({ isSystem: true, tenantId: null, isActive: true }).lean();

    // Query tenant custom services & overrides
    let tenantServices: any[] = [];
    if (tenantId) {
      tenantServices = await ServiceItem.find({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        isActive: true,
      }).lean();
    }

    // Merge: tenant services override global services with identical serviceCode
    const serviceMap = new Map<string, any>();
    for (const g of globalServices) {
      serviceMap.set(g.serviceCode, g);
    }
    for (const t of tenantServices) {
      serviceMap.set(t.serviceCode, t);
    }

    const merged = Array.from(serviceMap.values());
    configCache.set(cacheKey, merged, 5 * 60 * 1000);

    ApiResponse.success(res, merged, 'Service catalog retrieved');
  });

  /**
   * Shop Owner adds custom service
   */
  public addCustomService = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const { serviceCode, category, name, nameBn, description, unitPrice, minPrice, pricingUnit, paperSizes } = req.body;

    if (!serviceCode || !name || unitPrice === undefined) {
      throw new BadRequestError('serviceCode, name, and unitPrice are required');
    }

    const normalizedCode = String(serviceCode).trim().toUpperCase();

    // Check if duplicate for this shop
    const existing = await ServiceItem.findOne({
      tenantId,
      serviceCode: normalizedCode,
    });

    if (existing) {
      throw new BadRequestError(`Service code '${normalizedCode}' already exists for your shop`);
    }

    const service = await ServiceItem.create({
      tenantId,
      serviceCode: normalizedCode,
      category: (category || 'CUSTOM').toUpperCase(),
      name: name.trim(),
      nameBn: nameBn?.trim(),
      description: description || '',
      unitPrice: Number(unitPrice),
      minPrice: Number(minPrice || unitPrice),
      pricingUnit: pricingUnit || 'PER_COPY',
      paperSizes: paperSizes || ['A4'],
      isSystem: false,
      isActive: true,
    });

    // Invalidate cache
    configCache.invalidate(`services:tenant:${tenantId.toString()}`);

    await AuditLog.create({
      tenantId,
      userId: req.user?._id,
      action: 'SERVICE_CUSTOM_ADDED',
      details: { serviceCode: normalizedCode, name },
      status: 'SUCCESS',
    });

    ApiResponse.created(res, service, `Custom service '${name}' added successfully`);
  });

  /**
   * Shop Owner edits custom service
   */
  public updateCustomService = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const serviceId = String(Array.isArray(req.params.serviceId) ? req.params.serviceId[0] : req.params.serviceId);

    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      throw new BadRequestError('Invalid service ID');
    }

    const service = await ServiceItem.findOne({
      _id: new mongoose.Types.ObjectId(serviceId),
      tenantId,
    });

    if (!service) {
      throw new NotFoundError('Custom service not found for this shop');
    }

    const { name, nameBn, description, unitPrice, minPrice, pricingUnit, paperSizes, isActive } = req.body;

    if (name) service.name = name.trim();
    if (nameBn !== undefined) service.nameBn = nameBn.trim();
    if (description !== undefined) service.description = description;
    if (unitPrice !== undefined) service.unitPrice = Number(unitPrice);
    if (minPrice !== undefined) service.minPrice = Number(minPrice);
    if (pricingUnit) service.pricingUnit = pricingUnit;
    if (paperSizes) service.paperSizes = paperSizes;
    if (typeof isActive === 'boolean') service.isActive = isActive;

    await service.save();

    configCache.invalidate(`services:tenant:${tenantId.toString()}`);

    ApiResponse.success(res, service, 'Custom service updated successfully');
  });

  /**
   * Shop Owner deletes custom service
   */
  public deleteCustomService = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const serviceId = String(Array.isArray(req.params.serviceId) ? req.params.serviceId[0] : req.params.serviceId);

    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      throw new BadRequestError('Invalid service ID');
    }

    const deleted = await ServiceItem.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(serviceId),
      tenantId,
    });

    if (!deleted) {
      throw new NotFoundError('Custom service not found');
    }

    configCache.invalidate(`services:tenant:${tenantId.toString()}`);

    ApiResponse.success(res, { deleted: true }, 'Custom service deleted successfully');
  });

  /**
   * Super Admin manages global system service
   */
  public upsertGlobalService = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { serviceCode, category, name, nameBn, description, unitPrice, minPrice, pricingUnit, paperSizes, isActive } = req.body;

    if (!serviceCode || !name || unitPrice === undefined) {
      throw new BadRequestError('serviceCode, name, and unitPrice are required');
    }

    const normalizedCode = String(serviceCode).trim().toUpperCase();

    const service = await ServiceItem.findOneAndUpdate(
      { isSystem: true, tenantId: null, serviceCode: normalizedCode },
      {
        $set: {
          category: (category || 'GENERAL').toUpperCase(),
          name: name.trim(),
          nameBn: nameBn?.trim(),
          description: description || '',
          unitPrice: Number(unitPrice),
          minPrice: Number(minPrice || unitPrice),
          pricingUnit: pricingUnit || 'PER_COPY',
          paperSizes: paperSizes || ['A4'],
          isSystem: true,
          isActive: typeof isActive === 'boolean' ? isActive : true,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Invalidate all services caches
    configCache.invalidatePattern('services:');

    await AuditLog.create({
      tenantId: req.tenant?._id,
      userId: req.user?._id,
      action: 'SERVICE_GLOBAL_UPSERTED',
      details: { serviceCode: normalizedCode, name },
      status: 'SUCCESS',
    });

    ApiResponse.success(res, service, `Global service '${normalizedCode}' saved`);
  });
}

export const serviceCatalogController = new ServiceCatalogController();
