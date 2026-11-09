import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  className,
  style,
  ...props
}) => {
  const variantStyles = {
    text: 'h-4 rounded-md',
    circular: 'rounded-full',
    rectangular: 'rounded-xl',
    card: 'h-36 rounded-2xl',
  };

  const computedStyle: React.CSSProperties = {
    width: width !== undefined ? width : undefined,
    height: height !== undefined ? height : undefined,
    ...style,
  };

  return (
    <div
      className={twMerge(
        clsx(
          'animate-pulse bg-slate-200/80',
          variantStyles[variant],
          className
        )
      )}
      style={computedStyle}
      {...props}
    />
  );
};

export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="h-4 w-24 bg-slate-200 rounded"></div>
            <div className="w-8 h-8 rounded-xl bg-slate-200"></div>
          </div>
          <div className="h-8 w-20 bg-slate-200 rounded"></div>
          <div className="h-3 w-32 bg-slate-100 rounded"></div>
        </div>
      ))}
    </div>
  );
};

