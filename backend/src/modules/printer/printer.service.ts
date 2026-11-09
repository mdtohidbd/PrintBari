import PDFDocument from 'pdfkit';
import mongoose from 'mongoose';
import {
  PrinterDevice,
  PrintJob,
  IPrinterDevice,
  IPrintJob,
  PaperSize,
  Orientation,
  ColorMode,
  PrintQuality,
  IPrintSettings,
} from '../../models/PrintManagement.model';
import { Job } from '../../models/Job.model';
import { AuditLog } from '../../models/AuditLog.model';
import { BadRequestError, NotFoundError } from '../../errors';

export class PrinterService {
  /**
   * Pre-seed default studio printers if shop has none configured
   */
  public async ensureDefaultPrinters(tenantId: string): Promise<IPrinterDevice[]> {
    const tId = new mongoose.Types.ObjectId(tenantId);
    const count = await PrinterDevice.countDocuments({ tenantId: tId });
    if (count > 0) {
      return (await PrinterDevice.find({ tenantId: tId }).lean()) as unknown as IPrinterDevice[];
    }

    const defaultPrinters = [
      {
        tenantId: tId,
        name: 'Epson EcoTank L805 Photo Printer',
        printerModel: 'Epson L805 (6-Color Dye Ink)',
        type: 'PHOTO' as const,
        connectionType: 'BROWSER_DIALOG' as const,
        isOnline: true,
        supportedPaperSizes: ['4x6', 'A4'] as PaperSize[],
        colorCapable: true,
        defaultCopies: 1,
        currentInkLevels: { black: 88, cyan: 82, magenta: 79, yellow: 91, lightCyan: 85, lightMagenta: 83 },
        isDefault: true,
      },
      {
        tenantId: tId,
        name: 'Canon PIXMA G2010 Color All-in-One',
        printerModel: 'Canon G2010 MegaTank',
        type: 'DOCUMENT_COLOR' as const,
        connectionType: 'BROWSER_DIALOG' as const,
        isOnline: true,
        supportedPaperSizes: ['A4', 'LEGAL', 'LETTER'] as PaperSize[],
        colorCapable: true,
        defaultCopies: 1,
        currentInkLevels: { black: 95, cyan: 70, magenta: 65, yellow: 84 },
        isDefault: false,
      },
      {
        tenantId: tId,
        name: 'HP LaserJet Pro M404dn Monochrome',
        printerModel: 'HP M404dn (38 ppm Laser)',
        type: 'MONO_LASER' as const,
        connectionType: 'BROWSER_DIALOG' as const,
        isOnline: true,
        supportedPaperSizes: ['A4', 'LEGAL', 'LETTER'] as PaperSize[],
        colorCapable: false,
        defaultCopies: 1,
        currentInkLevels: { black: 92, cyan: 0, magenta: 0, yellow: 0 },
        isDefault: false,
      },
    ];

    return (await PrinterDevice.insertMany(defaultPrinters)) as unknown as IPrinterDevice[];
  }

  /**
   * List all configured printers for a shop
   */
  public async listPrinters(tenantId: string): Promise<IPrinterDevice[]> {
    await this.ensureDefaultPrinters(tenantId);
    const printers = await PrinterDevice.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
    })
      .sort({ isDefault: -1, name: 1 })
      .lean();

    return printers as unknown as IPrinterDevice[];
  }

  /**
   * Check for potential duplicate printing within recent window
   */
  public async checkRecentDuplicate(
    tenantId: string,
    jobCode: string
  ): Promise<{ isDuplicate: boolean; recentPrint?: IPrintJob; message?: string }> {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    const recent = await PrintJob.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      jobCode: jobCode.trim(),
      status: { $in: ['QUEUED', 'SENDING', 'PRINTING', 'COMPLETED'] },
      createdAt: { $gte: fifteenMinutesAgo },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (recent) {
      const minutesAgo = Math.max(1, Math.round((Date.now() - new Date(recent.createdAt).getTime()) / 60000));
      return {
        isDuplicate: true,
        recentPrint: recent as unknown as IPrintJob,
        message: `Warning: Job ${jobCode} was already printed ${minutesAgo} minute(s) ago by ${recent.staffName}.`,
      };
    }

    return { isDuplicate: false };
  }

  /**
   * Add a job to the print queue
   */
  public async enqueuePrintJob(
    tenantId: string,
    payload: {
      jobId?: string;
      jobCode?: string;
      customerId?: string;
      customerName?: string;
      customerPhone?: string;
      printerId?: string;
      serviceType?: string;
      documentUrl: string;
      documentTitle?: string;
      settings?: Partial<IPrintSettings>;
      staffId?: string;
      staffName?: string;
      allowDuplicate?: boolean;
    }
  ): Promise<{ printJob: IPrintJob; duplicateWarning?: string }> {
    const tId = new mongoose.Types.ObjectId(tenantId);
    const jobCode = payload.jobCode || `JOB-${Date.now().toString().slice(-4)}`;

    // Accidental Duplicate Check
    let duplicateWarning: string | undefined;
    if (!payload.allowDuplicate) {
      const dupCheck = await this.checkRecentDuplicate(tenantId, jobCode);
      if (dupCheck.isDuplicate) {
        throw new BadRequestError(
          `${dupCheck.message} If you intentionally want to re-print, enable 'Allow Duplicate Print'.`
        );
      }
    } else {
      const dupCheck = await this.checkRecentDuplicate(tenantId, jobCode);
      if (dupCheck.isDuplicate) {
        duplicateWarning = dupCheck.message;
      }
    }

    // Lookup Printer
    let printerName = 'Default Shop Printer';
    let printerObjectId: mongoose.Types.ObjectId | undefined;

    if (payload.printerId && mongoose.Types.ObjectId.isValid(payload.printerId)) {
      const device = await PrinterDevice.findOne({ _id: new mongoose.Types.ObjectId(payload.printerId), tenantId: tId });
      if (device) {
        printerName = device.name;
        printerObjectId = device._id;
      }
    } else {
      const defaultDevice = await PrinterDevice.findOne({ tenantId: tId, isDefault: true });
      if (defaultDevice) {
        printerName = defaultDevice.name;
        printerObjectId = defaultDevice._id;
      }
    }

    // Find highest queue position
    const lastInQueue = await PrintJob.findOne({
      tenantId: tId,
      status: { $in: ['QUEUED', 'SENDING', 'PRINTING'] },
    })
      .sort({ queuePosition: -1 })
      .lean();

    const nextPosition = (lastInQueue?.queuePosition || 0) + 1;
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const printJobCode = `PRN-${Date.now().toString().slice(-4)}${randomSuffix}`;

    const printJob = new PrintJob({
      tenantId: tId,
      printJobCode,
      jobId: payload.jobId && mongoose.Types.ObjectId.isValid(payload.jobId) ? new mongoose.Types.ObjectId(payload.jobId) : undefined,
      jobCode,
      customerId: payload.customerId && mongoose.Types.ObjectId.isValid(payload.customerId) ? new mongoose.Types.ObjectId(payload.customerId) : undefined,
      customerName: payload.customerName || 'Walk-in Customer',
      customerPhone: payload.customerPhone || 'N/A',
      printerId: printerObjectId,
      printerName,
      serviceType: payload.serviceType || 'DOCUMENT_PRINT',
      queuePosition: nextPosition,
      documentUrl: payload.documentUrl,
      documentTitle: payload.documentTitle || 'Print Document',
      settings: {
        copies: payload.settings?.copies || 1,
        paperSize: payload.settings?.paperSize || 'A4',
        orientation: payload.settings?.orientation || 'PORTRAIT',
        colorMode: payload.settings?.colorMode || 'COLOR',
        quality: payload.settings?.quality || 'NORMAL',
        duplex: payload.settings?.duplex || 'NONE',
      },
      status: 'QUEUED',
      printedCopies: 0,
      staffId: payload.staffId && mongoose.Types.ObjectId.isValid(payload.staffId) ? new mongoose.Types.ObjectId(payload.staffId) : undefined,
      staffName: payload.staffName || 'Staff',
    });

    await printJob.save();

    // If source Job is linked, update its status to QUEUED
    if (payload.jobId && mongoose.Types.ObjectId.isValid(payload.jobId)) {
      await Job.updateOne(
        { _id: new mongoose.Types.ObjectId(payload.jobId), tenantId: tId },
        {
          $set: { status: 'QUEUED' },
          $push: {
            activityLogs: {
              activityId: `ACT-${Date.now()}`,
              action: 'QUEUED_FOR_PRINT',
              newStatus: 'QUEUED',
              changedByName: payload.staffName || 'Staff',
              note: `Spool queue code: ${printJobCode} -> ${printerName}`,
              timestamp: new Date(),
            },
          },
        }
      );
    }

    return { printJob, duplicateWarning };
  }

  /**
   * Get all active jobs currently in the print spooler queue
   */
  public async getPrintQueue(tenantId: string): Promise<IPrintJob[]> {
    const queue = await PrintJob.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      status: { $in: ['QUEUED', 'SENDING', 'PRINTING'] },
    })
      .sort({ queuePosition: 1, createdAt: 1 })
      .populate('printerId', 'name type isOnline supportedPaperSizes')
      .lean();

    return queue as unknown as IPrintJob[];
  }

  /**
   * Reorder priority of jobs in print queue
   */
  public async reorderPrintQueue(tenantId: string, orderedPrintJobIds: string[]): Promise<void> {
    const tId = new mongoose.Types.ObjectId(tenantId);

    const updatePromises = orderedPrintJobIds.map((id, index) => {
      if (!mongoose.Types.ObjectId.isValid(id)) return Promise.resolve();
      return PrintJob.updateOne(
        { _id: new mongoose.Types.ObjectId(id), tenantId: tId },
        { $set: { queuePosition: index + 1 } }
      );
    });

    await Promise.all(updatePromises);
  }

  /**
   * Update settings for a queued print job
   */
  public async updatePrintJobSettings(
    tenantId: string,
    printJobId: string,
    updates: {
      printerId?: string;
      copies?: number;
      paperSize?: PaperSize;
      orientation?: Orientation;
      colorMode?: ColorMode;
      quality?: PrintQuality;
    }
  ): Promise<IPrintJob | null> {
    const tId = new mongoose.Types.ObjectId(tenantId);
    if (!mongoose.Types.ObjectId.isValid(printJobId)) return null;

    const printJob = await PrintJob.findOne({
      _id: new mongoose.Types.ObjectId(printJobId),
      tenantId: tId,
    });

    if (!printJob) return null;

    if (updates.copies !== undefined) printJob.settings.copies = Number(updates.copies);
    if (updates.paperSize) printJob.settings.paperSize = updates.paperSize;
    if (updates.orientation) printJob.settings.orientation = updates.orientation;
    if (updates.colorMode) printJob.settings.colorMode = updates.colorMode;
    if (updates.quality) printJob.settings.quality = updates.quality;

    if (updates.printerId && mongoose.Types.ObjectId.isValid(updates.printerId)) {
      const printer = await PrinterDevice.findOne({ _id: new mongoose.Types.ObjectId(updates.printerId), tenantId: tId });
      if (printer) {
        printJob.printerId = printer._id;
        printJob.printerName = printer.name;
      }
    }

    await printJob.save();
    return printJob;
  }

  /**
   * Remove job from print queue (cancel)
   */
  public async removePrintJob(tenantId: string, printJobId: string): Promise<boolean> {
    const tId = new mongoose.Types.ObjectId(tenantId);
    if (!mongoose.Types.ObjectId.isValid(printJobId)) return false;

    const result = await PrintJob.updateOne(
      { _id: new mongoose.Types.ObjectId(printJobId), tenantId: tId },
      { $set: { status: 'CANCELLED', completedAt: new Date() } }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Mark print job as started / printing
   */
  public async markPrintingStarted(tenantId: string, printJobId: string): Promise<IPrintJob | null> {
    const tId = new mongoose.Types.ObjectId(tenantId);
    if (!mongoose.Types.ObjectId.isValid(printJobId)) return null;

    const printJob = await PrintJob.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(printJobId), tenantId: tId },
      { $set: { status: 'PRINTING', startedAt: new Date() } },
      { new: true }
    );

    if (printJob && printJob.jobId) {
      await Job.updateOne(
        { _id: printJob.jobId, tenantId: tId },
        {
          $set: { status: 'PRINTING' },
          $push: {
            activityLogs: {
              activityId: `ACT-${Date.now()}`,
              action: 'HARDWARE_PRINT_STARTED',
              newStatus: 'PRINTING',
              note: `Physical printing initiated on ${printJob.printerName}`,
              timestamp: new Date(),
            },
          },
        }
      );
    }

    return printJob;
  }

  /**
   * Mark print job as successfully completed
   */
  public async markPrintingCompleted(
    tenantId: string,
    printJobId: string,
    printedCopies?: number
  ): Promise<IPrintJob | null> {
    const tId = new mongoose.Types.ObjectId(tenantId);
    if (!mongoose.Types.ObjectId.isValid(printJobId)) return null;

    const printJob = await PrintJob.findOne({
      _id: new mongoose.Types.ObjectId(printJobId),
      tenantId: tId,
    });

    if (!printJob) return null;

    printJob.status = 'COMPLETED';
    printJob.completedAt = new Date();
    printJob.printedCopies = printedCopies || printJob.settings.copies;

    await printJob.save();

    // Sync to main Job
    if (printJob.jobId) {
      await Job.updateOne(
        { _id: printJob.jobId, tenantId: tId },
        {
          $set: { status: 'COMPLETED', completedAt: new Date() },
          $push: {
            activityLogs: {
              activityId: `ACT-${Date.now()}`,
              action: 'HARDWARE_PRINT_COMPLETED',
              newStatus: 'COMPLETED',
              note: `Successfully printed ${printJob.printedCopies} copies on ${printJob.printerName}`,
              timestamp: new Date(),
            },
          },
        }
      );
    }

    // System Audit Log
    await AuditLog.create({
      tenantId: tId,
      action: 'PRINT_JOB_COMPLETED',
      details: {
        printJobCode: printJob.printJobCode,
        jobCode: printJob.jobCode,
        printerName: printJob.printerName,
        copies: printJob.printedCopies,
      },
      status: 'SUCCESS',
    });

    return printJob;
  }

  /**
   * Get print history with search, pagination and filtering
   */
  public async getPrintHistory(
    tenantId: string,
    filter: { search?: string; status?: string; printerId?: string; page?: number; limit?: number } = {}
  ): Promise<{ history: IPrintJob[]; total: number; page: number; totalPages: number }> {
    const tId = new mongoose.Types.ObjectId(tenantId);
    const page = Math.max(1, filter.page || 1);
    const limit = Math.max(1, Math.min(100, filter.limit || 20));
    const skip = (page - 1) * limit;

    const query: any = {
      tenantId: tId,
      status: filter.status ? filter.status : { $in: ['COMPLETED', 'FAILED', 'CANCELLED'] },
    };

    if (filter.printerId && mongoose.Types.ObjectId.isValid(filter.printerId)) {
      query.printerId = new mongoose.Types.ObjectId(filter.printerId);
    }

    if (filter.search) {
      const searchRegex = new RegExp(filter.search.trim(), 'i');
      query.$or = [
        { printJobCode: searchRegex },
        { jobCode: searchRegex },
        { customerName: searchRegex },
        { customerPhone: searchRegex },
        { printerName: searchRegex },
        { staffName: searchRegex },
      ];
    }

    const [history, total] = await Promise.all([
      PrintJob.find(query)
        .sort({ completedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('printerId', 'name type')
        .lean(),
      PrintJob.countDocuments(query),
    ]);

    return {
      history: history as unknown as IPrintJob[],
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Generate 300 DPI vector PDF for print-ready download
   */
  public async generatePrintPdf(
    title: string,
    paperSize: PaperSize = 'A4',
    orientation: Orientation = 'PORTRAIT',
    imageBuffer?: Buffer
  ): Promise<Buffer> {
    // Exact physical points at 72 pt/inch
    // A4: 595.28 x 841.89
    // 4x6 inch: 288 x 432
    // Legal: 612 x 1008
    // Letter: 612 x 792
    let width = 595.28;
    let height = 841.89;

    if (paperSize === '4x6') {
      width = 288;
      height = 432;
    } else if (paperSize === 'LEGAL') {
      width = 612;
      height = 1008;
    } else if (paperSize === 'LETTER') {
      width = 612;
      height = 792;
    }

    if (orientation === 'LANDSCAPE') {
      const tmp = width;
      width = height;
      height = tmp;
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: [width, height],
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      if (imageBuffer) {
        doc.image(imageBuffer, 0, 0, {
          fit: [width, height],
          align: 'center',
          valign: 'center',
        });
      } else {
        // Fallback printable sheet banner
        doc
          .rect(0, 0, width, height)
          .fill('#ffffff');

        doc
          .fillColor('#1e293b')
          .fontSize(16)
          .font('Helvetica-Bold')
          .text(title || 'Print Ready Document', 40, 50, { align: 'center', width: width - 80 });

        doc
          .fontSize(10)
          .font('Helvetica')
          .fillColor('#64748b')
          .text(`Paper: ${paperSize} | Orientation: ${orientation} | Generated by DocuStudio Spooler`, 40, 80, {
            align: 'center',
            width: width - 80,
          });
      }

      doc.end();
    });
  }
}

export const printerService = new PrinterService();
