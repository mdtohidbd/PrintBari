import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { authApi } from '../../api/auth.api';
import { Spinner } from './Spinner';

export interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const location = useLocation();
  const { currentUser, currentTenant, setCurrentUser, setCurrentTenant } = useAppStore();
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);

  const token = localStorage.getItem('token');

  useEffect(() => {
    let isMounted = true;

    const verifySession = async () => {
      if (!token) {
        if (isMounted) setIsCheckingAuth(false);
        return;
      }

      // If user is already loaded in store, skip network call
      if (currentUser && currentTenant) {
        if (isMounted) setIsCheckingAuth(false);
        return;
      }

      try {
        const data = await authApi.getMe();
        if (isMounted) {
          setCurrentUser(data.user);
          setCurrentTenant({
            id: data.tenant.id,
            name: data.tenant.name,
            subdomain: data.tenant.subdomain,
            plan: data.tenant.plan as any,
            currency: 'BDT',
          });
          setIsCheckingAuth(false);
        }
      } catch (error) {
        // Token is invalid or expired
        if (isMounted) {
          localStorage.removeItem('token');
          localStorage.removeItem('tenant_id');
          setCurrentUser(null);
          setCurrentTenant(null);
          setIsCheckingAuth(false);
        }
      }
    };

    verifySession();

    return () => {
      isMounted = false;
    };
  }, [token]);

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
        <div className="w-12 h-12 rounded-2xl bg-brand-600/10 text-brand-600 flex items-center justify-center mb-4">
          <Spinner size="lg" />
        </div>
        <h3 className="text-sm font-bold text-slate-800 tracking-tight">Verifying Studio Security Session</h3>
        <p className="text-xs text-slate-500 mt-1">Connecting to your isolated shop workspace...</p>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && currentUser && currentUser.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

