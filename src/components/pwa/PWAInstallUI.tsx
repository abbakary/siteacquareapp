import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CheckCircle2,
  Download,
  MoreVertical,
  PlusSquare,
  Share,
  Smartphone,
  WifiOff,
  X,
} from 'lucide-react';
import { DevicePlatform } from '../../hooks/useDeviceAndPWA';
import { Language } from '../../types/aquaculture';
import { tr } from '../../i18n/translations';
import { DURATIONS, EASE_OUT } from '../../ui';

interface PWAInstallGuideModalProps {
  open: boolean;
  platform: DevicePlatform;
  language: Language;
  onClose: () => void;
}

export const PWAInstallGuideModal: React.FC<PWAInstallGuideModalProps> = ({
  open,
  platform,
  language,
  onClose,
}) => {
  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[1200] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: DURATIONS.base, ease: EASE_OUT }}
            onClick={(e) => e.stopPropagation()}
            className="pb-safe w-full max-w-md rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:rounded-3xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src="/pwa-192x192.png"
                  alt="DukaAquSmart"
                  className="h-12 w-12 rounded-2xl shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                />
                <div>
                  <h3 className="font-display text-base font-extrabold text-slate-900 dark:text-white">
                    {tr(language, 'Sakinisha DukaAquSmart', 'Install DukaAquSmart')}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {platform === 'ios'
                      ? tr(language, 'Mwongozo wa iPhone / iPad (Safari)', 'iPhone / iPad Safari Guide')
                      : platform === 'android'
                        ? tr(language, 'Mwongozo wa Simu ya Android', 'Android Phone Install Guide')
                        : tr(language, 'Mwongozo wa Kompyuta / Kivinjari', 'Desktop & Browser Install Guide')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={tr(language, 'Funga', 'Close')}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {platform === 'ios' ? (
                <>
                  <div className="flex items-start gap-3 rounded-2xl bg-sky-50/90 p-3 dark:bg-sky-950/40">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#1D72E8] text-white">
                      <Share className="h-4 w-4" />
                    </div>
                    <div className="text-xs text-slate-700 dark:text-slate-200">
                      <span className="font-bold">1. </span>
                      {tr(
                        language,
                        'Gusa kitufe cha Share (mraba wenye mshale wa juu) chini au juu kwenye Safari.',
                        'Tap the Share icon (square with up arrow) in the Safari toolbar.'
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-2xl bg-emerald-50/90 p-3 dark:bg-emerald-950/40">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                      <PlusSquare className="h-4 w-4" />
                    </div>
                    <div className="text-xs text-slate-700 dark:text-slate-200">
                      <span className="font-bold">2. </span>
                      {tr(
                        language,
                        'Shuka chini kisha gusa "Add to Home Screen" halafu gusa "Add".',
                        'Scroll down, tap "Add to Home Screen", then tap "Add".'
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3 rounded-2xl bg-sky-50/90 p-3 dark:bg-sky-950/40">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#1D72E8] text-white">
                      <MoreVertical className="h-4 w-4" />
                    </div>
                    <div className="text-xs text-slate-700 dark:text-slate-200">
                      <span className="font-bold">1. </span>
                      {tr(
                        language,
                        'Fungua menyu ya kivinjari (Chrome/Edge) au bofya ikoni ya usakinishaji kwenye upau wa anwani.',
                        'Open your browser menu (Chrome/Edge) or click the install icon in the address bar.'
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-2xl bg-emerald-50/90 p-3 dark:bg-emerald-950/40">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                      <Download className="h-4 w-4" />
                    </div>
                    <div className="text-xs text-slate-700 dark:text-slate-200">
                      <span className="font-bold">2. </span>
                      {tr(
                        language,
                        'Chagua "Install App" au "Add to Home Screen" kufungua kama programu ya simu bila mtandao.',
                        'Select "Install App" or "Add to Home Screen" to launch like a native mobile app offline.'
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-5 flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-[#081C3A] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c2750] dark:bg-[#1D72E8]"
            >
              {tr(language, 'Nimeelewa', 'Got it')}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

interface PWAInstallButtonProps {
  language: Language;
  platform: DevicePlatform;
  isInstallable: boolean;
  isInstalled: boolean;
  onInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  variant?: 'header' | 'mobile-pill' | 'full';
  label?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  language,
  platform,
  isInstallable,
  isInstalled,
  onInstall,
  variant = 'header',
  label,
}) => {
  const [guideOpen, setGuideOpen] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const outcome = await onInstall();
      if (outcome === 'unavailable') {
        setGuideOpen(true);
      }
      return;
    }
    setGuideOpen(true);
  };

  const buttonText =
    label || tr(language, 'Sakinisha App', 'Install App');

  if (variant === 'mobile-pill') {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          aria-label={buttonText}
          className="inline-flex min-h-[34px] items-center gap-1 rounded-full bg-sky-400/20 px-2.5 py-1 text-[11px] font-bold text-sky-200 ring-1 ring-sky-300/35 transition-colors hover:bg-sky-400/30"
        >
          <Download className="h-3.5 w-3.5" />
          <span>{tr(language, 'Pakua', 'Install')}</span>
        </button>
        <PWAInstallGuideModal
          open={guideOpen}
          platform={platform}
          language={language}
          onClose={() => setGuideOpen(false)}
        />
      </>
    );
  }

  if (variant === 'full') {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-[#1D72E8] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Download className="h-4 w-4" />
          <span>{label || tr(language, 'Sakinisha DukaAquSmart', 'Install DukaAquSmart')}</span>
        </button>
        <PWAInstallGuideModal
          open={guideOpen}
          platform={platform}
          language={language}
          onClose={() => setGuideOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/95 px-2.5 text-xs font-bold text-[#1D72E8] shadow-xs transition-colors hover:bg-blue-100 dark:border-sky-800 dark:bg-sky-950/70 dark:text-sky-300 dark:hover:bg-sky-900/80"
      >
        <Download className="h-3.5 w-3.5 shrink-0" />
        <span className="whitespace-nowrap">{buttonText}</span>
      </button>
      <PWAInstallGuideModal
        open={guideOpen}
        platform={platform}
        language={language}
        onClose={() => setGuideOpen(false)}
      />
    </>
  );
};

interface PWAInstallCardProps {
  language: Language;
  platform: DevicePlatform;
  isInstallable: boolean;
  isInstalled: boolean;
  onInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  compact?: boolean;
}

export const PWAInstallCard: React.FC<PWAInstallCardProps> = ({
  language,
  platform,
  isInstallable,
  isInstalled,
  onInstall,
  compact = false,
}) => {
  if (isInstalled) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-3.5 py-2.5 text-xs dark:border-emerald-800 dark:bg-emerald-950/40">
        <div className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>{tr(language, 'Programu imesakinishwa kwenye kifaa', 'Installed as App')}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-sky-200/90 bg-gradient-to-r from-[#EFF6FF] to-[#E0F2FE] dark:border-sky-800/70 dark:from-[#0c203d] dark:to-[#0f294d] ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#081C3A] text-sky-300 shadow-xs">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-display text-sm font-extrabold text-[#081C3A] dark:text-white">
              DukaAquSmart
            </span>
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-[#1D72E8] dark:bg-sky-900/80 dark:text-sky-200">
              {tr(language, 'Tayari kwa Simu', 'Mobile ready')}
            </span>
          </div>
          <p className="mt-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            {tr(language, 'Shamba lako la samaki, mfukoni mwako', 'Your fish farm, in your pocket')}
          </p>
        </div>
      </div>
      <div className="mt-3">
        <PWAInstallButton
          language={language}
          platform={platform}
          isInstallable={isInstallable}
          isInstalled={isInstalled}
          onInstall={onInstall}
          variant="full"
          label={tr(language, 'Sakinisha DukaAquSmart', 'Install DukaAquSmart')}
        />
      </div>
    </div>
  );
};

export const OfflineStatusPill: React.FC<{ isOnline: boolean; language: Language }> = ({
  isOnline,
  language,
}) => {
  if (isOnline) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-200 ring-1 ring-amber-400/40">
      <WifiOff className="h-3 w-3" />
      <span>{tr(language, 'Nje ya Mtandao', 'Offline')}</span>
    </span>
  );
};
