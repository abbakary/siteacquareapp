import React from 'react';
import { motion } from 'motion/react';
import { Check, Loader2 } from 'lucide-react';
import { DURATIONS, EASE_OUT } from './motion';
import { cn } from './utils';

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onDrag'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  success?: boolean;
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[#1D72E8] text-white hover:bg-[#155CC0] shadow-xs dark:bg-blue-600 dark:hover:bg-blue-500',
  secondary:
    'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
  success:
    'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs dark:bg-emerald-600 dark:hover:bg-emerald-500',
  danger:
    'bg-red-600 text-white hover:bg-red-700 shadow-xs dark:bg-red-600 dark:hover:bg-red-500',
  warning:
    'bg-orange-600 text-white hover:bg-orange-700 shadow-xs dark:bg-orange-600 dark:hover:bg-orange-500',
  ghost:
    'bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-[36px] px-3 py-1.5 text-xs rounded-[10px]',
  md: 'min-h-[42px] px-4 py-2 text-xs rounded-[12px]',
  lg: 'min-h-[46px] px-5 py-2.5 text-sm rounded-[12px]',
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  success = false,
  fullWidth = false,
  disabled,
  className,
  type = 'button',
  ...rest
}) => {
  const isDisabled = Boolean(disabled || loading);

  return (
    <motion.button
      type={type}
      disabled={isDisabled}
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
      transition={{ duration: DURATIONS.fast, ease: EASE_OUT }}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT_CLASSES[success ? 'success' : variant],
        SIZE_CLASSES[size],
        fullWidth && 'w-full',
        className
      )}
      {...(rest as any)}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
      ) : success ? (
        <Check className="h-3.5 w-3.5 shrink-0" />
      ) : null}
      {children}
    </motion.button>
  );
};
