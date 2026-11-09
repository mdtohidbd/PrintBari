import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../components/common/Badge';

export const TermsPage: React.FC = () => {
  return (
    <div className="py-16 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      <div className="space-y-4 text-center">
        <Badge variant="neutral">Legal Agreement</Badge>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Terms and Conditions
        </h1>
        <p className="text-xs text-slate-500">
          Last Updated: November 2026 • Effective for all DocuStudio SaaS Tenants
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-12 shadow-sm space-y-8 text-sm text-slate-700 leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">1. Acceptance of Terms</h2>
          <p>
            By registering an account, downloading the DocuStudio Desktop Print Spooler Agent, or accessing the DocuStudio Cloud Platform ("Service"), you ("Shop Owner", "Tenant", or "Authorized User") agree to be bound by these Terms and Conditions. If you do not agree, do not access or use the platform.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">2. Multi-Tenant Account & Staff Seats</h2>
          <p>
            Each registered shop operates as an isolated tenant. The Shop Owner is solely responsible for maintaining the confidentiality of administrative credentials and for all activities conducted under designated Staff, Operator, and Reviewer accounts.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">3. Fair Use & Processing Quotas</h2>
          <p>
            Plans provide specific quotas for AI OCR pages and Passport Studio layouts. Unlimited tiers are subject to a Fair Commercial Use Policy designed to prevent automated scraping, bot abuse, or resale outside of normal walk-in document kiosk and studio operations.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">4. Customer Document Handling & Compliance</h2>
          <p>
            DocuStudio provides automated graphic layout tools for legitimate documents (passports, national ID cards, bio-data, academic deeds). You agree not to use the Service for the fabrication, tampering, or unlawful forgery of government-issued identity documents.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">5. Subscriptions, Renewals & Cancellation</h2>
          <p>
            Subscriptions are billed on a recurring monthly or annual basis depending on your selection. You may cancel your subscription at any time prior to the billing renewal date via the Shop Settings dashboard.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">6. Desktop Print Spooler Agent License</h2>
          <p>
            We grant the Tenant a non-exclusive, revocable, non-transferable license to install the DocuStudio Print Spooler Agent on physical desktop terminals located inside the registered physical store location for hardware print communication.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">7. Contact & Notices</h2>
          <p>
            For questions regarding these terms, please contact legal@docustudio.io or visit our{' '}
            <Link to="/contact" className="text-brand-600 font-semibold underline">
              Contact Page
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
};

