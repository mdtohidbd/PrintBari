import { apiClient } from './client';

export interface OnboardingStateResponse {
  state: {
    currentStep: number;
    currentStepName: string;
    completedSteps: number[];
    skippedSteps: number[];
    isCompleted: boolean;
    tourCompleted: boolean;
    stepData: {
      businessProfile?: {
        shopName: string;
        phone: string;
        address?: string;
        currency?: string;
        timezone?: string;
        taxId?: string;
      };
      logoUrl?: string;
      servicesConfigured?: string[];
      servicePricing?: Array<{
        serviceType: string;
        price: number;
        paperType?: string;
      }>;
      staffInvited?: Array<{
        email: string;
        fullName: string;
        role: string;
        invitedAt: string;
      }>;
      printSettings?: {
        defaultPaperSize: string;
        defaultDpi: number;
        printerModel?: string;
        marginOffsetXmm: number;
        marginOffsetYmm: number;
      };
      firstCustomerId?: string;
      firstJobId?: string;
    };
    checklist: {
      shopProfileCompleted: boolean;
      pricingConfigured: boolean;
      firstStaffInvited: boolean;
      firstCustomerCreated: boolean;
      firstJobCreated: boolean;
      firstJobCompleted: boolean;
      firstPrintExported: boolean;
    };
    hasSampleData: boolean;
    activationEvents: Array<{
      event: string;
      timestamp: string;
    }>;
  };
  progressPercent: number;
  tenantDetails: {
    id: string;
    name: string;
    subdomain: string;
    plan: string;
    maxStaffSeats: number;
  };
}

export const onboardingApi = {
  getState: async () => {
    const res = await apiClient.get<{ success: boolean; data: OnboardingStateResponse }>('/onboarding/state');
    return res.data.data;
  },

  saveStep: async (step: number, payload: Record<string, any>) => {
    const res = await apiClient.post<{ success: boolean; data: OnboardingStateResponse }>('/onboarding/step', {
      step,
      payload,
    });
    return res.data.data;
  },

  skipStep: async (step: number) => {
    const res = await apiClient.post<{ success: boolean; data: OnboardingStateResponse }>('/onboarding/skip', {
      step,
    });
    return res.data.data;
  },

  seedSampleWorkspace: async () => {
    const res = await apiClient.post<{ success: boolean; data: any }>('/onboarding/demo/seed');
    return res.data.data;
  },

  purgeSampleWorkspace: async () => {
    const res = await apiClient.post<{ success: boolean; data: any }>('/onboarding/demo/purge');
    return res.data.data;
  },

  importFromCSV: async (csvContent: string) => {
    const res = await apiClient.post<{
      success: boolean;
      data: {
        totalRows: number;
        importedCount: number;
        skippedCount: number;
        errors: Array<{ row: number; reason: string }>;
      };
    }>('/onboarding/import/csv', { csvContent });
    return res.data.data;
  },

  completeTour: async () => {
    const res = await apiClient.post<{ success: boolean; data: any }>('/onboarding/tour/complete');
    return res.data.data;
  },
};

