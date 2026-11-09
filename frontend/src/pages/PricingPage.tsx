import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X, Sparkles, Calculator, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';

export const PricingPage: React.FC = () => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  // ROI Calculator state
  const [dailyCustomers, setDailyCustomers] = useState<number>(35);
  const [feePerJob, setFeePerJob] = useState<number>(3.5);

  const monthlyJobs = dailyCustomers * 26; // 26 working days
  const timeSavedHours = Math.round((monthlyJobs * 10) / 60); // saving 10 mins per job
  const additionalPotentialRevenue = Math.round(monthlyJobs * feePerJob * 0.25); // 25% capacity boost

  const plans = [
    {
      name: 'Starter Kiosk',
      tagline: 'For solo photocopy shops & Xerox kiosks',
      monthlyPrice: 15,
      annualPrice: 12,
      popular: false,
      features: [
        { name: '1 Branch & 2 Staff Seats', included: true },
        { name: '300 Passport & ID Layouts / mo', included: true },
        { name: '50 AI OCR Pages / mo', included: true },
        { name: 'POS Thermal Receipt Printing', included: true },
        { name: 'Standard 300 DPI Export', included: true },
        { name: 'Desktop Direct Print Agent', included: false },
        { name: 'Live Kanban Work Queue', included: false },
        { name: 'Automated WhatsApp Delivery', included: false },
        { name: 'Multi-Store Consolidated Reports', included: false },
      ],
      ctaText: 'Start 14-Day Free Trial',
      ctaVariant: 'outline' as const,
    },
    {
      name: 'Professional Studio',
      tagline: 'For busy digital photo studios & cyber cafés',
      monthlyPrice: 39,
      annualPrice: 31,
      popular: true,
      features: [
        { name: '1 Branch & Up to 6 Staff Seats', included: true },
        { name: 'Unlimited Passport & ID Layouts', included: true },
        { name: '300 AI OCR Pages / mo', included: true },
        { name: 'POS Thermal Receipt Printing', included: true },
        { name: 'Standard 300 DPI Export', included: true },
        { name: 'Desktop Direct Print Agent', included: true },
        { name: 'Live Kanban Work Queue', included: true },
        { name: 'Automated WhatsApp Delivery', included: true },
        { name: 'Multi-Store Consolidated Reports', included: false },
      ],
      ctaText: 'Start 14-Day Free Trial',
      ctaVariant: 'primary' as const,
    },
    {
      name: 'Multi-Branch Enterprise',
      tagline: 'For chains, university kiosks & commercial print hubs',
      monthlyPrice: 89,
      annualPrice: 72,
      popular: false,
      features: [
        { name: 'Up to 4 Branches & Unlimited Staff', included: true },
        { name: 'Unlimited Passport & ID Layouts', included: true },
        { name: '1,000 AI OCR Pages / mo', included: true },
        { name: 'POS Thermal Receipt Printing', included: true },
        { name: 'Standard 300 DPI Export', included: true },
        { name: 'Desktop Direct Print Agent', included: true },
        { name: 'Live Kanban Work Queue', included: true },
        { name: 'Automated WhatsApp Delivery', included: true },
        { name: 'Multi-Store Consolidated Reports', included: true },
      ],
      ctaText: 'Contact Enterprise Sales',
      ctaVariant: 'outline' as const,
    },
  ];

  return (
    <div className="py-16 space-y-24">
      {/* Header */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <Badge variant="primary">Clear & Predictable Plans</Badge>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight max-w-3xl mx-auto">
          Invest in Speed. Watch Your Shop Turnover Grow.
        </h1>
        <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
          All plans include 14 days of free access with full studio capabilities. Zero upfront setup fees.
        </p>

        {/* Billing Switch */}
        <div className="pt-4 flex items-center justify-center gap-3">
          <span className={`text-sm font-semibold ${billingCycle === 'monthly' ? 'text-slate-900' : 'text-slate-400'}`}>
            Monthly Billing
          </span>
          <button
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
            className="w-14 h-7 rounded-full bg-brand-600 p-1 flex items-center transition-all cursor-pointer"
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-all ${
                billingCycle === 'annual' ? 'translate-x-7' : 'translate-x-0'
              }`}
            />
          </button>
          <span className={`text-sm font-semibold flex items-center gap-1.5 ${billingCycle === 'annual' ? 'text-slate-900' : 'text-slate-400'}`}>
            <span>Annual Billing</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
              Save 20%
            </span>
          </span>
        </div>
      </section>

      {/* Pricing Cards Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {plans.map((p, idx) => (
            <div
              key={idx}
              className={`rounded-3xl border bg-white p-8 sm:p-10 shadow-sm flex flex-col justify-between space-y-8 relative ${
                p.popular
                  ? 'border-2 border-brand-600 shadow-xl ring-1 ring-brand-500/20'
                  : 'border-slate-200'
              }`}
            >
              {p.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-[11px] font-bold px-4 py-1 rounded-full uppercase tracking-wider shadow-sm">
                  Recommended for Studios
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">{p.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">{p.tagline}</p>
                </div>

                <div className="flex items-baseline gap-1 pt-2">
                  <span className="text-4xl sm:text-5xl font-extrabold text-slate-900">
                    ${billingCycle === 'monthly' ? p.monthlyPrice : p.annualPrice}
                  </span>
                  <span className="text-sm text-slate-500 font-medium">/ month</span>
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Included Capabilities:
                  </p>
                  <ul className="space-y-3 text-xs sm:text-sm">
                    {p.features.map((f, fIdx) => (
                      <li
                        key={fIdx}
                        className={`flex items-center gap-2.5 ${
                          f.included ? 'text-slate-700' : 'text-slate-400 line-through'
                        }`}
                      >
                        {f.included ? (
                          <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <X className="w-4 h-4 text-slate-300 shrink-0" />
                        )}
                        <span>{f.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <Link to="/register">
                <Button
                  variant={p.ctaVariant}
                  className="w-full justify-center text-sm py-2.5"
                >
                  {p.ctaText}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive Shop ROI Calculator */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-slate-900 text-white p-8 sm:p-12 shadow-2xl border border-slate-800 space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600/30 text-brand-400 flex items-center justify-center">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-white">
                Shop Profitability & Time Saved Calculator
              </h3>
              <p className="text-xs text-slate-400">
                Estimate how much operational time and extra walk-in revenue DocuStudio generates for your counter.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center pt-4">
            {/* Sliders Input */}
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-300 font-medium">Daily Walk-In Customers:</span>
                  <span className="font-bold text-brand-400 font-mono text-base">
                    {dailyCustomers} customers/day
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="150"
                  step="5"
                  value={dailyCustomers}
                  onChange={(e) => setDailyCustomers(Number(e.target.value))}
                  className="w-full accent-brand-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-300 font-medium">Avg. Price per Document/Photo Job:</span>
                  <span className="font-bold text-emerald-400 font-mono text-base">
                    ${feePerJob.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="15"
                  step="0.5"
                  value={feePerJob}
                  onChange={(e) => setFeePerJob(Number(e.target.value))}
                  className="w-full accent-emerald-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Calculations Output */}
            <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700/80 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <span className="text-xs text-slate-400">Monthly Time Saved:</span>
                <span className="text-xl font-extrabold text-brand-400 font-mono">
                  ~{timeSavedHours} Hours
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <span className="text-xs text-slate-400">Est. Additional Capacity Revenue:</span>
                <span className="text-xl font-extrabold text-emerald-400 font-mono">
                  +${additionalPotentialRevenue.toLocaleString()} / mo
                </span>
              </div>
              <div className="text-[11px] text-slate-400 italic pt-1">
                *Based on reducing average job processing time from 12 minutes to under 2 minutes.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Comparison Matrix Table */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center space-y-2">
          <h3 className="text-2xl font-bold text-slate-900">
            Detailed Feature Comparison Matrix
          </h3>
          <p className="text-xs text-slate-500">
            Compare capabilities across tiers to pick the right match for your setup.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200">
                <th className="p-4 font-bold text-slate-900 w-2/5">Capabilities</th>
                <th className="p-4 font-bold text-slate-900 text-center w-1/5">Starter ($15)</th>
                <th className="p-4 font-bold text-brand-600 text-center w-1/5 bg-brand-50/40">
                  Professional ($39)
                </th>
                <th className="p-4 font-bold text-slate-900 text-center w-1/5">Enterprise ($89)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="p-4 font-medium">Passport Photo Layout Engine (4x6 / A4)</td>
                <td className="p-4 text-center">300 / mo</td>
                <td className="p-4 text-center font-bold text-brand-600 bg-brand-50/40">Unlimited</td>
                <td className="p-4 text-center font-bold">Unlimited</td>
              </tr>
              <tr>
                <td className="p-4 font-medium">ID Card Dual-Side A4 Auto-Stitch</td>
                <td className="p-4 text-center">300 / mo</td>
                <td className="p-4 text-center font-bold text-brand-600 bg-brand-50/40">Unlimited</td>
                <td className="p-4 text-center font-bold">Unlimited</td>
              </tr>
              <tr>
                <td className="p-4 font-medium">AI Handwriting to Word (OCR Pages)</td>
                <td className="p-4 text-center">50 Pages</td>
                <td className="p-4 text-center font-bold text-brand-600 bg-brand-50/40">300 Pages</td>
                <td className="p-4 text-center font-bold">1,000 Pages</td>
              </tr>
              <tr>
                <td className="p-4 font-medium">Staff Accounts & Role Permissions</td>
                <td className="p-4 text-center">2 Seats</td>
                <td className="p-4 text-center font-bold text-brand-600 bg-brand-50/40">6 Seats</td>
                <td className="p-4 text-center font-bold">Unlimited</td>
              </tr>
              <tr>
                <td className="p-4 font-medium">Physical Shop Branches</td>
                <td className="p-4 text-center">1 Store</td>
                <td className="p-4 text-center font-bold text-brand-600 bg-brand-50/40">1 Store</td>
                <td className="p-4 text-center font-bold">Up to 4 Stores</td>
              </tr>
              <tr>
                <td className="p-4 font-medium">Desktop Direct Print Spooler Agent</td>
                <td className="p-4 text-center text-slate-400">—</td>
                <td className="p-4 text-center text-emerald-600 font-bold bg-brand-50/40">Included</td>
                <td className="p-4 text-center text-emerald-600 font-bold">Included</td>
              </tr>
              <tr>
                <td className="p-4 font-medium">Automated WhatsApp Pickup Links</td>
                <td className="p-4 text-center text-slate-400">—</td>
                <td className="p-4 text-center text-emerald-600 font-bold bg-brand-50/40">Included</td>
                <td className="p-4 text-center text-emerald-600 font-bold">Included</td>
              </tr>
              <tr>
                <td className="p-4 font-medium">Customer Data 24H Auto-Purge Policy</td>
                <td className="p-4 text-center text-emerald-600 font-bold">Included</td>
                <td className="p-4 text-center text-emerald-600 font-bold bg-brand-50/40">Included</td>
                <td className="p-4 text-center text-emerald-600 font-bold">Included</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

