import { apiClient } from './client';
import { ApiResponse } from '../types';

export const tenantApi = {
  getCurrentShop: async (): Promise<ApiResponse<any>> => {
    return (apiClient.get('/tenants/current') as unknown) as Promise<ApiResponse<any>>;
  },

  updateProfile: async (data: any): Promise<ApiResponse<any>> => {
    return (apiClient.put('/tenants/profile', data) as unknown) as Promise<ApiResponse<any>>;
  },

  updateWorkingHours: async (workingHours: any): Promise<ApiResponse<any>> => {
    return (apiClient.put('/tenants/working-hours', { workingHours }) as unknown) as Promise<ApiResponse<any>>;
  },

  updateInvoiceSettings: async (settings: any): Promise<ApiResponse<any>> => {
    return (apiClient.put('/tenants/invoice-settings', settings) as unknown) as Promise<ApiResponse<any>>;
  },

  updatePrintSettings: async (settings: any): Promise<ApiResponse<any>> => {
    return (apiClient.put('/tenants/print-settings', settings) as unknown) as Promise<ApiResponse<any>>;
  },

  listStaff: async (params?: { search?: string; role?: string; status?: string }): Promise<ApiResponse<any[]>> => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.role) query.append('role', params.role);
    if (params?.status) query.append('status', params.status);

    return (apiClient.get(`/tenants/staff?${query.toString()}`) as unknown) as Promise<ApiResponse<any[]>>;
  },

  addStaff: async (data: any): Promise<ApiResponse<any>> => {
    return (apiClient.post('/tenants/staff', data) as unknown) as Promise<ApiResponse<any>>;
  },

  editStaff: async (staffId: string, data: any): Promise<ApiResponse<any>> => {
    return (apiClient.put(`/tenants/staff/${staffId}`, data) as unknown) as Promise<ApiResponse<any>>;
  },

  toggleStaffStatus: async (staffId: string): Promise<ApiResponse<any>> => {
    return (apiClient.patch(`/tenants/staff/${staffId}/toggle-status`, {}) as unknown) as Promise<ApiResponse<any>>;
  },

  getStaffActivity: async (staffId: string): Promise<ApiResponse<any[]>> => {
    return (apiClient.get(`/tenants/staff/${staffId}/activity`) as unknown) as Promise<ApiResponse<any[]>>;
  },
};

