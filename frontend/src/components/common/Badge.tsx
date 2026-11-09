import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'accent' | 'passport' | 'document' | 'idcard' | 'cv' | 'ocr';
  size?: 'xs' | 'sm' | 'md';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className,
  ...props
}) => {
  const sizeStyles = {
    xs: 'px-1.5 py-0.5 text-[10px] gap-1',
    sm: 'px-2 py-0.5 text-xs gap-1.5',
    md: 'px-2.5 py-1 text-xs gap-1.5',
  };

  const variantStyles = {
    primary: 'bg-brand-50 text-brand-700 border border-brand-200/80',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200/80',
    danger: 'bg-rose-50 text-rose-700 border border-rose-200/80',
    neutral: 'bg-slate-100 text-slate-700 border border-slate-200/80',
    accent: 'bg-teal-50 text-teal-700 border border-teal-200/80',
    passport: 'bg-blue-50 text-blue-700 border border-blue-200/80',
    document: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
    idcard: 'bg-purple-50 text-purple-700 border border-purple-200/80',
    cv: 'bg-amber-50 text-amber-700 border border-amber-200/80',
    ocr: 'bg-pink-50 text-pink-700 border border-pink-200/80',
  };

  const dotStyles = {
    primary: 'bg-brand-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
    neutral: 'bg-slate-400',
    accent: 'bg-teal-500',
    passport: 'bg-blue-500',
    document: 'bg-emerald-500',
    idcard: 'bg-purple-500',
    cv: 'bg-amber-500',
    ocr: 'bg-pink-500',
  };

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center font-semibold rounded-full tracking-wide select-none',
          sizeStyles[size],
          variantStyles[variant],
          className
        )
      )}
      {...props}
    >
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', dotStyles[variant])} />}
      <span>{children}</span>
    </span>
  );
};
