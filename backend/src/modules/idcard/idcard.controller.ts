import { Request, Response } from 'express';
import { idCardService, ID_CARD_PRESETS } from './idcard.service';
import { ApiResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { BadRequestError } from '../../errors';

export class IdCardController {
  public getPresets = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    ApiResponse.success(res, Object.values(ID_CARD_PRESETS), 'ID Card presets retrieved');
  });

  public processSide = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    let imageBuffer: Buffer;

    if (req.file) {
      imageBuffer = req.file.buffer;
    } else if (req.body.imageBase64) {
      const cleanBase64 = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(cleanBase64, 'base64');
    } else {
      throw new BadRequestError('ID Card image file or imageBase64 payload is required');
    }

    const { widthMm, heightMm, rotation, brightness, contrast, filterMode, threshold, cropBounds } = req.body;
    const parsedCrop = typeof cropBounds === 'string' ? JSON.parse(cropBounds) : cropBounds;

    const result = await idCardService.processCardSide(imageBuffer, {
      widthMm: widthMm ? Number(widthMm) : undefined,
      heightMm: heightMm ? Number(heightMm) : undefined,
      rotation: Number(rotation) || 0,
      brightness: Number(brightness) || 0,
      contrast: Number(contrast) || 0,
      filterMode,
      threshold: Number(threshold) || 128,
      cropBounds: parsedCrop,
    });

    ApiResponse.success(res, result, 'Card side processed successfully at 300 DPI');
  });

  public composeSheet = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const {
      frontImageBase64,
      backImageBase64,
      cardType = 'SMART_NID',
      widthMm,
      heightMm,
      arrangement = 'SIDE_BY_SIDE',
      copies = 1,
      orientation = 'PORTRAIT',
      marginMm = 15,
      gapMm = 10,
      showCutMarks = true,
    } = req.body;

    if (!frontImageBase64) {
      throw new BadRequestError('frontImageBase64 is required to compose ID Card A4 layout');
    }

    const frontClean = frontImageBase64.replace(/^data:image\/\w+;base64,/, '');
    const frontBuffer = Buffer.from(frontClean, 'base64');

    let backBuffer: Buffer | undefined;
    if (backImageBase64) {
      const backClean = backImageBase64.replace(/^data:image\/\w+;base64,/, '');
      backBuffer = Buffer.from(backClean, 'base64');
    }

    const result = await idCardService.composeIdCardA4Sheet(frontBuffer, backBuffer, {
      cardType,
      widthMm: widthMm ? Number(widthMm) : undefined,
      heightMm: heightMm ? Number(heightMm) : undefined,
      arrangement,
      copies: Number(copies) || 1,
      orientation,
      marginMm: Number(marginMm),
      gapMm: Number(gapMm),
      showCutMarks: showCutMarks !== false,
    });

    ApiResponse.success(res, result, 'ID Card A4 sheet composed successfully');
  });

  public exportPdf = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sheetBase64, orientation = 'PORTRAIT', filename = 'id-card-a4-print.pdf' } = req.body;

    if (!sheetBase64) {
      throw new BadRequestError('sheetBase64 is required for PDF export');
    }

    const cleanBase64 = sheetBase64.replace(/^data:image\/\w+;base64,/, '');
    const sheetBuffer = Buffer.from(cleanBase64, 'base64');

    const pdfBuffer = await idCardService.generateIdCardPdf(sheetBuffer, orientation as any);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  });

  public saveJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const userId = req.user!._id;
    const job = await idCardService.saveIdCardJob(tenantId, userId, req.body);
    ApiResponse.created(res, job, 'ID Card processing job saved to shop queue');
  });

  public listJobs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const jobs = await idCardService.listSavedJobs(tenantId);
    ApiResponse.success(res, jobs, 'Saved ID Card jobs retrieved');
  });

  public getJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const userId = req.user!._id;
    const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
    const job = await idCardService.getJobById(tenantId, userId, jobId);
    ApiResponse.success(res, job, 'ID Card job details retrieved');
  });
}

export const idCardController = new IdCardController();

