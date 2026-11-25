import React from 'react';
import { cn } from './utils';

export type PondWaveStatus = 'Healthy' | 'Attention' | 'Preparing';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  padded?: boolean;
  pondWaveStatus?: PondWaveStatus;
}

const WAVE_BAR_TONES: Record<PondWaveStatus, string> = {
  Healthy: 'bg-gradient-to-r from-emerald-500/80 via-sky-500/80 to-emerald-500/80',
  Attention: 'bg-gradient-to-r from-amber-500/85 via-orange-500/85 to-amber-500/85',
  Preparing: 'bg-gradient-to-r from-sky-400/75 via-blue-500/75 to-sky-400/75',
};

export const Card: React.FC<CardProps> = ({
  children,
  className,
  hoverable = false,
  padded = true,
  pondWaveStatus,
  ...rest
}) => {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[16px] border border-slate-200/90 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100',
        hoverable ? 'shadow-hover-card' : 'shadow-rest',
        padded && 'p-4',
        className
      )}
      {...rest}
    >
      {children}
      {pondWaveStatus && (
        <div
          aria-hidden="true"
          className={cn(
            'pond-wave-bar pointer-events-none absolute inset-x-0 bottom-0 h-1',
            WAVE_BAR_TONES[pondWaveStatus]
          )}
        />
      )}
    </div>
  );
};
