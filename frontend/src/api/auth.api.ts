import { apiClient } from './client';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthTenant {
  id: string;
  businessId: string;
  name: string;
  subdomain: string;
  plan: string;
  trialEndsAt?: string;
  subscriptionStatus?: string;
}

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: 'SUPER_ADMIN' | 'OWNER' | 'MANAGER' | 'STAFF' | 'OPERATOR' | 'REVIEWER' | 'PRINTER';
  phone?: string;
}

export interface AuthResponseData {
  tenant: AuthTenant;
  user: AuthUser;
  tokens: AuthTokens;
}

export interface LoginPayload {
  email: string;
  password: string;
  subdomain?: string;
}

export interface RegisterShopPayload {
  shopName: string;
  subdomain: string;
  ownerName: string;
  email: string;
  phone?: string;
  password: string;
  plan?: string;
}

export const authApi = {
  login: async (payload: LoginPayload): Promise<AuthResponseData> => {
    const res: any = await apiClient.post('/auth/login', payload);
    return res.data;
  },

  registerShop: async (payload: RegisterShopPayload): Promise<AuthResponseData> => {
    const res: any = await apiClient.post('/auth/register-shop', payload);
    return res.data;
  },

  getMe: async (): Promise<{ user: AuthUser; tenant: AuthTenant }> => {
    const res: any = await apiClient.get('/auth/me');
    return res.data;
  },

  refreshToken: async (refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> => {
    const res: any = await apiClient.post('/auth/refresh', { refreshToken });
    return res.data;
  },

  logout: async (refreshToken?: string): Promise<void> => {
    try {
      if (refreshToken) {
        await apiClient.post('/auth/logout', { refreshToken });
      }
    } catch {
      // Graceful local signout even if server error
    }
  },
};

