import sharp, { OverlayOptions } from 'sharp';
import PDFDocument from 'pdfkit';
import mongoose from 'mongoose';
import { PassportJob, IPassportJob } from '../../models/PassportJob.model';
import { PassportPresetModel, IPassportPreset } from '../../models/PassportPreset.model';
import { Customer } from '../../models/Customer.model';
import { Job } from '../../models/Job.model';
import { Tenant } from '../../models/Tenant.model';
import { AuditLog } from '../../models/AuditLog.model';
import { BadRequestError, NotFoundError } from '../../errors';
import { configCache } from '../../utils/configCache';
import { validateImageBuffer, computeBufferHash } from '../../utils/fileValidator';
import { PrintLayoutEngine, PaperSize } from '../../utils/printLayout';
import { backgroundWorker } from '../../services/backgroundWorker';

export interface PassportPreset {
  id: string;
  name: string;
  country: string;
  widthMm: number;
  heightMm: number;
  widthPx: number; // At 300 DPI
  heightPx: number; // At 300 DPI
  bgColor: string;
  description: string;
}

export const PASSPORT_PRESETS: Record<string, PassportPreset> = {
  us_passport_2x2: {
    id: 'us_passport_2x2',
    name: 'US Passport / Visa (2x2 in)',
    country: 'United States',
    widthMm: 51,
    heightMm: 51,
    widthPx: 602,
    heightPx: 602,
    bgColor: '#FFFFFF',
    description: 'White background. Head height must be between 1 - 1 3/8 inches.',
  },
  uk_eu_35x45: {
    id: 'uk_eu_35x45',
    name: 'UK / EU / Schengen (35x45 mm)',
    country: 'United Kingdom / European Union',
    widthMm: 35,
    heightMm: 45,
    widthPx: 413,
    heightPx: 531,
    bgColor: '#F5F5F5',
    description: 'Light grey or off-white background. 35mm wide by 45mm high.',
  },
  india_passport_35x45: {
    id: 'india_passport_35x45',
    name: 'India Passport / OCI (35x45 mm)',
    country: 'India',
    widthMm: 35,
    heightMm: 45,
    widthPx: 413,
    heightPx: 531,
    bgColor: '#FFFFFF',
    description: 'Plain white background with 70-80% face coverage.',
  },
  bd_passport_40x50: {
    id: 'bd_passport_40x50',
    name: 'Bangladesh Passport / NID (40x50 mm)',
    country: 'Bangladesh',
    widthMm: 40,
    heightMm: 50,
    widthPx: 472,
    heightPx: 591,
    bgColor: '#FFFFFF',
    description: 'White background. Standard MRP & e-Passport specification.',
  },
  canada_50x70: {
    id: 'canada_50x70',
    name: 'Canada Passport (50x70 mm)',
    country: 'Canada',
    widthMm: 50,
    heightMm: 70,
    widthPx: 591,
    heightPx: 827,
    bgColor: '#FFFFFF',
    description: 'White or light-coloured background. Face size 31mm - 36mm.',
  },
  gcc_visa_40x60: {
    id: 'gcc_visa_40x60',
    name: 'UAE / Saudi / GCC Visa (40x60 mm)',
    country: 'GCC Countries (UAE, KSA, Qatar)',
    widthMm: 40,
    heightMm: 60,
    widthPx: 472,
    heightPx: 709,
    bgColor: '#FFFFFF',
    description: 'White background. High clarity for visa immigration stamps.',
  },
  stamp_20x25: {
    id: 'stamp_20x25',
    name: 'Stamp Size Photo (20x25 mm)',
    country: 'Universal / Academic',
    widthMm: 20,
    heightMm: 25,
    widthPx: 236,
    heightPx: 295,
    bgColor: '#FFFFFF',
    description: 'Standard stamp size for school/college forms and bio-data.',
  },
  malaysia_visa_35x50: {
    id: 'malaysia_visa_35x50',
    name: 'Malaysia Visa (35x50 mm - Sky Blue)',
    country: 'Malaysia',
    widthMm: 35,
    heightMm: 50,
    widthPx: 413,
    heightPx: 591,
    bgColor: '#38BDF8',
    description: 'Sky blue background. 35mm wide by 50mm high for Malaysian eVisa / Student pass.',
  },
  saudi_umrah_40x60: {
    id: 'saudi_umrah_40x60',
    name: 'Saudi Arabia / Hajj / Umrah (40x60 mm)',
    country: 'Saudi Arabia',
    widthMm: 40,
    heightMm: 60,
    widthPx: 472,
    heightPx: 709,
    bgColor: '#FFFFFF',
    description: 'Pure white background. 40mm x 60mm high-res requirement for MOFA.',
  },
  combo_passport_stamp: {
    id: 'combo_passport_stamp',
    name: 'BD Combo Pack (4 Passport + 4 Stamp on 4R)',
    country: 'Bangladesh (Popular Studio Pack)',
    widthMm: 40,
    heightMm: 50,
    widthPx: 472,
    heightPx: 591,
    bgColor: '#FFFFFF',
    description: 'Dual photo layout: 4 passport copies (40x50mm) + 4 stamp copies (20x25mm) on 4x6" paper.',
  },
};

export class PassportService {
  /**
   * Seed default system passport presets if database collection is empty
   */
  public async seedDefaultPresets(): Promise<void> {
    const count = await PassportPresetModel.countDocuments({ isSystem: true, tenantId: null });
    if (count === 0) {
      const presetDocs = Object.values(PASSPORT_PRESETS).map((p) => ({
        presetKey: p.id,
        name: p.name,
        country: p.country,
        widthMm: p.widthMm,
        heightMm: p.heightMm,
        widthPx: p.widthPx,
        heightPx: p.heightPx,
        bgColor: p.bgColor,
        description: p.description,
        isSystem: true,
        isActive: true,
      }));
      await PassportPresetModel.insertMany(presetDocs);
    }
  }

  /**
   * Get all active passport presets (Global + Tenant Custom Overrides)
   */
  public async getPresets(tenantId?: string): Promise<PassportPreset[]> {
    const cacheKey = tenantId ? `presets:tenant:${tenantId}` : 'presets:global';
    const cached = configCache.get<PassportPreset[]>(cacheKey);
    if (cached) return cached;

    await this.seedDefaultPresets();

    const globalDocs = await PassportPresetModel.find({ isSystem: true, tenantId: null, isActive: true }).lean();
    let tenantDocs: any[] = [];
    if (tenantId && mongoose.Types.ObjectId.isValid(tenantId)) {
      tenantDocs = await PassportPresetModel.find({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        isActive: true,
      }).lean();
    }

    const presetMap = new Map<string, PassportPreset>();

    // Static fallback first
    for (const [key, p] of Object.entries(PASSPORT_PRESETS)) {
      presetMap.set(key, p);
    }

    // Database global overrides
    for (const doc of globalDocs) {
      presetMap.set(doc.presetKey, {
        id: doc.presetKey,
        name: doc.name,
        country: doc.country,
        widthMm: doc.widthMm,
        heightMm: doc.heightMm,
        widthPx: doc.widthPx,
        heightPx: doc.heightPx,
        bgColor: doc.bgColor,
        description: doc.description,
      });
    }

    // Tenant custom overrides
    for (const doc of tenantDocs) {
      presetMap.set(doc.presetKey, {
        id: doc.presetKey,
        name: doc.name,
        country: doc.country,
        widthMm: doc.widthMm,
        heightMm: doc.heightMm,
        widthPx: doc.widthPx,
        heightPx: doc.heightPx,
        bgColor: doc.bgColor,
        description: doc.description,
      });
    }

    const result = Array.from(presetMap.values());
    configCache.set(cacheKey, result, 5 * 60 * 1000);
    return result;
  }

  /**
   * Get single passport preset by ID
   */
  public async getPreset(presetId?: string, tenantId?: string): Promise<PassportPreset> {
    const targetKey = presetId || 'us_passport_2x2';
    const all = await this.getPresets(tenantId);
    return all.find((p) => p.id === targetKey) || PASSPORT_PRESETS.us_passport_2x2;
  }

  /**
   * Shop Owner creates custom preset
   */
  public async createCustomPreset(
    tenantId: mongoose.Types.ObjectId,
    data: {
      presetKey: string;
      name: string;
      country?: string;
      widthMm: number;
      heightMm: number;
      bgColor?: string;
      description?: string;
    }
  ) {
    const normalizedKey = data.presetKey.trim().toLowerCase();
    const existing = await PassportPresetModel.findOne({ tenantId, presetKey: normalizedKey });
    if (existing) {
      throw new BadRequestError(`Preset key '${normalizedKey}' already exists for your shop`);
    }

    const widthPx = Math.round((data.widthMm / 25.4) * 300);
    const heightPx = Math.round((data.heightMm / 25.4) * 300);

    const preset = await PassportPresetModel.create({
      tenantId,
      presetKey: normalizedKey,
      name: data.name.trim(),
      country: data.country || 'Custom Format',
      widthMm: data.widthMm,
      heightMm: data.heightMm,
      widthPx,
      heightPx,
      bgColor: data.bgColor || '#FFFFFF',
      description: data.description || '',
      isSystem: false,
      isActive: true,
    });

    configCache.invalidate(`presets:tenant:${tenantId.toString()}`);
    return preset;
  }

  /**
   * Process a single passport photo using Sharp with advanced resolution control,
   * background replacement, face positioning, and custom dimensions.
   */
  public async processSinglePhoto(
    inputBuffer: Buffer,
    options: {
      presetId?: string;
      customDimensions?: { widthMm: number; heightMm: number };
      rotation?: number;
      cropBounds?: { x: number; y: number; width: number; height: number };
      brightness?: number; // -100 to 100
      contrast?: number; // -100 to 100
      backgroundColor?: string;
      dpi?: 150 | 300 | 600;
      exportFormat?: 'jpeg' | 'png';
      exportQuality?: number;
      facePositioning?: {
        eyeLevelPercent?: number;
        headClearancePercent?: number;
      };
    }
  ) {
    // 1. Strict File & Dimensions Validation
    await validateImageBuffer(inputBuffer);

    const dpi = options.dpi || 300;
    let targetWidthPx: number;
    let targetHeightPx: number;
    let widthMm: number;
    let heightMm: number;

    const preset =
      PASSPORT_PRESETS[options.presetId || 'us_passport_2x2'] ||
      PASSPORT_PRESETS.us_passport_2x2;

    if (
      options.customDimensions &&
      options.customDimensions.widthMm > 0 &&
      options.customDimensions.heightMm > 0
    ) {
      widthMm = options.customDimensions.widthMm;
      heightMm = options.customDimensions.heightMm;
      targetWidthPx = Math.round((widthMm / 25.4) * dpi);
      targetHeightPx = Math.round((heightMm / 25.4) * dpi);
    } else {
      widthMm = preset.widthMm;
      heightMm = preset.heightMm;
      targetWidthPx = Math.round((widthMm / 25.4) * dpi);
      targetHeightPx = Math.round((heightMm / 25.4) * dpi);
    }

    let image = sharp(inputBuffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new BadRequestError('Invalid or corrupted image file');
    }

    // 2. Rotation (if specified)
    if (options.rotation && options.rotation % 360 !== 0) {
      image = image.rotate(options.rotation);
    }

    // 3. Crop extraction & Face Positioning
    if (options.cropBounds && options.cropBounds.width > 10 && options.cropBounds.height > 10) {
      const { x, y, width, height } = options.cropBounds;
      const safeX = Math.max(0, Math.min(x, (metadata.width || 100) - 10));
      const safeY = Math.max(0, Math.min(y, (metadata.height || 100) - 10));
      const safeWidth = Math.min(width, (metadata.width || 100) - safeX);
      const safeHeight = Math.min(height, (metadata.height || 100) - safeY);

      if (safeWidth > 10 && safeHeight > 10) {
        image = image.extract({
          left: Math.round(safeX),
          top: Math.round(safeY),
          width: Math.round(safeWidth),
          height: Math.round(safeHeight),
        });
      }
    }

    // 4. Brightness and Contrast adjustments
    const brightnessMod = 1 + (options.brightness || 0) / 100;
    const contrastMod = 1 + (options.contrast || 0) / 100;

    image = image.modulate({
      brightness: Math.max(0.1, Math.min(2.5, brightnessMod)),
    });

    if (options.contrast !== 0 && options.contrast !== undefined) {
      image = image.linear(contrastMod, -(128 * contrastMod) + 128);
    }

    // 5. Background Replacement (if requested)
    if (options.backgroundColor && options.backgroundColor.trim() !== '') {
      const bgColor = options.backgroundColor.trim();
      // Composite over solid color background
      const bgCanvas = await sharp({
        create: {
          width: targetWidthPx,
          height: targetHeightPx,
          channels: 3,
          background: bgColor,
        },
      })
        .png()
        .toBuffer();

      const resizedSubject = await image
        .resize({
          width: targetWidthPx,
          height: targetHeightPx,
          fit: 'cover',
          position: 'center',
        })
        .png()
        .toBuffer();

      image = sharp(bgCanvas).composite([
        {
          input: resizedSubject,
          blend: 'over',
        },
      ]);
    } else {
      // Resize to exact standard target pixel dimensions
      image = image.resize({
        width: targetWidthPx,
        height: targetHeightPx,
        fit: 'cover',
        position: 'center',
      });
    }

    // 6. Output format & Resolution control
    const exportFormat = options.exportFormat || 'jpeg';
    let outputBuffer: Buffer;
    let mimeType: string;

    if (exportFormat === 'png') {
      outputBuffer = await image
        .withMetadata({ density: dpi })
        .png({ compressionLevel: 9 })
        .toBuffer();
      mimeType = 'image/png';
    } else {
      const quality = Math.min(100, Math.max(50, options.exportQuality || 95));
      outputBuffer = await image
        .withMetadata({ density: dpi })
        .jpeg({ quality, chromaSubsampling: '4:4:4' })
        .toBuffer();
      mimeType = 'image/jpeg';
    }

    return {
      buffer: outputBuffer,
      base64: `data:${mimeType};base64,${outputBuffer.toString('base64')}`,
      preset,
      widthMm,
      heightMm,
      widthPx: targetWidthPx,
      heightPx: targetHeightPx,
      dpi,
      exportFormat,
    };
  }

  /**
   * Compose an arranged print sheet (4x6 photo paper or A4 sheet) with precision cut lines,
   * customizable margins, gap, scaling, and color mode.
   */
  public async composePrintSheet(
    singlePhotoBuffer: Buffer,
    options: {
      presetId?: string;
      customDimensions?: { widthMm: number; heightMm: number };
      sheetLayout?: '4x6' | 'A4' | '5x7' | 'Letter';
      copies?: number;
      dpi?: 150 | 300 | 600;
      marginsMm?: number;
      gapMm?: number;
      colorMode?: 'RGB' | 'GRAYSCALE';
    }
  ) {
    const dpi = options.dpi || 300;
    const sheetLayout = options.sheetLayout || '4x6';
    const copies = Math.min(36, Math.max(1, options.copies || 8));

    // Get single photo dimensions
    const photoMeta = await sharp(singlePhotoBuffer).metadata();
    const photoW = photoMeta.width || Math.round((35 / 25.4) * dpi);
    const photoH = photoMeta.height || Math.round((45 / 25.4) * dpi);

    // Physical dimensions based on sheet layout:
    // A4: 210 x 297 mm
    // 4x6: 101.6 x 152.4 mm
    // 5x7: 127 x 177.8 mm
    // Letter: 215.9 x 279.4 mm
    let sheetWidthMm = 152.4;
    let sheetHeightMm = 101.6;

    if (sheetLayout === 'A4') {
      sheetWidthMm = 210;
      sheetHeightMm = 297;
    } else if (sheetLayout === '5x7') {
      sheetWidthMm = 177.8;
      sheetHeightMm = 127.0;
    } else if (sheetLayout === 'Letter') {
      sheetWidthMm = 215.9;
      sheetHeightMm = 279.4;
    }

    const sheetWidth = Math.round((sheetWidthMm / 25.4) * dpi);
    const sheetHeight = Math.round((sheetHeightMm / 25.4) * dpi);

    const marginMm = typeof options.marginsMm === 'number' ? options.marginsMm : sheetLayout === 'A4' ? 8 : 5;
    const gapMm = typeof options.gapMm === 'number' ? options.gapMm : 3;

    const marginPx = Math.round((marginMm / 25.4) * dpi);
    const gapPx = Math.round((gapMm / 25.4) * dpi);

    const availableWidth = sheetWidth - 2 * marginPx;
    const availableHeight = sheetHeight - 2 * marginPx;

    const colWidth = photoW + gapPx;
    const rowHeight = photoH + gapPx;

    const maxCols = Math.max(1, Math.floor(availableWidth / colWidth));
    const maxRows = Math.max(1, Math.floor(availableHeight / rowHeight));

    const actualCols = Math.max(1, Math.min(maxCols, copies));
    const actualRows = Math.max(1, Math.min(maxRows, Math.ceil(copies / actualCols)));

    const itemBounds: Array<{ left: number; top: number; width: number; height: number }> = [];
    const composites: OverlayOptions[] = [];

    // Optional grayscale transformation of single photo
    let processedSingle = singlePhotoBuffer;
    if (options.colorMode === 'GRAYSCALE') {
      processedSingle = await sharp(singlePhotoBuffer).grayscale().toBuffer();
    }

    let placed = 0;
    for (let r = 0; r < actualRows && placed < copies; r++) {
      for (let c = 0; c < actualCols && placed < copies; c++) {
        const left = marginPx + c * colWidth;
        const top = marginPx + r * rowHeight;

        composites.push({
          input: processedSingle,
          top,
          left,
        });

        itemBounds.push({
          left,
          top,
          width: photoW,
          height: photoH,
        });

        placed++;
      }
    }

    // Vector cut marks SVG
    const cutMarksSvg = PrintLayoutEngine.generateCutMarksSvg(sheetWidth, sheetHeight, itemBounds, 16);
    composites.push({
      input: Buffer.from(cutMarksSvg),
      top: 0,
      left: 0,
    });

    const sheetBuffer = await sharp({
      create: {
        width: sheetWidth,
        height: sheetHeight,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite(composites)
      .withMetadata({ density: dpi })
      .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
      .toBuffer();

    const base64Data = `data:image/jpeg;base64,${sheetBuffer.toString('base64')}`;

    return {
      buffer: sheetBuffer,
      base64: base64Data,
      sheetBase64: base64Data,
      sheetLayout,
      copiesPlaced: placed,
      sheetWidth,
      sheetHeight,
      dpi,
      colorMode: options.colorMode || 'RGB',
    };
  }

  /**
   * Generate Print-Ready 300 DPI PDF vector wrapper
   */
  public generateSheetPdf(
    sheetImageBuffer: Buffer,
    sheetLayout: '4x6' | 'A4' = '4x6'
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      // 4x6 inches = 288 x 432 pt (or landscape 432 x 288 pt)
      // A4 = 595.28 x 841.89 pt
      const isA4 = sheetLayout === 'A4';
      const size: [number, number] = isA4 ? [595.28, 841.89] : [432, 288];

      const doc = new PDFDocument({
        size,
        margin: 0,
        layout: isA4 ? 'portrait' : 'landscape',
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Embed high-res raster to fill page
      doc.image(sheetImageBuffer, 0, 0, {
        width: size[0],
        height: size[1],
      });

      doc.end();
    });
  }

  /**
   * Save processed job into MongoDB
   */
  public async savePassportJob(
    tenantId: string | mongoose.Types.ObjectId,
    data: any
  ) {
    const tId = new mongoose.Types.ObjectId(tenantId);
    const jobCode = `PP-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;
    const preset = PASSPORT_PRESETS[data.presetId] || PASSPORT_PRESETS['us_passport_2x2'];

    const originalImageUrl = data.originalImageUrl || data.originalImageBase64 || data.originalImage;
    const processedImageUrl = data.processedImageUrl || data.processedImageBase64 || data.processedImage;
    const sheetImageUrl = data.sheetImageUrl || data.sheetImageBase64 || data.sheetImage;

    const passportJob = await PassportJob.create({
      tenantId: tId,
      jobCode,
      customerName: data.customerName || 'Walk-in Customer',
      customerPhone: data.customerPhone || 'N/A',
      presetId: data.presetId || 'us_passport_2x2',
      presetName: data.presetName || preset?.name || 'Passport Photo',
      dimensionsMm: data.dimensionsMm || { width: preset?.widthMm || 51, height: preset?.heightMm || 51 },
      targetDpi: data.targetDpi || 300,
      backgroundColor: data.backgroundColor || '#FFFFFF',
      adjustments: data.adjustments || {
        brightness: Number(data.brightness) || 0,
        contrast: Number(data.contrast) || 0,
        rotation: Number(data.rotation) || 0,
      },
      cropBounds: data.cropBounds,
      copies: Number(data.copies) || 8,
      sheetLayout: data.sheetLayout || '4x6',
      originalImageUrl,
      processedImageUrl,
      sheetImageUrl,
      notes: data.notes,
      status: 'SAVED',
    });

    // Also register in central Shop Queue (`Job` collection) so it shows on Dashboard
    await Job.create({
      tenantId: tId,
      jobCode,
      customerName: data.customerName || 'Walk-in Customer',
      customerPhone: data.customerPhone || 'N/A',
      serviceType: 'PASSPORT_PHOTO',
      status: 'PRINT_READY',
      priority: 'NORMAL',
      copies: Number(data.copies) || 8,
      paperType: data.sheetLayout === '4x6' ? '4x6 Photo Glossy' : 'A4 Photo Paper',
      totalAmount: data.unitPrice || 100.0,
      paidAmount: data.unitPrice || 100.0,
      paymentStatus: 'PAID',
      notes: `${preset?.name || data.presetId} (${data.copies || 8} copies on ${data.sheetLayout || '4x6'})`,
    });

    // Update tenant quota counter
    await Tenant.findByIdAndUpdate(tId, {
      $inc: { 'quotas.monthlyPassportLayoutsUsed': 1 },
    });

    return passportJob;
  }

  /**
   * List saved passport jobs
   */
  public async listSavedJobs(tenantId: string | mongoose.Types.ObjectId) {
    return PassportJob.find({ tenantId: new mongoose.Types.ObjectId(tenantId) })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();
  }

  /**
   * Get job by ID
   */
  public async getJobById(tenantId: string | mongoose.Types.ObjectId, jobId: string) {
    const job = await PassportJob.findOne({
      _id: jobId,
      tenantId: new mongoose.Types.ObjectId(tenantId),
    });
    if (!job) {
      throw new NotFoundError('Passport job not found');
    }
    return job;
  }
}

export const passportService = new PassportService();
