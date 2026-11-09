import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { ScrollToTop } from '../common/ScrollToTop';

export const PublicLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-brand-500 selection:text-white">
      {/* Accessible Skip Link (WCAG 2.2 AA SC 2.4.1) */}
      <a
        href="#public-main-content"
        className="sr-only-focusable fixed top-3 left-3 z-50 px-4 py-2 bg-brand-600 text-white font-semibold rounded-xl shadow-xl focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to main content
      </a>
      <ScrollToTop />
      <Navbar />
      <main id="public-main-content" tabIndex={-1} role="main" className="flex-1 focus:outline-none">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

