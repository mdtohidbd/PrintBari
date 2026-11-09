import { apiClient } from './client';
import { ApiResponse } from '../types';

export interface PlanConfigRecord {
  _id: string;
  planKey: 'STARTER' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
  displayName: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  storageLimitMB: number;
  staffLimit: number;
  monthlyJobLimit: number;
  enabledModules: string[];
  backupAvailability: 'NONE' | 'MANUAL' | 'WEEKLY' | 'DAILY';
  featureRestrictions: {
    watermark: boolean;
    highDpiExport: boolean;
    multiPrinterSpool: boolean;
    customBranding: boolean;
    apiAccess: boolean;
  };
  isPopular: boolean;
  isActive: boolean;
}

export interface PaymentTransactionRecord {
  _id: string;
  transactionCode: string;
  planKey: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
  amount: number;
  currency: string;
  provider: 'BKASH' | 'NAGAD' | 'SSLCOMMERZ' | 'MANUAL';
  providerTransactionId?: string;
  paymentStatus: 'INITIATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  invoiceNumber: string;
  paidAt?: string;
  createdAt: string;
}

export interface SubscriptionInvoiceRecord {
  _id: string;
  invoiceNumber: string;
  shopName: string;
  planName: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
  amount: number;
  vat: number;
  totalAmount: number;
  paymentMethod: string;
  transactionCode: string;
  periodStart: string;
  periodEnd: string;
  status: 'PAID' | 'VOID' | 'UNPAID';
  issuedAt: string;
}

export interface MySubscriptionStatus {
  tenant: any;
  currentPlan: PlanConfigRecord | null;
  isTrialing: boolean;
  isExpired: boolean;
  trialDaysRemaining: number;
  daysRemaining: number;
}

export const subscriptionApi = {
  // Public / Authenticated plans catalogue
  getPlans: async () => {
    const res = await apiClient.get<ApiResponse<PlanConfigRecord[]>>('/subscription/plans');
    return res.data.data;
  },

  // Super-admin plan update
  updatePlan: async (planKey: string, updates: Partial<PlanConfigRecord>) => {
    const res = await apiClient.put<ApiResponse<PlanConfigRecord>>(`/subscription/plans/${planKey}`, updates);
    return res.data.data;
  },

  // Tenant subscription & usage
  getMyStatus: async () => {
    const res = await apiClient.get<ApiResponse<MySubscriptionStatus>>('/subscription/my-status');
    return res.data.data;
  },

  // Initiate checkout
  initiateCheckout: async (payload: {
    planKey: string;
    billingCycle: 'MONTHLY' | 'YEARLY';
    provider: 'BKASH' | 'NAGAD' | 'SSLCOMMERZ' | 'MANUAL';
    idempotencyKey?: string;
  }) => {
    const res = await apiClient.post<
      ApiResponse<{
        transaction: PaymentTransactionRecord;
        checkoutUrl: string;
        callbackPayload: Record<string, any>;
      }>
    >('/subscription/checkout', payload);
    return res.data.data;
  },

  // Verify and execute payment
  verifyPayment: async (payload: {
    transactionCode: string;
    providerTransactionId?: string;
    signature?: string;
    status: 'SUCCESS' | 'FAILED' | 'CANCELLED';
  }) => {
    const res = await apiClient.post<
      ApiResponse<{
        transaction: PaymentTransactionRecord;
        invoice?: SubscriptionInvoiceRecord;
        tenant: any;
      }>
    >('/subscription/verify-payment', payload);
    return res.data.data;
  },

  // Get billing history
  getBillingHistory: async () => {
    const res = await apiClient.get<
      ApiResponse<{
        transactions: PaymentTransactionRecord[];
        invoices: SubscriptionInvoiceRecord[];
      }>
    >('/subscription/history');
    return res.data.data;
  },

  // Download official vector PDF tax invoice
  downloadInvoicePdf: async (invoiceNumber: string) => {
    const res = await apiClient.get(`/subscription/invoices/${invoiceNumber}/pdf`, {
      responseType: 'blob',
    });
    return res.data as Blob;
  },
};

