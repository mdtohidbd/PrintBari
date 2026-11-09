import { Request, Response } from 'express';
import { cvService } from './cv.service';
import { ApiResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { BadRequestError } from '../../errors';

export class CvController {
  // 1. Export CV Vector PDF
  public exportCvPdf = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { cvData, templateId = 'modern', theme = {}, filename = 'professional-cv.pdf' } = req.body;

    if (!cvData || !cvData.personalInfo) {
      throw new BadRequestError('cvData with personalInfo is required');
    }

    const pdfBuffer = await cvService.generateCvPdf(cvData, templateId, theme);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  });

  // 1b. Export CV Microsoft Word (.docx) Document
  public exportCvDocx = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { cvData, templateId = 'modern', theme = {}, filename = 'professional-cv.docx' } = req.body;

    if (!cvData || !cvData.personalInfo) {
      throw new BadRequestError('cvData with personalInfo is required');
    }

    const docxBuffer = await cvService.generateCvDocx(cvData, templateId, theme);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', docxBuffer.length);
    res.send(docxBuffer);
  });

  // 2. Save CV Job to MongoDB
  public saveCvJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const job = await cvService.saveCvJob(tenantId, req.body);
    ApiResponse.created(res, job, 'CV job saved to shop queue');
  });

  // 3. List Saved CV Jobs
  public listCvJobs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const jobs = await cvService.listCvJobs(tenantId);
    ApiResponse.success(res, jobs, 'Saved CV jobs retrieved');
  });

  // 4. Get Specific CV Job
  public getCvJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
    const job = await cvService.getCvJobById(tenantId, jobId);
    ApiResponse.success(res, job, 'CV job details retrieved');
  });

  // 5. List Ready-Made Document Templates
  public listTemplates = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const { category } = req.query;
    await cvService.ensureSystemTemplates();
    const templates = await cvService.listTemplates(tenantId, category as any);
    ApiResponse.success(res, templates, 'Document templates retrieved');
  });

  // 6. Get Specific Template
  public getTemplate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const templateId = Array.isArray(req.params.templateId) ? req.params.templateId[0] : req.params.templateId;
    const template = await cvService.getTemplateById(templateId);
    ApiResponse.success(res, template, 'Document template retrieved');
  });

  // 7. Render Template Text with Dynamic Field Values
  public renderDocument = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { contentTemplate, values } = req.body;
    if (!contentTemplate) {
      throw new BadRequestError('contentTemplate is required');
    }
    const rendered = cvService.renderTemplate(contentTemplate, values || {});
    ApiResponse.success(res, { renderedContent: rendered }, 'Document rendered successfully');
  });

  // 8. Export Ready-Made Document to Vector PDF
  public exportDocPdf = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { renderedContent, title = 'Official Document', filename = 'official-document.pdf' } = req.body;

    if (!renderedContent) {
      throw new BadRequestError('renderedContent text is required');
    }

    const pdfBuffer = await cvService.generateReadyDocPdf(renderedContent, title);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  });

  // 9. Save Ready-Made Document Job to MongoDB
  public saveReadyDocJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const job = await cvService.saveReadyDocumentJob(tenantId, req.body);
    ApiResponse.created(res, job, 'Ready-made document job saved to shop queue');
  });

  // 10. List Saved Ready Document Jobs
  public listReadyDocJobs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const jobs = await cvService.listReadyDocJobs(tenantId);
    ApiResponse.success(res, jobs, 'Saved document records retrieved');
  });

  // 11. List Configurable CV Templates
  public listCvTemplates = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const category = req.query.category as string | undefined;
    const templates = await cvService.listCvTemplates(category);
    ApiResponse.success(res, templates, 'CV templates retrieved');
  });
}

export const cvController = new CvController();

