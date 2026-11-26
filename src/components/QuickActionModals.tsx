import React, { useEffect, useState } from 'react';
import {
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
import { Button, FormError, INPUT_CLASS, Sheet, ValidCheck, usePreferences } from '../ui';

export type QuickActionType =
  | 'feeding'
  | 'inventory'
  | 'water'
  | 'mortality'
  | 'harvest'
  | 'report'
  | null;

export interface AddInventoryPayload {
  mode: 'existing' | 'new';
  existingItemId?: string;
  sku?: string;
  name: string;
  category: 'Feed' | 'Fingerlings' | 'Medicine' | 'Fuel' | 'Equipment';
  quantity: number;
  unit: string;
  unitCostTzs: number;
  reorderLevel: number;
  lotNumber: string;
  expiryDate?: string;
  purchaseDate: string;
  supplier: string;
  supplierPhone?: string;
  invoiceNo?: string;
  paymentStatus: 'Paid' | 'Partial' | 'Credit Debt';
  paidAmountTzs: number;
  notes?: string;
}

interface QuickActionModalsProps {
  activeModal: QuickActionType;
  state: AquacultureState;
  initialInventoryItemId?: string | null;
  initialHarvestPondCode?: string | null;
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
  onAddInventory: (payload: AddInventoryPayload) => void;
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
    damagedKg: number;
    notes: string;
    pin: string;
  }) => { ok: boolean; lotId?: string; error?: string };
  onOpenQuickSaleForLot?: (lotId: string) => void;
}

export const QuickActionModals: React.FC<QuickActionModalsProps> = ({
  activeModal,
  state,
  initialInventoryItemId,
  initialHarvestPondCode,
  onClose,
  onRecordFeeding,
  onAddInventory,
  onRecordWater,
  onReportMortality,
  onRecordHarvest,
  onOpenQuickSaleForLot,
}) => {
  const perms = getPermissions(state.activeUser.role);
  const { triggerHaptic } = usePreferences();

  // Keep last non-null modal type so Sheet exit animation finishes smoothly
  const [renderedModal, setRenderedModal] = useState<QuickActionType>(activeModal);
  useEffect(() => {
    if (activeModal) {
      setRenderedModal(activeModal);
      setErrorMsg('');
      setSaveSuccess(false);
    }
  }, [activeModal]);

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

  // Inventory & Stock Purchase state
  const [invMode, setInvMode] = useState<'existing' | 'new'>('existing');
  const [invExistingId, setInvExistingId] = useState<string>('');
  const [invSku, setInvSku] = useState<string>('');
  const [invName, setInvName] = useState<string>('');
  const [invCategory, setInvCategory] = useState<'Feed' | 'Fingerlings' | 'Medicine' | 'Fuel' | 'Equipment'>('Feed');
  const [invQty, setInvQty] = useState<string>('');
  const [invUnit, setInvUnit] = useState<string>('kg');
  const [invCost, setInvCost] = useState<string>('');
  const [invReorderLevel, setInvReorderLevel] = useState<string>('50');
  const [invLotNumber, setInvLotNumber] = useState<string>('');
  const [invExpiryDate, setInvExpiryDate] = useState<string>('');
  const [invPurchaseDate, setInvPurchaseDate] = useState<string>(todayIso());
  const [invSupplier, setInvSupplier] = useState<string>('');
  const [invSupplierPhone, setInvSupplierPhone] = useState<string>('');
  const [invInvoiceNo, setInvInvoiceNo] = useState<string>('');
  const [invPaymentStatus, setInvPaymentStatus] = useState<'Paid' | 'Partial' | 'Credit Debt'>('Paid');
  const [invPaidAmount, setInvPaidAmount] = useState<string>('');
  const [invNotes, setInvNotes] = useState<string>('');

  const applyExistingItemSelection = (itemId: string) => {
    setInvExistingId(itemId);
    const found = state.inventory.find((i) => i.id === itemId);
    if (found) {
      setInvName(found.name);
      setInvSku(found.sku || '');
      setInvCategory(found.category);
      setInvUnit(found.unit);
      setInvCost(String(found.unitCostTzs));
      setInvReorderLevel(String(found.reorderLevel));
      setInvSupplier(found.supplier);
      setInvExpiryDate(found.expiryDate || '');
    }
  };

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

  // Harvest Lot state (empty defaults — never pre-filled with dummy sale values)
  const [harvPond, setHarvPond] = useState('');
  const [largeCount, setLargeCount] = useState('');
  const [largeKg, setLargeKg] = useState('');
  const [mediumCount, setMediumCount] = useState('');
  const [mediumKg, setMediumKg] = useState('');
  const [smallCount, setSmallCount] = useState('');
  const [smallKg, setSmallKg] = useState('');
  const [damagedKg, setDamagedKg] = useState('0');
  const [harvNotes, setHarvNotes] = useState('');

  // Shared PIN signature + error + success tick
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [errorShake, setErrorShake] = useState(0);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize contextual defaults whenever modal opens
  useEffect(() => {
    if (activeModal === 'inventory') {
      setInvPurchaseDate(todayIso());
      setInvLotNumber(`LOT-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${String(
        (state.stockPurchases?.length || 0) + 1
      ).padStart(2, '0')}`);
      setInvQty('');
      setInvInvoiceNo('');
      setInvSupplierPhone('');
      setInvPaymentStatus('Paid');
      setInvPaidAmount('');
      setInvNotes('');
      if (initialInventoryItemId) {
        setInvMode('existing');
        applyExistingItemSelection(initialInventoryItemId);
      } else if (state.inventory.length > 0) {
        setInvMode('existing');
        applyExistingItemSelection(state.inventory[0].id);
      } else {
        setInvMode('new');
        setInvExistingId('');
        setInvSku('');
        setInvName('');
        setInvCategory('Feed');
        setInvUnit('kg');
        setInvCost('');
        setInvReorderLevel('50');
        setInvSupplier('');
        setInvExpiryDate('');
      }
    }
    if (activeModal === 'harvest') {
      setHarvPond(initialHarvestPondCode || '');
    }
  }, [activeModal, initialInventoryItemId, initialHarvestPondCode]);

  const showValidationError = (msg: string) => {
    setErrorMsg(msg);
    setErrorShake((s) => s + 1);
  };

  const triggerSuccessAndClose = (afterClose?: () => void) => {
    setSaveSuccess(true);
    triggerHaptic(10);
    window.setTimeout(() => {
      setSaveSuccess(false);
      onClose();
      afterClose?.();
    }, 320);
  };

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
      showValidationError('Could not parse Swahili voice transcript.');
    } finally {
      setVoiceParsing(false);
    }
  };

  const modalTitle = (
    <span className="flex items-center gap-2.5">
      {renderedModal === 'feeding' && <Utensils className="h-4 w-4 text-blue-600 dark:text-sky-400" />}
      {renderedModal === 'inventory' && <PackagePlus className="h-4 w-4 text-teal-600 dark:text-teal-400" />}
      {renderedModal === 'water' && <Droplets className="h-4 w-4 text-sky-600 dark:text-sky-400" />}
      {renderedModal === 'mortality' && <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />}
      {renderedModal === 'harvest' && <Scale className="h-4 w-4 text-orange-600 dark:text-orange-400" />}
      {renderedModal === 'report' && <FileDown className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
      <span>
        {renderedModal === 'feeding' && 'Record Feeding & Feed Reconciliation'}
        {renderedModal === 'inventory' && 'Inventory Restock & Purchase Entry'}
        {renderedModal === 'water' && 'Record Water Quality Reading'}
        {renderedModal === 'mortality' && 'Report Fish Mortality (Immutable Log)'}
        {renderedModal === 'harvest' && 'Record Harvest Lot (Graded Stock)'}
        {renderedModal === 'report' && 'Generate Tanzania Traceability & FiRCIS Reports'}
      </span>
    </span>
  );

  return (
    <Sheet
      open={Boolean(activeModal)}
      onClose={onClose}
      title={modalTitle}
      maxWidthClass={
        renderedModal === 'inventory' || renderedModal === 'harvest' ? 'sm:max-w-2xl' : 'sm:max-w-lg'
      }
    >
      <div className="space-y-4 text-sm">
        <FormError message={errorMsg} shakeKey={errorShake} />

        {/* FEEDING FORM */}
        {renderedModal === 'feeding' && (
          <div className="space-y-3">
            {!perms.canRecordFeeding && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-200">
                Role notice: Current role ({state.activeUser.roleLabel}) typically views or approves plans. Switch to Keeper or Farm Manager in the sidebar to record field feeding.
              </div>
            )}

            {/* Swahili Voice Reporting Box */}
            <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3 dark:border-sky-900/60 dark:bg-sky-950/40">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-sky-900 dark:text-sky-200">
                  <Mic className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" /> Swahili Voice / Field Report Parser
                </span>
                <Button
                  size="sm"
                  variant="primary"
                  loading={voiceParsing}
                  onClick={handleParseSwahili}
                >
                  {voiceParsing ? 'Parsing...' : 'Auto-Fill from Swahili'}
                </Button>
              </div>
              <input
                type="text"
                value={swahiliVoiceText}
                onChange={(e) => setSwahiliVoiceText(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Pond</label>
                <select
                  value={feedPond}
                  onChange={(e) => setFeedPond(e.target.value)}
                  className={INPUT_CLASS}
                >
                  {state.ponds.map((p) => (
                    <option key={p.id} value={p.code}>
                      {p.code} — {p.species}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Feed Type</label>
                <input
                  type="text"
                  value={feedType}
                  onChange={(e) => setFeedType(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Approved (kg)</label>
                <input
                  type="number"
                  step="0.5"
                  value={approvedKg}
                  onChange={(e) => setApprovedKg(Number(e.target.value))}
                  className={`${INPUT_CLASS} tabular-nums`}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Store Issued (kg)</label>
                <input
                  type="number"
                  step="0.5"
                  value={issuedKg}
                  onChange={(e) => setIssuedKg(Number(e.target.value))}
                  className={`${INPUT_CLASS} tabular-nums`}
                />
              </div>
              <div>
                <label className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <span>Actual Fed (kg)</span>
                  <ValidCheck valid={actualFedKg > 0} />
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={actualFedKg}
                  onChange={(e) => setActualFedKg(Number(e.target.value))}
                  className={`${INPUT_CLASS} tabular-nums`}
                />
              </div>
            </div>

            {Math.abs(issuedKg - actualFedKg) > 0.1 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-200">
                Variance Alert: Issued {issuedKg} kg vs Actual Fed {actualFedKg} kg (Diff:{' '}
                <strong>{Math.abs(issuedKg - actualFedKg).toFixed(1)} kg</strong>) will be flagged for Manager investigation.
              </div>
            )}

            <div>
              <label
                htmlFor="qm-feed-pin"
                className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Digital PIN Signature (4-digit PIN)
                </span>
                <ValidCheck valid={/^\d{4}$/.test(pin)} />
              </label>
              <input
                id="qm-feed-pin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="Enter 4-digit PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className={`${INPUT_CLASS} min-h-[44px] font-mono tracking-widest`}
              />
            </div>

            <Button
              variant="primary"
              fullWidth
              success={saveSuccess}
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
                  showValidationError(res.error || 'PIN verification failed');
                  return;
                }
                setPin('');
                triggerSuccessAndClose();
              }}
            >
              {saveSuccess ? 'Feeding Saved' : 'Submit & Sign Feeding Log'}
            </Button>
          </div>
        )}

        {/* INVENTORY & PURCHASE FORM */}
        {renderedModal === 'inventory' && (() => {
          const parsedQty = Number(invQty) || 0;
          const parsedCost = Number(invCost) || 0;
          const parsedReorder = Math.max(0, Number(invReorderLevel) || 0);
          const totalCost = Math.round(parsedQty * parsedCost);
          const effectivePaid =
            invPaymentStatus === 'Paid'
              ? totalCost
              : invPaymentStatus === 'Credit Debt'
                ? 0
                : Math.min(totalCost, Math.max(0, Math.round(Number(invPaidAmount) || 0)));
          const balanceDue = Math.max(0, totalCost - effectivePaid);
          const selectedExisting = state.inventory.find((i) => i.id === invExistingId);

          return (
            <div className="space-y-3.5">
              {/* Mode Switch: Restock Existing vs Create New */}
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-800 dark:bg-slate-800/60">
                <button
                  type="button"
                  onClick={() => {
                    setInvMode('existing');
                    if (state.inventory.length > 0) {
                      applyExistingItemSelection(invExistingId || state.inventory[0].id);
                    }
                  }}
                  className={`min-h-[40px] rounded-lg px-3 text-xs font-bold transition-colors ${
                    invMode === 'existing'
                      ? 'bg-[#136EE6] text-white shadow-xs'
                      : 'text-slate-700 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  Restock Existing Product ({state.inventory.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInvMode('new');
                    setInvExistingId('');
                    setInvSku(`SKU-${String(state.inventory.length + 101)}`);
                    setInvName('');
                    setInvCost('');
                    setInvReorderLevel('50');
                    setInvSupplier('');
                    setInvExpiryDate('');
                  }}
                  className={`min-h-[40px] rounded-lg px-3 text-xs font-bold transition-colors ${
                    invMode === 'new'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  + Create New Product / Item
                </button>
              </div>

              {invMode === 'existing' && (
                <div>
                  <label
                    htmlFor="qm-inv-existing"
                    className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    <span>Select Existing Item / Product *</span>
                    <ValidCheck valid={Boolean(selectedExisting)} />
                  </label>
                  <select
                    id="qm-inv-existing"
                    value={invExistingId}
                    onChange={(e) => applyExistingItemSelection(e.target.value)}
                    className={`${INPUT_CLASS} min-h-[44px] font-semibold`}
                  >
                    <option value="">Choose an item to restock...</option>
                    {state.inventory.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.category} · Current: {item.stock.toLocaleString()} {item.unit})
                      </option>
                    ))}
                  </select>
                  {selectedExisting && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 rounded-lg bg-sky-50 px-3 py-1.5 text-[11px] font-medium text-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
                      <span>
                        Current Stock:{' '}
                        <strong className="tabular-nums">
                          {selectedExisting.stock.toLocaleString()} {selectedExisting.unit}
                        </strong>
                      </span>
                      <span>
                        New Stock After Delivery:{' '}
                        <strong className="tabular-nums text-emerald-700 dark:text-emerald-300">
                          {(selectedExisting.stock + Math.max(0, parsedQty)).toLocaleString()} {invUnit}
                        </strong>
                      </span>
                      <span>Reorder Level: {selectedExisting.reorderLevel} {selectedExisting.unit}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Product Identification Row */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="qm-inv-name"
                    className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    <span>Item / Product Name *</span>
                    <ValidCheck valid={invName.trim().length > 1} />
                  </label>
                  <input
                    id="qm-inv-name"
                    type="text"
                    placeholder="e.g. Tilapia Grower Pellets 3mm"
                    value={invName}
                    onChange={(e) => setInvName(e.target.value)}
                    className={`${INPUT_CLASS} min-h-[44px]`}
                  />
                </div>
                <div>
                  <label
                    htmlFor="qm-inv-sku"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    SKU / Item Code
                  </label>
                  <input
                    id="qm-inv-sku"
                    type="text"
                    placeholder="e.g. FEED-GRW-3MM"
                    value={invSku}
                    onChange={(e) => setInvSku(e.target.value)}
                    className={`${INPUT_CLASS} min-h-[44px] font-mono`}
                  />
                </div>
              </div>

              {/* Category, Purchase Date, Reorder Level */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="qm-inv-cat"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Category *
                  </label>
                  <select
                    id="qm-inv-cat"
                    value={invCategory}
                    onChange={(e) =>
                      setInvCategory(e.target.value as 'Feed' | 'Fingerlings' | 'Medicine' | 'Fuel' | 'Equipment')
                    }
                    className={`${INPUT_CLASS} min-h-[44px]`}
                  >
                    <option value="Feed">Feed</option>
                    <option value="Fingerlings">Fingerlings</option>
                    <option value="Medicine">Medicine</option>
                    <option value="Fuel">Fuel</option>
                    <option value="Equipment">Equipment</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="qm-inv-date"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Purchase Date *
                  </label>
                  <input
                    id="qm-inv-date"
                    type="date"
                    value={invPurchaseDate}
                    onChange={(e) => setInvPurchaseDate(e.target.value)}
                    className={`${INPUT_CLASS} min-h-[44px]`}
                  />
                </div>
                <div>
                  <label
                    htmlFor="qm-inv-reorder"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Min Reorder Level
                  </label>
                  <input
                    id="qm-inv-reorder"
                    type="number"
                    min="0"
                    value={invReorderLevel}
                    onChange={(e) => setInvReorderLevel(e.target.value)}
                    className={`${INPUT_CLASS} min-h-[44px] tabular-nums`}
                  />
                </div>
              </div>

              {/* Quantity, Unit, Unit Cost */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="qm-inv-qty"
                    className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    <span>Quantity Purchased *</span>
                    <ValidCheck valid={parsedQty > 0} />
                  </label>
                  <input
                    id="qm-inv-qty"
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="e.g. 500"
                    value={invQty}
                    onChange={(e) => setInvQty(e.target.value)}
                    className={`${INPUT_CLASS} min-h-[44px] font-bold tabular-nums`}
                  />
                </div>
                <div>
                  <label
                    htmlFor="qm-inv-unit"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Unit *
                  </label>
                  <select
                    id="qm-inv-unit"
                    value={['kg', 'bags', 'pcs', 'litres', 'bottles', 'packs', 'fish'].includes(invUnit) ? invUnit : 'other'}
                    onChange={(e) => {
                      if (e.target.value !== 'other') setInvUnit(e.target.value);
                    }}
                    className={`${INPUT_CLASS} min-h-[44px]`}
                  >
                    <option value="kg">Kilograms (kg)</option>
                    <option value="bags">Bags (25kg / 50kg)</option>
                    <option value="litres">Litres</option>
                    <option value="bottles">Bottles</option>
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="packs">Packs / Sachets</option>
                    <option value="fish">Live Fingerlings (fish)</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="qm-inv-cost"
                    className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    <span>Unit Cost (TZS) *</span>
                    <ValidCheck valid={parsedCost > 0} />
                  </label>
                  <input
                    id="qm-inv-cost"
                    type="number"
                    min="0"
                    placeholder="e.g. 2800"
                    value={invCost}
                    onChange={(e) => setInvCost(e.target.value)}
                    className={`${INPUT_CLASS} min-h-[44px] font-bold tabular-nums`}
                  />
                </div>
              </div>

              {/* Batch/Lot, Expiry Date, Supplier Invoice */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="qm-inv-lot"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Batch / Lot Number *
                  </label>
                  <input
                    id="qm-inv-lot"
                    type="text"
                    value={invLotNumber}
                    onChange={(e) => setInvLotNumber(e.target.value)}
                    className={`${INPUT_CLASS} min-h-[44px] font-mono`}
                  />
                </div>
                <div>
                  <label
                    htmlFor="qm-inv-expiry"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Expiry Date (if perishable)
                  </label>
                  <input
                    id="qm-inv-expiry"
                    type="date"
                    value={invExpiryDate}
                    onChange={(e) => setInvExpiryDate(e.target.value)}
                    className={`${INPUT_CLASS} min-h-[44px]`}
                  />
                </div>
                <div>
                  <label
                    htmlFor="qm-inv-invoice"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Supplier Invoice / GRN #
                  </label>
                  <input
                    id="qm-inv-invoice"
                    type="text"
                    placeholder="e.g. SUP-INV-094"
                    value={invInvoiceNo}
                    onChange={(e) => setInvInvoiceNo(e.target.value)}
                    className={`${INPUT_CLASS} min-h-[44px] font-mono`}
                  />
                </div>
              </div>

              {/* Supplier Name & Phone */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="qm-inv-supplier"
                    className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    <span>Supplier Name *</span>
                    <ValidCheck valid={invSupplier.trim().length > 1} />
                  </label>
                  <input
                    id="qm-inv-supplier"
                    type="text"
                    placeholder="e.g. AquaFeed Tanzania Ltd"
                    value={invSupplier}
                    onChange={(e) => setInvSupplier(e.target.value)}
                    className={`${INPUT_CLASS} min-h-[44px]`}
                  />
                </div>
                <div>
                  <label
                    htmlFor="qm-inv-supphone"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Supplier Phone (Optional)
                  </label>
                  <input
                    id="qm-inv-supphone"
                    type="tel"
                    placeholder="e.g. +255 713 456 789"
                    value={invSupplierPhone}
                    onChange={(e) => setInvSupplierPhone(e.target.value)}
                    className={`${INPUT_CLASS} min-h-[44px] font-mono`}
                  />
                </div>
              </div>

              {/* Payment Status & Paid Amount */}
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-800/50">
                <div>
                  <label
                    htmlFor="qm-inv-paystatus"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Purchase Payment Status *
                  </label>
                  <select
                    id="qm-inv-paystatus"
                    value={invPaymentStatus}
                    onChange={(e) => {
                      const next = e.target.value as 'Paid' | 'Partial' | 'Credit Debt';
                      setInvPaymentStatus(next);
                      if (next === 'Partial' && !invPaidAmount && totalCost > 0) {
                        setInvPaidAmount(String(Math.round(totalCost / 2)));
                      }
                    }}
                    className={`${INPUT_CLASS} min-h-[44px] font-semibold`}
                  >
                    <option value="Paid">Paid in Full</option>
                    <option value="Partial">Partial Payment</option>
                    <option value="Credit Debt">Credit / Pay Later</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="qm-inv-paidamt"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Amount Paid Now (TZS)
                  </label>
                  <input
                    id="qm-inv-paidamt"
                    type="number"
                    min="0"
                    max={totalCost}
                    disabled={invPaymentStatus !== 'Partial'}
                    value={invPaymentStatus === 'Paid' ? String(totalCost) : invPaymentStatus === 'Credit Debt' ? '0' : invPaidAmount}
                    onChange={(e) => setInvPaidAmount(e.target.value)}
                    className={`${INPUT_CLASS} min-h-[44px] font-bold tabular-nums disabled:opacity-70`}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="qm-inv-notes"
                  className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Delivery / Quality Inspection Notes
                </label>
                <input
                  id="qm-inv-notes"
                  type="text"
                  placeholder="Condition on arrival, storage warehouse/room, etc."
                  value={invNotes}
                  onChange={(e) => setInvNotes(e.target.value)}
                  className={`${INPUT_CLASS} min-h-[42px]`}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/40">
                <span className="text-slate-700 dark:text-slate-300">
                  Total Purchase Value:{' '}
                  <strong className="text-sm font-extrabold text-emerald-800 tabular-nums dark:text-emerald-300">
                    {formatTzs(totalCost)}
                  </strong>
                </span>
                <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                  Paid: {formatTzs(effectivePaid)} · Balance Due:{' '}
                  <strong className={balanceDue > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}>
                    {formatTzs(balanceDue)}
                  </strong>
                </span>
              </div>

              <Button
                variant="success"
                fullWidth
                size="lg"
                success={saveSuccess}
                onClick={() => {
                  if (invMode === 'existing' && !invExistingId) {
                    showValidationError('Select an existing inventory item or switch to Create New Product.');
                    return;
                  }
                  if (!invName.trim() || !invSupplier.trim() || !invLotNumber.trim()) {
                    showValidationError('Item name, batch/lot number, and supplier name are required.');
                    return;
                  }
                  if (parsedQty <= 0 || parsedCost <= 0) {
                    showValidationError('Enter quantity > 0 and unit cost > 0.');
                    return;
                  }
                  if (invPaymentStatus === 'Partial' && (effectivePaid <= 0 || effectivePaid >= totalCost)) {
                    showValidationError('For Partial payment, enter an amount paid between TZS 1 and Total Cost - 1.');
                    return;
                  }
                  onAddInventory({
                    mode: invMode,
                    existingItemId: invMode === 'existing' ? invExistingId : undefined,
                    sku: invSku.trim() || undefined,
                    name: invName.trim(),
                    category: invCategory,
                    quantity: parsedQty,
                    unit: invUnit.trim() || 'kg',
                    unitCostTzs: parsedCost,
                    reorderLevel: parsedReorder,
                    lotNumber: invLotNumber.trim(),
                    expiryDate: invExpiryDate || undefined,
                    purchaseDate: invPurchaseDate || todayIso(),
                    supplier: invSupplier.trim(),
                    supplierPhone: invSupplierPhone.trim() || undefined,
                    invoiceNo: invInvoiceNo.trim() || undefined,
                    paymentStatus: invPaymentStatus,
                    paidAmountTzs: effectivePaid,
                    notes: invNotes.trim() || undefined,
                  });
                  triggerSuccessAndClose();
                }}
              >
                {saveSuccess ? 'Purchase & Stock Recorded' : 'Save Purchase & Update Stock'}
              </Button>
            </div>
          );
        })()}

        {/* WATER QUALITY FORM */}
        {renderedModal === 'water' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Pond</label>
                <select
                  value={wqPond}
                  onChange={(e) => setWqPond(e.target.value)}
                  className={INPUT_CLASS}
                >
                  {state.ponds.map((p) => (
                    <option key={p.id} value={p.code}>
                      {p.code} — {p.species}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Monitoring Level</label>
                <select
                  value={wqSource}
                  onChange={(e) =>
                    setWqSource(
                      e.target.value as 'Manual (Mobile)' | 'Bluetooth Meter' | 'IoT ESP32 Sensor'
                    )
                  }
                  className={INPUT_CLASS}
                >
                  <option value="Manual (Mobile)">Level 1: Manual Mobile Entry</option>
                  <option value="Bluetooth Meter">Level 2: Bluetooth Water Meter</option>
                  <option value="IoT ESP32 Sensor">Level 3: ESP32 IoT Sensor</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">pH</label>
                <input
                  type="number"
                  step="0.1"
                  value={wqPh}
                  onChange={(e) => setWqPh(Number(e.target.value))}
                  className={`${INPUT_CLASS} min-h-[42px] px-3 tabular-nums`}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">DO (mg/L)</label>
                <input
                  type="number"
                  step="0.1"
                  value={wqDo}
                  onChange={(e) => setWqDo(Number(e.target.value))}
                  className={`${INPUT_CLASS} min-h-[42px] px-3 tabular-nums`}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Temp (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={wqTemp}
                  onChange={(e) => setWqTemp(Number(e.target.value))}
                  className={`${INPUT_CLASS} min-h-[42px] px-3 tabular-nums`}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">NH3</label>
                <input
                  type="number"
                  step="0.01"
                  value={wqNh3}
                  onChange={(e) => setWqNh3(Number(e.target.value))}
                  className={`${INPUT_CLASS} min-h-[42px] px-3 tabular-nums`}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">NO2</label>
                <input
                  type="number"
                  step="0.01"
                  value={wqNo2}
                  onChange={(e) => setWqNo2(Number(e.target.value))}
                  className={`${INPUT_CLASS} min-h-[42px] px-3 tabular-nums`}
                />
              </div>
            </div>
            {wqDo < 4.5 && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
                Low Dissolved Oxygen (&lt; 4.5 mg/L) detected: System will automatically trigger the Pond Aerator Relay and notify the Technician!
              </div>
            )}
            <Button
              variant="primary"
              fullWidth
              success={saveSuccess}
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
                triggerSuccessAndClose();
              }}
            >
              {saveSuccess ? 'Water Reading Saved' : 'Save Water Quality Measurement'}
            </Button>
          </div>
        )}

        {/* MORTALITY FORM */}
        {renderedModal === 'mortality' && (
          <div className="space-y-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-200">
              Accountability Rule: Mortality records are immutable once submitted. Keepers cannot delete records or self-approve medication.
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Pond</label>
                <select
                  value={mortPond}
                  onChange={(e) => setMortPond(e.target.value)}
                  className={INPUT_CLASS}
                >
                  {state.ponds.map((p) => (
                    <option key={p.id} value={p.code}>
                      {p.code}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Dead Fish</label>
                <input
                  type="number"
                  min={1}
                  value={deadCount}
                  onChange={(e) => setDeadCount(Number(e.target.value))}
                  className={`${INPUT_CLASS} tabular-nums`}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Affected Fish</label>
                <input
                  type="number"
                  min={0}
                  value={affectedCount}
                  onChange={(e) => setAffectedCount(Number(e.target.value))}
                  className={`${INPUT_CLASS} tabular-nums`}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Observed Symptoms</label>
              <textarea
                rows={2}
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label
                htmlFor="qm-mort-pin"
                className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                <span>Digital PIN Signature (4-digit PIN)</span>
                <ValidCheck valid={/^\d{4}$/.test(pin)} />
              </label>
              <input
                id="qm-mort-pin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="Enter 4-digit PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className={`${INPUT_CLASS} min-h-[44px] font-mono tracking-widest`}
              />
            </div>
            <Button
              variant="danger"
              fullWidth
              success={saveSuccess}
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
                  showValidationError(res.error || 'Unable to submit mortality');
                  return;
                }
                setPin('');
                triggerSuccessAndClose();
              }}
            >
              {saveSuccess ? 'Mortality Logged' : 'Log Mortality & Alert Technician'}
            </Button>
          </div>
        )}

        {/* HARVEST LOT FORM */}
        {renderedModal === 'harvest' && (() => {
          const selectedPondObj = state.ponds.find((p) => p.code === harvPond);
          const lc = Math.max(0, Math.round(Number(largeCount) || 0));
          const lkg = Math.max(0, Math.round((Number(largeKg) || 0) * 100) / 100);
          const mc = Math.max(0, Math.round(Number(mediumCount) || 0));
          const mkg = Math.max(0, Math.round((Number(mediumKg) || 0) * 100) / 100);
          const sc = Math.max(0, Math.round(Number(smallCount) || 0));
          const skg = Math.max(0, Math.round((Number(smallKg) || 0) * 100) / 100);
          const dkg = Math.max(0, Math.round((Number(damagedKg) || 0) * 100) / 100);
          const totalCount = lc + mc + sc;
          const totalKg = Math.round((lkg + mkg + skg) * 100) / 100;

          const submitHarvestLot = (openSaleAfter: boolean) => {
            setErrorMsg('');
            if (!harvPond || !selectedPondObj) {
              showValidationError('Please select a pond to harvest.');
              return;
            }
            if (totalCount <= 0) {
              showValidationError('Total harvested fish count must be greater than 0.');
              return;
            }
            if (totalCount > selectedPondObj.currentFish) {
              showValidationError(
                `Harvest count (${totalCount.toLocaleString()}) exceeds live fish in ${selectedPondObj.code} (${selectedPondObj.currentFish.toLocaleString()}).`
              );
              return;
            }
            if (totalKg <= 0) {
              showValidationError('Total marketable weight (kg) must be greater than 0.');
              return;
            }
            const res = onRecordHarvest({
              pondCode: harvPond,
              largeCount: lc,
              largeKg: lkg,
              mediumCount: mc,
              mediumKg: mkg,
              smallCount: sc,
              smallKg: skg,
              damagedKg: dkg,
              notes: harvNotes.trim(),
              pin,
            });
            if (!res.ok) {
              showValidationError(res.error || 'Harvest failed');
              return;
            }
            setPin('');
            setHarvPond('');
            setLargeCount('');
            setLargeKg('');
            setMediumCount('');
            setMediumKg('');
            setSmallCount('');
            setSmallKg('');
            setDamagedKg('0');
            setHarvNotes('');
            triggerSuccessAndClose(() => {
              if (openSaleAfter && res.lotId && onOpenQuickSaleForLot) {
                onOpenQuickSaleForLot(res.lotId);
              }
            });
          };

          return (
            <div className="space-y-3">
              {!perms.canApproveHarvest && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-200">
                  Only Farm Manager or Owner can approve harvests. Switch role in the sidebar to approve.
                </div>
              )}

              <div>
                <label
                  htmlFor="qm-harv-pond"
                  className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  <span>Pond to Harvest *</span>
                  <ValidCheck valid={Boolean(selectedPondObj)} />
                </label>
                <select
                  id="qm-harv-pond"
                  value={harvPond}
                  onChange={(e) => setHarvPond(e.target.value)}
                  className={`${INPUT_CLASS} min-h-[44px] font-semibold`}
                >
                  <option value="">Select pond...</option>
                  {state.ponds
                    .filter((p) => p.currentFish > 0)
                    .map((p) => (
                      <option key={p.id} value={p.code}>
                        {p.code} ({p.species} — {p.currentFish.toLocaleString()} live fish)
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-800/60">
                <div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Large Grade</span>
                  <label htmlFor="qm-harv-lc" className="mt-1.5 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Fish Count
                  </label>
                  <input
                    id="qm-harv-lc"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    placeholder="0"
                    value={largeCount}
                    onChange={(e) => setLargeCount(e.target.value)}
                    className={`${INPUT_CLASS} min-h-[44px] px-3 tabular-nums`}
                  />
                  <label htmlFor="qm-harv-lkg" className="mt-2 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Weight (kg)
                  </label>
                  <input
                    id="qm-harv-lkg"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    placeholder="0.0"
                    value={largeKg}
                    onChange={(e) => setLargeKg(e.target.value)}
                    className={`${INPUT_CLASS} min-h-[44px] px-3 tabular-nums`}
                  />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Medium Grade</span>
                  <label htmlFor="qm-harv-mc" className="mt-1.5 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Fish Count
                  </label>
                  <input
                    id="qm-harv-mc"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    placeholder="0"
                    value={mediumCount}
                    onChange={(e) => setMediumCount(e.target.value)}
                    className={`${INPUT_CLASS} min-h-[44px] px-3 tabular-nums`}
                  />
                  <label htmlFor="qm-harv-mkg" className="mt-2 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Weight (kg)
                  </label>
                  <input
                    id="qm-harv-mkg"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    placeholder="0.0"
                    value={mediumKg}
                    onChange={(e) => setMediumKg(e.target.value)}
                    className={`${INPUT_CLASS} min-h-[44px] px-3 tabular-nums`}
                  />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Small Grade</span>
                  <label htmlFor="qm-harv-sc" className="mt-1.5 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Fish Count
                  </label>
                  <input
                    id="qm-harv-sc"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    placeholder="0"
                    value={smallCount}
                    onChange={(e) => setSmallCount(e.target.value)}
                    className={`${INPUT_CLASS} min-h-[44px] px-3 tabular-nums`}
                  />
                  <label htmlFor="qm-harv-skg" className="mt-2 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Weight (kg)
                  </label>
                  <input
                    id="qm-harv-skg"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    placeholder="0.0"
                    value={smallKg}
                    onChange={(e) => setSmallKg(e.target.value)}
                    className={`${INPUT_CLASS} min-h-[44px] px-3 tabular-nums`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="qm-harv-dmg" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Damaged / Reject (kg)
                  </label>
                  <input
                    id="qm-harv-dmg"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    value={damagedKg}
                    onChange={(e) => setDamagedKg(e.target.value)}
                    className={`${INPUT_CLASS} min-h-[42px] tabular-nums`}
                  />
                </div>
                <div>
                  <label htmlFor="qm-harv-notes" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Harvest Notes
                  </label>
                  <input
                    id="qm-harv-notes"
                    type="text"
                    value={harvNotes}
                    onChange={(e) => setHarvNotes(e.target.value)}
                    className={`${INPUT_CLASS} min-h-[42px]`}
                  />
                </div>
              </div>

              <div className="rounded-xl bg-emerald-50 p-2.5 text-xs text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
                Total Lot Stock: <strong className="tabular-nums">{totalCount.toLocaleString()} fish</strong> ·{' '}
                <strong className="tabular-nums">{totalKg.toFixed(2)} kg</strong> marketable
                {selectedPondObj && (
                  <span className="ml-1 text-emerald-700 dark:text-emerald-300">
                    (Remaining in {selectedPondObj.code}:{' '}
                    {Math.max(0, selectedPondObj.currentFish - totalCount).toLocaleString()} fish)
                  </span>
                )}
              </div>

              <div>
                <label
                  htmlFor="qm-harv-pin"
                  className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  <span>Manager Approval PIN (4 digits) *</span>
                  <ValidCheck valid={/^\d{4}$/.test(pin)} />
                </label>
                <input
                  id="qm-harv-pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="Enter 4-digit PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className={`${INPUT_CLASS} min-h-[44px] font-mono tracking-widest`}
                />
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  variant="warning"
                  size="md"
                  success={saveSuccess}
                  disabled={!perms.canApproveHarvest}
                  onClick={() => submitHarvestLot(false)}
                >
                  Save Harvest Lot
                </Button>
                <Button
                  variant="success"
                  size="md"
                  success={saveSuccess}
                  disabled={!perms.canApproveHarvest}
                  onClick={() => submitHarvestLot(true)}
                >
                  Save Lot & Start Quick Sale
                </Button>
              </div>
            </div>
          );
        })()}

        {/* REPORTS EXPORT */}
        {renderedModal === 'report' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-600 dark:text-slate-400">
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
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Batch Production & Traceability Report</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">All active batches, biomass, mortality & FCR</div>
                </div>
                <FileDown className="h-4 w-4 text-blue-600 dark:text-sky-400" />
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
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Feed Issuance & Variance Audit</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Storekeeper vs Keeper reconciliation logs</div>
                </div>
                <FileDown className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
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
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">TZS Financial & Profitability Ledger</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Revenue, feed expenses, salaries, debts</div>
                </div>
                <FileDown className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
};

interface PondQrModalProps {
  pond: Pond | null;
  state: AquacultureState;
  onClose: () => void;
  onQuickAction: (action: QuickActionType) => void;
}

export const PondQrModal: React.FC<PondQrModalProps> = ({ pond, state, onClose, onQuickAction }) => {
  const [renderedPond, setRenderedPond] = useState<Pond | null>(pond);
  useEffect(() => {
    if (pond) setRenderedPond(pond);
  }, [pond]);

  const activePond = pond || renderedPond;
  const batch = activePond ? state.batches.find((b) => b.pondCode === activePond.code) : undefined;
  const wq = activePond ? state.waterReadings.find((w) => w.pondCode === activePond.code) : undefined;
  const keeper = activePond ? state.employees.find((e) => e.id === activePond.assignedKeeperId) : undefined;
  const farm = activePond ? state.farms.find((f) => f.id === activePond.farmId) : undefined;
  const linkedInfra = activePond
    ? (state.infrastructureMarkers || []).filter(
        (m) => m.pondCode === activePond.code || m.pondId === activePond.id
      )
    : [];

  const cells = activePond
    ? Array.from({ length: 49 }, (_, i) => {
        const hash = (activePond.code.charCodeAt(i % activePond.code.length) * (i + 7)) % 5;
        return hash < 3;
      })
    : [];

  return (
    <Sheet
      open={Boolean(pond)}
      onClose={onClose}
      maxWidthClass="sm:max-w-lg"
      title={
        activePond && (
          <span className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-blue-600 dark:text-sky-400" />
            <span>
              {activePond.name} ({activePond.code}) Digital Twin & QR Profile
            </span>
          </span>
        )
      }
    >
      {activePond && (
        <div className="space-y-3.5">
          <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/70">
            <div className="grid grid-cols-7 gap-0.5 rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600">
              {cells.map((filled, idx) => (
                <div
                  key={idx}
                  className={`h-2.5 w-2.5 ${filled ? 'bg-slate-900' : 'bg-white'}`}
                />
              ))}
            </div>
            <div className="text-xs">
              <div className="font-mono text-[11px] font-semibold text-blue-700 dark:text-sky-400">
                {activePond.qrCodeToken}
              </div>
              <div className="mt-0.5 font-bold text-slate-900 dark:text-white">
                {activePond.species} · {activePond.unitType}
              </div>
              <div className="text-slate-600 dark:text-slate-300">
                Stock: <strong className="tabular-nums">{activePond.currentFish.toLocaleString()}</strong> /{' '}
                {activePond.maxCapacity.toLocaleString()}
              </div>
              <div className="text-slate-500 dark:text-slate-400">
                {farm?.region || 'Farm'} · Keeper: {keeper?.name || 'Assigned'}
              </div>
            </div>
          </div>

          {/* Digital Geographical Identity */}
          <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3 text-xs dark:border-sky-900/60 dark:bg-sky-950/30">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white">
                Digital Geographical Identity
              </span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {activePond.boundaryVerified ? 'Boundary Verified' : 'Pending Verification'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-700 tabular-nums dark:text-slate-300">
              <div>
                Surface Area:{' '}
                <strong>
                  {activePond.areaSqm ? `${activePond.areaSqm.toLocaleString()} m²` : activePond.dimensions}
                </strong>
              </div>
              <div>
                Perimeter:{' '}
                <strong>{activePond.perimeterM ? `${activePond.perimeterM.toLocaleString()} m` : '—'}</strong>
              </div>
              <div>
                Center GPS:{' '}
                <strong className="font-mono">
                  {activePond.gps[0].toFixed(5)}, {activePond.gps[1].toFixed(5)}
                </strong>
              </div>
              <div>
                Corners / Method:{' '}
                <strong>
                  {activePond.boundaryPointsCount || activePond.polygon?.length || 0} pts ·{' '}
                  {activePond.mappingMethod || 'Registry Seed'}
                </strong>
              </div>
            </div>
          </div>

          {/* Infrastructure Relationships */}
          <div className="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
            <div className="mb-1.5 font-bold text-slate-900 dark:text-white">
              Infrastructure Relationships ({linkedInfra.length})
            </div>
            {linkedInfra.length > 0 ? (
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                {linkedInfra.map((inf) => (
                  <div
                    key={inf.id}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-slate-800/70"
                  >
                    <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                      {inf.type}
                    </span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      Mapped
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                No individual inlets, outlets, or aerator markers pinned to {activePond.code} yet. Use Farm Digital Twin map to pin assets.
              </div>
            )}
          </div>

          {batch && (
            <div className="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white">Active Batch: {batch.batchCode}</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">{batch.status}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-slate-600 dark:text-slate-300">
                <div>Avg Wt: <strong>{batch.currentAvgWeightG}g</strong></div>
                <div>Biomass: <strong>{Math.round((batch.currentEstimatedFish * batch.currentAvgWeightG) / 1000)} kg</strong></div>
                <div>Harvest: <strong>{batch.plannedHarvestDate}</strong></div>
              </div>
            </div>
          )}

          {wq && (
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/80">
                <div className="text-[10px] text-slate-500 dark:text-slate-400">pH</div>
                <div className="font-bold text-slate-900 tabular-nums dark:text-white">{wq.ph}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/80">
                <div className="text-[10px] text-slate-500 dark:text-slate-400">DO</div>
                <div className="font-bold text-slate-900 tabular-nums dark:text-white">{wq.dissolvedOxygen} mg/L</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/80">
                <div className="text-[10px] text-slate-500 dark:text-slate-400">Temp</div>
                <div className="font-bold text-slate-900 tabular-nums dark:text-white">{wq.temperature}°C</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/80">
                <div className="text-[10px] text-slate-500 dark:text-slate-400">NH3</div>
                <div className="font-bold text-slate-900 tabular-nums dark:text-white">{wq.ammonia}</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                onClose();
                onQuickAction('feeding');
              }}
            >
              Record Feeding
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                onClose();
                onQuickAction('water');
              }}
            >
              Log Water Reading
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
};
