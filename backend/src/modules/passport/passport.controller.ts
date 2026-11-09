import { Request, Response } from 'express';
import { passportService, PASSPORT_PRESETS } from './passport.service';
import { ApiResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { BadRequestError } from '../../errors';

export class PassportController {
  public getPresets = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant?._id ? req.tenant._id.toString() : undefined;
    const presets = await passportService.getPresets(tenantId);
    ApiResponse.success(res, presets, 'Passport presets retrieved');
  });

  public createCustomPreset = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const { presetKey, name, country, widthMm, heightMm, bgColor, description } = req.body;

    if (!presetKey || !name || !widthMm || !heightMm) {
      throw new BadRequestError('presetKey, name, widthMm, and heightMm are required');
    }

    const preset = await passportService.createCustomPreset(tenantId, {
      presetKey,
      name,
      country,
      widthMm: Number(widthMm),
      heightMm: Number(heightMm),
      bgColor,
      description,
    });

    ApiResponse.created(res, preset, `Custom preset '${name}' created successfully`);
  });

  public processPhoto = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    let imageBuffer: Buffer;

    if (req.file) {
      imageBuffer = req.file.buffer;
    } else if (req.body.imageBase64) {
      const cleanBase64 = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(cleanBase64, 'base64');
    } else {
      throw new BadRequestError('Image file or base64 payload is required');
    }

    const { presetId, rotation, cropBounds, brightness, contrast, backgroundColor } = req.body;

    const parsedCrop = typeof cropBounds === 'string' ? JSON.parse(cropBounds) : cropBounds;

    const result = await passportService.processSinglePhoto(imageBuffer, {
      presetId,
      rotation: Number(rotation) || 0,
      cropBounds: parsedCrop,
      brightness: Number(brightness) || 0,
      contrast: Number(contrast) || 0,
      backgroundColor,
    });

    ApiResponse.success(
      res,
      {
        base64: result.base64,
        preset: result.preset,
        widthPx: result.widthPx,
        heightPx: result.heightPx,
        dpi: result.dpi,
      },
      'Passport photo processed successfully'
    );
  });

  public generateSheet = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    let singleBuffer: Buffer;

    if (req.file) {
      singleBuffer = req.file.buffer;
    } else if (req.body.imageBase64) {
      const cleanBase64 = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      singleBuffer = Buffer.from(cleanBase64, 'base64');
    } else {
      throw new BadRequestError('Single photo image is required to arrange sheet');
    }

    const { presetId, sheetLayout, copies } = req.body;

    const result = await passportService.composePrintSheet(singleBuffer, {
      presetId,
      sheetLayout: sheetLayout || '4x6',
      copies: Number(copies) || 8,
    });

    ApiResponse.success(res, result, 'Print sheet arranged with cut lines');
  });

  public exportPdf = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    let sheetBuffer: Buffer;

    if (req.file) {
      sheetBuffer = req.file.buffer;
    } else if (req.body.sheetBase64) {
      const cleanBase64 = req.body.sheetBase64.replace(/^data:image\/\w+;base64,/, '');
      sheetBuffer = Buffer.from(cleanBase64, 'base64');
    } else {
      throw new BadRequestError('Sheet image is required for PDF export');
    }

    const { sheetLayout = '4x6', filename = 'passport-print-sheet.pdf' } = req.body;

    const pdfBuffer = await passportService.generateSheetPdf(sheetBuffer, sheetLayout as any);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  });

  public saveJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const job = await passportService.savePassportJob(tenantId, req.body);
    ApiResponse.created(res, job, 'Passport photo job saved to shop queue');
  });

  public listJobs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const jobs = await passportService.listSavedJobs(tenantId);
    ApiResponse.success(res, jobs, 'Saved passport jobs retrieved');
  });

  public getJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
    const job = await passportService.getJobById(tenantId, jobId);
    ApiResponse.success(res, job, 'Passport job details retrieved');
  });
}

export const passportController = new PassportController();
