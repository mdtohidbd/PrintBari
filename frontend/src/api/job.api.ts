import { apiClient } from './client';
import { ApiResponse } from '../types';

export type JobStatus =
  | 'DRAFT'
  | 'NEW'
  | 'PENDING'
  | 'PROCESSING'
  | 'READY_FOR_REVIEW'
  | 'REVIEW'
  | 'APPROVED'
  | 'QUEUED'
  | 'PRINTING'
  | 'PRINT_READY'
  | 'COMPLETED'
  | 'CANCELLED';

export type JobServiceType =
  | 'PASSPORT_PHOTO'
  | 'ID_CARD_A4'
  | 'DOCUMENT_A4'
  | 'CV_BUILDER'
  | 'CV_RESUME'
  | 'HANDWRITING_OCR'
  | 'PHOTOCOPY_PRINT'
  | 'CUSTOM_PRINT'
  | 'LAMINATION'
  | 'SCANNING'
  | 'PHOTOCOPY';

export interface JobFile {
  fileId: string;
  name: string;
  url: string;
  size?: number;
  mimeType?: string;
  version: number;
  uploadedAt: string;
}

export interface JobActivity {
  activityId: string;
  action: string;
  oldStatus?: string;
  newStatus?: string;
  changedById?: string;
  changedByName: string;
  role?: string;
  note?: string;
  timestamp: string;
}

export interface JobRecord {
  _id: string;
  tenantId: string;
  jobCode: string;
  customerId?: any;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  serviceType: JobServiceType;
  status: JobStatus;
  priority: 'NORMAL' | 'URGENT';
  assignedTo?: any;
  copies: number;
  paperType: string;
  price: {
    subtotal: number;
    discount: number;
    tax: number;
    totalPrice: number;
  };
  totalAmount: number;
  paidAmount: number;
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' | 'REFUNDED';
  paymentMethod: string;
  uploadedFiles: JobFile[];
  processedFiles: JobFile[];
  activityLogs: JobActivity[];
  notes?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const jobApi = {
  listJobs: async (params?: {
    status?: string;
    serviceType?: string;
    assignedTo?: string;
    paymentStatus?: string;
    priority?: string;
    customerId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const res = await apiClient.get<ApiResponse<{ jobs: JobRecord[]; pagination: any }>>('/jobs', {
      params,
    });
    return res.data.data;
  },

  getJob: async (jobId: string) => {
    const res = await apiClient.get<ApiResponse<JobRecord>>(`/jobs/${jobId}`);
    return res.data.data;
  },

  createJob: async (data: Partial<JobRecord>) => {
    const res = await apiClient.post<ApiResponse<JobRecord>>('/jobs', data);
    return res.data.data;
  },

  updateJob: async (jobId: string, data: Partial<JobRecord>) => {
    const res = await apiClient.put<ApiResponse<JobRecord>>(`/jobs/${jobId}`, data);
    return res.data.data;
  },

  updateStatus: async (jobId: string, status: string, note?: string) => {
    const res = await apiClient.patch<ApiResponse<JobRecord>>(`/jobs/${jobId}/status`, { status, note });
    return res.data.data;
  },

  duplicateJob: async (jobId: string) => {
    const res = await apiClient.post<ApiResponse<JobRecord>>(`/jobs/${jobId}/duplicate`);
    return res.data.data;
  },

  assignStaff: async (jobId: string, staffId: string | null) => {
    const res = await apiClient.patch<ApiResponse<JobRecord>>(`/jobs/${jobId}/assign`, { staffId });
    return res.data.data;
  },

  addJobFile: async (
    jobId: string,
    fileData: { name: string; url: string; size?: number; mimeType?: string; type?: 'UPLOADED' | 'PROCESSED' }
  ) => {
    const res = await apiClient.post<ApiResponse<JobFile>>(`/jobs/${jobId}/files`, fileData);
    return res.data.data;
  },
};
