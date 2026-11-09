import React, { useState, useEffect } from 'react';
import {
  Shield,
  Building2,
  Users,
  CreditCard,
  HardDrive,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Settings,
  DollarSign,
  Search,
  Filter,
  Download,
  RefreshCw,
  Sliders,
  Plus,
  Ban,
  Power,
  FileText,
  Sparkles,
  Clock,
  Lock,
  Layers,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import {
  superAdminApi,
  SuperAdminDashboard,
  ShopRecord,
  ShopDetails,
  PlatformSettingRecord,
} from '../api/superadmin.api';
import { useAppStore } from '../store/useAppStore';

export const SuperAdminPage: React.FC = () => {
  const { currentUser } = useAppStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'shops' | 'plans' | 'payments' | 'settings' | 'audit'>('overview');
  const [loading, setLoading] = useState<boolean>(true);

  // Dashboard Data
  const [dashboard, setDashboard] = useState<SuperAdminDashboard | null>(null);

  // Shop Management State
  const [shops, setShops] = useState<ShopRecord[]>([]);
  const [totalShops, setTotalShops] = useState<number>(0);
  const [shopSearch, setShopSearch] = useState<string>('');
  const [shopStatusFilter, setShopStatusFilter] = useState<string>('');
  const [shopPlanFilter, setShopPlanFilter] = useState<string>('');
  const [selectedShopDetails, setSelectedShopDetails] = useState<ShopDetails | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState<boolean>(false);
  const [isSubModalOpen, setIsSubModalOpen] = useState<boolean>(false);
  const [selectedShopForSub, setSelectedShopForSub] = useState<ShopRecord | null>(null);
  const [subPlanUpdate, setSubPlanUpdate] = useState<string>('PRO');
  const [subStatusUpdate, setSubStatusUpdate] = useState<string>('ACTIVE');

  // Plan Management State
  const [plans, setPlans] = useState<any[]>([]);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [isNewPlanModal, setIsNewPlanModal] = useState<boolean>(false);
  const [newPlanData, setNewPlanData] = useState<any>({
    planKey: '',
    displayName: '',
    description: '',
    monthlyPrice: 1500,
    yearlyPrice: 15000,
    storageLimitMB: 10000,
    staffLimit: 5,
    monthlyJobLimit: 500,
    backupAvailability: 'WEEKLY',
    isPopular: false,
    isActive: true,
  });

  // Payment Management State
  const [transactions, setTransactions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [paymentStats, setPaymentStats] = useState<any>(null);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('');

  // Settings State
  const [settings, setSettings] = useState<PlatformSettingRecord[]>([]);
  const [settingsCategory, setSettingsCategory] = useState<string>('WEBSITE');
  const [settingsEdits, setSettingsEdits] = useState<Record<string, any>>({});
  const [savingSettings, setSavingSettings] = useState<boolean>(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Action feedback
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage(null), 3500);
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const data = await superAdminApi.getDashboard();
      setDashboard(data);
    } catch (err: any) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadShops = async () => {
    try {
      const res = await superAdminApi.getShops({
        search: shopSearch || undefined,
        status: shopStatusFilter || undefined,
        plan: shopPlanFilter || undefined,
      });
      setShops(res.shops);
      setTotalShops(res.total);
    } catch (err) {
      console.error('Failed to load shops:', err);
    }
  };

  const loadPlans = async () => {
    try {
      const res = await superAdminApi.getPlans();
      setPlans(res);
    } catch (err) {
      console.error('Failed to load plans:', err);
    }
  };

  const loadPayments = async () => {
    try {
      const [txRes, invRes, statsRes] = await Promise.all([
        superAdminApi.getTransactions({ status: paymentStatusFilter || undefined }),
        superAdminApi.getInvoices(),
        superAdminApi.getPaymentStats(),
      ]);
      setTransactions(txRes.transactions);
      setInvoices(invRes.invoices);
      setPaymentStats(statsRes);
    } catch (err) {
      console.error('Failed to load payments:', err);
    }
  };

  const loadSettings = async (cat?: string) => {
    try {
      const res = await superAdminApi.getSettings(cat || settingsCategory);
      setSettings(res);
      const initialMap: Record<string, any> = {};
      res.forEach((s) => {
        initialMap[s.key] = s.value;
      });
      setSettingsEdits(initialMap);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const res = await superAdminApi.getAuditLogs();
      setAuditLogs(res.logs);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (activeTab === 'shops') loadShops();
    if (activeTab === 'plans') loadPlans();
    if (activeTab === 'payments') loadPayments();
    if (activeTab === 'settings') loadSettings();
    if (activeTab === 'audit') loadAuditLogs();
  }, [activeTab]);

  // Shop actions
  const handleViewShop = async (shopId: string) => {
    try {
      const details = await superAdminApi.getShopDetails(shopId);
      setSelectedShopDetails(details);
      setIsDetailsModalOpen(true);
    } catch (err) {
      showToast('Failed to load shop details', 'error');
    }
  };

  const handleToggleSuspend = async (shop: ShopRecord) => {
    try {
      if (shop.isActive) {
        const reason = prompt(`Enter suspension reason for ${shop.name}:`, 'Terms of service violation');
        if (!reason) return;
        await superAdminApi.suspendShop(shop._id, reason);
        showToast(`Shop "${shop.name}" suspended successfully`);
      } else {
        await superAdminApi.activateShop(shop._id);
        showToast(`Shop "${shop.name}" activated successfully`);
      }
      loadShops();
      loadDashboardData();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Action failed', 'error');
    }
  };

  const handleSaveSubscription = async () => {
    if (!selectedShopForSub) return;
    try {
      await superAdminApi.updateShopSubscription(selectedShopForSub._id, {
        plan: subPlanUpdate,
        status: subStatusUpdate,
      });
      showToast(`Subscription updated for ${selectedShopForSub.name}`);
      setIsSubModalOpen(false);
      loadShops();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update subscription', 'error');
    }
  };

  // Plan actions
  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await superAdminApi.createPlan(newPlanData);
      showToast(`Plan ${newPlanData.displayName} created successfully`);
      setIsNewPlanModal(false);
      loadPlans();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to create plan', 'error');
    }
  };

  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    try {
      await superAdminApi.updatePlan(editingPlan.planKey, editingPlan);
      showToast(`Plan ${editingPlan.displayName} updated successfully`);
      setEditingPlan(null);
      loadPlans();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update plan', 'error');
    }
  };

  const handleArchivePlan = async (planKey: string) => {
    if (!confirm(`Are you sure you want to archive plan ${planKey}?`)) return;
    try {
      await superAdminApi.archivePlan(planKey);
      showToast(`Plan ${planKey} archived`);
      loadPlans();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to archive plan', 'error');
    }
  };

  // Settings actions
  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      const updates = Object.entries(settingsEdits).map(([key, value]) => ({ key, value }));
      await superAdminApi.bulkUpdateSettings(updates);
      showToast('Platform settings saved successfully');
      loadSettings();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 space-y-8">
      {/* Toast Alert */}
      {actionMessage && (
        <div
          className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl border shadow-xl flex items-center gap-2 text-sm font-semibold transition-all ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50'
              : 'bg-rose-950/90 text-rose-300 border-rose-500/50'
          }`}
        >
          {actionMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {actionMessage.text}
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20">
              <Shield className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                  Super Admin Command Center
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  Platform HQ
                </span>
              </div>
              <p className="text-sm text-slate-400">
                Centralized multi-tenant oversight, SaaS monetization, plan tier controls, and security audit logs.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              loadDashboardData();
              if (activeTab === 'shops') loadShops();
              if (activeTab === 'plans') loadPlans();
              if (activeTab === 'payments') loadPayments();
              if (activeTab === 'settings') loadSettings();
              if (activeTab === 'audit') loadAuditLogs();
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        {[
          { key: 'overview', label: 'Platform Overview', icon: Activity },
          { key: 'shops', label: `Shops (${dashboard?.shops?.total || 0})`, icon: Building2 },
          { key: 'plans', label: 'Subscription Plans', icon: Sparkles },
          { key: 'payments', label: 'Payment Ledger', icon: CreditCard },
          { key: 'settings', label: 'Platform Settings', icon: Settings },
          { key: 'audit', label: 'Security Audit Logs', icon: Lock },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: PLATFORM OVERVIEW (DASHBOARD)
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Top Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Total Shops */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Total Shops</span>
                <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                  <Building2 className="w-5 h-5" />
                </span>
              </div>
              <div className="text-3xl font-black text-white">{dashboard?.shops?.total || 0}</div>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="text-emerald-400 font-semibold">{dashboard?.shops?.active || 0} Active</span>
                <span>•</span>
                <span className="text-amber-400 font-semibold">{dashboard?.shops?.trialing || 0} Trial</span>
                <span>•</span>
                <span className="text-rose-400 font-semibold">{dashboard?.shops?.suspended || 0} Suspended</span>
              </div>
            </div>

            {/* Total Revenue */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Total SaaS Revenue</span>
                <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <DollarSign className="w-5 h-5" />
                </span>
              </div>
              <div className="text-3xl font-black text-white">
                ৳{(dashboard?.revenue?.totalRevenue || 0).toLocaleString()}
              </div>
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>Monthly: ৳{(dashboard?.revenue?.monthlyRevenue || 0).toLocaleString()}</span>
                <span>Today: ৳{(dashboard?.revenue?.todayRevenue || 0).toLocaleString()}</span>
              </div>
            </div>

            {/* Storage Quota Usage */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Platform Storage</span>
                <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                  <HardDrive className="w-5 h-5" />
                </span>
              </div>
              <div className="text-3xl font-black text-white">
                {((dashboard?.storage?.totalUsedBytes || 0) / (1024 * 1024)).toFixed(1)} MB
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-500 h-2 rounded-full"
                  style={{ width: `${Math.min(100, dashboard?.storage?.utilizationPercent || 5)}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-400 flex justify-between">
                <span>Allocated: {((dashboard?.storage?.totalLimitBytes || 0) / (1024 * 1024 * 1024)).toFixed(1)} GB</span>
                <span>{dashboard?.storage?.utilizationPercent || 0}% used</span>
              </div>
            </div>

            {/* Payment Volume */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Payment Settlements</span>
                <span className="p-2 rounded-xl bg-pink-500/10 text-pink-400">
                  <CreditCard className="w-5 h-5" />
                </span>
              </div>
              <div className="text-3xl font-black text-white">{dashboard?.payments?.total || 0}</div>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="text-emerald-400 font-semibold">{dashboard?.payments?.success || 0} Paid</span>
                <span>•</span>
                <span className="text-rose-400 font-semibold">{dashboard?.payments?.failed || 0} Failed</span>
                <span>•</span>
                <span className="text-amber-400 font-semibold">{dashboard?.payments?.pending || 0} In Flight</span>
              </div>
            </div>
          </div>

          {/* Plan & Provider Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Plan Distribution */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Subscription Plan Distribution
              </h3>
              <div className="space-y-3">
                {dashboard?.planDistribution?.map((p) => (
                  <div key={p.plan} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-300">{p.plan}</span>
                      <span className="text-slate-400 font-mono">{p.count} shops</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2">
                      <div
                        className="bg-purple-500 h-2 rounded-full"
                        style={{
                          width: `${Math.min(100, Math.round((p.count / (dashboard.shops.total || 1)) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Provider Revenue Breakdown */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                Gateway Volume (bKash / Nagad / SSLCommerz)
              </h3>
              <div className="space-y-3">
                {dashboard?.providerDistribution?.map((prov) => (
                  <div key={prov.provider} className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-xs font-bold text-slate-200">
                        {prov.provider}
                      </span>
                      <span className="text-xs text-slate-400">{prov.count} transactions</span>
                    </div>
                    <span className="font-mono font-bold text-white text-sm">
                      ৳{prov.totalRevenue.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Platform Activities */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-400" />
              Live Platform Activity Feed
            </h3>
            <div className="divide-y divide-slate-800">
              {dashboard?.recentActivities?.slice(0, 8).map((act: any) => (
                <div key={act._id} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        act.status === 'SUCCESS'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {act.status}
                    </span>
                    <span className="font-mono text-slate-300 font-semibold">{act.action}</span>
                    <span className="text-slate-500 truncate max-w-xs">{act.tenantId?.name || 'System Level'}</span>
                  </div>
                  <span className="text-slate-500">{new Date(act.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: SHOP MANAGEMENT
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'shops' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900 p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search shop name, subdomain..."
                  value={shopSearch}
                  onChange={(e) => setShopSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadShops()}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>

              <select
                value={shopStatusFilter}
                onChange={(e) => setShopStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="TRIALING">Trialing</option>
                <option value="EXPIRED">Expired</option>
                <option value="SUSPENDED">Suspended</option>
              </select>

              <select
                value={shopPlanFilter}
                onChange={(e) => setShopPlanFilter(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
              >
                <option value="">All Plans</option>
                <option value="STARTER">Starter</option>
                <option value="PRO">Pro</option>
                <option value="BUSINESS">Business</option>
                <option value="ENTERPRISE">Enterprise</option>
              </select>

              <button
                onClick={loadShops}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-xl"
              >
                Filter
              </button>
            </div>

            <div className="text-xs text-slate-400">Total {totalShops} registered shops</div>
          </div>

          {/* Shops Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs" aria-label="Tenant shops directory">
                <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th scope="col" className="py-3 px-4">Shop Name</th>
                    <th scope="col" className="py-3 px-4">Subdomain</th>
                    <th scope="col" className="py-3 px-4">Plan & Status</th>
                    <th scope="col" className="py-3 px-4">Storage Usage</th>
                    <th scope="col" className="py-3 px-4">Staff Seats</th>
                    <th scope="col" className="py-3 px-4">State</th>
                    <th scope="col" className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {shops.map((shop) => (
                    <tr key={shop._id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white">{shop.name}</td>
                      <td className="py-3.5 px-4 font-mono text-purple-400">
                        {shop.subdomain}.docustudio.io
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-200">{shop.subscription?.plan}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              shop.subscription?.status === 'ACTIVE'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : shop.subscription?.status === 'TRIALING'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                            }`}
                          >
                            {shop.subscription?.status}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {((shop.quotas?.storageUsedBytes || 0) / (1024 * 1024)).toFixed(1)} MB /{' '}
                        {Math.round((shop.quotas?.storageLimitBytes || 0) / (1024 * 1024))} MB
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">{shop.quotas?.maxStaffSeats || 2} Seats</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            shop.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {shop.isActive ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewShop(shop._id)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                          >
                            View
                          </button>
                          <button
                            onClick={() => {
                              setSelectedShopForSub(shop);
                              setSubPlanUpdate(shop.subscription?.plan || 'PRO');
                              setSubStatusUpdate(shop.subscription?.status || 'ACTIVE');
                              setIsSubModalOpen(true);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white text-xs font-semibold"
                          >
                            Plan
                          </button>
                          <button
                            onClick={() => handleToggleSuspend(shop)}
                            className={`p-1.5 rounded-lg text-xs font-semibold ${
                              shop.isActive
                                ? 'bg-rose-500/20 hover:bg-rose-500/40 text-rose-300'
                                : 'bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300'
                            }`}
                            title={shop.isActive ? 'Suspend Shop' : 'Activate Shop'}
                          >
                            {shop.isActive ? <Ban className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Shop Details Modal */}
          {isDetailsModalOpen && selectedShopDetails && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-lg font-bold text-white">{selectedShopDetails.shop.name}</h3>
                    <p className="text-xs text-purple-400 font-mono">
                      Subdomain: {selectedShopDetails.shop.subdomain}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsDetailsModalOpen(false)}
                    className="text-slate-400 hover:text-white text-sm"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block">Total Staff</span>
                    <strong className="text-lg text-white">{selectedShopDetails.staffCount}</strong>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block">Total Jobs</span>
                    <strong className="text-lg text-white">{selectedShopDetails.jobCount}</strong>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block">Current Plan</span>
                    <strong className="text-lg text-purple-400">{selectedShopDetails.shop.subscription?.plan}</strong>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block">Status</span>
                    <strong className="text-lg text-emerald-400">{selectedShopDetails.shop.subscription?.status}</strong>
                  </div>
                </div>

                {/* Owner Information */}
                {selectedShopDetails.owner && (
                  <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2 text-xs">
                    <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                      Shop Owner Contact
                    </span>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Owner Name:</span>
                      <strong className="text-white">{selectedShopDetails.owner.fullName}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Email:</span>
                      <span className="text-slate-300 font-mono">{selectedShopDetails.owner.email}</span>
                    </div>
                  </div>
                )}

                {/* Recent Transactions */}
                <div className="space-y-2 text-xs">
                  <span className="font-semibold text-slate-300">Recent Payment Transactions</span>
                  <div className="divide-y divide-slate-800 bg-slate-950/40 rounded-xl border border-slate-800">
                    {selectedShopDetails.recentTransactions.length === 0 ? (
                      <div className="p-4 text-center text-slate-500">No payment transactions found</div>
                    ) : (
                      selectedShopDetails.recentTransactions.map((tx: any) => (
                        <div key={tx._id} className="p-2.5 flex justify-between items-center">
                          <span className="font-mono text-slate-300">{tx.transactionCode}</span>
                          <span className="font-bold text-white">৳{tx.amount}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                            {tx.paymentStatus}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t border-slate-800">
                  <button
                    onClick={() => setIsDetailsModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Manage Subscription Modal */}
          {isSubModalOpen && selectedShopForSub && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-base font-bold text-white">
                    Manage Plan: {selectedShopForSub.name}
                  </h3>
                  <button onClick={() => setIsSubModalOpen(false)} className="text-slate-400 hover:text-white">
                    ✕
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Target Plan</label>
                    <select
                      value={subPlanUpdate}
                      onChange={(e) => setSubPlanUpdate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                    >
                      <option value="STARTER">STARTER</option>
                      <option value="PRO">PRO</option>
                      <option value="BUSINESS">BUSINESS</option>
                      <option value="ENTERPRISE">ENTERPRISE</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Subscription Status</label>
                    <select
                      value={subStatusUpdate}
                      onChange={(e) => setSubStatusUpdate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="TRIALING">TRIALING</option>
                      <option value="PAST_DUE">PAST_DUE</option>
                      <option value="EXPIRED">EXPIRED</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Updating this plan will automatically re-synchronize the shop's staff seats and cloud storage limits.
                  </p>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800 text-xs">
                  <button
                    onClick={() => setIsSubModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSubscription}
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg shadow-md"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: PLAN MANAGEMENT
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'plans' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Configurable SaaS Subscription Plans</h3>
              <p className="text-xs text-slate-400">
                Define pricing tiers, storage quotas, staff seat limits, and module access.
              </p>
            </div>
            <button
              onClick={() => setIsNewPlanModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create New Plan
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((p) => (
              <div
                key={p.planKey}
                className={`bg-slate-900 border rounded-2xl p-5 space-y-4 flex flex-col justify-between ${
                  p.isPopular ? 'border-purple-500/60 shadow-lg shadow-purple-500/10' : 'border-slate-800'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-white text-base">{p.displayName}</h4>
                    <span className="font-mono text-xs px-2 py-0.5 bg-slate-800 text-purple-400 rounded">
                      {p.planKey}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 min-h-[32px]">{p.description}</p>

                  <div className="space-y-1">
                    <div className="text-2xl font-black text-white">৳{p.monthlyPrice.toLocaleString()}<span className="text-xs text-slate-400 font-normal">/mo</span></div>
                    <div className="text-xs text-slate-400">৳{p.yearlyPrice.toLocaleString()} /year</div>
                  </div>

                  <div className="border-t border-slate-800 pt-3 space-y-1.5 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Storage Limit:</span>
                      <strong>{p.storageLimitMB} MB</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Staff Limit:</span>
                      <strong>{p.staffLimit} seats</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Monthly Jobs:</span>
                      <strong>{p.monthlyJobLimit}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Backup Policy:</span>
                      <strong>{p.backupAvailability}</strong>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex items-center gap-2">
                  <button
                    onClick={() => setEditingPlan(p)}
                    className="flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleArchivePlan(p.planKey)}
                    className="py-2 px-3 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 text-xs font-semibold transition-colors"
                    title="Archive Plan"
                  >
                    <Ban className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Edit Plan Modal */}
          {editingPlan && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-base font-bold text-white">Edit Plan: {editingPlan.displayName}</h3>
                  <button onClick={() => setEditingPlan(null)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <form onSubmit={handleUpdatePlan} className="space-y-4 text-xs">
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
                      className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg shadow-md"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Create Plan Modal */}
          {isNewPlanModal && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-base font-bold text-white">Create New Plan Tier</h3>
                  <button onClick={() => setIsNewPlanModal(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <form onSubmit={handleCreatePlan} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Plan Key (e.g. ULTIMATE)</label>
                      <input
                        type="text"
                        value={newPlanData.planKey}
                        onChange={(e) => setNewPlanData({ ...newPlanData, planKey: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Display Name</label>
                      <input
                        type="text"
                        value={newPlanData.displayName}
                        onChange={(e) => setNewPlanData({ ...newPlanData, displayName: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Description</label>
                    <input
                      type="text"
                      value={newPlanData.description}
                      onChange={(e) => setNewPlanData({ ...newPlanData, description: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Monthly Price (BDT)</label>
                      <input
                        type="number"
                        value={newPlanData.monthlyPrice}
                        onChange={(e) => setNewPlanData({ ...newPlanData, monthlyPrice: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Yearly Price (BDT)</label>
                      <input
                        type="number"
                        value={newPlanData.yearlyPrice}
                        onChange={(e) => setNewPlanData({ ...newPlanData, yearlyPrice: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                        required
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsNewPlanModal(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg shadow-md"
                    >
                      Create Plan
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: PAYMENT MANAGEMENT
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <span className="text-xs text-slate-400">Monthly Success Revenue</span>
              <div className="text-xl font-bold text-emerald-400">
                ৳{(paymentStats?.monthlySuccessRevenue || 0).toLocaleString()}
              </div>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <span className="text-xs text-slate-400">Successful Transactions</span>
              <div className="text-xl font-bold text-white">{paymentStats?.monthlySuccessCount || 0}</div>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <span className="text-xs text-slate-400">Failed / Cancelled</span>
              <div className="text-xl font-bold text-rose-400">{paymentStats?.monthlyFailedCount || 0}</div>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <span className="text-xs text-slate-400">Average Transaction</span>
              <div className="text-xl font-bold text-purple-400">
                ৳{(paymentStats?.avgTransactionValue || 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-white text-sm">Platform Gateway Transactions</h3>
              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
              >
                <option value="">All Statuses</option>
                <option value="SUCCESS">Success</option>
                <option value="FAILED">Failed</option>
                <option value="PENDING">Pending</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs" aria-label="Billing transactions log">
                <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th scope="col" className="py-3 px-4">Transaction Code</th>
                    <th scope="col" className="py-3 px-4">Shop</th>
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
                      <td className="py-3 px-4 font-mono font-bold text-purple-400">{tx.transactionCode}</td>
                      <td className="py-3 px-4 font-semibold text-white">{tx.tenantId?.name || 'Unknown Shop'}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-800 font-bold text-[10px]">
                          {tx.provider}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {tx.planKey} ({tx.billingCycle})
                      </td>
                      <td className="py-3 px-4 font-black text-white">৳{tx.amount.toLocaleString()}</td>
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
                      <td className="py-3 px-4 text-slate-400">{new Date(tx.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 5: PLATFORM SETTINGS
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white">Platform System Configuration</h3>
              <p className="text-xs text-slate-400">
                Adjust global website variables, email servers, notifications, storage thresholds, and maintenance mode.
              </p>
            </div>
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-colors"
            >
              {savingSettings ? 'Saving...' : 'Save All Settings'}
            </button>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            {['WEBSITE', 'EMAIL', 'NOTIFICATION', 'STORAGE', 'SECURITY', 'MAINTENANCE'].map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setSettingsCategory(cat);
                  loadSettings(cat);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  settingsCategory === cat
                    ? 'bg-slate-800 text-purple-400 border border-purple-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Settings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {settings.map((item) => (
              <div key={item.key} className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-sm text-white">{item.label}</label>
                  <span className="font-mono text-[10px] text-slate-500">{item.key}</span>
                </div>
                <p className="text-xs text-slate-400">{item.description}</p>

                {item.type === 'BOOLEAN' ? (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSettingsEdits({
                          ...settingsEdits,
                          [item.key]: !settingsEdits[item.key],
                        })
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        settingsEdits[item.key]
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {settingsEdits[item.key] ? 'ENABLED' : 'DISABLED'}
                    </button>
                  </div>
                ) : (
                  <input
                    type={item.type === 'NUMBER' ? 'number' : 'text'}
                    value={settingsEdits[item.key] ?? ''}
                    onChange={(e) =>
                      setSettingsEdits({
                        ...settingsEdits,
                        [item.key]: item.type === 'NUMBER' ? Number(e.target.value) : e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 6: SECURITY AUDIT LOGS
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Platform Security & Audit Trail</h3>
              <p className="text-xs text-slate-400">
                Immutable trace of admin operations, subscription activations, suspensions, and security alerts.
              </p>
            </div>
            <button
              onClick={loadAuditLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Logs
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs" aria-label="System audit log trail">
                <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th scope="col" className="py-3 px-4">Timestamp</th>
                    <th scope="col" className="py-3 px-4">Action</th>
                    <th scope="col" className="py-3 px-4">Actor</th>
                    <th scope="col" className="py-3 px-4">Target Shop</th>
                    <th scope="col" className="py-3 px-4">Status</th>
                    <th scope="col" className="py-3 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {auditLogs.map((log) => (
                    <tr key={log._id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-purple-400">{log.action}</td>
                      <td className="py-3 px-4 text-slate-300">
                        {log.userId?.fullName || 'System Event'} ({log.userId?.role || 'SYSTEM'})
                      </td>
                      <td className="py-3 px-4 text-slate-400">{log.tenantId?.name || 'Global'}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.status === 'SUCCESS'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px] truncate max-w-xs">
                        {JSON.stringify(log.details || {})}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

