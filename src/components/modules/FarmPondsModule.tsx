import React, { useState } from 'react';
import { MapPin, Plus, QrCode, Wrench, ShieldCheck, Waves } from 'lucide-react';
import { AquacultureState, OperationType, Pond } from '../../types/aquaculture';
import { LeafletFarmMap } from '../LeafletFarmMap';
import { formatNumber } from '../../utils/formatters';

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
  const [dimensions, setDimensions] = useState('30m × 20m × 1.5m');
  const [waterCapacityM3, setWaterCapacityM3] = useState(900);
  const [formMsg, setFormMsg] = useState('');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Module A: Farm Identity, Ponds, Cages & Equipment</h2>
          <p className="text-xs text-slate-500">
            Digital profiles, GPS mapping, water sources, capacity enforcement & QR pond codes across Tanzania operations.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewPond(!showNewPond)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Register Pond / Cage / Tank
        </button>
      </div>

      {showNewPond && (
        <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-xs">
          <h3 className="mb-3 text-sm font-bold text-slate-900">Register New Production Unit</h3>
          {formMsg && (
            <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">{formMsg}</div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Pond Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-mono"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Farm Branch</label>
              <select
                value={farmId}
                onChange={(e) => setFarmId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
              >
                {state.farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.region}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Unit Type</label>
              <select
                value={unitType}
                onChange={(e) => setUnitType(e.target.value as Pond['unitType'])}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
              >
                <option value="Earthen Pond">Earthen Pond</option>
                <option value="Lined Pond">Lined Pond</option>
                <option value="Concrete Tank">Concrete Tank</option>
                <option value="Lake Cage">Lake Cage</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Operation Stage</label>
              <select
                value={operationStage}
                onChange={(e) => setOperationStage(e.target.value as OperationType)}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
              >
                <option value="Hatchery">Hatchery</option>
                <option value="Nursery">Nursery</option>
                <option value="Grow-out Pond">Grow-out Pond</option>
                <option value="Cage Farming">Cage Farming</option>
                <option value="Tank Farming">Tank Farming</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Primary Species</label>
              <select
                value={species}
                onChange={(e) => setSpecies(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
              >
                {state.speciesCatalogue.map((s) => (
                  <option key={s.id} value={s.commonName}>
                    {s.commonName} ({s.swahiliName})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Max Capacity (fish)</label>
              <input
                type="number"
                value={maxCapacity}
                onChange={(e) => setMaxCapacity(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Volume (m³)</label>
              <input
                type="number"
                value={waterCapacityM3}
                onChange={(e) => setWaterCapacityM3(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs tabular-nums"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNewPond(false)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
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
                  return;
                }
                setShowNewPond(false);
                setFormMsg('');
              }}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Save Production Unit
            </button>
          </div>
        </div>
      )}

      {/* Farms & Interactive Leaflet Map */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-5">
          {state.farms.map((farm) => (
            <div key={farm.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-slate-900">{farm.name}</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    GPS: {farm.gps[0].toFixed(4)}, {farm.gps[1].toFixed(4)} · Permit: {farm.fircisPermitNo}
                  </div>
                </div>
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  {farm.region}
                </span>
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div>
                  <span className="font-semibold text-slate-800">Water Source:</span> {farm.waterSource}
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Drainage:</span> {farm.drainageSystem}
                </div>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {farm.operationTypes.map((op) => (
                  <span key={op} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                    {op}
                  </span>
                ))}
              </div>
              <div className="mt-3 border-t border-slate-100 pt-2.5">
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                  <Wrench className="h-3.5 w-3.5 text-blue-600" /> Registered Farm Equipment
                </div>
                <div className="space-y-1">
                  {farm.equipment.map((eq) => (
                    <div key={eq.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-700">{eq.name}</span>
                      <span
                        className={`font-semibold ${
                          eq.status === 'Operational' ? 'text-emerald-600' : 'text-amber-600'
                        }`}
                      >
                        {eq.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-7">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">GPS Pond & Cage Geolocation (Leaflet)</h3>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => setMapMode('map')}
                className={`rounded-md px-3 py-1 text-xs font-semibold ${
                  mapMode === 'map' ? 'bg-blue-600 text-white' : 'text-slate-600'
                }`}
              >
                Map
              </button>
              <button
                type="button"
                onClick={() => setMapMode('satellite')}
                className={`rounded-md px-3 py-1 text-xs font-semibold ${
                  mapMode === 'satellite' ? 'bg-blue-600 text-white' : 'text-slate-600'
                }`}
              >
                Satellite
              </button>
            </div>
          </div>
          <LeafletFarmMap
            ponds={state.ponds}
            farms={state.farms}
            selectedFarmId={selectedFarmId}
            mapMode={mapMode}
            heightClass="h-[370px]"
            onSelectPond={onSelectPondQr}
          />
          <p className="mt-2 text-[11px] text-slate-500">
            Click any pond marker (P1–P5) to inspect live stocking capacity, water quality, and QR code token.
          </p>
        </div>
      </div>

      {/* Ponds Directory Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Waves className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Digital Pond, Tank & Cage Registry</h3>
          </div>
          <span className="flex items-center gap-1 text-xs text-emerald-700 font-medium">
            <ShieldCheck className="h-4 w-4" /> Over-stocking capacity lock active
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
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
            <tbody className="divide-y divide-slate-100">
              {state.ponds.map((pond) => (
                <tr key={pond.id} className="hover:bg-slate-50">
                  <td className="py-2.5 font-bold text-slate-900">
                    {pond.code} <span className="font-normal text-slate-500">({pond.name})</span>
                  </td>
                  <td className="py-2.5 text-slate-600">
                    {pond.unitType} · {pond.operationStage}
                  </td>
                  <td className="py-2.5 font-medium text-slate-800">{pond.species}</td>
                  <td className="py-2.5 text-right font-bold text-slate-900 tabular-nums">
                    {formatNumber(pond.currentFish)}
                  </td>
                  <td className="py-2.5 text-right text-slate-600 tabular-nums">
                    {formatNumber(pond.maxCapacity)}
                  </td>
                  <td className="py-2.5 pl-3 text-slate-500">
                    {pond.dimensions} ({pond.waterCapacityM3} m³)
                  </td>
                  <td className="py-2.5">
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                        pond.status === 'Healthy'
                          ? 'bg-emerald-50 text-emerald-700'
                          : pond.status === 'Attention'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {pond.status}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <button
                      type="button"
                      onClick={() => onToggleAerator(pond.id)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                        pond.aeratorRelayOn
                          ? 'bg-sky-600 text-white'
                          : 'border border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      {pond.aeratorRelayOn ? 'Relay ON' : 'Standby'}
                    </button>
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => onSelectPondQr(pond)}
                      className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      <QrCode className="h-3.5 w-3.5" /> QR Profile
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
