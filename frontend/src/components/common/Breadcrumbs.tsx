import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

export interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
}

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  studio: 'Studios',
  passport: 'Passport Photo Studio',
  document: 'Document A4 Processing',
  'id-card': 'ID Card Studio',
  cv: 'CV & Bio-Data Builder',
  ocr: 'Handwriting OCR',
  queue: 'Work Queue',
  customers: 'Customer CRM',
  printers: 'Print Spooler',
  subscription: 'Billing & Plans',
  settings: 'Shop Settings',
  staff: 'Staff & Roles',
  admin: 'Super Admin',
};

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, className = '' }) => {
  const location = useLocation();

  // Auto-generate items from route if not explicitly passed
  const pathnames = location.pathname.split('/').filter((x) => x);

  const breadcrumbItems: BreadcrumbItem[] =
    items ||
    pathnames.map((segment, index) => {
      const url = `/${pathnames.slice(0, index + 1).join('/')}`;
      return {
        label: ROUTE_LABELS[segment] || segment.charAt(0).toUpperCase() + segment.slice(1),
        path: index === pathnames.length - 1 ? undefined : url,
      };
    });

  if (breadcrumbItems.length === 0) return null;

  return (
    <nav className={`flex items-center text-xs font-medium text-slate-500 ${className}`} aria-label="Breadcrumb">
      <ol className="flex items-center gap-1.5 flex-wrap">
        <li>
          <Link
            to="/dashboard"
            className="flex items-center gap-1 hover:text-slate-900 transition-colors py-0.5 text-slate-400 hover:text-slate-600"
            title="Dashboard Home"
          >
            <Home className="w-3.5 h-3.5" />
          </Link>
        </li>

        {breadcrumbItems.map((item, idx) => (
          <li key={idx} className="flex items-center gap-1.5">
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            {item.path ? (
              <Link to={item.path} className="hover:text-slate-900 transition-colors py-0.5">
                {item.label}
              </Link>
            ) : (
              <span className="text-slate-800 font-semibold py-0.5">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

