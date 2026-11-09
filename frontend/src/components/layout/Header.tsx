import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Menu,
  Bell,
  Store,
  LogOut,
  Settings,
  Shield,
  User,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useHealth } from '../../hooks/useHealth';
import { Badge } from '../common/Badge';
import { Breadcrumbs } from '../common/Breadcrumbs';

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const { toggleSidebar, currentTenant, currentUser, setCurrentUser, setCurrentTenant } = useAppStore();
  const { data: healthResponse, isSuccess } = useHealth();

  const isHealthy = isSuccess && healthResponse?.data?.status === 'UP';

  // Dropdown states
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setProfileOpen(false);
        setNotificationsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('tenant_id');
    setCurrentUser(null);
    setCurrentTenant(null);
    setProfileOpen(false);
    navigate('/login');
  };

  const userInitials = currentUser?.fullName
    ? currentUser.fullName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'SO';

  return (
    <header className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
      {/* Left: Sidebar toggle & Breadcrumbs */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
          title="Toggle Navigation"
          aria-label="Toggle Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden md:block min-w-0">
          <Breadcrumbs />
        </div>

        {currentTenant && (
          <div className="flex md:hidden items-center gap-1.5 truncate">
            <span className="font-bold text-slate-900 text-xs truncate max-w-[140px]">
              {currentTenant.name}
            </span>
            <Badge variant="primary" size="xs">
              {currentTenant.plan}
            </Badge>
          </div>
        )}
      </div>

      {/* Right: API Health, Notifications, Profile Dropdown */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Real-time Health Status Pill */}
        <div
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 text-xs"
          title={isHealthy ? 'Connected to MongoDB & API Engine' : 'Checking Backend Connection...'}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="font-semibold text-slate-600 hidden lg:inline">
            {isHealthy ? 'API & Database Live' : 'Connecting API...'}
          </span>
        </div>

        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 relative transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
            title="Activity Notifications"
            aria-label="View notifications"
            aria-expanded={notificationsOpen}
            aria-haspopup="true"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white" />
          </button>

          {notificationsOpen && (
            <div
              role="region"
              aria-label="Activity notifications"
              className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-dropdown border border-slate-200 py-3 z-50 animate-scaleIn"
            >
              <div className="px-4 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-700">Studio Activity</span>
                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Real-time
                </span>
              </div>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                <div className="p-3 hover:bg-slate-50 transition-colors flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 text-xs">
                    <p className="font-semibold text-slate-800">Passport photo job completed</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">8-up photo sheet printed on Epson L805</p>
                    <span className="text-[10px] text-slate-400 font-mono mt-1 block">2 mins ago</span>
                  </div>
                </div>
                <div className="p-3 hover:bg-slate-50 transition-colors flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="flex-1 text-xs">
                    <p className="font-semibold text-slate-800">Smart NID sheet composed</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">4 copies A4 print ready</p>
                    <span className="text-[10px] text-slate-400 font-mono mt-1 block">15 mins ago</span>
                  </div>
                </div>
              </div>
              <div className="px-4 pt-2 border-t border-slate-100 text-center">
                <Link
                  to="/queue"
                  onClick={() => setNotificationsOpen(false)}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                >
                  View All Orders in Queue →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Pill & Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-xl hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            aria-label="User profile menu"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
              {userInitials}
            </div>
            <div className="hidden lg:block text-left text-xs">
              <p className="font-bold text-slate-900 leading-tight">
                {currentUser?.fullName || 'Shop Owner'}
              </p>
              <p className="text-[11px] text-slate-500 truncate max-w-[130px]">
                {currentUser?.email || 'owner@docustudio.io'}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Profile Dropdown Panel */}
          {profileOpen && (
            <div
              role="menu"
              aria-label="User account actions"
              className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-dropdown border border-slate-200 py-2 z-50 animate-scaleIn divide-y divide-slate-100"
            >
              {/* Account Header */}
              <div className="px-4 py-2.5">
                <p className="font-bold text-slate-900 text-sm">{currentUser?.fullName || 'Shop Owner'}</p>
                <p className="text-xs text-slate-500 truncate">{currentUser?.email || 'owner@docustudio.io'}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <Badge variant="primary" size="xs">
                    {currentUser?.role || 'OWNER'}
                  </Badge>
                  {currentTenant && (
                    <span className="text-[11px] font-mono text-slate-400">
                      {currentTenant.subdomain}
                    </span>
                  )}
                </div>
              </div>

              {/* Navigation Actions */}
              <div className="py-1">
                <Link
                  to="/settings"
                  role="menuitem"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  <span>Shop Settings</span>
                </Link>

                <Link
                  to="/subscription"
                  role="menuitem"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  <Store className="w-4 h-4 text-slate-400" />
                  <span>Subscription & Billing</span>
                </Link>

                {currentUser?.role === 'SUPER_ADMIN' && (
                  <Link
                    to="/admin"
                    role="menuitem"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-50 transition-colors"
                  >
                    <Shield className="w-4 h-4 text-purple-600" />
                    <span>Super Admin Center</span>
                  </Link>
                )}
              </div>

              {/* Sign Out Button */}
              <div className="pt-1">
                <button
                  onClick={handleLogout}
                  role="menuitem"
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors text-left"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  <span>Sign Out of Studio</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
