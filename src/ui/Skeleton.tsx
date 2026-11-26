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

export const KpiRowSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
    {Array.from({ length: count }).map((_, idx) => (
      <div
        key={idx}
        className="flex items-center justify-between gap-3 rounded-[16px] border border-slate-200/70 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
        <Skeleton className="h-9 w-16 shrink-0 rounded-lg" />
      </div>
    ))}
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 5,
}) => (
  <div className="rounded-[16px] border border-slate-200/70 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
    <div className="mb-3 flex items-center justify-between">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-4 w-16" />
    </div>
    <div className="space-y-2.5">
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="grid gap-3 border-b border-slate-100 pb-2.5 last:border-b-0 dark:border-slate-800"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className="h-3.5 w-full" />
          ))}
        </div>
      ))}
    </div>
  </div>
);

export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-3.5">
    <KpiRowSkeleton count={4} />
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
      <div className="lg:col-span-5">
        <ChartSkeleton heightClass="h-[195px]" />
      </div>
      <div className="lg:col-span-4">
        <ChartSkeleton heightClass="h-[195px]" />
      </div>
      <div className="lg:col-span-3">
        <ChartSkeleton heightClass="h-[195px]" />
      </div>
    </div>
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
      <div className="lg:col-span-5">
        <TableSkeleton rows={5} cols={4} />
      </div>
      <div className="lg:col-span-4">
        <CardListSkeleton rows={4} />
      </div>
      <div className="lg:col-span-3">
        <MapSkeleton heightClass="h-[210px]" />
      </div>
    </div>
  </div>
);
