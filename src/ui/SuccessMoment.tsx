import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';
import { EASE_OUT } from './motion';

interface SuccessMomentProps {
  title: string;
  subtitle?: string;
}

const SPARKS = [
  { x: -38, y: -26, color: '#10b981' },
  { x: 38, y: -24, color: '#0ea5e9' },
  { x: -46, y: 6, color: '#f59e0b' },
  { x: 46, y: 10, color: '#10b981' },
  { x: -24, y: 34, color: '#0ea5e9' },
  { x: 26, y: 32, color: '#f59e0b' },
];

export const SuccessMoment: React.FC<SuccessMomentProps> = ({ title, subtitle }) => {
  return (
    <div className="relative flex flex-col items-center justify-center py-8 text-center">
      {/* Subtle outward ripple */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0.7 }}
        animate={{ scale: 2.2, opacity: 0 }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
        className="pointer-events-none absolute h-16 w-16 rounded-full border-2 border-emerald-400"
      />

      {/* Lightweight burst dots */}
      {SPARKS.map((sp, i) => (
        <motion.span
          key={i}
          initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
          animate={{ x: sp.x, y: sp.y, scale: 1, opacity: 0 }}
          transition={{ duration: 0.65, ease: EASE_OUT, delay: 0.05 }}
          style={{ backgroundColor: sp.color }}
          className="pointer-events-none absolute h-2 w-2 rounded-full"
        />
      ))}

      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 460, damping: 24 }}
        className="relative flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-sm dark:bg-emerald-950/70 dark:text-emerald-400"
      >
        <CheckCircle2 className="h-9 w-9" />
      </motion.div>

      <motion.h4
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.08 }}
        className="mt-3 font-display text-base font-extrabold text-slate-900 dark:text-white"
      >
        {title}
      </motion.h4>
      {subtitle && (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.14 }}
          className="mt-1 text-xs text-slate-500 dark:text-slate-400"
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
};
