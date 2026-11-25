import React, { lazy, Suspense, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Plus, QrCode, Wrench, ShieldCheck, Waves } from 'lucide-react';
import { AquacultureState, OperationType, Pond } from '../../types/aquaculture';
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
  MapSkeleton,
  PullToRefresh,
} from '../../ui';

const LeafletFarmMap = lazy(() =>
  import('../LeafletFarmMap').then((m) => ({ default: m.LeafletFarmMap }))
);

interface FarmPondsModuleProps {
  state: AquacultureState;
  selectedFarmId: string;
  onSelectPondQr: (pond: Pond) => void;
  onAddPond: (pond: {
    code: string;
    name: string;
    farmId: string;
    unitType: Pond['unitType'];
    operationStage: OperationType;
    species: string;
    maxCapacity: number;
    dimensions: string;
    waterCapacityM3: number;
  }) => { ok: boolean; error?: string };
  onToggleAerator: (pondId: string) => void;
}

export const FarmPondsModule: React.FC<FarmPondsModuleProps> = ({
  state,
  selectedFarmId,
  onSelectPondQr,
  onAddPond,
  onToggleAerator,
}) => {
  const [mapMode, setMapMode] = useState<'map' | 'satellite'>('satellite');
  const [showNewPond, setShowNewPond] = useState(false);
  const [code, setCode] = useState(`POND-00${state.ponds.length + 1}`);
  const [name, setName] = useState(`Pond ${state.ponds.length + 1}`);
  const [farmId, setFarmId] = useState(state.farms[0].id);
  const [unitType, setUnitType] = useState<Pond['unitType']>('Lined Pond');
  const [operationStage, setOperationStage] = useState<OperationType>('Grow-out Pond');
  const [species, setSpecies] = useState('Nile Tilapia');
  const [maxCapacity, setMaxCapacity] = useState(12000);
  const [dimensions] = useState('30m × 20m × 1.5m');
  const [waterCapacityM3, setWaterCapacityM3] = useState(900);
  const [formMsg, setFormMsg] = useState('');
  const [formShake, setFormShake] = useState(0);

  return (
    <PullToRefresh onRefresh={async () => {}}>
      <div className="space-y-4">
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Module A: Farm Identity, Ponds, Cages & Equipment
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Digital profiles, GPS mapping, water sources, capacity enforcement & QR pond codes across Tanzania operations.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setShowNewPond(!showNewPond)}>
            <Plus className="h-4 w-4" /> Register Pond / Cage / Tank
          </Button>
        </Card>

        <AnimatePresence>
          {showNewPond && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: DURATIONS.base, ease: EASE_OUT }}
            >
              <Card className="border-blue-200 dark:border-sky-800/60">
                <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
                  Register New Production Unit
                </h3>
                <FormError message={formMsg} shakeKey={formShake} className="mb-3" />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Pond Code
                    </label>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className={`${INPUT_CLASS} font-mono`}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Farm Branch
                    </label>
                    <select
                      value={farmId}
                      onChange={(e) => setFarmId(e.target.value)}
                      className={INPUT_CLASS}
                    >
                      {state.farms.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.region}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Unit Type
                    </label>
                    <select
                      value={unitType}
                      onChange={(e) => setUnitType(e.target.value as Pond['unitType'])}
                      className={INPUT_CLASS}
                    >
                      <option value="Earthen Pond">Earthen Pond</option>
                      <option value="Lined Pond">Lined Pond</option>
                      <option value="Concrete Tank">Concrete Tank</option>
                      <option value="Lake Cage">Lake Cage</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Operation Stage
                    </label>
                    <select
                      value={operationStage}
                      onChange={(e) => setOperationStage(e.target.value as OperationType)}
                      className={INPUT_CLASS}
                    >
                      <option value="Hatchery">Hatchery</option>
                      <option value="Nursery">Nursery</option>
                      <option value="Grow-out Pond">Grow-out Pond</option>
                      <option value="Cage Farming">Cage Farming</option>
                      <option value="Tank Farming">Tank Farming</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Primary Species
                    </label>
                    <select
                      value={species}
                      onChange={(e) => setSpecies(e.target.value)}
                      className={INPUT_CLASS}
                    >
                      {state.speciesCatalogue.map((s) => (
                        <option key={s.id} value={s.commonName}>
                          {s.commonName} ({s.swahiliName})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Max Capacity (fish)
                    </label>
                    <input
                      type="number"
                      value={maxCapacity}
                      onChange={(e) => setMaxCapacity(Number(e.target.value))}
                      className={`${INPUT_CLASS} tabular-nums`}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Volume (m³)
                    </label>
                    <input
                      type="number"
                      value={waterCapacityM3}
                      onChange={(e) => setWaterCapacityM3(Number(e.target.value))}
                      className={`${INPUT_CLASS} tabular-nums`}
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setShowNewPond(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => {
                      const res = onAddPond({
                        code,
                        name,
                        farmId,
                        unitType,
                        operationStage,
                        species,
                        maxCapacity,
                        dimensions,
                        waterCapacityM3,
                      });
                      if (!res.ok) {
                        setFormMsg(res.error || 'Could not add pond');
                        setFormShake((n) => n + 1);
                        return;
                      }
                      setShowNewPond(false);
                      setFormMsg('');
                    }}
                  >
                    Save Production Unit
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Farms & Interactive Leaflet Map */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-5">
            {state.farms.map((farm, idx) => (
              <motion.div
                key={farm.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: getStaggerDelay(idx), duration: DURATIONS.base, ease: EASE_OUT }}
              >
                <Card>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">{farm.name}</div>
                      <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        GPS: {farm.gps[0].toFixed(4)}, {farm.gps[1].toFixed(4)} · Permit: {farm.fircisPermitNo}
                      </div>
                    </div>
                    <Badge variant="success">{farm.region}</Badge>
                  </div>
                  <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">Water Source:</span>{' '}
                      {farm.waterSource}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">Drainage:</span>{' '}
                      {farm.drainageSystem}
                    </div>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {farm.operationTypes.map((op) => (
                      <span
                        key={op}
                        className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {op}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      <Wrench className="h-3.5 w-3.5 text-blue-600 dark:text-sky-400" /> Registered Farm Equipment
                    </div>
                    <div className="space-y-1">
                      {farm.equipment.map((eq) => (
                        <div key={eq.id} className="flex items-center justify-between text-xs">
                          <span className="text-slate-700 dark:text-slate-300">{eq.name}</span>
                          <span
                            className={`font-semibold ${
                              eq.status === 'Operational'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {eq.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          <Card className="lg:col-span-7">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  GPS Pond & Cage Geolocation (Leaflet)
                </h3>
              </div>
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setMapMode('map')}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                    mapMode === 'map'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Map
                </button>
                <button
                  type="button"
                  onClick={() => setMapMode('satellite')}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                    mapMode === 'satellite'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Satellite
                </button>
              </div>
            </div>
            <Suspense fallback={<MapSkeleton heightClass="h-[370px]" />}>
              <LeafletFarmMap
                ponds={state.ponds}
                farms={state.farms}
                selectedFarmId={selectedFarmId}
                mapMode={mapMode}
                heightClass="h-[370px]"
                onSelectPond={onSelectPondQr}
              />
            </Suspense>
            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
              Click any pond marker (P1–P5) to inspect live stocking capacity, water quality, and QR code token.
            </p>
          </Card>
        </div>

        {/* Live Pond Status Strip with subtle water shimmer */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {state.ponds.map((pond, idx) => {
            const fillPct = Math.min(100, Math.round((pond.currentFish / Math.max(1, pond.maxCapacity)) * 100));
            return (
              <motion.div
                key={pond.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: getStaggerDelay(idx), duration: DURATIONS.base, ease: EASE_OUT }}
              >
                <Card
                  hoverable
                  pondWaveStatus={pond.status === 'Harvest Ready' ? 'Healthy' : pond.status}
                  className="cursor-pointer p-3.5 text-xs"
                  onClick={() => onSelectPondQr(pond)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{pond.code}</span>
                    <Badge
                      variant={
                        pond.status === 'Healthy'
                          ? 'success'
                          : pond.status === 'Attention'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {pond.status}
                    </Badge>
                  </div>
                  <div className="mt-1 font-semibold text-slate-700 dark:text-slate-300">
                    {pond.name} · {pond.species}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                    <CountUpNumber value={pond.currentFish} formatter={(v) => formatNumber(v)} /> /{' '}
                    {formatNumber(pond.maxCapacity)} fish
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <motion.div
                      className={`h-full rounded-full ${
                        pond.status === 'Attention'
                          ? 'bg-amber-500'
                          : pond.status === 'Preparing'
                            ? 'bg-slate-400'
                            : 'bg-emerald-500'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${fillPct}%` }}
                      transition={{ duration: 0.5, ease: EASE_OUT }}
                    />
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Ponds Directory Table */}
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Waves className="h-4 w-4 text-blue-600 dark:text-sky-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Digital Pond, Tank & Cage Registry
              </h3>
            </div>
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" /> Over-stocking capacity lock active
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="py-2">Pond</th>
                  <th className="py-2">Type & Stage</th>
                  <th className="py-2">Species</th>
                  <th className="py-2 text-right">Current Fish</th>
                  <th className="py-2 text-right">Max Capacity</th>
                  <th className="py-2 pl-3">Dimensions / Vol</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Aerator Relay</th>
                  <th className="py-2 text-right">QR Identity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {state.ponds.map((pond) => (
                  <tr key={pond.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-2.5 font-bold text-slate-900 dark:text-white">
                      {pond.code}{' '}
                      <span className="font-normal text-slate-500 dark:text-slate-400">
                        ({pond.name})
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-600 dark:text-slate-300">
                      {pond.unitType} · {pond.operationStage}
                    </td>
                    <td className="py-2.5 font-medium text-slate-800 dark:text-slate-200">
                      {pond.species}
                    </td>
                    <td className="py-2.5 text-right font-bold text-slate-900 tabular-nums dark:text-white">
                      {formatNumber(pond.currentFish)}
                    </td>
                    <td className="py-2.5 text-right text-slate-600 tabular-nums dark:text-slate-400">
                      {formatNumber(pond.maxCapacity)}
                    </td>
                    <td className="py-2.5 pl-3 text-slate-500 dark:text-slate-400">
                      {pond.dimensions} ({pond.waterCapacityM3} m³)
                    </td>
                    <td className="py-2.5">
                      <Badge
                        variant={
                          pond.status === 'Healthy'
                            ? 'success'
                            : pond.status === 'Attention'
                              ? 'warning'
                              : 'neutral'
                        }
                      >
                        {pond.status}
                      </Badge>
                    </td>
                    <td className="py-2.5">
                      <button
                        type="button"
                        onClick={() => onToggleAerator(pond.id)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                          pond.aeratorRelayOn
                            ? 'bg-sky-600 text-white'
                            : 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {pond.aeratorRelayOn ? 'Relay ON' : 'Standby'}
                      </button>
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectPondQr(pond)}
                        className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 dark:border-sky-800/60 dark:bg-sky-950/60 dark:text-sky-300 dark:hover:bg-sky-900/60"
                      >
                        <QrCode className="h-3.5 w-3.5" /> QR Profile
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </PullToRefresh>
  );
};
