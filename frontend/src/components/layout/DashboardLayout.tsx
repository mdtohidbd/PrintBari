import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export const DashboardLayout: React.FC = () => {
  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Accessible Skip Link (WCAG 2.2 AA SC 2.4.1 Bypass Blocks) */}
      <a
        href="#main-content"
        className="sr-only-focusable fixed top-3 left-3 z-50 px-4 py-2 bg-brand-600 text-white font-semibold rounded-xl shadow-xl focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to main content
      </a>

      {/* Side Navigation */}
      <div className="print:hidden">
        <Sidebar />
      </div>

      {/* Main App Canvas */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="print:hidden">
          <Header />
        </div>
        <main
          id="main-content"
          tabIndex={-1}
          role="main"
          className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 focus:outline-none"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};

