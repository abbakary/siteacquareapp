import React from 'react';
import { motion } from 'motion/react';
import { SPRING_SNAPPY } from './motion';
import { cn } from './utils';

export interface AnimatedTabItem<T extends string> {
  id: T;
  label: string;
  badge?: number | string;
  icon?: React.ReactNode;
}

interface AnimatedTabsProps<T extends string> {
  tabs: Array<AnimatedTabItem<T>>;
  activeId: T;
  onChange: (id: T) => void;
  layoutId: string;
  variant?: 'pill' | 'underline';
  size?: 'sm' | 'md';
  className?: string;
}

export function AnimatedTabs<T extends string>({
  tabs,
  activeId,
  onChange,
  layoutId,
  variant = 'pill',
  size = 'md',
  className,
}: AnimatedTabsProps<T>) {
  if (variant === 'underline') {
    return (
      <div
        className={cn(
          'flex items-center gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800',
          className
        )}
        role="tablist"
      >
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              className={cn(
                'relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-blue-500',
                active
                  ? 'text-blue-700 dark:text-sky-300'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge !== undefined && Number(tab.badge) > 0 && (
                <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {tab.badge}
                </span>
              )}
              {active && (
                <motion.span
                  layoutId={layoutId}
                  transition={SPRING_SNAPPY}
                  className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-[#1D72E8] dark:bg-sky-400"
                />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-200/80 bg-slate-100/90 p-1 dark:border-slate-800 dark:bg-slate-800/80',
        className
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative z-10 flex items-center gap-1.5 rounded-lg font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-blue-500',
              size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
              active
                ? 'text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={SPRING_SNAPPY}
                className="absolute inset-0 -z-10 rounded-lg bg-[#1D72E8] shadow-xs dark:bg-blue-600"
              />
            )}
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && Number(tab.badge) > 0 && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                  active
                    ? 'bg-white/25 text-white'
                    : 'bg-red-600 text-white'
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
