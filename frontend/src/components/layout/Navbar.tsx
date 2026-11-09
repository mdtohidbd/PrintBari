import React, { useState, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Layers, Menu, X, ArrowRight, Sparkles, Store } from 'lucide-react';
import { Button } from '../common/Button';
import { clsx } from 'clsx';

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 15);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { name: 'Features', path: '/features' },
    { name: 'Use Cases', path: '/use-cases' },
    { name: 'Pricing', path: '/pricing' },
    { name: 'Book Demo', path: '/demo' },
    { name: 'FAQ', path: '/faq' },
    { name: 'Contact', path: '/contact' },
  ];

  return (
    <header
      className={clsx(
        'sticky top-0 z-50 transition-all duration-200 border-b',
        scrolled
          ? 'bg-white/95 backdrop-blur-md border-slate-200/80 shadow-sm'
          : 'bg-white border-transparent'
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-brand-500/25 group-hover:scale-105 transition-transform">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xl tracking-tight text-slate-900">
                  DocuStudio
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded border border-brand-200">
                  SaaS
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Photocopy & Studio Operating System
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            {navLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                className={({ isActive }) =>
                  clsx(
                    'px-3.5 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'text-brand-600 bg-brand-50/70 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  )
                }
              >
                {link.name}
              </NavLink>
            ))}
          </nav>

          {/* Desktop Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link to="/register">
              <Button size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Start Free Trial
              </Button>
            </Link>
            <Link to="/dashboard" title="Open Shop Operating System">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-300 text-slate-700 hover:bg-slate-100"
                leftIcon={<Store className="w-3.5 h-3.5 text-brand-600" />}
              >
                Shop OS
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <Link to="/dashboard">
              <button className="p-2 text-slate-700 hover:bg-slate-100 rounded-lg">
                <Store className="w-5 h-5 text-brand-600" />
              </button>
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2.5 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white px-4 pt-2 pb-6 space-y-3 shadow-xl animate-fadeIn">
          <nav className="flex flex-col space-y-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                className={({ isActive }) =>
                  clsx(
                    'px-4 py-2.5 rounded-lg text-base font-medium',
                    isActive
                      ? 'bg-brand-50 text-brand-600 font-semibold'
                      : 'text-slate-700 hover:bg-slate-100'
                  )
                }
              >
                {link.name}
              </NavLink>
            ))}
          </nav>
          <div className="pt-4 border-t border-slate-100 flex flex-col gap-2.5">
            <Link to="/login" className="w-full">
              <Button variant="outline" className="w-full justify-center">
                Sign In
              </Button>
            </Link>
            <Link to="/register" className="w-full">
              <Button className="w-full justify-center" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Start 14-Day Free Trial
              </Button>
            </Link>
            <Link to="/dashboard" className="w-full">
              <Button
                variant="secondary"
                className="w-full justify-center"
                leftIcon={<Store className="w-4 h-4 text-brand-400" />}
              >
                Launch Shop Operating System
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

