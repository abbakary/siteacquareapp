import React, { useEffect, useRef, useState } from 'react';
import { usePreferences } from './PreferencesContext';
import { cn } from './utils';

interface CountUpNumberProps {
  value: number;
  decimals?: number;
  durationMs?: number;
  prefix?: string;
  suffix?: string;
  formatter?: (val: number) => string;
  className?: string;
}

export const CountUpNumber: React.FC<CountUpNumberProps> = ({
  value,
  decimals = 0,
  durationMs = 600,
  prefix = '',
  suffix = '',
  formatter,
  className,
}) => {
  const { effectiveReducedMotion } = usePreferences();
  const [displayValue, setDisplayValue] = useState<number>(value);
  const prevValueRef = useRef<number>(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const startVal = prevValueRef.current;
    const endVal = Number.isFinite(value) ? value : 0;

    if (effectiveReducedMotion || startVal === endVal) {
      prevValueRef.current = endVal;
      setDisplayValue(endVal);
      return;
    }

    const startTime = performance.now();
    const diff = endVal - startVal;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // Cubic ease-out matching --ease-out feel
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = startVal + diff * eased;
      setDisplayValue(next);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevValueRef.current = endVal;
        setDisplayValue(endVal);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      prevValueRef.current = endVal;
    };
  }, [value, durationMs, effectiveReducedMotion]);

  const rounded =
    decimals > 0
      ? Number(displayValue.toFixed(decimals))
      : Math.round(displayValue);

  const formatted = formatter
    ? formatter(rounded)
    : rounded.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

  return (
    <span className={cn('tabular-nums', className)}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};

interface StatProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  formatter?: (val: number) => string;
  hint?: string;
  icon?: React.ReactNode;
  accentClassName?: string;
  className?: string;
}

export const Stat: React.FC<StatProps> = ({
  label,
  value,
  prefix,
  suffix,
  decimals = 0,
  formatter,
  hint,
  icon,
  accentClassName = 'text-slate-900 dark:text-white',
  className,
}) => {
  return (
    <div
      className={cn(
        'rounded-[16px] border border-slate-200/90 bg-white p-3.5 shadow-rest dark:border-slate-800 dark:bg-slate-900',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        <span>{label}</span>
        {icon}
      </div>
      <div className={cn('mt-1 font-display text-lg font-extrabold tabular-nums', accentClassName)}>
        <CountUpNumber
          value={value}
          prefix={prefix}
          suffix={suffix}
          decimals={decimals}
          formatter={formatter}
        />
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{hint}</div>}
    </div>
  );
};
