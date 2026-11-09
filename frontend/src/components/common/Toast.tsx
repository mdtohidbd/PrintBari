import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { clsx } from 'clsx';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  message: string;
  type?: ToastType;
  title?: string;
  onClose?: () => void;
  className?: string;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  title,
  onClose,
  className = '',
}) => {
  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
    info: <Info className="w-5 h-5 text-brand-600 shrink-0" />,
  };

  const borderBgStyles = {
    success: 'bg-emerald-50/90 border-emerald-200 text-emerald-950',
    error: 'bg-rose-50/90 border-rose-200 text-rose-950',
    warning: 'bg-amber-50/90 border-amber-200 text-amber-950',
    info: 'bg-brand-50/90 border-brand-200 text-brand-950',
  };

  return (
    <div
      role="alert"
      className={clsx(
        'flex items-start gap-3 p-4 rounded-2xl border shadow-elevated backdrop-blur-md transition-all duration-200 animate-slideUp max-w-md pointer-events-auto',
        borderBgStyles[type],
        className
      )}
    >
      <div className="pt-0.5">{icons[type]}</div>
      <div className="flex-1 text-xs">
        {title && <p className="font-bold text-sm leading-tight mb-0.5">{title}</p>}
        <p className="leading-relaxed opacity-90">{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 -mr-1 -mt-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-black/5 transition-colors"
          aria-label="Dismiss toast"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

