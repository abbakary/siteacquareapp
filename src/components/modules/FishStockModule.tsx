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
import { TRANSLATIONS } from '../../i18n/translations';
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
        detail: `Stocked ${formatNumber(b.initialStocking)} fish (${b.avgInitialWeightG}g avg) from ${b.sourceHatchery}`,
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
        detail: `${l.source === 'Manual Stock' ? 'Manual graded stock' : 'Graded harvest lot'} · Rem: ${getLotTotalRemainingKg(l).toFixed(1)} kg`,
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
        species: species || 'Mixed',
        ref: s.invoiceNo,
        detail: `Sold to ${s.customerName} (${formatTzs(s.totalTzs)})`,
        kgDelta: `-${totalKg.toFixed(1)} kg`,
        actor: s.createdBy,
      });
    });

    return entries.sort((a, b) => b.date.localeCompare(a.date));
  }, [state.batches, state.harvestLots, state.sales]);

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
      failManual(res.error || 'Could not create stock lot.');
      return;
    }
    setManualOpen(false);
  };

  const handleSubmitManualPondStock = () => {
    setManualError('');
    const count = Math.round(Number(pondFishCount) || 0);
    const avgG = Number(pondAvgWeightG) || 0;
    if (!pondStockCode) {
      failManual('Select a pond first.');
      return;
    }
    if (count <= 0) {
      failManual('Enter fish count greater than 0.');
      return;
    }
    if (avgG <= 0) {
      failManual('Enter average weight (grams) greater than 0.');
      return;
    }
    const res = onRegisterPondStock({
      pondCode: pondStockCode,
      species: pondStockSpecies,
      fishCount: count,
      avgWeightG: avgG,
      sourceHatchery: pondHatchery.trim() || 'Farm Hatchery / Manual Entry',
      supplier: pondSupplier.trim() || 'Direct Stocking',
      notes: pondNotes.trim(),
    });
    if (!res.ok) {
      failManual(res.error || 'Could not register pond fish stock.');
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
              Fish Stock &amp; Live Biomass Center
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live stock automatically synced by pond &amp; species, plus manual stock lots. Every harvest and sale tracks directly from this stock.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" size="md" onClick={() => openManualModal('lot')}>
            <Plus className="h-4 w-4" /> Manual Stock Entry
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
            <span>Live Fish in Ponds</span>
            <Fish className="h-4 w-4 text-blue-600 dark:text-sky-400" />
          </div>
          <div className="mt-1 font-display text-xl font-extrabold text-slate-900 tabular-nums dark:text-white">
            <CountUpNumber value={totalLiveFish} formatter={formatNumber} />
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Across {activePondCount} active pond(s)
          </div>
        </Card>

        <Card hoverable>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Live Pond Biomass</span>
            <Waves className="h-4 w-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="mt-1 font-display text-xl font-extrabold text-teal-700 tabular-nums dark:text-teal-400">
            <CountUpNumber value={totalLiveBiomassKg} decimals={1} suffix=" kg" />
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Available for Harvest or Direct Sale
          </div>
        </Card>

        <Card hoverable>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Graded Chilled Stock (In Stock)</span>
            <Boxes className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-1 font-display text-xl font-extrabold text-emerald-700 tabular-nums dark:text-emerald-400">
            <CountUpNumber value={totalChilledStockKg} decimals={1} suffix=" kg" />
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {activeLotsCount} active lot(s) ready to sell
          </div>
        </Card>

        <Card hoverable>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Total Tracked Fish Stock</span>
            <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="mt-1 font-display text-xl font-extrabold text-slate-900 tabular-nums dark:text-white">
            <CountUpNumber value={totalTrackedStockKg} decimals={1} suffix=" kg" />
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {state.sales.length} sale(s) &amp; {state.harvestLots.length} lot(s) linked
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
              label: `Pond Stock by Species (${filteredPondRows.length})`,
              icon: <Sprout className="h-3.5 w-3.5" />,
            },
            {
              id: 'lots',
              label: `Graded Stock Lots (${filteredLots.length})`,
              icon: <Package className="h-3.5 w-3.5" />,
            },
            {
              id: 'ledger',
              label: `Stock Movement Ledger (${stockLedger.length})`,
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
              placeholder="Search pond, species, batch, lot..."
              className={`${INPUT_CLASS} pl-9`}
            />
          </div>
          <select
            value={speciesFilter}
            onChange={(e) => setSpeciesFilter(e.target.value)}
            aria-label="Filter stock by species"
            className={`${INPUT_CLASS} min-w-[170px] sm:w-auto`}
          >
            <option value="all">All Species</option>
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
                          {pond.status}
                        </Badge>
                      </div>
                      <div className="mt-0.5 text-slate-600 dark:text-slate-300">
                        Species: <strong>{pond.species}</strong> · {pond.unitType} · Batch:{' '}
                        <span className="font-mono font-semibold">{batch?.batchCode || 'Unstocked'}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-extrabold text-emerald-700 tabular-nums dark:text-emerald-400">
                        {estBiomassKg.toFixed(1)} kg
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Est. Live Biomass
                      </div>
                    </div>
                  </div>

                  {/* Stock Breakdown Metrics */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/70">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Live Fish</div>
                      <div className="font-bold text-slate-900 tabular-nums dark:text-white">
                        {formatNumber(pond.currentFish)}
                      </div>
                      <div className="text-[10px] text-slate-500 tabular-nums">
                        Avg {avgWeightG} g
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/70">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Chilled Stock</div>
                      <div className="font-bold text-blue-700 tabular-nums dark:text-sky-400">
                        {chilledRemainingKg.toFixed(1)} kg
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {row.lotCount} lot(s)
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/70">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Sold Total</div>
                      <div className="font-bold text-slate-900 tabular-nums dark:text-white">
                        {soldKgFromPond.toFixed(1)} kg
                      </div>
                      <div className="text-[10px] text-slate-500">Tracked out</div>
                    </div>
                  </div>

                  {/* Pond Capacity Bar */}
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Pond Stocking Capacity</span>
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
                          <Scale className="h-3.5 w-3.5" /> Harvest to Stock
                        </Button>
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => onQuickSalePond(pond.code)}
                        >
                          Sell from Pond <ArrowRight className="h-3.5 w-3.5" />
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
                        <Plus className="h-3.5 w-3.5" /> Stock Fingerlings / Fish Manually
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
              title="No graded fish stock lots found"
              description="Harvest from an active pond or create a manual stock lot to make graded fish ready for sale."
              action={
                <Button variant="primary" onClick={() => openManualModal('lot')}>
                  <Plus className="h-4 w-4" /> Create Manual Stock Lot
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
                            <Badge variant="info">{lot.source || 'Harvest'}</Badge>
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            Date: {lot.date} · Batch: {lot.batchCode} · Approved: {lot.approvedBy}
                          </div>
                        </div>
                        <Badge variant={remTotal > 0 ? 'success' : 'neutral'}>
                          {remTotal > 0 ? `${remTotal.toFixed(1)} kg in stock` : 'Sold Out'}
                        </Badge>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/70">
                          <div className="text-slate-500 dark:text-slate-400">Large</div>
                          <div className="font-bold text-slate-900 tabular-nums dark:text-white">
                            {lot.remainingKg.large.toFixed(1)} / {lot.grades.largeKg} kg
                          </div>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/70">
                          <div className="text-slate-500 dark:text-slate-400">Medium</div>
                          <div className="font-bold text-slate-900 tabular-nums dark:text-white">
                            {lot.remainingKg.medium.toFixed(1)} / {lot.grades.mediumKg} kg
                          </div>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/70">
                          <div className="text-slate-500 dark:text-slate-400">Small</div>
                          <div className="font-bold text-slate-900 tabular-nums dark:text-white">
                            {lot.remainingKg.small.toFixed(1)} / {lot.grades.smallKg} kg
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Initial lot weight: {origTotal.toFixed(1)} kg
                          {lot.notes ? ` · ${lot.notes}` : ''}
                        </span>
                        {remTotal > 0 && (
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => onQuickSaleLot(lot.id)}
                          >
                            Sell from Stock <ArrowRight className="h-3.5 w-3.5" />
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
                Fish Stock Traceability Ledger (Pond Stock → Harvest → Sales)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Every stocking event, harvest lot, manual adjustment, and sale is tracked here.
              </p>
            </div>
          </div>

          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="py-2.5">Date</th>
                <th className="py-2.5">Movement Type</th>
                <th className="py-2.5">Pond / Source</th>
                <th className="py-2.5">Species</th>
                <th className="py-2.5">Reference</th>
                <th className="py-2.5">Details</th>
                <th className="py-2.5 text-right">Stock Change</th>
                <th className="py-2.5 pl-3">Recorded By</th>
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
                      {entry.kind}
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
        title="Manual Fish Stock Entry"
        subtitle="Create a graded sellable fish stock lot or register/adjust live pond fish stock"
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
              Graded Stock Lot (Ready to Sell)
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
              Live Pond Fish Stock (Stocking)
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
                    Source Pond *
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
                        {p.code} — {p.species} ({formatNumber(p.currentFish)} fish)
                      </option>
                    ))}
                    <option value="EXTERNAL">External / Cold Room Opening Stock</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="ms-species"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Fish Species *
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
                    Batch / Reference Code
                  </label>
                  <input
                    id="ms-batch"
                    type="text"
                    value={lotBatchCode}
                    onChange={(e) => setLotBatchCode(e.target.value)}
                    placeholder="e.g. TIL-2026-001"
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
                    Deduct entered fish counts from {lotPondCode} live pond stock
                  </span>
                </label>
              )}

              <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60 sm:grid-cols-3">
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Large Grade</div>
                  <div>
                    <label htmlFor="ms-lg-kg" className="mb-1 block text-[11px] text-slate-500">
                      Weight (kg)
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
                      Fish Count
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
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Medium Grade</div>
                  <div>
                    <label htmlFor="ms-md-kg" className="mb-1 block text-[11px] text-slate-500">
                      Weight (kg)
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
                      Fish Count
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
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Small Grade</div>
                  <div>
                    <label htmlFor="ms-sm-kg" className="mb-1 block text-[11px] text-slate-500">
                      Weight (kg)
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
                      Fish Count
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
                    Stock Notes
                  </label>
                  <input
                    id="ms-notes"
                    type="text"
                    value={lotNotes}
                    onChange={(e) => setLotNotes(e.target.value)}
                    placeholder="e.g. Chilled storage box #2"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label
                    htmlFor="ms-pin"
                    className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Approval PIN (4 digits) *
                    </span>
                    <ValidCheck valid={/^\d{4}$/.test(pin)} />
                  </label>
                  <input
                    id="ms-pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="Enter 4-digit PIN"
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
                <CheckCircle2 className="h-4 w-4" /> Save Graded Fish Stock Lot
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
                    Target Pond *
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
                        {p.code} ({p.name}) — {formatNumber(p.currentFish)} / {formatNumber(p.maxCapacity)} fish
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="mp-species"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Species *
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
                    Fish Count to Add *
                  </label>
                  <input
                    id="mp-count"
                    type="number"
                    min="1"
                    placeholder="e.g. 5000"
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
                    Average Fish Weight (g) *
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
                    Source Hatchery
                  </label>
                  <input
                    id="mp-hatchery"
                    type="text"
                    value={pondHatchery}
                    onChange={(e) => setPondHatchery(e.target.value)}
                    placeholder="e.g. Pwani Fingerlings Ltd"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label
                    htmlFor="mp-supplier"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Supplier
                  </label>
                  <input
                    id="mp-supplier"
                    type="text"
                    value={pondSupplier}
                    onChange={(e) => setPondSupplier(e.target.value)}
                    placeholder="e.g. TAFIRI Certified Hatchery"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="mp-notes"
                  className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Notes ({todayIso()})
                </label>
                <input
                  id="mp-notes"
                  type="text"
                  value={pondNotes}
                  onChange={(e) => setPondNotes(e.target.value)}
                  placeholder="Optional stocking verification notes"
                  className={INPUT_CLASS}
                />
              </div>

              <Button variant="primary" size="lg" fullWidth onClick={handleSubmitManualPondStock}>
                <CheckCircle2 className="h-4 w-4" /> Register Live Pond Fish Stock
              </Button>
            </div>
          )}
        </div>
      </Sheet>
    </div>
  );
};
