import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantApi } from '../api/tenant.api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Badge } from '../components/common/Badge';
import {
  Store,
  MapPin,
  Clock,
  FileText,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Save,
  ShieldCheck,
  Building,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'profile' | 'hours' | 'invoice' | 'print'>('profile');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 1. Fetch current shop settings
  const { data: tenantResponse, isLoading, isError, refetch } = useQuery({
    queryKey: ['shop-settings'],
    queryFn: tenantApi.getCurrentShop,
  });

  const tenant = tenantResponse?.data;

  // Form states
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    email: '',
    logoUrl: '',
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
  });

  const [hoursForm, setHoursForm] = useState<any>({});
  const [invoiceForm, setInvoiceForm] = useState<any>({});
  const [printForm, setPrintForm] = useState<any>({});

  // Sync state when data loads
  useEffect(() => {
    if (tenant) {
      setProfileForm({
        name: tenant.name || '',
        phone: tenant.phone || '',
        email: tenant.email || '',
        logoUrl: tenant.logoUrl || '',
        street: tenant.address?.street || '',
        city: tenant.address?.city || '',
        state: tenant.address?.state || '',
        postalCode: tenant.address?.postalCode || '',
        country: tenant.address?.country || '',
      });
      setHoursForm(tenant.workingHours || {});
      setInvoiceForm(tenant.invoiceSettings || {});
      setPrintForm(tenant.printSettings || {});
    }
  }, [tenant]);

  // Mutations
  const updateProfileMutation = useMutation({
    mutationFn: tenantApi.updateProfile,
    onSuccess: () => {
      setFeedbackMsg({ type: 'success', text: 'Shop profile & address saved successfully' });
      queryClient.invalidateQueries({ queryKey: ['shop-settings'] });
    },
    onError: (err: any) => {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to update profile' });
    },
  });

  const updateHoursMutation = useMutation({
    mutationFn: tenantApi.updateWorkingHours,
    onSuccess: () => {
      setFeedbackMsg({ type: 'success', text: 'Working hours schedule updated' });
      queryClient.invalidateQueries({ queryKey: ['shop-settings'] });
    },
  });

  const updateInvoiceMutation = useMutation({
    mutationFn: tenantApi.updateInvoiceSettings,
    onSuccess: () => {
      setFeedbackMsg({ type: 'success', text: 'Invoice settings updated' });
      queryClient.invalidateQueries({ queryKey: ['shop-settings'] });
    },
  });

  const updatePrintMutation = useMutation({
    mutationFn: tenantApi.updatePrintSettings,
    onSuccess: () => {
      setFeedbackMsg({ type: 'success', text: 'Print preferences updated' });
      queryClient.invalidateQueries({ queryKey: ['shop-settings'] });
    },
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate({
      name: profileForm.name,
      phone: profileForm.phone,
      email: profileForm.email,
      logoUrl: profileForm.logoUrl,
      address: {
        street: profileForm.street,
        city: profileForm.city,
        state: profileForm.state,
        postalCode: profileForm.postalCode,
        country: profileForm.country,
      },
    });
  };

  const handleHoursSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateHoursMutation.mutate(hoursForm);
  };

  const handleInvoiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateInvoiceMutation.mutate(invoiceForm);
  };

  const handlePrintSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updatePrintMutation.mutate(printForm);
  };

  const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4 animate-pulse">
        <div className="h-10 bg-slate-200 rounded-lg w-1/3" />
        <div className="h-96 bg-slate-200 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Shop Profile & Business Settings
            </h1>
            <Badge variant="primary" size="sm">
              {tenant?.businessId}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Configure your digital studio brand, working schedule, thermal invoice receipts, and printer hardware.
          </p>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center justify-between border ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} className="font-bold text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-200 gap-2 overflow-x-auto text-sm font-medium">
        {[
          { id: 'profile', label: 'Shop Profile & Address', icon: Store },
          { id: 'hours', label: 'Working Hours', icon: Clock },
          { id: 'invoice', label: 'Invoice & Tax Settings', icon: FileText },
          { id: 'print', label: 'Hardware Print Defaults', icon: Printer },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Profile & Address */}
      {activeTab === 'profile' && (
        <form onSubmit={handleProfileSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Shop Identification</CardTitle>
                <CardDescription>Primary branding visible to walk-in customers</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Shop Name *"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  required
                />
                <Input
                  label="Shop Subdomain (Read-Only)"
                  value={tenant?.subdomain || ''}
                  disabled
                  helperText="Unique tenant identifier for your store"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Contact Phone / WhatsApp"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  placeholder="+1 555 123 4567"
                />
                <Input
                  label="Support Email"
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  placeholder="contact@yourshop.com"
                />
              </div>

              <Input
                label="Logo Image URL"
                value={profileForm.logoUrl}
                onChange={(e) => setProfileForm({ ...profileForm, logoUrl: e.target.value })}
                placeholder="https://example.com/logo.png"
                helperText="Provide a direct URL to your logo (rendered on invoices and customer receipts)"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Physical Store Location</CardTitle>
                <CardDescription>Printed on receipts and legal invoices</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Street Address"
                value={profileForm.street}
                onChange={(e) => setProfileForm({ ...profileForm, street: e.target.value })}
                placeholder="Shop #12, Ground Floor, Central Plaza"
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Input
                  label="City"
                  value={profileForm.city}
                  onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                />
                <Input
                  label="State / Province"
                  value={profileForm.state}
                  onChange={(e) => setProfileForm({ ...profileForm, state: e.target.value })}
                />
                <Input
                  label="Postal Code"
                  value={profileForm.postalCode}
                  onChange={(e) => setProfileForm({ ...profileForm, postalCode: e.target.value })}
                />
                <Input
                  label="Country"
                  value={profileForm.country}
                  onChange={(e) => setProfileForm({ ...profileForm, country: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              type="submit"
              isLoading={updateProfileMutation.isPending}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Save Shop Profile
            </Button>
          </div>
        </form>
      )}

      {/* TAB 2: Working Hours */}
      {activeTab === 'hours' && (
        <form onSubmit={handleHoursSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Weekly Working Hours Schedule</CardTitle>
                <CardDescription>
                  Define store operating hours for customer receipt estimates
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {daysOfWeek.map((day) => {
                const dayData = hoursForm[day] || { open: '09:00', close: '20:00', isOpen: true };
                return (
                  <div
                    key={day}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50 gap-3"
                  >
                    <div className="w-32 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={dayData.isOpen}
                        onChange={(e) =>
                          setHoursForm({
                            ...hoursForm,
                            [day]: { ...dayData, isOpen: e.target.checked },
                          })
                        }
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="capitalize font-semibold text-xs sm:text-sm text-slate-800">
                        {day}
                      </span>
                    </div>

                    {dayData.isOpen ? (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500">Opens:</span>
                        <input
                          type="time"
                          value={dayData.open}
                          onChange={(e) =>
                            setHoursForm({
                              ...hoursForm,
                              [day]: { ...dayData, open: e.target.value },
                            })
                          }
                          className="bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                        />
                        <span className="text-slate-500 ml-2">Closes:</span>
                        <input
                          type="time"
                          value={dayData.close}
                          onChange={(e) =>
                            setHoursForm({
                              ...hoursForm,
                              [day]: { ...dayData, close: e.target.value },
                            })
                          }
                          className="bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-rose-600 font-semibold bg-rose-50 px-2.5 py-1 rounded">
                        Closed All Day
                      </span>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              type="submit"
              isLoading={updateHoursMutation.isPending}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Save Working Hours
            </Button>
          </div>
        </form>
      )}

      {/* TAB 3: Invoice & Tax */}
      {activeTab === 'invoice' && (
        <form onSubmit={handleInvoiceSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Invoice Numbering & Tax Rules</CardTitle>
                <CardDescription>Formatted on POS thermal receipts and A4 invoices</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Invoice Code Prefix"
                  value={invoiceForm.prefix || 'INV-'}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, prefix: e.target.value })}
                  placeholder="e.g. APEX-"
                />
                <Input
                  label="Next Invoice Sequence Number"
                  type="number"
                  value={invoiceForm.nextNumber || 1001}
                  onChange={(e) =>
                    setInvoiceForm({ ...invoiceForm, nextNumber: Number(e.target.value) })
                  }
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Tax ID / Trade License Number"
                  value={invoiceForm.taxId || ''}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, taxId: e.target.value })}
                  placeholder="e.g. TR-9948271"
                />
                <Input
                  label="Tax / VAT Rate (%)"
                  type="number"
                  step="0.1"
                  value={invoiceForm.taxRatePercent || 0}
                  onChange={(e) =>
                    setInvoiceForm({ ...invoiceForm, taxRatePercent: Number(e.target.value) })
                  }
                />
              </div>

              <Input
                label="Invoice Footer Note"
                value={invoiceForm.footerNote || ''}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, footerNote: e.target.value })}
                placeholder="Thank you for choosing our digital studio!"
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              type="submit"
              isLoading={updateInvoiceMutation.isPending}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Save Invoice Settings
            </Button>
          </div>
        </form>
      )}

      {/* TAB 4: Print Settings */}
      {activeTab === 'print' && (
        <form onSubmit={handlePrintSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Hardware Print Spooler Preferences</CardTitle>
                <CardDescription>
                  Default parameters dispatched to local USB/LAN printers
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Default Paper Size
                  </label>
                  <select
                    value={printForm.defaultPaperSize || 'A4'}
                    onChange={(e) =>
                      setPrintForm({ ...printForm, defaultPaperSize: e.target.value })
                    }
                    className="block w-full rounded-lg border border-slate-300 py-2.5 px-3 text-sm text-slate-900 focus:border-brand-500 focus:outline-none"
                  >
                    <option value="A4">A4 (210 x 297 mm)</option>
                    <option value="4x6">4 x 6 Inch Photo Paper</option>
                    <option value="Letter">US Letter</option>
                    <option value="Legal">Legal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Target Printer Resolution (DPI)
                  </label>
                  <select
                    value={printForm.printerDpi || 300}
                    onChange={(e) =>
                      setPrintForm({ ...printForm, printerDpi: Number(e.target.value) })
                    }
                    className="block w-full rounded-lg border border-slate-300 py-2.5 px-3 text-sm text-slate-900 focus:border-brand-500 focus:outline-none"
                  >
                    <option value={300}>300 DPI (Standard Studio High Quality)</option>
                    <option value={600}>600 DPI (Ultra Fine Detail)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={printForm.autoPrintReceipt !== false}
                    onChange={(e) =>
                      setPrintForm({ ...printForm, autoPrintReceipt: e.target.checked })
                    }
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span>Automatically dispatch thermal receipt when walk-in order is paid</span>
                </label>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              type="submit"
              isLoading={updatePrintMutation.isPending}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Save Print Settings
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};

