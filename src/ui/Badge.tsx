import React from 'react';
import { cn } from './utils';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'auto';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  pulseDot?: boolean;
}

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  success:
    'bg-emerald-100 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800/60',
  warning:
    'bg-amber-100 text-amber-800 border-amber-200/80 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800/60',
  danger:
    'bg-red-100 text-red-700 border-red-200/80 dark:bg-red-950/70 dark:text-red-300 dark:border-red-800/60',
  info:
    'bg-blue-100 text-blue-800 border-blue-200/80 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800/60',
  neutral:
    'bg-slate-100 text-slate-700 border-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  auto:
    'animate-auto-glow bg-cyan-100 text-cyan-800 border-cyan-300/80 shadow-[0_0_12px_rgba(6,182,212,0.28)] dark:bg-cyan-950/80 dark:text-cyan-300 dark:border-cyan-700/70',
};

const DOT_STYLES: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-blue-500',
  neutral: 'bg-slate-500',
  auto: 'bg-cyan-500',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  pulseDot = false,
  className,
  ...rest
}) => {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold leading-tight whitespace-nowrap',
        VARIANT_STYLES[variant],
        className
      )}
      {...rest}
    >
      {pulseDot && (
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
              DOT_STYLES[variant]
            )}
          />
          <span className={cn('relative inline-flex h-2 w-2 rounded-full', DOT_STYLES[variant])} />
        </span>
      )}
      {children}
    </span>
  );
};
