import { apiClient } from './client';
import { ApiResponse } from '../types';

// ─── Dashboard Types ───

export interface SuperAdminDashboard {
  shops: {
    total: number;
    active: number;
    trialing: number;
    expired: number;
    suspended: number;
  };
  revenue: {
    totalRevenue: number;
    monthlyRevenue: number;
    todayRevenue: number;
    currency: string;
  };
  payments: {
    total: number;
    success: number;
    failed: number;
    pending: number;
  };
  storage: {
    totalUsedBytes: number;
    totalLimitBytes: number;
    utilizationPercent: number;
  };
  planDistribution: { plan: string; count: number }[];
  providerDistribution: { provider: string; count: number; totalRevenue: number }[];
  revenueTrend: { year: number; month: number; revenue: number; transactions: number }[];
  recentActivities: any[];
  totalUsers: number;
  totalJobs: number;
}

// ─── Shop Types ───

export interface ShopRecord {
  _id: string;
  businessId: string;
  name: string;
  subdomain: string;
  email?: string;
  phone?: string;
  subscription: {
    plan: string;
    status: string;
    trialEndsAt: string;
    currentPeriodEnd?: string;
  };
  quotas: {
    maxStaffSeats: number;
    storageLimitBytes: number;
    storageUsedBytes: number;
  };
  isActive: boolean;
  createdAt: string;
}

export interface ShopDetails {
  shop: ShopRecord;
  owner: any;
  staffCount: number;
  jobCount: number;
  recentTransactions: any[];
  recentActivity: any[];
}

// ─── Settings Types ───

export interface PlatformSettingRecord {
  _id: string;
  key: string;
  category: string;
  value: any;
  label: string;
  description: string;
  type: string;
}

export const superAdminApi = {
  // Dashboard
  getDashboard: async () => {
    const res = await apiClient.get<ApiResponse<SuperAdminDashboard>>('/superadmin/dashboard');
    return res.data.data;
  },

  // Shop Management
  getShops: async (params?: Record<string, any>) => {
    const res = await apiClient.get<ApiResponse<{ shops: ShopRecord[]; total: number; page: number; limit: number }>>(
      '/superadmin/shops',
      { params }
    );
    return res.data.data;
  },

  getShopDetails: async (shopId: string) => {
    const res = await apiClient.get<ApiResponse<ShopDetails>>(`/superadmin/shops/${shopId}`);
    return res.data.data;
  },

  suspendShop: async (shopId: string, reason: string) => {
    const res = await apiClient.post<ApiResponse<ShopRecord>>(`/superadmin/shops/${shopId}/suspend`, { reason });
    return res.data.data;
  },

  activateShop: async (shopId: string) => {
    const res = await apiClient.post<ApiResponse<ShopRecord>>(`/superadmin/shops/${shopId}/activate`);
    return res.data.data;
  },

  updateShopSubscription: async (shopId: string, updates: Record<string, any>) => {
    const res = await apiClient.put<ApiResponse<ShopRecord>>(`/superadmin/shops/${shopId}/subscription`, updates);
    return res.data.data;
  },

  // Plan Management
  getPlans: async () => {
    const res = await apiClient.get<ApiResponse<any[]>>('/superadmin/plans');
    return res.data.data;
  },

  createPlan: async (data: Record<string, any>) => {
    const res = await apiClient.post<ApiResponse<any>>('/superadmin/plans', data);
    return res.data.data;
  },

  updatePlan: async (planKey: string, data: Record<string, any>) => {
    const res = await apiClient.put<ApiResponse<any>>(`/superadmin/plans/${planKey}`, data);
    return res.data.data;
  },

  archivePlan: async (planKey: string) => {
    const res = await apiClient.delete<ApiResponse<any>>(`/superadmin/plans/${planKey}`);
    return res.data.data;
  },

  // Payment Management
  getTransactions: async (params?: Record<string, any>) => {
    const res = await apiClient.get<ApiResponse<{ transactions: any[]; total: number; page: number; limit: number }>>(
      '/superadmin/transactions',
      { params }
    );
    return res.data.data;
  },

  getInvoices: async (params?: Record<string, any>) => {
    const res = await apiClient.get<ApiResponse<{ invoices: any[]; total: number; page: number; limit: number }>>(
      '/superadmin/invoices',
      { params }
    );
    return res.data.data;
  },

  getPaymentStats: async () => {
    const res = await apiClient.get<ApiResponse<any>>('/superadmin/payment-stats');
    return res.data.data;
  },

  // Platform Settings
  getSettings: async (category?: string) => {
    const res = await apiClient.get<ApiResponse<PlatformSettingRecord[]>>('/superadmin/settings', {
      params: category ? { category } : undefined,
    });
    return res.data.data;
  },

  updateSetting: async (key: string, value: any) => {
    const res = await apiClient.put<ApiResponse<PlatformSettingRecord>>(`/superadmin/settings/${key}`, { value });
    return res.data.data;
  },

  bulkUpdateSettings: async (updates: { key: string; value: any }[]) => {
    const res = await apiClient.post<ApiResponse<PlatformSettingRecord[]>>('/superadmin/settings/bulk', { updates });
    return res.data.data;
  },

  // Audit Logs
  getAuditLogs: async (params?: Record<string, any>) => {
    const res = await apiClient.get<ApiResponse<{ logs: any[]; total: number; page: number; limit: number }>>(
      '/superadmin/audit-logs',
      { params }
    );
    return res.data.data;
  },
};

