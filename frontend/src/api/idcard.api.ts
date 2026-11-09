import { apiClient } from './client';
import { ApiResponse } from '../types';

export type IdCardType =
  | 'SMART_NID'
  | 'OLD_NID'
  | 'DRIVING_LICENSE'
  | 'STUDENT_ID'
  | 'CUSTOM';

export type CardArrangement = 'SIDE_BY_SIDE' | 'STACKED' | 'GRID';

export interface IdCardPreset {
  id: IdCardType;
  name: string;
  nameBn: string;
  widthMm: number;
  heightMm: number;
  widthPx: number;
  heightPx: number;
  description: string;
}

export interface ProcessCardSidePayload {
  imageBase64: string;
  widthMm?: number;
  heightMm?: number;
  rotation?: number;
  brightness?: number;
  contrast?: number;
  filterMode?: 'ORIGINAL' | 'MAGIC_COLOR' | 'BW_PHOTOCOPY' | 'GRAYSCALE';
  threshold?: number;
  cropBounds?: { x: number; y: number; width: number; height: number };
}

export interface ComposeIdCardA4Payload {
  frontImageBase64: string;
  backImageBase64?: string;
  cardType?: IdCardType;
  widthMm?: number;
  heightMm?: number;
  arrangement?: CardArrangement;
  copies?: number;
  orientation?: 'PORTRAIT' | 'LANDSCAPE';
  marginMm?: number;
  gapMm?: number;
  showCutMarks?: boolean;
}

export interface SaveIdCardJobPayload {
  customerName?: string;
  customerPhone?: string;
  cardType: IdCardType;
  cardTitle?: string;
  cardDimensionsMm?: { width: number; height: number };
  frontImage?: any;
  backImage?: any;
  layoutSettings: {
    arrangement: CardArrangement;
    copies: number;
    orientation: 'PORTRAIT' | 'LANDSCAPE';
    marginMm: number;
    gapMm: number;
    showCutMarks: boolean;
  };
  sheetImageUrl?: string;
  copies?: number;
  totalAmount?: number;
  notes?: string;
}

export const idCardApi = {
  getPresets: async (): Promise<ApiResponse<IdCardPreset[]>> => {
    return (apiClient.get('/idcard/presets') as unknown) as Promise<ApiResponse<IdCardPreset[]>>;
  },

  processSide: async (payload: ProcessCardSidePayload): Promise<ApiResponse<{
    base64: string;
    width: number;
    height: number;
    dpi: number;
  }>> => {
    return (apiClient.post('/idcard/process-side', payload) as unknown) as Promise<ApiResponse<any>>;
  },

  composeSheet: async (payload: ComposeIdCardA4Payload): Promise<ApiResponse<{
    base64: string;
    sheetWidth: number;
    sheetHeight: number;
    copies: number;
    dpi: number;
  }>> => {
    return (apiClient.post('/idcard/compose-sheet', payload) as unknown) as Promise<ApiResponse<any>>;
  },

  exportPdf: async (payload: { sheetBase64: string; orientation?: string; filename?: string }): Promise<Blob> => {
    const response = await apiClient.post('/idcard/export-pdf', payload, {
      responseType: 'blob',
    });
    return response.data;
  },

  saveJob: async (payload: SaveIdCardJobPayload): Promise<ApiResponse<any>> => {
    return (apiClient.post('/idcard/jobs', payload) as unknown) as Promise<ApiResponse<any>>;
  },

  listJobs: async (): Promise<ApiResponse<any[]>> => {
    return (apiClient.get('/idcard/jobs') as unknown) as Promise<ApiResponse<any[]>>;
  },

  getJob: async (jobId: string): Promise<ApiResponse<any>> => {
    return (apiClient.get(`/idcard/jobs/${jobId}`) as unknown) as Promise<ApiResponse<any>>;
  },
};

