import React from 'react';
import { Inbox } from 'lucide-react';
import { cn } from './utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[16px] border border-dashed border-slate-200 bg-slate-50/70 px-6 py-8 text-center dark:border-slate-800 dark:bg-slate-900/50',
        className
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-xs dark:bg-slate-800 dark:text-slate-500">
        {icon || <Inbox className="h-5 w-5" />}
      </div>
      <div className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">{title}</div>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};
