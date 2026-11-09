import { apiClient } from './client';
import { ApiResponse } from '../types';

export interface DashboardMetricsResponse {
  metrics: {
    totalJobs: number;
    pendingJobs: number;
    completedJobs: number;
    todayOrders: number;
    totalCustomers: number;
    monthlyRevenue: number | null;
    todayRevenue: number | null;
    canViewFinancials: boolean;
  };
  storage: {
    usedBytes: number;
    limitBytes: number;
    usedMB: string;
    limitGB: string;
    percentUsed: number;
  };
  statusDistribution: {
    PENDING: number;
    PROCESSING: number;
    REVIEW: number;
    PRINT_READY: number;
    COMPLETED: number;
    CANCELLED: number;
  };
  recentJobs: any[];
  recentActivities: any[];
  shop: {
    name: string;
    businessId: string;
    currency: string;
    plan: string;
    status: string;
  };
}

export const dashboardApi = {
  getMetrics: async (): Promise<ApiResponse<DashboardMetricsResponse>> => {
    return (apiClient.get('/dashboard/metrics') as unknown) as Promise<ApiResponse<DashboardMetricsResponse>>;
  },
  seedDemoData: async (): Promise<ApiResponse<{ message: string }>> => {
    return (apiClient.post('/dashboard/seed-demo', {}) as unknown) as Promise<ApiResponse<{ message: string }>>;
  },
};

