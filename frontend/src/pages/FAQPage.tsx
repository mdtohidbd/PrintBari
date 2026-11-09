import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, HelpCircle, ArrowRight, Printer, ShieldCheck, Zap, DollarSign } from 'lucide-react';
import { Accordion, AccordionItem } from '../components/common/Accordion';
import { Badge } from '../components/common/Badge';

export const FAQPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const allFaqs: AccordionItem[] = [
    {
      id: 'faq-1',
      category: 'hardware',
      question: 'What hardware printers and paper sizes are supported?',
      answer:
        'DocuStudio supports all major desktop and network printers via our native Desktop Print Spooler Agent. This includes Canon imageRUNNER, Xerox WorkCentre, Ricoh Aficio, Konica Minolta copiers, Epson L-series photo printers (e.g. L805, L1800), and DNP dye-sub printers. Paper sizes include standard A4, 4×6 inch, 5×7 inch, Letter, Legal, and thermal 58mm/80mm receipt rolls.',
    },
    {
      id: 'faq-2',
      category: 'hardware',
      question: 'Does the printing require clicking the browser print dialog every time?',
      answer:
        'No. When running the DocuStudio Desktop Print Bridge agent, print jobs are dispatched directly to the operating system spooler (Winspool on Windows, CUPS on Linux/macOS) in the background with zero pop-ups.',
    },
    {
      id: 'faq-3',
      category: 'studio',
      question: 'How accurate is the Passport Photo background removal?',
      answer:
        'Our computer vision model achieves over 99.8% precision, segmenting fine hair strands, spectacles, and clothing edges cleanly. You can preview and swap between pure studio white, light blue, and grey with a single click.',
    },
    {
      id: 'faq-4',
      category: 'studio',
      question: 'How does the ID Card dual-side feature work without manual alignment?',
      answer:
        'You can either place both sides of the card on a scanner flatbed or upload two smartphone captures. The engine auto-detects card bounds, deskews perspective distortion, levels the orientation, and formats both front and back onto one standard A4 sheet.',
    },
    {
      id: 'faq-5',
      category: 'security',
      question: 'What happens to customer photos and sensitive identity documents?',
      answer:
        'We enforce a strict Zero-Retention Biometric Policy. Customer scans and photos are automatically and permanently purged from cloud storage after 24 hours. No customer documents are retained or shared.',
    },
    {
      id: 'faq-6',
      category: 'security',
      question: 'Is customer data accessible by DocuStudio or other shops?',
      answer:
        'Never. Our architecture employs strict multi-tenant database isolation. Each shop operates in its own isolated cryptographic namespace. Super Admin access does not expose customer files.',
    },
    {
      id: 'faq-7',
      category: 'billing',
      question: 'Can I cancel or switch my subscription at any time?',
      answer:
        'Yes. You can upgrade, downgrade, or cancel your subscription at any point from your Shop Settings dashboard. There are no cancellation penalties or hidden fees.',
    },
    {
      id: 'faq-8',
      category: 'billing',
      question: 'Do you offer a refund policy?',
      answer:
        'Yes, we provide a full 7-day money-back guarantee. If DocuStudio does not speed up your shop operations or meet your expectations, simply request a refund within 7 days of signing up.',
    },
    {
      id: 'faq-9',
      category: 'studio',
      question: 'What languages does the Handwriting to Word OCR engine support?',
      answer:
        'The OCR engine supports handwritten English, numeric calculations, tabular notes, and common regional scripts with paragraph and bullet structure preservation directly into `.docx` format.',
    },
  ];

  const filteredFaqs = allFaqs.filter((item) => {
    const matchesCategory =
      selectedCategory === 'all' || item.category === selectedCategory;
    const matchesQuery =
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (typeof item.answer === 'string' &&
        item.answer.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="py-16 space-y-16">
      {/* Header */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <Badge variant="primary">Help & Knowledge Base</Badge>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
          Frequently Asked Questions
        </h1>
        <p className="text-base sm:text-lg text-slate-600 max-w-xl mx-auto">
          Find fast answers to common questions about hardware compatibility, processing studios, and subscription plans.
        </p>

        {/* Search Input */}
        <div className="relative max-w-xl mx-auto pt-2">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search keywords: printer, passport, refund, OCR, A4..."
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-slate-300 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 shadow-sm"
          />
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {[
            { id: 'all', label: 'All Questions' },
            { id: 'hardware', label: 'Hardware & Printing' },
            { id: 'studio', label: 'Studio Tools' },
            { id: 'security', label: 'Data & Privacy' },
            { id: 'billing', label: 'Pricing & Billing' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                selectedCategory === cat.id
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </section>

      {/* Accordion List */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {filteredFaqs.length > 0 ? (
          <Accordion items={filteredFaqs} allowMultiple />
        ) : (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-8 space-y-3">
            <HelpCircle className="w-8 h-8 text-slate-400 mx-auto" />
            <h4 className="text-base font-bold text-slate-800">No matching questions found</h4>
            <p className="text-xs text-slate-500">
              Try searching for something else or ask our support team directly.
            </p>
          </div>
        )}
      </section>

      {/* Bottom Assistance */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-8 border-t border-slate-200">
        <h3 className="text-xl font-bold text-slate-900">Still have questions?</h3>
        <p className="text-xs text-slate-600 mt-1 mb-4">
          Our team is available 6 days a week to help guide your shop setup.
        </p>
        <Link to="/contact">
          <button className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-800">
            <span>Contact Customer Support</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </Link>
      </section>
    </div>
  );
};

