import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  Calendar,
  FileText,
  FolderOpen,
  Edit2,
  Trash2,
  X,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Clock,
  ArrowRight,
  Upload,
} from 'lucide-react';
import { customerApi, CustomerRecord, CustomerDetailRecord, CustomerFile } from '../api/customer.api';
import { Button } from '../components/common/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Tabs } from '../components/common/Tabs';
import { EmptyState } from '../components/common/EmptyState';
import { Toast } from '../components/common/Toast';

export const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Profile modal / drawer
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerDetailRecord | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(false);
  const [activeProfileTab, setActiveProfileTab] = useState<'details' | 'jobs' | 'files'>('details');

  // Add / Edit Modal
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  });

  // Add File Modal for Customer File Library
  const [isAddFileModalOpen, setIsAddFileModalOpen] = useState<boolean>(false);
  const [newFileData, setNewFileData] = useState({
    name: '',
    url: '',
    mimeType: 'image/jpeg',
  });

  // Notification Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const data = await customerApi.listCustomers({
        search: searchQuery || undefined,
        page,
        limit: 15,
      });
      setCustomers(data.customers);
      setTotalPages(data.pagination.totalPages);
      setTotalCount(data.pagination.total);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to fetch customers list', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [page, searchQuery]);

  const fetchCustomerProfile = async (id: string) => {
    setIsLoadingProfile(true);
    setSelectedCustomerId(id);
    try {
      const data = await customerApi.getCustomer(id);
      setCustomerProfile(data);
    } catch (err: any) {
      showToast('Failed to load customer profile', 'error');
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setFormData({ fullName: '', phone: '', email: '', address: '', notes: '' });
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (c: CustomerRecord) => {
    setEditingCustomer(c);
    setFormData({
      fullName: c.fullName,
      phone: c.phone,
      email: c.email || '',
      address: c.address || '',
      notes: c.notes || '',
    });
    setIsFormModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await customerApi.updateCustomer(editingCustomer._id, formData);
        showToast('Customer profile updated successfully');
      } else {
        await customerApi.createCustomer(formData);
        showToast('Customer created successfully');
      }
      setIsFormModalOpen(false);
      fetchCustomers();
      if (selectedCustomerId && editingCustomer && selectedCustomerId === editingCustomer._id) {
        fetchCustomerProfile(selectedCustomerId);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save customer', 'error');
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this customer record?')) return;
    try {
      await customerApi.deleteCustomer(id);
      showToast('Customer removed');
      if (selectedCustomerId === id) setSelectedCustomerId(null);
      fetchCustomers();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to delete customer', 'error');
    }
  };

  const handleAddFileToLibrary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) return;
    try {
      await customerApi.addCustomerFile(selectedCustomerId, newFileData);
      showToast('File added to customer library');
      setIsAddFileModalOpen(false);
      setNewFileData({ name: '', url: '', mimeType: 'image/jpeg' });
      fetchCustomerProfile(selectedCustomerId);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to add file', 'error');
    }
  };

  const handleDeleteFileFromLibrary = async (fileId: string) => {
    if (!selectedCustomerId) return;
    try {
      await customerApi.deleteCustomerFile(selectedCustomerId, fileId);
      showToast('File removed from library');
      fetchCustomerProfile(selectedCustomerId);
    } catch (err: any) {
      showToast('Failed to delete file', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 md:p-6 lg:p-8 space-y-6">
      {/* Toast Alert */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Top Banner & Stats */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-brand-500/10 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400 rounded-xl">
              <Users className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Customer CRM & File Library
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                গ্রাহক তালিকা, বিগত অর্ডারের ইতিহাস ও ফাইল লাইব্রেরি ম্যানেজমেন্ট
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCustomers}
            isLoading={isLoading}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAddModal}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Customer (নতুন গ্রাহক)
          </Button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <Card className="max-w-7xl mx-auto p-4 shadow-soft">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, mobile number, or email..."
              aria-label="Search by name, mobile number, or email"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
            />
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <span>Total Customers:</span>
            <Badge variant="primary" size="sm">
              {totalCount}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Main Table & Profile Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Customer List */}
        <div className={selectedCustomerId ? 'lg:col-span-7' : 'lg:col-span-12'}>
          <Card className="overflow-hidden shadow-soft">
            {isLoading ? (
              <div className="py-24 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-brand-500" />
                <p className="text-xs font-medium">Loading customers directory...</p>
              </div>
            ) : customers.length === 0 ? (
              <EmptyState
                icon={<Users className="w-7 h-7" />}
                title="No customers found"
                description="Add your first customer or try adjusting your search terms."
                actionLabel="Add Customer"
                onAction={handleOpenAddModal}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse" aria-label="Customers directory">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                      <th scope="col" className="py-3 px-4">Customer</th>
                      <th scope="col" className="py-3 px-4">Contact</th>
                      <th scope="col" className="py-3 px-4">Orders</th>
                      <th scope="col" className="py-3 px-4">Total Spent</th>
                      <th scope="col" className="py-3 px-4">Last Visit</th>
                      <th scope="col" className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {customers.map((c) => (
                      <tr
                        key={c._id}
                        tabIndex={0}
                        role="button"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            fetchCustomerProfile(c._id);
                          }
                        }}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition focus:outline-none focus-visible:bg-slate-100 dark:focus-visible:bg-slate-800 ${
                          selectedCustomerId === c._id ? 'bg-brand-500/5 dark:bg-brand-500/10' : ''
                        }`}
                        onClick={() => fetchCustomerProfile(c._id)}
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{c.fullName}</div>
                          {c.address && (
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate max-w-[180px]">
                              <MapPin className="w-3 h-3 flex-shrink-0 text-slate-400" />
                              {c.address}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {c.phone}
                          </div>
                          {c.email && (
                            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <Mail className="w-3 h-3 text-slate-400" />
                              {c.email}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-700 dark:text-slate-300">
                          {c.totalOrdersCount}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                          ৳ {c.totalSpent.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                          {new Date(c.lastVisitAt).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEditModal(c)}
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition focus:outline-none focus:ring-2 focus:ring-brand-500"
                              title="Edit Customer"
                              aria-label={`Edit customer ${c.fullName}`}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCustomer(c._id)}
                              className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-rose-500 hover:text-rose-700 transition focus:outline-none focus:ring-2 focus:ring-rose-500"
                              title="Delete Customer"
                              aria-label={`Delete customer ${c.fullName}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="xs"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Customer Profile Drawer / Details Panel (Right 5 cols) */}
        {selectedCustomerId && (
          <div className="lg:col-span-5">
            <Card className="p-5 shadow-soft space-y-4 sticky top-20">
              <div className="flex items-start justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {customerProfile?.fullName || 'Customer Profile'}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                    <span className="font-mono">{customerProfile?.phone}</span>
                    {customerProfile?.email && <span>• {customerProfile?.email}</span>}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCustomerId(null)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Profile Tabs */}
              <Tabs
                tabs={[
                  { id: 'details', label: 'Profile & Notes' },
                  { id: 'jobs', label: `Jobs (${customerProfile?.recentJobs?.length || 0})` },
                  { id: 'files', label: `Files (${customerProfile?.fileLibrary?.length || 0})` },
                ]}
                activeTab={activeProfileTab}
                onChange={(id) => setActiveProfileTab(id as any)}
                variant="underline"
              />

            {/* Tab: Details */}
            {activeProfileTab === 'details' && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                  <div>
                    <span className="text-slate-500 block">Total Lifetime Orders:</span>
                    <span className="font-bold text-sm">{customerProfile?.totalOrdersCount || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Total Spent:</span>
                    <span className="font-bold text-sm text-emerald-600">
                      ৳ {(customerProfile?.totalSpent || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 block font-semibold mb-1">Address:</span>
                  <p className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-slate-700 dark:text-slate-300">
                    {customerProfile?.address || 'No address provided'}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500 block font-semibold mb-1">Customer Notes (দোকানের মন্তব্য):</span>
                  <p className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {customerProfile?.notes || 'No customer notes recorded.'}
                  </p>
                </div>
              </div>
            )}

            {/* Tab: Previous Jobs */}
            {activeProfileTab === 'jobs' && (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {!customerProfile?.recentJobs || customerProfile.recentJobs.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No orders recorded yet for this customer.</p>
                ) : (
                  customerProfile.recentJobs.map((j) => (
                    <div
                      key={j._id}
                      className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-mono font-bold text-brand-600 dark:text-brand-400">{j.jobCode}</div>
                        <div className="text-[11px] text-slate-500">{j.serviceType} • {new Date(j.createdAt).toLocaleDateString()}</div>
                      </div>
                      <div className="text-right">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700">
                          {j.status}
                        </span>
                        <div className="font-bold text-slate-800 dark:text-slate-200 mt-1">৳ {j.totalAmount}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab: File Library */}
            {activeProfileTab === 'files' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Saved Documents & Photos
                  </span>
                  <button
                    onClick={() => setIsAddFileModalOpen(true)}
                    className="px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded text-[11px] font-bold flex items-center gap-1"
                  >
                    <Upload className="w-3 h-3" />
                    Add File
                  </button>
                </div>

                {!customerProfile?.fileLibrary || customerProfile.fileLibrary.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No files stored in customer library yet.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                    {customerProfile.fileLibrary.map((file) => (
                      <div
                        key={file.fileId}
                        className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-brand-500 flex-shrink-0" />
                          <div>
                            <div className="font-medium truncate max-w-[180px]">{file.name}</div>
                            <div className="text-[10px] text-slate-500">
                              {file.sourceJobCode ? `Source: ${file.sourceJobCode}` : 'Uploaded'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-0.5 bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300 rounded text-[10px] font-bold hover:underline"
                          >
                            View
                          </a>
                          <button
                            onClick={() => handleDeleteFileFromLibrary(file.fileId)}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                            title="Remove file"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>

      {/* MODAL: ADD / EDIT CUSTOMER */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base">
                {editingCustomer ? 'Edit Customer Information' : 'Add New Customer (নতুন গ্রাহক)'}
              </h3>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Customer Full Name / নাম *</label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="e.g. Md. Zahid Hasan"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-lg focus:ring-1 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Mobile Number / ফোন নম্বর *</label>
                <input
                  type="text"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="017XXXXXXXX"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-lg focus:ring-1 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Email (Optional)</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="zahid@example.com"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-lg focus:ring-1 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Address / ঠিকানা</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="House 12, Road 4, Mirpur, Dhaka"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-lg focus:ring-1 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Customer Notes (মন্তব্য)</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Preferred paper quality, VIP customer notes..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-lg focus:ring-1 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsFormModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                >
                  Save Customer
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD FILE TO LIBRARY */}
      {isAddFileModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm">Add File to Customer Library</h3>
              <button onClick={() => setIsAddFileModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddFileToLibrary} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">File Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. NID_Front_Scan.jpg"
                  value={newFileData.name}
                  onChange={(e) => setNewFileData({ ...newFileData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">File URL / Base64</label>
                <input
                  type="text"
                  required
                  placeholder="https://... or data:image/..."
                  value={newFileData.url}
                  onChange={(e) => setNewFileData({ ...newFileData, url: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-[11px]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddFileModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                >
                  Save File
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

