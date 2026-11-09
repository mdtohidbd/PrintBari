import { apiClient } from './client';
import { ApiResponse } from '../types';

export type PaperSize = 'A4' | '4x6' | 'LEGAL' | 'LETTER' | 'A3' | 'CUSTOM';
export type Orientation = 'PORTRAIT' | 'LANDSCAPE';
export type ColorMode = 'COLOR' | 'GRAYSCALE' | 'BLACK_WHITE';
export type PrintQuality = 'DRAFT' | 'NORMAL' | 'HIGH' | 'PHOTO_FINE';
export type PrintStatus = 'QUEUED' | 'SENDING' | 'PRINTING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface PrinterDeviceRecord {
  _id: string;
  name: string;
  printerModel: string;
  type: 'PHOTO' | 'DOCUMENT_COLOR' | 'MONO_LASER' | 'PLOTTER' | 'RECEIPT';
  connectionType: 'BROWSER_DIALOG' | 'LOCAL_AGENT' | 'NETWORK_RAW';
  agentEndpoint?: string;
  isOnline: boolean;
  supportedPaperSizes: PaperSize[];
  colorCapable: boolean;
  defaultCopies: number;
  currentInkLevels: {
    black: number;
    cyan: number;
    magenta: number;
    yellow: number;
    lightCyan?: number;
    lightMagenta?: number;
  };
  isDefault: boolean;
}

export interface PrintSettings {
  copies: number;
  paperSize: PaperSize;
  orientation: Orientation;
  colorMode: ColorMode;
  quality: PrintQuality;
  duplex?: 'NONE' | 'LONG_EDGE' | 'SHORT_EDGE';
}

export interface PrintJobRecord {
  _id: string;
  tenantId: string;
  printJobCode: string;
  jobId?: string;
  jobCode: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  printerId?: any;
  printerName: string;
  serviceType: string;
  queuePosition: number;
  documentUrl: string;
  documentTitle: string;
  settings: PrintSettings;
  status: PrintStatus;
  printedCopies: number;
  staffName: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const printerApi = {
  // List printers
  listPrinters: async () => {
    const res = await apiClient.get<ApiResponse<PrinterDeviceRecord[]>>('/printers');
    return res.data.data;
  },

  // Get active queue
  getQueue: async () => {
    const res = await apiClient.get<ApiResponse<PrintJobRecord[]>>('/printers/queue');
    return res.data.data;
  },

  // Enqueue job
  enqueueJob: async (payload: {
    jobId?: string;
    jobCode?: string;
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
    printerId?: string;
    serviceType?: string;
    documentUrl: string;
    documentTitle?: string;
    settings?: Partial<PrintSettings>;
    allowDuplicate?: boolean;
  }) => {
    const res = await apiClient.post<ApiResponse<PrintJobRecord>>('/printers/queue', payload);
    return res.data.data;
  },

  // Reorder queue
  reorderQueue: async (orderedIds: string[]) => {
    const res = await apiClient.put<ApiResponse<PrintJobRecord[]>>('/printers/queue/reorder', { orderedIds });
    return res.data.data;
  },

  // Update settings in queue
  updateSettings: async (id: string, updates: Partial<PrintSettings> & { printerId?: string }) => {
    const res = await apiClient.patch<ApiResponse<PrintJobRecord>>(`/printers/queue/${id}`, updates);
    return res.data.data;
  },

  // Cancel / remove from queue
  removeJob: async (id: string) => {
    const res = await apiClient.delete<ApiResponse<null>>(`/printers/queue/${id}`);
    return res.data.data;
  },

  // Mark print started
  startPrint: async (id: string) => {
    const res = await apiClient.post<ApiResponse<PrintJobRecord>>(`/printers/queue/${id}/start`);
    return res.data.data;
  },

  // Mark print completed
  completePrint: async (id: string, printedCopies?: number) => {
    const res = await apiClient.post<ApiResponse<PrintJobRecord>>(`/printers/queue/${id}/complete`, { printedCopies });
    return res.data.data;
  },

  // Get print history
  getHistory: async (params?: { search?: string; status?: string; printerId?: string; page?: number; limit?: number }) => {
    const res = await apiClient.get<ApiResponse<{ history: PrintJobRecord[]; total: number; page: number; totalPages: number }>>('/printers/history', {
      params,
    });
    return res.data.data;
  },

  // Download Print-Ready PDF
  exportPdf: async (payload: { title?: string; paperSize?: PaperSize; orientation?: Orientation; imageBase64?: string }) => {
    const res = await apiClient.post('/printers/export-pdf', payload, {
      responseType: 'blob',
    });
    return res.data as Blob;
  },
};

