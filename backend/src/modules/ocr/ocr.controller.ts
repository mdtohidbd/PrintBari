import { Request, Response } from 'express';
import { ocrService } from './ocr.service';
import { ApiResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { BadRequestError, NotFoundError } from '../../errors';

export class OcrController {
  /**
   * Preprocess handwriting image (contrast, binarization, sharpening)
   */
  public preprocessImage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    let imageBuffer: Buffer;

    if (req.file) {
      imageBuffer = req.file.buffer;
    } else if (req.body.imageBase64) {
      const cleanBase64 = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(cleanBase64, 'base64');
    } else {
      throw new BadRequestError('Image file or imageBase64 payload is required');
    }

    const { grayscale, contrast, binarize, denoise, deskew } = req.body;

    const result = await ocrService.preprocessImage(imageBuffer, {
      grayscale: grayscale !== undefined ? grayscale === true || grayscale === 'true' : true,
      contrast: contrast !== undefined ? Number(contrast) : 1.25,
      binarize: binarize !== undefined ? binarize === true || binarize === 'true' : false,
      denoise: denoise !== undefined ? denoise === true || denoise === 'true' : true,
      deskew: deskew !== undefined ? deskew === true || deskew === 'true' : false,
    });

    ApiResponse.success(
      res,
      {
        preprocessedBase64: result.base64,
      },
      'Handwriting image preprocessed successfully'
    );
  });

  /**
   * Extract text from handwriting image using OCR
   */
  public extractText = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    let imageBuffer: Buffer;

    if (req.file) {
      imageBuffer = req.file.buffer;
    } else if (req.body.imageBase64) {
      const cleanBase64 = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(cleanBase64, 'base64');
    } else {
      throw new BadRequestError('Image file or imageBase64 payload is required');
    }

    const {
      language = 'eng',
      engine = 'tesseract',
      grayscale,
      contrast,
      binarize,
      denoise,
      deskew,
    } = req.body;

    const result = await ocrService.extractText(
      imageBuffer,
      language,
      engine,
      {
        grayscale: grayscale !== undefined ? grayscale === true || grayscale === 'true' : true,
        contrast: contrast !== undefined ? Number(contrast) : 1.25,
        binarize: binarize !== undefined ? binarize === true || binarize === 'true' : false,
        denoise: denoise !== undefined ? denoise === true || denoise === 'true' : true,
        deskew: deskew !== undefined ? deskew === true || deskew === 'true' : false,
      }
    );

    ApiResponse.success(
      res,
      result,
      'Text extracted successfully from handwriting image'
    );
  });

  /**
   * Export formatted document as DOCX (.docx)
   */
  public exportDocx = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { title = 'Transcribed Document', content, filename = 'transcribed-document.docx' } = req.body;

    if (!content) {
      throw new BadRequestError('Document content (string or formatted sections) is required');
    }

    const docxBuffer = await ocrService.generateDocx(title, content);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', docxBuffer.length);
    res.send(docxBuffer);
  });

  /**
   * Export formatted document as PDF (.pdf)
   */
  public exportPdf = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { title = 'Transcribed Document', content, filename = 'transcribed-document.pdf' } = req.body;

    if (!content) {
      throw new BadRequestError('Document content (string or formatted sections) is required');
    }

    const pdfBuffer = await ocrService.generatePdf(title, content);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  });

  /**
   * Save OCR job to MongoDB
   */
  public saveJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id.toString();
    const job = await ocrService.saveOcrJob(tenantId, req.body);
    ApiResponse.created(res, job, 'OCR handwriting conversion job saved to customer history');
  });

  /**
   * List OCR jobs with tenant isolation
   */
  public listJobs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id.toString();
    const { search, status, page, limit } = req.query;

    const result = await ocrService.getOcrJobs(tenantId, {
      search: search as string,
      status: status as string,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    ApiResponse.success(res, result, 'OCR jobs retrieved');
  });

  /**
   * Reopen specific OCR job
   */
  public getJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id.toString();
    const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;

    const job = await ocrService.getOcrJobById(tenantId, jobId);
    if (!job) {
      throw new NotFoundError('OCR job not found or does not belong to this shop');
    }

    ApiResponse.success(res, job, 'OCR job retrieved');
  });

  /**
   * Update existing OCR job
   */
  public updateJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id.toString();
    const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;

    const updatedJob = await ocrService.updateOcrJob(tenantId, jobId, req.body);
    if (!updatedJob) {
      throw new NotFoundError('OCR job not found or does not belong to this shop');
    }

    ApiResponse.success(res, updatedJob, 'OCR job updated successfully');
  });
  /**
   * Save OCR correction workflow
   */
  public saveCorrection = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id.toString();
    const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
    const { editedText, formattedDoc, notes } = req.body;

    if (!editedText) {
      throw new BadRequestError('editedText is required for correction saving');
    }

    const correctedJob = await ocrService.saveCorrection(tenantId, jobId, {
      editedText,
      formattedDoc,
      notes,
    });

    ApiResponse.success(res, correctedJob, 'OCR correction saved and verified');
  });
}

export const ocrController = new OcrController();
