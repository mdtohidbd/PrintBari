import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Layers,
  Store,
  Mail,
  Lock,
  User,
  Phone,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Zap,
  Shield,
  HelpCircle,
  CreditCard,
  Crown,
} from 'lucide-react';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Toast } from '../components/common/Toast';
import { authApi } from '../api/auth.api';
import { useAppStore } from '../store/useAppStore';

const registerSchema = z.object({
  shopName: z.string().min(2, 'Shop business name must be at least 2 characters'),
  subdomain: z
    .string()
    .min(3, 'Subdomain must be at least 3 characters')
    .max(50, 'Subdomain cannot exceed 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Subdomain can only contain lowercase letters, numbers, and hyphens'),
  ownerName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(6, 'Please enter a valid phone number'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  plan: z.enum(['STARTER', 'PRO', 'PROFESSIONAL', 'BUSINESS', 'ENTERPRISE']).default('PRO'),
  agreeTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must agree to the Terms of Service and Privacy Policy' }),
  }),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export const RegisterPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const { setCurrentTenant, setCurrentUser } = useAppStore();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      shopName: '',
      subdomain: '',
      ownerName: '',
      email: '',
      phone: '',
      password: '',
      plan: 'PRO',
      agreeTerms: true,
    },
  });

  const selectedPlan = watch('plan');
  const watchedShopName = watch('shopName');
  const watchedSubdomain = watch('subdomain');

  // Auto-generate slug from shop name
  const handleShopNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue('shopName', e.target.value);
    const slug = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setValue('subdomain', slug);
  };

  const nextStep = async () => {
    if (currentStep === 1) {
      const isValid = await trigger(['shopName', 'subdomain']);
      if (isValid) setCurrentStep(2);
    } else if (currentStep === 2) {
      const isValid = await trigger(['ownerName', 'email', 'phone', 'password']);
      if (isValid) setCurrentStep(3);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep((prev) => (prev - 1) as any);
  };

  const onSubmit = async (data: RegisterFormData) => {
    setErrorMessage(null);
    try {
      const response = await authApi.registerShop({
        shopName: data.shopName,
        subdomain: data.subdomain,
        ownerName: data.ownerName,
        email: data.email,
        phone: data.phone,
        password: data.password,
        plan: data.plan,
      });

      // Persist real JWT tokens
      localStorage.setItem('token', response.tokens.accessToken);
      localStorage.setItem('refreshToken', response.tokens.refreshToken);
      localStorage.setItem('tenant_id', response.tenant.subdomain);

      // Hydrate state
      setCurrentTenant({
        id: response.tenant.id,
        name: response.tenant.name,
        subdomain: response.tenant.subdomain,
        plan: response.tenant.plan as any,
        currency: 'BDT',
      });

      setCurrentUser({
        id: response.user.id,
        fullName: response.user.fullName,
        email: response.user.email,
        role: response.user.role,
        phone: data.phone,
      });

      navigate('/dashboard');
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Shop subdomain or email may already be in use.');
      setCurrentStep(1); // Return to first step for corrections
    }
  };

  const plans = [
    {
      id: 'STARTER',
      name: 'Starter Kiosk',
      price: '৳ 990 / mo',
      desc: 'Single counter kiosk, basic passport & photo prints',
      features: ['2 Staff Seats', '300 Monthly Photos', '5 GB Cloud Storage', 'Standard 300 DPI'],
    },
    {
      id: 'PRO',
      name: 'Professional Studio',
      price: '৳ 1,990 / mo',
      desc: 'High-volume digital photo studios & cyber cafés',
      popular: true,
      features: ['5 Staff Seats', '10,000 Monthly Photos', '25 GB Cloud Storage', 'Full OCR Engine', 'Hardware Print Spooler'],
    },
    {
      id: 'BUSINESS',
      name: 'Business Enterprise',
      price: '৳ 3,990 / mo',
      desc: 'Multi-counter print centers & agency press shops',
      features: ['15 Staff Seats', '25,000 Monthly Photos', '100 GB Cloud Storage', 'Priority 24/7 Phone Support'],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8 animate-fadeIn">
        {/* Header */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
              <Layers className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-2xl tracking-tight text-slate-900">
              DocuStudio <span className="text-brand-600">SaaS</span>
            </span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Register Your Studio Terminal
          </h1>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            14-day full feature trial. No credit card required. Isolated multi-tenant database.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-3">
          {[
            { num: 1, label: 'Shop Info' },
            { num: 2, label: 'Owner Account' },
            { num: 3, label: 'Plan & Launch' },
          ].map((s) => (
            <div key={s.num} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  currentStep === s.num
                    ? 'bg-brand-600 text-white shadow-sm shadow-brand-500/30'
                    : currentStep > s.num
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {currentStep > s.num ? '✓' : s.num}
              </div>
              <span
                className={`text-xs font-semibold hidden sm:inline ${
                  currentStep === s.num ? 'text-slate-900' : 'text-slate-400'
                }`}
              >
                {s.label}
              </span>
              {s.num < 3 && <div className="w-8 h-0.5 bg-slate-200" />}
            </div>
          ))}
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <Toast
            type="error"
            title="Registration Notice"
            message={errorMessage}
            onClose={() => setErrorMessage(null)}
          />
        )}

        {/* Multi-step Form Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-card p-6 sm:p-10">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* STEP 1: Shop Information */}
            {currentStep === 1 && (
              <div className="space-y-5 animate-slideUp">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-base font-bold text-slate-900">Step 1: Your Studio or Shop Identity</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    This business name appears on customer receipts, invoices, and your isolated subdomain URL.
                  </p>
                </div>

                <Input
                  label="Shop Business Name *"
                  placeholder="e.g. Metro Digital Photo Studio & Xerox"
                  leftIcon={<Store className="w-4 h-4" />}
                  error={errors.shopName?.message}
                  {...register('shopName', { onChange: handleShopNameChange })}
                />

                <div>
                  <Input
                    label="Shop Subdomain URL *"
                    placeholder="e.g. metro-studio"
                    leftIcon={<span className="text-xs font-mono font-bold text-slate-400">app/</span>}
                    rightIcon={<span className="text-xs font-mono text-slate-400">.docustudio.io</span>}
                    error={errors.subdomain?.message}
                    helperText="Lowercase letters, numbers, and dashes only. This is your permanent terminal address."
                    {...register('subdomain')}
                  />
                </div>
              </div>
            )}

            {/* STEP 2: Owner Credentials */}
            {currentStep === 2 && (
              <div className="space-y-5 animate-slideUp">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-base font-bold text-slate-900">Step 2: Studio Owner / Admin Account</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    This account holds master shop permissions, billing rights, and staff administration access.
                  </p>
                </div>

                <Input
                  label="Owner Full Name *"
                  placeholder="e.g. Rafiqul Islam"
                  leftIcon={<User className="w-4 h-4" />}
                  error={errors.ownerName?.message}
                  {...register('ownerName')}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Email Address *"
                    type="email"
                    placeholder="owner@docustudio.io"
                    leftIcon={<Mail className="w-4 h-4" />}
                    error={errors.email?.message}
                    {...register('email')}
                  />

                  <Input
                    label="Phone / WhatsApp Number *"
                    placeholder="+880 1711 000000"
                    leftIcon={<Phone className="w-4 h-4" />}
                    error={errors.phone?.message}
                    {...register('phone')}
                  />
                </div>

                <Input
                  label="Master Account Password *"
                  type="password"
                  placeholder="••••••••••••"
                  leftIcon={<Lock className="w-4 h-4" />}
                  error={errors.password?.message}
                  helperText="Minimum 8 characters. Stored securely with bcrypt encryption."
                  {...register('password')}
                />
              </div>
            )}

            {/* STEP 3: Plan Selection & Launch */}
            {currentStep === 3 && (
              <div className="space-y-5 animate-slideUp">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-base font-bold text-slate-900">Step 3: Select Plan & Launch Studio</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Start with 14 days of free access. You can upgrade, downgrade, or cancel at any time.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {plans.map((p) => {
                    const isSelected = selectedPlan === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setValue('plan', p.id as any)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                          isSelected
                            ? 'border-brand-500 bg-brand-50/40 shadow-sm ring-2 ring-brand-500'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        {p.popular && (
                          <span className="absolute -top-2.5 right-3 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-brand-600 text-white rounded-full">
                            Recommended
                          </span>
                        )}
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{p.name}</h4>
                          <p className="text-xs text-brand-600 font-extrabold mt-1">{p.price}</p>
                          <p className="text-[11px] text-slate-500 mt-1 leading-snug">{p.desc}</p>
                          <ul className="mt-3 space-y-1.5 text-[11px] text-slate-600">
                            {p.features.map((f, i) => (
                              <li key={i} className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="mt-4 pt-3 border-t border-slate-100 text-center text-xs font-semibold">
                          <span className={isSelected ? 'text-brand-700' : 'text-slate-400'}>
                            {isSelected ? '✓ Selected' : 'Choose Plan'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <label className="flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4 shrink-0"
                      {...register('agreeTerms')}
                    />
                    <span>
                      I agree to the{' '}
                      <Link to="/terms" target="_blank" className="font-bold text-brand-600 hover:underline">
                        Terms of Service
                      </Link>
                      ,{' '}
                      <Link to="/privacy" target="_blank" className="font-bold text-brand-600 hover:underline">
                        Privacy Policy
                      </Link>
                      , and zero-retention document processing terms.
                    </span>
                  </label>
                  {errors.agreeTerms && (
                    <p className="text-xs text-rose-600 font-medium mt-1">• {errors.agreeTerms.message}</p>
                  )}
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              {currentStep > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={prevStep}
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                >
                  Back
                </Button>
              ) : (
                <Link to="/login" className="text-xs font-semibold text-slate-500 hover:text-slate-900">
                  Already registered? Sign In
                </Link>
              )}

              {currentStep < 3 ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={nextStep}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Continue to Next Step
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="sm"
                  isLoading={isSubmitting}
                  rightIcon={<Sparkles className="w-4 h-4" />}
                >
                  Launch Studio Free Trial
                </Button>
              )}
            </div>
          </form>
        </div>

        {/* Footer Support Notice */}
        <p className="text-center text-xs text-slate-400">
          Need assistance setting up your hardware photo printers?{' '}
          <Link to="/contact" className="font-semibold text-brand-600 hover:underline">
            Contact Technical Support
          </Link>
        </p>
      </div>
    </div>
  );
};
