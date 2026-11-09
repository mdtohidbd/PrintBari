import { Request, Response } from 'express';
import { documentService } from './document.service';
import { ApiResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { BadRequestError } from '../../errors';

export class DocumentController {
  public processPage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    let imageBuffer: Buffer;

    if (req.file) {
      imageBuffer = req.file.buffer;
    } else if (req.body.imageBase64) {
      const cleanBase64 = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(cleanBase64, 'base64');
    } else {
      throw new BadRequestError('Document image file or imageBase64 payload is required');
    }

    const { filterMode, rotation, brightness, contrast, threshold, cropBounds } = req.body;
    const parsedCrop = typeof cropBounds === 'string' ? JSON.parse(cropBounds) : cropBounds;

    const result = await documentService.processPage(imageBuffer, {
      filterMode,
      rotation: Number(rotation) || 0,
      brightness: Number(brightness) || 0,
      contrast: Number(contrast) || 0,
      threshold: Number(threshold) || 128,
      cropBounds: parsedCrop,
    });

    ApiResponse.success(
      res,
      {
        base64: result.base64,
        width: result.width,
        height: result.height,
        dpi: result.dpi,
      },
      'Document page processed successfully'
    );
  });

  public composeA4 = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    let imageBuffer: Buffer;

    if (req.file) {
      imageBuffer = req.file.buffer;
    } else if (req.body.imageBase64) {
      const cleanBase64 = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(cleanBase64, 'base64');
    } else {
      throw new BadRequestError('Document page image is required to arrange A4 layout');
    }

    const { pageSize, orientation, marginMm, fitMode } = req.body;

    const result = await documentService.composeA4Page(imageBuffer, {
      pageSize,
      orientation,
      marginMm: typeof marginMm !== 'undefined' ? Number(marginMm) : 5,
      fitMode,
    });

    ApiResponse.success(res, result, 'A4 Page layout composed successfully');
  });

  public exportPdf = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { pagesBase64, pageSize = 'A4', orientation = 'PORTRAIT', marginMm = 5, filename = 'scanned-document.pdf' } = req.body;

    if (!Array.isArray(pagesBase64) || pagesBase64.length === 0) {
      throw new BadRequestError('pagesBase64 array with at least one page image is required');
    }

    const pageBuffers: Buffer[] = pagesBase64.map((b64: string) => {
      const clean = b64.replace(/^data:image\/\w+;base64,/, '');
      return Buffer.from(clean, 'base64');
    });

    const pdfBuffer = await documentService.generateMultiPagePdf(pageBuffers, {
      pageSize: pageSize as any,
      orientation: orientation as any,
      marginMm: Number(marginMm),
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  });

  public saveJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const job = await documentService.saveDocumentJob(tenantId, req.body);
    ApiResponse.created(res, job, 'Document processing job saved to shop queue');
  });

  public listJobs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const jobs = await documentService.listSavedJobs(tenantId);
    ApiResponse.success(res, jobs, 'Saved document jobs retrieved');
  });

  public getJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
    const job = await documentService.getJobById(tenantId, jobId);
    ApiResponse.success(res, job, 'Document job details retrieved');
  });
}

export const documentController = new DocumentController();

