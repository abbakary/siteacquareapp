import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BarChart3,
  Bot,
  Check,
  ChevronRight,
  Droplets,
  Fish,
  Globe,
  HeartPulse,
  HelpCircle,
  ListChecks,
  Moon,
  Monitor,
  Package,
  RefreshCw,
  Settings,
  Sun,
  Users,
  Utensils,
  WifiOff,
  X,
} from 'lucide-react';
import { AquacultureState, Language, NavSection } from '../../types/aquaculture';
import { ASSET_IMAGES } from '../../data/seedData';
import { tDomain, tr } from '../../i18n/translations';
import { DevicePlatform } from '../../hooks/useDeviceAndPWA';
import { PWAInstallCard } from '../pwa/PWAInstallUI';
import { DURATIONS, EASE_OUT, ThemeMode } from '../../ui';

interface MobileMoreSheetProps {
  open: boolean;
  onClose: () => void;
  state: AquacultureState;
  language: Language;
  themeMode: ThemeMode;
  onCycleTheme: () => void;
  onChangeLanguage: (lang: Language) => void;
  onNavigate: (nav: NavSection) => void;
  onSwitchUser: (empId: string) => void;
  onSyncNow: () => void;
  isSyncing: boolean;
  platform: DevicePlatform;
  isInstallable: boolean;
  isInstalled: boolean;
  onInstallApp: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

export const MobileMoreSheet: React.FC<MobileMoreSheetProps> = ({
  open,
  onClose,
  state,
  language,
  themeMode,
  onCycleTheme,
  onChangeLanguage,
  onNavigate,
  onSwitchUser,
  onSyncNow,
  isSyncing,
  platform,
  isInstallable,
  isInstalled,
  onInstallApp,
}) => {
  const [showAccounts, setShowAccounts] = useState(false);

  const navigateAndClose = (nav: NavSection) => {
    onNavigate(nav);
    onClose();
  };

  const modules: Array<{
    id: NavSection;
    title: string;
    subtitle: string;
    icon: React.FC<{ className?: string }>;
    tone: string;
    badge?: number;
  }> = [
    {
      id: 'feeding',
      title: tr(language, 'Ulishaji & Ubora wa Maji', 'Feeding & Water Quality'),
      subtitle: tr(language, 'Ratiba ya chakula, Oksijeni, pH na Joto', 'Feeding schedule, DO, pH & temp'),
      icon: Utensils,
      tone: 'bg-sky-100 text-[#1D72E8] dark:bg-sky-900/50 dark:text-sky-300',
    },
    {
      id: 'water-quality',
      title: tr(language, 'Kipimo cha Maji & ESP32', 'Water Quality Monitor'),
      subtitle: tr(language, 'Vipimo vya moja kwa moja na kipulizia hewa', 'Live telemetry & aerator relay'),
      icon: Droplets,
      tone: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300',
    },
    {
      id: 'fish-health',
      title: tr(language, 'Afya ya Samaki', 'Fish Health Care'),
      subtitle: tr(language, 'Vifo, dalili na rekodi za matibabu', 'Mortality alerts & treatments'),
      icon: HeartPulse,
      tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
      badge: state.healthIncidents.filter((h) => h.status !== 'Resolved').length,
    },
    {
      id: 'inventory',
      title: tr(language, 'Stoo & Fedha', 'Inventory & Finance'),
      subtitle: tr(language, 'Chakula cha samaki, manunuzi na mapato', 'Feed stock, purchases & TZS ledger'),
      icon: Package,
      tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
      badge: state.inventory.filter((i) => i.status !== 'In Stock').length,
    },
    {
      id: 'finance',
      title: tr(language, 'Ripoti za Fedha (TZS)', 'Finance Reports'),
      subtitle: tr(language, 'Faida, matumizi na mtiririko wa fedha', 'Profit, expenses & TZS cashflow'),
      icon: BarChart3,
      tone: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300',
    },
    {
      id: 'tasks-alerts',
      title: tr(language, 'Kazi & Msaidizi wa AI', 'Tasks & Aqua Intelligence'),
      subtitle: tr(language, 'Orodha ya kazi za leo na ushauri wa AI', 'Daily checklist & AI insights'),
      icon: ListChecks,
      tone: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
      badge: state.tasks.filter((t) => t.status === 'Pending').length,
    },
    {
      id: 'aqua-intelligence',
      title: tr(language, 'Aqua Intelligence (AI)', 'Aqua Intelligence (AI)'),
      subtitle: tr(language, 'Utabiri wa mavuno, FCR na afya ya maji', 'Yield forecast, FCR & smart advisor'),
      icon: Bot,
      tone: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
    },
    {
      id: 'fish-species',
      title: tr(language, 'Aina za Samaki', 'Fish Species Catalogue'),
      subtitle: tr(language, 'Sato, Kambale na vigezo vya FFRC/FIRCIS', 'Tilapia, Catfish & species rules'),
      icon: Fish,
      tone: 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300',
    },
    {
      id: 'employees',
      title: tr(language, 'Wafanyakazi & Uwajibikaji', 'Employees & Accountability'),
      subtitle: tr(language, 'Watumiaji, zamu na kumbukumbu za ukaguzi', 'Team roles, shifts & audit logs'),
      icon: Users,
      tone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    },
    {
      id: 'settings',
      title: tr(language, 'Mipangilio & Usawazishaji', 'Settings & Offline Sync'),
      subtitle: tr(language, 'Usalama, hifadhi na nakala rudufu', 'Backup, offline mode & preferences'),
      icon: Settings,
      tone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    },
    {
      id: 'help',
      title: tr(language, 'Msaada & Miongozo', 'Help & Field SOPs'),
      subtitle: tr(language, 'Mwongozo wa ufugaji bora Tanzania', 'Aquaculture best-practice guides'),
      icon: HelpCircle,
      tone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    },
  ];

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[1150] flex items-end justify-center md:hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATIONS.fast }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-[1px]"
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: DURATIONS.base, ease: EASE_OUT }}
            className="pb-safe relative z-10 flex max-h-[88vh] w-full flex-col rounded-t-3xl border-t border-slate-200 bg-[#F8FAFC] shadow-2xl dark:border-slate-800 dark:bg-[#081326]"
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200/80 px-4 pb-3 dark:border-slate-800">
              <div>
                <h2 className="font-display text-base font-extrabold text-slate-900 dark:text-white">
                  {tr(language, 'Moduli & Mipangilio Zaidi', 'More Modules & Tools')}
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  DukaAquSmart · {tr(language, 'Shamba la Kisasa', 'Smart Aquaculture')}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={tr(language, 'Funga', 'Close')}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200/70 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3.5">
              {/* Active User / Role Switcher Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setShowAccounts((p) => !p)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <img
                      src={state.activeUser.avatarUrl || ASSET_IMAGES.avatar}
                      alt={state.activeUser.name}
                      referrerPolicy="no-referrer"
                      className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-emerald-400/70"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-slate-900 dark:text-white">
                        {state.activeUser.name}
                      </div>
                      <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {tDomain(language, state.activeUser.roleLabel)} · PIN {state.activeUser.pin}
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-[#1D72E8] dark:bg-sky-900/50 dark:text-sky-300">
                    {tr(language, 'Badilisha', 'Switch')}
                  </span>
                </button>

                {showAccounts && (
                  <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                    {state.employees.map((emp) => {
                      const active = emp.id === state.activeUser.id;
                      return (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => {
                            onSwitchUser(emp.id);
                            setShowAccounts(false);
                          }}
                          className={`flex min-h-[44px] w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors ${
                            active
                              ? 'bg-[#1D72E8] font-bold text-white'
                              : 'bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="truncate font-semibold">{emp.name}</div>
                            <div
                              className={`truncate text-[10px] ${
                                active ? 'text-sky-100' : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {tDomain(language, emp.roleLabel)}
                            </div>
                          </div>
                          {active && <Check className="h-4 w-4 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Install App Promo Card (only when not installed) */}
              <PWAInstallCard
                language={language}
                platform={platform}
                isInstallable={isInstallable}
                isInstalled={isInstalled}
                onInstall={onInstallApp}
                compact
              />

              {/* Quick Language / Theme / Sync Controls */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onChangeLanguage(language === 'sw' ? 'en' : 'sw')}
                  className="flex min-h-[44px] items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                >
                  <span className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-[#1D72E8]" />
                    <span>{language === 'sw' ? 'Kiswahili' : 'English'}</span>
                  </span>
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {language === 'sw' ? 'SW' : 'EN'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onCycleTheme}
                  className="flex min-h-[44px] items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                >
                  <span className="flex items-center gap-2">
                    {themeMode === 'dark' ? (
                      <Moon className="h-4 w-4 text-sky-400" />
                    ) : themeMode === 'system' ? (
                      <Monitor className="h-4 w-4 text-blue-600" />
                    ) : (
                      <Sun className="h-4 w-4 text-amber-500" />
                    )}
                    <span>
                      {themeMode === 'dark'
                        ? tr(language, 'Giza', 'Dark')
                        : themeMode === 'system'
                          ? tr(language, 'Mfumo', 'Auto')
                          : tr(language, 'Mwanga', 'Light')}
                    </span>
                  </span>
                </button>
              </div>

              {state.pendingSyncQueue.length > 0 && (
                <button
                  type="button"
                  onClick={onSyncNow}
                  disabled={isSyncing}
                  className="flex min-h-[44px] w-full items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-bold text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200"
                >
                  <span className="flex items-center gap-2">
                    <WifiOff className="h-4 w-4" />
                    <span>
                      {state.pendingSyncQueue.length}{' '}
                      {tr(language, 'kumbukumbu zinasubiri kusawazishwa', 'records waiting to sync')}
                    </span>
                  </span>
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                </button>
              )}

              {/* Modules List */}
              <div className="space-y-2 pb-2">
                {modules.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigateAndClose(item.id)}
                      className="flex min-h-[54px] w-full items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-left shadow-xs transition-colors active:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:active:bg-slate-800"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.tone}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-slate-900 dark:text-white">
                            {item.title}
                          </div>
                          <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {item.subtitle}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {item.badge !== undefined && item.badge > 0 && (
                          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white tabular-nums">
                            {item.badge}
                          </span>
                        )}
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
