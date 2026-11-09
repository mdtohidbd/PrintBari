import sharp, { OverlayOptions } from 'sharp';
import PDFDocument from 'pdfkit';
import mongoose from 'mongoose';
import { IdCardJob, IIdCardJob, IdCardType, CardArrangement } from '../../models/IdCardJob.model';
import { Job } from '../../models/Job.model';
import { Tenant } from '../../models/Tenant.model';
import { AuditLog } from '../../models/AuditLog.model';
import { BadRequestError, NotFoundError } from '../../errors';
import { validateImageBuffer } from '../../utils/fileValidator';
import { PrintLayoutEngine } from '../../utils/printLayout';

export interface IdCardPreset {
  id: IdCardType;
  name: string;
  nameBn: string;
  widthMm: number;
  heightMm: number;
  widthPx: number; // At 300 DPI
  heightPx: number; // At 300 DPI
  description: string;
}

export const ID_CARD_PRESETS: Record<string, IdCardPreset> = {
  SMART_NID: {
    id: 'SMART_NID',
    name: 'Bangladesh Smart NID Card (CR-80 Standard)',
    nameBn: 'স্মার্ট জাতীয় পরিচয়পত্র (Smart NID)',
    widthMm: 85.6,
    heightMm: 54,
    widthPx: 1011,
    heightPx: 638,
    description: 'Standard 85.6 x 54 mm smart card format (same as ATM/Bank cards).',
  },
  OLD_NID: {
    id: 'OLD_NID',
    name: 'Old Bangladesh Laminated NID',
    nameBn: 'পুরাতন লেমিনেটেড জাতীয় পরিচয়পত্র',
    widthMm: 105,
    heightMm: 74,
    widthPx: 1240,
    heightPx: 874,
    description: 'Traditional 105 x 74 mm laminated national ID card format.',
  },
  DRIVING_LICENSE: {
    id: 'DRIVING_LICENSE',
    name: 'BRTA Smart Driving License',
    nameBn: 'বিআরটিএ স্মার্ট ড্রাইভিং লাইসেন্স',
    widthMm: 85.6,
    heightMm: 54,
    widthPx: 1011,
    heightPx: 638,
    description: 'Official 85.6 x 54 mm BRTA electronic driving license card.',
  },
  STUDENT_ID: {
    id: 'STUDENT_ID',
    name: 'Student / Employee ID Card',
    nameBn: 'ছাত্র/কর্মচারী আইডি কার্ড',
    widthMm: 85.6,
    heightMm: 54,
    widthPx: 1011,
    heightPx: 638,
    description: 'Standard institutional identity badge format.',
  },
  CUSTOM: {
    id: 'CUSTOM',
    name: 'Custom Dimension Card',
    nameBn: 'কাস্টম সাইজ কার্ড',
    widthMm: 85.6,
    heightMm: 54,
    widthPx: 1011,
    heightPx: 638,
    description: 'Custom dimensions configured by operator in millimeters.',
  },
};

export interface ProcessCardSideOptions {
  widthMm?: number;
  heightMm?: number;
  rotation?: number;
  brightness?: number;
  contrast?: number;
  filterMode?: 'ORIGINAL' | 'MAGIC_COLOR' | 'BW_PHOTOCOPY' | 'GRAYSCALE';
  threshold?: number;
  cropBounds?: { x: number; y: number; width: number; height: number };
}

export interface ComposeIdCardA4Options {
  cardType?: IdCardType;
  widthMm?: number;
  heightMm?: number;
  arrangement?: CardArrangement;
  copies?: number; // 1, 2, 4, 8, 10
  orientation?: 'PORTRAIT' | 'LANDSCAPE';
  marginMm?: number;
  gapMm?: number;
  showCutMarks?: boolean;
}

export class IdCardService {
  /**
   * Process a single card side (front or back) using Sharp at true 300 DPI
   */
  public async processCardSide(
    inputBuffer: Buffer,
    options: ProcessCardSideOptions = {}
  ): Promise<{
    buffer: Buffer;
    base64: string;
    width: number;
    height: number;
    dpi: number;
  }> {
    await validateImageBuffer(inputBuffer);

    let pipeline = sharp(inputBuffer);
    const metadata = await pipeline.metadata();

    if (!metadata.width || !metadata.height) {
      throw new BadRequestError('Invalid or corrupted ID card image');
    }

    // 1. Rotation (if specified)
    if (options.rotation && options.rotation % 360 !== 0) {
      pipeline = pipeline.rotate(options.rotation);
    }

    // 2. Crop extraction (if provided)
    if (options.cropBounds && options.cropBounds.width > 20 && options.cropBounds.height > 20) {
      const { x, y, width, height } = options.cropBounds;
      const safeX = Math.max(0, Math.min(x, (metadata.width || 100) - 10));
      const safeY = Math.max(0, Math.min(y, (metadata.height || 100) - 10));
      const safeWidth = Math.min(width, (metadata.width || 100) - safeX);
      const safeHeight = Math.min(height, (metadata.height || 100) - safeY);

      if (safeWidth > 20 && safeHeight > 20) {
        pipeline = pipeline.extract({
          left: Math.round(safeX),
          top: Math.round(safeY),
          width: Math.round(safeWidth),
          height: Math.round(safeHeight),
        });
      }
    }

    // 3. Document Filter Mode Processing
    const filter = options.filterMode || 'MAGIC_COLOR';

    switch (filter) {
      case 'MAGIC_COLOR': {
        const b = 1 + (options.brightness || 8) / 100;
        const c = 1.15 + (options.contrast || 15) / 100;
        pipeline = pipeline
          .modulate({ brightness: b, saturation: 1.1 })
          .linear(c, -(128 * (c - 1)))
          .sharpen({ sigma: 1.0, m1: 0.5, m2: 2.0 });
        break;
      }
      case 'BW_PHOTOCOPY': {
        const threshVal = Math.min(250, Math.max(10, options.threshold || 128));
        pipeline = pipeline
          .grayscale()
          .threshold(threshVal)
          .sharpen();
        break;
      }
      case 'GRAYSCALE': {
        const b = 1 + (options.brightness || 5) / 100;
        const c = 1.1 + (options.contrast || 10) / 100;
        pipeline = pipeline
          .grayscale()
          .modulate({ brightness: b })
          .linear(c, -(128 * (c - 1)))
          .sharpen();
        break;
      }
      case 'ORIGINAL':
      default: {
        if (options.brightness || options.contrast) {
          const b = 1 + (options.brightness || 0) / 100;
          const c = 1 + (options.contrast || 0) / 100;
          pipeline = pipeline.modulate({ brightness: b }).linear(c, -(128 * (c - 1)));
        }
        break;
      }
    }

    // 4. Resize to target card dimensions in pixels at 300 DPI
    const wMm = options.widthMm || 85.6;
    const hMm = options.heightMm || 54;
    const targetW = Math.round((wMm / 25.4) * 300);
    const targetH = Math.round((hMm / 25.4) * 300);

    const processedBuffer = await pipeline
      .resize(targetW, targetH, { fit: 'fill' })
      .withMetadata({ density: 300 })
      .jpeg({ quality: 95 })
      .toBuffer();

    return {
      buffer: processedBuffer,
      base64: `data:image/jpeg;base64,${processedBuffer.toString('base64')}`,
      width: targetW,
      height: targetH,
      dpi: 300,
    };
  }

  /**
   * Compose Front and Back ID Cards onto an A4 Sheet with precision cut lines
   */
  public async composeIdCardA4Sheet(
    frontBuffer: Buffer,
    backBuffer?: Buffer,
    options: ComposeIdCardA4Options = {}
  ): Promise<{
    buffer: Buffer;
    base64: string;
    sheetWidth: number;
    sheetHeight: number;
    copies: number;
    dpi: number;
  }> {
    const isLandscape = options.orientation === 'LANDSCAPE';
    // A4 dimensions at 300 DPI: 2480 x 3508 px
    const sheetWidth = isLandscape ? 3508 : 2480;
    const sheetHeight = isLandscape ? 2480 : 3508;

    const preset = ID_CARD_PRESETS[options.cardType || 'SMART_NID'] || ID_CARD_PRESETS.SMART_NID;
    const wMm = options.widthMm || preset.widthMm;
    const hMm = options.heightMm || preset.heightMm;

    // Card dimensions in pixels at 300 DPI:
    const cardW = Math.round((wMm / 25.4) * 300);
    const cardH = Math.round((hMm / 25.4) * 300);

    const arrangement = options.arrangement || 'SIDE_BY_SIDE';
    const copies = Math.min(10, Math.max(1, options.copies || 1));
    const marginMm = typeof options.marginMm === 'number' ? options.marginMm : 15;
    const gapMm = typeof options.gapMm === 'number' ? options.gapMm : 10;
    const showCutMarks = options.showCutMarks !== false;

    const gapPx = Math.round((gapMm / 25.4) * 300);
    const marginPx = Math.round((marginMm / 25.4) * 300);

    // Normalize buffers
    const frontResized = await sharp(frontBuffer).resize(cardW, cardH, { fit: 'fill' }).toBuffer();
    const backResized = backBuffer
      ? await sharp(backBuffer).resize(cardW, cardH, { fit: 'fill' }).toBuffer()
      : null;

    const hasBack = !!backResized;
    const composites: OverlayOptions[] = [];

    // Hairline cut marks SVG
    const cutMarkLength = 20;
    let cutMarksSvg = `<svg width="${sheetWidth}" height="${sheetHeight}">`;

    // Helper to add cut marks around a card box
    const addCardCutMarks = (left: number, top: number, w: number, h: number) => {
      if (!showCutMarks) return;
      const right = left + w;
      const bottom = top + h;

      // Subtle light border outline around card
      cutMarksSvg += `<rect x="${left}" y="${top}" width="${w}" height="${h}" fill="none" stroke="#CBD5E1" stroke-width="1" stroke-dasharray="3,3" />`;

      // 4-corner scissor registration marks
      cutMarksSvg += `<line x1="${left - cutMarkLength}" y1="${top}" x2="${left}" y2="${top}" stroke="#64748B" stroke-width="1.5" />`;
      cutMarksSvg += `<line x1="${left}" y1="${top - cutMarkLength}" x2="${left}" y2="${top}" stroke="#64748B" stroke-width="1.5" />`;
      cutMarksSvg += `<line x1="${right}" y1="${top}" x2="${right + cutMarkLength}" y2="${top}" stroke="#64748B" stroke-width="1.5" />`;
      cutMarksSvg += `<line x1="${right}" y1="${top - cutMarkLength}" x2="${right}" y2="${top}" stroke="#64748B" stroke-width="1.5" />`;
      cutMarksSvg += `<line x1="${left - cutMarkLength}" y1="${bottom}" x2="${left}" y2="${bottom}" stroke="#64748B" stroke-width="1.5" />`;
      cutMarksSvg += `<line x1="${left}" y1="${bottom}" x2="${left}" y2="${bottom + cutMarkLength}" stroke="#64748B" stroke-width="1.5" />`;
      cutMarksSvg += `<line x1="${right}" y1="${bottom}" x2="${right + cutMarkLength}" y2="${bottom}" stroke="#64748B" stroke-width="1.5" />`;
      cutMarksSvg += `<line x1="${right}" y1="${bottom}" x2="${right}" y2="${bottom + cutMarkLength}" stroke="#64748B" stroke-width="1.5" />`;
    };

    if (arrangement === 'SIDE_BY_SIDE') {
      // Pair width = cardW + gapPx + (hasBack ? cardW : 0)
      const pairW = hasBack ? cardW * 2 + gapPx : cardW;
      const pairH = cardH;

      for (let i = 0; i < copies; i++) {
        // Place vertically down the page or 2 columns if copies > 2
        let startX: number;
        let startY: number;

        if (copies === 1) {
          // Centered on upper half of A4 page (standard BD photocopy practice)
          startX = Math.round((sheetWidth - pairW) / 2);
          startY = marginPx + 200;
        } else if (copies === 2) {
          startX = Math.round((sheetWidth - pairW) / 2);
          startY = marginPx + 150 + i * (pairH + gapPx + 200);
        } else {
          // Multiple rows
          startX = Math.round((sheetWidth - pairW) / 2);
          startY = marginPx + i * (pairH + gapPx + 40);
        }

        // Place Front Card
        composites.push({
          input: frontResized,
          left: startX,
          top: startY,
        });
        addCardCutMarks(startX, startY, cardW, cardH);

        // Place Back Card
        if (hasBack && backResized) {
          const backX = startX + cardW + gapPx;
          composites.push({
            input: backResized,
            left: backX,
            top: startY,
          });
          addCardCutMarks(backX, startY, cardW, cardH);

          // Fold guideline between front and back
          if (showCutMarks) {
            const foldX = startX + cardW + Math.round(gapPx / 2);
            cutMarksSvg += `<line x1="${foldX}" y1="${startY - 10}" x2="${foldX}" y2="${startY + pairH + 10}" stroke="#94A3B8" stroke-width="1" stroke-dasharray="4,4" />`;
          }
        }
      }
    } else if (arrangement === 'STACKED') {
      // Front on top, Back on bottom
      const pairW = cardW;
      const pairH = hasBack ? cardH * 2 + gapPx : cardH;

      for (let i = 0; i < copies; i++) {
        const startX = Math.round((sheetWidth - pairW) / 2);
        const startY = marginPx + 100 + i * (pairH + gapPx + 100);

        composites.push({
          input: frontResized,
          left: startX,
          top: startY,
        });
        addCardCutMarks(startX, startY, cardW, cardH);

        if (hasBack && backResized) {
          const backY = startY + cardH + gapPx;
          composites.push({
            input: backResized,
            left: startX,
            top: backY,
          });
          addCardCutMarks(startX, backY, cardW, cardH);

          if (showCutMarks) {
            const foldY = startY + cardH + Math.round(gapPx / 2);
            cutMarksSvg += `<line x1="${startX - 10}" y1="${foldY}" x2="${startX + cardW + 10}" y2="${foldY}" stroke="#94A3B8" stroke-width="1" stroke-dasharray="4,4" />`;
          }
        }
      }
    } else {
      // GRID: 2 columns grid for 4, 8, 10 copies
      const cols = 2;
      const colW = cardW + gapPx;
      const rowH = cardH + gapPx;

      let placed = 0;
      for (let i = 0; i < copies && placed < 10; i++) {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const startX = marginPx + c * colW;
        const startY = marginPx + r * rowH;

        composites.push({
          input: frontResized,
          left: startX,
          top: startY,
        });
        addCardCutMarks(startX, startY, cardW, cardH);
        placed++;
      }
    }

    cutMarksSvg += `</svg>`;

    // Overlay cut marks
    composites.push({
      input: Buffer.from(cutMarksSvg),
      left: 0,
      top: 0,
    });

    // Create pristine white A4 background
    const sheetBuffer = await sharp({
      create: {
        width: sheetWidth,
        height: sheetHeight,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite(composites)
      .withMetadata({ density: 300 })
      .jpeg({ quality: 95 })
      .toBuffer();

    const base64 = `data:image/jpeg;base64,${sheetBuffer.toString('base64')}`;

    return {
      buffer: sheetBuffer,
      base64,
      sheetWidth,
      sheetHeight,
      copies,
      dpi: 300,
    };
  }

  /**
   * Wrap A4 ID Card Sheet into a Vector PDF
   */
  public generateIdCardPdf(
    sheetImageBuffer: Buffer,
    orientation: 'PORTRAIT' | 'LANDSCAPE' = 'PORTRAIT'
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const isLandscape = orientation === 'LANDSCAPE';
      const size: [number, number] = isLandscape ? [841.89, 595.28] : [595.28, 841.89];

      const doc = new PDFDocument({
        size,
        margin: 0,
        layout: isLandscape ? 'landscape' : 'portrait',
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      doc.image(sheetImageBuffer, 0, 0, {
        width: size[0],
        height: size[1],
      });

      doc.end();
    });
  }

  /**
   * Save ID Card Job to MongoDB with Audit Logging for PII Document Security
   */
  public async saveIdCardJob(
    tenantId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    data: any
  ): Promise<IIdCardJob> {
    const tId = new mongoose.Types.ObjectId(tenantId);
    const uId = new mongoose.Types.ObjectId(userId);
    const jobCode = `IDC-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;

    const preset = ID_CARD_PRESETS[data.cardType || 'SMART_NID'] || ID_CARD_PRESETS.SMART_NID;
    const copies = Number(data.copies) || 1;
    const totalAmount = data.totalAmount || (copies * 10); // Default 10 BDT per ID Card copy

    const idCardJob = await IdCardJob.create({
      tenantId: tId,
      jobCode,
      customerName: data.customerName || 'Walk-in Customer',
      customerPhone: data.customerPhone || 'N/A',
      cardType: data.cardType || 'SMART_NID',
      cardTitle: data.cardTitle || preset.name,
      cardDimensionsMm: {
        width: data.cardDimensionsMm?.width || preset.widthMm,
        height: data.cardDimensionsMm?.height || preset.heightMm,
      },
      frontImage: data.frontImage || {},
      backImage: data.backImage || {},
      layoutSettings: {
        arrangement: data.layoutSettings?.arrangement || 'SIDE_BY_SIDE',
        copies,
        orientation: data.layoutSettings?.orientation || 'PORTRAIT',
        marginMm: typeof data.layoutSettings?.marginMm === 'number' ? data.layoutSettings.marginMm : 15,
        gapMm: typeof data.layoutSettings?.gapMm === 'number' ? data.layoutSettings.gapMm : 10,
        showCutMarks: data.layoutSettings?.showCutMarks !== false,
      },
      sheetImageUrl: data.sheetImageUrl,
      copies,
      totalAmount,
      notes: data.notes,
      status: 'SAVED',
    });

    // Also register in central Shop Queue
    await Job.create({
      tenantId: tId,
      jobCode,
      customerName: data.customerName || 'Walk-in Customer',
      customerPhone: data.customerPhone || 'N/A',
      serviceType: 'ID_CARD_A4',
      status: 'PRINT_READY',
      priority: 'NORMAL',
      copies,
      paperType: 'A4 100 GSM / Laminated Copy',
      totalAmount,
      paidAmount: totalAmount,
      paymentStatus: 'PAID',
      notes: `${preset.name} (${copies} copies, ${data.layoutSettings?.arrangement || 'SIDE_BY_SIDE'})`,
    });

    // Security Audit Log: Track identity document creation & retention
    await AuditLog.create({
      tenantId: tId,
      userId: uId,
      action: 'ID_CARD_JOB_CREATED',
      resource: 'IdCardJob',
      details: {
        jobCode,
        cardType: data.cardType || 'SMART_NID',
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        copies,
        retentionPolicy: 'PRIVATE_TENANT_SECURE',
      },
    });

    // Increment tenant quota
    await Tenant.findByIdAndUpdate(tId, {
      $inc: { 'quotas.monthlyIdCardLayoutsUsed': copies },
    });

    return idCardJob;
  }

  /**
   * List saved ID Card jobs for tenant
   */
  public async listSavedJobs(tenantId: string | mongoose.Types.ObjectId): Promise<IIdCardJob[]> {
    const jobs = await IdCardJob.find({ tenantId: new mongoose.Types.ObjectId(tenantId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return jobs as unknown as IIdCardJob[];
  }

  /**
   * Get specific saved ID Card job with security audit log
   */
  public async getJobById(
    tenantId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    jobId: string
  ): Promise<IIdCardJob> {
    const tId = new mongoose.Types.ObjectId(tenantId);
    const job = await IdCardJob.findOne({
      _id: new mongoose.Types.ObjectId(jobId),
      tenantId: tId,
    }).lean();

    if (!job) {
      throw new NotFoundError('ID Card job not found or does not belong to this shop');
    }

    // Security Audit Log: Access to sensitive identity record
    await AuditLog.create({
      tenantId: tId,
      userId: new mongoose.Types.ObjectId(userId),
      action: 'ID_CARD_DOCUMENT_ACCESSED',
      resource: 'IdCardJob',
      details: {
        jobId,
        jobCode: job.jobCode,
        accessedAt: new Date(),
      },
    });

    return job as unknown as IIdCardJob;
  }
}

export const idCardService = new IdCardService();

