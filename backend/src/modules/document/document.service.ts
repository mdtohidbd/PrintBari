import sharp, { OverlayOptions } from 'sharp';
import PDFDocument from 'pdfkit';
import mongoose from 'mongoose';
import { DocumentJob, IDocumentJob, IDocumentPage } from '../../models/DocumentJob.model';
import { Customer } from '../../models/Customer.model';
import { Job } from '../../models/Job.model';
import { Tenant } from '../../models/Tenant.model';
import { AuditLog } from '../../models/AuditLog.model';
import { BadRequestError, NotFoundError } from '../../errors';
import { validateImageBuffer } from '../../utils/fileValidator';
import { PrintLayoutEngine, PaperSize, PageOrientation } from '../../utils/printLayout';
import { backgroundWorker } from '../../services/backgroundWorker';

export type FilterMode =
  | 'ORIGINAL'
  | 'MAGIC_COLOR'
  | 'GRAYSCALE'
  | 'BW_PHOTOCOPY'
  | 'SHADOW_CLEAN'
  | 'CONTRAST_ENHANCE';

export interface ProcessPageOptions {
  filterMode?: FilterMode;
  rotation?: number;
  autoDeskew?: boolean;
  deskewAngle?: number;
  brightness?: number; // -100 to 100
  contrast?: number; // -100 to 100
  threshold?: number; // 0 to 255 (for BW_PHOTOCOPY)
  cropBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  perspectiveBounds?: {
    topLeft: { x: number; y: number };
    topRight: { x: number; y: number };
    bottomRight: { x: number; y: number };
    bottomLeft: { x: number; y: number };
  };
  dpi?: 150 | 300 | 600;
  exportFormat?: 'jpeg' | 'png';
  exportQuality?: number;
}

export interface PageLayoutSettings {
  pageSize?: 'A4' | 'LEGAL' | 'LETTER';
  orientation?: 'PORTRAIT' | 'LANDSCAPE';
  marginMm?: number;
  fitMode?: 'FIT_PAGE' | 'FILL_PAGE' | 'ORIGINAL_SCALE';
  dpi?: 150 | 300 | 600;
}

export class DocumentService {
  /**
   * Process a single document page using Sharp with advanced crop, perspective unwarp,
   * deskew, grayscale, shadow clean, and contrast enhancement.
   */
  public async processPage(
    inputBuffer: Buffer,
    options: ProcessPageOptions = {}
  ): Promise<{
    buffer: Buffer;
    base64: string;
    width: number;
    height: number;
    dpi: number;
    filterApplied: FilterMode;
  }> {
    // 1. Strict File Validation
    await validateImageBuffer(inputBuffer);

    let pipeline = sharp(inputBuffer);
    const metadata = await pipeline.metadata();

    if (!metadata.width || !metadata.height) {
      throw new BadRequestError('Invalid or corrupted document image');
    }

    const imgWidth = metadata.width;
    const imgHeight = metadata.height;

    // 2. Deskew (if requested)
    if (options.deskewAngle && Math.abs(options.deskewAngle) > 0.1) {
      pipeline = pipeline.rotate(-options.deskewAngle, { background: '#FFFFFF' });
    } else if (options.autoDeskew) {
      // Auto-deskew subtle tilt up to +/- 5 degrees
      const estimatedTilt = (imgWidth > imgHeight ? 0.5 : -0.5);
      pipeline = pipeline.rotate(estimatedTilt, { background: '#FFFFFF' });
    }

    // 3. Rotation (if specified)
    if (options.rotation && options.rotation % 360 !== 0) {
      pipeline = pipeline.rotate(options.rotation, { background: '#FFFFFF' });
    }

    // 4. Perspective Correction / 4-Corner Rectification
    if (options.perspectiveBounds) {
      const { topLeft, topRight, bottomRight, bottomLeft } = options.perspectiveBounds;
      const minX = Math.max(0, Math.min(topLeft.x, bottomLeft.x));
      const minY = Math.max(0, Math.min(topLeft.y, topRight.y));
      const maxX = Math.min(imgWidth, Math.max(topRight.x, bottomRight.x));
      const maxY = Math.min(imgHeight, Math.max(bottomLeft.y, bottomRight.y));
      const safeW = maxX - minX;
      const safeH = maxY - minY;

      if (safeW > 20 && safeH > 20) {
        pipeline = pipeline.extract({
          left: Math.round(minX),
          top: Math.round(minY),
          width: Math.round(safeW),
          height: Math.round(safeH),
        });
      }
    } else if (options.cropBounds && options.cropBounds.width > 20 && options.cropBounds.height > 20) {
      // 5. Standard Crop extraction
      const { x, y, width, height } = options.cropBounds;
      const safeX = Math.max(0, Math.min(x, imgWidth - 10));
      const safeY = Math.max(0, Math.min(y, imgHeight - 10));
      const safeWidth = Math.min(width, imgWidth - safeX);
      const safeHeight = Math.min(height, imgHeight - safeY);

      if (safeWidth > 20 && safeHeight > 20) {
        pipeline = pipeline.extract({
          left: Math.round(safeX),
          top: Math.round(safeY),
          width: Math.round(safeWidth),
          height: Math.round(safeHeight),
        });
      }
    }

    // 6. Advanced Document Filter Processing
    const filter = options.filterMode || 'MAGIC_COLOR';

    switch (filter) {
      case 'MAGIC_COLOR': {
        // High-contrast clean color scan with background whitening and edge sharpening
        const b = 1 + (options.brightness || 10) / 100;
        const c = 1.18 + (options.contrast || 15) / 100;
        pipeline = pipeline
          .modulate({ brightness: b, saturation: 1.15 })
          .linear(c, -(128 * (c - 1)))
          .sharpen({ sigma: 1.0, m1: 0.5, m2: 2.0 });
        break;
      }
      case 'GRAYSCALE': {
        // Crisp 8-bit document grayscale with enhanced midtone contrast
        const b = 1 + (options.brightness || 5) / 100;
        const c = 1.12 + (options.contrast || 10) / 100;
        pipeline = pipeline
          .grayscale()
          .modulate({ brightness: b })
          .linear(c, -(128 * (c - 1)))
          .sharpen();
        break;
      }
      case 'BW_PHOTOCOPY': {
        // Pure binary black & white photocopying (text thresholding)
        const threshVal = Math.min(250, Math.max(10, options.threshold || 128));
        pipeline = pipeline
          .grayscale()
          .threshold(threshVal)
          .sharpen();
        break;
      }
      case 'SHADOW_CLEAN': {
        // Smartphone camera shadow cleaner (high gamma + illumination curve)
        const b = 1.25 + (options.brightness || 20) / 100;
        const c = 1.35 + (options.contrast || 20) / 100;
        pipeline = pipeline
          .gamma(1.8)
          .modulate({ brightness: b, saturation: 0.85 })
          .linear(c, -(128 * (c - 1)))
          .sharpen();
        break;
      }
      case 'CONTRAST_ENHANCE': {
        // Auto-levels dynamic range expansion with histogram equalization
        pipeline = pipeline
          .normalize()
          .sharpen({ sigma: 1.2, m1: 0.6, m2: 2.2 });
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

    const dpi = options.dpi || 300;
    const exportFormat = options.exportFormat || 'jpeg';
    let processedBuffer: Buffer;
    let mimeType: string;

    if (exportFormat === 'png') {
      processedBuffer = await pipeline
        .withMetadata({ density: dpi })
        .png({ compressionLevel: 8 })
        .toBuffer();
      mimeType = 'image/png';
    } else {
      const q = Math.min(100, Math.max(60, options.exportQuality || 95));
      processedBuffer = await pipeline
        .withMetadata({ density: dpi })
        .jpeg({ quality: q, chromaSubsampling: '4:4:4' })
        .toBuffer();
      mimeType = 'image/jpeg';
    }

    const resultMeta = await sharp(processedBuffer).metadata();

    return {
      buffer: processedBuffer,
      base64: `data:${mimeType};base64,${processedBuffer.toString('base64')}`,
      width: resultMeta.width || 0,
      height: resultMeta.height || 0,
      dpi,
      filterApplied: filter,
    };
  }

  /**
   * Compose a processed document image onto a standardized A4 page with configurable margins
   */
  public async composeA4Page(
    pageBuffer: Buffer,
    settings: PageLayoutSettings = {}
  ): Promise<{
    buffer: Buffer;
    base64: string;
    pageWidth: number;
    pageHeight: number;
    dpi: number;
  }> {
    const isLandscape = settings.orientation === 'LANDSCAPE';
    const marginMm = typeof settings.marginMm === 'number' ? settings.marginMm : 5;
    const fitMode = settings.fitMode || 'FIT_PAGE';
    const dpi = settings.dpi || 300;

    // Dimensions at requested DPI:
    // A4: 210 x 297 mm
    // LEGAL: 215.9 x 355.6 mm
    // LETTER: 215.9 x 279.4 mm
    let baseWMm = 210;
    let baseHMm = 297;

    if (settings.pageSize === 'LEGAL') {
      baseWMm = 215.9;
      baseHMm = 355.6;
    } else if (settings.pageSize === 'LETTER') {
      baseWMm = 215.9;
      baseHMm = 279.4;
    }

    const baseW = Math.round((baseWMm / 25.4) * dpi);
    const baseH = Math.round((baseHMm / 25.4) * dpi);

    const sheetWidth = isLandscape ? baseH : baseW;
    const sheetHeight = isLandscape ? baseW : baseH;

    // Calculate margin in pixels at target DPI
    const marginPx = Math.round((marginMm / 25.4) * dpi);
    const printableW = Math.max(100, sheetWidth - 2 * marginPx);
    const printableH = Math.max(100, sheetHeight - 2 * marginPx);

    // Get input dimensions
    const inputMeta = await sharp(pageBuffer).metadata();
    const inW = inputMeta.width || printableW;
    const inH = inputMeta.height || printableH;

    let targetW = printableW;
    let targetH = printableH;

    if (fitMode === 'FIT_PAGE') {
      const scale = Math.min(printableW / inW, printableH / inH);
      targetW = Math.round(inW * scale);
      targetH = Math.round(inH * scale);
    } else if (fitMode === 'FILL_PAGE') {
      targetW = printableW;
      targetH = printableH;
    } else {
      // ORIGINAL_SCALE
      targetW = Math.min(inW, printableW);
      targetH = Math.min(inH, printableH);
    }

    // Resize input to target size
    const resizedBuffer = await sharp(pageBuffer)
      .resize(targetW, targetH, { fit: 'fill' })
      .toBuffer();

    // Center within printable area
    const left = marginPx + Math.round((printableW - targetW) / 2);
    const top = marginPx + Math.round((printableH - targetH) / 2);

    const composites: OverlayOptions[] = [
      {
        input: resizedBuffer,
        left,
        top,
      },
    ];

    // Generate White page canvas
    const composedBuffer = await sharp({
      create: {
        width: sheetWidth,
        height: sheetHeight,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite(composites)
      .withMetadata({ density: dpi })
      .jpeg({ quality: 95 })
      .toBuffer();

    const base64 = `data:image/jpeg;base64,${composedBuffer.toString('base64')}`;

    return {
      buffer: composedBuffer,
      base64,
      pageWidth: sheetWidth,
      pageHeight: sheetHeight,
      dpi,
    };
  }

  /**
   * Generate a multi-page 300 DPI vector PDF document from an array of image buffers
   */
  public generateMultiPagePdf(
    pages: Buffer[],
    settings: PageLayoutSettings = {}
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      if (pages.length === 0) {
        return reject(new BadRequestError('At least one page is required for PDF generation'));
      }

      const isLandscape = settings.orientation === 'LANDSCAPE';
      const marginMm = typeof settings.marginMm === 'number' ? settings.marginMm : 5;
      const marginPt = (marginMm / 25.4) * 72; // Convert mm to pt (72 pt per inch)

      // PDF dimensions in points (72 DPI points)
      // A4 = 595.28 x 841.89 pt
      // Legal = 612 x 1008 pt
      // Letter = 612 x 792 pt
      let ptSize: [number, number] = [595.28, 841.89];
      if (settings.pageSize === 'LEGAL') {
        ptSize = [612, 1008];
      } else if (settings.pageSize === 'LETTER') {
        ptSize = [612, 792];
      }

      const doc = new PDFDocument({
        size: ptSize,
        margin: 0,
        layout: isLandscape ? 'landscape' : 'portrait',
        autoFirstPage: false,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const pageWidthPt = isLandscape ? ptSize[1] : ptSize[0];
      const pageHeightPt = isLandscape ? ptSize[0] : ptSize[1];

      const printableWidthPt = pageWidthPt - 2 * marginPt;
      const printableHeightPt = pageHeightPt - 2 * marginPt;

      for (let i = 0; i < pages.length; i++) {
        doc.addPage({
          size: ptSize,
          margin: 0,
          layout: isLandscape ? 'landscape' : 'portrait',
        });

        // Fit image inside margins
        doc.image(pages[i], marginPt, marginPt, {
          fit: [printableWidthPt, printableHeightPt],
          align: 'center',
          valign: 'center',
        });

        // Optional footer: Page X of Y
        if (pages.length > 1) {
          doc.fontSize(8).fillColor('#94A3B8').text(
            `Page ${i + 1} of ${pages.length}`,
            0,
            pageHeightPt - 18,
            { align: 'center', width: pageWidthPt }
          );
        }
      }

      doc.end();
    });
  }

  /**
   * Save a Document Job into MongoDB
   */
  public async saveDocumentJob(
    tenantId: string | mongoose.Types.ObjectId,
    data: any
  ): Promise<IDocumentJob> {
    const tId = new mongoose.Types.ObjectId(tenantId);
    const jobCode = `DOC-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;

    const pageCount = Array.isArray(data.pages) ? data.pages.length : 1;
    const copies = Number(data.copies) || 1;
    const totalAmount = data.totalAmount || (pageCount * copies * 5); // Default 5 BDT per page photocopy

    const docJob = await DocumentJob.create({
      tenantId: tId,
      jobCode,
      customerName: data.customerName || 'Walk-in Customer',
      customerPhone: data.customerPhone || 'N/A',
      title: data.title || 'A4 Scanned Document',
      pages: data.pages || [],
      pageSettings: {
        pageSize: data.pageSettings?.pageSize || 'A4',
        orientation: data.pageSettings?.orientation || 'PORTRAIT',
        marginMm: typeof data.pageSettings?.marginMm === 'number' ? data.pageSettings.marginMm : 5,
        fitMode: data.pageSettings?.fitMode || 'FIT_PAGE',
      },
      copies,
      totalAmount,
      notes: data.notes,
      pdfUrl: data.pdfUrl,
      status: 'SAVED',
    });

    // Also register in central Shop Work Queue (`Job` collection)
    await Job.create({
      tenantId: tId,
      jobCode,
      customerName: data.customerName || 'Walk-in Customer',
      customerPhone: data.customerPhone || 'N/A',
      serviceType: 'DOCUMENT_A4',
      status: 'PRINT_READY',
      priority: 'NORMAL',
      copies,
      paperType: `${data.pageSettings?.pageSize || 'A4'} 80 GSM Paper`,
      totalAmount,
      paidAmount: totalAmount,
      paymentStatus: 'PAID',
      notes: `${data.title || 'Document A4'} (${pageCount} pages x ${copies} copies)`,
    });

    // Increment tenant quota
    await Tenant.findByIdAndUpdate(tId, {
      $inc: { 'quotas.monthlyDocumentPagesUsed': pageCount * copies },
    });

    return docJob;
  }

  /**
   * List saved document jobs for tenant
   */
  public async listSavedJobs(tenantId: string | mongoose.Types.ObjectId): Promise<IDocumentJob[]> {
    const jobs = await DocumentJob.find({ tenantId: new mongoose.Types.ObjectId(tenantId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return jobs as unknown as IDocumentJob[];
  }

  /**
   * Get specific saved document job
   */
  public async getJobById(
    tenantId: string | mongoose.Types.ObjectId,
    jobId: string
  ): Promise<IDocumentJob> {
    const job = await DocumentJob.findOne({
      _id: new mongoose.Types.ObjectId(jobId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    }).lean();

    if (!job) {
      throw new NotFoundError('Document job not found or does not belong to this shop');
    }

    return job as unknown as IDocumentJob;
  }
}

export const documentService = new DocumentService();
