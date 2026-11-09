import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PublicLayout } from '../components/layout/PublicLayout';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { ProtectedRoute } from '../components/common/ProtectedRoute';
import { Spinner } from '../components/common/Spinner';

// Lazy loading route components with code splitting
const HomePage = React.lazy(() => import('../pages/HomePage').then((m) => ({ default: m.HomePage })));
const FeaturesPage = React.lazy(() => import('../pages/FeaturesPage').then((m) => ({ default: m.FeaturesPage })));
const PricingPage = React.lazy(() => import('../pages/PricingPage').then((m) => ({ default: m.PricingPage })));
const UseCasesPage = React.lazy(() => import('../pages/UseCasesPage').then((m) => ({ default: m.UseCasesPage })));
const DemoPage = React.lazy(() => import('../pages/DemoPage').then((m) => ({ default: m.DemoPage })));
const AboutUsPage = React.lazy(() => import('../pages/AboutUsPage').then((m) => ({ default: m.AboutUsPage })));
const ContactPage = React.lazy(() => import('../pages/ContactPage').then((m) => ({ default: m.ContactPage })));
const FAQPage = React.lazy(() => import('../pages/FAQPage').then((m) => ({ default: m.FAQPage })));
const LoginPage = React.lazy(() => import('../pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = React.lazy(() => import('../pages/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const TermsPage = React.lazy(() => import('../pages/TermsPage').then((m) => ({ default: m.TermsPage })));
const PrivacyPage = React.lazy(() => import('../pages/PrivacyPage').then((m) => ({ default: m.PrivacyPage })));
const RefundPage = React.lazy(() => import('../pages/RefundPage').then((m) => ({ default: m.RefundPage })));
const DashboardPage = React.lazy(() => import('../pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const SettingsPage = React.lazy(() => import('../pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const StaffManagementPage = React.lazy(() => import('../pages/StaffManagementPage').then((m) => ({ default: m.StaffManagementPage })));
const PassportStudioPage = React.lazy(() => import('../pages/PassportStudioPage').then((m) => ({ default: m.PassportStudioPage })));
const DocumentA4StudioPage = React.lazy(() => import('../pages/DocumentA4StudioPage').then((m) => ({ default: m.DocumentA4StudioPage })));
const IdCardStudioPage = React.lazy(() => import('../pages/IdCardStudioPage').then((m) => ({ default: m.IdCardStudioPage })));
const CvStudioPage = React.lazy(() => import('../pages/CvStudioPage').then((m) => ({ default: m.CvStudioPage })));
const OcrStudioPage = React.lazy(() => import('../pages/OcrStudioPage').then((m) => ({ default: m.OcrStudioPage })));
const JobsQueuePage = React.lazy(() => import('../pages/JobsQueuePage').then((m) => ({ default: m.JobsQueuePage })));
const CustomersPage = React.lazy(() => import('../pages/CustomersPage').then((m) => ({ default: m.CustomersPage })));
const PrintSpoolerPage = React.lazy(() => import('../pages/PrintSpoolerPage').then((m) => ({ default: m.PrintSpoolerPage })));
const SubscriptionPage = React.lazy(() => import('../pages/SubscriptionPage').then((m) => ({ default: m.SubscriptionPage })));
const SuperAdminPage = React.lazy(() => import('../pages/SuperAdminPage').then((m) => ({ default: m.SuperAdminPage })));
const OnboardingPage = React.lazy(() => import('../pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage })));
const NotFoundPage = React.lazy(() => import('../pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

const SuspenseLoader: React.FC = () => (
  <div className="flex min-h-[50vh] w-full items-center justify-center p-8">
    <Spinner size="lg" />
  </div>
);

export const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<SuspenseLoader />}>
      <Routes>
      {/* 1. Public SaaS Website Pages (Marketing, Legal, Auth) */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/use-cases" element={<UseCasesPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/demo" element={<DemoPage />} />
        <Route path="/about" element={<AboutUsPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/refund" element={<RefundPage />} />
      </Route>

      {/* Standalone Dedicated Auth & Onboarding Screens */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />

      {/* 2. Protected Shop Management Operating System (Admin & Staff Shell) */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/studio" element={<Navigate to="/studio/passport" replace />} />
        <Route path="/studio/passport" element={<PassportStudioPage />} />
        <Route path="/studio/document" element={<DocumentA4StudioPage />} />
        <Route path="/studio/id-card" element={<IdCardStudioPage />} />
        <Route path="/studio/cv" element={<CvStudioPage />} />
        <Route path="/studio/ocr" element={<OcrStudioPage />} />
        <Route path="/queue" element={<JobsQueuePage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/printers" element={<PrintSpoolerPage />} />
        <Route path="/subscription" element={<SubscriptionPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/staff" element={<StaffManagementPage />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="SUPER_ADMIN">
              <SuperAdminPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* 404 Catch-All */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  </Suspense>
);
};
