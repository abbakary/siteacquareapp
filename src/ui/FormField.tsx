import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';
import { DURATIONS, EASE_OUT } from './motion';
import { cn } from './utils';

interface FormErrorProps {
  message?: string | null;
  shakeKey?: number;
  className?: string;
}

export const FormError: React.FC<FormErrorProps> = ({ message, shakeKey = 0, className }) => {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          key={`${message}-${shakeKey}`}
          initial={{ opacity: 0, height: 0, y: -4 }}
          animate={{ opacity: 1, height: 'auto', y: 0 }}
          exit={{ opacity: 0, height: 0, y: -4 }}
          transition={{ duration: DURATIONS.base, ease: EASE_OUT }}
          className={cn('overflow-hidden', className)}
          role="alert"
        >
          <div className="animate-soft-shake rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
            {message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface ValidCheckProps {
  valid?: boolean;
}

export const ValidCheck: React.FC<ValidCheckProps> = ({ valid }) => {
  if (!valid) return null;
  return (
    <motion.span
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: DURATIONS.fast, ease: EASE_OUT }}
      className="inline-flex items-center text-emerald-600 dark:text-emerald-400"
      aria-label="Valid"
    >
      <CheckCircle2 className="h-3.5 w-3.5" />
    </motion.span>
  );
};

export const INPUT_CLASS =
  'w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-400 dark:focus:ring-sky-400/20';
