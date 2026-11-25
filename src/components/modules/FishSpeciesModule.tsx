import React, { useState } from 'react';
import { Fish, ArrowRightLeft, Scale, Plus, CheckCircle2, ShieldAlert } from 'lucide-react';
import { AquacultureState } from '../../types/aquaculture';
import { formatNumber } from '../../utils/formatters';

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

  const selectedBatch = state.batches.find((b) => b.id === selectedBatchId) || state.batches[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Module B: Fish Batch Lifecycle, Transfers & Growth Intelligence
          </h2>
          <p className="text-xs text-slate-500">
            Every fingerling batch carries an immutable lifecycle ID. Transfers preserve original pond history and enforce capacity limits.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowStockForm(!showStockForm)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Stock New Fish Batch
        </button>
      </div>

      {statusMsg && (
        <div
          className={`rounded-xl border px-4 py-2.5 text-xs font-semibold ${
            statusMsg.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      {showStockForm && (
        <div className="rounded-xl border border-blue-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-bold text-slate-900">Register & Stock Fingerling Batch</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Species</label>
              <select
                value={stockSpecies}
                onChange={(e) => setStockSpecies(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              >
                {state.speciesCatalogue.map((s) => (
                  <option key={s.id} value={s.commonName}>
                    {s.commonName} ({s.scientificName})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Target Pond</label>
              <select
                value={stockPond}
                onChange={(e) => setStockPond(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              >
                {state.ponds.map((p) => (
                  <option key={p.id} value={p.code}>
                    {p.code} (Avail: {formatNumber(p.maxCapacity - p.currentFish)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Fingerling Quantity</label>
              <input
                type="number"
                value={stockCount}
                onChange={(e) => setStockCount(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Avg Initial Weight (g)</label>
              <input
                type="number"
                value={stockWeight}
                onChange={(e) => setStockWeight(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Source Hatchery</label>
              <input
                type="text"
                value={stockHatchery}
                onChange={(e) => setStockHatchery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Supplier</label>
              <input
                type="text"
                value={stockSupplier}
                onChange={(e) => setStockSupplier(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowStockForm(false)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="button"
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
                  setStatusMsg({ type: 'err', text: res.error || 'Capacity exceeded' });
                  return;
                }
                setStatusMsg({ type: 'ok', text: `Batch stocked into ${stockPond} with immutable ID.` });
                setShowStockForm(false);
              }}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Verify & Stock Batch
            </button>
          </div>
        </div>
      )}

      {/* Batch Cards & Selected Batch Lifecycle */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-2.5 lg:col-span-5">
          {state.batches.map((b) => {
            const survival = ((b.currentEstimatedFish / b.initialStocking) * 100).toFixed(1);
            const biomassKg = Math.round((b.currentEstimatedFish * b.currentAvgWeightG) / 1000);
            const isSel = selectedBatch?.id === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedBatchId(b.id)}
                className={`w-full rounded-xl border p-3.5 text-left transition-colors ${
                  isSel
                    ? 'border-blue-500 bg-blue-50/40'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Fish className="h-4 w-4 text-blue-600" />
                    <span className="font-mono text-xs font-bold text-slate-900">{b.batchCode}</span>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                      b.status === 'Harvest Ready'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {b.status}
                  </span>
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-800">
                  {b.species} <span className="italic font-normal text-slate-500">({b.scientificName})</span>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2 text-[11px] text-slate-600">
                  <div>
                    <div className="text-slate-400">Pond</div>
                    <div className="font-bold text-slate-800">{b.pondCode}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Est. Live</div>
                    <div className="font-bold text-slate-800 tabular-nums">{formatNumber(b.currentEstimatedFish)}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Survival</div>
                    <div className="font-bold text-emerald-700 tabular-nums">{survival}%</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Biomass</div>
                    <div className="font-bold text-slate-800 tabular-nums">{formatNumber(biomassKg)} kg</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Batch History + Sampling + Transfer */}
        {selectedBatch && (
          <div className="space-y-4 lg:col-span-7">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <div className="font-mono text-xs font-bold text-blue-700">{selectedBatch.batchCode}</div>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedBatch.species} — {selectedBatch.pondCode}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Hatchery: {selectedBatch.sourceHatchery} · Supplier: {selectedBatch.supplier} · Keeper:{' '}
                    {selectedBatch.responsibleKeeper}
                  </p>
                </div>
                <div className="text-right text-xs">
                  <div className="text-slate-500">Estimated vs Verified</div>
                  <div className="font-bold text-slate-900 tabular-nums">
                    {formatNumber(selectedBatch.currentEstimatedFish)} est /{' '}
                    {formatNumber(selectedBatch.physicallyVerifiedFish)} verified
                  </div>
                  <div className="text-[11px] text-slate-400">Last sampled {selectedBatch.lastVerifiedDate}</div>
                </div>
              </div>

              <h4 className="mt-3 mb-2 text-xs font-bold text-slate-700">Immutable Batch History</h4>
              <div className="space-y-2.5">
                {selectedBatch.history.map((ev) => (
                  <div key={ev.id} className="flex items-start gap-2.5 text-xs">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                      {ev.step}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{ev.title}</span>
                        <span className="text-[11px] text-slate-400">{ev.date}</span>
                      </div>
                      <div className="text-slate-600">{ev.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Growth Sampling & Pond-to-Pond Transfer */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-2.5 flex items-center gap-2">
                  <Scale className="h-4 w-4 text-emerald-600" />
                  <h4 className="text-xs font-bold text-slate-900">Record Growth Sample</h4>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600">Sample Size (fish)</label>
                    <input
                      type="number"
                      value={sampleSize}
                      onChange={(e) => setSampleSize(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600">Avg Weight (g)</label>
                    <input
                      type="number"
                      value={sampleAvgWeight}
                      onChange={(e) => setSampleAvgWeight(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs tabular-nums"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onRecordGrowthSample({
                      batchId: selectedBatch.id,
                      sampleSize,
                      avgWeightG: sampleAvgWeight,
                    });
                    setStatusMsg({
                      type: 'ok',
                      text: `Recorded growth sample for ${selectedBatch.batchCode}: ${sampleAvgWeight}g avg weight.`,
                    });
                  }}
                  className="mt-3 w-full rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Update Growth & Biomass
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-2.5 flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4 text-blue-600" />
                  <h4 className="text-xs font-bold text-slate-900">Pond-to-Pond Transfer (Preserves History)</h4>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600">Destination Pond</label>
                    <select
                      value={toPond}
                      onChange={(e) => setToPond(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
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
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600">Fish Count</label>
                    <input
                      type="number"
                      value={transferCount}
                      onChange={(e) => setTransferCount(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs tabular-nums"
                    />
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Reason"
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="password"
                    maxLength={4}
                    placeholder={`PIN (${state.activeUser.pin})`}
                    value={transferPin}
                    onChange={(e) => setTransferPin(e.target.value)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const res = onTransferBatch({
                      batchId: selectedBatch.id,
                      toPondCode: toPond,
                      fishCount: transferCount,
                      reason: transferReason,
                      pin: transferPin,
                    });
                    if (!res.ok) {
                      setStatusMsg({ type: 'err', text: res.error || 'Transfer rejected' });
                      return;
                    }
                    setTransferPin('');
                    setStatusMsg({
                      type: 'ok',
                      text: `Transferred ${transferCount} fish from ${selectedBatch.pondCode} to ${toPond}. History preserved.`,
                    });
                  }}
                  className="mt-2.5 w-full rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Approve & Execute Transfer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tanzania Species & FiRCIS Compliance Catalogue */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-2.5 text-sm font-bold text-slate-900">
          Tanzania Species & Fisheries (Aquaculture) Regulations 2024 Catalogue
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {state.speciesCatalogue.map((sp) => (
            <div key={sp.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">
                  {sp.commonName} ({sp.swahiliName})
                </span>
                {sp.fircisPermitted ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> FiRCIS OK
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                    <ShieldAlert className="h-3.5 w-3.5" /> Restricted
                  </span>
                )}
              </div>
              <div className="italic text-slate-500">{sp.scientificName}</div>
              <div className="mt-2 space-y-0.5 text-slate-600">
                <div>Temp: <strong>{sp.optimalTempRange}</strong> · DO Min: <strong>{sp.optimalDoMin} mg/L</strong></div>
                <div>pH: <strong>{sp.optimalPhRange}</strong> · Cycle: <strong>{sp.typicalCycleDays} days</strong></div>
              </div>
              <div className="mt-2 text-[11px] text-slate-500">{sp.regulatoryNote}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
