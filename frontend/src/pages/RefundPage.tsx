import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../components/common/Badge';
import { DollarSign, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '../components/common/Button';

export const RefundPage: React.FC = () => {
  return (
    <div className="py-16 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      <div className="space-y-4 text-center">
        <Badge variant="primary">Customer Protection</Badge>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Refund & Cancellation Policy
        </h1>
        <p className="text-xs text-slate-500">
          Last Updated: November 2026 • 100% Risk-Free Guarantee
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-12 shadow-sm space-y-8 text-sm text-slate-700 leading-relaxed">
        {/* 7-Day Guarantee Card */}
        <div className="p-6 rounded-2xl bg-brand-50 border border-brand-200 text-brand-900 space-y-3">
          <div className="flex items-center gap-2 font-bold text-base">
            <CheckCircle2 className="w-5 h-5 text-brand-600" />
            <span>7-Day No-Questions-Asked Money-Back Guarantee</span>
          </div>
          <p className="text-xs text-brand-800 leading-relaxed">
            If you subscribe to any DocuStudio plan and find that it does not increase your shop's speed, printer efficiency, or customer turnover, you can request a full 100% refund within 7 calendar days of your initial payment.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">1. Free Trial Eligibility</h2>
          <p>
            All new shops are entitled to a 14-day fully-functional free trial. You will not be billed during the trial period. If you cancel before the trial period concludes, your card will never be charged.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">2. Subscription Cancellation</h2>
          <p>
            You can cancel your active monthly or annual plan at any time through your Shop Settings under Billing. Upon cancellation, your account will remain fully functional until the end of the current paid billing cycle, after which no further renewals will occur.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">3. How to Request a Refund</h2>
          <p>
            To initiate a refund under our 7-day policy, please contact our billing support desk:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-600">
            <li>Email: billing@docustudio.io with your shop name or subdomain.</li>
            <li>WhatsApp Support: Message our billing hotline with your invoice ID.</li>
            <li>Refunds are processed within 3-5 business days directly back to the original payment method.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">4. Add-On Consumption Credits</h2>
          <p>
            Purchases of optional standalone AI OCR token packages or SMS blocks that have not been consumed are eligible for a prorated refund upon request within 14 days of purchase.
          </p>
        </section>
      </div>

      <div className="text-center pt-4">
        <Link to="/contact">
          <Button variant="outline">Have a question about billing? Contact Support</Button>
        </Link>
      </div>
    </div>
  );
};

