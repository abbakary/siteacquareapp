import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Fish, ArrowRightLeft, Scale, Plus, CheckCircle2, ShieldAlert } from 'lucide-react';
import { AquacultureState } from '../../types/aquaculture';
import { tDomain, tr } from '../../i18n/translations';
import { formatNumber } from '../../utils/formatters';
import {
  Badge,
  Button,
  Card,
  CountUpNumber,
  DURATIONS,
  EASE_OUT,
  FormError,
  getStaggerDelay,
  INPUT_CLASS,
  useLanguage,
} from '../../ui';

interface FishSpeciesModuleProps {
  state: AquacultureState;
  onStockNewBatch: (payload: {
    species: string;
    pondCode: string;
    count: number;
    avgInitialWeightG: number;
    sourceHatchery: string;
    supplier: string;
  }) => { ok: boolean; error?: string };
  onTransferBatch: (payload: {
    batchId: string;
    toPondCode: string;
    fishCount: number;
    reason: string;
    pin: string;
  }) => { ok: boolean; error?: string };
  onRecordGrowthSample: (payload: {
    batchId: string;
    sampleSize: number;
    avgWeightG: number;
  }) => void;
}

export const FishSpeciesModule: React.FC<FishSpeciesModuleProps> = ({
  state,
  onStockNewBatch,
  onTransferBatch,
  onRecordGrowthSample,
}) => {
  const { language } = useLanguage();
  const [selectedBatchId, setSelectedBatchId] = useState(state.batches[0]?.id || '');
  const [showStockForm, setShowStockForm] = useState(false);
  const [stockSpecies, setStockSpecies] = useState('Nile Tilapia');
  const [stockPond, setStockPond] = useState('POND-005');
  const [stockCount, setStockCount] = useState(5000);
  const [stockWeight, setStockWeight] = useState(10);
  const [stockHatchery, setStockHatchery] = useState('Bagamoyo Certified Tilapia Hatchery');
  const [stockSupplier, setStockSupplier] = useState('Pwani Fingerlings Ltd');

  // Transfer form
  const [toPond, setToPond] = useState('POND-005');
  const [transferCount, setTransferCount] = useState(1000);
  const [transferReason, setTransferReason] = useState('Grading & density optimization');
  const [transferPin, setTransferPin] = useState('');

  // Growth sample form
  const [sampleSize, setSampleSize] = useState(100);
  const [sampleAvgWeight, setSampleAvgWeight] = useState(280);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [errShake, setErrShake] = useState(0);

  const selectedBatch = state.batches.find((b) => b.id === selectedBatchId) || state.batches[0];

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {tr(
              language,
              'Moduli B: Mzunguko wa Maisha wa Kundi la Samaki, Uhamisho na Ukuaji',
              'Module B: Fish Batch Lifecycle, Transfers & Growth Intelligence'
            )}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {tr(
              language,
              'Kila kundi la vifaranga lina msimbo wa kudumu. Uhamisho huhifadhi historia ya bwawa la awali na kudhibiti uwezo wa bwawa.',
              'Every fingerling batch carries an immutable lifecycle ID. Transfers preserve original pond history and enforce capacity limits.'
            )}
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowStockForm(!showStockForm)}>
          <Plus className="h-4 w-4" /> {tr(language, 'Ingiza Kundi Jipya la Samaki', 'Stock New Fish Batch')}
        </Button>
      </Card>

      {statusMsg?.type === 'err' && <FormError message={statusMsg.text} shakeKey={errShake} />}
      {statusMsg?.type === 'ok' && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-300"
        >
          {statusMsg.text}
        </motion.div>
      )}

      <AnimatePresence>
        {showStockForm && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: DURATIONS.base, ease: EASE_OUT }}
          >
            <Card className="border-blue-200 dark:border-sky-800/60">
              <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
                {tr(language, 'Sajili na Pandikiza Kundi la Vifaranga', 'Register & Stock Fingerling Batch')}
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {tr(language, 'Aina ya Samaki', 'Species')}
                  </label>
                  <select
                    value={stockSpecies}
                    onChange={(e) => setStockSpecies(e.target.value)}
                    className={INPUT_CLASS}
                  >
                    {state.speciesCatalogue.map((s) => (
                      <option key={s.id} value={s.commonName}>
                        {language === 'sw' ? `${s.swahiliName} / ${s.commonName}` : s.commonName} ({s.scientificName})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {tr(language, 'Bwawa Lengwa', 'Target Pond')}
                  </label>
                  <select
                    value={stockPond}
                    onChange={(e) => setStockPond(e.target.value)}
                    className={INPUT_CLASS}
                  >
                    {state.ponds.map((p) => (
                      <option key={p.id} value={p.code}>
                        {p.code} ({tr(language, 'Nafasi', 'Avail')}: {formatNumber(p.maxCapacity - p.currentFish)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {tr(language, 'Idadi ya Vifaranga', 'Fingerling Quantity')}
                  </label>
                  <input
                    type="number"
                    value={stockCount}
                    onChange={(e) => setStockCount(Number(e.target.value))}
                    className={`${INPUT_CLASS} tabular-nums`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {tr(language, 'Uzito wa Awali (g)', 'Avg Initial Weight (g)')}
                  </label>
                  <input
                    type="number"
                    value={stockWeight}
                    onChange={(e) => setStockWeight(Number(e.target.value))}
                    className={`${INPUT_CLASS} tabular-nums`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {tr(language, 'Kitalu Chanzo (Hatchery)', 'Source Hatchery')}
                  </label>
                  <input
                    type="text"
                    value={stockHatchery}
                    onChange={(e) => setStockHatchery(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {tr(language, 'Msambazaji', 'Supplier')}
                  </label>
                  <input
                    type="text"
                    value={stockSupplier}
                    onChange={(e) => setStockSupplier(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowStockForm(false)}>
                  {tr(language, 'Ghairi', 'Cancel')}
                </Button>
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => {
                    const res = onStockNewBatch({
                      species: stockSpecies,
                      pondCode: stockPond,
                      count: stockCount,
                      avgInitialWeightG: stockWeight,
                      sourceHatchery: stockHatchery,
                      supplier: stockSupplier,
                    });
                    if (!res.ok) {
                      setStatusMsg({
                        type: 'err',
                        text: res.error || tr(language, 'Uwezo wa bwawa umezidi', 'Capacity exceeded'),
                      });
                      setErrShake((n) => n + 1);
                      return;
                    }
                    setStatusMsg({
                      type: 'ok',
                      text: tr(
                        language,
                        `Kundi limepandikizwa katika ${stockPond} kwa msimbo wa kudumu.`,
                        `Batch stocked into ${stockPond} with immutable ID.`
                      ),
                    });
                    setShowStockForm(false);
                  }}
                >
                  {tr(language, 'Hakiki na Pandikiza Kundi', 'Verify & Stock Batch')}
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Batch Cards & Selected Batch Lifecycle */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-2.5 lg:col-span-5">
          {state.batches.map((b, idx) => {
            const survival = (b.currentEstimatedFish / b.initialStocking) * 100;
            const biomassKg = Math.round((b.currentEstimatedFish * b.currentAvgWeightG) / 1000);
            const isSel = selectedBatch?.id === b.id;
            return (
              <motion.button
                key={b.id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: getStaggerDelay(idx), duration: DURATIONS.base, ease: EASE_OUT }}
                onClick={() => setSelectedBatchId(b.id)}
                className={`w-full rounded-[16px] border p-3.5 text-left transition-colors ${
                  isSel
                    ? 'border-blue-500 bg-blue-50/40 shadow-rest dark:border-sky-500 dark:bg-sky-950/30'
                    : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Fish className="h-4 w-4 text-blue-600 dark:text-sky-400" />
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                      {b.batchCode}
                    </span>
                  </div>
                  <Badge variant={b.status === 'Harvest Ready' ? 'success' : 'info'}>
                    {tDomain(language, b.status)}
                  </Badge>
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {b.species}{' '}
                  <span className="font-normal italic text-slate-500 dark:text-slate-400">
                    ({b.scientificName})
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                  <div>
                    <div className="text-slate-400 dark:text-slate-500">{tr(language, 'Bwawa', 'Pond')}</div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">{b.pondCode}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 dark:text-slate-500">{tr(language, 'Kadirio Hai', 'Est. Live')}</div>
                    <div className="font-bold text-slate-800 tabular-nums dark:text-slate-200">
                      <CountUpNumber
                        value={b.currentEstimatedFish}
                        formatter={(v) => formatNumber(v)}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 dark:text-slate-500">{tr(language, 'Uhai', 'Survival')}</div>
                    <div className="font-bold text-emerald-700 tabular-nums dark:text-emerald-400">
                      <CountUpNumber value={survival} decimals={1} suffix="%" />
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 dark:text-slate-500">{tr(language, 'Uzito Hai', 'Biomass')}</div>
                    <div className="font-bold text-slate-800 tabular-nums dark:text-slate-200">
                      <CountUpNumber
                        value={biomassKg}
                        formatter={(v) => formatNumber(v)}
                        suffix=" kg"
                      />
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Selected Batch History + Sampling + Transfer */}
        {selectedBatch && (
          <div className="space-y-4 lg:col-span-7">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                <div>
                  <div className="font-mono text-xs font-bold text-blue-700 dark:text-sky-400">
                    {selectedBatch.batchCode}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedBatch.species} — {selectedBatch.pondCode}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {tr(language, 'Kitalu', 'Hatchery')}: {selectedBatch.sourceHatchery} ·{' '}
                    {tr(language, 'Msambazaji', 'Supplier')}: {selectedBatch.supplier} ·{' '}
                    {tr(language, 'Msimamizi', 'Keeper')}: {selectedBatch.responsibleKeeper}
                  </p>
                </div>
                <div className="text-right text-xs">
                  <div className="text-slate-500 dark:text-slate-400">
                    {tr(language, 'Kadirio dhidi ya Uhakiki', 'Estimated vs Verified')}
                  </div>
                  <div className="font-bold text-slate-900 tabular-nums dark:text-white">
                    {formatNumber(selectedBatch.currentEstimatedFish)} {tr(language, 'kadirio', 'est')} /{' '}
                    {formatNumber(selectedBatch.physicallyVerifiedFish)} {tr(language, 'halisi', 'verified')}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500">
                    {tr(language, 'Sampuli ya mwisho', 'Last sampled')} {selectedBatch.lastVerifiedDate}
                  </div>
                </div>
              </div>

              <h4 className="mt-3 mb-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                {tr(language, 'Historia Isiyobadilika ya Kundi', 'Immutable Batch History')}
              </h4>
              <div className="space-y-2.5">
                {selectedBatch.history.map((ev) => (
                  <div key={ev.id} className="flex items-start gap-2.5 text-xs">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                      {ev.step}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white">{ev.title}</span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">{ev.date}</span>
                      </div>
                      <div className="text-slate-600 dark:text-slate-300">{ev.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Growth Sampling & Pond-to-Pond Transfer */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card>
                <div className="mb-2.5 flex items-center gap-2">
                  <Scale className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    {tr(language, 'Rekodi Sampuli ya Ukuaji', 'Record Growth Sample')}
                  </h4>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {tr(language, 'Ukubwa wa Sampuli (samaki)', 'Sample Size (fish)')}
                    </label>
                    <input
                      type="number"
                      value={sampleSize}
                      onChange={(e) => setSampleSize(Number(e.target.value))}
                      className={`${INPUT_CLASS} tabular-nums`}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {tr(language, 'Uzito Wastani (g)', 'Avg Weight (g)')}
                    </label>
                    <input
                      type="number"
                      value={sampleAvgWeight}
                      onChange={(e) => setSampleAvgWeight(Number(e.target.value))}
                      className={`${INPUT_CLASS} tabular-nums`}
                    />
                  </div>
                </div>
                <Button
                  variant="success"
                  size="sm"
                  fullWidth
                  className="mt-3"
                  onClick={() => {
                    onRecordGrowthSample({
                      batchId: selectedBatch.id,
                      sampleSize,
                      avgWeightG: sampleAvgWeight,
                    });
                    setStatusMsg({
                      type: 'ok',
                      text: tr(
                        language,
                        `Sampuli ya ukuaji imerekodiwa kwa ${selectedBatch.batchCode}: wastani ${sampleAvgWeight}g.`,
                        `Recorded growth sample for ${selectedBatch.batchCode}: ${sampleAvgWeight}g avg weight.`
                      ),
                    });
                  }}
                >
                  {tr(language, 'Sasisha Ukuaji na Uzito Hai', 'Update Growth & Biomass')}
                </Button>
              </Card>

              <Card>
                <div className="mb-2.5 flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4 text-blue-600 dark:text-sky-400" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    {tr(language, 'Uhamisho wa Bwawa kwa Bwawa (Huhifadhi Historia)', 'Pond-to-Pond Transfer (Preserves History)')}
                  </h4>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {tr(language, 'Bwawa Linakopelekwa', 'Destination Pond')}
                    </label>
                    <select
                      value={toPond}
                      onChange={(e) => setToPond(e.target.value)}
                      className={INPUT_CLASS}
                    >
                      {state.ponds
                        .filter((p) => p.code !== selectedBatch.pondCode)
                        .map((p) => (
                          <option key={p.id} value={p.code}>
                            {p.code}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {tr(language, 'Idadi ya Samaki', 'Fish Count')}
                    </label>
                    <input
                      type="number"
                      value={transferCount}
                      onChange={(e) => setTransferCount(Number(e.target.value))}
                      className={`${INPUT_CLASS} tabular-nums`}
                    />
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder={tr(language, 'Sababu', 'Reason')}
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    className={INPUT_CLASS}
                  />
                  <input
                    type="password"
                    maxLength={4}
                    placeholder={tr(language, 'Weka PIN ya namba 4', 'Enter 4-digit PIN')}
                    value={transferPin}
                    onChange={(e) => setTransferPin(e.target.value)}
                    className={`${INPUT_CLASS} font-mono`}
                  />
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
                  className="mt-2.5"
                  onClick={() => {
                    const res = onTransferBatch({
                      batchId: selectedBatch.id,
                      toPondCode: toPond,
                      fishCount: transferCount,
                      reason: transferReason,
                      pin: transferPin,
                    });
                    if (!res.ok) {
                      setStatusMsg({
                        type: 'err',
                        text: res.error || tr(language, 'Uhamisho umekataliwa', 'Transfer rejected'),
                      });
                      setErrShake((n) => n + 1);
                      return;
                    }
                    setTransferPin('');
                    setStatusMsg({
                      type: 'ok',
                      text: tr(
                        language,
                        `Samaki ${transferCount} wamehamishwa kutoka ${selectedBatch.pondCode} kwenda ${toPond}. Historia imehifadhiwa.`,
                        `Transferred ${transferCount} fish from ${selectedBatch.pondCode} to ${toPond}. History preserved.`
                      ),
                    });
                  }}
                >
                  {tr(language, 'Idhinisha na Tekeleza Uhamisho', 'Approve & Execute Transfer')}
                </Button>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Tanzania Species & FiRCIS Compliance Catalogue */}
      <Card>
        <h3 className="mb-2.5 text-sm font-bold text-slate-900 dark:text-white">
          {tr(
            language,
            'Katalogi ya Aina za Samaki na Kanuni za Uvuvi (Ufugaji Samaki) Tanzania 2024',
            'Tanzania Species & Fisheries (Aquaculture) Regulations 2024 Catalogue'
          )}
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {state.speciesCatalogue.map((sp) => (
            <div
              key={sp.id}
              className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/50"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white">
                  {sp.commonName} ({sp.swahiliName})
                </span>
                {sp.fircisPermitted ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {tr(language, 'FiRCIS Sawa', 'FiRCIS OK')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400">
                    <ShieldAlert className="h-3.5 w-3.5" /> {tr(language, 'Imedhibitiwa', 'Restricted')}
                  </span>
                )}
              </div>
              <div className="italic text-slate-500 dark:text-slate-400">{sp.scientificName}</div>
              <div className="mt-2 space-y-0.5 text-slate-600 dark:text-slate-300">
                <div>
                  {tr(language, 'Joto', 'Temp')}: <strong>{sp.optimalTempRange}</strong> · {tr(language, 'Kiwango cha Chini DO', 'DO Min')}:{' '}
                  <strong>{sp.optimalDoMin} mg/L</strong>
                </div>
                <div>
                  pH: <strong>{sp.optimalPhRange}</strong> · {tr(language, 'Mzunguko', 'Cycle')}:{' '}
                  <strong>
                    {sp.typicalCycleDays} {tr(language, 'siku', 'days')}
                  </strong>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                {sp.regulatoryNote}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
