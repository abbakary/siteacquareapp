import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Fish,
  Layers,
  Package,
  Plus,
  Scale,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sprout,
  Waves,
} from 'lucide-react';
import { AquacultureState, Language } from '../../types/aquaculture';
import { tDomain, tr, TRANSLATIONS } from '../../i18n/translations';
import { formatNumber, formatTzs, todayIso } from '../../utils/formatters';
import { getPermissions } from '../../utils/rbac';
import { getLotTotalRemainingKg, roundKg } from '../../utils/sales';
import {
  AnimatedTabs,
  Badge,
  Button,
  Card,
  CountUpNumber,
  EmptyState,
  FormError,
  INPUT_CLASS,
  Sheet,
  ValidCheck,
  listItem,
} from '../../ui';

const renderGradeLabel = (grade: 'Large' | 'Medium' | 'Small', language: Language) => {
  if (language !== 'sw') return grade;
  if (grade === 'Large') return 'Kubwa';
  if (grade === 'Medium') return 'Saizi ya Kati';
  return 'Ndogo';
};

export interface ManualStockLotPayload {
  pondCode: string; // 'EXTERNAL' or pond code e.g. 'POND-001'
  species: string;
  batchCode: string;
  deductFromPond: boolean;
  largeCount: number;
  largeKg: number;
  mediumCount: number;
  mediumKg: number;
  smallCount: number;
  smallKg: number;
  notes: string;
  pin: string;
}

export interface ManualPondStockPayload {
  pondCode: string;
  species: string;
  fishCount: number;
  avgWeightG: number;
  sourceHatchery: string;
  supplier: string;
  notes: string;
}

interface FishStockModuleProps {
  state: AquacultureState;
  language: Language;
  onBackToMenu: () => void;
  onHarvestPond: (pondCode: string) => void;
  onQuickSalePond: (pondCode: string) => void;
  onQuickSaleLot: (lotId: string) => void;
  onCreateManualStockLot: (
    payload: ManualStockLotPayload
  ) => { ok: boolean; lotId?: string; error?: string };
  onRegisterPondStock: (
    payload: ManualPondStockPayload
  ) => { ok: boolean; error?: string };
}

type StockTab = 'ponds' | 'lots' | 'ledger';

export const FishStockModule: React.FC<FishStockModuleProps> = ({
  state,
  language,
  onBackToMenu,
  onHarvestPond,
  onQuickSalePond,
  onQuickSaleLot,
  onCreateManualStockLot,
  onRegisterPondStock,
}) => {
  const t = TRANSLATIONS[language];
  const perms = getPermissions(state.activeUser.role);

  const [activeTab, setActiveTab] = useState<StockTab>('ponds');
  const [searchQuery, setSearchQuery] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState('all');

  // Manual Stock Modal State
  const [manualOpen, setManualOpen] = useState(false);
  const [manualMode, setManualMode] = useState<'lot' | 'pond'>('lot');
  const [manualError, setManualError] = useState('');
  const [manualShake, setManualShake] = useState(0);

  // Mode A: Manual Graded Stock Lot
  const [lotPondCode, setLotPondCode] = useState<string>(state.ponds[0]?.code || 'EXTERNAL');
  const [lotSpecies, setLotSpecies] = useState<string>(
    state.ponds[0]?.species || 'Nile Tilapia'
  );
  const [lotBatchCode, setLotBatchCode] = useState<string>('');
  const [deductFromPond, setDeductFromPond] = useState<boolean>(true);
  const [lgCount, setLgCount] = useState<string>('');
  const [lgKg, setLgKg] = useState<string>('');
  const [mdCount, setMdCount] = useState<string>('');
  const [mdKg, setMdKg] = useState<string>('');
  const [smCount, setSmCount] = useState<string>('');
  const [smKg, setSmKg] = useState<string>('');
  const [lotNotes, setLotNotes] = useState<string>('');
  const [pin, setPin] = useState<string>('');

  // Mode B: Manual Live Pond Stocking
  const [pondStockCode, setPondStockCode] = useState<string>(state.ponds[0]?.code || '');
  const [pondStockSpecies, setPondStockSpecies] = useState<string>(
    state.ponds[0]?.species || 'Nile Tilapia'
  );
  const [pondFishCount, setPondFishCount] = useState<string>('');
  const [pondAvgWeightG, setPondAvgWeightG] = useState<string>('15');
  const [pondHatchery, setPondHatchery] = useState<string>('');
  const [pondSupplier, setPondSupplier] = useState<string>('');
  const [pondNotes, setPondNotes] = useState<string>('');

  // Computed Pond Stock Rows (auto-synced with ponds, batches, harvestLots, and sales)
  const pondStockRows = useMemo(() => {
    return state.ponds.map((pond) => {
      const batch =
        state.batches.find((b) => b.pondCode === pond.code && b.status !== 'Completed') ||
        state.batches.find((b) => b.pondCode === pond.code) ||
        null;
      const avgWeightG = batch ? batch.currentAvgWeightG : 350;
      const estBiomassKg = roundKg((pond.currentFish * avgWeightG) / 1000);
      const fillPct =
        pond.maxCapacity > 0
          ? Math.min(100, Math.round((pond.currentFish / pond.maxCapacity) * 100))
          : 0;

      const pondLots = state.harvestLots.filter((l) => l.pondCode === pond.code);
      const chilledRemainingKg = roundKg(
        pondLots.reduce((sum, l) => sum + getLotTotalRemainingKg(l), 0)
      );
      const soldKgFromPond = roundKg(
        state.sales.reduce(
          (sum, s) =>
            sum +
            s.lines
              .filter((ln) => ln.pondCode === pond.code)
              .reduce((ls, ln) => ls + ln.kg, 0),
          0
        )
      );

      return {
        pond,
        batch,
        avgWeightG,
        estBiomassKg,
        fillPct,
        chilledRemainingKg,
        soldKgFromPond,
        lotCount: pondLots.length,
      };
    });
  }, [state.ponds, state.batches, state.harvestLots, state.sales]);

  const filteredPondRows = useMemo(() => {
    return pondStockRows.filter((row) => {
      if (speciesFilter !== 'all' && row.pond.species !== speciesFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${row.pond.code} ${row.pond.name} ${row.pond.species} ${row.batch?.batchCode || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [pondStockRows, speciesFilter, searchQuery]);

  const filteredLots = useMemo(() => {
    return state.harvestLots.filter((lot) => {
      if (speciesFilter !== 'all' && lot.species !== speciesFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${lot.lotCode} ${lot.pondCode} ${lot.species} ${lot.batchCode}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [state.harvestLots, speciesFilter, searchQuery]);

  // Unified Stock Traceability Ledger (Pond Stocking + Harvest/Manual Stock Lots + Sales Out)
  const stockLedger = useMemo(() => {
    const entries: Array<{
      id: string;
      date: string;
      kind: 'Stock In' | 'Harvest to Stock' | 'Manual Stock Lot' | 'Sale Out';
      pondCode: string;
      species: string;
      ref: string;
      detail: string;
      kgDelta: string;
      actor: string;
    }> = [];

    state.batches.forEach((b) => {
      entries.push({
        id: `led-b-${b.id}`,
        date: b.stockingDate,
        kind: 'Stock In',
        pondCode: b.pondCode,
        species: b.species,
        ref: b.batchCode,
        detail:
          language === 'sw'
            ? `Wamepandikizwa samaki ${formatNumber(b.initialStocking)} (wastani ${b.avgInitialWeightG}g) kutoka ${b.sourceHatchery}`
            : `Stocked ${formatNumber(b.initialStocking)} fish (${b.avgInitialWeightG}g avg) from ${b.sourceHatchery}`,
        kgDelta: `+${roundKg((b.initialStocking * b.avgInitialWeightG) / 1000).toFixed(1)} kg`,
        actor: b.responsibleKeeper,
      });
    });

    state.harvestLots.forEach((l) => {
      const totalKg = roundKg(l.grades.largeKg + l.grades.mediumKg + l.grades.smallKg);
      entries.push({
        id: `led-l-${l.id}`,
        date: l.date,
        kind:
          l.source === 'Manual Stock'
            ? 'Manual Stock Lot'
            : 'Harvest to Stock',
        pondCode: l.pondCode,
        species: l.species,
        ref: l.lotCode,
        detail:
          language === 'sw'
            ? `${l.source === 'Manual Stock' ? 'Akiba iliyopangwa kwa mkono' : 'Fungu la mavuno lililopangwa'} · Iliyobaki: ${getLotTotalRemainingKg(l).toFixed(1)} kg`
            : `${l.source === 'Manual Stock' ? 'Manual graded stock' : 'Graded harvest lot'} · Rem: ${getLotTotalRemainingKg(l).toFixed(1)} kg`,
        kgDelta: `+${totalKg.toFixed(1)} kg`,
        actor: l.approvedBy,
      });
    });

    state.sales.forEach((s) => {
      const totalKg = roundKg(s.lines.reduce((sum, ln) => sum + ln.kg, 0));
      const ponds = Array.from(new Set(s.lines.map((ln) => ln.pondCode))).join(', ');
      const species = Array.from(new Set(s.lines.map((ln) => ln.species))).join(', ');
      entries.push({
        id: `led-s-${s.id}`,
        date: s.date,
        kind: 'Sale Out',
        pondCode: ponds || 'MULTI',
        species: species || tr(language, 'Mchanganyiko', 'Mixed'),
        ref: s.invoiceNo,
        detail:
          language === 'sw'
            ? `Imeuzwa kwa ${s.customerName} (${formatTzs(s.totalTzs)})`
            : `Sold to ${s.customerName} (${formatTzs(s.totalTzs)})`,
        kgDelta: `-${totalKg.toFixed(1)} kg`,
        actor: s.createdBy,
      });
    });

    return entries.sort((a, b) => b.date.localeCompare(a.date));
  }, [state.batches, state.harvestLots, state.sales, language]);

  const renderMovementKind = (
    kind: 'Stock In' | 'Harvest to Stock' | 'Manual Stock Lot' | 'Sale Out'
  ) => {
    if (language !== 'sw') return kind;
    if (kind === 'Stock In') return 'Kuingiza Akiba';
    if (kind === 'Harvest to Stock') return 'Mavuno Kwenye Akiba';
    if (kind === 'Manual Stock Lot') return 'Fungu la Mkono';
    return 'Mauzo Yaliyotoka';
  };

  // KPIs
  const totalLiveFish = state.ponds.reduce((sum, p) => sum + p.currentFish, 0);
  const activePondCount = state.ponds.filter((p) => p.currentFish > 0).length;
  const totalLiveBiomassKg = roundKg(
    pondStockRows.reduce((sum, r) => sum + r.estBiomassKg, 0)
  );
  const totalChilledStockKg = roundKg(
    state.harvestLots.reduce((sum, l) => sum + getLotTotalRemainingKg(l), 0)
  );
  const activeLotsCount = state.harvestLots.filter((l) => getLotTotalRemainingKg(l) > 0).length;
  const totalTrackedStockKg = roundKg(totalLiveBiomassKg + totalChilledStockKg);

  const openManualModal = (mode: 'lot' | 'pond' = 'lot') => {
    setManualMode(mode);
    setManualError('');
    setPin('');
    const firstActivePond = state.ponds.find((p) => p.currentFish > 0) || state.ponds[0];
    if (firstActivePond) {
      setLotPondCode(firstActivePond.code);
      setLotSpecies(firstActivePond.species);
      const b = state.batches.find(
        (bt) => bt.pondCode === firstActivePond.code && bt.status !== 'Completed'
      );
      setLotBatchCode(b?.batchCode || '');
      setPondStockCode(firstActivePond.code);
      setPondStockSpecies(firstActivePond.species);
    }
    setLgCount('');
    setLgKg('');
    setMdCount('');
    setMdKg('');
    setSmCount('');
    setSmKg('');
    setLotNotes('');
    setPondFishCount('');
    setPondAvgWeightG('15');
    setPondHatchery('');
    setPondSupplier('');
    setPondNotes('');
    setManualOpen(true);
  };

  const failManual = (msg: string) => {
    setManualError(msg);
    setManualShake((s) => s + 1);
  };

  const handleSubmitManualLot = () => {
    setManualError('');
    const res = onCreateManualStockLot({
      pondCode: lotPondCode,
      species: lotSpecies,
      batchCode: lotBatchCode.trim() || 'MANUAL',
      deductFromPond: lotPondCode !== 'EXTERNAL' && deductFromPond,
      largeCount: Math.max(0, Math.round(Number(lgCount) || 0)),
      largeKg: roundKg(Math.max(0, Number(lgKg) || 0)),
      mediumCount: Math.max(0, Math.round(Number(mdCount) || 0)),
      mediumKg: roundKg(Math.max(0, Number(mdKg) || 0)),
      smallCount: Math.max(0, Math.round(Number(smCount) || 0)),
      smallKg: roundKg(Math.max(0, Number(smKg) || 0)),
      notes: lotNotes.trim(),
      pin,
    });
    if (!res.ok) {
      failManual(res.error || tr(language, 'Imeshindwa kutengeneza fungu la akiba.', 'Could not create stock lot.'));
      return;
    }
    setManualOpen(false);
  };

  const handleSubmitManualPondStock = () => {
    setManualError('');
    const count = Math.round(Number(pondFishCount) || 0);
    const avgG = Number(pondAvgWeightG) || 0;
    if (!pondStockCode) {
      failManual(tr(language, 'Chagua bwawa kwanza.', 'Select a pond first.'));
      return;
    }
    if (count <= 0) {
      failManual(tr(language, 'Weka idadi ya samaki zaidi ya 0.', 'Enter fish count greater than 0.'));
      return;
    }
    if (avgG <= 0) {
      failManual(tr(language, 'Weka uzito wa wastani (gramu) zaidi ya 0.', 'Enter average weight (grams) greater than 0.'));
      return;
    }
    const res = onRegisterPondStock({
      pondCode: pondStockCode,
      species: pondStockSpecies,
      fishCount: count,
      avgWeightG: avgG,
      sourceHatchery:
        pondHatchery.trim() || tr(language, 'Kitalu cha Shamba / Ingizo la Mkono', 'Farm Hatchery / Manual Entry'),
      supplier: pondSupplier.trim() || tr(language, 'Upandikizaji wa Moja kwa Moja', 'Direct Stocking'),
      notes: pondNotes.trim(),
    });
    if (!res.ok) {
      failManual(res.error || tr(language, 'Imeshindwa kusajili akiba ya samaki kwenye bwawa.', 'Could not register pond fish stock.'));
      return;
    }
    setManualOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Header Bar with Back to Menu */}
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button
            variant="secondary"
            size="md"
            onClick={onBackToMenu}
            aria-label={t.ui.backToMenu}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t.ui.backToMenu}</span>
          </Button>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {tr(language, 'Kituo cha Akiba ya Samaki na Uzito Hai', 'Fish Stock & Live Biomass Center')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {tr(
                language,
                'Akiba ya samaki hai husawazishwa kiotomatiki kwa bwawa na aina, pamoja na mafungu ya mkono. Kila uvunaji na mauzo hufuatiliwa moja kwa moja hapa.',
                'Live stock automatically synced by pond & species, plus manual stock lots. Every harvest and sale tracks directly from this stock.'
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" size="md" onClick={() => openManualModal('lot')}>
            <Plus className="h-4 w-4" /> {tr(language, 'Ingiza Akiba ya Mkono', 'Manual Stock Entry')}
          </Button>
          <Button variant="success" size="md" onClick={() => onQuickSalePond(state.ponds.find((p) => p.currentFish > 0)?.code || 'POND-001')}>
            <ShoppingBag className="h-4 w-4" /> {t.sales.quickSaleBtn}
          </Button>
        </div>
      </Card>

      {/* 4 Stock KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card hoverable>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{tr(language, 'Samaki Hai Kwenye Mabwawa', 'Live Fish in Ponds')}</span>
            <Fish className="h-4 w-4 text-blue-600 dark:text-sky-400" />
          </div>
          <div className="mt-1 font-display text-xl font-extrabold text-slate-900 tabular-nums dark:text-white">
            <CountUpNumber value={totalLiveFish} formatter={formatNumber} />
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {tr(language, `Kwenye mabwawa ${activePondCount} yanayotumika`, `Across ${activePondCount} active pond(s)`)}
          </div>
        </Card>

        <Card hoverable>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{tr(language, 'Uzito Hai Kwenye Mabwawa', 'Live Pond Biomass')}</span>
            <Waves className="h-4 w-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="mt-1 font-display text-xl font-extrabold text-teal-700 tabular-nums dark:text-teal-400">
            <CountUpNumber value={totalLiveBiomassKg} decimals={1} suffix=" kg" />
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {tr(language, 'Tayari kwa Kuvunwa au Kuuzwa Moja kwa Moja', 'Available for Harvest or Direct Sale')}
          </div>
        </Card>

        <Card hoverable>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{tr(language, 'Akiba ya Baridi Iliyopangwa', 'Graded Chilled Stock (In Stock)')}</span>
            <Boxes className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-1 font-display text-xl font-extrabold text-emerald-700 tabular-nums dark:text-emerald-400">
            <CountUpNumber value={totalChilledStockKg} decimals={1} suffix=" kg" />
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {tr(language, `Mafungu ${activeLotsCount} tayari kuuzwa`, `${activeLotsCount} active lot(s) ready to sell`)}
          </div>
        </Card>

        <Card hoverable>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{tr(language, 'Jumla ya Akiba Iliyofuatiliwa', 'Total Tracked Fish Stock')}</span>
            <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="mt-1 font-display text-xl font-extrabold text-slate-900 tabular-nums dark:text-white">
            <CountUpNumber value={totalTrackedStockKg} decimals={1} suffix=" kg" />
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {tr(
              language,
              `Mauzo ${state.sales.length} na mafungu ${state.harvestLots.length} yameunganishwa`,
              `${state.sales.length} sale(s) & ${state.harvestLots.length} lot(s) linked`
            )}
          </div>
        </Card>
      </div>

      {/* Tabs + Search Filter Bar */}
      <Card padded={false} className="flex flex-wrap items-center justify-between gap-3 p-3">
        <AnimatedTabs<StockTab>
          layoutId="fish-stock-tabs"
          activeId={activeTab}
          onChange={setActiveTab}
          tabs={[
            {
              id: 'ponds',
              label: `${tr(language, 'Akiba ya Mabwawa kwa Aina', 'Pond Stock by Species')} (${filteredPondRows.length})`,
              icon: <Sprout className="h-3.5 w-3.5" />,
            },
            {
              id: 'lots',
              label: `${tr(language, 'Mafungu Yaliyopangwa', 'Graded Stock Lots')} (${filteredLots.length})`,
              icon: <Package className="h-3.5 w-3.5" />,
            },
            {
              id: 'ledger',
              label: `${tr(language, 'Daftari la Mwenendo wa Akiba', 'Stock Movement Ledger')} (${stockLedger.length})`,
              icon: <Layers className="h-3.5 w-3.5" />,
            },
          ]}
        />

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px]">
            <Search className="pointer-events-none absolute top-3.5 left-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tr(language, 'Tafuta bwawa, aina, kundi, fungu...', 'Search pond, species, batch, lot...')}
              className={`${INPUT_CLASS} pl-9`}
            />
          </div>
          <select
            value={speciesFilter}
            onChange={(e) => setSpeciesFilter(e.target.value)}
            aria-label={tr(language, 'Chuja akiba kwa aina ya samaki', 'Filter stock by species')}
            className={`${INPUT_CLASS} min-w-[170px] sm:w-auto`}
          >
            <option value="all">{tr(language, 'Aina Zote za Samaki', 'All Species')}</option>
            {state.speciesCatalogue.map((s) => (
              <option key={s.id} value={s.commonName}>
                {s.commonName}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* TAB 1: LIVE POND STOCK BY SPECIES */}
      {activeTab === 'ponds' && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filteredPondRows.map((row, idx) => {
            const { pond, batch, avgWeightG, estBiomassKg, fillPct, chilledRemainingKg, soldKgFromPond } = row;
            return (
              <motion.div
                key={pond.id}
                custom={idx}
                initial="hidden"
                animate="visible"
                variants={listItem}
              >
                <Card hoverable className="space-y-3 text-xs">
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-slate-800">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-extrabold text-blue-700 dark:text-sky-400">
                          {pond.code}
                        </span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {pond.name}
                        </span>
                        <Badge variant={pond.currentFish > 0 ? 'success' : 'neutral'}>
                          {tDomain(language, pond.status)}
                        </Badge>
                      </div>
                      <div className="mt-0.5 text-slate-600 dark:text-slate-300">
                        {tr(language, 'Aina', 'Species')}: <strong>{pond.species}</strong> · {tDomain(language, pond.unitType)} ·{' '}
                        {tr(language, 'Kundi', 'Batch')}:{' '}
                        <span className="font-mono font-semibold">
                          {batch?.batchCode || tr(language, 'Halijapandikizwa', 'Unstocked')}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-extrabold text-emerald-700 tabular-nums dark:text-emerald-400">
                        {estBiomassKg.toFixed(1)} kg
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {tr(language, 'Kadirio la Uzito Hai', 'Est. Live Biomass')}
                      </div>
                    </div>
                  </div>

                  {/* Stock Breakdown Metrics */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/70">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {tr(language, 'Samaki Hai', 'Live Fish')}
                      </div>
                      <div className="font-bold text-slate-900 tabular-nums dark:text-white">
                        {formatNumber(pond.currentFish)}
                      </div>
                      <div className="text-[10px] text-slate-500 tabular-nums">
                        {tr(language, 'Wastani', 'Avg')} {avgWeightG} g
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/70">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {tr(language, 'Akiba ya Baridi', 'Chilled Stock')}
                      </div>
                      <div className="font-bold text-blue-700 tabular-nums dark:text-sky-400">
                        {chilledRemainingKg.toFixed(1)} kg
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {tr(language, `Mafungu ${row.lotCount}`, `${row.lotCount} lot(s)`)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/70">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {tr(language, 'Jumla Iliyouzwa', 'Sold Total')}
                      </div>
                      <div className="font-bold text-slate-900 tabular-nums dark:text-white">
                        {soldKgFromPond.toFixed(1)} kg
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {tr(language, 'Imefuatiliwa', 'Tracked out')}
                      </div>
                    </div>
                  </div>

                  {/* Pond Capacity Bar */}
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span>{tr(language, 'Uwezo wa Bwawa Kuweka Samaki', 'Pond Stocking Capacity')}</span>
                      <span className="font-bold tabular-nums">
                        {formatNumber(pond.currentFish)} / {formatNumber(pond.maxCapacity)} ({fillPct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full transition-all ${
                          fillPct > 90
                            ? 'bg-amber-500'
                            : fillPct > 0
                              ? 'bg-emerald-600'
                              : 'bg-slate-300'
                        }`}
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Direct Harvest & Sale Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    {pond.currentFish > 0 ? (
                      <>
                        <Button
                          variant="warning"
                          size="sm"
                          onClick={() => onHarvestPond(pond.code)}
                        >
                          <Scale className="h-3.5 w-3.5" /> {tr(language, 'Vuna Kwenye Akiba', 'Harvest to Stock')}
                        </Button>
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => onQuickSalePond(pond.code)}
                        >
                          {tr(language, 'Uza Kutoka Bwawa', 'Sell from Pond')} <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        fullWidth
                        onClick={() => {
                          openManualModal('pond');
                          setPondStockCode(pond.code);
                          setPondStockSpecies(pond.species);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" /> {tr(language, 'Pandikiza Vifaranga / Samaki kwa Mkono', 'Stock Fingerlings / Fish Manually')}
                      </Button>
                    )}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* TAB 2: GRADED CHILLED STOCK LOTS */}
      {activeTab === 'lots' && (
        <div className="space-y-3">
          {filteredLots.length === 0 ? (
            <EmptyState
              icon={<Package className="h-6 w-6" />}
              title={tr(language, 'Hakuna mafungu ya akiba ya samaki yaliyopatikana', 'No graded fish stock lots found')}
              description={tr(
                language,
                'Vuna kutoka bwawa lenye samaki au tengeneza fungu la akiba kwa mkono ili samaki wawe tayari kuuzwa.',
                'Harvest from an active pond or create a manual stock lot to make graded fish ready for sale.'
              )}
              action={
                <Button variant="primary" onClick={() => openManualModal('lot')}>
                  <Plus className="h-4 w-4" /> {tr(language, 'Tengeneza Fungu la Akiba', 'Create Manual Stock Lot')}
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {filteredLots.map((lot, idx) => {
                const remTotal = getLotTotalRemainingKg(lot);
                const origTotal = roundKg(
                  lot.grades.largeKg + lot.grades.mediumKg + lot.grades.smallKg
                );
                return (
                  <motion.div
                    key={lot.id}
                    custom={idx}
                    initial="hidden"
                    animate="visible"
                    variants={listItem}
                  >
                    <Card hoverable className="text-xs">
                      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-slate-800">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-extrabold text-blue-700 dark:text-sky-400">
                              {lot.lotCode}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {lot.pondCode} · {lot.species}
                            </span>
                            <Badge variant="info">{tDomain(language, lot.source || 'Harvest')}</Badge>
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {tr(language, 'Tarehe', 'Date')}: {lot.date} · {tr(language, 'Kundi', 'Batch')}: {lot.batchCode} ·{' '}
                            {tr(language, 'Imeidhinishwa', 'Approved')}: {lot.approvedBy}
                          </div>
                        </div>
                        <Badge variant={remTotal > 0 ? 'success' : 'neutral'}>
                          {remTotal > 0
                            ? `${remTotal.toFixed(1)} kg ${tr(language, 'bohari', 'in stock')}`
                            : tr(language, 'Imeisha', 'Sold Out')}
                        </Badge>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/70">
                          <div className="text-slate-500 dark:text-slate-400">
                            {renderGradeLabel('Large', language)}
                          </div>
                          <div className="font-bold text-slate-900 tabular-nums dark:text-white">
                            {lot.remainingKg.large.toFixed(1)} / {lot.grades.largeKg} kg
                          </div>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/70">
                          <div className="text-slate-500 dark:text-slate-400">
                            {renderGradeLabel('Medium', language)}
                          </div>
                          <div className="font-bold text-slate-900 tabular-nums dark:text-white">
                            {lot.remainingKg.medium.toFixed(1)} / {lot.grades.mediumKg} kg
                          </div>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/70">
                          <div className="text-slate-500 dark:text-slate-400">
                            {renderGradeLabel('Small', language)}
                          </div>
                          <div className="font-bold text-slate-900 tabular-nums dark:text-white">
                            {lot.remainingKg.small.toFixed(1)} / {lot.grades.smallKg} kg
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {tr(language, 'Uzito wa awali wa fungu', 'Initial lot weight')}: {origTotal.toFixed(1)} kg
                          {lot.notes ? ` · ${lot.notes}` : ''}
                        </span>
                        {remTotal > 0 && (
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => onQuickSaleLot(lot.id)}
                          >
                            {tr(language, 'Uza Kutoka Akiba', 'Sell from Stock')} <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: UNIFIED STOCK MOVEMENT & TRACEABILITY LEDGER */}
      {activeTab === 'ledger' && (
        <Card className="overflow-x-auto">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {tr(
                  language,
                  'Daftari la Ufuatiliaji wa Akiba ya Samaki (Bwawa → Mavuno → Mauzo)',
                  'Fish Stock Traceability Ledger (Pond Stock → Harvest → Sales)'
                )}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tr(
                  language,
                  'Kila tukio la upandikizaji, fungu la mavuno, marekebisho ya mkono, na mauzo hufuatiliwa hapa.',
                  'Every stocking event, harvest lot, manual adjustment, and sale is tracked here.'
                )}
              </p>
            </div>
          </div>

          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="py-2.5">{tr(language, 'Tarehe', 'Date')}</th>
                <th className="py-2.5">{tr(language, 'Aina ya Mwendo', 'Movement Type')}</th>
                <th className="py-2.5">{tr(language, 'Bwawa / Chanzo', 'Pond / Source')}</th>
                <th className="py-2.5">{tr(language, 'Aina', 'Species')}</th>
                <th className="py-2.5">{tr(language, 'Kumbukumbu', 'Reference')}</th>
                <th className="py-2.5">{tr(language, 'Maelezo', 'Details')}</th>
                <th className="py-2.5 text-right">{tr(language, 'Mabadiliko ya Akiba', 'Stock Change')}</th>
                <th className="py-2.5 pl-3">{tr(language, 'Aliyerekodi', 'Recorded By')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {stockLedger.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-2.5 text-slate-500 tabular-nums dark:text-slate-400">
                    {entry.date}
                  </td>
                  <td className="py-2.5">
                    <Badge
                      variant={
                        entry.kind === 'Sale Out'
                          ? 'warning'
                          : entry.kind === 'Manual Stock Lot'
                            ? 'info'
                            : 'success'
                      }
                    >
                      {renderMovementKind(entry.kind)}
                    </Badge>
                  </td>
                  <td className="py-2.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                    {entry.pondCode}
                  </td>
                  <td className="py-2.5 font-semibold text-slate-800 dark:text-slate-200">
                    {entry.species}
                  </td>
                  <td className="py-2.5 font-mono font-bold text-blue-700 dark:text-sky-400">
                    {entry.ref}
                  </td>
                  <td className="py-2.5 text-slate-600 dark:text-slate-300">{entry.detail}</td>
                  <td
                    className={`py-2.5 text-right font-extrabold tabular-nums ${
                      entry.kgDelta.startsWith('-')
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {entry.kgDelta}
                  </td>
                  <td className="py-2.5 pl-3 text-slate-500 dark:text-slate-400">
                    {entry.actor}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* MANUAL FISH STOCK CREATION SHEET */}
      <Sheet
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        maxWidthClass="sm:max-w-2xl"
        title={tr(language, 'Ingizo la Akiba ya Samaki kwa Mkono', 'Manual Fish Stock Entry')}
        subtitle={tr(
          language,
          'Tengeneza fungu la samaki waliopangwa tayari kwa mauzo au sajili/rekebisha akiba ya samaki hai bwawani',
          'Create a graded sellable fish stock lot or register/adjust live pond fish stock'
        )}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => {
                setManualMode('lot');
                setManualError('');
              }}
              className={`min-h-[42px] rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                manualMode === 'lot'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {tr(language, 'Fungu Lililopangwa (Tayari Kuuza)', 'Graded Stock Lot (Ready to Sell)')}
            </button>
            <button
              type="button"
              onClick={() => {
                setManualMode('pond');
                setManualError('');
              }}
              className={`min-h-[42px] rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                manualMode === 'pond'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {tr(language, 'Akiba ya Samaki Hai Bwawani', 'Live Pond Fish Stock (Stocking)')}
            </button>
          </div>

          <FormError message={manualError} shakeKey={manualShake} />

          {manualMode === 'lot' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="ms-pond"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {tr(language, 'Bwawa Chanzo *', 'Source Pond *')}
                  </label>
                  <select
                    id="ms-pond"
                    value={lotPondCode}
                    onChange={(e) => {
                      const code = e.target.value;
                      setLotPondCode(code);
                      const p = state.ponds.find((x) => x.code === code);
                      if (p) setLotSpecies(p.species);
                      const b = state.batches.find(
                        (bt) => bt.pondCode === code && bt.status !== 'Completed'
                      );
                      setLotBatchCode(b?.batchCode || '');
                    }}
                    className={INPUT_CLASS}
                  >
                    {state.ponds.map((p) => (
                      <option key={p.id} value={p.code}>
                        {p.code} — {p.species} ({formatNumber(p.currentFish)} {tr(language, 'samaki', 'fish')})
                      </option>
                    ))}
                    <option value="EXTERNAL">
                      {tr(language, 'Nje / Akiba ya Chumba cha Baridi', 'External / Cold Room Opening Stock')}
                    </option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="ms-species"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {tr(language, 'Aina ya Samaki *', 'Fish Species *')}
                  </label>
                  <select
                    id="ms-species"
                    value={lotSpecies}
                    onChange={(e) => setLotSpecies(e.target.value)}
                    className={INPUT_CLASS}
                  >
                    {state.speciesCatalogue.map((s) => (
                      <option key={s.id} value={s.commonName}>
                        {s.commonName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="ms-batch"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {tr(language, 'Msimbo wa Kundi / Kumbukumbu', 'Batch / Reference Code')}
                  </label>
                  <input
                    id="ms-batch"
                    type="text"
                    value={lotBatchCode}
                    onChange={(e) => setLotBatchCode(e.target.value)}
                    placeholder={tr(language, 'mf. TIL-2026-001', 'e.g. TIL-2026-001')}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              {lotPondCode !== 'EXTERNAL' && (
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={deductFromPond}
                    onChange={(e) => setDeductFromPond(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  <span>
                    {tr(
                      language,
                      `Punguza idadi ya samaki iliyoingizwa kutoka akiba hai ya ${lotPondCode}`,
                      `Deduct entered fish counts from ${lotPondCode} live pond stock`
                    )}
                  </span>
                </label>
              )}

              <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60 sm:grid-cols-3">
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {tr(language, 'Daraja Kubwa', 'Large Grade')}
                  </div>
                  <div>
                    <label htmlFor="ms-lg-kg" className="mb-1 block text-[11px] text-slate-500">
                      {tr(language, 'Uzito (kg)', 'Weight (kg)')}
                    </label>
                    <input
                      id="ms-lg-kg"
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="0.0"
                      value={lgKg}
                      onChange={(e) => setLgKg(e.target.value)}
                      className={`${INPUT_CLASS} tabular-nums`}
                    />
                  </div>
                  <div>
                    <label htmlFor="ms-lg-cnt" className="mb-1 block text-[11px] text-slate-500">
                      {tr(language, 'Idadi ya Samaki', 'Fish Count')}
                    </label>
                    <input
                      id="ms-lg-cnt"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={lgCount}
                      onChange={(e) => setLgCount(e.target.value)}
                      className={`${INPUT_CLASS} tabular-nums`}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {tr(language, 'Daraja la Kati', 'Medium Grade')}
                  </div>
                  <div>
                    <label htmlFor="ms-md-kg" className="mb-1 block text-[11px] text-slate-500">
                      {tr(language, 'Uzito (kg)', 'Weight (kg)')}
                    </label>
                    <input
                      id="ms-md-kg"
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="0.0"
                      value={mdKg}
                      onChange={(e) => setMdKg(e.target.value)}
                      className={`${INPUT_CLASS} tabular-nums`}
                    />
                  </div>
                  <div>
                    <label htmlFor="ms-md-cnt" className="mb-1 block text-[11px] text-slate-500">
                      {tr(language, 'Idadi ya Samaki', 'Fish Count')}
                    </label>
                    <input
                      id="ms-md-cnt"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={mdCount}
                      onChange={(e) => setMdCount(e.target.value)}
                      className={`${INPUT_CLASS} tabular-nums`}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {tr(language, 'Daraja Ndogo', 'Small Grade')}
                  </div>
                  <div>
                    <label htmlFor="ms-sm-kg" className="mb-1 block text-[11px] text-slate-500">
                      {tr(language, 'Uzito (kg)', 'Weight (kg)')}
                    </label>
                    <input
                      id="ms-sm-kg"
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="0.0"
                      value={smKg}
                      onChange={(e) => setSmKg(e.target.value)}
                      className={`${INPUT_CLASS} tabular-nums`}
                    />
                  </div>
                  <div>
                    <label htmlFor="ms-sm-cnt" className="mb-1 block text-[11px] text-slate-500">
                      {tr(language, 'Idadi ya Samaki', 'Fish Count')}
                    </label>
                    <input
                      id="ms-sm-cnt"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={smCount}
                      onChange={(e) => setSmCount(e.target.value)}
                      className={`${INPUT_CLASS} tabular-nums`}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="ms-notes"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {tr(language, 'Maelezo ya Akiba', 'Stock Notes')}
                  </label>
                  <input
                    id="ms-notes"
                    type="text"
                    value={lotNotes}
                    onChange={(e) => setLotNotes(e.target.value)}
                    placeholder={tr(language, 'mf. Sanduku la baridi #2', 'e.g. Chilled storage box #2')}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label
                    htmlFor="ms-pin"
                    className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />{' '}
                      {tr(language, 'PIN ya Uidhinishaji (namba 4) *', 'Approval PIN (4 digits) *')}
                    </span>
                    <ValidCheck valid={/^\d{4}$/.test(pin)} />
                  </label>
                  <input
                    id="ms-pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder={tr(language, 'Weka PIN ya namba 4', 'Enter 4-digit PIN')}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className={`${INPUT_CLASS} font-mono tracking-widest`}
                  />
                </div>
              </div>

              <Button
                variant="success"
                size="lg"
                fullWidth
                disabled={!perms.canApproveHarvest && !perms.canRecordSale}
                onClick={handleSubmitManualLot}
              >
                <CheckCircle2 className="h-4 w-4" />{' '}
                {tr(language, 'Hifadhi Fungu la Samaki Waliopangwa', 'Save Graded Fish Stock Lot')}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="mp-pond"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {tr(language, 'Bwawa Lengwa *', 'Target Pond *')}
                  </label>
                  <select
                    id="mp-pond"
                    value={pondStockCode}
                    onChange={(e) => {
                      setPondStockCode(e.target.value);
                      const p = state.ponds.find((x) => x.code === e.target.value);
                      if (p) setPondStockSpecies(p.species);
                    }}
                    className={INPUT_CLASS}
                  >
                    {state.ponds.map((p) => (
                      <option key={p.id} value={p.code}>
                        {p.code} ({p.name}) — {formatNumber(p.currentFish)} / {formatNumber(p.maxCapacity)}{' '}
                        {tr(language, 'samaki', 'fish')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="mp-species"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {tr(language, 'Aina *', 'Species *')}
                  </label>
                  <select
                    id="mp-species"
                    value={pondStockSpecies}
                    onChange={(e) => setPondStockSpecies(e.target.value)}
                    className={INPUT_CLASS}
                  >
                    {state.speciesCatalogue.map((s) => (
                      <option key={s.id} value={s.commonName}>
                        {s.commonName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="mp-count"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {tr(language, 'Idadi ya Samaki wa Kuongeza *', 'Fish Count to Add *')}
                  </label>
                  <input
                    id="mp-count"
                    type="number"
                    min="1"
                    placeholder={tr(language, 'mf. 5000', 'e.g. 5000')}
                    value={pondFishCount}
                    onChange={(e) => setPondFishCount(e.target.value)}
                    className={`${INPUT_CLASS} tabular-nums`}
                  />
                </div>
                <div>
                  <label
                    htmlFor="mp-avg"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {tr(language, 'Uzito Wastani wa Samaki (g) *', 'Average Fish Weight (g) *')}
                  </label>
                  <input
                    id="mp-avg"
                    type="number"
                    min="1"
                    step="0.5"
                    value={pondAvgWeightG}
                    onChange={(e) => setPondAvgWeightG(e.target.value)}
                    className={`${INPUT_CLASS} tabular-nums`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="mp-hatchery"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {tr(language, 'Kitalu Chanzo (Hatchery)', 'Source Hatchery')}
                  </label>
                  <input
                    id="mp-hatchery"
                    type="text"
                    value={pondHatchery}
                    onChange={(e) => setPondHatchery(e.target.value)}
                    placeholder={tr(language, 'mf. Pwani Fingerlings Ltd', 'e.g. Pwani Fingerlings Ltd')}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label
                    htmlFor="mp-supplier"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {tr(language, 'Msambazaji', 'Supplier')}
                  </label>
                  <input
                    id="mp-supplier"
                    type="text"
                    value={pondSupplier}
                    onChange={(e) => setPondSupplier(e.target.value)}
                    placeholder={tr(language, 'mf. TAFIRI Certified Hatchery', 'e.g. TAFIRI Certified Hatchery')}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="mp-notes"
                  className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  {tr(language, 'Maelezo', 'Notes')} ({todayIso()})
                </label>
                <input
                  id="mp-notes"
                  type="text"
                  value={pondNotes}
                  onChange={(e) => setPondNotes(e.target.value)}
                  placeholder={tr(language, 'Maelezo ya hiari ya uhakiki wa upandikizaji', 'Optional stocking verification notes')}
                  className={INPUT_CLASS}
                />
              </div>

              <Button variant="primary" size="lg" fullWidth onClick={handleSubmitManualPondStock}>
                <CheckCircle2 className="h-4 w-4" />{' '}
                {tr(language, 'Sajili Akiba ya Samaki Hai Bwawani', 'Register Live Pond Fish Stock')}
              </Button>
            </div>
          )}
        </div>
      </Sheet>
    </div>
  );
};
