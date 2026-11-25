import React from 'react';
import { cn } from './utils';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => (
  <div
    aria-hidden="true"
    className={cn(
      'skeleton-sweep relative overflow-hidden rounded-xl bg-slate-200/80 dark:bg-slate-800/90',
      className
    )}
  />
);

export const ChartSkeleton: React.FC<{ heightClass?: string }> = ({ heightClass = 'h-48' }) => (
  <div className="space-y-2.5 rounded-[16px] border border-slate-200/70 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
    <div className="flex items-center justify-between">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-20" />
    </div>
    <Skeleton className={cn('w-full', heightClass)} />
  </div>
);

export const MapSkeleton: React.FC<{ heightClass?: string }> = ({ heightClass = 'h-[260px]' }) => (
  <div className="relative overflow-hidden rounded-[16px] border border-slate-200/70 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
    <Skeleton className={cn('w-full rounded-xl', heightClass)} />
    <div className="mt-2 flex items-center gap-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-3 w-20" />
    </div>
  </div>
);

export const CardListSkeleton: React.FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div className="space-y-2.5">
    {Array.from({ length: rows }).map((_, idx) => (
      <div
        key={idx}
        className="flex items-center gap-3 rounded-[16px] border border-slate-200/70 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900"
      >
        <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-2/5" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
    ))}
  </div>
);
