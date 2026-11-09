import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardApi, DashboardMetricsResponse } from '../api/dashboard.api';
import { jobApi } from '../api/job.api';
import { useAppStore } from '../store/useAppStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { CardSkeleton } from '../components/common/Skeleton';
import { ErrorState } from '../components/common/ErrorState';
import { QuickOrderModal } from '../components/dashboard/QuickOrderModal';
import {
  Layers,
  Clock,
  CheckCircle2,
  DollarSign,
  Users,
  HardDrive,
  Plus,
  RefreshCw,
  Camera,
  CreditCard,
  FileText,
  FileSpreadsheet,
  PenTool,
  Printer,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Zap,
  ShoppingBag,
  ArrowUpRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { currentUser, currentTenant } = useAppStore();
  const [quickOrderOpen, setQuickOrderOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Fetch Live Metrics from backend API
  const {
    data: metricsResponse,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: dashboardApi.getMetrics,
    refetchInterval: 15000, // Poll every 15s for live counter updates
  });

  // Demo Data Seeder Mutation
  const seedDemoMutation = useMutation({
    mutationFn: dashboardApi.seedDemoData,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    },
  });

  // Job Status Update Mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ jobId, status }: { jobId: string; status: string }) =>
      jobApi.updateStatus(jobId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    },
  });

  const data = metricsResponse?.data;
  const metrics = data?.metrics;
  const storage = data?.storage;
  const statusDist = data?.statusDistribution;
  const recentJobs = data?.recentJobs || [];
  const recentActivities = data?.recentActivities || [];

  // Filtered recent jobs
  const displayedJobs =
    statusFilter === 'ALL'
      ? recentJobs
      : recentJobs.filter((j: any) => j.status === statusFilter);

  // Status Badge Mapper
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'PRINT_READY':
        return 'primary';
      case 'PROCESSING':
        return 'warning';
      case 'REVIEW':
      case 'READY_FOR_REVIEW':
        return 'warning';
      case 'CANCELLED':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  const studioShortcuts = [
    {
      title: 'Passport Photo',
      desc: 'Auto 300 DPI crop & 8-up cut sheet',
      icon: Camera,
      path: '/studio/passport',
      color: 'bg-blue-50 text-blue-600 border-blue-200/80 hover:border-blue-300',
      tag: 'Presets',
    },
    {
      title: 'Document A4',
      desc: 'Magic color filter, binarize & multipage PDF',
      icon: FileText,
      path: '/studio/document',
      color: 'bg-emerald-50 text-emerald-600 border-emerald-200/80 hover:border-emerald-300',
      tag: 'Vector',
    },
    {
      title: 'ID Card Studio',
      desc: 'Dual Smart NID front/back layout',
      icon: CreditCard,
      path: '/studio/id-card',
      color: 'bg-purple-50 text-purple-600 border-purple-200/80 hover:border-purple-300',
      tag: 'CR-80',
    },
    {
      title: 'CV & Bio-Data',
      desc: 'Mustache variable injection & print letters',
      icon: FileSpreadsheet,
      path: '/studio/cv',
      color: 'bg-amber-50 text-amber-600 border-amber-200/80 hover:border-amber-300',
      tag: 'Templates',
    },
    {
      title: 'Handwriting OCR',
      desc: 'Optical Bengali & English extraction to Docx',
      icon: PenTool,
      path: '/studio/ocr',
      color: 'bg-pink-50 text-pink-600 border-pink-200/80 hover:border-pink-300',
      tag: 'Tesseract',
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fadeIn">
      {/* 1. Header Bar & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
              Studio Counter & Pipeline
            </h1>
            <Badge variant="primary" size="sm" dot>
              {data?.shop.plan || currentTenant?.plan || 'PRO'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time shop pipeline monitoring for walk-in document intake, studio processing, and hardware printing.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            isLoading={isFetching}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>

          {(!recentJobs || recentJobs.length === 0) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => seedDemoMutation.mutate()}
              isLoading={seedDemoMutation.isPending}
              leftIcon={<Sparkles className="w-3.5 h-3.5 text-amber-500" />}
            >
              Seed Demo
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => setQuickOrderOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            New Walk-In Order
          </Button>
        </div>
      </div>

      {/* 2. Loading State */}
      {isLoading && <CardSkeleton count={4} />}

      {/* 3. Error State */}
      {isError && (
        <ErrorState
          title="Could not connect to shop database"
          message={(error as any)?.message || 'Please check your connection and verify the backend API is running.'}
          onRetry={() => refetch()}
          isRetrying={isFetching}
        />
      )}

      {/* 4. KPI Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Active Orders */}
          <Card className="p-5 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Pending in Pipeline
              </span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {metrics.pendingJobs}
              </span>
              <span className="text-xs text-blue-600 font-semibold flex items-center">
                <TrendingUp className="w-3 h-3 mr-0.5" /> Live
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Pending, processing, or printing</p>
          </Card>

          {/* Today's Revenue */}
          <Card className="p-5 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Today's Revenue
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                ${(metrics.todayRevenue ?? 0).toFixed(2)}
              </span>
              <span className="text-xs text-emerald-600 font-semibold flex items-center">
                Cash + Digital
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Monthly Total: ${(metrics.monthlyRevenue ?? 0).toFixed(2)}
            </p>
          </Card>

          {/* Completed Jobs */}
          <Card className="p-5 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Completed Orders
              </span>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {metrics.completedJobs}
              </span>
              <span className="text-xs text-indigo-600 font-semibold">
                of {metrics.totalJobs} Total
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">100% fulfillment quality checked</p>
          </Card>

          {/* Storage Consumption */}
          <Card className="p-5 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Cloud Storage
              </span>
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-xs">
                <HardDrive className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {storage ? `${storage.usedMB} MB` : '320 MB'}
              </span>
              <span className="text-xs text-purple-600 font-semibold">
                of {storage?.limitGB || '25'} GB
              </span>
            </div>
            <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-purple-600 h-1.5 rounded-full"
                style={{ width: `${Math.min(100, storage?.percentUsed || 15)}%` }}
              />
            </div>
          </Card>
        </div>
      )}

      {/* 5. Studio Quick Launchers */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-brand-600" /> Dedicated Studio Processing Engines
          </h2>
          <span className="text-xs text-slate-400">Direct 300 DPI hardware rasterizers</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {studioShortcuts.map((st) => {
            const Icon = st.icon;
            return (
              <Link
                key={st.path}
                to={st.path}
                className="p-4 rounded-2xl border bg-white shadow-xs hover:shadow-card hover:-translate-y-0.5 transition-all duration-150 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${st.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      {st.tag}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                    {st.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {st.desc}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-brand-600 group-hover:translate-x-0.5 transition-transform">
                  <span>Open Studio</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 6. Active Order Pipeline & Recent Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders Table (2 Cols) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Recent Orders & Status</CardTitle>
              <CardDescription>Live intake queue across all counter services</CardDescription>
            </div>

            {/* Quick Status Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              {['ALL', 'PROCESSING', 'PRINT_READY', 'COMPLETED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    statusFilter === st
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {st.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {displayedJobs.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">No orders in this status category.</p>
                <p className="text-xs text-slate-400 mt-1">Intake a customer to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse" aria-label="Recent orders table">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider">
                      <th scope="col" className="py-3 px-4">Order Code</th>
                      <th scope="col" className="py-3 px-4">Customer</th>
                      <th scope="col" className="py-3 px-4">Service</th>
                      <th scope="col" className="py-3 px-4">Amount</th>
                      <th scope="col" className="py-3 px-4">Status</th>
                      <th scope="col" className="py-3 px-4 text-right">Transition</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {displayedJobs.map((job: any) => (
                      <tr key={job._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {job.jobCode}
                          {job.priority === 'URGENT' && (
                            <span className="ml-1 text-[9px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.2 rounded">
                              RUSH
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900">{job.customerName}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{job.customerPhone}</p>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-600">
                          {job.serviceType.replace(/_/g, ' ')}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900">
                            ${job.totalAmount.toFixed(2)}
                          </span>
                          <span
                            className={`block text-[10px] font-bold ${
                              job.paymentStatus === 'PAID'
                                ? 'text-emerald-600'
                                : 'text-amber-600'
                            }`}
                          >
                            {job.paymentStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={getStatusBadgeVariant(job.status)} size="sm">
                            {job.status.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <select
                            value={job.status}
                            onChange={(e) =>
                              updateStatusMutation.mutate({
                                jobId: job._id,
                                status: e.target.value,
                              })
                            }
                            className="bg-white border border-slate-200 rounded-lg text-xs py-1 px-2 focus:outline-none focus:ring-1 focus:ring-brand-500 font-semibold cursor-pointer"
                          >
                            <option value="NEW">New</option>
                            <option value="PROCESSING">Processing</option>
                            <option value="REVIEW">Review</option>
                            <option value="PRINT_READY">Print Ready</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="CANCELLED">Cancelled</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>

          <CardFooter>
            <span className="text-slate-400">Showing recent 10 intake orders</span>
            <Link to="/queue" className="font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1">
              <span>Open Work Queue Kanban</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </CardFooter>
        </Card>

        {/* Recent Audit Activities Feed (1 Col) */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Recent Shop Activity</CardTitle>
            <CardDescription>Security audit log & operator actions</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3.5 flex-1 overflow-y-auto max-h-[420px]">
            {recentActivities.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-12">No recent audit logs.</p>
            ) : (
              recentActivities.map((act: any) => (
                <div key={act._id} className="flex items-start gap-3 text-xs border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="font-bold text-slate-900 truncate">
                      {act.action.replace(/_/g, ' ')}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Operator: <span className="font-semibold">{act.userId?.fullName || 'Shop Staff'}</span>
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                    {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </CardContent>

          <CardFooter>
            <Link to="/settings" className="text-xs font-bold text-brand-600 hover:underline">
              Manage Staff & Shop Hours →
            </Link>
          </CardFooter>
        </Card>
      </div>

      {/* Quick Order Intake Modal */}
      <QuickOrderModal
        isOpen={quickOrderOpen}
        onClose={() => setQuickOrderOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
        }}
      />
    </div>
  );
};
