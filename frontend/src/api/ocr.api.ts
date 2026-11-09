import { apiClient } from './client';
import { ApiResponse } from '../types';

export interface TextBlock {
  id: string;
  text: string;
  confidence: number;
  bbox?: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

export interface FormattedDocSection {
  type: 'title' | 'heading1' | 'heading2' | 'paragraph' | 'bullet' | 'numbered';
  text: string;
  bold?: boolean;
  italic?: boolean;
  alignment?: 'left' | 'center' | 'right' | 'justify';
}

export interface PreprocessingOptions {
  grayscale?: boolean;
  contrast?: number;
  binarize?: boolean;
  denoise?: boolean;
  deskew?: boolean;
}

export interface ExtractTextPayload {
  imageBase64: string;
  language?: 'eng' | 'ben' | 'both';
  engine?: 'tesseract' | 'cloud' | 'simulation';
  grayscale?: boolean;
  contrast?: number;
  binarize?: boolean;
  denoise?: boolean;
  deskew?: boolean;
}

export interface ExtractTextResult {
  engine: 'tesseract' | 'cloud' | 'simulation';
  language: 'eng' | 'ben' | 'both';
  overallConfidence: number;
  rawExtractedText: string;
  textBlocks: TextBlock[];
  preprocessedBase64: string;
}

export interface SaveOcrJobPayload {
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  language?: 'eng' | 'ben' | 'both';
  engine?: 'tesseract' | 'cloud' | 'simulation';
  originalImage: string;
  preprocessedImage?: string;
  preprocessingOptions?: PreprocessingOptions;
  overallConfidence: number;
  textBlocks: TextBlock[];
  rawExtractedText: string;
  editedText: string;
  formattedDoc?: FormattedDocSection[];
  notes?: string;
}

export interface OcrJobRecord {
  _id: string;
  tenantId: string;
  jobCode: string;
  customerName: string;
  customerPhone: string;
  language: 'eng' | 'ben' | 'both';
  engine: string;
  originalImage: string;
  preprocessedImage?: string;
  overallConfidence: number;
  textBlocks: TextBlock[];
  rawExtractedText: string;
  editedText: string;
  formattedDoc: FormattedDocSection[];
  status: string;
  createdAt: string;
}

export const ocrApi = {
  // Preprocess handwriting image
  preprocess: async (payload: { imageBase64: string } & PreprocessingOptions) => {
    const res = await apiClient.post<ApiResponse<{ preprocessedBase64: string }>>('/ocr/preprocess', payload);
    return res.data.data;
  },

  // Perform OCR extraction
  extract: async (payload: ExtractTextPayload) => {
    const res = await apiClient.post<ApiResponse<ExtractTextResult>>('/ocr/extract', payload);
    return res.data.data;
  },

  // Export DOCX (.docx)
  exportDocx: async (payload: { title: string; content: string | FormattedDocSection[]; filename?: string }) => {
    const res = await apiClient.post('/ocr/export-docx', payload, {
      responseType: 'blob',
    });
    return res.data as Blob;
  },

  // Export PDF (.pdf)
  exportPdf: async (payload: { title: string; content: string | FormattedDocSection[]; filename?: string }) => {
    const res = await apiClient.post('/ocr/export-pdf', payload, {
      responseType: 'blob',
    });
    return res.data as Blob;
  },

  // Save OCR Job
  saveJob: async (payload: SaveOcrJobPayload) => {
    const res = await apiClient.post<ApiResponse<OcrJobRecord>>('/ocr/jobs', payload);
    return res.data.data;
  },

  // List OCR Jobs
  listJobs: async (params?: { search?: string; status?: string; page?: number; limit?: number }) => {
    const res = await apiClient.get<ApiResponse<{ jobs: OcrJobRecord[]; total: number; page: number; totalPages: number }>>('/ocr/jobs', {
      params,
    });
    return res.data.data;
  },

  // Get specific OCR Job
  getJob: async (jobId: string) => {
    const res = await apiClient.get<ApiResponse<OcrJobRecord>>(`/ocr/jobs/${jobId}`);
    return res.data.data;
  },

  // Update OCR Job
  updateJob: async (jobId: string, updates: Partial<SaveOcrJobPayload>) => {
    const res = await apiClient.put<ApiResponse<OcrJobRecord>>(`/ocr/jobs/${jobId}`, updates);
    return res.data.data;
  },
};

