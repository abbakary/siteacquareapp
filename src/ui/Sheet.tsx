import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, PanInfo } from 'motion/react';
import { X } from 'lucide-react';
import { backdropFade, DURATIONS, EASE_IN_OUT, EASE_OUT, SPRING_SHEET } from './motion';
import { usePreferences } from './PreferencesContext';
import { cn } from './utils';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClass?: string;
  hideDefaultHeader?: boolean;
  children: React.ReactNode;
}

function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 640;
  });
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);
  return isMobile;
}

export const Sheet: React.FC<SheetProps> = ({
  open,
  onClose,
  title,
  subtitle,
  headerRight,
  footer,
  maxWidthClass = 'sm:max-w-lg',
  hideDefaultHeader = false,
  children,
}) => {
  const isMobile = useIsMobileViewport();
  const { effectiveReducedMotion, language } = usePreferences();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    lastFocusedRef.current = document.activeElement as HTMLElement | null;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      if (!panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        panelRef.current.focus();
      }
    }, 30);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
      lastFocusedRef.current?.focus?.();
    };
  }, [open, onClose]);

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 90 || info.velocity.y > 420) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[1000] flex items-end justify-center sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <motion.div
            key="sheet-backdrop"
            variants={backdropFade}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-[2px]"
          />

          {/* Panel: bottom sheet on mobile with swipe-down, centered modal scale 0.96 -> 1 on desktop */}
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            key={isMobile ? 'mobile-sheet' : 'desktop-modal'}
            initial={
              effectiveReducedMotion
                ? { opacity: 0 }
                : isMobile
                  ? { opacity: 0, y: '100%' }
                  : { opacity: 0, scale: 0.96, y: 8 }
            }
            animate={
              effectiveReducedMotion
                ? { opacity: 1 }
                : isMobile
                  ? { opacity: 1, y: 0 }
                  : { opacity: 1, scale: 1, y: 0 }
            }
            exit={
              effectiveReducedMotion
                ? { opacity: 0 }
                : isMobile
                  ? { opacity: 0, y: '100%' }
                  : { opacity: 0, scale: 0.96, y: 6 }
            }
            transition={
              effectiveReducedMotion
                ? { duration: 0.01 }
                : isMobile
                  ? SPRING_SHEET
                  : { duration: DURATIONS.base, ease: EASE_OUT }
            }
            drag={isMobile && !effectiveReducedMotion ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 320 }}
            dragElastic={{ top: 0, bottom: 0.35 }}
            onDragEnd={isMobile ? handleDragEnd : undefined}
            className={cn(
              'relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden bg-white text-slate-900 shadow-modal focus:outline-none dark:border dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100',
              'rounded-t-3xl sm:rounded-2xl',
              maxWidthClass
            )}
          >
            {/* Mobile Drag Handle */}
            <div className="no-print flex justify-center pt-2.5 pb-1 sm:hidden">
              <div className="h-1.5 w-11 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>

            {!hideDefaultHeader && (title || subtitle || headerRight) && (
              <div className="no-print flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5 sm:py-3.5">
                <div className="min-w-0 flex-1">
                  {title && (
                    <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white sm:text-base">
                      {title}
                    </h3>
                  )}
                  {subtitle && (
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {subtitle}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {headerRight}
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label={language === 'sw' ? 'Funga dirisha' : 'Close modal'}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>

            {footer && (
              <div className="no-print pb-safe border-t border-slate-100 bg-slate-50/90 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/95 sm:px-5">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
