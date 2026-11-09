import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Failed to load content',
  message = 'An unexpected network error occurred while connecting to the shop database.',
  onRetry,
  isRetrying = false,
  className = '',
}) => {
  return (
    <div
      className={`p-6 sm:p-8 rounded-2xl bg-rose-50/60 border border-rose-200/90 text-rose-950 flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}
    >
      <div className="flex items-center gap-4 text-center sm:text-left">
        <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h4 className="text-sm font-bold tracking-tight text-rose-900">{title}</h4>
          <p className="text-xs text-rose-700 mt-0.5 leading-relaxed max-w-md">{message}</p>
        </div>
      </div>

      {onRetry && (
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          isLoading={isRetrying}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          className="border-rose-300 text-rose-800 hover:bg-rose-100 shrink-0"
        >
          Try Again
        </Button>
      )}
    </div>
  );
};

