import React from 'react';
import { Link } from 'react-router-dom';
import { Layers, ShieldCheck, Heart, Mail, Phone, MapPin, Printer } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-950 text-slate-400 border-t border-slate-900 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8 pb-12 border-b border-slate-800/80">
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-500 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
                <Layers className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-white">
                DocuStudio <span className="text-brand-400">SaaS</span>
              </span>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
              The all-in-one cloud operating system empowering photocopy shops, digital photo studios, and cyber cafés with instant document processing, automated passport layouts, and seamless hardware printing.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-400 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                All Cloud Services Operational
              </span>
              <span className="text-xs text-slate-500">v1.0.0 Production</span>
            </div>
          </div>

          {/* Product Studios */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">
              Processing Tools
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/features" className="hover:text-white transition-colors">
                  Passport Photo Studio
                </Link>
              </li>
              <li>
                <Link to="/features" className="hover:text-white transition-colors">
                  ID Card Dual-Side A4
                </Link>
              </li>
              <li>
                <Link to="/features" className="hover:text-white transition-colors">
                  Document A4 Dewarping
                </Link>
              </li>
              <li>
                <Link to="/features" className="hover:text-white transition-colors">
                  Interactive CV Builder
                </Link>
              </li>
              <li>
                <Link to="/features" className="hover:text-white transition-colors">
                  Handwriting OCR to Word
                </Link>
              </li>
              <li>
                <Link to="/features" className="hover:text-white transition-colors">
                  Desktop Print Spooler
                </Link>
              </li>
            </ul>
          </div>

          {/* Company & Support */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">
              Company
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/about" className="hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="hover:text-white transition-colors">
                  Pricing Plans
                </Link>
              </li>
              <li>
                <Link to="/faq" className="hover:text-white transition-colors">
                  Frequently Asked Questions
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  Contact Support
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="text-brand-400 hover:text-brand-300 font-medium">
                  Launch Shop OS →
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Policies */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">
              Legal & Trust
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/terms" className="hover:text-white transition-colors">
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy (GDPR)
                </Link>
              </li>
              <li>
                <Link to="/refund" className="hover:text-white transition-colors">
                  Refund & Cancellation
                </Link>
              </li>
              <li>
                <span className="text-slate-500 text-xs block pt-1">
                  🔒 Zero-Retention Biometric Policy for customer documents
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} DocuStudio SaaS. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Engineered for high-volume photo studios & photocopy centers.
          </p>
        </div>
      </div>
    </footer>
  );
};

