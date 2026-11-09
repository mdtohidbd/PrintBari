import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../components/common/Badge';
import { ShieldCheck, Lock, Trash2, Clock } from 'lucide-react';

export const PrivacyPage: React.FC = () => {
  return (
    <div className="py-16 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      <div className="space-y-4 text-center">
        <Badge variant="primary">Data Privacy & Security</Badge>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Privacy Policy
        </h1>
        <p className="text-xs text-slate-500">
          Last Updated: November 2026 • Engineered with Zero-Retention Biometric Safeguards
        </p>
      </div>

      {/* Zero Retention Highlight Banner */}
      <div className="rounded-3xl bg-emerald-900 text-white p-8 sm:p-10 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-800 text-emerald-300 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-white">
            Our Zero-Retention Biometric & ID Document Commitment
          </h3>
        </div>
        <p className="text-emerald-100 text-sm leading-relaxed">
          Because our platform processes sensitive identity documents (passports, national ID cards, biometric portraits), we do not harvest or retain your customers' personal files. All uploaded images and generated print sheets are permanently purged from our encrypted cloud storage <strong>within 24 hours</strong> of processing.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-12 shadow-sm space-y-8 text-sm text-slate-700 leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">1. Information We Collect</h2>
          <p>
            We collect basic account information necessary to administer your SaaS tenant: Shop Name, Business Address, Owner Name, Email Address, and Phone Number. We do not sell or monetize shop customer databases under any circumstances.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">2. Customer Document Data (Walk-In Citizens)</h2>
          <p>
            When a counter operator uploads a photograph or scan of an identity card to generate an A4 sheet or 8-pack passport photo:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-600">
            <li>Files are transferred via encrypted TLS 1.3 connections.</li>
            <li>Files are processed transiently in high-speed memory buffers.</li>
            <li>S3 storage keys are tagged with strict 24-hour expiration lifecycles.</li>
            <li>No biometric face templates or facial recognition hashes are stored in persistent databases.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">3. Multi-Tenant Data Isolation</h2>
          <p>
            Each shop's operational metadata (job history, revenue counters, staff accounts) is isolated using tenant namespace identifiers. One shop can never view or access the records of another shop.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">4. Third-Party Service Providers</h2>
          <p>
            We partner with industry-standard, SOC 2 compliant infrastructure providers including AWS S3/Cloudflare (encrypted file storage) and Stripe/Local Payment Gateways (tokenized payment processing). We do not store raw credit card numbers.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">5. GDPR & Data Subject Rights</h2>
          <p>
            Shop owners and operators have the right to request access, correction, or immediate deletion of their account data by emailing privacy@docustudio.io.
          </p>
        </section>
      </div>
    </div>
  );
};

