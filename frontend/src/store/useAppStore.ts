import { create } from 'zustand';
import { TenantContext, UserRole } from '../types';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  phone?: string;
}

interface AppState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  currentTenant: TenantContext | null;
  setCurrentTenant: (tenant: TenantContext | null) => void;
  currentUser: UserProfile | null;
  setCurrentUser: (user: UserProfile | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
  currentTenant: {
    id: localStorage.getItem('tenant_id') || 'metro-studio',
    name: 'Metro Digital Photo Studio',
    subdomain: localStorage.getItem('tenant_id') || 'metro-studio',
    currency: 'BDT',
    plan: 'PROFESSIONAL',
  },
  setCurrentTenant: (tenant) => set({ currentTenant: tenant }),
  currentUser: {
    id: 'user-001',
    fullName: 'Shop Owner',
    email: 'owner@docustudio.io',
    role: 'OWNER',
  },
  setCurrentUser: (user) => set({ currentUser: user }),
}));
