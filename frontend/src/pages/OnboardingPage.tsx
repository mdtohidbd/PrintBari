import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Building2,
  Image as ImageIcon,
  Sliders,
  DollarSign,
  Users,
  Printer,
  UserPlus,
  FileCheck,
  Sparkles,
  HelpCircle,
  PlayCircle,
  Upload,
  Trash2,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { onboardingApi, OnboardingStateResponse } from '../api/onboarding.api';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { Spinner } from '../components/common/Spinner';

const STEP_TITLES = [
  'Welcome to DocuStudio',
  'Business Profile',
  'Shop Branding & Logo',
  'Enabled Services',
  'Service Pricing',
  'Team & Staff Seats',
  'Print & Hardware Settings',
  'Add First Customer',
  'Create First Job',
  'Fulfillment & Activation',
];

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeStep, setActiveStep] = useState<number>(1);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [csvText, setCsvText] = useState<string>('');
  const [csvResult, setCsvResult] = useState<any>(null);
  const [showVideoModal, setShowVideoModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 1. Fetch Onboarding State
  const { data, isLoading } = useQuery<OnboardingStateResponse>({
    queryKey: ['onboarding-state'],
    queryFn: onboardingApi.getState,
  });

  useEffect(() => {
    if (data?.state) {
      setActiveStep(data.state.currentStep || 1);
      setFormData({
        shopName: data.state.stepData.businessProfile?.shopName || data.tenantDetails.name || '',
        phone: data.state.stepData.businessProfile?.phone || '',
        address: data.state.stepData.businessProfile?.address || '',
        currency: data.state.stepData.businessProfile?.currency || 'BDT',
        logoUrl: data.state.stepData.logoUrl || '',
        services: data.state.stepData.servicesConfigured || ['PASSPORT_PHOTO', 'ID_CARD_A4', 'DOCUMENT_A4'],
        pricing: data.state.stepData.servicePricing || [
          { serviceType: 'PASSPORT_PHOTO', price: 300, paperType: 'GLOSSY_PHOTO_260GSM' },
          { serviceType: 'ID_CARD_A4', price: 150, paperType: 'LAMINATION_POUCH_150MIC' },
          { serviceType: 'DOCUMENT_A4', price: 20, paperType: 'BOND_80GSM' },
        ],
        staffEmail: '',
        staffName: '',
        defaultPaperSize: data.state.stepData.printSettings?.defaultPaperSize || 'A4',
        defaultDpi: data.state.stepData.printSettings?.defaultDpi || 300,
        printerModel: data.state.stepData.printSettings?.printerModel || 'Epson L805',
        marginOffsetXmm: data.state.stepData.printSettings?.marginOffsetXmm || 0,
        marginOffsetYmm: data.state.stepData.printSettings?.marginOffsetYmm || 0,
        customerName: 'Zubair Ahmed',
        customerPhone: '01711000000',
        customerEmail: 'zubair@example.com',
        jobService: 'PASSPORT_PHOTO',
        jobTitle: 'Schengen Visa 35x45mm (8 Copies)',
        jobPrice: 300,
      });
    }
  }, [data]);

  // 2. Mutations
  const saveStepMutation = useMutation({
    mutationFn: ({ step, payload }: { step: number; payload: any }) =>
      onboardingApi.saveStep(step, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(['onboarding-state'], updated);
      setToastMessage(`Step ${activeStep} saved successfully!`);
      setTimeout(() => setToastMessage(null), 3000);
      if (activeStep < 10) {
        setActiveStep(activeStep + 1);
      }
    },
  });

  const skipStepMutation = useMutation({
    mutationFn: (step: number) => onboardingApi.skipStep(step),
    onSuccess: (updated) => {
      queryClient.setQueryData(['onboarding-state'], updated);
      if (activeStep < 10) {
        setActiveStep(activeStep + 1);
      }
    },
  });

  const seedSampleMutation = useMutation({
    mutationFn: onboardingApi.seedSampleWorkspace,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-state'] });
      setToastMessage('Demo workspace populated with 2 sample customers & jobs!');
      setTimeout(() => setToastMessage(null), 4000);
    },
  });

  const purgeSampleMutation = useMutation({
    mutationFn: onboardingApi.purgeSampleWorkspace,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-state'] });
      setToastMessage('Sample demo data completely purged.');
      setTimeout(() => setToastMessage(null), 3000);
    },
  });

  const csvImportMutation = useMutation({
    mutationFn: (text: string) => onboardingApi.importFromCSV(text),
    onSuccess: (res) => {
      setCsvResult(res);
      queryClient.invalidateQueries({ queryKey: ['onboarding-state'] });
    },
  });

  const completeTourMutation = useMutation({
    mutationFn: onboardingApi.completeTour,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-state'] });
    },
  });

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Spinner size="lg" />
      </div>
    );
  }

  const { state, progressPercent, tenantDetails } = data;

  const handleNext = () => {
    let payload: Record<string, any> = {};
    if (activeStep === 2) {
      payload = {
        shopName: formData.shopName,
        phone: formData.phone,
        address: formData.address,
        currency: formData.currency,
      };
    } else if (activeStep === 3) {
      payload = { logoUrl: formData.logoUrl };
    } else if (activeStep === 4) {
      payload = { services: formData.services };
    } else if (activeStep === 5) {
      payload = { pricing: formData.pricing };
    } else if (activeStep === 6) {
      payload = {
        staff: formData.staffEmail
          ? [{ email: formData.staffEmail, fullName: formData.staffName, role: 'STAFF' }]
          : [],
      };
    } else if (activeStep === 7) {
      payload = {
        printSettings: {
          defaultPaperSize: formData.defaultPaperSize,
          defaultDpi: formData.defaultDpi,
          printerModel: formData.printerModel,
          marginOffsetXmm: formData.marginOffsetXmm,
          marginOffsetYmm: formData.marginOffsetYmm,
        },
      };
    } else if (activeStep === 8) {
      payload = {
        customer: {
          fullName: formData.customerName,
          phone: formData.customerPhone,
          email: formData.customerEmail,
        },
      };
    } else if (activeStep === 9) {
      payload = {
        job: {
          serviceType: formData.jobService,
          title: formData.jobTitle,
          price: formData.jobPrice,
        },
      };
    }

    saveStepMutation.mutate({ step: activeStep, payload });
  };

  const handleSkip = () => {
    skipStepMutation.mutate(activeStep);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Banner & Progress Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              DS
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">
                {tenantDetails.name} — Shop Activation
              </h1>
              <p className="text-xs text-slate-500">
                Step {activeStep} of 10: {STEP_TITLES[activeStep - 1]}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-semibold text-slate-700">{progressPercent}% Setup Completed</span>
              <div className="w-36 h-2 bg-slate-100 rounded-full overflow-hidden mt-1 border border-slate-200">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="text-xs text-slate-600"
            >
              Exit to Dashboard
            </Button>
          </div>
        </div>

        {/* 10 Step Indicator Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 min-w-[700px]">
            {STEP_TITLES.map((title, idx) => {
              const stepNum = idx + 1;
              const isDone = state.completedSteps.includes(stepNum);
              const isCurrent = activeStep === stepNum;

              return (
                <button
                  key={stepNum}
                  onClick={() => setActiveStep(stepNum)}
                  className={`flex-1 flex items-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                    isCurrent
                      ? 'bg-brand-50 text-brand-700 border border-brand-300 shadow-sm'
                      : isDone
                      ? 'text-emerald-700 hover:bg-emerald-50'
                      : 'text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isDone
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isDone ? '✓' : stepNum}
                  </span>
                  <span className="truncate">{title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2 shadow-sm animate-fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Demo Workspace Banner */}
        <div className="bg-gradient-to-r from-indigo-50 to-brand-50 border border-indigo-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Interactive Demo Workspace Mode</h2>
              <p className="text-xs text-slate-600">
                Instantly explore photo processing with synthetic customers and jobs. Purge with 1 click anytime.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!state.hasSampleData ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => seedSampleMutation.mutate()}
                isLoading={seedSampleMutation.isPending}
                className="text-xs bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-50"
              >
                Inject Sample Data
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => purgeSampleMutation.mutate()}
                isLoading={purgeSampleMutation.isPending}
                className="text-xs text-rose-700 border-rose-300 hover:bg-rose-50"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Remove Sample Data
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowVideoModal(true)}
              className="text-xs text-slate-600"
            >
              <PlayCircle className="w-4 h-4 mr-1 text-brand-600" />
              Watch Tutorial
            </Button>
          </div>
        </div>

        {/* Step Content Card */}
        <Card className="p-6 sm:p-8 space-y-6 shadow-sm border-slate-200">
          {/* STEP 1: WELCOME */}
          {activeStep === 1 && (
            <div className="space-y-6 text-center max-w-xl mx-auto py-6">
              <div className="w-16 h-16 rounded-2xl bg-brand-100 text-brand-600 flex items-center justify-center mx-auto shadow-inner">
                <Sparkles className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  Welcome to Your Studio Operating System
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  DocuStudio automates passport photo cutting, document deskew, ID card lamination, and bilingual CVs
                  so your counter operators can fulfill walk-in orders in under 60 seconds.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left pt-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <span className="text-xs font-bold text-brand-600">45-Sec Sizing</span>
                  <p className="text-xs text-slate-600">Preset Schengen, US & Bangladesh biometric ratios.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <span className="text-xs font-bold text-brand-600">Epson L805 Ready</span>
                  <p className="text-xs text-slate-600">300 DPI canvas layout with micro cutting guides.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <span className="text-xs font-bold text-brand-600">bKash Integrated</span>
                  <p className="text-xs text-slate-600">Native daily cash reconciliation & digital receipts.</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: BUSINESS PROFILE */}
          {activeStep === 2 && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h2 className="text-lg font-bold text-slate-900">Step 2: Business Profile & Studio Details</h2>
                <p className="text-xs text-slate-500">Configure your store name, primary mobile number, and receipt details.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Studio / Shop Name"
                  value={formData.shopName}
                  onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                  placeholder="e.g. Metro Color Lab"
                />
                <Input
                  label="Primary Contact Number (bKash / Mobile)"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g. 01711XXXXXX"
                />
                <div className="sm:col-span-2">
                  <Input
                    label="Physical Store Address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="e.g. Shop #4, Elephant Road, Dhaka-1205"
                  />
                </div>
                <Select
                  label="Operating Currency"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  options={[
                    { value: 'BDT', label: 'Bangladeshi Taka (BDT ৳)' },
                    { value: 'USD', label: 'US Dollar (USD $)' },
                  ]}
                />
              </div>
            </div>
          )}

          {/* STEP 3: SHOP LOGO */}
          {activeStep === 3 && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h2 className="text-lg font-bold text-slate-900">Step 3: Upload Shop Logo (Optional)</h2>
                <p className="text-xs text-slate-500">Your logo will appear on invoice receipts and photo sheet margins.</p>
              </div>

              <div className="p-8 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center space-y-3 bg-slate-50/50">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-700">Drag and drop your logo PNG / JPG here</p>
                  <p className="text-xs text-slate-400">Recommended size: 400x120px transparent PNG</p>
                </div>
                <Input
                  label="Or enter logo Image URL"
                  value={formData.logoUrl}
                  onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                  placeholder="https://example.com/logo.png"
                  className="max-w-md"
                />
              </div>
            </div>
          )}

          {/* STEP 4: CONFIGURE SERVICES */}
          {activeStep === 4 && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h2 className="text-lg font-bold text-slate-900">Step 4: Enabled Studio Services</h2>
                <p className="text-xs text-slate-500">Select which studio engines appear in your counter navigation.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { id: 'PASSPORT_PHOTO', name: 'Passport & Visa Photo Studio', desc: '35x45mm, 50x50mm, 8-up A4 printing' },
                  { id: 'ID_CARD_A4', name: 'Smart NID & ID Card Lamination', desc: 'Dual-sided ISO 7810 auto-alignment' },
                  { id: 'DOCUMENT_A4', name: 'Document A4 Enhancement', desc: '4-point perspective warp, deskew & whitening' },
                  { id: 'CV_BUILDER', name: 'Bilingual CV & Resume Builder', desc: 'Kalpurush Bengali font PDF compilation' },
                  { id: 'HANDWRITING_OCR', name: 'Bilingual OCR & Text Extraction', desc: 'Convert scanned deeds to editable text' },
                ].map((srv) => {
                  const isChecked = formData.services?.includes(srv.id);
                  return (
                    <div
                      key={srv.id}
                      onClick={() => {
                        const next = isChecked
                          ? formData.services.filter((s: string) => s !== srv.id)
                          : [...formData.services, srv.id];
                        setFormData({ ...formData, services: next });
                      }}
                      className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                        isChecked
                          ? 'border-brand-500 bg-brand-50/50 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="mt-1 rounded text-brand-600 focus:ring-brand-500"
                      />
                      <div>
                        <p className="text-sm font-bold text-slate-900">{srv.name}</p>
                        <p className="text-xs text-slate-500">{srv.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 5: SERVICE PRICING */}
          {activeStep === 5 && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h2 className="text-lg font-bold text-slate-900">Step 5: Default Counter Service Pricing</h2>
                <p className="text-xs text-slate-500">Configure standard prices in BDT charged to walk-in citizens.</p>
              </div>

              <div className="space-y-3">
                {formData.pricing?.map((p: any, idx: number) => (
                  <div
                    key={p.serviceType}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-xl border border-slate-200 gap-3"
                  >
                    <div>
                      <span className="text-sm font-bold text-slate-900">{p.serviceType.replace(/_/g, ' ')}</span>
                      <p className="text-xs text-slate-500">Paper: {p.paperType || 'Standard'}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-600">৳</span>
                      <Input
                        type="number"
                        value={p.price}
                        onChange={(e) => {
                          const updated = [...formData.pricing];
                          updated[idx].price = Number(e.target.value);
                          setFormData({ ...formData, pricing: updated });
                        }}
                        className="w-28"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 6: INVITE STAFF */}
          {activeStep === 6 && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h2 className="text-lg font-bold text-slate-900">Step 6: Invite Counter Staff & Operators</h2>
                <p className="text-xs text-slate-500">
                  Add staff accounts (Plan seat quota: {tenantDetails.maxStaffSeats} seats).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Staff Full Name"
                  value={formData.staffName}
                  onChange={(e) => setFormData({ ...formData, staffName: e.target.value })}
                  placeholder="e.g. Tariqul Islam"
                />
                <Input
                  label="Staff Email Address"
                  value={formData.staffEmail}
                  onChange={(e) => setFormData({ ...formData, staffEmail: e.target.value })}
                  placeholder="tariqul@metrolab.com"
                />
              </div>
            </div>
          )}

          {/* STEP 7: PRINT SETTINGS */}
          {activeStep === 7 && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h2 className="text-lg font-bold text-slate-900">Step 7: Printer & Hardware Calibration</h2>
                <p className="text-xs text-slate-500">Calibrate physical margin offsets for your photo printer.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Default Printer Model"
                  value={formData.printerModel}
                  onChange={(e) => setFormData({ ...formData, printerModel: e.target.value })}
                  options={[
                    { value: 'Epson L805', label: 'Epson EcoTank L805 (6-Color)' },
                    { value: 'Epson L850', label: 'Epson L850 / L1800 Photo Tank' },
                    { value: 'Epson L3210', label: 'Epson L3110 / L3210 3-in-1' },
                    { value: 'Canon G2010', label: 'Canon PIXMA G-Series' },
                    { value: 'HP LaserJet', label: 'HP LaserJet Pro M404 / 1020' },
                  ]}
                />
                <Select
                  label="Default Paper Size"
                  value={formData.defaultPaperSize}
                  onChange={(e) => setFormData({ ...formData, defaultPaperSize: e.target.value })}
                  options={[
                    { value: 'A4', label: 'A4 Standard (210 x 297 mm)' },
                    { value: '4R', label: '4R Photo (4 x 6 inch / 102 x 152 mm)' },
                    { value: 'Letter', label: 'US Letter' },
                  ]}
                />
                <Input
                  type="number"
                  label="Horizontal Margin Offset (X mm)"
                  value={formData.marginOffsetXmm}
                  onChange={(e) => setFormData({ ...formData, marginOffsetXmm: Number(e.target.value) })}
                  helperText="Adjust if print is shifted left/right"
                />
                <Input
                  type="number"
                  label="Vertical Margin Offset (Y mm)"
                  value={formData.marginOffsetYmm}
                  onChange={(e) => setFormData({ ...formData, marginOffsetYmm: Number(e.target.value) })}
                  helperText="Compensates for 1.5-2mm roller feed drift"
                />
              </div>
            </div>
          )}

          {/* STEP 8: ADD FIRST CUSTOMER (WITH CSV IMPORT) */}
          {activeStep === 8 && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h2 className="text-lg font-bold text-slate-900">Step 8: Add Your First Customer</h2>
                <p className="text-xs text-slate-500">
                  Register a walk-in citizen profile or bulk import existing customer data via CSV.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Customer Full Name"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  placeholder="e.g. Zubair Ahmed"
                />
                <Input
                  label="Mobile Phone (Bangladeshi Format)"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  placeholder="01711XXXXXX"
                />
              </div>

              {/* Bulk CSV Import Accordion */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Upload className="w-4 h-4 text-brand-600" />
                    Or Bulk Import Customers via CSV
                  </span>
                  <span className="text-[11px] text-slate-500">Headers: fullName, phone, email</span>
                </div>
                <textarea
                  rows={3}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder={`fullName,phone,email\nRafiqul Islam,01711223344,rafiq@example.com\nSalma Begum,01822334455,salma@example.com`}
                  className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200 focus:ring-1 focus:ring-brand-500"
                />
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => csvImportMutation.mutate(csvText)}
                    isLoading={csvImportMutation.isPending}
                    disabled={!csvText.trim()}
                    className="text-xs"
                  >
                    Validate & Import CSV
                  </Button>
                  {csvResult && (
                    <span className="text-xs text-emerald-700 font-medium">
                      ✓ Imported {csvResult.importedCount} rows ({csvResult.skippedCount} skipped)
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 9: CREATE FIRST JOB */}
          {activeStep === 9 && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h2 className="text-lg font-bold text-slate-900">Step 9: Create Your First Studio Order</h2>
                <p className="text-xs text-slate-500">Initialize a live print order linked to your first customer.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Select Service Engine"
                  value={formData.jobService}
                  onChange={(e) => setFormData({ ...formData, jobService: e.target.value })}
                  options={[
                    { value: 'PASSPORT_PHOTO', label: 'Passport Photo (Schengen 35x45mm)' },
                    { value: 'ID_CARD_A4', label: 'Bangladesh Smart NID Card (Dual-Sided)' },
                    { value: 'DOCUMENT_A4', label: 'Document A4 Deskew & Whiten' },
                  ]}
                />
                <Input
                  type="number"
                  label="Billing Amount (BDT ৳)"
                  value={formData.jobPrice}
                  onChange={(e) => setFormData({ ...formData, jobPrice: Number(e.target.value) })}
                />
                <div className="sm:col-span-2">
                  <Input
                    label="Job Description / Title"
                    value={formData.jobTitle}
                    onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 10: COMPLETE FIRST JOB */}
          {activeStep === 10 && (
            <div className="space-y-6 text-center max-w-xl mx-auto py-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-extrabold text-slate-900">
                  Setup Complete! Ready for Commercial Operation
                </h2>
                <p className="text-xs text-slate-600">
                  Your shop profile, pricing presets, printer settings, and first live job are active in your database.
                </p>
              </div>

              {/* Activation Checklist Summary */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-2.5">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Getting Started Activation Checklist
                </h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Shop Profile & Location Configured</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Service Pricing Presets Initialized</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Hardware Printer Driver Offsets Saved</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>First Customer Profile Created</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>First Live Order Ready for Spooling</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons: Back, Skip, Next */}
          <div className="border-t border-slate-200 pt-5 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveStep(Math.max(1, activeStep - 1))}
              disabled={activeStep === 1}
              className="text-xs"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>

            <div className="flex items-center gap-2">
              {[3, 6, 8].includes(activeStep) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkip}
                  className="text-xs text-slate-500"
                >
                  Skip Step
                </Button>
              )}

              {activeStep < 10 ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleNext}
                  isLoading={saveStepMutation.isPending}
                  className="text-xs"
                >
                  Save & Continue
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    handleNext();
                    navigate('/dashboard');
                  }}
                  isLoading={saveStepMutation.isPending}
                  className="text-xs bg-emerald-600 hover:bg-emerald-700"
                >
                  Launch Studio Dashboard
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </Card>
      </main>

      {/* Video Tutorial Modal */}
      {showVideoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <PlayCircle className="w-5 h-5 text-brand-600" />
                5-Minute Studio Counter Quickstart Tutorial
              </h3>
              <button
                onClick={() => setShowVideoModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>
            <div className="aspect-video bg-slate-900 rounded-2xl flex flex-col items-center justify-center text-white space-y-2 p-6 text-center">
              <PlayCircle className="w-12 h-12 text-brand-400 opacity-80" />
              <p className="text-sm font-semibold">Video Tutorial: "Setting Up Your Studio in 5 Minutes"</p>
              <p className="text-xs text-slate-400">Available in Bengali and English with local studio tips.</p>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setShowVideoModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

