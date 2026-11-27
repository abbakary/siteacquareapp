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
  CheckCircle2,
  Plus,
  MapPin,
  Navigation,
} from 'lucide-react';
import { AquacultureState, Pond } from '../types/aquaculture';
import { exportToCsv, formatTzs, todayIso } from '../utils/formatters';
import { getPermissions } from '../utils/rbac';
import { tDomain, tr } from '../i18n/translations';
import { Button, FormError, INPUT_CLASS, Sheet, ValidCheck, useLanguage, usePreferences } from '../ui';

const KNOWN_INVENTORY_UNITS = new Set([
  'kg',
  'g',
  'tonnes',
  'bags',
  'litres',
  'ml',
  'bottles',
  'jerrycans',
  'drums',
  'pcs',
  'packs',
  'boxes',
  'cartons',
  'tablets',
  'sachets',
  'vials',
  'tubes',
  'sets',
  'rolls',
  'meters',
  'fish',
]);

function normalizeInventoryUnit(raw?: string): { selectValue: string; customUnit: string } {
  const clean = (raw || '').trim();
  const lower = clean.toLowerCase();
  if (!lower) return { selectValue: 'kg', customUnit: '' };
  const aliasMap: Record<string, string> = {
    kg: 'kg',
    kgs: 'kg',
    kilogram: 'kg',
    kilograms: 'kg',
    g: 'g',
    gm: 'g',
    gram: 'g',
    grams: 'g',
    ton: 'tonnes',
    tons: 'tonnes',
    tonne: 'tonnes',
    tonnes: 'tonnes',
    bag: 'bags',
    bags: 'bags',
    sack: 'bags',
    sacks: 'bags',
    l: 'litres',
    ltr: 'litres',
    ltrs: 'litres',
    liter: 'litres',
    liters: 'litres',
    litre: 'litres',
    litres: 'litres',
    ml: 'ml',
    millilitre: 'ml',
    millilitres: 'ml',
    bottle: 'bottles',
    bottles: 'bottles',
    chupa: 'bottles',
    jerrycan: 'jerrycans',
    jerrycans: 'jerrycans',
    can: 'jerrycans',
    cans: 'jerrycans',
    dumu: 'jerrycans',
    drum: 'drums',
    drums: 'drums',
    pc: 'pcs',
    pcs: 'pcs',
    piece: 'pcs',
    pieces: 'pcs',
    unit: 'pcs',
    units: 'pcs',
    pack: 'packs',
    packs: 'packs',
    packet: 'packs',
    packets: 'packs',
    box: 'boxes',
    boxes: 'boxes',
    carton: 'cartons',
    cartons: 'cartons',
    tablet: 'tablets',
    tablets: 'tablets',
    tab: 'tablets',
    tabs: 'tablets',
    sachet: 'sachets',
    sachets: 'sachets',
    vial: 'vials',
    vials: 'vials',
    tube: 'tubes',
    tubes: 'tubes',
    set: 'sets',
    sets: 'sets',
    roll: 'rolls',
    rolls: 'rolls',
    m: 'meters',
    meter: 'meters',
    meters: 'meters',
    metre: 'meters',
    metres: 'meters',
    fish: 'fish',
    fingerling: 'fish',
    fingerlings: 'fish',
    fry: 'fish',
  };
  const mapped = aliasMap[lower];
  if (mapped && KNOWN_INVENTORY_UNITS.has(mapped)) {
    return { selectValue: mapped, customUnit: '' };
  }
  return { selectValue: 'other', customUnit: clean };
}

function generateAutoSku(
  category: 'Feed' | 'Fingerlings' | 'Medicine' | 'Fuel' | 'Equipment',
  name: string,
  seqSeed: number
): string {
  const prefixMap = {
    Feed: 'FD',
    Fingerlings: 'FG',
    Medicine: 'MD',
    Fuel: 'FL',
    Equipment: 'EQ',
  } as const;
  const slug =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 3) || 'ITM';
  const num = String(101 + Math.max(0, seqSeed)).padStart(3, '0');
  return `${prefixMap[category]}-${slug}-${num}`;
}

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
  onAddInventory: (payload: AddInventoryPayload) => {
    sku: string;
    lotNumber: string;
    itemName: string;
    quantity: number;
    unit: string;
    totalCostTzs: number;
    isNew: boolean;
  } | void;
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
  const { language } = useLanguage();
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
  const [invName, setInvName] = useState<string>('');
  const [invCategory, setInvCategory] = useState<'Feed' | 'Fingerlings' | 'Medicine' | 'Fuel' | 'Equipment'>('Feed');
  const [invQty, setInvQty] = useState<string>('');
  const [invUnitSelect, setInvUnitSelect] = useState<string>('kg');
  const [invCustomUnit, setInvCustomUnit] = useState<string>('');
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
  const [createdPurchaseReceipt, setCreatedPurchaseReceipt] = useState<{
    sku: string;
    lotNumber: string;
    itemName: string;
    category: 'Feed' | 'Fingerlings' | 'Medicine' | 'Fuel' | 'Equipment';
    quantity: number;
    unit: string;
    totalCostTzs: number;
    isNew: boolean;
  } | null>(null);

  const effectiveInvUnit = invUnitSelect === 'other' ? invCustomUnit.trim() || 'pcs' : invUnitSelect;

  const applyExistingItemSelection = (itemId: string) => {
    setInvExistingId(itemId);
    const found = state.inventory.find((i) => i.id === itemId);
    if (found) {
      const normalized = normalizeInventoryUnit(found.unit);
      setInvName(found.name);
      setInvCategory(found.category);
      setInvUnitSelect(normalized.selectValue);
      setInvCustomUnit(normalized.customUnit);
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
  const [symptoms, setSymptoms] = useState('Kupungua kwa hamu ya kula karibu na mlango wa maji');

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
      setCreatedPurchaseReceipt(null);
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
        setInvName('');
        setInvCategory('Feed');
        setInvUnitSelect('kg');
        setInvCustomUnit('');
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
      showValidationError(
        tr(
          language,
          'Imeshindwa kuchambua maelezo ya sauti ya Kiswahili.',
          'Could not parse Swahili voice transcript.'
        )
      );
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
        {renderedModal === 'feeding' &&
          tr(language, 'Rekodi Ulishaji na Uhakiki wa Chakula', 'Record Feeding & Feed Reconciliation')}
        {renderedModal === 'inventory' &&
          tr(language, 'Kuongeza Akiba na Manunuzi ya Bohari', 'Inventory Restock & Purchase Entry')}
        {renderedModal === 'water' &&
          tr(language, 'Rekodi Kipimo cha Ubora wa Maji', 'Record Water Quality Reading')}
        {renderedModal === 'mortality' &&
          tr(language, 'Ripoti Vifo vya Samaki (Kumbukumbu Isiyofutika)', 'Report Fish Mortality (Immutable Log)')}
        {renderedModal === 'harvest' &&
          tr(language, 'Rekodi Kundi la Mavuno (Akiba Iliyopangwa)', 'Record Harvest Lot (Graded Stock)')}
        {renderedModal === 'report' &&
          tr(language, 'Tengeneza Ripoti za Ufuatiliaji na FiRCIS Tanzania', 'Generate Tanzania Traceability & FiRCIS Reports')}
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
                {tr(
                  language,
                  `Tahadhari ya wajibu: Wajibu wa sasa (${tDomain(language, state.activeUser.roleLabel)}) huona au kuidhinisha mipango tu. Badilisha kwenda Msimamizi wa Bwawa au Meneja wa Shamba pembeni kurekodi ulishaji.`,
                  `Role notice: Current role (${state.activeUser.roleLabel}) typically views or approves plans. Switch to Keeper or Farm Manager in the sidebar to record field feeding.`
                )}
              </div>
            )}

            {/* Swahili Voice Reporting Box */}
            <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3 dark:border-sky-900/60 dark:bg-sky-950/40">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-sky-900 dark:text-sky-200">
                  <Mic className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />{' '}
                  {tr(language, 'Mchambuzi wa Sauti / Ripoti ya Kiswahili', 'Swahili Voice / Field Report Parser')}
                </span>
                <Button
                  size="sm"
                  variant="primary"
                  loading={voiceParsing}
                  onClick={handleParseSwahili}
                >
                  {voiceParsing
                    ? tr(language, 'Inachambua...', 'Parsing...')
                    : tr(language, 'Jaza kutoka Kiswahili', 'Auto-Fill from Swahili')}
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
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {tr(language, 'Bwawa', 'Pond')}
                </label>
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
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {tr(language, 'Aina ya Chakula', 'Feed Type')}
                </label>
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
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {tr(language, 'Kilichoidhinishwa (kg)', 'Approved (kg)')}
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={approvedKg}
                  onChange={(e) => setApprovedKg(Number(e.target.value))}
                  className={`${INPUT_CLASS} tabular-nums`}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {tr(language, 'Kilichotolewa Bohari (kg)', 'Store Issued (kg)')}
                </label>
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
                  <span>{tr(language, 'Kilicholishwa Halisi (kg)', 'Actual Fed (kg)')}</span>
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
                {tr(
                  language,
                  `Tahadhari ya Tofauti: Kilichotolewa ${issuedKg} kg dhidi ya Kilicholishwa ${actualFedKg} kg (Tofauti: `,
                  `Variance Alert: Issued ${issuedKg} kg vs Actual Fed ${actualFedKg} kg (Diff: `
                )}
                <strong>{Math.abs(issuedKg - actualFedKg).toFixed(1)} kg</strong>
                {tr(
                  language,
                  ') itaalamishwa kwa uchunguzi wa Meneja.',
                  ') will be flagged for Manager investigation.'
                )}
              </div>
            )}

            <div>
              <label
                htmlFor="qm-feed-pin"
                className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  {tr(language, 'Sahihi ya PIN (PIN ya tarakimu 4)', 'Digital PIN Signature (4-digit PIN)')}
                </span>
                <ValidCheck valid={/^\d{4}$/.test(pin)} />
              </label>
              <input
                id="qm-feed-pin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder={tr(language, 'Weka PIN ya tarakimu 4', 'Enter 4-digit PIN')}
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
                  showValidationError(res.error || tr(language, 'Uthibitishaji wa PIN umeshindikana', 'PIN verification failed'));
                  return;
                }
                setPin('');
                triggerSuccessAndClose();
              }}
            >
              {saveSuccess
                ? tr(language, 'Ulishaji Umehifadhiwa', 'Feeding Saved')
                : tr(language, 'Tuma na Tia Sahihi Rekodi ya Ulishaji', 'Submit & Sign Feeding Log')}
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

          if (createdPurchaseReceipt) {
            return (
              <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-emerald-950 dark:text-emerald-100">
                      {createdPurchaseReceipt.isNew
                        ? tr(language, 'Bidhaa Mpya & Manunuzi Yameundwa!', 'New Product & Purchase Created!')
                        : tr(language, 'Manunuzi & Akiba Vimesasishwa!', 'Purchase & Stock Updated!')}
                    </div>
                    <div className="mt-0.5 text-xs text-emerald-800 dark:text-emerald-300">
                      {createdPurchaseReceipt.itemName} · {createdPurchaseReceipt.quantity} {createdPurchaseReceipt.unit}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-emerald-200/80 bg-white p-3 text-xs dark:border-emerald-900/50 dark:bg-slate-900">
                  <div>
                    <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">
                      {tr(language, 'Msimbo wa Bidhaa (SKU - Otomatiki)', 'Auto-Generated SKU')}
                    </div>
                    <div className="mt-0.5 font-mono text-sm font-extrabold text-[#1D72E8] dark:text-sky-400">
                      {createdPurchaseReceipt.sku}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">
                      {tr(language, 'Namba ya Kundi / Lot', 'Batch / Lot #')}
                    </div>
                    <div className="mt-0.5 font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                      {createdPurchaseReceipt.lotNumber}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">
                      {tr(language, 'Kundi', 'Group')}
                    </div>
                    <div className="mt-0.5 font-bold text-slate-800 dark:text-slate-200">
                      {tDomain(language, createdPurchaseReceipt.category)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">
                      {tr(language, 'Jumla ya Thamani', 'Total Value')}
                    </div>
                    <div className="mt-0.5 font-extrabold text-emerald-700 tabular-nums dark:text-emerald-400">
                      {formatTzs(createdPurchaseReceipt.totalCostTzs)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setCreatedPurchaseReceipt(null);
                      setInvQty('');
                      setInvInvoiceNo('');
                      setInvNotes('');
                      setInvLotNumber(
                        `LOT-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${String(
                          (state.stockPurchases?.length || 0) + 1
                        ).padStart(2, '0')}`
                      );
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    <span>{tr(language, 'Manunuzi Mengine', 'Another Purchase')}</span>
                  </Button>
                  <Button variant="success" onClick={onClose}>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{tr(language, 'Sawa, Funga', 'Done')}</span>
                  </Button>
                </div>
              </div>
            );
          }

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
                  className={`min-h-[40px] rounded-lg px-2.5 text-xs font-bold transition-colors ${
                    invMode === 'existing'
                      ? 'bg-[#136EE6] text-white shadow-xs'
                      : 'text-slate-700 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {tr(
                    language,
                    `Ongeza Iliyopo (${state.inventory.length})`,
                    `Restock Existing (${state.inventory.length})`
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInvMode('new');
                    setInvExistingId('');
                    setInvName('');
                    setInvCategory('Feed');
                    setInvUnitSelect('kg');
                    setInvCustomUnit('');
                    setInvCost('');
                    setInvReorderLevel('50');
                    setInvSupplier('');
                    setInvExpiryDate('');
                  }}
                  className={`min-h-[40px] rounded-lg px-2.5 text-xs font-bold transition-colors ${
                    invMode === 'new'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {tr(language, '+ Bidhaa Mpya', '+ New Product')}
                </button>
              </div>

              {invMode === 'existing' && (
                <div>
                  <label
                    htmlFor="qm-inv-existing"
                    className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    <span>{tr(language, 'Chagua Bidhaa Iliyopo *', 'Select Existing Item / Product *')}</span>
                    <ValidCheck valid={Boolean(selectedExisting)} />
                  </label>
                  <select
                    id="qm-inv-existing"
                    value={invExistingId}
                    onChange={(e) => applyExistingItemSelection(e.target.value)}
                    className={`${INPUT_CLASS} min-h-[44px] font-semibold`}
                  >
                    <option value="">{tr(language, 'Chagua bidhaa ya kuongeza akiba...', 'Choose an item to restock...')}</option>
                    {state.inventory.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({tDomain(language, item.category)} · {item.stock.toLocaleString()} {item.unit})
                      </option>
                    ))}
                  </select>
                  {selectedExisting && (
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-sky-50 px-3 py-1.5 text-[11px] font-medium text-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
                      <span>
                        {tr(language, 'Sasa:', 'Current:')}{' '}
                        <strong className="tabular-nums">
                          {selectedExisting.stock.toLocaleString()} {effectiveInvUnit}
                        </strong>
                      </span>
                      <span>
                        {tr(language, 'Baada ya Manunuzi:', 'After Restock:')}{' '}
                        <strong className="tabular-nums text-emerald-700 dark:text-emerald-300">
                          {(selectedExisting.stock + Math.max(0, parsedQty)).toLocaleString()} {effectiveInvUnit}
                        </strong>
                      </span>
                      <span>
                        {tr(language, 'Bei ya Kawaida:', 'Default Price:')}{' '}
                        <strong className="tabular-nums">{formatTzs(selectedExisting.unitCostTzs)}</strong>
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Product Name (SKU is auto-generated & revealed after creation) */}
              <div>
                <label
                  htmlFor="qm-inv-name"
                  className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  <span className="flex items-center gap-1.5">
                    <span>{tr(language, 'Jina la Bidhaa *', 'Item / Product Name *')}</span>
                    {invMode === 'new' && (
                      <span className="text-[10.5px] font-normal text-slate-400 dark:text-slate-500">
                        · {tr(language, 'SKU huundwa kiotomatiki baada ya kuhifadhi', 'SKU auto-generated on save')}
                      </span>
                    )}
                  </span>
                  <ValidCheck valid={invName.trim().length > 1} />
                </label>
                <input
                  id="qm-inv-name"
                  type="text"
                  readOnly={invMode === 'existing' && Boolean(selectedExisting)}
                  placeholder={tr(language, 'mf. Tilapia Grower Pellets 3mm', 'e.g. Tilapia Grower Pellets 3mm')}
                  value={invName}
                  onChange={(e) => setInvName(e.target.value)}
                  className={`${INPUT_CLASS} min-h-[44px] ${
                    invMode === 'existing' && selectedExisting
                      ? 'border-sky-200 bg-sky-50/50 font-semibold dark:border-sky-900/60 dark:bg-sky-950/25'
                      : ''
                  }`}
                />
              </div>

              {/* Group (Category), Purchase Date, Reorder Level */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="qm-inv-cat"
                    className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    <span>{tr(language, 'Kundi *', 'Group / Category *')}</span>
                    {invMode === 'existing' && selectedExisting && (
                      <span className="rounded bg-[#0B7E91] px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {tr(language, 'Otomatiki', 'Auto')}
                      </span>
                    )}
                  </label>
                  <select
                    id="qm-inv-cat"
                    disabled={invMode === 'existing' && Boolean(selectedExisting)}
                    value={invCategory}
                    onChange={(e) =>
                      setInvCategory(e.target.value as 'Feed' | 'Fingerlings' | 'Medicine' | 'Fuel' | 'Equipment')
                    }
                    className={`${INPUT_CLASS} min-h-[44px] ${
                      invMode === 'existing' && selectedExisting
                        ? 'border-sky-200 bg-sky-50/60 font-semibold opacity-95 dark:border-sky-900/60 dark:bg-sky-950/30'
                        : ''
                    }`}
                  >
                    <option value="Feed">{tDomain(language, 'Feed')}</option>
                    <option value="Fingerlings">{tDomain(language, 'Fingerlings')}</option>
                    <option value="Medicine">{tDomain(language, 'Medicine')}</option>
                    <option value="Fuel">{tDomain(language, 'Fuel')}</option>
                    <option value="Equipment">{tDomain(language, 'Equipment')}</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="qm-inv-date"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {tr(language, 'Tarehe ya Manunuzi *', 'Purchase Date *')}
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
                    {tr(language, 'Kiwango cha Chini', 'Min Reorder Level')}
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

              {/* Quantity, Unit (Kipimo - full catalog), Unit Cost (Price) */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="qm-inv-qty"
                    className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    <span>{tr(language, 'Kiasi Kilichonunuliwa *', 'Quantity Purchased *')}</span>
                    <ValidCheck valid={parsedQty > 0} />
                  </label>
                  <input
                    id="qm-inv-qty"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.5"
                    placeholder={tr(language, 'mf. 500', 'e.g. 500')}
                    value={invQty}
                    onChange={(e) => setInvQty(e.target.value)}
                    className={`${INPUT_CLASS} min-h-[44px] font-bold tabular-nums`}
                  />
                </div>
                <div>
                  <label
                    htmlFor="qm-inv-unit"
                    className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    <span>{tr(language, 'Kipimo *', 'Unit (Kipimo) *')}</span>
                    {invMode === 'existing' && selectedExisting && (
                      <span className="rounded bg-[#0B7E91] px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {tr(language, 'Otomatiki', 'Auto')}
                      </span>
                    )}
                  </label>
                  <select
                    id="qm-inv-unit"
                    disabled={invMode === 'existing' && Boolean(selectedExisting)}
                    value={invUnitSelect}
                    onChange={(e) => setInvUnitSelect(e.target.value)}
                    className={`${INPUT_CLASS} min-h-[44px] ${
                      invMode === 'existing' && selectedExisting
                        ? 'border-sky-200 bg-sky-50/60 font-semibold opacity-95 dark:border-sky-900/60 dark:bg-sky-950/30'
                        : ''
                    }`}
                  >
                    <optgroup label={tr(language, 'Uzito & Mifuko', 'Weight & Bags')}>
                      <option value="kg">{tr(language, 'Kilogramu (kg)', 'Kilograms (kg)')}</option>
                      <option value="g">{tr(language, 'Gramu (g)', 'Grams (g)')}</option>
                      <option value="tonnes">{tr(language, 'Tani (tonnes)', 'Tonnes (t)')}</option>
                      <option value="bags">{tr(language, 'Mifuko (25kg / 50kg)', 'Bags (25kg / 50kg)')}</option>
                    </optgroup>
                    <optgroup label={tr(language, 'Vimiminika & Chupa', 'Liquids & Containers')}>
                      <option value="litres">{tr(language, 'Lita (L)', 'Litres (L)')}</option>
                      <option value="ml">{tr(language, 'Mililita (ml)', 'Millilitres (ml)')}</option>
                      <option value="bottles">{tr(language, 'Chupa (bottles)', 'Bottles')}</option>
                      <option value="jerrycans">{tr(language, 'Madumu / Galoni (20L)', 'Jerrycans (20L)')}</option>
                      <option value="drums">{tr(language, 'Mapipa (200L)', 'Drums (200L)')}</option>
                    </optgroup>
                    <optgroup label={tr(language, 'Dawa, Pakiti & Vifaa', 'Medicine, Packs & Units')}>
                      <option value="pcs">{tr(language, 'Vipande / Kimoja (pcs)', 'Pieces (pcs)')}</option>
                      <option value="packs">{tr(language, 'Pakiti (packs)', 'Packs')}</option>
                      <option value="sachets">{tr(language, 'Sacheti / Vikaratasi', 'Sachets')}</option>
                      <option value="tablets">{tr(language, 'Vidonge (tablets)', 'Tablets')}</option>
                      <option value="vials">{tr(language, 'Chupa Ndogo / Vials', 'Vials / Ampoules')}</option>
                      <option value="tubes">{tr(language, 'Mifereji / Tubes', 'Tubes')}</option>
                      <option value="boxes">{tr(language, 'Bokosi / Sanduku', 'Boxes')}</option>
                      <option value="cartons">{tr(language, 'Katoni (cartons)', 'Cartons')}</option>
                      <option value="sets">{tr(language, 'Seti Kamili (sets)', 'Sets')}</option>
                    </optgroup>
                    <optgroup label={tr(language, 'Urefu & Viumbe Hai', 'Length & Live Stock')}>
                      <option value="rolls">{tr(language, 'Roli (rolls)', 'Rolls')}</option>
                      <option value="meters">{tr(language, 'Mita (m)', 'Meters (m)')}</option>
                      <option value="fish">{tr(language, 'Vifaranga / Samaki Hai', 'Live Fingerlings / Fish')}</option>
                      <option value="other">{tr(language, 'Kipimo Kingine (Andika)...', 'Other Custom Unit...')}</option>
                    </optgroup>
                  </select>
                  {invUnitSelect === 'other' && (
                    <input
                      type="text"
                      value={invCustomUnit}
                      onChange={(e) => setInvCustomUnit(e.target.value)}
                      placeholder={tr(language, 'Andika kipimo mf. Tray / Ndoo', 'Enter unit e.g. Tray / Bucket')}
                      className={`${INPUT_CLASS} mt-1.5 min-h-[38px] text-xs`}
                    />
                  )}
                </div>
                <div>
                  <label
                    htmlFor="qm-inv-cost"
                    className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    <span className="flex items-center gap-1.5">
                      <span>{tr(language, 'Bei kwa Kipimo (TZS) *', 'Unit Price (TZS) *')}</span>
                      {invMode === 'existing' && selectedExisting && (
                        <span className="rounded bg-[#0B7E91] px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {tr(language, 'Otomatiki', 'Auto')}
                        </span>
                      )}
                    </span>
                    <ValidCheck valid={parsedCost > 0} />
                  </label>
                  <input
                    id="qm-inv-cost"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    placeholder={tr(language, 'mf. 2800', 'e.g. 2800')}
                    value={invCost}
                    onChange={(e) => setInvCost(e.target.value)}
                    className={`${INPUT_CLASS} min-h-[44px] font-bold tabular-nums ${
                      invMode === 'existing' && selectedExisting
                        ? 'border-sky-200 bg-sky-50/50 dark:border-sky-900/60 dark:bg-sky-950/25'
                        : ''
                    }`}
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
                    {tr(language, 'Namba ya Kundi / Lot *', 'Batch / Lot Number *')}
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
                    {tr(language, 'Tarehe ya Mwisho (ikiwa ipo)', 'Expiry Date (if perishable)')}
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
                    {tr(language, 'Ankara / GRN # ya Msambazaji', 'Supplier Invoice / GRN #')}
                  </label>
                  <input
                    id="qm-inv-invoice"
                    type="text"
                    placeholder={tr(language, 'mf. SUP-INV-094', 'e.g. SUP-INV-094')}
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
                    <span>{tr(language, 'Jina la Msambazaji *', 'Supplier Name *')}</span>
                    <ValidCheck valid={invSupplier.trim().length > 1} />
                  </label>
                  <input
                    id="qm-inv-supplier"
                    type="text"
                    placeholder={tr(language, 'mf. AquaFeed Tanzania Ltd', 'e.g. AquaFeed Tanzania Ltd')}
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
                    {tr(language, 'Simu ya Msambazaji (Si lazima)', 'Supplier Phone (Optional)')}
                  </label>
                  <input
                    id="qm-inv-supphone"
                    type="tel"
                    placeholder={tr(language, 'mf. +255 713 456 789', 'e.g. +255 713 456 789')}
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
                    {tr(language, 'Hali ya Malipo ya Manunuzi *', 'Purchase Payment Status *')}
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
                    <option value="Paid">{tr(language, 'Imelipwa Yote', 'Paid in Full')}</option>
                    <option value="Partial">{tr(language, 'Malipo ya Sehemu', 'Partial Payment')}</option>
                    <option value="Credit Debt">{tr(language, 'Mkopo / Lipa Baadaye', 'Credit / Pay Later')}</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="qm-inv-paidamt"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {tr(language, 'Kiasi Kilicholipwa Sasa (TZS)', 'Amount Paid Now (TZS)')}
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
                  {tr(language, 'Maelezo ya Uwasilishaji / Ukaguzi wa Ubora', 'Delivery / Quality Inspection Notes')}
                </label>
                <input
                  id="qm-inv-notes"
                  type="text"
                  placeholder={tr(language, 'Hali ilipofika, ghala/chumba cha kuhifadhi, n.k.', 'Condition on arrival, storage warehouse/room, etc.')}
                  value={invNotes}
                  onChange={(e) => setInvNotes(e.target.value)}
                  className={`${INPUT_CLASS} min-h-[42px]`}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/40">
                <span className="text-slate-700 dark:text-slate-300">
                  {tr(language, 'Jumla ya Thamani ya Manunuzi:', 'Total Purchase Value:')}{' '}
                  <strong className="text-sm font-extrabold text-emerald-800 tabular-nums dark:text-emerald-300">
                    {formatTzs(totalCost)}
                  </strong>
                </span>
                <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                  {tr(language, 'Imelipwa:', 'Paid:')} {formatTzs(effectivePaid)} ·{' '}
                  {tr(language, 'Baki:', 'Balance Due:')}{' '}
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
                    showValidationError(
                      tr(
                        language,
                        'Chagua bidhaa iliyopo au badili kwenda Bidhaa Mpya.',
                        'Select an existing inventory item or switch to New Product.'
                      )
                    );
                    return;
                  }
                  if (!invName.trim() || !invSupplier.trim() || !invLotNumber.trim()) {
                    showValidationError(
                      tr(
                        language,
                        'Jina la bidhaa, namba ya lot, na jina la msambazaji vinahitajika.',
                        'Item name, batch/lot number, and supplier name are required.'
                      )
                    );
                    return;
                  }
                  if (invUnitSelect === 'other' && !invCustomUnit.trim()) {
                    showValidationError(
                      tr(
                        language,
                        'Andika jina la kipimo chako kingine.',
                        'Please enter your custom unit name.'
                      )
                    );
                    return;
                  }
                  if (parsedQty <= 0 || parsedCost <= 0) {
                    showValidationError(
                      tr(
                        language,
                        'Weka kiasi > 0 na gharama ya kipimo > 0.',
                        'Enter quantity > 0 and unit cost > 0.'
                      )
                    );
                    return;
                  }
                  if (invPaymentStatus === 'Partial' && (effectivePaid <= 0 || effectivePaid >= totalCost)) {
                    showValidationError(
                      tr(
                        language,
                        'Kwa malipo ya sehemu, weka kiasi kati ya TZS 1 na Jumla - 1.',
                        'For Partial payment, enter an amount paid between TZS 1 and Total Cost - 1.'
                      )
                    );
                    return;
                  }
                  const autoSku =
                    (invMode === 'existing' && selectedExisting?.sku) ||
                    generateAutoSku(invCategory, invName.trim(), state.inventory.length);

                  const created = onAddInventory({
                    mode: invMode,
                    existingItemId: invMode === 'existing' ? invExistingId : undefined,
                    sku: autoSku,
                    name: invName.trim(),
                    category: invCategory,
                    quantity: parsedQty,
                    unit: effectiveInvUnit,
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

                  triggerHaptic(10);
                  setCreatedPurchaseReceipt({
                    sku: created?.sku || autoSku,
                    lotNumber: created?.lotNumber || invLotNumber.trim(),
                    itemName: created?.itemName || invName.trim(),
                    category: invCategory,
                    quantity: parsedQty,
                    unit: effectiveInvUnit,
                    totalCostTzs: totalCost,
                    isNew: created?.isNew ?? invMode === 'new',
                  });
                }}
              >
                {tr(language, 'Hifadhi Manunuzi na Sasisha Bohari', 'Save Purchase & Update Stock')}
              </Button>
            </div>
          );
        })()}

        {/* WATER QUALITY FORM */}
        {renderedModal === 'water' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {tr(language, 'Bwawa', 'Pond')}
                </label>
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
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {tr(language, 'Ngazi ya Ufuatiliaji', 'Monitoring Level')}
                </label>
                <select
                  value={wqSource}
                  onChange={(e) =>
                    setWqSource(
                      e.target.value as 'Manual (Mobile)' | 'Bluetooth Meter' | 'IoT ESP32 Sensor'
                    )
                  }
                  className={INPUT_CLASS}
                >
                  <option value="Manual (Mobile)">
                    {tr(language, 'Ngazi 1: Ingizo la Simu (Mkono)', 'Level 1: Manual Mobile Entry')}
                  </option>
                  <option value="Bluetooth Meter">
                    {tr(language, 'Ngazi 2: Kipima Maji cha Bluetooth', 'Level 2: Bluetooth Water Meter')}
                  </option>
                  <option value="IoT ESP32 Sensor">
                    {tr(language, 'Ngazi 3: Sensor ya IoT ESP32', 'Level 3: ESP32 IoT Sensor')}
                  </option>
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
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {tr(language, 'Joto (°C)', 'Temp (°C)')}
                </label>
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
                {tr(
                  language,
                  'Oksijeni ndogo (< 4.5 mg/L) imebainika: Mfumo utawasha Kipulizia Hewa kiotomatiki na kumjulisha Mtaalamu!',
                  'Low Dissolved Oxygen (< 4.5 mg/L) detected: System will automatically trigger the Pond Aerator Relay and notify the Technician!'
                )}
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
              {saveSuccess
                ? tr(language, 'Kipimo cha Maji Kimehifadhiwa', 'Water Reading Saved')
                : tr(language, 'Hifadhi Kipimo cha Ubora wa Maji', 'Save Water Quality Measurement')}
            </Button>
          </div>
        )}

        {/* MORTALITY FORM */}
        {renderedModal === 'mortality' && (
          <div className="space-y-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-200">
              {tr(
                language,
                'Kanuni ya Uwajibikaji: Rekodi za vifo haziwezi kufutwa baada ya kutumwa. Wasimamizi hawawezi kufuta rekodi au kuidhinisha dawa wenyewe.',
                'Accountability Rule: Mortality records are immutable once submitted. Keepers cannot delete records or self-approve medication.'
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {tr(language, 'Bwawa', 'Pond')}
                </label>
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
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {tr(language, 'Samaki Waliokufa', 'Dead Fish')}
                </label>
                <input
                  type="number"
                  min={1}
                  value={deadCount}
                  onChange={(e) => setDeadCount(Number(e.target.value))}
                  className={`${INPUT_CLASS} tabular-nums`}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {tr(language, 'Walioathirika', 'Affected Fish')}
                </label>
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
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                {tr(language, 'Dalili Zilizoonwa', 'Observed Symptoms')}
              </label>
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
                <span>{tr(language, 'Sahihi ya PIN ya Kidijitali (Namba 4)', 'Digital PIN Signature (4-digit PIN)')}</span>
                <ValidCheck valid={/^\d{4}$/.test(pin)} />
              </label>
              <input
                id="qm-mort-pin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder={tr(language, 'Weka PIN ya namba 4', 'Enter 4-digit PIN')}
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
                  showValidationError(
                    res.error || tr(language, 'Imeshindwa kutuma taarifa ya vifo', 'Unable to submit mortality')
                  );
                  return;
                }
                setPin('');
                triggerSuccessAndClose();
              }}
            >
              {saveSuccess
                ? tr(language, 'Vifo Vimerekodiwa', 'Mortality Logged')
                : tr(language, 'Rekodi Vifo na Mjulishe Mtaalamu', 'Log Mortality & Alert Technician')}
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
              showValidationError(tr(language, 'Tafadhali chagua bwawa la kuvuna.', 'Please select a pond to harvest.'));
              return;
            }
            if (totalCount <= 0) {
              showValidationError(
                tr(language, 'Jumla ya idadi ya samaki waliovunwa lazima iwe zaidi ya 0.', 'Total harvested fish count must be greater than 0.')
              );
              return;
            }
            if (totalCount > selectedPondObj.currentFish) {
              showValidationError(
                tr(
                  language,
                  `Idadi ya mavuno (${totalCount.toLocaleString()}) inazidi samaki hai katika ${selectedPondObj.code} (${selectedPondObj.currentFish.toLocaleString()}).`,
                  `Harvest count (${totalCount.toLocaleString()}) exceeds live fish in ${selectedPondObj.code} (${selectedPondObj.currentFish.toLocaleString()}).`
                )
              );
              return;
            }
            if (totalKg <= 0) {
              showValidationError(
                tr(language, 'Jumla ya uzito unaouzika (kg) lazima iwe zaidi ya 0.', 'Total marketable weight (kg) must be greater than 0.')
              );
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
              showValidationError(res.error || tr(language, 'Mavuno yameshindwa kuhifadhiwa', 'Harvest failed'));
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
                  {tr(
                    language,
                    'Meneja wa Shamba au Mmiliki pekee anaweza kuidhinisha mavuno. Badilisha wajibu kwenye menyu ya pembeni.',
                    'Only Farm Manager or Owner can approve harvests. Switch role in the sidebar to approve.'
                  )}
                </div>
              )}

              <div>
                <label
                  htmlFor="qm-harv-pond"
                  className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  <span>{tr(language, 'Bwawa la Kuvuna *', 'Pond to Harvest *')}</span>
                  <ValidCheck valid={Boolean(selectedPondObj)} />
                </label>
                <select
                  id="qm-harv-pond"
                  value={harvPond}
                  onChange={(e) => setHarvPond(e.target.value)}
                  className={`${INPUT_CLASS} min-h-[44px] font-semibold`}
                >
                  <option value="">{tr(language, 'Chagua bwawa...', 'Select pond...')}</option>
                  {state.ponds
                    .filter((p) => p.currentFish > 0)
                    .map((p) => (
                      <option key={p.id} value={p.code}>
                        {p.code} ({p.species} — {p.currentFish.toLocaleString()} {tr(language, 'samaki hai', 'live fish')})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-800/60">
                <div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {tr(language, 'Daraja Kubwa', 'Large Grade')}
                  </span>
                  <label htmlFor="qm-harv-lc" className="mt-1.5 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    {tr(language, 'Idadi ya Samaki', 'Fish Count')}
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
                    {tr(language, 'Uzito (kg)', 'Weight (kg)')}
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
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {tr(language, 'Daraja la Kati', 'Medium Grade')}
                  </span>
                  <label htmlFor="qm-harv-mc" className="mt-1.5 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    {tr(language, 'Idadi ya Samaki', 'Fish Count')}
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
                    {tr(language, 'Uzito (kg)', 'Weight (kg)')}
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
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {tr(language, 'Daraja Ndogo', 'Small Grade')}
                  </span>
                  <label htmlFor="qm-harv-sc" className="mt-1.5 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    {tr(language, 'Idadi ya Samaki', 'Fish Count')}
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
                    {tr(language, 'Uzito (kg)', 'Weight (kg)')}
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
                    {tr(language, 'Walioharibika / Kukataa (kg)', 'Damaged / Reject (kg)')}
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
                    {tr(language, 'Maelezo ya Mavuno', 'Harvest Notes')}
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
                {tr(language, 'Jumla ya Akiba ya Fungu', 'Total Lot Stock')}:{' '}
                <strong className="tabular-nums">
                  {totalCount.toLocaleString()} {tr(language, 'samaki', 'fish')}
                </strong>{' '}
                · <strong className="tabular-nums">{totalKg.toFixed(2)} kg</strong>{' '}
                {tr(language, 'zinazouzika', 'marketable')}
                {selectedPondObj && (
                  <span className="ml-1 text-emerald-700 dark:text-emerald-300">
                    ({tr(language, 'Wanaobaki katika', 'Remaining in')} {selectedPondObj.code}:{' '}
                    {Math.max(0, selectedPondObj.currentFish - totalCount).toLocaleString()} {tr(language, 'samaki', 'fish')})
                  </span>
                )}
              </div>

              <div>
                <label
                  htmlFor="qm-harv-pin"
                  className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  <span>{tr(language, 'PIN ya Uidhinishaji wa Meneja (namba 4) *', 'Manager Approval PIN (4 digits) *')}</span>
                  <ValidCheck valid={/^\d{4}$/.test(pin)} />
                </label>
                <input
                  id="qm-harv-pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder={tr(language, 'Weka PIN ya namba 4', 'Enter 4-digit PIN')}
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
                  {tr(language, 'Hifadhi Fungu la Mavuno', 'Save Harvest Lot')}
                </Button>
                <Button
                  variant="success"
                  size="md"
                  success={saveSuccess}
                  disabled={!perms.canApproveHarvest}
                  onClick={() => submitHarvestLot(true)}
                >
                  {tr(language, 'Hifadhi Fungu na Anza Uza Haraka', 'Save Lot & Start Quick Sale')}
                </Button>
              </div>
            </div>
          );
        })()}

        {/* REPORTS EXPORT */}
        {renderedModal === 'report' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {tr(
                language,
                'Pakua ripoti za CSV zilizo tayari kwa ukaguzi kulingana na Kanuni za Uvuvi (Ufugaji Samaki) Tanzania 2024 & FiRCIS.',
                'Download audit-ready CSV exports formatted for Tanzania Fisheries (Aquaculture) Regulations 2024 & FiRCIS compliance.'
              )}
            </p>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() =>
                  exportToCsv(
                    `dukaaqusmart-batches-${todayIso()}.csv`,
                    language === 'sw'
                      ? ['Msimbo wa Kundi', 'Aina', 'Bwawa', 'Idadi ya Awali', 'Kadirio Hai', 'Uzito Wastani (g)', 'Chakula (kg)', 'Vifo']
                      : ['Batch Code', 'Species', 'Pond', 'Stocked', 'Estimated Live', 'Avg Weight (g)', 'Feed (kg)', 'Mortality'],
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
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {tr(language, 'Ripoti ya Uzalishaji na Ufuatiliaji wa Makundi', 'Batch Production & Traceability Report')}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {tr(language, 'Makundi yote hai, uzito wa jumla, vifo na FCR', 'All active batches, biomass, mortality & FCR')}
                  </div>
                </div>
                <FileDown className="h-4 w-4 text-blue-600 dark:text-sky-400" />
              </button>
              <button
                type="button"
                onClick={() =>
                  exportToCsv(
                    `dukaaqusmart-feed-audit-${todayIso()}.csv`,
                    language === 'sw'
                      ? ['Tarehe', 'Bwawa', 'Kundi', 'Iliyoidhinishwa kg', 'Iliyotolewa kg', 'Iliyolishwa kg', 'Tofauti kg', 'Hali']
                      : ['Date', 'Pond', 'Batch', 'Approved kg', 'Issued kg', 'Fed kg', 'Variance kg', 'Status'],
                    state.feedIssuances.map((f) => [
                      f.date,
                      f.pondCode,
                      f.batchCode,
                      f.approvedKg,
                      f.issuedByStorekeeperKg,
                      f.actualFedKg ?? 0,
                      f.varianceKg,
                      tDomain(language, f.status),
                    ])
                  )
                }
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {tr(language, 'Ukaguzi wa Utoaji wa Chakula na Tofauti', 'Feed Issuance & Variance Audit')}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {tr(language, 'Uhakiki wa Mtunza Bohari dhidi ya Msimamizi', 'Storekeeper vs Keeper reconciliation logs')}
                  </div>
                </div>
                <FileDown className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </button>
              <button
                type="button"
                onClick={() =>
                  exportToCsv(
                    `dukaaqusmart-finance-tzs-${todayIso()}.csv`,
                    language === 'sw'
                      ? ['Tarehe', 'Aina', 'Kipengele', 'Maelezo', 'Kiasi (TZS)', 'Mhusika', 'Hali']
                      : ['Date', 'Type', 'Category', 'Description', 'Amount (TZS)', 'Counterparty', 'Status'],
                    state.finances.map((t) => [
                      t.date,
                      tDomain(language, t.type),
                      tDomain(language, t.category),
                      t.description,
                      t.amountTzs,
                      t.counterparty,
                      tDomain(language, t.paymentStatus),
                    ])
                  )
                }
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {tr(language, 'Daftari la Fedha (TZS) na Faida', 'TZS Financial & Profitability Ledger')}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {tr(language, 'Mapato, gharama za chakula, mishahara na madeni', 'Revenue, feed expenses, salaries, debts')}
                  </div>
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
  const { language } = useLanguage();
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

  const [resolvedPlaces, setResolvedPlaces] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!pond || state.offlineMode) return;
    const coordKey = `${pond.gps[0].toFixed(5)},${pond.gps[1].toFixed(5)}`;
    if (resolvedPlaces[coordKey]) return;

    let cancelled = false;
    fetch(
      `/api/gis/reverse-geocode?lat=${encodeURIComponent(pond.gps[0])}&lng=${encodeURIComponent(pond.gps[1])}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { placeName?: string; shortName?: string } | null) => {
        if (cancelled || !data?.placeName) return;
        // Only cache real human-readable names, not raw coordinate fallbacks
        const looksLikeRawCoords = /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(data.placeName.trim());
        if (!looksLikeRawCoords) {
          setResolvedPlaces((prev) => ({ ...prev, [coordKey]: data.placeName! }));
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [pond, state.offlineMode, resolvedPlaces]);

  const activeCoordKey = activePond
    ? `${activePond.gps[0].toFixed(5)},${activePond.gps[1].toFixed(5)}`
    : '';
  const readableLocation = activePond
    ? resolvedPlaces[activeCoordKey] ||
      farm?.placeName ||
      farm?.name ||
      farm?.region ||
      tr(language, 'Eneo la Shamba Tanzania', 'Tanzania Aquaculture Site')
    : '';

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
              {activePond.name} ({activePond.code}) {tr(language, 'Wasifu wa QR na Pacha wa Kidijitali', 'Digital Twin & QR Profile')}
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
                {activePond.species} · {tDomain(language, activePond.unitType)}
              </div>
              <div className="text-slate-600 dark:text-slate-300">
                {tr(language, 'Akiba', 'Stock')}: <strong className="tabular-nums">{activePond.currentFish.toLocaleString()}</strong> /{' '}
                {activePond.maxCapacity.toLocaleString()}
              </div>
              <div className="text-slate-500 dark:text-slate-400">
                {farm?.region || tr(language, 'Shamba', 'Farm')} · {tr(language, 'Msimamizi', 'Keeper')}:{' '}
                {keeper?.name || tr(language, 'Aliyepangiwa', 'Assigned')}
              </div>
            </div>
          </div>

          {/* Digital Geographical Identity */}
          <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3 text-xs dark:border-sky-900/60 dark:bg-sky-950/30">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white">
                {tr(language, 'Utambulisho wa Kijiografia wa Kidijitali', 'Digital Geographical Identity')}
              </span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {activePond.boundaryVerified
                  ? tr(language, 'Mpaka Umethibitishwa', 'Boundary Verified')
                  : tr(language, 'Inasubiri Uthibitisho', 'Pending Verification')}
              </span>
            </div>

            {/* Real Location Name & Directions */}
            <div className="mb-2.5 rounded-lg border border-sky-200/80 bg-white/90 p-2.5 dark:border-sky-800/60 dark:bg-slate-900/70">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#1D72E8] dark:text-sky-400" />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {tr(language, 'Mahali Halisi na Njia ya Kufika', 'Real Location & Directions')}
                    </div>
                    <div className="mt-0.5 text-xs font-bold text-slate-900 dark:text-white">
                      {readableLocation}
                    </div>
                    {farm && (
                      <div className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                        {farm.name} · {farm.waterSource}
                      </div>
                    )}
                    <div className="mt-1 font-mono text-[10.5px] text-slate-500 tabular-nums dark:text-slate-400">
                      {tr(language, 'Majira ya GPS:', 'GPS Coordinates:')} {activePond.gps[0].toFixed(5)}, {activePond.gps[1].toFixed(5)}
                    </div>
                  </div>
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${activePond.gps[0].toFixed(6)},${activePond.gps[1].toFixed(6)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#1D72E8] px-2.5 py-1.5 text-[11px] font-bold text-white shadow-xs hover:bg-blue-700"
                >
                  <Navigation className="h-3 w-3" />
                  <span>{tr(language, 'Elekeza', 'Navigate')}</span>
                </a>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-700 tabular-nums dark:text-slate-300">
              <div>
                {tr(language, 'Eneo la Juu', 'Surface Area')}:{' '}
                <strong>
                  {activePond.areaSqm ? `${activePond.areaSqm.toLocaleString()} m²` : activePond.dimensions}
                </strong>
              </div>
              <div>
                {tr(language, 'Mzingo', 'Perimeter')}:{' '}
                <strong>{activePond.perimeterM ? `${activePond.perimeterM.toLocaleString()} m` : '—'}</strong>
              </div>
              <div>
                {tr(language, 'Ukubwa wa Maji', 'Water Volume')}:{' '}
                <strong>{activePond.waterCapacityM3.toLocaleString()} m³</strong>
              </div>
              <div>
                {tr(language, 'Pembe / Mbinu', 'Corners / Method')}:{' '}
                <strong>
                  {activePond.boundaryPointsCount || activePond.polygon?.length || 0} {tr(language, 'alama', 'pts')} ·{' '}
                  {tDomain(language, activePond.mappingMethod || 'Registry Seed')}
                </strong>
              </div>
            </div>
          </div>

          {/* Infrastructure Relationships */}
          <div className="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
            <div className="mb-1.5 font-bold text-slate-900 dark:text-white">
              {tr(language, 'Miundombinu Iliyounganishwa', 'Infrastructure Relationships')} ({linkedInfra.length})
            </div>
            {linkedInfra.length > 0 ? (
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                {linkedInfra.map((inf) => (
                  <div
                    key={inf.id}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-slate-800/70"
                  >
                    <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                      {tDomain(language, inf.type)}
                    </span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {tr(language, 'Imepimwa', 'Mapped')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {tr(
                  language,
                  `Hakuna alama za kuingiza/kutoa maji au kipulizia hewa zilizowekwa kwa ${activePond.code} bado. Tumia ramani ya shamba kuweka alama.`,
                  `No individual inlets, outlets, or aerator markers pinned to ${activePond.code} yet. Use Farm Digital Twin map to pin assets.`
                )}
              </div>
            )}
          </div>

          {batch && (
            <div className="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white">
                  {tr(language, 'Kundi Hai', 'Active Batch')}: {batch.batchCode}
                </span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {tDomain(language, batch.status)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-slate-600 dark:text-slate-300">
                <div>{tr(language, 'Uzito Wastani', 'Avg Wt')}: <strong>{batch.currentAvgWeightG}g</strong></div>
                <div>{tr(language, 'Uzito Hai', 'Biomass')}: <strong>{Math.round((batch.currentEstimatedFish * batch.currentAvgWeightG) / 1000)} kg</strong></div>
                <div>{tr(language, 'Mavuno', 'Harvest')}: <strong>{batch.plannedHarvestDate}</strong></div>
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
                <div className="text-[10px] text-slate-500 dark:text-slate-400">{tr(language, 'Joto', 'Temp')}</div>
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
              {tr(language, 'Rekodi Ulishaji', 'Record Feeding')}
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                onClose();
                onQuickAction('water');
              }}
            >
              {tr(language, 'Rekodi Ubora wa Maji', 'Log Water Reading')}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
};
