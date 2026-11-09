import { apiClient } from './client';
import { ApiResponse, SystemHealthData } from '../types';

export const healthApi = {
  getHealth: async (): Promise<ApiResponse<SystemHealthData>> => {
    return (apiClient.get('/health') as unknown) as Promise<ApiResponse<SystemHealthData>>;
  },
};

