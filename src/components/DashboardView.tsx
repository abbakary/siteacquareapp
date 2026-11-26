import React, { lazy, Suspense, useState } from 'react';
import { motion } from 'motion/react';
import {
  Fish,
  Waves,
  Package,
  Coins,
  TrendingUp,
  Droplets,
  HeartPulse,
  CheckCircle2,
  Box,
  Clock,
  MapPin,
  Zap,
  Utensils,
  PackagePlus,
  AlertTriangle,
  CalendarCheck,
  FileBarChart,
  Wallet,
  Bell,
  ArrowUpRight,
  ShoppingBag,
  Crosshair,
} from 'lucide-react';
import { AquacultureState, Language, MapViewMode, NavSection, Pond } from '../types/aquaculture';
import { ASSET_IMAGES } from '../data/seedData';
import { TRANSLATIONS } from '../i18n/translations';
import { formatNumber, formatTzs, isDateInPeriod, TimeFilterPeriod } from '../utils/formatters';
import { QuickActionType } from './QuickActionModals';
import {
  Badge,
  Card,
  ChartSkeleton,
  CountUpNumber,
  DURATIONS,
  EASE_OUT,
  getStaggerDelay,
  MapSkeleton,
  Skeleton,
} from '../ui';

const FarmOverviewChart = lazy(() =>
  import('./DashboardCharts').then((m) => ({ default: m.FarmOverviewChart }))
);
const RadialGauge = lazy(() =>
  import('./DashboardCharts').then((m) => ({ default: m.RadialGauge }))
);
const WaterQualityMiniSparkline = lazy(() =>
  import('./DashboardCharts').then((m) => ({ default: m.WaterQualityMiniSparkline }))
);
const LeafletFarmMap = lazy(() =>
  import('./LeafletFarmMap').then((m) => ({ default: m.LeafletFarmMap }))
);

interface DashboardViewProps {
  state: AquacultureState;
  language: Language;
  selectedFarmId: string;
  onNavigate: (section: NavSection) => void;
  onQuickAction: (action: QuickActionType) => void;
  onSelectPond: (pond: Pond) => void;
  onAcknowledgeAlert: (alertId: string) => void;
  onOpenQuickSale?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  state,
  language,
  selectedFarmId,
  onNavigate,
  onQuickAction,
  onSelectPond,
  onAcknowledgeAlert,
  onOpenQuickSale,
}) => {
  const t = TRANSLATIONS[language];
  const [chartRange, setChartRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [financePeriod, setFinancePeriod] = useState<TimeFilterPeriod>('month');
  const [mapMode, setMapMode] = useState<MapViewMode>('satellite');
  const [locatingGps, setLocatingGps] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    gps: [number, number];
    accuracyM?: number;
    placeName?: string;
  } | null>(null);
  const [gpsError, setGpsError] = useState('');

  const handleUseMyLocation = () => {
    setGpsError('');
    if (!navigator.geolocation) {
      setGpsError('Location unavailable on this browser.');
      return;
    }
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const accuracyM = Math.round(pos.coords.accuracy);
        let placeName = '';
        try {
          const res = await fetch(
            `/api/gis/reverse-geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
          );
          if (res.ok) {
            const data = (await res.json()) as { placeName?: string };
            placeName = data.placeName || '';
          }
        } catch {
          // ignore
        }
        setUserLocation({ gps: [lat, lng], accuracyM, placeName });
        setLocatingGps(false);
      },
      () => {
        setLocatingGps(false);
        setGpsError('Location permission needed — open Farms & Ponds to search your village.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Dynamic live metrics derived from current state
  const totalLiveFish = state.ponds.reduce((acc, p) => acc + p.currentFish, 0);
  const activePondsCount = state.ponds.filter((p) => p.currentFish > 0).length;
  const totalOrgPonds = 14;
  const activeOrgPonds = Math.min(totalOrgPonds, 8 + activePondsCount);
  const activePct = Math.round((activeOrgPonds / totalOrgPonds) * 100);

  const feedStockKg = state.inventory
    .filter((i) => i.category === 'Feed')
    .reduce((acc, i) => acc + i.stock, 0);
  const feedDaysRemaining = Math.max(1, Math.round(feedStockKg / 170));

  const filteredFinances = state.finances.filter((f) => isDateInPeriod(f.date, financePeriod));
  const totalRevenue = filteredFinances
    .filter((f) => f.type === 'Revenue')
    .reduce((acc, f) => acc + f.amountTzs, 0);
  const totalExpenses = filteredFinances
    .filter((f) => f.type === 'Expense')
    .reduce((acc, f) => acc + f.amountTzs, 0);
  const netProfit = totalRevenue - totalExpenses;

  const latestWq = state.waterReadings[0] || {
    ph: 7.2,
    dissolvedOxygen: 6.0,
    temperature: 28,
    ammonia: 0.02,
    status: 'Safe',
  };

  const totalMortality = state.healthIncidents.reduce((acc, h) => acc + h.deadCount, 0);
  const healthScorePct = Math.max(
    78,
    Math.min(99, Math.round(100 - (totalMortality / Math.max(1, totalLiveFish)) * 8000))
  );

  const wqHealthy = latestWq.status === 'Safe';

  return (
    <div className="space-y-3.5">
      {/* ROW 1: 4 GRADIENT KPI CARDS */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {/* KPI 1: Total Live Fish */}
        <motion.button
          type="button"
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.985 }}
          transition={{ duration: DURATIONS.fast, ease: EASE_OUT }}
          onClick={() => onNavigate('fish-species')}
          className="group relative flex items-center justify-between overflow-hidden rounded-[16px] bg-gradient-to-r from-[#136BE0] via-[#1C7FE8] to-[#2BA0F5] px-4 py-3.5 text-left text-white shadow-rest transition-shadow hover:shadow-hover-card"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <Fish className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="text-xs font-medium text-blue-50">{t.kpi.totalLiveFish}</div>
              <div className="text-[26px] font-bold leading-tight tracking-tight tabular-nums">
                <CountUpNumber value={totalLiveFish} formatter={(v) => formatNumber(v)} />
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-emerald-200">
                <ArrowUpRight className="h-3.5 w-3.5" /> +8%
              </div>
            </div>
          </div>
          <svg viewBox="0 0 80 38" className="h-10 w-20 shrink-0 opacity-90">
            <defs>
              <linearGradient id="kpiBlueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path d="M0,34 L15,29 L30,30 L45,21 L60,17 L76,6 L76,38 L0,38 Z" fill="url(#kpiBlueFill)" />
            <polyline fill="none" stroke="#FFFFFF" strokeWidth="2.2" points="0,34 15,29 30,30 45,21 60,17 76,6" />
          </svg>
        </motion.button>

        {/* KPI 2: Active Ponds */}
        <motion.button
          type="button"
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.985 }}
          transition={{ duration: DURATIONS.fast, ease: EASE_OUT }}
          onClick={() => onNavigate('farms-ponds')}
          className="group relative flex items-center justify-between overflow-hidden rounded-[16px] bg-gradient-to-r from-[#0E895E] via-[#149B6B] to-[#23B888] px-4 py-3.5 text-left text-white shadow-rest transition-shadow hover:shadow-hover-card"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <Waves className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="text-xs font-medium text-emerald-50">{t.kpi.activePonds}</div>
              <div className="text-[26px] font-bold leading-tight tracking-tight tabular-nums">
                <CountUpNumber value={activeOrgPonds} />{' '}
                <span className="text-lg font-semibold text-emerald-100">/ {totalOrgPonds}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs font-semibold text-emerald-100 tabular-nums">{activePct}%</span>
                <div className="h-2 w-24 overflow-hidden rounded-full bg-white/25">
                  <motion.div
                    className="h-full rounded-full bg-white"
                    initial={{ width: 0 }}
                    animate={{ width: `${activePct}%` }}
                    transition={{ duration: 0.55, ease: EASE_OUT }}
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.button>

        {/* KPI 3: Feed Stock */}
        <motion.button
          type="button"
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.985 }}
          transition={{ duration: DURATIONS.fast, ease: EASE_OUT }}
          onClick={() => onNavigate('inventory')}
          className="group relative flex items-center justify-between overflow-hidden rounded-[16px] bg-gradient-to-r from-[#E67713] via-[#EE8A1D] to-[#F7A336] px-4 py-3.5 text-left text-white shadow-rest transition-shadow hover:shadow-hover-card"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="text-xs font-medium text-amber-50">{t.kpi.feedStock}</div>
              <div className="text-[26px] font-bold leading-tight tracking-tight tabular-nums">
                <CountUpNumber value={feedStockKg} formatter={(v) => formatNumber(v)} suffix=" kg" />
              </div>
              <div className="mt-0.5 text-xs font-semibold text-amber-100 tabular-nums">
                ≈ {feedDaysRemaining} days
              </div>
            </div>
          </div>
          <div className="flex items-end gap-1 self-end pb-1 opacity-75">
            {[16, 24, 19, 28, 22, 14].map((h, i) => (
              <div key={i} className="w-2 rounded-t bg-white/40" style={{ height: `${h}px` }} />
            ))}
          </div>
        </motion.button>

        {/* KPI 4: Total Revenue */}
        <motion.button
          type="button"
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.985 }}
          transition={{ duration: DURATIONS.fast, ease: EASE_OUT }}
          onClick={() => onNavigate('finance')}
          className="group relative flex items-center justify-between overflow-hidden rounded-[16px] bg-gradient-to-r from-[#4844D1] via-[#5952DE] to-[#7468EE] px-4 py-3.5 text-left text-white shadow-rest transition-shadow hover:shadow-hover-card"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <Coins className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="text-xs font-medium text-indigo-100">{t.kpi.totalRevenue}</div>
              <div className="text-[22px] font-bold leading-tight tracking-tight tabular-nums">
                <CountUpNumber value={totalRevenue} formatter={(v) => formatTzs(v)} />
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-emerald-200">
                <ArrowUpRight className="h-3.5 w-3.5" /> +12%
              </div>
            </div>
          </div>
          <svg viewBox="0 0 64 36" className="h-9 w-16 shrink-0 opacity-80">
            <polyline fill="none" stroke="#FFFFFF" strokeWidth="2.2" points="2,30 16,24 28,26 42,16 60,7" />
          </svg>
        </motion.button>
      </div>

      {/* ROW 2: FARM OVERVIEW + WATER QUALITY STATUS + FISH HEALTH MONITOR */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        {/* Farm Overview */}
        <Card className="lg:col-span-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600 dark:text-sky-400" />
              <h2 className="text-[14px] font-bold text-slate-900 dark:text-white">
                {t.widgets.farmOverview}
              </h2>
            </div>
            <select
              value={chartRange}
              onChange={(e) => setChartRange(e.target.value as '7d' | '30d' | '90d')}
              aria-label="Chart range"
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="30d">Last 30 Days</option>
              <option value="7d">Last 7 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          </div>

          <div className="mb-1 flex items-center justify-center gap-5 text-xs font-medium text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> Production (kg)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> Feed (kg)
            </span>
          </div>

          <Suspense fallback={<ChartSkeleton heightClass="h-[175px]" />}>
            <FarmOverviewChart range={chartRange} />
          </Suspense>
        </Card>

        {/* Water Quality Status */}
        <Card className="flex flex-col justify-between lg:col-span-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              <h2 className="text-[14px] font-bold text-slate-900 dark:text-white">
                {t.widgets.waterQualityStatus}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('water-quality')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-0.5 text-[11px] font-semibold text-white transition-colors ${
                wqHealthy
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-amber-500 hover:bg-amber-600'
              }`}
            >
              {wqHealthy ? 'Healthy' : 'Attention'} <CheckCircle2 className="h-3 w-3" />
            </button>
          </div>

          <Suspense
            fallback={
              <div className="my-3 grid grid-cols-4 gap-2">
                {[0, 1, 2, 3].map((idx) => (
                  <Skeleton key={idx} className="mx-auto h-[66px] w-[66px] rounded-full" />
                ))}
              </div>
            }
          >
            <div className="my-3 grid grid-cols-4 gap-2">
              <RadialGauge value={String(latestWq.ph)} label="pH" pct={82} strokeColor="#16A34A" />
              <RadialGauge
                value={`${latestWq.dissolvedOxygen} mg/L`}
                label="DO"
                pct={Math.min(100, Math.round((latestWq.dissolvedOxygen / 8) * 100))}
                strokeColor={latestWq.dissolvedOxygen < 4.5 ? '#DC2626' : '#0284C7'}
              />
              <RadialGauge
                value={`${latestWq.temperature}°C`}
                label="Temp"
                pct={74}
                strokeColor="#F59E0B"
              />
              <RadialGauge value={String(latestWq.ammonia)} label="NH3" pct={90} strokeColor="#14B8A6" />
            </div>
          </Suspense>

          <div
            className={`mb-1.5 flex items-center justify-center gap-1.5 text-xs font-medium ${
              wqHealthy
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-amber-700 dark:text-amber-400'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {wqHealthy ? 'All parameters within safe range' : 'Dissolved oxygen check advised'}
          </div>

          <Suspense fallback={<Skeleton className="h-9 w-full" />}>
            <WaterQualityMiniSparkline />
          </Suspense>
        </Card>

        {/* Fish Health Monitor */}
        <Card className="flex flex-col justify-between lg:col-span-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-rose-500" />
              <h2 className="text-[14px] font-bold text-slate-900 dark:text-white">
                {t.widgets.fishHealthMonitor}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('fish-health')}
              className="text-xs font-semibold text-blue-600 hover:underline whitespace-nowrap dark:text-sky-400"
            >
              {t.widgets.viewDetails}
            </button>
          </div>

          <div className="mt-2 grid grid-cols-12 items-center gap-2">
            <div className="col-span-6 flex flex-col items-start">
              <div className="relative flex h-24 w-24 items-center justify-center self-center">
                <svg width="92" height="92" className="-rotate-90">
                  <circle
                    cx="46"
                    cy="46"
                    r="38"
                    fill="none"
                    className="stroke-slate-200 dark:stroke-slate-700"
                    strokeWidth="8"
                  />
                  <motion.circle
                    cx="46"
                    cy="46"
                    r="38"
                    fill="none"
                    stroke="#16A34A"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 38}
                    initial={{ strokeDashoffset: 2 * Math.PI * 38 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 38 * (1 - healthScorePct / 100) }}
                    transition={{ duration: 0.65, ease: EASE_OUT }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center leading-tight">
                  <span className="text-xl font-extrabold text-emerald-700 tabular-nums dark:text-emerald-400">
                    <CountUpNumber value={healthScorePct} suffix="%" />
                  </span>
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Healthy
                  </span>
                </div>
              </div>

              <div className="mt-2 space-y-1 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>No Disease Detected</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>Normal Behavior</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>Good Growth Rate</span>
                </div>
              </div>
            </div>

            <div className="col-span-6 flex items-center justify-center">
              <img
                src={ASSET_IMAGES.tilapia}
                alt="Healthy Nile Tilapia swimming"
                referrerPolicy="no-referrer"
                className="h-36 w-full rounded-xl object-cover"
              />
            </div>
          </div>
        </Card>
      </div>

      {/* ROW 3: INVENTORY + RECENT ACTIVITIES + POND STATUS + QUICK ACTIONS */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        {/* Inventory Management */}
        <Card className="lg:col-span-4">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Box className="h-4 w-4 text-blue-600 dark:text-sky-400" />
              <h2 className="text-[14px] font-bold text-slate-900 dark:text-white">
                {t.widgets.inventoryManagement}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="text-xs font-semibold text-blue-600 hover:underline whitespace-nowrap dark:text-sky-400"
            >
              {t.widgets.viewAll}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="pb-2">Item</th>
                  <th className="pb-2 text-right">Stock</th>
                  <th className="pb-2 pl-2">Unit</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {state.inventory.slice(0, 5).map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                    <td className="py-2 font-medium text-slate-800 dark:text-slate-200">{item.name}</td>
                    <td className="py-2 text-right font-semibold text-slate-900 tabular-nums dark:text-white">
                      {formatNumber(item.stock)}
                    </td>
                    <td className="py-2 pl-2 text-slate-500 dark:text-slate-400">{item.unit}</td>
                    <td className="py-2">
                      <Badge variant={item.status === 'In Stock' ? 'success' : 'warning'}>
                        {item.status}
                      </Badge>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => onNavigate('inventory')}
                        className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Recent Activities */}
        <Card className="lg:col-span-3">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600 dark:text-sky-400" />
              <h2 className="text-[14px] font-bold text-slate-900 dark:text-white">
                {t.widgets.recentActivities}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('employees')}
              className="text-xs font-semibold text-blue-600 hover:underline whitespace-nowrap dark:text-sky-400"
            >
              {t.widgets.viewAll}
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {state.activities.slice(0, 5).map((act, idx) => {
              const iconBg =
                act.kind === 'feeding'
                  ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/80 dark:text-amber-400'
                  : act.kind === 'water'
                    ? 'bg-sky-100 text-sky-600 dark:bg-sky-950/80 dark:text-sky-400'
                    : act.kind === 'harvest'
                      ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400'
                      : act.kind === 'mortality'
                        ? 'bg-red-100 text-red-600 dark:bg-red-950/80 dark:text-red-400'
                        : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-400';
              return (
                <motion.div
                  key={act.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: getStaggerDelay(idx), duration: DURATIONS.base, ease: EASE_OUT }}
                  className="flex items-start justify-between gap-2 py-2"
                >
                  <div className="flex min-w-0 items-start gap-2.5">
                    <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
                      {act.kind === 'feeding' && <Utensils className="h-3 w-3" />}
                      {act.kind === 'water' && <Droplets className="h-3 w-3" />}
                      {act.kind === 'harvest' && <CheckCircle2 className="h-3 w-3" />}
                      {act.kind === 'purchase' && <Package className="h-3 w-3" />}
                      {act.kind === 'payment' && <Coins className="h-3 w-3" />}
                      {act.kind === 'mortality' && <AlertTriangle className="h-3 w-3" />}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {act.title}
                      </div>
                      <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {act.subtitle}
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] font-medium text-slate-400 dark:text-slate-500">
                    {act.timeAgo}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </Card>

        {/* Pond Status */}
        <Card className="lg:col-span-3">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-[14px] font-bold text-slate-900 dark:text-white">
                {t.widgets.pondStatus}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('farms-ponds')}
              className="text-xs font-semibold text-blue-600 hover:underline whitespace-nowrap dark:text-sky-400"
            >
              {t.widgets.viewAll}
            </button>
          </div>

          <div className="space-y-2.5">
            {state.ponds.slice(0, 5).map((pond, idx) => {
              const barColor =
                pond.status === 'Attention'
                  ? 'bg-orange-500'
                  : pond.status === 'Preparing'
                    ? 'bg-slate-400 dark:bg-slate-500'
                    : 'bg-blue-600 dark:bg-sky-500';
              const badgeVariant =
                pond.status === 'Attention'
                  ? 'warning'
                  : pond.status === 'Preparing'
                    ? 'neutral'
                    : 'success';
              return (
                <motion.button
                  key={pond.id}
                  type="button"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: getStaggerDelay(idx), duration: DURATIONS.base, ease: EASE_OUT }}
                  onClick={() => onSelectPond(pond)}
                  className="flex w-full items-center gap-2.5 rounded-xl p-1 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/70"
                >
                  <img
                    src={ASSET_IMAGES.pondThumb}
                    alt={pond.name}
                    referrerPolicy="no-referrer"
                    className="h-8 w-11 shrink-0 rounded-md border border-slate-200 object-cover dark:border-slate-700"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 text-xs">
                      <span className="truncate font-semibold text-slate-800 dark:text-slate-200">
                        {pond.name} – {pond.species.replace('Nile ', '').replace('African ', '')}
                      </span>
                      <Badge variant={badgeVariant} className="px-1.5 py-0 text-[10px]">
                        {pond.status}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <motion.div
                          className={`h-full rounded-full transition-colors duration-300 ${barColor}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${pond.readinessPct}%` }}
                          transition={{ duration: 0.55, ease: EASE_OUT }}
                        />
                      </div>
                      <span className="w-8 text-right text-[11px] font-bold text-slate-700 tabular-nums dark:text-slate-300">
                        {pond.readinessPct}%
                      </span>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </Card>

        {/* Quick Actions */}
        <Card className="lg:col-span-2">
          <div className="mb-2.5 flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-600 dark:text-sky-400" />
            <h2 className="text-[14px] font-bold text-slate-900 dark:text-white">
              {t.widgets.quickActions}
            </h2>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => onQuickAction('feeding')}
              className="flex min-h-[38px] w-full items-center gap-2 rounded-xl bg-[#1D72E8] px-3 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#175EC2] active:scale-[0.98]"
            >
              <Utensils className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t.actions.recordFeeding}</span>
            </button>
            <button
              type="button"
              onClick={() => onQuickAction('inventory')}
              className="flex min-h-[38px] w-full items-center gap-2 rounded-xl bg-[#149A8E] px-3 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#107E74] active:scale-[0.98]"
            >
              <PackagePlus className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t.actions.addInventory}</span>
            </button>
            <button
              type="button"
              onClick={() => onQuickAction('water')}
              className="flex min-h-[38px] w-full items-center gap-2 rounded-xl bg-[#238EF2] px-3 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#1B75CC] active:scale-[0.98]"
            >
              <Droplets className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t.actions.recordWaterQuality}</span>
            </button>
            <button
              type="button"
              onClick={() => onQuickAction('mortality')}
              className="flex min-h-[38px] w-full items-center gap-2 rounded-xl bg-[#D6362F] px-3 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#B82A24] active:scale-[0.98]"
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t.actions.reportMortality}</span>
            </button>
            {onOpenQuickSale && (
              <button
                type="button"
                onClick={onOpenQuickSale}
                className="flex min-h-[38px] w-full items-center gap-2 rounded-xl bg-[#0E895E] px-3 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#0B6F4C] active:scale-[0.98]"
              >
                <ShoppingBag className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{t.actions.quickSale}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onQuickAction('harvest')}
              className="flex min-h-[38px] w-full items-center gap-2 rounded-xl bg-[#EA6A12] px-3 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#C9580B] active:scale-[0.98]"
            >
              <CalendarCheck className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t.actions.planHarvest}</span>
            </button>
            <button
              type="button"
              onClick={() => onQuickAction('report')}
              className="flex min-h-[38px] w-full items-center gap-2 rounded-xl bg-[#1F4E9E] px-3 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#183E80] active:scale-[0.98]"
            >
              <FileBarChart className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t.actions.generateReport}</span>
            </button>
          </div>
        </Card>
      </div>

      {/* ROW 4: SALES & FINANCE SUMMARY + ALERTS & NOTIFICATIONS + FARM MAP (LEAFLET) */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        {/* Sales & Finance Summary */}
        <Card className="lg:col-span-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-500" />
              <h2 className="text-[14px] font-bold text-slate-900 dark:text-white">
                {t.widgets.salesFinance}
              </h2>
            </div>
            <select
              value={financePeriod}
              onChange={(e) => setFinancePeriod(e.target.value as TimeFilterPeriod)}
              aria-label="Finance period"
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="day">Today (Day)</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
              <option value="all">All Time</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="flex flex-col items-center rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Total Revenue
              </div>
              <div className="mt-0.5 text-[13px] font-extrabold text-slate-900 tabular-nums dark:text-white">
                <CountUpNumber value={totalRevenue} formatter={(v) => formatTzs(v)} />
              </div>
              <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">↑ +12%</div>
              <div className="mt-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/80 dark:text-amber-400">
                <Coins className="h-6 w-6" />
              </div>
            </div>

            <div className="flex flex-col items-center rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Expenses
              </div>
              <div className="mt-0.5 text-[13px] font-extrabold text-slate-900 tabular-nums dark:text-white">
                <CountUpNumber value={totalExpenses} formatter={(v) => formatTzs(v)} />
              </div>
              <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400">↑ +5%</div>
              <div className="mt-2 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950/80 dark:text-orange-400">
                <Wallet className="h-6 w-6" />
              </div>
            </div>

            <div className="flex flex-col items-center rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Profit
              </div>
              <div className="mt-0.5 text-[13px] font-extrabold text-emerald-700 tabular-nums dark:text-emerald-400">
                <CountUpNumber value={netProfit} formatter={(v) => formatTzs(v)} />
              </div>
              <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">↑ +18%</div>
              <div className="mt-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400">
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>
          </div>
        </Card>

        {/* Alerts & Notifications */}
        <Card className="lg:col-span-4">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-500" />
              <h2 className="text-[14px] font-bold text-slate-900 dark:text-white">
                {t.widgets.alertsNotifications}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('tasks-alerts')}
              className="text-xs font-semibold text-blue-600 hover:underline whitespace-nowrap dark:text-sky-400"
            >
              {t.widgets.viewAll}
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {state.alerts.slice(0, 4).map((alert) => {
              const variant =
                alert.severity === 'High'
                  ? 'danger'
                  : alert.severity === 'Medium'
                    ? 'warning'
                    : alert.severity === 'Info'
                      ? 'info'
                      : 'success';
              return (
                <div
                  key={alert.id}
                  onClick={() => onAcknowledgeAlert(alert.id)}
                  className="flex cursor-pointer items-center justify-between gap-2 py-2.5 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Badge
                      variant={variant}
                      pulseDot={alert.severity === 'High' && !alert.acknowledged}
                      className="min-w-[60px] justify-center text-[10px]"
                    >
                      {alert.severity}
                    </Badge>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {alert.title}
                      </div>
                      {alert.acknowledged && (
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                          Acknowledged
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
                    {alert.timeAgo}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Farm Map (FREE Leaflet Map) */}
        <Card className="lg:col-span-4">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-[14px] font-bold text-slate-900 dark:text-white">
                {t.widgets.farmMap}
              </h2>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
              {(
                [
                  { id: 'satellite', label: 'Satellite' },
                  { id: 'street', label: 'Street' },
                  { id: 'infrastructure', label: 'Infra' },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setMapMode(mode.id)}
                  className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                    mapMode === mode.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={locatingGps}
              className="inline-flex items-center gap-1 rounded-lg bg-[#0284c7] px-2.5 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-[#0369a1] disabled:opacity-60"
            >
              <Crosshair className="h-3 w-3" />
              {locatingGps ? 'Finding location...' : 'Use my current location'}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('farms-ponds')}
              className="text-[11px] font-semibold text-sky-600 hover:underline dark:text-sky-400"
            >
              Register Farm / Pond →
            </button>
          </div>

          {gpsError && (
            <div className="mb-2 text-[11px] font-medium text-rose-600 dark:text-rose-400">
              {gpsError}
            </div>
          )}

          {userLocation && (
            <div className="mb-2 truncate rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              GPS found: {userLocation.placeName || `${userLocation.gps[0].toFixed(4)}, ${userLocation.gps[1].toFixed(4)}`}
              {userLocation.accuracyM !== undefined ? ` (±${userLocation.accuracyM}m)` : ''}
            </div>
          )}

          <Suspense fallback={<MapSkeleton heightClass="h-[185px]" />}>
            <LeafletFarmMap
              ponds={state.ponds}
              farms={state.farms}
              selectedFarmId={selectedFarmId}
              mapMode={mapMode}
              heightClass="h-[185px]"
              infrastructureMarkers={state.infrastructureMarkers || []}
              waterReadings={state.waterReadings}
              userLocation={userLocation}
              onSelectPond={onSelectPond}
            />
          </Suspense>
        </Card>
      </div>
    </div>
  );
};
