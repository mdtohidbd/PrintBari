import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera,
  CreditCard,
  FileText,
  FileSpreadsheet,
  PenTool,
  Printer,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  ShieldCheck,
  TrendingUp,
  Zap,
  Users,
  Building,
  Check,
  HelpCircle,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { HeroPreviewMockup } from '../components/marketing/HeroPreviewMockup';
import { Accordion } from '../components/common/Accordion';

export const HomePage: React.FC = () => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const mainFeatures = [
    {
      icon: Camera,
      title: 'Passport Photo Studio',
      description:
        'Instant AI background replacement (White, Blue, Grey), biometric face centering, and automatic 4×6 / A4 cut-sheet layout generation with precision cut guides.',
      tag: '10-Second Processing',
      color: 'from-blue-500 to-indigo-600',
    },
    {
      icon: CreditCard,
      title: 'Smart ID Card Dual-Side A4',
      description:
        'Eliminate manual copy-paste in Photoshop. Automatically stitch front and back of National ID, Aadhaar, and Smart Cards onto a single A4 sheet with 1, 2, or 4 copies.',
      tag: 'Zero Misalignment',
      color: 'from-indigo-500 to-violet-600',
    },
    {
      icon: FileText,
      title: 'Document A4 Dewarping',
      description:
        'Turn messy camera scans into crisp, flat 300 DPI multi-page documents with automatic perspective deskewing and shadow elimination.',
      tag: 'Flatbed Scanner Quality',
      color: 'from-emerald-500 to-teal-600',
    },
    {
      icon: FileSpreadsheet,
      title: 'Instant CV & Bio-Data Builder',
      description:
        'Create professional, job-ready resume and bio-data PDFs for walk-in job seekers in 3 minutes with pre-formatted multilingual templates.',
      tag: 'ATS-Friendly Formats',
      color: 'from-amber-500 to-orange-600',
    },
    {
      icon: PenTool,
      title: 'Handwriting to Word (OCR)',
      description:
        'Convert handwritten customer notes, applications, and legal drafts directly into editable Microsoft Word (.docx) files using high-precision vision AI.',
      tag: '99% Text Accuracy',
      color: 'from-rose-500 to-pink-600',
    },
    {
      icon: Printer,
      title: 'Desktop Print Spooler Bridge',
      description:
        'Direct cloud-to-hardware printing without OS browser print dialog delays. Automatically routes 4×6 photo sheets to dye-sub printers and A4 jobs to laser copiers.',
      tag: '1-Click Direct Print',
      color: 'from-cyan-500 to-blue-600',
    },
  ];

  const steps = [
    {
      num: '01',
      title: 'Intake Walk-In Customer',
      desc: 'Enter customer phone number, choose the desired service, and upload camera scan or mobile capture.',
    },
    {
      num: '02',
      title: '1-Click Studio Processing',
      desc: 'DocuStudio auto-crops, centers faces, replaces backgrounds, and lays out print-ready sheets in seconds.',
    },
    {
      num: '03',
      title: 'Direct Hardware Dispatch',
      desc: 'Hit print once. The local desktop bridge agent routes the file straight to the connected printer tray.',
    },
    {
      num: '04',
      title: 'Digital Delivery & POS Receipt',
      desc: 'Customer receives digital copies via automated WhatsApp link while you collect cash or UPI at the counter.',
    },
  ];

  const supportedServices = [
    { name: 'Passport & Visa Photos', specs: 'US 2x2, Schengen, Indian, BD Specs' },
    { name: 'National ID & Smart Cards', specs: 'Single A4, 2-up, 4-up government packs' },
    { name: 'Academic Bio-Data & Resumes', specs: 'English, Bengali, Arabic templates' },
    { name: 'Legal Deed & Land Scans', specs: 'Deskewed contrast-boosted A4' },
    { name: 'Handwritten Application to Word', specs: 'Clean editable .docx generation' },
    { name: 'Lamination & Cut Sheet Layouts', specs: 'With standard cut guidelines' },
  ];

  const demoTestimonials = [
    {
      quote:
        'Before DocuStudio, making an 8-pack passport photo sheet took me 12 minutes in cracked Photoshop. Now, my junior assistant does it in 15 seconds flat. Walk-in customers are amazed.',
      author: 'Rafiqul Islam',
      role: 'Owner, Metro Digital Studio & Cyber Café',
      location: 'Dhaka, Bangladesh',
      badge: 'Verified Beta Shop',
    },
    {
      quote:
        'The ID Card dual-side feature alone saves us 2 hours every day during college admission season. No more scanning front and back separately and wrestling with alignment.',
      author: 'Sunil Sharma',
      role: 'Shop Manager, Apex Xerox & Multi-Service Center',
      location: 'Kolkata, India',
      badge: 'Early Adopter Shop',
    },
    {
      quote:
        'The desktop print bridge is brilliant. We don’t have to open the Windows print dialog every time. We just click Print and the Epson photo printer immediately starts spinning.',
      author: 'Tariq Al-Mansoor',
      role: 'Proprietor, Gulf Fast Print & Typing Center',
      location: 'Dubai, UAE',
      badge: 'Commercial Print Beta',
    },
  ];

  const faqItems = [
    {
      id: 'faq-1',
      question: 'What hardware printers does DocuStudio support?',
      answer:
        'DocuStudio supports all standard Windows, macOS, and Linux printers via our native lightweight Print Bridge agent. This includes thermal receipt printers (POS-58/80), dye-sub photo printers (DNP, Citizen, HiTi), inkjet photo printers (Epson L805, Canon G-series), and high-volume commercial laser copiers (Canon imageRUNNER, Xerox, Ricoh, Konica Minolta).',
    },
    {
      id: 'faq-2',
      question: 'Do I need graphic design or Photoshop skills to operate this?',
      answer:
        'Not at all. DocuStudio is purpose-built so that any front-desk counter staff can produce studio-grade passport sheets, dual-sided ID layouts, and resumes with zero graphic design training.',
    },
    {
      id: 'faq-3',
      question: 'How does customer document privacy work?',
      answer:
        'We enforce a strict Zero-Retention Biometric Policy. Customer identity documents, national IDs, and biometric photos are automatically purged from secure cloud storage after 24 hours. Your shop retains complete control.',
    },
    {
      id: 'faq-4',
      question: 'Can multiple computers in my shop share the same subscription?',
      answer:
        'Yes! The Professional and Enterprise plans support multiple staff seats so your intake counter PC, editor workstation, and printing terminal can work simultaneously on the same live job queue.',
    },
    {
      id: 'faq-5',
      question: 'Can I try DocuStudio before purchasing?',
      answer:
        'Yes, we offer a 14-day fully featured free trial with no credit card required. You can test passport layouts, ID card stitching, and the print bridge immediately in your shop.',
    },
  ];

  return (
    <div className="space-y-24 sm:space-y-32">
      {/* 1. Hero Section */}
      <section className="relative pt-12 pb-6 overflow-hidden">
        {/* Background Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-brand-100/50 via-indigo-50/20 to-transparent blur-3xl pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          {/* Announcement Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-xs sm:text-sm font-medium animate-fadeIn">
            <Sparkles className="w-4 h-4 text-brand-600" />
            <span>Next-Gen Operating System for Photocopy & Photo Studios</span>
            <span className="hidden sm:inline-block text-brand-300">|</span>
            <span className="hidden sm:inline-block font-semibold">Phase 2 Cloud Engine</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-slate-900 tracking-tight leading-[1.1] max-w-4xl mx-auto">
            Process Walk-In Documents{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 via-indigo-600 to-violet-600">
              in 10 Seconds Flat.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed">
            Replace slow manual Photoshop work. Generate 8-up passport photo sheets, stitch dual-sided ID cards on A4, convert handwritten drafts to Word, and print directly to your shop printers with zero hassle.
          </p>

          {/* Call to Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-2">
            <Link to="/register" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto text-base shadow-lg shadow-brand-500/20" rightIcon={<ArrowRight className="w-5 h-5" />}>
                Start 14-Day Free Trial
              </Button>
            </Link>
            <Link to="/dashboard" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full sm:w-auto text-base border-slate-300">
                Explore Live Demo OS
              </Button>
            </Link>
          </div>

          {/* Trust Guarantees */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm text-slate-500 font-medium pt-3">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> No Credit Card Required
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Compatible with All Printers
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Zero Graphic Skills Needed
            </span>
          </div>

          {/* Interactive Hero Product Mockup */}
          <div className="pt-6">
            <HeroPreviewMockup />
          </div>
        </div>
      </section>

      {/* 2. Product Overview & Metric Highlights */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-slate-900 text-white p-8 sm:p-12 shadow-2xl relative overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 divide-y md:divide-y-0 md:divide-x divide-slate-800">
            <div className="space-y-2 text-center md:text-left md:pr-4">
              <p className="text-3xl sm:text-4xl font-extrabold text-brand-400">10x</p>
              <h4 className="text-base font-semibold text-white">Faster Processing</h4>
              <p className="text-xs text-slate-400">
                Turn 15 minutes of manual Photoshop manipulation into a 15-second 1-click export.
              </p>
            </div>
            <div className="space-y-2 text-center md:text-left md:px-6 pt-6 md:pt-0">
              <p className="text-3xl sm:text-4xl font-extrabold text-indigo-400">99.8%</p>
              <h4 className="text-base font-semibold text-white">Biometric Compliance</h4>
              <p className="text-xs text-slate-400">
                Guaranteed passport & visa standard compliance for US, Schengen, Indian, and GCC guidelines.
              </p>
            </div>
            <div className="space-y-2 text-center md:text-left md:px-6 pt-6 md:pt-0">
              <p className="text-3xl sm:text-4xl font-extrabold text-emerald-400">Zero</p>
              <h4 className="text-base font-semibold text-white">Paper Waste</h4>
              <p className="text-xs text-slate-400">
                Exact millimeter print scaling and cut line marks eliminate expensive photo paper misprints.
              </p>
            </div>
            <div className="space-y-2 text-center md:text-left md:pl-6 pt-6 md:pt-0">
              <p className="text-3xl sm:text-4xl font-extrabold text-amber-400">1-Click</p>
              <h4 className="text-base font-semibold text-white">Direct Spooling</h4>
              <p className="text-xs text-slate-400">
                Local desktop bridge dispatches jobs directly to connected USB or LAN printers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Main Features Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <Badge variant="primary">Built for Shop Floor Speed</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Six Specialized Micro-Studios Under One Roof
          </h2>
          <p className="text-slate-600 text-sm sm:text-base">
            Every tool is engineered for speed, accuracy, and ease of use by non-technical shop operators.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {mainFeatures.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm hover:shadow-xl hover:border-brand-300 transition-all group flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-semibold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-full border border-brand-200">
                      {feat.tag}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                    {feat.title}
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    {feat.description}
                  </p>
                </div>
                <div className="pt-6 border-t border-slate-100 mt-6 flex items-center justify-between text-xs font-semibold text-brand-600">
                  <Link to="/features" className="hover:underline flex items-center gap-1">
                    <span>Learn studio details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. How It Works Workflow */}
      <section className="bg-slate-100/70 py-20 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <Badge variant="neutral">Seamless Operations</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              From Customer Walk-In to Finished Printout
            </h2>
            <p className="text-slate-600 text-sm sm:text-base">
              A streamlined 4-step workflow that keeps your queue moving and eliminates customer wait times.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, idx) => (
              <div
                key={idx}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative space-y-3"
              >
                <div className="text-3xl font-extrabold text-brand-600 font-mono">
                  {step.num}
                </div>
                <h4 className="text-base font-bold text-slate-900">{step.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Supported Services */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
            Supported Walk-In Service Categories
          </h2>
          <p className="text-slate-600 text-sm">
            Everything your digital studio or photocopy counter handles on a daily basis.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {supportedServices.map((svc, idx) => (
            <div
              key={idx}
              className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs flex items-center justify-between"
            >
              <div>
                <p className="font-bold text-slate-900 text-sm">{svc.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{svc.specs}</p>
              </div>
              <Check className="w-5 h-5 text-emerald-500 shrink-0 ml-3" />
            </div>
          ))}
        </div>
      </section>

      {/* 6. Pricing Plans */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <Badge variant="primary">Simple, Transparent Pricing</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Plans Designed to Pay for Themselves in Days
          </h2>
          <p className="text-slate-600 text-sm">
            No long-term contracts. Upgrade, downgrade, or cancel at any time.
          </p>

          {/* Billing Switch */}
          <div className="pt-4 flex items-center justify-center gap-3">
            <span className={`text-sm font-semibold ${billingCycle === 'monthly' ? 'text-slate-900' : 'text-slate-400'}`}>
              Monthly
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
              <span>Annual</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                Save 20%
              </span>
            </span>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {/* Starter Plan */}
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Starter Kiosk
              </span>
              <h3 className="text-2xl font-bold text-slate-900">Solo Photocopy Shop</h3>
              <p className="text-xs text-slate-500">
                Ideal for 1-operator xerox kiosks and small neighborhood typing centers.
              </p>
              <div className="pt-2 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-slate-900">
                  {billingCycle === 'monthly' ? '$15' : '$12'}
                </span>
                <span className="text-xs text-slate-500 font-medium">/ month</span>
              </div>
              <ul className="space-y-3 pt-4 text-xs text-slate-700">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" /> 1 Branch & 2 Staff Seats
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" /> 300 Passport & ID Layouts / mo
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" /> 50 AI OCR Pages / mo
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" /> Thermal POS Receipt Printing
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" /> Standard Email Support
                </li>
              </ul>
            </div>
            <Link to="/register">
              <Button variant="outline" className="w-full justify-center">
                Get Started Free
              </Button>
            </Link>
          </div>

          {/* Professional Plan (Highlighted) */}
          <div className="rounded-2xl border-2 border-brand-600 bg-white p-8 shadow-xl flex flex-col justify-between space-y-6 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Most Popular
            </div>
            <div className="space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
                Professional Studio
              </span>
              <h3 className="text-2xl font-bold text-slate-900">Digital Photo Studio</h3>
              <p className="text-xs text-slate-500">
                For busy studios and cyber cafés with multiple editing and counter stations.
              </p>
              <div className="pt-2 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-slate-900">
                  {billingCycle === 'monthly' ? '$39' : '$31'}
                </span>
                <span className="text-xs text-slate-500 font-medium">/ month</span>
              </div>
              <ul className="space-y-3 pt-4 text-xs text-slate-700">
                <li className="flex items-center gap-2 font-medium">
                  <Check className="w-4 h-4 text-emerald-500" /> Unlimited Passport & ID Layouts
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" /> Up to 6 Staff Accounts
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" /> 300 AI OCR Pages / mo
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" /> Native Desktop Print Bridge Agent
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" /> Live WebSocket Kanban Queue
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" /> WhatsApp Customer Delivery Links
                </li>
              </ul>
            </div>
            <Link to="/register">
              <Button className="w-full justify-center">
                Start 14-Day Free Trial
              </Button>
            </Link>
          </div>

          {/* Enterprise Plan */}
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Multi-Branch
              </span>
              <h3 className="text-2xl font-bold text-slate-900">Chain & Print Centers</h3>
              <p className="text-xs text-slate-500">
                For multi-branch photocopy businesses, universities, and commercial printing hubs.
              </p>
              <div className="pt-2 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-slate-900">
                  {billingCycle === 'monthly' ? '$89' : '$72'}
                </span>
                <span className="text-xs text-slate-500 font-medium">/ month</span>
              </div>
              <ul className="space-y-3 pt-4 text-xs text-slate-700">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" /> Up to 4 Physical Branches
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" /> Unlimited Staff & Operators
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" /> 1,000 AI OCR Pages / mo
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" /> Consolidated Multi-Store POS Reports
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" /> Custom Watermarks & Branding
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" /> Priority 24/7 Phone & WhatsApp Support
                </li>
              </ul>
            </div>
            <Link to="/contact">
              <Button variant="outline" className="w-full justify-center">
                Contact Enterprise Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 7. Clearly Labeled Demo Testimonials */}
      <section className="bg-slate-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-400 bg-brand-950/80 px-3 py-1 rounded-full border border-brand-800">
              Early Adopter Feedback (Pilot Demo Studies)
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Loved by Busy Shop Owners and Counter Operators
            </h2>
            <p className="text-slate-400 text-sm">
              Real feedback gathered from our 10-shop closed beta pilot program across digital studios and xerox centers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {demoTestimonials.map((t, idx) => (
              <div
                key={idx}
                className="bg-slate-800/80 border border-slate-700/80 p-7 rounded-2xl flex flex-col justify-between space-y-6 shadow-lg"
              >
                <p className="text-slate-300 text-sm leading-relaxed italic">
                  "{t.quote}"
                </p>
                <div className="pt-4 border-t border-slate-700/60">
                  <p className="font-bold text-white text-sm">{t.author}</p>
                  <p className="text-xs text-brand-400 font-medium">{t.role}</p>
                  <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                    <span>{t.location}</span>
                    <span className="text-emerald-400 font-medium bg-emerald-950 px-2 py-0.5 rounded border border-emerald-900">
                      {t.badge}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Interactive FAQ Accordion */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center space-y-3">
          <Badge variant="neutral">Got Questions?</Badge>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-slate-600 text-sm">
            Everything you need to know about setting up DocuStudio in your shop.
          </p>
        </div>

        <Accordion items={faqItems} />

        <div className="text-center pt-4">
          <p className="text-xs text-slate-500">
            Have a custom hardware setup or need advice?{' '}
            <Link to="/contact" className="text-brand-600 font-semibold hover:underline">
              Talk to our technical support team →
            </Link>
          </p>
        </div>
      </section>

      {/* 9. Final CTA Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="rounded-3xl bg-gradient-to-tr from-brand-700 via-brand-600 to-indigo-700 p-8 sm:p-14 text-white text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Ready to Double Your Shop's Document Processing Capacity?
            </h2>
            <p className="text-brand-100 text-sm sm:text-base leading-relaxed">
              Join hundreds of forward-thinking photocopy shops and digital studios modernizing their daily walk-in workflow with DocuStudio.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link to="/register" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-white text-brand-700 hover:bg-slate-100 shadow-md font-bold"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Start Free 14-Day Trial
              </Button>
            </Link>
            <Link to="/pricing" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto border-white text-white hover:bg-white/10"
              >
                View Detailed Pricing
              </Button>
            </Link>
          </div>
          <p className="text-[11px] text-brand-200">
            Instant setup • No credit card required • Cancel anytime
          </p>
        </div>
      </section>
    </div>
  );
};
