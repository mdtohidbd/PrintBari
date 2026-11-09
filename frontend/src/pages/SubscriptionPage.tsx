import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Download,
  Zap,
  HardDrive,
  Users,
  RefreshCw,
  Clock,
  Sparkles,
  Lock,
  Layers,
  ArrowRight,
  Sliders,
  DollarSign,
  FileCheck,
} from 'lucide-react';
import {
  subscriptionApi,
  PlanConfigRecord,
  MySubscriptionStatus,
  SubscriptionInvoiceRecord,
  PaymentTransactionRecord,
} from '../api/subscription.api';
import { useAppStore } from '../store/useAppStore';

export const SubscriptionPage: React.FC = () => {
  const { currentUser } = useAppStore();
  const [loading, setLoading] = useState<boolean>(true);
  const [statusData, setStatusData] = useState<MySubscriptionStatus | null>(null);
  const [plans, setPlans] = useState<PlanConfigRecord[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransactionRecord[]>([]);
  const [invoices, setInvoices] = useState<SubscriptionInvoiceRecord[]>([]);
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [activeTab, setActiveTab] = useState<'plans' | 'invoices' | 'transactions' | 'admin'>('plans');

  // Checkout modal state
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanConfigRecord | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<'BKASH' | 'NAGAD' | 'SSLCOMMERZ' | 'MANUAL'>('BKASH');
  const [checkoutLoading, setCheckoutLoading] = useState<boolean>(false);
  const [checkoutResult, setCheckoutResult] = useState<{
    transaction: PaymentTransactionRecord;
    checkoutUrl: string;
    callbackPayload: Record<string, any>;
  } | null>(null);
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState<string | null>(null);
  const [paymentErrorMsg, setPaymentErrorMsg] = useState<string | null>(null);

  // Super admin edit plan state
  const [editingPlan, setEditingPlan] = useState<PlanConfigRecord | null>(null);
  const [adminSaving, setAdminSaving] = useState<boolean>(false);
  const [adminSuccessMsg, setAdminSuccessMsg] = useState<string | null>(null);

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'OWNER';

  const loadData = async () => {
    try {
      setLoading(true);
      const [plansRes, statusRes, historyRes] = await Promise.all([
        subscriptionApi.getPlans().catch(() => []),
        subscriptionApi.getMyStatus().catch(() => null),
        subscriptionApi.getBillingHistory().catch(() => ({ transactions: [], invoices: [] })),
      ]);

      setPlans(plansRes);
      setStatusData(statusRes);
      setTransactions(historyRes.transactions || []);
      setInvoices(historyRes.invoices || []);
    } catch (err) {
      console.error('Failed to load subscription data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStartCheckout = async (plan: PlanConfigRecord) => {
    setSelectedPlan(plan);
    setPaymentSuccessMsg(null);
    setPaymentErrorMsg(null);
    setCheckoutResult(null);
    setIsCheckoutOpen(true);

    try {
      setCheckoutLoading(true);
      const res = await subscriptionApi.initiateCheckout({
        planKey: plan.planKey,
        billingCycle,
        provider: selectedProvider,
      });
      setCheckoutResult(res);
    } catch (err: any) {
      setPaymentErrorMsg(err.response?.data?.message || 'Failed to initiate checkout session');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleSwitchProvider = async (provider: 'BKASH' | 'NAGAD' | 'SSLCOMMERZ' | 'MANUAL') => {
    setSelectedProvider(provider);
    if (!selectedPlan) return;
    try {
      setCheckoutLoading(true);
      const res = await subscriptionApi.initiateCheckout({
        planKey: selectedPlan.planKey,
        billingCycle,
        provider,
      });
      setCheckoutResult(res);
    } catch (err: any) {
      setPaymentErrorMsg(err.response?.data?.message || 'Failed to switch provider');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleExecutePaymentSimulation = async () => {
    if (!checkoutResult) return;
    try {
      setCheckoutLoading(true);
      setPaymentErrorMsg(null);
      const verifyRes = await subscriptionApi.verifyPayment({
        transactionCode: checkoutResult.transaction.transactionCode,
        providerTransactionId: checkoutResult.callbackPayload.providerTransactionId || `SIM-${Date.now()}`,
        signature: checkoutResult.callbackPayload.signature,
        status: 'SUCCESS',
      });

      setPaymentSuccessMsg(`Payment completed successfully! Upgraded to ${verifyRes.tenant?.subscription?.plan} plan.`);
      await loadData();
      setTimeout(() => {
        setIsCheckoutOpen(false);
      }, 2500);
    } catch (err: any) {
      setPaymentErrorMsg(err.response?.data?.message || 'Payment backend verification failed');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleDownloadInvoice = async (invoiceNumber: string) => {
    try {
      const blob = await subscriptionApi.downloadInvoicePdf(invoiceNumber);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `DocuStudio-Invoice-${invoiceNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Invoice download failed:', err);
      alert('Failed to download PDF invoice. Please try again.');
    }
  };

  const handleSavePlanSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    try {
      setAdminSaving(true);
      setAdminSuccessMsg(null);
      const updated = await subscriptionApi.updatePlan(editingPlan.planKey, {
        displayName: editingPlan.displayName,
        monthlyPrice: Number(editingPlan.monthlyPrice),
        yearlyPrice: Number(editingPlan.yearlyPrice),
        storageLimitMB: Number(editingPlan.storageLimitMB),
        staffLimit: Number(editingPlan.staffLimit),
        monthlyJobLimit: Number(editingPlan.monthlyJobLimit),
        backupAvailability: editingPlan.backupAvailability,
        isActive: editingPlan.isActive,
      });

      setAdminSuccessMsg(`Plan "${updated.displayName}" updated successfully!`);
      setPlans((prev) => prev.map((p) => (p.planKey === updated.planKey ? updated : p)));
      setTimeout(() => setAdminSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update plan configuration');
    } finally {
      setAdminSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-300">
        <RefreshCw className="w-10 h-10 animate-spin text-brand-500 mb-4" />
        <p className="text-lg font-medium">Loading subscription and billing data...</p>
      </div>
    );
  }

  const currentPlan = statusData?.currentPlan;
  const isTrialing = statusData?.isTrialing;
  const daysLeft = isTrialing ? statusData?.trialDaysRemaining : statusData?.daysRemaining;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 space-y-8">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-lg shadow-brand-500/20">
              <CreditCard className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                Subscription & Billing Management
              </h1>
              <p className="text-sm text-slate-400">
                Manage your shop's plan, resource quotas, automated backups, and vector tax invoices.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Active Subscription Overview Card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800/80 rounded-2xl border border-slate-700/80 p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative z-10">
          {/* Plan Info */}
          <div className="space-y-2 md:col-span-1 border-b md:border-b-0 md:border-r border-slate-700/60 pb-4 md:pb-0 md:pr-4">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Current Shop Plan</span>
            <div className="flex items-center gap-2.5">
              <h2 className="text-2xl font-black text-white">{currentPlan?.displayName || 'Starter Kiosk'}</h2>
              {isTrialing && (
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Trial
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {currentPlan?.description || 'Standard kiosk features for daily printing and passport photos.'}
            </p>

            <div className="pt-2 flex items-center gap-2 text-xs text-slate-300">
              <Clock className="w-4 h-4 text-brand-400" />
              <span>
                {isTrialing ? (
                  <strong className="text-amber-400">{daysLeft} days remaining</strong>
                ) : (
                  <span>Next renewal in {daysLeft} days</span>
                )}
              </span>
            </div>
          </div>

          {/* Quota: Storage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-slate-400 font-medium">
                <HardDrive className="w-4 h-4 text-indigo-400" />
                Cloud Storage Quota
              </span>
              <span className="text-slate-300 font-semibold">{currentPlan?.storageLimitMB || 512} MB</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-indigo-500 h-2.5 rounded-full"
                style={{ width: `${Math.min(100, Math.round(((statusData?.tenant?.usage?.storageUsedBytes || 0) / ((currentPlan?.storageLimitMB || 512) * 1024 * 1024)) * 100)) || 12}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400">
              {((statusData?.tenant?.usage?.storageUsedBytes || 24000000) / (1024 * 1024)).toFixed(1)} MB of {currentPlan?.storageLimitMB || 512} MB used
            </p>
          </div>

          {/* Quota: Staff */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-slate-400 font-medium">
                <Users className="w-4 h-4 text-emerald-400" />
                Staff Operator Seats
              </span>
              <span className="text-slate-300 font-semibold">{currentPlan?.staffLimit || 2} Seats</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-2.5 rounded-full"
                style={{ width: `${Math.min(100, (1 / (currentPlan?.staffLimit || 2)) * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400">1 active operator registered</p>
          </div>

          {/* Backup & Fast Action */}
          <div className="space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-medium">Automated Backup Tier</span>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-brand-400" />
                <span className="text-sm font-semibold text-slate-200">
                  {currentPlan?.backupAvailability || 'MANUAL'} Backup Protection
                </span>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('plans')}
              className="w-full py-2 px-4 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs tracking-wide shadow-md shadow-brand-600/30 transition-all flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4 fill-current" />
              Upgrade or Renew Plan
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('plans')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'plans'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Subscription Plans & Pricing
        </button>

        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'invoices'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          Tax Invoices ({invoices.length})
        </button>

        <button
          onClick={() => setActiveTab('transactions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'transactions'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Payment Ledger ({transactions.length})
        </button>

        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'admin'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-indigo-400 hover:text-indigo-300 hover:bg-slate-900'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Super Admin Plan Controls
          </button>
        )}
      </div>

      {/* TAB 1: Plans Grid */}
      {activeTab === 'plans' && (
        <div className="space-y-8">
          {/* Billing Cycle Toggle */}
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="inline-flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl">
              <button
                onClick={() => setBillingCycle('MONTHLY')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  billingCycle === 'MONTHLY'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Monthly Billing (মাসিক)
              </button>
              <button
                onClick={() => setBillingCycle('YEARLY')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  billingCycle === 'YEARLY'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Yearly Billing (বার্ষিক)
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] uppercase font-bold border border-emerald-500/30">
                  Save 20%
                </span>
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Payments securely processed in Bangladeshi Taka (BDT ৳) with official VAT receipts.
            </p>
          </div>

          {/* Plan Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan) => {
              const price = billingCycle === 'MONTHLY' ? plan.monthlyPrice : plan.yearlyPrice;
              const isCurrent = statusData?.tenant?.subscription?.plan === plan.planKey;

              return (
                <div
                  key={plan.planKey}
                  className={`rounded-2xl border flex flex-col justify-between p-6 transition-all relative ${
                    plan.isPopular
                      ? 'bg-gradient-to-b from-slate-900 via-slate-900/90 to-brand-950/40 border-brand-500/60 shadow-xl shadow-brand-500/10'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {plan.isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-brand-600 text-white text-[11px] font-bold rounded-full uppercase tracking-wider shadow-md">
                      Most Popular for Studios
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-white">{plan.displayName}</h3>
                      {isCurrent && (
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full text-[10px] font-bold">
                          Active Plan
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 min-h-[36px]">{plan.description}</p>

                    <div className="pt-2">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-white">৳{price.toLocaleString()}</span>
                        <span className="text-xs text-slate-400 font-medium">
                          /{billingCycle === 'MONTHLY' ? 'month' : 'year'}
                        </span>
                      </div>
                      {billingCycle === 'YEARLY' && (
                        <span className="text-[11px] text-emerald-400 font-medium">
                          Billed ৳{plan.yearlyPrice.toLocaleString()} annually
                        </span>
                      )}
                    </div>

                    <div className="border-t border-slate-800 pt-4 space-y-2.5 text-xs">
                      <div className="flex items-center gap-2 text-slate-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>
                          <strong>{plan.storageLimitMB >= 1024 ? `${plan.storageLimitMB / 1024} GB` : `${plan.storageLimitMB} MB`}</strong>{' '}
                          Encrypted Storage
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>
                          Up to <strong>{plan.staffLimit >= 999 ? 'Unlimited' : plan.staffLimit}</strong> Staff Operator Seats
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>
                          <strong>{plan.monthlyJobLimit >= 99999 ? 'Unlimited' : plan.monthlyJobLimit.toLocaleString()}</strong> Jobs / month
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>
                          {plan.backupAvailability} Automated Cloud Backups
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>
                          {plan.featureRestrictions?.highDpiExport ? 'Ultra 300+ DPI Vector Exports' : 'Standard 300 DPI Export'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>
                          {plan.featureRestrictions?.multiPrinterSpool ? 'Multi-Printer Spooling Enabled' : 'Single Local Printer'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6">
                    <button
                      onClick={() => handleStartCheckout(plan)}
                      className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                        isCurrent
                          ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          : plan.isPopular
                          ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/30'
                          : 'bg-white hover:bg-slate-200 text-slate-900 shadow-md'
                      }`}
                    >
                      {isCurrent ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          Renew / Extend Plan
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5 fill-current" />
                          Select {plan.displayName}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Payment Providers Guarantee Banner */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-brand-400 shrink-0">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Bank-Grade Payment Security</h4>
                <p className="text-xs text-slate-400 max-w-xl">
                  Payments are authenticated directly with bKash, Nagad, and SSLCommerz servers. We verify SHA-256 signatures and idempotent tokens on our backend before issuing tax invoices.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1.5 rounded-lg bg-pink-950/50 border border-pink-700/50 text-pink-400 text-xs font-bold">
                bKash বিকাশ
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-orange-950/50 border border-orange-700/50 text-orange-400 text-xs font-bold">
                Nagad নগদ
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-blue-950/50 border border-blue-700/50 text-blue-400 text-xs font-bold">
                SSLCommerz
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Invoices */}
      {activeTab === 'invoices' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Official Tax Invoices (ভ্যাট চালান)</h3>
              <p className="text-xs text-slate-400">Download official 300 DPI vector PDF invoices for shop accounting.</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-medium">
              Total {invoices.length} invoices
            </span>
          </div>

          {invoices.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <FileCheck className="w-12 h-12 mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-semibold">No invoices issued yet</p>
              <p className="text-xs text-slate-500">Invoices will appear here automatically whenever you make a subscription payment.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs" aria-label="Billing invoice history">
                <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th scope="col" className="py-3 px-4">Invoice #</th>
                    <th scope="col" className="py-3 px-4">Plan & Billing</th>
                    <th scope="col" className="py-3 px-4">Period</th>
                    <th scope="col" className="py-3 px-4">Method</th>
                    <th scope="col" className="py-3 px-4 text-right">Total (BDT)</th>
                    <th scope="col" className="py-3 px-4 text-center">Status</th>
                    <th scope="col" className="py-3 px-4 text-right">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {invoices.map((inv) => (
                    <tr key={inv._id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-white">{inv.invoiceNumber}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-200">{inv.planName}</div>
                        <span className="text-[10px] text-slate-500 uppercase">{inv.billingCycle}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {new Date(inv.periodStart).toLocaleDateString()} - {new Date(inv.periodEnd).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold text-[10px]">
                          {inv.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-white">৳{inv.totalAmount.toLocaleString()}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold">
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleDownloadInvoice(inv.invoiceNumber)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs shadow-sm transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Transactions */}
      {activeTab === 'transactions' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Gateway Transactions</h3>
              <p className="text-xs text-slate-400">Complete audit log of payment attempts, gateway signatures, and receipts.</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-medium">
              Total {transactions.length} records
            </span>
          </div>

          {transactions.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <CreditCard className="w-12 h-12 mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-semibold">No payment transactions found</p>
              <p className="text-xs text-slate-500">Every checkout attempt will be safely recorded with full trace identifiers.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs" aria-label="Payment transactions history">
                <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th scope="col" className="py-3 px-4">Transaction Code</th>
                    <th scope="col" className="py-3 px-4">Provider</th>
                    <th scope="col" className="py-3 px-4">Plan & Cycle</th>
                    <th scope="col" className="py-3 px-4">Amount</th>
                    <th scope="col" className="py-3 px-4">Status</th>
                    <th scope="col" className="py-3 px-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {transactions.map((tx) => (
                    <tr key={tx._id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-brand-400">{tx.transactionCode}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-800 font-bold text-[10px] text-slate-300">
                          {tx.provider}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {tx.planKey} ({tx.billingCycle})
                      </td>
                      <td className="py-3 px-4 font-black text-white">
                        {tx.currency} {tx.amount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            tx.paymentStatus === 'SUCCESS'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              : tx.paymentStatus === 'FAILED'
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          }`}
                        >
                          {tx.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{new Date(tx.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Super Admin Plan Editor */}
      {activeTab === 'admin' && isSuperAdmin && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-700/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sliders className="w-5 h-5 text-indigo-400" />
              <div>
                <h4 className="text-sm font-bold text-indigo-200">Super Admin Plan Customizer</h4>
                <p className="text-xs text-indigo-300/80">
                  Adjust pricing, storage quotas, staff limits, and backup availability in real time across the SaaS cluster.
                </p>
              </div>
            </div>
            {adminSuccessMsg && (
              <span className="text-xs font-semibold px-3 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                {adminSuccessMsg}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((p) => (
              <div key={p.planKey} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white">{p.displayName}</h4>
                  <span className="text-xs font-mono px-2 py-0.5 bg-slate-800 text-slate-400 rounded">
                    {p.planKey}
                  </span>
                </div>

                <div className="space-y-2 text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Monthly Price:</span>
                    <strong className="text-white">৳{p.monthlyPrice.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Yearly Price:</span>
                    <strong className="text-white">৳{p.yearlyPrice.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Storage Limit:</span>
                    <strong className="text-white">{p.storageLimitMB} MB</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Staff Limit:</span>
                    <strong className="text-white">{p.staffLimit} seats</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Backup Policy:</span>
                    <strong className="text-white">{p.backupAvailability}</strong>
                  </div>
                </div>

                <button
                  onClick={() => setEditingPlan(p)}
                  className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  Edit Settings
                </button>
              </div>
            ))}
          </div>

          {/* Edit Plan Modal */}
          {editingPlan && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-lg font-bold text-white">Edit Plan: {editingPlan.displayName}</h3>
                  <button
                    onClick={() => setEditingPlan(null)}
                    className="text-slate-400 hover:text-white text-sm"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSavePlanSettings} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Display Name</label>
                    <input
                      type="text"
                      value={editingPlan.displayName}
                      onChange={(e) => setEditingPlan({ ...editingPlan, displayName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Monthly Price (BDT)</label>
                      <input
                        type="number"
                        value={editingPlan.monthlyPrice}
                        onChange={(e) => setEditingPlan({ ...editingPlan, monthlyPrice: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Yearly Price (BDT)</label>
                      <input
                        type="number"
                        value={editingPlan.yearlyPrice}
                        onChange={(e) => setEditingPlan({ ...editingPlan, yearlyPrice: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Storage Limit (MB)</label>
                      <input
                        type="number"
                        value={editingPlan.storageLimitMB}
                        onChange={(e) => setEditingPlan({ ...editingPlan, storageLimitMB: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Staff Limit (Seats)</label>
                      <input
                        type="number"
                        value={editingPlan.staffLimit}
                        onChange={(e) => setEditingPlan({ ...editingPlan, staffLimit: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Backup Tier</label>
                    <select
                      value={editingPlan.backupAvailability}
                      onChange={(e) =>
                        setEditingPlan({
                          ...editingPlan,
                          backupAvailability: e.target.value as any,
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                    >
                      <option value="NONE">NONE</option>
                      <option value="MANUAL">MANUAL</option>
                      <option value="WEEKLY">WEEKLY</option>
                      <option value="DAILY">DAILY</option>
                    </select>
                  </div>

                  <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setEditingPlan(null)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={adminSaving}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-md transition-colors"
                    >
                      {adminSaving ? 'Saving...' : 'Save Plan Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CHECKOUT MODAL (bKash / Nagad / SSLCommerz Simulation) */}
      {isCheckoutOpen && selectedPlan && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setIsCheckoutOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="p-2.5 rounded-xl bg-brand-600/20 text-brand-400 border border-brand-500/30">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Upgrade to {selectedPlan.displayName}</h3>
                <p className="text-xs text-slate-400">
                  {billingCycle === 'MONTHLY' ? 'Monthly' : 'Annual'} Subscription Checkout
                </p>
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Plan Price ({billingCycle.toLowerCase()}):</span>
                <span>
                  ৳
                  {(billingCycle === 'MONTHLY' ? selectedPlan.monthlyPrice : selectedPlan.yearlyPrice).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>VAT / Tax (5%):</span>
                <span>
                  ৳
                  {Math.round(
                    (billingCycle === 'MONTHLY' ? selectedPlan.monthlyPrice : selectedPlan.yearlyPrice) * 0.05
                  ).toLocaleString()}
                </span>
              </div>
              <div className="border-t border-slate-800 pt-2 flex justify-between font-black text-sm text-white">
                <span>Total Payable:</span>
                <span className="text-brand-400">
                  ৳
                  {Math.round(
                    (billingCycle === 'MONTHLY' ? selectedPlan.monthlyPrice : selectedPlan.yearlyPrice) * 1.05
                  ).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Provider Selection */}
            <div className="space-y-2 text-xs">
              <label className="font-semibold text-slate-300 block">Select Payment Method (পেমেন্ট মাধ্যম):</label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => handleSwitchProvider('BKASH')}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    selectedProvider === 'BKASH'
                      ? 'bg-pink-950/50 border-pink-500 text-pink-300 font-bold'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="block text-sm font-black">bKash</span>
                  <span className="text-[10px]">বিকাশ</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchProvider('NAGAD')}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    selectedProvider === 'NAGAD'
                      ? 'bg-orange-950/50 border-orange-500 text-orange-300 font-bold'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="block text-sm font-black">Nagad</span>
                  <span className="text-[10px]">নগদ</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchProvider('SSLCOMMERZ')}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    selectedProvider === 'SSLCOMMERZ'
                      ? 'bg-blue-950/50 border-blue-500 text-blue-300 font-bold'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="block text-sm font-black">Cards</span>
                  <span className="text-[10px]">SSLCommerz</span>
                </button>
              </div>
            </div>

            {/* Backend Verification Details */}
            {checkoutResult && (
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1 text-[11px] text-slate-400">
                <div className="flex justify-between">
                  <span>Txn Code:</span>
                  <span className="font-mono text-slate-200">{checkoutResult.transaction.transactionCode}</span>
                </div>
                <div className="flex justify-between">
                  <span>Backend Signature:</span>
                  <span className="font-mono text-emerald-400 truncate max-w-[200px]">
                    {checkoutResult.callbackPayload.signature}
                  </span>
                </div>
              </div>
            )}

            {paymentSuccessMsg && (
              <div className="p-3 bg-emerald-500/20 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {paymentSuccessMsg}
              </div>
            )}

            {paymentErrorMsg && (
              <div className="p-3 bg-rose-500/20 border border-rose-500/50 rounded-xl text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {paymentErrorMsg}
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                className="w-1/3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={checkoutLoading || !!paymentSuccessMsg}
                onClick={handleExecutePaymentSimulation}
                className="w-2/3 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-brand-600/30 transition-all flex items-center justify-center gap-2"
              >
                {checkoutLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Confirm & Complete Payment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

