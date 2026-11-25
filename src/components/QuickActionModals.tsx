import React, { useState } from 'react';
import {
  X,
  Utensils,
  PackagePlus,
  Droplets,
  AlertTriangle,
  Scale,
  FileDown,
  Mic,
  ShieldCheck,
  QrCode,
} from 'lucide-react';
import { AquacultureState, Pond } from '../types/aquaculture';
import { exportToCsv, formatTzs, todayIso } from '../utils/formatters';
import { getPermissions } from '../utils/rbac';

export type QuickActionType =
  | 'feeding'
  | 'inventory'
  | 'water'
  | 'mortality'
  | 'harvest'
  | 'report'
  | null;

interface QuickActionModalsProps {
  activeModal: QuickActionType;
  state: AquacultureState;
  onClose: () => void;
  onRecordFeeding: (payload: {
    pondCode: string;
    batchCode: string;
    feedType: string;
    approvedKg: number;
    issuedKg: number;
    actualFedKg: number;
    pin: string;
  }) => { ok: boolean; error?: string };
  onAddInventory: (payload: {
    name: string;
    category: 'Feed' | 'Fingerlings' | 'Medicine' | 'Fuel' | 'Equipment';
    quantity: number;
    unit: string;
    unitCostTzs: number;
    supplier: string;
  }) => void;
  onRecordWater: (payload: {
    pondCode: string;
    ph: number;
    doVal: number;
    temp: number;
    ammonia: number;
    nitrite: number;
    sourceLevel: 'Manual (Mobile)' | 'Bluetooth Meter' | 'IoT ESP32 Sensor';
    instrument: string;
  }) => void;
  onReportMortality: (payload: {
    pondCode: string;
    deadCount: number;
    affectedCount: number;
    symptoms: string;
    pin: string;
  }) => { ok: boolean; error?: string };
  onRecordHarvest: (payload: {
    pondCode: string;
    largeCount: number;
    largeKg: number;
    mediumCount: number;
    mediumKg: number;
    smallCount: number;
    smallKg: number;
    customerName: string;
    pricePerKgTzs: number;
    paidAmountTzs: number;
    pin: string;
  }) => { ok: boolean; error?: string };
}

export const QuickActionModals: React.FC<QuickActionModalsProps> = ({
  activeModal,
  state,
  onClose,
  onRecordFeeding,
  onAddInventory,
  onRecordWater,
  onReportMortality,
  onRecordHarvest,
}) => {
  const perms = getPermissions(state.activeUser.role);

  // Feeding state
  const [feedPond, setFeedPond] = useState('POND-001');
  const [feedType, setFeedType] = useState('Grower Pellets 3mm');
  const [approvedKg, setApprovedKg] = useState(13.5);
  const [issuedKg, setIssuedKg] = useState(13.5);
  const [actualFedKg, setActualFedKg] = useState(13.5);
  const [swahiliVoiceText, setSwahiliVoiceText] = useState(
    'Leo nimewapa samaki kilo kumi za chakula kwenye bwawa la kwanza'
  );
  const [voiceParsing, setVoiceParsing] = useState(false);

  // Inventory state
  const [invName, setInvName] = useState('Fish Feed (Grower)');
  const [invCategory, setInvCategory] = useState<'Feed' | 'Fingerlings' | 'Medicine' | 'Fuel' | 'Equipment'>('Feed');
  const [invQty, setInvQty] = useState(250);
  const [invUnit, setInvUnit] = useState('kg');
  const [invCost, setInvCost] = useState(2800);
  const [invSupplier, setInvSupplier] = useState('AquaFeed Ltd');

  // Water state
  const [wqPond, setWqPond] = useState('POND-001');
  const [wqPh, setWqPh] = useState(7.2);
  const [wqDo, setWqDo] = useState(6.1);
  const [wqTemp, setWqTemp] = useState(28.0);
  const [wqNh3, setWqNh3] = useState(0.02);
  const [wqNo2, setWqNo2] = useState(0.01);
  const [wqSource, setWqSource] = useState<'Manual (Mobile)' | 'Bluetooth Meter' | 'IoT ESP32 Sensor'>(
    'Manual (Mobile)'
  );

  // Mortality state
  const [mortPond, setMortPond] = useState('POND-003');
  const [deadCount, setDeadCount] = useState(5);
  const [affectedCount, setAffectedCount] = useState(12);
  const [symptoms, setSymptoms] = useState('Reduced feeding response near inlet');

  // Harvest state
  const [harvPond, setHarvPond] = useState('POND-002');
  const [largeCount, setLargeCount] = useState(500);
  const [largeKg, setLargeKg] = useState(350);
  const [mediumCount, setMediumCount] = useState(300);
  const [mediumKg, setMediumKg] = useState(150);
  const [smallCount, setSmallCount] = useState(100);
  const [smallKg, setSmallKg] = useState(30);
  const [customerName, setCustomerName] = useState('Kariakoo Fresh Fish Market Ltd');
  const [pricePerKg, setPricePerKg] = useState(8500);
  const [paidAmount, setPaidAmount] = useState(4505000);

  // Shared PIN signature + error
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!activeModal) return null;

  const handleParseSwahili = async () => {
    setVoiceParsing(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/ai/parse-swahili-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: swahiliVoiceText }),
      });
      const data = await res.json();
      if (data.pondCode) setFeedPond(data.pondCode);
      if (typeof data.feedKg === 'number') {
        setActualFedKg(data.feedKg);
      }
      if (data.feedType) setFeedType(data.feedType);
    } catch {
      setErrorMsg('Could not parse Swahili voice transcript.');
    } finally {
      setVoiceParsing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            {activeModal === 'feeding' && <Utensils className="h-5 w-5 text-blue-600" />}
            {activeModal === 'inventory' && <PackagePlus className="h-5 w-5 text-teal-600" />}
            {activeModal === 'water' && <Droplets className="h-5 w-5 text-sky-600" />}
            {activeModal === 'mortality' && <AlertTriangle className="h-5 w-5 text-red-600" />}
            {activeModal === 'harvest' && <Scale className="h-5 w-5 text-orange-600" />}
            {activeModal === 'report' && <FileDown className="h-5 w-5 text-indigo-600" />}
            <h3 className="text-base font-bold text-slate-900">
              {activeModal === 'feeding' && 'Record Feeding & Feed Reconciliation'}
              {activeModal === 'inventory' && 'Add Inventory Stock'}
              {activeModal === 'water' && 'Record Water Quality Reading'}
              {activeModal === 'mortality' && 'Report Fish Mortality (Immutable Log)'}
              {activeModal === 'harvest' && 'Plan & Record Fish Harvest'}
              {activeModal === 'report' && 'Generate Tanzania Traceability & FiRCIS Reports'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5 text-sm">
          {errorMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {errorMsg}
            </div>
          )}

          {/* FEEDING FORM */}
          {activeModal === 'feeding' && (
            <div className="space-y-3">
              {!perms.canRecordFeeding && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Role notice: Current role ({state.activeUser.roleLabel}) typically views or approves plans. Switch to Keeper or Farm Manager in the sidebar to record field feeding.
                </div>
              )}

              {/* Swahili Voice Reporting Box */}
              <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-sky-900">
                    <Mic className="h-3.5 w-3.5 text-sky-600" /> Swahili Voice / Field Report Parser
                  </span>
                  <button
                    type="button"
                    onClick={handleParseSwahili}
                    disabled={voiceParsing}
                    className="rounded-md bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                  >
                    {voiceParsing ? 'Parsing...' : 'Auto-Fill from Swahili'}
                  </button>
                </div>
                <input
                  type="text"
                  value={swahiliVoiceText}
                  onChange={(e) => setSwahiliVoiceText(e.target.value)}
                  className="w-full rounded-lg border border-sky-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Pond</label>
                  <select
                    value={feedPond}
                    onChange={(e) => setFeedPond(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  >
                    {state.ponds.map((p) => (
                      <option key={p.id} value={p.code}>
                        {p.code} — {p.species}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Feed Type</label>
                  <input
                    type="text"
                    value={feedType}
                    onChange={(e) => setFeedType(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Approved (kg)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={approvedKg}
                    onChange={(e) => setApprovedKg(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Store Issued (kg)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={issuedKg}
                    onChange={(e) => setIssuedKg(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Actual Fed (kg)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={actualFedKg}
                    onChange={(e) => setActualFedKg(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs tabular-nums"
                  />
                </div>
              </div>

              {Math.abs(issuedKg - actualFedKg) > 0.1 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Variance Alert: Issued {issuedKg} kg vs Actual Fed {actualFedKg} kg (Diff:{' '}
                  <strong>{Math.abs(issuedKg - actualFedKg).toFixed(1)} kg</strong>) will be flagged for Manager investigation.
                </div>
              )}

              <div>
                <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-600">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  Digital PIN Signature (Your PIN: <span className="font-mono">{state.activeUser.pin}</span>)
                </label>
                <input
                  type="password"
                  maxLength={4}
                  placeholder="Enter 4-digit PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono"
                />
              </div>

              <button
                type="button"
                disabled={!perms.canRecordFeeding}
                onClick={() => {
                  const batch = state.batches.find((b) => b.pondCode === feedPond);
                  const res = onRecordFeeding({
                    pondCode: feedPond,
                    batchCode: batch?.batchCode || 'UNASSIGNED',
                    feedType,
                    approvedKg,
                    issuedKg,
                    actualFedKg,
                    pin,
                  });
                  if (!res.ok) {
                    setErrorMsg(res.error || 'PIN verification failed');
                    return;
                  }
                  onClose();
                }}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Submit & Sign Feeding Log
              </button>
            </div>
          )}

          {/* INVENTORY FORM */}
          {activeModal === 'inventory' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Item Name</label>
                  <input
                    type="text"
                    value={invName}
                    onChange={(e) => setInvName(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Category</label>
                  <select
                    value={invCategory}
                    onChange={(e) =>
                      setInvCategory(e.target.value as 'Feed' | 'Fingerlings' | 'Medicine' | 'Fuel' | 'Equipment')
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  >
                    <option value="Feed">Feed</option>
                    <option value="Fingerlings">Fingerlings</option>
                    <option value="Medicine">Medicine</option>
                    <option value="Fuel">Fuel</option>
                    <option value="Equipment">Equipment</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Quantity Added</label>
                  <input
                    type="number"
                    value={invQty}
                    onChange={(e) => setInvQty(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Unit</label>
                  <input
                    type="text"
                    value={invUnit}
                    onChange={(e) => setInvUnit(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Unit Cost (TZS)</label>
                  <input
                    type="number"
                    value={invCost}
                    onChange={(e) => setInvCost(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs tabular-nums"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Supplier</label>
                <input
                  type="text"
                  value={invSupplier}
                  onChange={(e) => setInvSupplier(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
              <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700">
                Total Purchase Value: <strong className="tabular-nums">{formatTzs(invQty * invCost)}</strong>
              </div>
              <button
                type="button"
                onClick={() => {
                  onAddInventory({
                    name: invName,
                    category: invCategory,
                    quantity: invQty,
                    unit: invUnit,
                    unitCostTzs: invCost,
                    supplier: invSupplier,
                  });
                  onClose();
                }}
                className="w-full rounded-lg bg-teal-600 py-2.5 text-xs font-semibold text-white hover:bg-teal-700"
              >
                Add Stock & Record Expense
              </button>
            </div>
          )}

          {/* WATER QUALITY FORM */}
          {activeModal === 'water' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Pond</label>
                  <select
                    value={wqPond}
                    onChange={(e) => setWqPond(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  >
                    {state.ponds.map((p) => (
                      <option key={p.id} value={p.code}>
                        {p.code} — {p.species}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Monitoring Level</label>
                  <select
                    value={wqSource}
                    onChange={(e) =>
                      setWqSource(
                        e.target.value as 'Manual (Mobile)' | 'Bluetooth Meter' | 'IoT ESP32 Sensor'
                      )
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  >
                    <option value="Manual (Mobile)">Level 1: Manual Mobile Entry</option>
                    <option value="Bluetooth Meter">Level 2: Bluetooth Water Meter</option>
                    <option value="IoT ESP32 Sensor">Level 3: ESP32 IoT Sensor</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-600">pH</label>
                  <input
                    type="number"
                    step="0.1"
                    value={wqPh}
                    onChange={(e) => setWqPh(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-600">DO (mg/L)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={wqDo}
                    onChange={(e) => setWqDo(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-600">Temp (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={wqTemp}
                    onChange={(e) => setWqTemp(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-600">NH3</label>
                  <input
                    type="number"
                    step="0.01"
                    value={wqNh3}
                    onChange={(e) => setWqNh3(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-600">NO2</label>
                  <input
                    type="number"
                    step="0.01"
                    value={wqNo2}
                    onChange={(e) => setWqNo2(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs tabular-nums"
                  />
                </div>
              </div>
              {wqDo < 4.5 && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  Low Dissolved Oxygen (&lt; 4.5 mg/L) detected: System will automatically trigger the Pond Aerator Relay and notify the Technician!
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  onRecordWater({
                    pondCode: wqPond,
                    ph: wqPh,
                    doVal: wqDo,
                    temp: wqTemp,
                    ammonia: wqNh3,
                    nitrite: wqNo2,
                    sourceLevel: wqSource,
                    instrument:
                      wqSource === 'IoT ESP32 Sensor'
                        ? 'ESP32-DO-pH Node'
                        : wqSource === 'Bluetooth Meter'
                          ? 'Hanna HI98194 BT'
                          : 'Mobile Test Kit',
                  });
                  onClose();
                }}
                className="w-full rounded-lg bg-sky-600 py-2.5 text-xs font-semibold text-white hover:bg-sky-700"
              >
                Save Water Quality Measurement
              </button>
            </div>
          )}

          {/* MORTALITY FORM */}
          {activeModal === 'mortality' && (
            <div className="space-y-3">
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Accountability Rule: Mortality records are immutable once submitted. Keepers cannot delete records or self-approve medication.
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Pond</label>
                  <select
                    value={mortPond}
                    onChange={(e) => setMortPond(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs"
                  >
                    {state.ponds.map((p) => (
                      <option key={p.id} value={p.code}>
                        {p.code}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Dead Fish</label>
                  <input
                    type="number"
                    min={1}
                    value={deadCount}
                    onChange={(e) => setDeadCount(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Affected Fish</label>
                  <input
                    type="number"
                    min={0}
                    value={affectedCount}
                    onChange={(e) => setAffectedCount(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs tabular-nums"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Observed Symptoms</label>
                <textarea
                  rows={2}
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Digital PIN Signature (PIN: <span className="font-mono">{state.activeUser.pin}</span>)
                </label>
                <input
                  type="password"
                  maxLength={4}
                  placeholder="Enter 4-digit PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono"
                />
              </div>
              <button
                type="button"
                disabled={!perms.canReportMortality}
                onClick={() => {
                  const res = onReportMortality({
                    pondCode: mortPond,
                    deadCount,
                    affectedCount,
                    symptoms,
                    pin,
                  });
                  if (!res.ok) {
                    setErrorMsg(res.error || 'Unable to submit mortality');
                    return;
                  }
                  onClose();
                }}
                className="w-full rounded-lg bg-red-600 py-2.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Log Mortality & Alert Technician
              </button>
            </div>
          )}

          {/* HARVEST FORM */}
          {activeModal === 'harvest' && (
            <div className="space-y-3">
              {!perms.canApproveHarvest && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Only Farm Manager or Owner can approve & finalize harvests. Switch role in the sidebar to test approval.
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Pond</label>
                  <select
                    value={harvPond}
                    onChange={(e) => setHarvPond(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  >
                    {state.ponds
                      .filter((p) => p.currentFish > 0)
                      .map((p) => (
                        <option key={p.id} value={p.code}>
                          {p.code} ({p.species} — {p.currentFish.toLocaleString()} fish)
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Customer / Buyer</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div>
                  <span className="text-[11px] font-bold text-slate-700">Large Grade</span>
                  <input
                    type="number"
                    value={largeCount}
                    onChange={(e) => setLargeCount(Number(e.target.value))}
                    className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs tabular-nums"
                    placeholder="Qty"
                  />
                  <input
                    type="number"
                    value={largeKg}
                    onChange={(e) => setLargeKg(Number(e.target.value))}
                    className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs tabular-nums"
                    placeholder="kg"
                  />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-700">Medium Grade</span>
                  <input
                    type="number"
                    value={mediumCount}
                    onChange={(e) => setMediumCount(Number(e.target.value))}
                    className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs tabular-nums"
                  />
                  <input
                    type="number"
                    value={mediumKg}
                    onChange={(e) => setMediumKg(Number(e.target.value))}
                    className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-700">Small Grade</span>
                  <input
                    type="number"
                    value={smallCount}
                    onChange={(e) => setSmallCount(Number(e.target.value))}
                    className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs tabular-nums"
                  />
                  <input
                    type="number"
                    value={smallKg}
                    onChange={(e) => setSmallKg(Number(e.target.value))}
                    className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs tabular-nums"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Price / kg (TZS)</label>
                  <input
                    type="number"
                    value={pricePerKg}
                    onChange={(e) => setPricePerKg(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Paid Now (TZS)</label>
                  <input
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs tabular-nums"
                  />
                </div>
              </div>
              <div className="rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-900">
                Total: <strong>{largeCount + mediumCount + smallCount} fish</strong> ·{' '}
                <strong>{largeKg + mediumKg + smallKg} kg</strong> · Value:{' '}
                <strong>{formatTzs((largeKg + mediumKg + smallKg) * pricePerKg)}</strong>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Approval PIN (PIN: <span className="font-mono">{state.activeUser.pin}</span>)
                </label>
                <input
                  type="password"
                  maxLength={4}
                  placeholder="Enter 4-digit PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono"
                />
              </div>
              <button
                type="button"
                disabled={!perms.canApproveHarvest}
                onClick={() => {
                  const res = onRecordHarvest({
                    pondCode: harvPond,
                    largeCount,
                    largeKg,
                    mediumCount,
                    mediumKg,
                    smallCount,
                    smallKg,
                    customerName,
                    pricePerKgTzs: pricePerKg,
                    paidAmountTzs: paidAmount,
                    pin,
                  });
                  if (!res.ok) {
                    setErrorMsg(res.error || 'Harvest failed');
                    return;
                  }
                  onClose();
                }}
                className="w-full rounded-lg bg-orange-600 py-2.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
              >
                Approve Harvest & Generate Invoice
              </button>
            </div>
          )}

          {/* REPORTS EXPORT */}
          {activeModal === 'report' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                Download audit-ready CSV exports formatted for Tanzania Fisheries (Aquaculture) Regulations 2024 & FiRCIS traceability compliance.
              </p>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    exportToCsv(
                      `dukaaqusmart-batches-${todayIso()}.csv`,
                      ['Batch Code', 'Species', 'Pond', 'Stocked', 'Estimated Live', 'Avg Weight (g)', 'Feed (kg)', 'Mortality'],
                      state.batches.map((b) => [
                        b.batchCode,
                        b.species,
                        b.pondCode,
                        b.initialStocking,
                        b.currentEstimatedFish,
                        b.currentAvgWeightG,
                        b.feedConsumedKg,
                        b.totalMortality,
                      ])
                    )
                  }
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900">Batch Production & Traceability Report</div>
                    <div className="text-[11px] text-slate-500">All active batches, biomass, mortality & FCR</div>
                  </div>
                  <FileDown className="h-4 w-4 text-blue-600" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportToCsv(
                      `dukaaqusmart-feed-audit-${todayIso()}.csv`,
                      ['Date', 'Pond', 'Batch', 'Approved kg', 'Issued kg', 'Fed kg', 'Variance kg', 'Status'],
                      state.feedIssuances.map((f) => [
                        f.date,
                        f.pondCode,
                        f.batchCode,
                        f.approvedKg,
                        f.issuedByStorekeeperKg,
                        f.actualFedKg ?? 0,
                        f.varianceKg,
                        f.status,
                      ])
                    )
                  }
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900">Feed Issuance & Variance Audit</div>
                    <div className="text-[11px] text-slate-500">Storekeeper vs Keeper reconciliation logs</div>
                  </div>
                  <FileDown className="h-4 w-4 text-emerald-600" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportToCsv(
                      `dukaaqusmart-finance-tzs-${todayIso()}.csv`,
                      ['Date', 'Type', 'Category', 'Description', 'Amount (TZS)', 'Counterparty', 'Status'],
                      state.finances.map((t) => [
                        t.date,
                        t.type,
                        t.category,
                        t.description,
                        t.amountTzs,
                        t.counterparty,
                        t.paymentStatus,
                      ])
                    )
                  }
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900">TZS Financial & Profitability Ledger</div>
                    <div className="text-[11px] text-slate-500">Revenue, feed expenses, salaries, debts</div>
                  </div>
                  <FileDown className="h-4 w-4 text-indigo-600" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface PondQrModalProps {
  pond: Pond | null;
  state: AquacultureState;
  onClose: () => void;
  onQuickAction: (action: QuickActionType) => void;
}

export const PondQrModal: React.FC<PondQrModalProps> = ({ pond, state, onClose, onQuickAction }) => {
  if (!pond) return null;
  const batch = state.batches.find((b) => b.pondCode === pond.code);
  const wq = state.waterReadings.find((w) => w.pondCode === pond.code);
  const keeper = state.employees.find((e) => e.id === pond.assignedKeeperId);

  // Deterministic clean QR-matrix visual SVG based on pond code
  const cells = Array.from({ length: 49 }, (_, i) => {
    const hash = (pond.code.charCodeAt(i % pond.code.length) * (i + 7)) % 5;
    return hash < 3;
  });

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">
              {pond.name} ({pond.code}) Digital QR Profile
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="grid grid-cols-7 gap-0.5 rounded-lg border border-slate-300 bg-white p-2">
              {cells.map((filled, idx) => (
                <div
                  key={idx}
                  className={`h-2.5 w-2.5 ${filled ? 'bg-slate-900' : 'bg-white'}`}
                />
              ))}
            </div>
            <div className="text-xs">
              <div className="font-mono text-[11px] font-semibold text-blue-700">{pond.qrCodeToken}</div>
              <div className="mt-0.5 font-bold text-slate-900">
                {pond.species} · {pond.unitType}
              </div>
              <div className="text-slate-600">
                Stock: <strong className="tabular-nums">{pond.currentFish.toLocaleString()}</strong> /{' '}
                {pond.maxCapacity.toLocaleString()}
              </div>
              <div className="text-slate-500">Keeper: {keeper?.name || 'Assigned'}</div>
            </div>
          </div>

          {batch && (
            <div className="rounded-xl border border-slate-200 p-3 text-xs">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-bold text-slate-900">Active Batch: {batch.batchCode}</span>
                <span className="font-semibold text-emerald-700">{batch.status}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-slate-600">
                <div>Avg Wt: <strong>{batch.currentAvgWeightG}g</strong></div>
                <div>Biomass: <strong>{Math.round((batch.currentEstimatedFish * batch.currentAvgWeightG) / 1000)} kg</strong></div>
                <div>Harvest: <strong>{batch.plannedHarvestDate}</strong></div>
              </div>
            </div>
          )}

          {wq && (
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="rounded-lg bg-slate-50 p-2">
                <div className="text-[10px] text-slate-500">pH</div>
                <div className="font-bold text-slate-900 tabular-nums">{wq.ph}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <div className="text-[10px] text-slate-500">DO</div>
                <div className="font-bold text-slate-900 tabular-nums">{wq.dissolvedOxygen} mg/L</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <div className="text-[10px] text-slate-500">Temp</div>
                <div className="font-bold text-slate-900 tabular-nums">{wq.temperature}°C</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <div className="text-[10px] text-slate-500">NH3</div>
                <div className="font-bold text-slate-900 tabular-nums">{wq.ammonia}</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onClose();
                onQuickAction('feeding');
              }}
              className="rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Record Feeding
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onQuickAction('water');
              }}
              className="rounded-lg bg-sky-600 py-2 text-xs font-semibold text-white hover:bg-sky-700"
            >
              Log Water Reading
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
