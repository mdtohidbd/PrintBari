import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { Home } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4 text-2xl font-bold">
        404
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Page Not Found</h1>
      <p className="text-sm text-slate-500 max-w-sm mt-2 mb-6">
        The requested endpoint or view does not exist or has not been initialized in this phase.
      </p>
      <Link to="/dashboard">
        <Button leftIcon={<Home className="w-4 h-4" />}>Back to Dashboard</Button>
      </Link>
    </div>
  );
};

