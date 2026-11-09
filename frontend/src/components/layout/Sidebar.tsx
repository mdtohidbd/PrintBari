import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Camera,
  FileText,
  CreditCard,
  FileSpreadsheet,
  PenTool,
  Users,
  Layers,
  Printer,
  Settings,
  Shield,
  Layers as AppLogoIcon,
  Wallet,
  ChevronRight,
  HardDrive,
  Sparkles,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { clsx } from 'clsx';
import { Tooltip } from '../common/Tooltip';

interface NavItem {
  name: string;
  path: string;
  icon: any;
  badge?: string;
  badgeColor?: string;
  adminOnly?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC = () => {
  const { sidebarOpen, setSidebarOpen, currentUser, currentTenant } = useAppStore();

  const handleNavClick = () => {
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const navSections: NavSection[] = [
    {
      title: 'OPERATIONS',
      items: [
        { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { name: 'Work Queue', path: '/queue', icon: Layers, badge: 'Live', badgeColor: 'bg-emerald-500/20 text-emerald-300' },
        { name: 'Customers CRM', path: '/customers', icon: Users },
        { name: 'Print Spooler', path: '/printers', icon: Printer, badge: '300 DPI', badgeColor: 'bg-blue-500/20 text-blue-300' },
      ],
    },
    {
      title: 'STUDIO ENGINES',
      items: [
        { name: 'Passport Studio', path: '/studio/passport', icon: Camera, badge: 'Photos', badgeColor: 'bg-indigo-500/20 text-indigo-300' },
        { name: 'Document A4', path: '/studio/document', icon: FileText },
        { name: 'ID Card Studio', path: '/studio/id-card', icon: CreditCard },
        { name: 'CV & Bio-Data', path: '/studio/cv', icon: FileSpreadsheet },
        { name: 'Handwriting OCR', path: '/studio/ocr', icon: PenTool, badge: 'AI', badgeColor: 'bg-pink-500/20 text-pink-300' },
      ],
    },
    {
      title: 'MANAGEMENT',
      items: [
        { name: 'Subscription', path: '/subscription', icon: Wallet },
        { name: 'Staff & Roles', path: '/staff', icon: Users },
        { name: 'Shop Settings', path: '/settings', icon: Settings },
      ],
    },
  ];

  // Super Admin section
  if (currentUser?.role === 'SUPER_ADMIN') {
    navSections.push({
      title: 'PLATFORM HQ',
      items: [
        { name: 'Super Admin', path: '/admin', icon: Shield, badge: 'HQ', badgeColor: 'bg-purple-500/30 text-purple-300' },
      ],
    });
  }

  return (
    <>
      {/* Mobile Drawer Overlay Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-30 md:hidden animate-fadeIn"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Studio navigation menu"
        className={clsx(
          'bg-slate-950 text-slate-300 fixed md:static inset-y-0 left-0 z-40 flex flex-col transition-all duration-200 ease-in-out border-r border-slate-800/80 shadow-2xl md:shadow-none select-none',
          sidebarOpen ? 'w-64 translate-x-0' : '-translate-x-full md:translate-x-0 md:w-20'
        )}
      >
        {/* Brand Header */}
        <Link
          to="/dashboard"
          onClick={handleNavClick}
          className="h-16 flex items-center px-4.5 border-b border-slate-800/80 gap-3 hover:bg-slate-900/60 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-500 via-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-brand-500/25 shrink-0">
            <AppLogoIcon className="w-5 h-5" />
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden whitespace-nowrap">
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-white tracking-tight text-base">DocuStudio</h1>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-sm bg-brand-500/20 text-brand-300">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium truncate max-w-[150px]">
                {currentTenant?.name || 'Studio OS'}
              </p>
            </div>
          )}
        </Link>

      {/* Navigation Sections */}
      <div className="flex-1 py-4 px-3 space-y-6 overflow-y-auto">
        {navSections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-1">
            {sidebarOpen && (
              <p className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const linkContent = (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={handleNavClick}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 group relative',
                      isActive
                        ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30 font-bold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    )
                  }
                >
                  <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-105" />
                  {sidebarOpen && (
                    <div className="flex items-center justify-between flex-1 overflow-hidden">
                      <span className="truncate">{item.name}</span>
                      {item.badge && (
                        <span
                          className={clsx(
                            'text-[10px] font-bold px-1.5 py-0.2 rounded-md',
                            item.badgeColor || 'bg-slate-800 text-slate-400'
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )}
                </NavLink>
              );

              return !sidebarOpen ? (
                <Tooltip key={item.path} content={item.name} position="right">
                  {linkContent}
                </Tooltip>
              ) : (
                <React.Fragment key={item.path}>{linkContent}</React.Fragment>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer Storage / Plan Widget */}
      {sidebarOpen ? (
        <div className="p-3.5 m-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-brand-400" /> Storage
            </span>
            <span className="text-[10px] font-bold text-slate-300">3.2 / 25 GB</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-brand-500 to-accent-400 h-1.5 rounded-full w-[15%]" />
          </div>
          <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
            <span>{currentTenant?.plan || 'PRO'} Plan</span>
            <Link to="/subscription" className="text-brand-400 hover:text-brand-300 font-semibold">
              Manage →
            </Link>
          </div>
        </div>
      ) : (
        <div className="p-3 border-t border-slate-800 text-center text-slate-400">
          <Tooltip content="Storage: 3.2 GB / 25 GB (PRO)" position="right">
            <div className="w-8 h-8 mx-auto rounded-xl bg-slate-900 flex items-center justify-center text-brand-400">
              <HardDrive className="w-4 h-4" />
            </div>
          </Tooltip>
        </div>
      )}
      </aside>
    </>
  );
};
