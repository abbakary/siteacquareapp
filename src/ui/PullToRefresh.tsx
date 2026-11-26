import React, { useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { usePreferences } from './PreferencesContext';
import { cn } from './utils';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  className?: string;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  className,
}) => {
  const { effectiveReducedMotion, triggerHaptic, language } = usePreferences();
  const startYRef = useRef<number | null>(null);
  const [pullPx, setPullPx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY > 4 || refreshing) return;
    startYRef.current = e.touches[0]?.clientY ?? null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startYRef.current === null || refreshing) return;
    const currentY = e.touches[0]?.clientY ?? 0;
    const delta = currentY - startYRef.current;
    if (delta > 0 && window.scrollY <= 4) {
      setPullPx(Math.min(64, Math.round(delta * 0.45)));
    } else {
      setPullPx(0);
    }
  };

  const handleTouchEnd = async () => {
    if (startYRef.current === null) return;
    startYRef.current = null;
    if (pullPx >= 46 && !refreshing) {
      setRefreshing(true);
      triggerHaptic(10);
      try {
        await onRefresh();
      } finally {
        window.setTimeout(() => {
          setRefreshing(false);
          setPullPx(0);
        }, 420);
      }
    } else {
      setPullPx(0);
    }
  };

  return (
    <div
      className={cn('relative', className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {(pullPx > 8 || refreshing) && (
        <div
          className="mb-2 flex items-center justify-center gap-2 rounded-xl border border-sky-200/80 bg-sky-50/90 py-1.5 text-[11px] font-semibold text-sky-800 dark:border-sky-800/60 dark:bg-sky-950/60 dark:text-sky-300"
          style={
            effectiveReducedMotion
              ? undefined
              : { transform: `translateY(${Math.min(10, pullPx * 0.15)}px)` }
          }
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          <span>
            {refreshing
              ? language === 'sw'
                ? 'Inasasisha kumbukumbu za shamba...'
                : 'Refreshing farm records...'
              : language === 'sw'
                ? 'Achilia kusasisha'
                : 'Release to refresh'}
          </span>
        </div>
      )}
      {children}
    </div>
  );
};
