import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Layers, Eye, EyeOff, Lock, Mail, Store, ArrowRight, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { Toast } from '../components/common/Toast';
import { authApi } from '../api/auth.api';
import { useAppStore } from '../store/useAppStore';

const loginSchema = z.object({
  subdomain: z.string().min(2, 'Shop subdomain or ID is required'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { setCurrentTenant, setCurrentUser } = useAppStore();

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      subdomain: 'metro-studio',
      email: 'owner@docustudio.io',
      password: 'SecurePassword123!',
      rememberMe: true,
    },
  });

  const handleFillDemo = () => {
    setValue('subdomain', 'metro-studio');
    setValue('email', 'owner@docustudio.io');
    setValue('password', 'SecurePassword123!');
  };

  const onSubmit = async (data: LoginFormData) => {
    setErrorMessage(null);
    try {
      const response = await authApi.login({
        email: data.email,
        password: data.password,
        subdomain: data.subdomain,
      });

      // Persist authentication tokens
      localStorage.setItem('token', response.tokens.accessToken);
      localStorage.setItem('refreshToken', response.tokens.refreshToken);
      localStorage.setItem('tenant_id', response.tenant.subdomain);

      // Hydrate Zustand state
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
        phone: response.user.phone,
      });

      navigate(from, { replace: true });
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Invalid email, shop subdomain, or password credentials. Please try again.'
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-stretch">
      {/* Left Column: Visual & Trust (Hidden on small screens) */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-950 text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* Ambient Gradient */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-accent-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-500 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-brand-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-2xl tracking-tight text-white">
              DocuStudio <span className="text-brand-400">SaaS</span>
            </span>
          </Link>
          <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
            The complete operating system engineered specifically for digital photo studios, photocopy shops, and cyber cafés.
          </p>
        </div>

        <div className="relative z-10 space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-brand-400 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Counter Speed & 300 DPI Hardware Ready</span>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed italic">
              "We intake walk-in customers, auto-generate 8-up passport cut sheets in seconds, and send them directly to our DNP photo printer with zero browser print popups."
            </p>
            <p className="text-xs text-slate-400 font-semibold">
              — Metro Photo Studio & Xerox Center (Dhaka)
            </p>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Multi-Tenant Isolation
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Vector PDF Printing
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Zero-Retention Privacy
            </span>
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-400">
          © {new Date().getFullYear()} DocuStudio SaaS. Enterprise-grade cloud studio infrastructure.
        </div>
      </div>

      {/* Right Column: Clean Login Card */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-8 animate-fadeIn">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-6">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white">
              <Layers className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-xl text-slate-900">DocuStudio</span>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Sign in to Studio OS
            </h2>
            <p className="text-sm text-slate-500">
              Enter your shop subdomain and credentials to open your terminal.
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <Toast
              type="error"
              title="Authentication Failed"
              message={errorMessage}
              onClose={() => setErrorMessage(null)}
            />
          )}

          {/* Quick Demo Helper Pill */}
          <div className="p-3.5 bg-brand-50/70 border border-brand-200/80 rounded-2xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-600 shrink-0" />
              <span className="text-brand-900 font-medium">Testing in development?</span>
            </div>
            <button
              type="button"
              onClick={handleFillDemo}
              className="text-brand-700 font-bold hover:text-brand-900 hover:underline"
            >
              Fill Demo Credentials
            </button>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Shop Subdomain / ID *"
              placeholder="e.g. metro-studio"
              leftIcon={<Store className="w-4 h-4" />}
              error={errors.subdomain?.message}
              {...register('subdomain')}
            />

            <Input
              label="Operator Email *"
              type="email"
              placeholder="owner@docustudio.io"
              leftIcon={<Mail className="w-4 h-4" />}
              error={errors.email?.message}
              {...register('email')}
            />

            <div className="space-y-1">
              <div className="relative">
                <Input
                  label="Password *"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  leftIcon={<Lock className="w-4 h-4" />}
                  error={errors.password?.message}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="p-1 hover:text-slate-600 text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 rounded"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                  {...register('password')}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4"
                  {...register('rememberMe')}
                />
                <span>Remember this terminal</span>
              </label>

              <Link to="/contact" className="text-brand-600 hover:text-brand-700 font-semibold hover:underline">
                Forgot password?
              </Link>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                className="w-full py-2.5 text-sm"
                isLoading={isSubmitting}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Sign In to Terminal
              </Button>
            </div>
          </form>

          {/* Registration Link */}
          <div className="pt-4 border-t border-slate-200 text-center text-xs text-slate-500">
            Don't have a registered shop account yet?{' '}
            <Link to="/register" className="font-bold text-brand-600 hover:text-brand-700 hover:underline">
              Start 14-Day Free Trial →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
