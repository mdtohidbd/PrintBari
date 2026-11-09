export interface ApiResponse<T = any> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  meta?: Record<string, any>;
  timestamp: string;
}

export interface SystemHealthData {
  status: 'UP' | 'DEGRADED' | 'DOWN';
  environment: string;
  timestamp: string;
  uptimeSeconds: number;
  database: {
    type: string;
    connected: boolean;
    readyState: number;
  };
  system: {
    platform: string;
    nodeVersion: string;
    freeMemoryMB: number;
    totalMemoryMB: number;
    processHeapUsedMB: number;
  };
}

export type UserRole =
  | 'SUPER_ADMIN'
  | 'OWNER'
  | 'MANAGER'
  | 'STAFF'
  | 'OPERATOR'
  | 'REVIEWER'
  | 'PRINTER'
  | 'SHOP_OWNER'
  | 'SHOP_MANAGER'
  | 'SHOP_STAFF';

export interface TenantContext {
  id: string;
  name: string;
  subdomain: string;
  currency: string;
  plan: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
}

