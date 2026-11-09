import { apiClient } from './client';
import { ApiResponse } from '../types';

export type FilterMode = 'ORIGINAL' | 'MAGIC_COLOR' | 'GRAYSCALE' | 'BW_PHOTOCOPY' | 'SHADOW_CLEAN';

export interface ProcessPagePayload {
  imageBase64: string;
  filterMode?: FilterMode;
  rotation?: number;
  brightness?: number;
  contrast?: number;
  threshold?: number;
  cropBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ComposeA4Payload {
  imageBase64: string;
  pageSize?: 'A4' | 'LEGAL' | 'LETTER';
  orientation?: 'PORTRAIT' | 'LANDSCAPE';
  marginMm?: number;
  fitMode?: 'FIT_PAGE' | 'FILL_PAGE' | 'ORIGINAL_SCALE';
}

export interface ExportPdfPayload {
  pagesBase64: string[];
  pageSize?: 'A4' | 'LEGAL' | 'LETTER';
  orientation?: 'PORTRAIT' | 'LANDSCAPE';
  marginMm?: number;
  filename?: string;
}

export interface SaveDocumentJobPayload {
  customerName?: string;
  customerPhone?: string;
  title?: string;
  pages: Array<{
    pageNumber: number;
    originalImageUrl?: string;
    processedImageUrl?: string;
    filterMode: FilterMode;
    adjustments: {
      brightness: number;
      contrast: number;
      rotation: number;
      threshold?: number;
    };
  }>;
  pageSettings: {
    pageSize: 'A4' | 'LEGAL' | 'LETTER';
    orientation: 'PORTRAIT' | 'LANDSCAPE';
    marginMm: number;
    fitMode: 'FIT_PAGE' | 'FILL_PAGE' | 'ORIGINAL_SCALE';
  };
  copies?: number;
  totalAmount?: number;
  notes?: string;
}

export const documentApi = {
  processPage: async (payload: ProcessPagePayload): Promise<ApiResponse<{
    base64: string;
    width: number;
    height: number;
    dpi: number;
  }>> => {
    return (apiClient.post('/document/process-page', payload) as unknown) as Promise<ApiResponse<any>>;
  },

  composeA4: async (payload: ComposeA4Payload): Promise<ApiResponse<{
    base64: string;
    pageWidth: number;
    pageHeight: number;
    dpi: number;
  }>> => {
    return (apiClient.post('/document/compose-a4', payload) as unknown) as Promise<ApiResponse<any>>;
  },

  exportPdf: async (payload: ExportPdfPayload): Promise<Blob> => {
    const response = await apiClient.post('/document/export-pdf', payload, {
      responseType: 'blob',
    });
    return response.data;
  },

  saveJob: async (payload: SaveDocumentJobPayload): Promise<ApiResponse<any>> => {
    return (apiClient.post('/document/jobs', payload) as unknown) as Promise<ApiResponse<any>>;
  },

  listJobs: async (): Promise<ApiResponse<any[]>> => {
    return (apiClient.get('/document/jobs') as unknown) as Promise<ApiResponse<any[]>>;
  },

  getJob: async (jobId: string): Promise<ApiResponse<any>> => {
    return (apiClient.get(`/document/jobs/${jobId}`) as unknown) as Promise<ApiResponse<any>>;
  },
};

