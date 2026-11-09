import React from 'react';
import { Link } from 'react-router-dom';
import {
  Camera,
  CreditCard,
  FileText,
  FileSpreadsheet,
  PenTool,
  Printer,
  CheckCircle2,
  Cpu,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
  Sliders,
  Scissors,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';

export const FeaturesPage: React.FC = () => {
  const featureList = [
    {
      id: 'passport-studio',
      badge: 'Micro-Engine 01',
      title: 'Passport & Visa Photo Studio',
      subtitle: 'From amateur phone capture to biometric compliance in 5 seconds',
      description:
        'DocuStudio eliminates manual lasso cutting and background replacement. Our neural segmentation model detects facial landmarks, adjusts eye-level horizon, removes distracting backgrounds with hair-strand precision, and arranges multi-copy grids.',
      capabilities: [
        'Pre-loaded standard dimension presets: US 2x2 in, 35x45 mm (Schengen / UK / India), 40x50 mm, etc.',
        'Instant background swap: Pure Studio White, Sky Blue, Cool Grey, or custom hex color.',
        'Automated 4x6 / A4 cut sheets with 4, 8, 12, or 16 photo multi-packs.',
        'Precision cutting guidelines to assist counter staff with manual paper cutters.',
        'Automatic contrast and exposure enhancement for flat lighting conditions.',
      ],
      icon: Camera,
      tagColor: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    {
      id: 'id-card-processor',
      badge: 'Micro-Engine 02',
      title: 'Smart ID Card Dual-Side A4 Processor',
      subtitle: 'Front and Back auto-detection, cropping, and single-click alignment',
      description:
        'Photocopying a national identity card, driving license, or health card typically requires placing the card, scanning side A, flipping the paper or card, and hoping both align nicely. DocuStudio automates the entire process digitally.',
      capabilities: [
        'Single-pass flatbed or dual smartphone photo intake.',
        'Auto-boundary detection and perspective deskewing for skewed card scans.',
        'Standard single A4 center alignment (Front on top, Back on bottom).',
        'Multiple copy layouts (2-up, 4-up government submission packs on 1 sheet).',
        'High-contrast B&W thresholding mode optimized for crisp laser copier printing.',
      ],
      icon: CreditCard,
      tagColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    },
    {
      id: 'doc-dewarp',
      badge: 'Micro-Engine 03',
      title: 'Document A4 Dewarping & Enhancement',
      subtitle: 'Transform mobile camera photos into scanner-grade 300 DPI PDFs',
      description:
        'When customers bring crumpled papers, deeds, certificates, or book pages photographed on their mobile phones, DocuStudio’s computer vision engine flattens curbed pages and scrubs away finger shadows.',
      capabilities: [
        '4-point contour detection with manual corner adjustment pins.',
        'Shadow and glare removal algorithm for glossy documents.',
        'One-click convert to Greyscale, High-Contrast Black & White, or Full Color.',
        'Multi-page PDF compilation with custom shop header/watermark option.',
      ],
      icon: FileText,
      tagColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    {
      id: 'cv-builder',
      badge: 'Micro-Engine 04',
      title: 'Interactive CV & Bio-Data Builder',
      subtitle: 'Serve walk-in job seekers in minutes with formatted professional resumes',
      description:
        'Small computer kiosks often draft CVs manually in MS Word, fighting tables and indentation bugs. DocuStudio provides a fast, structured form interface that generates ATS-friendly vector PDFs instantly.',
      capabilities: [
        'Pre-built templates for entry-level, technical, driver, sales, and overseas jobs.',
        'Multilingual support for English, Arabic, Bengali, and regional languages.',
        'Real-time live PDF preview as staff types.',
        'Direct 1-click export to print and WhatsApp sharing link for the customer.',
      ],
      icon: FileSpreadsheet,
      tagColor: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    {
      id: 'handwriting-ocr',
      badge: 'Micro-Engine 05',
      title: 'Handwriting to Word (.docx) Engine',
      subtitle: 'Vision AI OCR that parses handwritten drafts into editable Word documents',
      description:
        'When legal practitioners, students, or clerks bring handwritten applications, memos, or contracts to be typed, DocuStudio uses high-accuracy vision AI models to digitize the handwriting into cleanly structured Microsoft Word files.',
      capabilities: [
        'High OCR accuracy across diverse handwriting styles and cursive scripts.',
        'Preserves paragraphs, bullet points, headers, and numbered lists.',
        'Direct download as `.docx` file ready for quick editing in MS Word or LibreOffice.',
        'Built-in text editor to review and edit recognized text side-by-side with original scan.',
      ],
      icon: PenTool,
      tagColor: 'bg-rose-50 text-rose-700 border-rose-200',
    },
    {
      id: 'print-bridge',
      badge: 'Micro-Engine 06',
      title: 'Desktop Print Spooler Bridge Agent',
      subtitle: 'True 1-click direct printing to connected USB and LAN printers',
      description:
        'Web browsers are notoriously clunky for commercial printing because they pop up native print dialogs and cannot easily route specific paper trays. DocuStudio includes a lightweight background agent that speaks directly to the OS print spooler.',
      capabilities: [
        'Compatible with Windows Spooler (Winspool/GDI) and Linux/macOS (CUPS).',
        'Automatic paper-tray routing: 4x6 photo paper to photo printer; A4 to laser copier.',
        'Silent direct printing without manual browser print dialogues.',
        'Paper waste and print volume tracking for shop accounting.',
      ],
      icon: Printer,
      tagColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    },
  ];

  return (
    <div className="py-16 space-y-24">
      {/* Header */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <Badge variant="primary">Comprehensive Feature Catalog</Badge>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight max-w-3xl mx-auto">
          Every Tool Your Shop Needs to Work at 10x Speed
        </h1>
        <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
          Explore the full suite of specialized micro-engines engineered specifically for photocopy kiosks, digital photo studios, and typing centers.
        </p>
      </section>

      {/* Feature Deep Dives */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {featureList.map((feat, idx) => {
          const Icon = feat.icon;
          const isReversed = idx % 2 === 1;

          return (
            <div
              key={feat.id}
              className={`rounded-3xl border border-slate-200/90 bg-white p-8 sm:p-12 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center`}
            >
              <div
                className={`space-y-5 lg:col-span-7 ${
                  isReversed ? 'lg:order-2' : 'lg:order-1'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full border ${feat.tagColor}`}
                  >
                    {feat.badge}
                  </span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  {feat.title}
                </h3>
                <p className="text-sm font-semibold text-brand-600">
                  {feat.subtitle}
                </p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {feat.description}
                </p>

                <div className="pt-2 space-y-2.5">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Key Capabilities:
                  </h5>
                  <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
                    {feat.capabilities.map((cap, cIdx) => (
                      <li key={cIdx} className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{cap}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Graphic Visual Representation */}
              <div
                className={`lg:col-span-5 bg-slate-50 rounded-2xl p-6 sm:p-8 border border-slate-200 flex flex-col items-center justify-center text-center space-y-4 ${
                  isReversed ? 'lg:order-1' : 'lg:order-2'
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-white shadow-md border border-slate-200 flex items-center justify-center text-brand-600">
                  <Icon className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-800 text-base">{feat.title}</h4>
                  <p className="text-xs text-slate-500">
                    Production Engine Ready for High-Volume Duty
                  </p>
                </div>
                <div className="w-full bg-white rounded-xl p-3 border border-slate-200 text-left text-xs font-mono space-y-1">
                  <div className="flex justify-between text-slate-500">
                    <span>Processing SLA:</span>
                    <span className="font-bold text-emerald-600">&lt; 3 Seconds</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Export Quality:</span>
                    <span className="font-bold text-slate-800">300 DPI Vector PDF</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Hardware Target:</span>
                    <span className="font-bold text-slate-800">Auto-Detect Tray</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* CTA Bottom */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <h2 className="text-3xl font-bold text-slate-900">
          Experience the Studio Tools in Action
        </h2>
        <p className="text-slate-600 text-sm">
          Try DocuStudio free for 14 days and see how quickly your shop queue moves.
        </p>
        <div className="flex justify-center gap-4">
          <Link to="/register">
            <Button size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
              Start Free Trial
            </Button>
          </Link>
          <Link to="/pricing">
            <Button variant="outline" size="lg">
              Compare All Plans
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};

