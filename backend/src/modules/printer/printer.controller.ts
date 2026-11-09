import { Request, Response } from 'express';
import { printerService } from './printer.service';
import { ApiResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { BadRequestError, NotFoundError } from '../../errors';

export class PrinterController {
  /**
   * List configured printers for this shop
   */
  public listPrinters = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id.toString();
    const printers = await printerService.listPrinters(tenantId);
    ApiResponse.success(res, printers, 'Configured shop printers retrieved');
  });

  /**
   * Enqueue a job into print spooler queue
   */
  public enqueueJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id.toString();
    const staffId = req.user?._id?.toString();
    const staffName = req.user?.fullName || 'Shop Staff';

    const result = await printerService.enqueuePrintJob(tenantId, {
      ...req.body,
      staffId,
      staffName,
    });

    ApiResponse.created(
      res,
      result.printJob,
      result.duplicateWarning
        ? `Job queued successfully (${result.duplicateWarning})`
        : 'Job successfully queued to print spooler'
    );
  });

  /**
   * Get active print queue
   */
  public getQueue = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id.toString();
    const queue = await printerService.getPrintQueue(tenantId);
    ApiResponse.success(res, queue, 'Active print spooler queue retrieved');
  });

  /**
   * Reorder print queue priorities
   */
  public reorderQueue = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id.toString();
    const { orderedIds } = req.body;

    if (!Array.isArray(orderedIds)) {
      throw new BadRequestError('orderedIds must be an array of print job IDs');
    }

    await printerService.reorderPrintQueue(tenantId, orderedIds);
    const updatedQueue = await printerService.getPrintQueue(tenantId);
    ApiResponse.success(res, updatedQueue, 'Print queue priority reordered');
  });

  /**
   * Update print job settings in queue
   */
  public updateSettings = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id.toString();
    const printJobId = String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);

    const updated = await printerService.updatePrintJobSettings(tenantId, printJobId, req.body);
    if (!updated) {
      throw new NotFoundError('Print job not found in queue');
    }

    ApiResponse.success(res, updated, 'Print settings updated');
  });

  /**
   * Remove / Cancel job from queue
   */
  public removeJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id.toString();
    const printJobId = String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);

    const removed = await printerService.removePrintJob(tenantId, printJobId);
    if (!removed) {
      throw new NotFoundError('Print job not found in queue');
    }

    ApiResponse.success(res, null, 'Print job cancelled and removed from active queue');
  });

  /**
   * Mark print job started
   */
  public startPrint = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id.toString();
    const printJobId = String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);

    const updated = await printerService.markPrintingStarted(tenantId, printJobId);
    if (!updated) {
      throw new NotFoundError('Print job not found in queue');
    }

    ApiResponse.success(res, updated, 'Print job status set to PRINTING');
  });

  /**
   * Mark print job completed
   */
  public completePrint = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id.toString();
    const printJobId = String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    const { printedCopies } = req.body;

    const updated = await printerService.markPrintingCompleted(tenantId, printJobId, printedCopies);
    if (!updated) {
      throw new NotFoundError('Print job not found');
    }

    ApiResponse.success(res, updated, 'Print job completed and archived to history');
  });

  /**
   * Get print history archive
   */
  public getHistory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id.toString();
    const { search, status, printerId, page, limit } = req.query;

    const result = await printerService.getPrintHistory(tenantId, {
      search: search as string,
      status: status as string,
      printerId: printerId as string,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    ApiResponse.success(res, result, 'Print history retrieved');
  });

  /**
   * Download print-ready vector PDF
   */
  public downloadPrintPdf = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { title = 'Print Document', paperSize = 'A4', orientation = 'PORTRAIT', imageBase64 } = req.body;

    let buffer: Buffer | undefined;
    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(cleanBase64, 'base64');
    }

    const pdfBuffer = await printerService.generatePrintPdf(title, paperSize, orientation, buffer);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="print-ready-document.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  });
}

export const printerController = new PrinterController();

