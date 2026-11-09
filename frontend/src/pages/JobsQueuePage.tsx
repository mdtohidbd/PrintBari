import React, { useState, useEffect } from 'react';
import {
  Layers,
  Search,
  Plus,
  Filter,
  Copy,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  FileText,
  User,
  Phone,
  DollarSign,
  Printer,
  ChevronRight,
  X,
  History,
  Upload,
  ArrowRight,
  Shield,
  Eye,
  FileCheck,
  Calendar,
} from 'lucide-react';
import { jobApi, JobRecord, JobStatus, JobServiceType, JobFile } from '../api/job.api';
import { customerApi, CustomerRecord, CustomerFile } from '../api/customer.api';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '../components/common/Card';
import { Tabs } from '../components/common/Tabs';
import { EmptyState } from '../components/common/EmptyState';
import { Toast } from '../components/common/Toast';

const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'All Jobs', value: 'ALL' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'New', value: 'NEW' },
  { label: 'Processing', value: 'PROCESSING' },
  { label: 'Ready for Review', value: 'READY_FOR_REVIEW' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Queued', value: 'QUEUED' },
  { label: 'Printing', value: 'PRINTING' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const SERVICE_TYPES: { label: string; value: JobServiceType }[] = [
  { label: 'Passport Photo Studio', value: 'PASSPORT_PHOTO' },
  { label: 'Document A4 Processing', value: 'DOCUMENT_A4' },
  { label: 'ID Card A4 Print', value: 'ID_CARD_A4' },
  { label: 'CV & Resume Builder', value: 'CV_BUILDER' },
  { label: 'Handwriting OCR', value: 'HANDWRITING_OCR' },
  { label: 'Custom Document Print', value: 'CUSTOM_PRINT' },
  { label: 'Lamination', value: 'LAMINATION' },
  { label: 'Photocopy & Xerox', value: 'PHOTOCOPY' },
];

export const JobsQueuePage: React.FC = () => {
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeStatus, setActiveStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [serviceFilter, setServiceFilter] = useState<string>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');

  // Job Details Drawer
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobDetail, setJobDetail] = useState<JobRecord | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [statusChangeNote, setStatusChangeNote] = useState<string>('');

  // New Job Modal
  const [isNewJobModalOpen, setIsNewJobModalOpen] = useState<boolean>(false);
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [matchedCustomer, setMatchedCustomer] = useState<CustomerRecord | null>(null);
  const [customerFiles, setCustomerFiles] = useState<CustomerFile[]>([]);
  const [selectedFilesToReuse, setSelectedFilesToReuse] = useState<CustomerFile[]>([]);

  // Job Form Data
  const [serviceType, setServiceType] = useState<JobServiceType>('CUSTOM_PRINT');
  const [priority, setPriority] = useState<'NORMAL' | 'URGENT'>('NORMAL');
  const [copies, setCopies] = useState<number>(1);
  const [paperType, setPaperType] = useState<string>('A4 Standard (80 GSM)');
  const [subtotal, setSubtotal] = useState<number>(50);
  const [discount, setDiscount] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(50);
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [jobNotes, setJobNotes] = useState<string>('');

  // Notification Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      const data = await jobApi.listJobs({
        status: activeStatus !== 'ALL' ? activeStatus : undefined,
        serviceType: serviceFilter !== 'ALL' ? serviceFilter : undefined,
        paymentStatus: paymentFilter !== 'ALL' ? paymentFilter : undefined,
        search: searchQuery || undefined,
        limit: 50,
      });
      setJobs(data.jobs);
    } catch (err: any) {
      showToast('Failed to fetch jobs queue', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [activeStatus, serviceFilter, paymentFilter, searchQuery]);

  const fetchJobDetail = async (id: string) => {
    setIsLoadingDetail(true);
    setSelectedJobId(id);
    try {
      const data = await jobApi.getJob(id);
      setJobDetail(data);
    } catch (err: any) {
      showToast('Failed to load job details', 'error');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Lookup customer when phone number entered
  const handlePhoneLookup = async (phone: string) => {
    setCustomerPhone(phone);
    if (phone.length >= 7) {
      try {
        const res = await customerApi.listCustomers({ search: phone.trim(), limit: 1 });
        if (res.customers && res.customers.length > 0) {
          const c = res.customers[0];
          setMatchedCustomer(c);
          setSelectedCustomerId(c._id);
          setCustomerName(c.fullName);
          setCustomerEmail(c.email || '');
          setCustomerFiles(c.fileLibrary || []);
        } else {
          setMatchedCustomer(null);
          setSelectedCustomerId(null);
          setCustomerFiles([]);
        }
      } catch (err) {
        // silent lookup failure
      }
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const finalPrice = Math.max(0, subtotal - discount);
      const uploadedFiles = selectedFilesToReuse.map((f, idx) => ({
        fileId: f.fileId,
        name: f.name,
        url: f.url,
        size: f.size || 0,
        mimeType: f.mimeType || 'application/octet-stream',
        version: 1,
        uploadedAt: new Date().toISOString(),
      }));

      const newJob = await jobApi.createJob({
        customerId: selectedCustomerId || undefined,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || undefined,
        serviceType,
        priority,
        copies,
        paperType,
        price: {
          subtotal,
          discount,
          tax: 0,
          totalPrice: finalPrice,
        },
        totalAmount: finalPrice,
        paidAmount,
        paymentMethod,
        uploadedFiles: uploadedFiles as any,
        notes: jobNotes,
        status: 'NEW',
      });

      showToast(`Job ${newJob.jobCode} created successfully!`);
      setIsNewJobModalOpen(false);
      resetNewJobForm();
      fetchJobs();
      fetchJobDetail(newJob._id);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to create job', 'error');
    }
  };

  const resetNewJobForm = () => {
    setCustomerPhone('');
    setCustomerName('');
    setCustomerEmail('');
    setSelectedCustomerId(null);
    setMatchedCustomer(null);
    setCustomerFiles([]);
    setSelectedFilesToReuse([]);
    setJobNotes('');
    setSubtotal(50);
    setDiscount(0);
    setPaidAmount(50);
  };

  const handleStatusTransition = async (newStatus: string) => {
    if (!jobDetail) return;
    try {
      const updated = await jobApi.updateStatus(jobDetail._id, newStatus, statusChangeNote || undefined);
      showToast(`Job transitioned to ${newStatus}`);
      setStatusChangeNote('');
      setJobDetail(updated);
      fetchJobs();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Status transition not permitted', 'error');
    }
  };

  const handleDuplicateJob = async (jobId: string) => {
    try {
      const duplicated = await jobApi.duplicateJob(jobId);
      showToast(`Job duplicated as ${duplicated.jobCode}!`);
      fetchJobs();
      fetchJobDetail(duplicated._id);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to duplicate job', 'error');
    }
  };

  const getJobStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'success' as const;
      case 'PRINTING':
      case 'QUEUED':
        return 'primary' as const;
      case 'PROCESSING':
        return 'warning' as const;
      case 'CANCELLED':
        return 'danger' as const;
      default:
        return 'neutral' as const;
    }
  };

  const getPaymentStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'success' as const;
      case 'PARTIAL':
        return 'warning' as const;
      default:
        return 'danger' as const;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 md:p-6 lg:p-8 space-y-6">
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-brand-500/10 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400 rounded-xl">
              <Layers className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Work Queue & Job Management
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                অর্ডার ট্র্যাকিং, স্ট্যাটাস ওয়ার্কফ্লো ও ফাইল প্রসেসিং সিস্টেম
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchJobs}
            isLoading={isLoading}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              resetNewJobForm();
              setIsNewJobModalOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            New Order (নতুন অর্ডার)
          </Button>
        </div>
      </div>

      {/* Status Workflow Tabs */}
      <div className="max-w-7xl mx-auto overflow-x-auto pb-1">
        <Tabs
          tabs={STATUS_TABS.map((t) => ({ id: t.value, label: t.label }))}
          activeTab={activeStatus}
          onChange={(id) => setActiveStatus(id)}
          variant="pills"
        />
      </div>

      {/* Search & Filter Controls */}
      <Card className="max-w-7xl mx-auto p-4 shadow-soft">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Job ID, customer name, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none transition"
            />
          </div>

          <div>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none transition"
            >
              <option value="ALL">All Services</option>
              {SERVICE_TYPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none transition"
            >
              <option value="ALL">All Payment Statuses</option>
              <option value="PAID">PAID (পরিশোধিত)</option>
              <option value="PARTIAL">PARTIAL (আংশিক)</option>
              <option value="UNPAID">UNPAID (বকেয়া)</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Main Grid: Job Queue Table + Job Detail Panel */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Table View */}
        <div className={selectedJobId ? 'lg:col-span-7' : 'lg:col-span-12'}>
          <Card className="overflow-hidden shadow-soft">
            {isLoading ? (
              <div className="py-24 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-brand-500" />
                <p className="text-xs font-medium">Loading jobs from queue...</p>
              </div>
            ) : jobs.length === 0 ? (
              <EmptyState
                icon={<Layers className="w-7 h-7" />}
                title="No jobs found in this queue"
                description="Try clearing your filters or create a new order."
                actionLabel="Create Order"
                onAction={() => {
                  resetNewJobForm();
                  setIsNewJobModalOpen(true);
                }}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse" aria-label="Jobs work queue">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                      <th scope="col" className="py-3 px-4">Job ID</th>
                      <th scope="col" className="py-3 px-4">Customer</th>
                      <th scope="col" className="py-3 px-4">Service</th>
                      <th scope="col" className="py-3 px-4">Status</th>
                      <th scope="col" className="py-3 px-4">Payment</th>
                      <th scope="col" className="py-3 px-4">Date</th>
                      <th scope="col" className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {jobs.map((job) => (
                      <tr
                        key={job._id}
                        tabIndex={0}
                        role="button"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            fetchJobDetail(job._id);
                          }
                        }}
                        onClick={() => fetchJobDetail(job._id)}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition focus:outline-none focus-visible:bg-slate-100 dark:focus-visible:bg-slate-800 ${
                          selectedJobId === job._id ? 'bg-brand-500/5 dark:bg-brand-500/10' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-brand-600 dark:text-brand-400 flex items-center gap-1.5">
                            {job.jobCode}
                            {job.priority === 'URGENT' && (
                              <Badge variant="danger" size="sm">
                                URGENT
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{job.customerName}</div>
                          <div className="text-[11px] text-slate-500">{job.customerPhone}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {job.serviceType}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge variant={getJobStatusBadgeVariant(job.status)} size="sm" dot>
                            {job.status}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100">৳ {job.totalAmount}</div>
                          <Badge variant={getPaymentStatusBadgeVariant(job.paymentStatus)} size="sm">
                            {job.paymentStatus}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                          {new Date(job.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleDuplicateJob(job._id)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                            title="Duplicate Job (নতুন জব হিসেবে কপি করুন)"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Job Detail & Workflow Action Drawer (Right 5 cols) */}
        {selectedJobId && (
          <div className="lg:col-span-5">
            <Card className="p-5 shadow-soft space-y-5 sticky top-20">
              <div className="flex items-start justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-bold text-brand-600 dark:text-brand-400">
                      {jobDetail?.jobCode}
                    </span>
                    {jobDetail?.status && (
                      <Badge variant={getJobStatusBadgeVariant(jobDetail.status)} size="sm">
                        {jobDetail.status}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {jobDetail?.serviceType} • Created {jobDetail && new Date(jobDetail.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedJobId(null)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Customer Details Card */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs space-y-1.5">
                <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {jobDetail?.customerName}
                  </span>
                  <span className="font-mono text-slate-500">{jobDetail?.customerPhone}</span>
                </div>
                {jobDetail?.notes && (
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 pt-1.5 border-t border-slate-200 dark:border-slate-800">
                    Notes: {jobDetail.notes}
                  </div>
                )}
              </div>

            {/* Workflow Status Actions */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Workflow Transitions
              </span>

              <div className="flex flex-wrap gap-1.5 text-xs">
                {jobDetail?.status === 'DRAFT' && (
                  <button
                    onClick={() => handleStatusTransition('NEW')}
                    className="px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded"
                  >
                    Submit as New →
                  </button>
                )}

                {jobDetail?.status === 'NEW' && (
                  <>
                    <button
                      onClick={() => handleStatusTransition('PROCESSING')}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded"
                    >
                      Start Processing →
                    </button>
                    <button
                      onClick={() => handleStatusTransition('QUEUED')}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded"
                    >
                      Queue for Print →
                    </button>
                  </>
                )}

                {jobDetail?.status === 'PROCESSING' && (
                  <>
                    <button
                      onClick={() => handleStatusTransition('READY_FOR_REVIEW')}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded"
                    >
                      Send for Review →
                    </button>
                    <button
                      onClick={() => handleStatusTransition('QUEUED')}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded"
                    >
                      Queue for Print →
                    </button>
                    <button
                      onClick={() => handleStatusTransition('COMPLETED')}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded"
                    >
                      Mark Completed ✓
                    </button>
                  </>
                )}

                {jobDetail?.status === 'READY_FOR_REVIEW' && (
                  <>
                    <button
                      onClick={() => handleStatusTransition('APPROVED')}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded"
                    >
                      Approve Proof ✓
                    </button>
                    <button
                      onClick={() => handleStatusTransition('PROCESSING')}
                      className="px-2.5 py-1 bg-slate-600 text-white font-bold rounded"
                    >
                      Request Revision
                    </button>
                  </>
                )}

                {jobDetail?.status === 'APPROVED' && (
                  <button
                    onClick={() => handleStatusTransition('QUEUED')}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded"
                  >
                    Send to Spooler →
                  </button>
                )}

                {jobDetail?.status === 'QUEUED' && (
                  <button
                    onClick={() => handleStatusTransition('PRINTING')}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded flex items-center gap-1"
                  >
                    <Printer className="w-3 h-3" />
                    Printing Now →
                  </button>
                )}

                {jobDetail?.status === 'PRINTING' && (
                  <button
                    onClick={() => handleStatusTransition('COMPLETED')}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded"
                  >
                    Mark Job Completed ✓
                  </button>
                )}

                {jobDetail?.status !== 'CANCELLED' && jobDetail?.status !== 'COMPLETED' && (
                  <button
                    onClick={() => handleStatusTransition('CANCELLED')}
                    className="px-2 py-1 border border-rose-300 dark:border-rose-900 text-rose-600 rounded text-xs"
                  >
                    Cancel Job
                  </button>
                )}
              </div>
            </div>

            {/* Files Attached & Versions */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Job Files (আপলোড ও প্রসেসকৃত ফাইল)
              </span>

              {(!jobDetail?.uploadedFiles || jobDetail.uploadedFiles.length === 0) &&
              (!jobDetail?.processedFiles || jobDetail.processedFiles.length === 0) ? (
                <p className="text-xs text-slate-400">No files attached to this job.</p>
              ) : (
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                  {jobDetail?.uploadedFiles?.map((f, i) => (
                    <div
                      key={i}
                      className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-blue-500" />
                        <span className="truncate max-w-[160px]">{f.name}</span>
                        <span className="text-[10px] text-slate-400">v{f.version}</span>
                      </div>
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-brand-600 font-bold hover:underline"
                      >
                        Download
                      </a>
                    </div>
                  ))}
                  {jobDetail?.processedFiles?.map((f, i) => (
                    <div
                      key={i}
                      className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="truncate max-w-[160px]">{f.name}</span>
                        <span className="text-[10px] text-emerald-600 font-bold">Processed</span>
                      </div>
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-brand-600 font-bold hover:underline"
                      >
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Activity Logs & History Timeline */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Activity History & Audit Log
              </span>
              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                {jobDetail?.activityLogs?.map((act, i) => (
                  <div key={i} className="text-xs p-2 bg-slate-50 dark:bg-slate-800/30 rounded border-l-2 border-brand-500">
                    <div className="flex items-center justify-between font-semibold">
                      <span>{act.action}</span>
                      <span className="text-[10px] text-slate-400">{new Date(act.timestamp).toLocaleTimeString()}</span>
                    </div>
                    {act.note && <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">{act.note}</div>}
                    <div className="text-[10px] text-slate-400 mt-0.5">By: {act.changedByName}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions: Duplicate Job */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => jobDetail && handleDuplicateJob(jobDetail._id)}
                leftIcon={<Copy className="w-3.5 h-3.5" />}
              >
                Duplicate as New Job
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>

      {/* MODAL: CREATE NEW WALK-IN ORDER */}
      {isNewJobModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-xl w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base">New Walk-in Job Order (নতুন কাস্টমার অর্ডার)</h3>
              <button onClick={() => setIsNewJobModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="space-y-4 text-xs">
              {/* Customer Lookup & Profile */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border space-y-3">
                <span className="font-bold uppercase tracking-wider text-slate-500 block">
                  1. Customer Details (গ্রাহকের তথ্য)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold block mb-1">Mobile Phone *</label>
                    <input
                      type="text"
                      required
                      placeholder="017XXXXXXXX"
                      value={customerPhone}
                      onChange={(e) => handlePhoneLookup(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-semibold block mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Customer Name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg focus:outline-none"
                    />
                  </div>
                </div>

                {matchedCustomer && (
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded border border-emerald-200 text-emerald-800 dark:text-emerald-300 flex items-center justify-between text-[11px]">
                    <span>✓ Existing Customer: {matchedCustomer.totalOrdersCount} previous orders</span>
                    {customerFiles.length > 0 && <span>{customerFiles.length} files in library</span>}
                  </div>
                )}

                {/* Reuse Previous Files Selector */}
                {customerFiles.length > 0 && (
                  <div>
                    <label className="font-semibold block mb-1 text-slate-600 dark:text-slate-400">
                      Reuse Files from Customer Library:
                    </label>
                    <div className="flex flex-wrap gap-2 max-h-[80px] overflow-y-auto">
                      {customerFiles.map((file) => {
                        const isSelected = selectedFilesToReuse.some((f) => f.fileId === file.fileId);
                        return (
                          <button
                            key={file.fileId}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setSelectedFilesToReuse(selectedFilesToReuse.filter((f) => f.fileId !== file.fileId));
                              } else {
                                setSelectedFilesToReuse([...selectedFilesToReuse, file]);
                              }
                            }}
                            className={`px-2.5 py-1 rounded border text-[11px] font-medium transition ${
                              isSelected
                                ? 'bg-brand-600 text-white border-brand-600'
                                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            {isSelected ? '✓ ' : '+ '}
                            {file.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Service & Options */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border space-y-3">
                <span className="font-bold uppercase tracking-wider text-slate-500 block">
                  2. Service & Specifications
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold block mb-1">Service Type *</label>
                    <select
                      value={serviceType}
                      onChange={(e) => setServiceType(e.target.value as JobServiceType)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg focus:outline-none"
                    >
                      {SERVICE_TYPES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold block mb-1">Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg focus:outline-none"
                    >
                      <option value="NORMAL">Normal Priority</option>
                      <option value="URGENT">Urgent (জরুরী ডেলিভারি)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold block mb-1">Copies (কপি সংখ্যা)</label>
                    <input
                      type="number"
                      min="1"
                      value={copies}
                      onChange={(e) => setCopies(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-semibold block mb-1">Paper Type</label>
                    <input
                      type="text"
                      value={paperType}
                      onChange={(e) => setPaperType(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Price & Payment */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border space-y-3">
                <span className="font-bold uppercase tracking-wider text-slate-500 block">
                  3. Pricing & Payment
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold block mb-1">Subtotal (৳)</label>
                    <input
                      type="number"
                      value={subtotal}
                      onChange={(e) => setSubtotal(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg focus:outline-none font-bold"
                    />
                  </div>

                  <div>
                    <label className="font-semibold block mb-1">Discount (৳)</label>
                    <input
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-semibold block mb-1">Paid Amount (৳)</label>
                    <input
                      type="number"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg focus:outline-none font-bold text-emerald-600"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t">
                  <span className="text-slate-500">
                    Net Total: <strong className="text-slate-900 dark:text-slate-100">৳ {Math.max(0, subtotal - discount)}</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Method:</span>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="px-2 py-1 bg-white dark:bg-slate-900 border rounded font-semibold text-xs"
                    >
                      <option value="CASH">Cash (নগদ)</option>
                      <option value="BKASH">bKash (বিকাশ)</option>
                      <option value="NAGAD">Nagad (নগদ)</option>
                      <option value="CARD">Card</option>
                      <option value="DUE">Due (বকেয়া)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Internal Notes</label>
                <textarea
                  rows={2}
                  value={jobNotes}
                  onChange={(e) => setJobNotes(e.target.value)}
                  placeholder="Special instructions for printer or operator..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-lg focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsNewJobModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                >
                  Create Job Order
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

