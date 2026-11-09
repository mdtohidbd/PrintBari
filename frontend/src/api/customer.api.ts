import { apiClient } from './client';
import { ApiResponse } from '../types';

export interface CustomerFile {
  fileId: string;
  name: string;
  url: string;
  size?: number;
  mimeType?: string;
  sourceJobCode?: string;
  addedAt: string;
}

export interface CustomerRecord {
  _id: string;
  tenantId: string;
  fullName: string;
  phone: string;
  email?: string;
  address?: string;
  totalOrdersCount: number;
  totalSpent: number;
  lastVisitAt: string;
  notes?: string;
  fileLibrary: CustomerFile[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDetailRecord extends CustomerRecord {
  recentJobs: any[];
}

export const customerApi = {
  listCustomers: async (params?: { search?: string; page?: number; limit?: number; activeOnly?: boolean }) => {
    const res = await apiClient.get<ApiResponse<{ customers: CustomerRecord[]; pagination: any }>>('/customers', {
      params,
    });
    return res.data.data;
  },

  createCustomer: async (data: {
    fullName: string;
    phone: string;
    email?: string;
    address?: string;
    notes?: string;
  }) => {
    const res = await apiClient.post<ApiResponse<CustomerRecord>>('/customers', data);
    return res.data.data;
  },

  getCustomer: async (id: string) => {
    const res = await apiClient.get<ApiResponse<CustomerDetailRecord>>(`/customers/${id}`);
    return res.data.data;
  },

  updateCustomer: async (
    id: string,
    data: {
      fullName?: string;
      phone?: string;
      email?: string;
      address?: string;
      notes?: string;
      isActive?: boolean;
    }
  ) => {
    const res = await apiClient.put<ApiResponse<CustomerRecord>>(`/customers/${id}`, data);
    return res.data.data;
  },

  deleteCustomer: async (id: string) => {
    const res = await apiClient.delete<ApiResponse<null>>(`/customers/${id}`);
    return res.data.data;
  },

  getCustomerJobs: async (id: string, params?: { page?: number; limit?: number }) => {
    const res = await apiClient.get<ApiResponse<{ jobs: any[]; pagination: any }>>(`/customers/${id}/jobs`, {
      params,
    });
    return res.data.data;
  },

  getCustomerFiles: async (id: string) => {
    const res = await apiClient.get<ApiResponse<CustomerFile[]>>(`/customers/${id}/files`);
    return res.data.data;
  },

  addCustomerFile: async (id: string, data: { name: string; url: string; size?: number; mimeType?: string; sourceJobCode?: string }) => {
    const res = await apiClient.post<ApiResponse<CustomerFile>>(`/customers/${id}/files`, data);
    return res.data.data;
  },

  deleteCustomerFile: async (id: string, fileId: string) => {
    const res = await apiClient.delete<ApiResponse<null>>(`/customers/${id}/files/${fileId}`);
    return res.data.data;
  },
};

