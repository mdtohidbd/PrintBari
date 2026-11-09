import { apiClient } from './client';
import { ApiResponse } from '../types';

export interface PassportPreset {
  id: string;
  name: string;
  country: string;
  widthMm: number;
  heightMm: number;
  widthPx: number;
  heightPx: number;
  bgColor: string;
  description: string;
}

export interface ProcessPhotoPayload {
  imageBase64: string;
  presetId: string;
  rotation?: number;
  cropBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  brightness?: number;
  contrast?: number;
  backgroundColor?: string;
}

export interface GenerateSheetPayload {
  imageBase64: string;
  presetId: string;
  sheetLayout: '4x6' | 'A4';
  copies: number;
}

export interface SavePassportJobPayload {
  customerName?: string;
  customerPhone?: string;
  presetId: string;
  copies: number;
  sheetLayout: '4x6' | 'A4';
  originalImageBase64?: string;
  processedImageBase64?: string;
  sheetImageBase64?: string;
  notes?: string;
  unitPrice?: number;
}

export const passportApi = {
  getPresets: async (): Promise<ApiResponse<PassportPreset[]>> => {
    return (apiClient.get('/passport/presets') as unknown) as Promise<ApiResponse<PassportPreset[]>>;
  },

  processPhoto: async (payload: ProcessPhotoPayload): Promise<ApiResponse<{
    base64: string;
    preset: PassportPreset;
    widthPx: number;
    heightPx: number;
    dpi: number;
  }>> => {
    return (apiClient.post('/passport/process', payload) as unknown) as Promise<ApiResponse<any>>;
  },

  generateSheet: async (payload: GenerateSheetPayload): Promise<ApiResponse<{
    sheetBase64: string;
    sheetLayout: string;
    sheetWidth: number;
    sheetHeight: number;
    copies: number;
    dpi: number;
  }>> => {
    return (apiClient.post('/passport/sheet', payload) as unknown) as Promise<ApiResponse<any>>;
  },

  exportPdf: async (payload: { sheetBase64: string; sheetLayout: string; filename?: string }): Promise<Blob> => {
    const response = await apiClient.post('/passport/export-pdf', payload, {
      responseType: 'blob',
    });
    return response.data;
  },

  saveJob: async (payload: SavePassportJobPayload): Promise<ApiResponse<any>> => {
    return (apiClient.post('/passport/jobs', payload) as unknown) as Promise<ApiResponse<any>>;
  },

  listJobs: async (): Promise<ApiResponse<any[]>> => {
    return (apiClient.get('/passport/jobs') as unknown) as Promise<ApiResponse<any[]>>;
  },

  getJob: async (jobId: string): Promise<ApiResponse<any>> => {
    return (apiClient.get(`/passport/jobs/${jobId}`) as unknown) as Promise<ApiResponse<any>>;
  },
};

