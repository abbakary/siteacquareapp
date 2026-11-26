import React, { lazy, Suspense, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Boxes,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Coins,
  Droplets,
  Fish,
  HeartPulse,
  Lightbulb,
  MapPin,
  MoreHorizontal,
  Package,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Thermometer,
  TrendingUp,
  Utensils,
  Waves,
} from 'lucide-react';
import {
  AquacultureState,
  FishBatch,
  Language,
  NavSection,
  Pond,
  PreOrder,
  Sale,
} from '../../types/aquaculture';
import { ASSET_IMAGES } from '../../data/seedData';
import { tDomain, tr } from '../../i18n/translations';
import { formatNumber, formatTzs } from '../../utils/formatters';
import { QuickActionType } from '../QuickActionModals';
import { FarmsModuleSection } from '../modules/FarmPondsModule';
import { AquaIntelligenceView } from '../modules/AquaIntelligenceView';
import { DevicePlatform } from '../../hooks/useDeviceAndPWA';
import { PWAInstallCard } from '../pwa/PWAInstallUI';
import { DURATIONS, EASE_OUT, MapSkeleton, usePreferences } from '../../ui';

const LeafletFarmMap = lazy(() =>
  import('../LeafletFarmMap').then((m) => ({ default: m.LeafletFarmMap }))
);

function formatCompactTzs(val: number): string {
  if (val >= 1_000_000) {
    return `TZS ${(val / 1_000_000).toFixed(2).replace(/\.00$/, '')}M`;
  }
  if (val >= 1_000) {
    return `TZS ${Math.round(val / 1_000).toLocaleString()}K`;
  }
  return `TZS ${Math.round(val).toLocaleString()}`;
}

interface MobileScreensProps {
  activeNav: NavSection;
  state: AquacultureState;
  language: Language;
  selectedFarmId: string;
  onSelectFarmId: (farmId: string) => void;
  onNavigate: (nav: NavSection) => void;
  onOpenMore: () => void;
  onQuickAction: (action: QuickActionType) => void;
  onOpenQuickSale: (opts?: { lotId?: string; pondCode?: string; preOrder?: PreOrder }) => void;
  onSelectPondQr: (pond: Pond) => void;
  onViewInvoice: (sale: Sale) => void;
  onCompleteTask: (taskId: string) => void;
  onAcknowledgeAlert: (alertId: string) => void;
  onToggleAerator: (pondId: string) => void;
  onOpenFullWorkspace: (section?: FarmsModuleSection) => void;
  onRestockItem: (itemId: string) => void;
  platform: DevicePlatform;
  isInstallable: boolean;
  isInstalled: boolean;
  onInstallApp: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

export const MobileAppScreens: React.FC<MobileScreensProps> = ({
  activeNav,
  state,
  language,
  selectedFarmId,
  onSelectFarmId,
  onNavigate,
  onOpenMore,
  onQuickAction,
  onOpenQuickSale,
  onSelectPondQr,
  onViewInvoice,
  onCompleteTask,
  onToggleAerator,
  onOpenFullWorkspace,
  onRestockItem,
  platform,
  isInstallable,
  isInstalled,
  onInstallApp,
}) => {
  const { effectiveReducedMotion } = usePreferences();
  const [selectedMapPondId, setSelectedMapPondId] = useState<string | null>(null);
  const [locatingGps, setLocatingGps] = useState(false);
  const [userGps, setUserGps] = useState<{ gps: [number, number]; accuracyM?: number } | null>(null);
  const [selectedBatchDetail, setSelectedBatchDetail] = useState<FishBatch | null>(null);
  const [activeTrendIdx, setActiveTrendIdx] = useState<number>(5);

  const filteredPonds = useMemo(
    () =>
      selectedFarmId === 'all'
        ? state.ponds
        : state.ponds.filter((p) => p.farmId === selectedFarmId),
    [state.ponds, selectedFarmId]
  );

  const totalFishStock = useMemo(
    () => filteredPonds.reduce((acc, p) => acc + p.currentFish, 0),
    [filteredPonds]
  );

  const totalSalesAmount = useMemo(
    () => state.sales.reduce((acc, s) => acc + s.totalTzs, 0),
    [state.sales]
  );

  const openAlertsCount = useMemo(
    () => state.alerts.filter((a) => !a.acknowledged).length,
    [state.alerts]
  );

  const firstName = state.activeUser.name.split(' ')[0] || 'Bigambo';
  const latestWater = state.waterReadings[0];

  const requestGps = () => {
    if (!navigator.geolocation) return;
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserGps({
          gps: [pos.coords.latitude, pos.coords.longitude],
          accuracyM: Math.round(pos.coords.accuracy),
        });
        setLocatingGps(false);
      },
      () => setLocatingGps(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // =========================================================================
  // SCREEN 1: MAIN DASHBOARD
  // =========================================================================
  if (activeNav === 'dashboard') {
    const trendMonths =
      language === 'sw'
        ? ['Mei', 'Jun', 'Jul', 'Ago', 'Sep', 'Okt']
        : ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
    const baseEnd = Math.max(4.5, Math.min(28, Number((totalFishStock / 2100).toFixed(1)) || 8.8));
    const curveRatios = [0.56, 0.59, 0.68, 0.76, 0.86, 1.0];
    const trendPoints = curveRatios.map((r) => Number((baseEnd * r).toFixed(1)));
    const axisMax = Math.max(10, Math.ceil(baseEnd / 5) * 5);
    const axisMid = Math.round(axisMax / 2);
    const svgW = 300;
    const svgH = 88;
    const padTop = 12;
    const padBottom = 10;
    const innerH = svgH - padTop - padBottom;
    const pts = trendPoints.map((val, idx) => {
      const x = 18 + (idx * (svgW - 36)) / (trendPoints.length - 1);
      const y = padTop + innerH - (val / axisMax) * innerH;
      return { x, y, val, month: trendMonths[idx] };
    });
    const safeIdx = Math.min(activeTrendIdx, pts.length - 1);
    const activePt = pts[safeIdx];
    const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${svgH - padBottom} L ${pts[0].x} ${svgH - padBottom} Z`;
    const tooltipX = Math.min(Math.max(activePt.x - 36, 4), svgW - 76);
    const tooltipY = Math.max(activePt.y - 28, 0);

    return (
      <div className="space-y-3">
        {/* Greeting Card */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-rest dark:border-slate-800 dark:bg-slate-900">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-extrabold tracking-tight text-[#081C3A] dark:text-white">
              {tr(language, `Habari, ${firstName} 👋`, `Hello, ${firstName} 👋`)}
            </h2>
            <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              {tr(language, 'Ufugaji wako kwa muhtasari', 'Your aquaculture at a glance')}
            </p>
          </div>
          <img
            src={ASSET_IMAGES.pondThumb}
            alt="Tanzania aquaculture ponds"
            className="h-14 w-20 shrink-0 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700"
          />
        </div>

        {/* Farm Selector Pill */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
              <MapPin className="h-3.5 w-3.5" />
            </span>
            <select
              value={selectedFarmId}
              onChange={(e) => onSelectFarmId(e.target.value)}
              aria-label={tr(language, 'Chagua Shamba', 'Select Farm')}
              className="w-full appearance-none bg-transparent text-xs font-bold text-slate-800 focus:outline-none dark:text-slate-100"
            >
              {state.farms.map((f) => (
                <option key={f.id} value={f.id} className="dark:bg-slate-900">
                  {f.name}
                </option>
              ))}
              <option value="all" className="dark:bg-slate-900">
                {tr(language, 'Mashamba Yote Tanzania', 'All Farms')}
              </option>
            </select>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        </div>

        {/* 2x2 KPI Tiles */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('farms-ponds')}
            className="flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white p-3 text-left shadow-rest active:scale-[0.99] dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-[#1D72E8] dark:bg-sky-900/40 dark:text-sky-300">
              <Waves className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold leading-tight text-slate-500 dark:text-slate-400">
                {tr(language, 'Mabwawa', 'Total Ponds')}
              </div>
              <div className="font-display text-lg font-extrabold text-slate-900 tabular-nums dark:text-white">
                {filteredPonds.length}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('fish-stock')}
            className="flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white p-3 text-left shadow-rest active:scale-[0.99] dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <Fish className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold leading-tight text-slate-500 dark:text-slate-400">
                {tr(language, 'Akiba Samaki', 'Fish Stock')}
              </div>
              <div className="font-display text-lg font-extrabold text-slate-900 tabular-nums dark:text-white">
                {formatNumber(totalFishStock)}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('harvest-sales')}
            className="flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white p-3 text-left shadow-rest active:scale-[0.99] dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold leading-tight text-slate-500 dark:text-slate-400">
                {tr(language, 'Mauzo', "Today's Sales")}
              </div>
              <div className="font-display text-[15px] font-extrabold text-slate-900 tabular-nums dark:text-white">
                {formatCompactTzs(totalSalesAmount)}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('tasks-alerts')}
            className="flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white p-3 text-left shadow-rest active:scale-[0.99] dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300">
              <Bell className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold leading-tight text-slate-500 dark:text-slate-400">
                {tr(language, 'Tahadhari', 'Alerts')}
              </div>
              <div className="flex items-center gap-1.5 font-display text-lg font-extrabold text-slate-900 tabular-nums dark:text-white">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <span>{openAlertsCount}</span>
              </div>
            </div>
          </button>
        </div>

        {/* Production Trend Chart Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-rest dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-extrabold text-[#081C3A] dark:text-white">
                {tr(language, 'Mwenendo wa Uzalishaji', 'Production Trend')}
              </h3>
              <p className="text-[10.5px] font-semibold text-sky-600 tabular-nums dark:text-sky-400">
                {activePt.month}: {activePt.val.toFixed(1)}k kg
              </p>
            </div>
            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10.5px] font-bold text-[#1D72E8] dark:bg-sky-900/40 dark:text-sky-300">
              {tr(language, 'Miezi 6 Iliyopita', 'Last 6 Months')}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-2 select-none">
            <div className="flex h-[88px] flex-col justify-between py-2 text-[10px] font-medium text-slate-400 tabular-nums">
              <span>{axisMax}k</span>
              <span>{axisMid}k</span>
              <span>0k</span>
            </div>
            <div className="min-w-0 flex-1">
              <svg viewBox={`0 0 ${svgW} ${svgH}`} className="h-[88px] w-full overflow-visible">
                <defs>
                  <linearGradient id="mobTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.36" />
                    <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {/* Gridlines */}
                <line
                  x1="10"
                  y1={padTop}
                  x2={svgW - 10}
                  y2={padTop}
                  strokeDasharray="3 3"
                  className="stroke-slate-200/80 dark:stroke-slate-800"
                  strokeWidth="1"
                />
                <line
                  x1="10"
                  y1={padTop + innerH / 2}
                  x2={svgW - 10}
                  y2={padTop + innerH / 2}
                  strokeDasharray="3 3"
                  className="stroke-slate-200/80 dark:stroke-slate-800"
                  strokeWidth="1"
                />
                <line
                  x1="10"
                  y1={svgH - padBottom}
                  x2={svgW - 10}
                  y2={svgH - padBottom}
                  className="stroke-slate-200 dark:stroke-slate-700"
                  strokeWidth="1"
                />

                {/* Smooth area fill */}
                <motion.path
                  fill="url(#mobTrendFill)"
                  initial={effectiveReducedMotion ? { opacity: 1, d: areaPath } : { opacity: 0, d: areaPath }}
                  animate={{ opacity: 1, d: areaPath }}
                  transition={
                    effectiveReducedMotion
                      ? { duration: 0 }
                      : { duration: DURATIONS.chart * 0.75, ease: EASE_OUT }
                  }
                />

                {/* Progressive draw + farm-switch morph */}
                <motion.path
                  fill="none"
                  stroke="#0EA5E9"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={
                    effectiveReducedMotion
                      ? { pathLength: 1, d: linePath }
                      : { pathLength: 0, d: linePath }
                  }
                  animate={{ pathLength: 1, d: linePath }}
                  transition={
                    effectiveReducedMotion
                      ? { duration: 0 }
                      : {
                          pathLength: { duration: DURATIONS.chart, ease: EASE_OUT },
                          d: { duration: 0.45, ease: EASE_OUT },
                        }
                  }
                />

                {/* Active vertical hairline */}
                <motion.line
                  y1={padTop}
                  y2={svgH - padBottom}
                  initial={false}
                  animate={{ x1: activePt.x, x2: activePt.x }}
                  transition={
                    effectiveReducedMotion
                      ? { duration: 0 }
                      : { duration: DURATIONS.button, ease: EASE_OUT }
                  }
                  stroke="#0284C7"
                  strokeOpacity="0.45"
                  strokeDasharray="3 3"
                  strokeWidth="1.2"
                />

                {/* Pulsing ring on active node */}
                {!effectiveReducedMotion && (
                  <motion.circle
                    cx={activePt.x}
                    cy={activePt.y}
                    fill="none"
                    stroke="#0EA5E9"
                    strokeWidth="1.5"
                    initial={{ r: 4.5, opacity: 0.75 }}
                    animate={{ r: [4.5, 10, 4.5], opacity: [0.75, 0, 0.75] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}

                {/* Animated points + touch hit areas */}
                {pts.map((p, i) => {
                  const isActive = i === safeIdx;
                  return (
                    <g
                      key={p.month}
                      onClick={() => setActiveTrendIdx(i)}
                      onMouseEnter={() => setActiveTrendIdx(i)}
                      className="cursor-pointer"
                    >
                      <rect
                        x={p.x - 22}
                        y={0}
                        width={44}
                        height={svgH}
                        fill="transparent"
                      />
                      <motion.circle
                        initial={effectiveReducedMotion ? false : { scale: 0, opacity: 0 }}
                        animate={{
                          cx: p.x,
                          cy: p.y,
                          r: isActive ? 5 : 3.5,
                          scale: 1,
                          opacity: 1,
                        }}
                        transition={
                          effectiveReducedMotion
                            ? { duration: 0 }
                            : {
                                cx: { duration: 0.45, ease: EASE_OUT },
                                cy: { duration: 0.45, ease: EASE_OUT },
                                scale: { duration: 0.25, delay: 0.14 + i * 0.06, ease: EASE_OUT },
                                opacity: { duration: 0.25, delay: 0.14 + i * 0.06 },
                              }
                        }
                        fill={isActive ? '#0284C7' : '#FFFFFF'}
                        stroke={isActive ? '#FFFFFF' : '#0284C7'}
                        strokeWidth={isActive ? 2.2 : 2}
                      />
                    </g>
                  );
                })}

                {/* Gliding value badge */}
                <motion.g
                  initial={false}
                  animate={{ x: tooltipX, y: tooltipY }}
                  transition={
                    effectiveReducedMotion
                      ? { duration: 0 }
                      : { duration: DURATIONS.button, ease: EASE_OUT }
                  }
                  className="pointer-events-none"
                >
                  <rect
                    width="72"
                    height="20"
                    rx="6"
                    className="fill-[#081C3A]/95 dark:fill-sky-600"
                  />
                  <text
                    x="36"
                    y="13.5"
                    textAnchor="middle"
                    className="fill-white text-[9.5px] font-bold tabular-nums"
                  >
                    {activePt.val.toFixed(1)}k kg
                  </text>
                </motion.g>
              </svg>
              <div className="mt-1 flex justify-between px-2 text-[10px] font-medium">
                {pts.map((p, i) => (
                  <button
                    key={p.month}
                    type="button"
                    onClick={() => setActiveTrendIdx(i)}
                    className={`rounded px-1 py-0.5 transition-colors ${
                      i === safeIdx
                        ? 'font-extrabold text-[#1D72E8] dark:text-sky-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {p.month}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions 4-Tile Strip */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-rest dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-2.5 font-display text-sm font-extrabold text-[#081C3A] dark:text-white">
            {tr(language, 'Vitendo vya Haraka', 'Quick Actions')}
          </h3>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              {
                label: tr(language, 'Weka Akiba', 'Add Stock'),
                icon: Boxes,
                tone: 'bg-emerald-50 text-emerald-700 border-emerald-200/70 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
                onClick: () => onNavigate('fish-stock'),
              },
              {
                label: tr(language, 'Chakula', 'Log Feed'),
                icon: Utensils,
                tone: 'bg-sky-50 text-[#0284C7] border-sky-200/70 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
                onClick: () => onQuickAction('feeding'),
              },
              {
                label: tr(language, 'Mauzo', 'Record Sale'),
                icon: ShoppingCart,
                tone: 'bg-blue-50 text-[#1D72E8] border-blue-200/70 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
                onClick: () => onOpenQuickSale(),
              },
              {
                label: tr(language, 'Zaidi', 'More'),
                icon: MoreHorizontal,
                tone: 'bg-slate-100 text-slate-700 border-slate-200/80 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
                onClick: onOpenMore,
              },
            ].map((qa) => {
              const Icon = qa.icon;
              return (
                <button
                  key={qa.label}
                  type="button"
                  onClick={qa.onClick}
                  className={`flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 py-2 text-center transition-transform active:scale-95 ${qa.tone}`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="text-[10.5px] font-bold leading-snug break-words">
                    {qa.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Install App Card on Mobile Dashboard when not installed */}
        {!isInstalled && (
          <PWAInstallCard
            language={language}
            platform={platform}
            isInstallable={isInstallable}
            isInstalled={isInstalled}
            onInstall={onInstallApp}
            compact
          />
        )}
      </div>
    );
  }

  // =========================================================================
  // SCREEN 2: FARMS & PONDS / GIS MAPPING
  // =========================================================================
  if (activeNav === 'farms-ponds') {
    const activePond =
      filteredPonds.find((p) => p.id === selectedMapPondId) || filteredPonds[0] || null;

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-extrabold text-[#081C3A] dark:text-white">
            {tr(language, 'Mashamba & Mabwawa', 'Farms & Ponds')}
          </h2>
          <button
            type="button"
            onClick={() => onOpenFullWorkspace('register-pond')}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#1D72E8] px-3 py-1.5 text-xs font-bold text-white shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{tr(language, 'Sajili GIS', 'GIS Register')}</span>
          </button>
        </div>

        {/* Farm Dropdown */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-emerald-600" />
            <select
              value={selectedFarmId}
              onChange={(e) => onSelectFarmId(e.target.value)}
              aria-label={tr(language, 'Chuja kwa Shamba', 'Filter by Farm')}
              className="w-full appearance-none bg-transparent text-xs font-bold text-slate-800 focus:outline-none dark:text-slate-100"
            >
              <option value="all" className="dark:bg-slate-900">
                {tr(language, 'Mashamba Yote', 'All Farms')}
              </option>
              {state.farms.map((f) => (
                <option key={f.id} value={f.id} className="dark:bg-slate-900">
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </div>

        {/* Interactive Satellite Map Card with Floating Selected Pond Pill */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-900 shadow-rest dark:border-slate-800">
          <Suspense fallback={<MapSkeleton heightClass="h-[185px]" />}>
            <LeafletFarmMap
              ponds={filteredPonds}
              farms={state.farms}
              selectedFarmId={selectedFarmId}
              mapMode="satellite"
              heightClass="h-[185px]"
              focusedPondId={activePond?.id || null}
              userLocation={userGps}
              onSelectPond={(p) => setSelectedMapPondId(p.id)}
              onSelectFarm={onSelectFarmId}
              onRequestGps={requestGps}
              locatingGps={locatingGps}
            />
          </Suspense>

          {activePond && (
            <button
              type="button"
              onClick={() => onSelectPondQr(activePond)}
              className="absolute right-3 top-3 z-[400] rounded-xl border border-white/60 bg-white/95 px-3 py-1.5 text-left shadow-md backdrop-blur-xs dark:border-slate-700 dark:bg-slate-900/95"
            >
              <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                {activePond.name}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] font-bold text-emerald-700 dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>{tDomain(language, activePond.status)}</span>
              </div>
            </button>
          )}
        </div>

        {/* Full GIS Link Strip */}
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
            {tr(language, `Mabwawa (${filteredPonds.length})`, `Ponds (${filteredPonds.length})`)}
          </span>
          <button
            type="button"
            onClick={() => onOpenFullWorkspace('map')}
            className="text-xs font-bold text-[#1D72E8] dark:text-sky-400"
          >
            {tr(language, 'Fungua Ramani Kamili →', 'Open Full GIS Map →')}
          </button>
        </div>

        {/* Pond Cards List */}
        <div className="space-y-2.5">
          {filteredPonds.map((pond) => {
            const pondWater = state.waterReadings.find((w) => w.pondCode === pond.code);
            const temp = pondWater ? `${pondWater.temperature.toFixed(0)}°C` : '26°C';
            const badgeTone =
              pond.status === 'Attention'
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
                : pond.status === 'Harvest Ready'
                  ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200';

            return (
              <button
                key={pond.id}
                type="button"
                onClick={() => onSelectPondQr(pond)}
                className="flex min-h-[68px] w-full items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-2.5 text-left shadow-rest active:bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <img
                    src={ASSET_IMAGES.pondThumb}
                    alt={pond.name}
                    className="h-12 w-16 shrink-0 rounded-xl object-cover"
                  />
                  <div className="min-w-0">
                    <div className="truncate font-display text-sm font-extrabold text-slate-900 dark:text-white">
                      {pond.name} <span className="text-[11px] font-semibold text-slate-400">({pond.code})</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {tr(language, 'Akiba', 'Stock')}: {formatNumber(pond.currentFish)} | {temp}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${badgeTone}`}>
                    {tDomain(language, pond.status)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // =========================================================================
  // SCREEN 3: FISH STOCK & SPECIES
  // =========================================================================
  if (activeNav === 'fish-stock' || activeNav === 'fish-species') {
    const activeBatches = state.batches.filter((b) => b.status !== 'Completed');
    const avgWeightG =
      activeBatches.length > 0
        ? Math.round(
            activeBatches.reduce((sum, b) => sum + b.currentAvgWeightG, 0) / activeBatches.length
          )
        : 0;

    return (
      <div className="space-y-3">
        {/* Segmented Switcher */}
        <div className="grid grid-cols-2 rounded-2xl border border-slate-200/80 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => onNavigate('fish-stock')}
            className={`min-h-[38px] rounded-xl text-xs font-bold transition-colors ${
              activeNav === 'fish-stock'
                ? 'bg-[#1D72E8] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {tr(language, 'Makundi & Akiba', 'Stock Batches')}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('fish-species')}
            className={`min-h-[38px] rounded-xl text-xs font-bold transition-colors ${
              activeNav === 'fish-species'
                ? 'bg-[#1D72E8] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {tr(language, 'Aina za Samaki', 'Species Guide')}
          </button>
        </div>

        {/* Hero Species Card */}
        <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-rest dark:border-slate-800 dark:bg-slate-900">
          <img
            src={ASSET_IMAGES.tilapia}
            alt="Nile Tilapia"
            className="h-16 w-24 shrink-0 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700"
          />
          <div className="min-w-0">
            <h2 className="font-display text-lg font-extrabold text-[#081C3A] dark:text-white">
              {activeNav === 'fish-species'
                ? tr(language, 'Sato & Kambale', 'Tilapia & Catfish')
                : tr(language, 'Sato (Tilapia)', 'Tilapia')}
            </h2>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {tr(language, 'Aina Kuu ya Uzalishaji', 'Main Species')}
            </p>
          </div>
        </div>

        {/* 3-Column Metrics */}
        <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-2xl border border-slate-200/80 bg-white py-3 text-center shadow-rest dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          <div className="px-2">
            <div className="font-display text-base font-extrabold text-[#081C3A] tabular-nums dark:text-white">
              {formatNumber(totalFishStock)}
            </div>
            <div className="mt-0.5 text-[10.5px] font-medium text-slate-500 dark:text-slate-400">
              {tr(language, 'Jumla Akiba', 'Total Stock')}
            </div>
          </div>
          <div className="px-2">
            <div className="font-display text-base font-extrabold text-[#081C3A] tabular-nums dark:text-white">
              {avgWeightG} g
            </div>
            <div className="mt-0.5 text-[10.5px] font-medium text-slate-500 dark:text-slate-400">
              {tr(language, 'Wastani Uzito', 'Avg Weight')}
            </div>
          </div>
          <div className="px-2">
            <div className="font-display text-base font-extrabold text-[#081C3A] tabular-nums dark:text-white">
              {activeBatches.length}
            </div>
            <div className="mt-0.5 text-[10.5px] font-medium text-slate-500 dark:text-slate-400">
              {tr(language, 'Makundi', 'Batches')}
            </div>
          </div>
        </div>

        {/* Primary Add Stock CTA */}
        <button
          type="button"
          onClick={() => onOpenFullWorkspace()}
          className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl bg-[#1D72E8] px-4 py-2.5 text-sm font-bold text-white shadow-sm active:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          <span>{tr(language, 'Ongeza Akiba ya Samaki', 'Add Stock')}</span>
        </button>

        {activeNav === 'fish-species' ? (
          <div className="space-y-2.5">
            {state.speciesCatalogue.map((sp) => (
              <div
                key={sp.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-rest dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-display text-sm font-extrabold text-slate-900 dark:text-white">
                      {language === 'sw' ? `${sp.swahiliName} (${sp.commonName})` : sp.commonName}
                    </div>
                    <div className="text-[11px] italic text-slate-500 dark:text-slate-400">
                      {sp.scientificName}
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                    {tr(language, 'Ruhusa FIRCIS', 'FIRCIS OK')}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                  <div>Temp: <b>{sp.optimalTempRange}</b></div>
                  <div>DO: <b>&ge;{sp.optimalDoMin} mg/L</b></div>
                  <div>{tr(language, 'Mzunguko', 'Cycle')}: <b>{sp.typicalCycleDays}d</b></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-display text-sm font-extrabold text-[#081C3A] dark:text-white">
                {tr(language, 'Makundi ya Samaki', 'Stock Batches')}
              </h3>
              <button
                type="button"
                onClick={() => onOpenFullWorkspace()}
                className="text-xs font-bold text-[#1D72E8] dark:text-sky-400"
              >
                {tr(language, 'Fungua Stoo Kamili', 'Full Stock View')}
              </button>
            </div>

            {state.batches.map((b) => {
              const biomassKg = Math.round((b.currentEstimatedFish * b.currentAvgWeightG) / 1000);
              const isExpanded = selectedBatchDetail?.id === b.id;
              return (
                <div
                  key={b.id}
                  className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-rest dark:border-slate-800 dark:bg-slate-900"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedBatchDetail(isExpanded ? null : b)}
                    className="flex w-full items-center justify-between gap-2.5 text-left"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <img
                        src={ASSET_IMAGES.tilapia}
                        alt={b.species}
                        className="h-11 w-14 shrink-0 rounded-xl object-cover"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-extrabold text-slate-900 dark:text-white">
                          {tr(language, 'Kundi', 'Batch')} #{b.batchCode}
                        </div>
                        <div className="text-xs font-semibold text-slate-700 tabular-nums dark:text-slate-300">
                          {formatNumber(biomassKg)} kg ({formatNumber(b.currentEstimatedFish)})
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {tr(language, 'Imepandwa', 'Added')}: {b.stockingDate} · {b.pondCode}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                        {tDomain(language, b.status)}
                      </span>
                      <ChevronRight
                        className={`h-4 w-4 text-slate-400 transition-transform ${
                          isExpanded ? 'rotate-90' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="mt-2.5 space-y-2 border-t border-slate-100 pt-2.5 text-xs dark:border-slate-800">
                      <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                        <div>{tr(language, 'Chakula Kilichotumika', 'Feed Used')}: <b>{b.feedConsumedKg} kg</b></div>
                        <div>{tr(language, 'Vifo Jumla', 'Total Mortality')}: <b>{b.totalMortality}</b></div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenQuickSale({ pondCode: b.pondCode })}
                          className="min-h-[38px] flex-1 rounded-xl bg-teal-600 px-3 py-1.5 text-xs font-bold text-white"
                        >
                          {tr(language, 'Uza Kutoka Kundi', 'Sell From Batch')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // SCREEN 4: FEEDING & WATER QUALITY
  // =========================================================================
  if (activeNav === 'feeding' || activeNav === 'water-quality') {
    const nextFeed = state.feedIssuances[0];

    return (
      <div className="space-y-3">
        {/* Top Segmented Pill Switch */}
        <div className="grid grid-cols-2 rounded-2xl border border-slate-200/80 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => onNavigate('feeding')}
            className={`min-h-[40px] rounded-xl text-xs font-bold transition-colors ${
              activeNav === 'feeding'
                ? 'bg-[#1D72E8] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {tr(language, 'Ulishaji', 'Feeding')}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('water-quality')}
            className={`min-h-[40px] rounded-xl text-xs font-bold transition-colors ${
              activeNav === 'water-quality'
                ? 'bg-[#1D72E8] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {tr(language, 'Ubora wa Maji', 'Water Quality')}
          </button>
        </div>

        {activeNav === 'feeding' ? (
          <>
            {/* Feeding Schedule Card */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-rest dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#1D72E8]" />
                  <h3 className="font-display text-sm font-extrabold text-[#081C3A] dark:text-white">
                    {tr(language, 'Ratiba ya Ulishaji', 'Feeding Schedule')}
                  </h3>
                </div>
                <span className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-[#1D72E8] dark:bg-sky-900/40 dark:text-sky-300">
                  {tr(language, 'Leo', 'Today')}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-sm dark:bg-slate-800/70">
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {nextFeed ? `${nextFeed.pondCode} – ${nextFeed.time}` : 'POND-001 – 14:00'}
                </span>
                <span className="font-display font-extrabold text-[#081C3A] tabular-nums dark:text-white">
                  {nextFeed ? `${nextFeed.approvedKg} kg` : '1.5 kg'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => onQuickAction('feeding')}
                className="mt-3 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl bg-[#0D9488] px-4 py-2.5 text-sm font-bold text-white shadow-sm active:bg-teal-700"
              >
                <Utensils className="h-4 w-4" />
                <span>{tr(language, 'Rekodi Ulishaji', 'Log Feeding')}</span>
              </button>
            </div>

            {/* Water Quality Readings Summary Card */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-rest dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <Droplets className="h-4 w-4 text-[#1D72E8]" />
                <h3 className="font-display text-sm font-extrabold text-[#081C3A] dark:text-white">
                  {tr(language, 'Vipimo vya Ubora wa Maji', 'Water Quality Readings')}
                </h3>
              </div>

              <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                <div className="flex items-center justify-between py-2.5 text-sm">
                  <span className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                    <Thermometer className="h-4 w-4 text-rose-500" />
                    {tr(language, 'Joto la Maji', 'Temperature')}
                  </span>
                  <span className="font-bold text-slate-900 tabular-nums dark:text-white">
                    {latestWater ? `${latestWater.temperature.toFixed(1)} °C` : '28.4 °C'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2.5 text-sm">
                  <span className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                    <Droplets className="h-4 w-4 text-sky-500" />
                    pH
                  </span>
                  <span className="font-bold text-slate-900 tabular-nums dark:text-white">
                    {latestWater ? latestWater.ph.toFixed(1) : '7.6'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2.5 text-sm">
                  <span className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                    <Waves className="h-4 w-4 text-amber-500" />
                    {tr(language, 'Oksijeni (DO)', 'Dissolved Oxygen')}
                  </span>
                  <span className="font-bold text-amber-600 tabular-nums dark:text-amber-400">
                    {latestWater ? `${latestWater.dissolvedOxygen.toFixed(1)} mg/L` : '6.2 mg/L'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('water-quality')}
                className="mt-2 flex min-h-[42px] w-full items-center justify-center gap-1 rounded-xl bg-sky-50 px-3 py-2 text-xs font-bold text-[#1D72E8] dark:bg-sky-900/40 dark:text-sky-300"
              >
                <span>{tr(language, 'Angalia Maelezo', 'View Details')}</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => onQuickAction('water')}
              className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl bg-[#0D9488] px-4 py-2.5 text-sm font-bold text-white shadow-sm"
            >
              <Droplets className="h-4 w-4" />
              <span>{tr(language, 'Rekodi Kipimo cha Maji', 'Log Water Reading')}</span>
            </button>

            {state.ponds.map((pond) => {
              const rd = state.waterReadings.find((w) => w.pondCode === pond.code);
              return (
                <div
                  key={pond.id}
                  className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-rest dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-display text-sm font-extrabold text-slate-900 dark:text-white">
                        {pond.name} ({pond.code})
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {rd ? rd.sourceLevel : 'Manual (Mobile)'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleAerator(pond.id)}
                      className={`min-h-[34px] rounded-xl px-3 py-1 text-[11px] font-bold ${
                        pond.aeratorRelayOn
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {pond.aeratorRelayOn
                        ? tr(language, 'Kipulizia: IMEWASHWA', 'Aerator: ON')
                        : tr(language, 'Kipulizia: IMEZIMWA', 'Aerator: OFF')}
                    </button>
                  </div>
                  <div className="mt-2.5 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2 text-center text-xs dark:bg-slate-800/70">
                    <div>
                      <div className="text-[10px] text-slate-500">Temp</div>
                      <div className="font-bold tabular-nums">{rd ? `${rd.temperature}°C` : '27.2°C'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">pH</div>
                      <div className="font-bold tabular-nums">{rd ? rd.ph : '7.4'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">DO</div>
                      <div className="font-bold tabular-nums">{rd ? `${rd.dissolvedOxygen} mg/L` : '6.0 mg/L'}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // SCREEN 5: FISH HEALTH
  // =========================================================================
  if (activeNav === 'fish-health') {
    const activeIncidents = state.healthIncidents.filter((h) => h.status !== 'Resolved');
    const firstAlert = activeIncidents[0] || state.healthIncidents[0];

    return (
      <div className="space-y-3">
        {/* Health Status Card */}
        <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-rest dark:border-slate-800 dark:bg-slate-900">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {tr(language, 'Hali ya Afya', 'Health Status')}
            </div>
            <div className="font-display text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {activeIncidents.length > 1
                ? tr(language, 'Uangalizi', 'Watch')
                : tr(language, 'Nzuri', 'Good')}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {tr(language, 'Mabwawa mengi yako salama', 'All ponds are normal')}
            </div>
          </div>
        </div>

        {/* Mortality Alert Banner */}
        {firstAlert && (
          <button
            type="button"
            onClick={() => onOpenFullWorkspace()}
            className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-left dark:border-rose-900/60 dark:bg-rose-950/50"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-extrabold text-rose-900 dark:text-rose-200">
                  {activeIncidents.length || 1}{' '}
                  {tr(language, 'Tahadhari ya Vifo', 'Mortality Alert')}
                </div>
                <div className="truncate text-[11px] text-rose-700 dark:text-rose-300">
                  {firstAlert.pondCode} – {firstAlert.deadCount} {tr(language, 'samaki', 'fish')}
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-rose-500" />
          </button>
        )}

        {/* Treatment Records */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-rest dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display text-sm font-extrabold text-[#081C3A] dark:text-white">
              {tr(language, 'Rekodi za Matibabu', 'Treatment Records')}
            </h3>
            <button
              type="button"
              onClick={() => onOpenFullWorkspace()}
              className="text-xs font-bold text-[#1D72E8] dark:text-sky-400"
            >
              {tr(language, 'Ona Zote', 'View All')}
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {state.healthIncidents.slice(0, 4).map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-slate-900 dark:text-white">
                    {h.dateTime.split(' ')[0]}
                  </div>
                  <div className="truncate text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {h.prescribedTreatment || h.symptoms}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {h.pondCode} · {tDomain(language, h.status)}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </div>
            ))}
          </div>
        </div>

        {/* Record Treatment / Mortality CTA */}
        <button
          type="button"
          onClick={() => onQuickAction('mortality')}
          className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl bg-[#0D9488] px-4 py-2.5 text-sm font-bold text-white shadow-sm active:bg-teal-700"
        >
          <HeartPulse className="h-4 w-4" />
          <span>{tr(language, 'Rekodi Matibabu / Vifo', 'Record Treatment')}</span>
        </button>
      </div>
    );
  }

  // =========================================================================
  // SCREEN 6: HARVEST & SALES SUMMARY
  // =========================================================================
  if (activeNav === 'harvest-sales') {
    const totalSalesKg = state.sales.reduce(
      (sum, s) => sum + s.lines.reduce((ls, l) => ls + l.kg, 0),
      0
    );

    return (
      <div className="space-y-3">
        {/* Sales Summary Card with Mini 4-Bar Chart */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-rest dark:border-slate-800 dark:bg-slate-900">
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {tr(language, 'Muhtasari wa Mauzo', 'Sales Summary')}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {tr(language, 'Mwezi Huu', 'This Month')} ({totalSalesKg.toFixed(0)} kg)
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="font-display text-xl font-extrabold text-[#081C3A] tabular-nums dark:text-white">
                {formatCompactTzs(totalSalesAmount)}
              </span>
              <span className="rounded-lg bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                +12%
              </span>
            </div>
          </div>

          <div className="flex h-14 items-end gap-1.5 pr-1">
            {[22, 30, 38, 52].map((h, idx) => (
              <div
                key={idx}
                className={`w-3 rounded-t-md ${
                  idx === 3 ? 'bg-[#1D72E8]' : idx === 2 ? 'bg-sky-400' : 'bg-sky-200 dark:bg-sky-800'
                }`}
                style={{ height: `${h}px` }}
              />
            ))}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-rest dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display text-sm font-extrabold text-[#081C3A] dark:text-white">
              {tr(language, 'Miamala ya Hivi Karibuni', 'Recent Transactions')}
            </h3>
            <button
              type="button"
              onClick={() => onOpenFullWorkspace()}
              className="text-xs font-bold text-[#1D72E8] dark:text-sky-400"
            >
              {tr(language, 'Ona Yote', 'View All')}
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {state.sales.slice(0, 4).map((sale) => {
              const saleKg = sale.lines.reduce((acc, l) => acc + l.kg, 0);
              return (
                <button
                  key={sale.id}
                  type="button"
                  onClick={() => onViewInvoice(sale)}
                  className="flex min-h-[56px] w-full items-center justify-between gap-2 py-2.5 text-left"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      <ShoppingCart className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-extrabold text-slate-900 dark:text-white">
                        {tr(language, 'Mauzo ya Samaki', 'Fish Sale')} – {saleKg} kg
                      </div>
                      <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {tr(language, 'Mteja', 'Customer')}: {sale.customerName}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs font-extrabold text-slate-900 tabular-nums dark:text-white">
                      {formatTzs(sale.totalTzs)}
                    </div>
                    <div className="text-[10.5px] text-slate-400">{sale.date}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* + New Sale Button (launches 3-Step Wizard!) */}
        <button
          type="button"
          onClick={() => onOpenQuickSale()}
          className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl bg-[#0D9488] px-4 py-2.5 text-sm font-bold text-white shadow-sm active:bg-teal-700"
        >
          <Plus className="h-4 w-4" />
          <span>{tr(language, 'Mauzo Mapya (Hatua 3)', 'New Sale')}</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenFullWorkspace()}
          className="flex min-h-[40px] w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        >
          {tr(language, 'Wateja, Madeni & Orodha Kamili →', 'Customers, Receivables & Full Sales →')}
        </button>
      </div>
    );
  }

  // =========================================================================
  // SCREEN 7: INVENTORY & FINANCE
  // =========================================================================
  if (activeNav === 'inventory' || activeNav === 'finance') {
    const lowStockItem = state.inventory.find((i) => i.status !== 'In Stock');
    const revenueTotal = state.finances
      .filter((f) => f.type === 'Revenue')
      .reduce((sum, f) => sum + f.amountTzs, 0);
    const expenseTotal = state.finances
      .filter((f) => f.type === 'Expense')
      .reduce((sum, f) => sum + f.amountTzs, 0);
    const netBalance = Math.max(0, revenueTotal - expenseTotal);

    return (
      <div className="space-y-3">
        {/* Top Segmented Toggle */}
        <div className="grid grid-cols-2 rounded-2xl border border-slate-200/80 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => onNavigate('inventory')}
            className={`min-h-[40px] rounded-xl text-xs font-bold transition-colors ${
              activeNav === 'inventory'
                ? 'bg-[#1D72E8] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {tr(language, 'Stoo', 'Inventory')}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('finance')}
            className={`min-h-[40px] rounded-xl text-xs font-bold transition-colors ${
              activeNav === 'finance'
                ? 'bg-[#1D72E8] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {tr(language, 'Fedha', 'Finance')}
          </button>
        </div>

        {activeNav === 'inventory' ? (
          <>
            {lowStockItem && (
              <button
                type="button"
                onClick={() => onRestockItem(lowStockItem.id)}
                className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-left dark:border-amber-800/70 dark:bg-amber-950/50"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-extrabold text-amber-950 dark:text-amber-100">
                      {tr(language, 'Stoo Ndogo', 'Low Stock')}: {lowStockItem.name}
                    </div>
                    <div className="truncate text-[11px] text-amber-800 dark:text-amber-300">
                      ({lowStockItem.stock} {lowStockItem.unit} {tr(language, 'zimebaki', 'left')})
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-amber-600" />
              </button>
            )}

            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-rest dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-display text-sm font-extrabold text-[#081C3A] dark:text-white">
                  {tr(language, 'Bidhaa za Stoo', 'Stock Items')}
                </h3>
                <button
                  type="button"
                  onClick={() => onOpenFullWorkspace()}
                  className="text-xs font-bold text-[#1D72E8] dark:text-sky-400"
                >
                  {tr(language, 'Ona Zote', 'View All')}
                </button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {state.inventory.slice(0, 4).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onRestockItem(item.id)}
                    className="flex min-h-[52px] w-full items-center justify-between gap-2 py-2 text-left"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        <Package className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold text-slate-900 dark:text-white">
                          {item.name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          {item.stock} {item.unit}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${
                        item.status === 'In Stock'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
                      }`}
                    >
                      {tDomain(language, item.status)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Finance Overview Card */}
            <button
              type="button"
              onClick={() => onNavigate('finance')}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-rest dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {tr(language, 'Muhtasari wa Fedha', 'Finance Overview')}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {tr(language, 'Mwezi Huu', 'This Month')}
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="font-display text-lg font-extrabold text-[#081C3A] tabular-nums dark:text-white">
                    {formatCompactTzs(netBalance || revenueTotal)}
                  </span>
                  <span className="rounded-lg bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                    +18%
                  </span>
                </div>
              </div>
              <div className="flex h-12 items-end gap-1.5">
                {[18, 26, 36, 46].map((h, idx) => (
                  <div
                    key={idx}
                    className={`w-2.5 rounded-t-md ${
                      idx === 3 ? 'bg-[#1D72E8]' : idx === 2 ? 'bg-sky-400' : 'bg-sky-200 dark:bg-sky-800'
                    }`}
                    style={{ height: `${h}px` }}
                  />
                ))}
              </div>
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-rest dark:border-slate-800 dark:bg-slate-900">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {tr(language, 'Mapato', 'Revenue')}
                </div>
                <div className="mt-1 font-display text-base font-extrabold text-emerald-600 tabular-nums">
                  {formatCompactTzs(revenueTotal)}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-rest dark:border-slate-800 dark:bg-slate-900">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {tr(language, 'Matumizi', 'Expenses')}
                </div>
                <div className="mt-1 font-display text-base font-extrabold text-rose-600 tabular-nums">
                  {formatCompactTzs(expenseTotal)}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-rest dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-display text-sm font-extrabold text-[#081C3A] dark:text-white">
                  {tr(language, 'Miamala ya Fedha (TZS)', 'Financial Ledger')}
                </h3>
                <button
                  type="button"
                  onClick={() => onOpenFullWorkspace()}
                  className="text-xs font-bold text-[#1D72E8]"
                >
                  {tr(language, 'Ripoti Kamili', 'Full Report')}
                </button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {state.finances.slice(0, 5).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between gap-2 py-2.5 text-xs">
                    <div className="min-w-0">
                      <div className="truncate font-bold text-slate-900 dark:text-white">
                        {tDomain(language, tx.category)}
                      </div>
                      <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {tx.counterparty} · {tx.date}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 font-bold tabular-nums ${
                        tx.type === 'Revenue' ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {tx.type === 'Revenue' ? '+' : '-'}
                      {formatCompactTzs(tx.amountTzs)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // SCREEN 8: TASKS & AQUA INTELLIGENCE
  // =========================================================================
  if (activeNav === 'tasks-alerts' || activeNav === 'aqua-intelligence') {
    return (
      <div className="space-y-3">
        {/* Segmented Toggle */}
        <div className="grid grid-cols-2 rounded-2xl border border-slate-200/80 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => onNavigate('tasks-alerts')}
            className={`min-h-[40px] rounded-xl text-xs font-bold transition-colors ${
              activeNav === 'tasks-alerts'
                ? 'bg-[#1D72E8] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {tr(language, 'Kazi Zangu', 'Tasks')}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('aqua-intelligence')}
            className={`min-h-[40px] rounded-xl text-xs font-bold transition-colors ${
              activeNav === 'aqua-intelligence'
                ? 'bg-[#1D72E8] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {tr(language, 'Ushauri wa AI', 'AI Insights')}
          </button>
        </div>

        {activeNav === 'tasks-alerts' ? (
          <>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-rest dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-2.5 flex items-center justify-between">
                <h3 className="font-display text-sm font-extrabold text-[#081C3A] dark:text-white">
                  {tr(language, 'Kazi Zangu', 'My Tasks')}
                </h3>
                <button
                  type="button"
                  onClick={() => onOpenFullWorkspace()}
                  className="text-xs font-bold text-[#1D72E8] dark:text-sky-400"
                >
                  {tr(language, 'Ona Zote', 'View All')}
                </button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {state.tasks.map((tk) => {
                  const done = tk.status === 'Completed';
                  return (
                    <button
                      key={tk.id}
                      type="button"
                      onClick={() => !done && onCompleteTask(tk.id)}
                      className="flex min-h-[48px] w-full items-center gap-3 py-2 text-left"
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                          done
                            ? 'border-[#1D72E8] bg-[#1D72E8] text-white'
                            : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800'
                        }`}
                      >
                        {done && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div
                          className={`text-xs font-semibold leading-snug ${
                            done
                              ? 'text-slate-400 line-through'
                              : 'text-slate-800 dark:text-slate-100'
                          }`}
                        >
                          {tk.title}
                        </div>
                        <div className="text-[10.5px] text-slate-400">
                          {tk.pondCode} · {tk.dueTime}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* AI Insight Spotlight Card */}
            <button
              type="button"
              onClick={() => onNavigate('aqua-intelligence')}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 to-blue-50 p-4 text-left shadow-xs dark:border-sky-800/70 dark:from-sky-950/60 dark:to-blue-950/60"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300">
                  <Lightbulb className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-display text-sm font-extrabold text-[#081C3A] dark:text-white">
                    {tr(language, 'Ushauri wa AI', 'AI Insight')}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {tr(
                      language,
                      'Akiba iko juu. Fikiria kuongeza mauzo au kupunguza chakula kwa 5% kwenye mabwawa tayari kuvunwa.',
                      'Stock is high. Consider increasing sales or reducing feed by 5% on harvest-ready ponds.'
                    )}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
          </>
        ) : (
          <AquaIntelligenceView state={state} language={language} />
        )}
      </div>
    );
  }

  // Fallback return button when mobile is in a deep sub-view
  return (
    <div className="mb-2 flex items-center justify-between">
      <button
        type="button"
        onClick={() => onNavigate('dashboard')}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1D72E8]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>{tr(language, 'Rudi Nyumbani', 'Back Home')}</span>
      </button>
    </div>
  );
};
