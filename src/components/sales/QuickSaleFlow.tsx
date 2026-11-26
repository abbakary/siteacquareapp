import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Fish,
  Loader2,
  Lock,
  Plus,
  Printer,
  Search,
  Sprout,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import {
  AquacultureState,
  Customer,
  FishGrade,
  Language,
  PaymentMethod,
  PreOrder,
  Sale,
} from '../../types/aquaculture';
import { formatNumber, formatTzs, todayIso } from '../../utils/formatters';
import { getPermissions } from '../../utils/rbac';
import {
  formatTzPhoneDisplay,
  getCustomerOutstandingBalance,
  getLotRemainingForGrade,
  getLotTotalRemainingKg,
  getPriceForItem,
  normalizeTzPhone,
  roundKg,
  roundTzs,
} from '../../utils/sales';
import { TRANSLATIONS, tDomain, tr } from '../../i18n/translations';
import {
  Button,
  CountUpNumber,
  DURATIONS,
  EASE_OUT,
  FormError,
  INPUT_CLASS,
  SuccessMoment,
  ValidCheck,
  usePreferences,
} from '../../ui';

const PAYMENT_OPTIONS: Array<{
  id: PaymentMethod | 'Credit';
  swLabel: string;
  enLabel: string;
  isCredit?: boolean;
}> = [
  { id: 'Cash', swLabel: 'Taslimu', enLabel: 'Cash' },
  { id: 'M-Pesa', swLabel: 'M-Pesa', enLabel: 'M-Pesa' },
  { id: 'Tigo Pesa', swLabel: 'Tigo Pesa', enLabel: 'Tigo Pesa' },
  { id: 'Airtel Money', swLabel: 'Airtel Money', enLabel: 'Airtel Money' },
  { id: 'Halopesa', swLabel: 'Halopesa', enLabel: 'Halopesa' },
  { id: 'Bank Transfer', swLabel: 'Benki', enLabel: 'Bank transfer' },
  { id: 'Cheque', swLabel: 'Hundi', enLabel: 'Cheque' },
  { id: 'Credit', swLabel: 'Mkopo (lipa baadaye)', enLabel: 'Credit (pay later)', isCredit: true },
];

const DELIVERY_STATUS_OPTIONS: Array<{
  value: Sale['deliveryStatus'];
  swLabel: string;
  enLabel: string;
}> = [
  { value: 'Pending Dispatch', swLabel: 'Inasubiri Kusafirishwa', enLabel: 'Pending dispatch' },
  { value: 'In Transit', swLabel: 'Njiani', enLabel: 'In transit' },
  { value: 'Delivered', swLabel: 'Imefika', enLabel: 'Delivered' },
];

const FLEET_VEHICLE_OPTIONS: Array<{ value: string; swLabel: string; enLabel: string }> = [
  {
    value: 'T 482 DKP — Driver: Juma Salum',
    swLabel: 'T 482 DKP — Dereva: Juma Salum',
    enLabel: 'T 482 DKP — Driver: Juma Salum',
  },
  {
    value: 'T 619 DQA — Driver: Hassan Bakari',
    swLabel: 'T 619 DQA — Dereva: Hassan Bakari',
    enLabel: 'T 619 DQA — Driver: Hassan Bakari',
  },
  {
    value: 'T 204 DKM — Chilled Van (Kariakoo Route)',
    swLabel: 'T 204 DKM — Gari la Baridi (Njia ya Kariakoo)',
    enLabel: 'T 204 DKM — Chilled Van (Kariakoo Route)',
  },
  {
    value: 'Farm Gate Pickup',
    swLabel: 'Kuchukulia Shambani',
    enLabel: 'Farm Gate Pickup',
  },
];

const GRADES: FishGrade[] = ['Large', 'Medium', 'Small'];
const TAX_RATE = 0.18;

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `qs-${crypto.randomUUID()}`;
  }
  return `qs-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function formatReadableDate(iso: string, language: Language): string {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString(language === 'sw' ? 'sw-TZ' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function previewAutoHarvestLotCode(sequence: number, dateIso: string): string {
  const mm = dateIso.slice(5, 7) || '11';
  const dd = dateIso.slice(8, 10) || '26';
  const seq = String((sequence % 999) + 1).padStart(3, '0');
  return `HL-${mm}${dd}-${seq}`;
}

export interface QuickSaleSubmitPayload {
  idempotencyKey: string;
  customerId: string;
  lines: Array<{
    sourceType: 'lot' | 'pond';
    lotId?: string;
    pondCode: string;
    batchCode: string;
    species: string;
    grade: FishGrade;
    kg: number;
    count: number;
    pricePerKgTzs: number;
  }>;
  discountTzs: number;
  discountReason: string;
  applyTax: boolean;
  paidTzs: number;
  paymentMethod: PaymentMethod;
  paymentReference: string;
  deliveryStatus: Sale['deliveryStatus'];
  deliveryAddress: string;
  vehicleOrDriver: string;
  pin?: string;
  preOrderId?: string;
}

export interface QuickSaleSubmitResult {
  ok: boolean;
  sale?: Sale;
  error?: string;
  duplicate?: boolean;
}

interface DraftLine {
  id: string;
  sourceType: 'lot' | 'pond';
  lotId?: string;
  lotCode?: string;
  pondCode: string;
  batchCode: string;
  species: string;
  grade: FishGrade;
  kg: number;
  count: number;
  pricePerKgTzs: number;
}

interface QuickSaleFlowProps {
  open: boolean;
  state: AquacultureState;
  language: Language;
  initialLotId?: string;
  initialPondCode?: string;
  initialPreOrder?: PreOrder | null;
  triggerKey?: number;
  onClose: () => void;
  onSaleConfirmed?: (sale?: Sale) => void;
  onQuickCreateCustomer: (payload: { name: string; phone: string }) => {
    ok: boolean;
    customer?: Customer;
    error?: string;
  };
  onSubmitSale: (payload: QuickSaleSubmitPayload) => Promise<QuickSaleSubmitResult>;
}

const stepPanelVariants = {
  enter: (dir: number) => ({
    opacity: 0,
    x: dir >= 0 ? 22 : -22,
  }),
  center: {
    opacity: 1,
    x: 0,
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir >= 0 ? -22 : 22,
  }),
};

export const QuickSaleFlow: React.FC<QuickSaleFlowProps> = ({
  open,
  state,
  language,
  initialLotId,
  initialPondCode,
  initialPreOrder,
  triggerKey = 0,
  onClose,
  onSaleConfirmed,
  onQuickCreateCustomer,
  onSubmitSale,
}) => {
  const perms = getPermissions(state.activeUser.role);
  const { effectiveReducedMotion } = usePreferences();

  const weightInputRef = useRef<HTMLInputElement | null>(null);
  const paidInputRef = useRef<HTMLInputElement | null>(null);
  const submitLockRef = useRef<boolean>(false);

  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [stepDirection, setStepDirection] = useState<number>(1);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => generateIdempotencyKey());
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [celebratingSale, setCelebratingSale] = useState<{
    invoiceNo?: string;
    customerName: string;
  } | null>(null);

  // Step 1: Customer
  const [customerSearch, setCustomerSearch] = useState('');
  const [recentOnly, setRecentOnly] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustError, setNewCustError] = useState('');
  const [newCustShake, setNewCustShake] = useState(0);

  // Step 2: Fish & Weight
  const availableLots = useMemo(
    () => state.harvestLots.filter((l) => getLotTotalRemainingKg(l) > 0),
    [state.harvestLots]
  );
  const activePonds = useMemo(
    () => state.ponds.filter((p) => p.currentFish > 0),
    [state.ponds]
  );

  const [sourceMode, setSourceMode] = useState<'pond' | 'lot'>('pond');
  const [selectedLotId, setSelectedLotId] = useState<string>('');
  const [selectedPondCode, setSelectedPondCode] = useState<string>('');
  const [grade, setGrade] = useState<FishGrade>('Large');
  const [kgInput, setKgInput] = useState<string>('');
  const [countInput, setCountInput] = useState<string>('');
  const [customPriceInput, setCustomPriceInput] = useState<string>('');
  const [priceManuallyEdited, setPriceManuallyEdited] = useState<boolean>(false);
  const [weighError, setWeighError] = useState<string>('');
  const [weighShake, setWeighShake] = useState(0);
  const [lines, setLines] = useState<DraftLine[]>([]);

  // Step 3: Payment & Dispatch
  const [discountInput, setDiscountInput] = useState<string>('0');
  const [discountReason, setDiscountReason] = useState<string>('');
  const [applyTax, setApplyTax] = useState<boolean>(true);
  const [creditPayLater, setCreditPayLater] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    state.salesPreferences.lastPaymentMethod || 'Cash'
  );
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [paidInput, setPaidInput] = useState<string>('0');
  const [paidManuallyEdited, setPaidManuallyEdited] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState<Sale['deliveryStatus']>('Pending Dispatch');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [vehiclePreset, setVehiclePreset] = useState<string>(FLEET_VEHICLE_OPTIONS[0].value);
  const [customVehicle, setCustomVehicle] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [submitError, setSubmitError] = useState<string>('');
  const [submitShake, setSubmitShake] = useState(0);

  const resetWizardState = () => {
    submitLockRef.current = false;
    setIsSubmitting(false);
    setIdempotencyKey(generateIdempotencyKey());
    setCelebratingSale(null);
    setStepDirection(1);
    setCustomerSearch('');
    setRecentOnly(false);
    setShowNewCustomer(false);
    setNewCustName('');
    setNewCustPhone('');
    setNewCustError('');
    setWeighError('');
    setSubmitError('');
    setPin('');
    setDiscountInput('0');
    setDiscountReason('');
    setApplyTax(true);
    setCreditPayLater(false);
    setPaymentReference('');
    setPaidManuallyEdited(false);
    setDeliveryStatus('Pending Dispatch');
    setVehiclePreset(FLEET_VEHICLE_OPTIONS[0].value);
    setCustomVehicle('');
    setKgInput('');
    setCountInput('');
    setPriceManuallyEdited(false);
    setLines([]);
    setPaymentMethod(state.salesPreferences.lastPaymentMethod || 'Cash');

    if (initialPreOrder) {
      const cust = state.customers.find((c) => c.id === initialPreOrder.customerId);
      setSelectedCustomerId(cust?.id || '');
      setDeliveryAddress(cust?.location || '');
      setGrade(initialPreOrder.grade);
      setKgInput(String(initialPreOrder.requestedKg));
      const matchingLot = availableLots.find(
        (l) =>
          l.species === initialPreOrder.species &&
          getLotRemainingForGrade(l, initialPreOrder.grade) >= initialPreOrder.requestedKg
      );
      if (matchingLot) {
        setSourceMode('lot');
        setSelectedLotId(matchingLot.id);
      } else {
        setSourceMode(availableLots.length > 0 ? 'lot' : 'pond');
        setSelectedLotId(availableLots[0]?.id || '');
      }
      setSelectedPondCode(activePonds[0]?.code || '');
      setWizardStep(2);
    } else if (initialLotId) {
      const lastCustId = state.salesPreferences.lastCustomerId || state.customers[0]?.id || '';
      setSelectedCustomerId(lastCustId);
      const cust = state.customers.find((c) => c.id === lastCustId);
      setDeliveryAddress(cust?.location || '');
      setSourceMode('lot');
      setSelectedLotId(initialLotId);
      setSelectedPondCode(activePonds[0]?.code || '');
      setWizardStep(2);
    } else if (initialPondCode) {
      const lastCustId = state.salesPreferences.lastCustomerId || state.customers[0]?.id || '';
      setSelectedCustomerId(lastCustId);
      const cust = state.customers.find((c) => c.id === lastCustId);
      setDeliveryAddress(cust?.location || '');
      setSourceMode('pond');
      setSelectedLotId(availableLots[0]?.id || '');
      setSelectedPondCode(initialPondCode);
      setWizardStep(2);
    } else {
      const lastCustId = state.salesPreferences.lastCustomerId || state.customers[0]?.id || '';
      setSelectedCustomerId(lastCustId);
      const cust = state.customers.find((c) => c.id === lastCustId);
      setDeliveryAddress(cust?.location || '');
      setSourceMode(activePonds.length > 0 ? 'pond' : 'lot');
      setSelectedLotId(availableLots[0]?.id || '');
      setSelectedPondCode(activePonds[0]?.code || '');
      setWizardStep(1);
    }
  };

  useEffect(() => {
    if (!open) return;
    resetWizardState();
  }, [open, initialLotId, initialPondCode, initialPreOrder, triggerKey]);

  const selectedCustomer = state.customers.find((c) => c.id === selectedCustomerId) || null;
  const selectedLot =
    state.harvestLots.find((l) => l.id === selectedLotId) || availableLots[0] || null;
  const selectedPond =
    state.ponds.find((p) => p.code === selectedPondCode) || activePonds[0] || null;

  const activeSpecies =
    sourceMode === 'lot'
      ? selectedLot?.species || 'Nile Tilapia'
      : selectedPond?.species || 'Nile Tilapia';

  const autoPricePerKg = useMemo(() => {
    if (
      sourceMode === 'lot' &&
      initialPreOrder &&
      selectedLot &&
      initialPreOrder.species === selectedLot.species &&
      initialPreOrder.grade === grade
    ) {
      return initialPreOrder.agreedPricePerKgTzs;
    }
    return (
      getPriceForItem(
        state.priceList,
        activeSpecies,
        grade,
        selectedCustomer?.priceTier || 'Standard',
        state.salesPreferences.lastPricesByKey
      ) || 8500
    );
  }, [
    sourceMode,
    initialPreOrder,
    selectedLot,
    activeSpecies,
    grade,
    selectedCustomer,
    state.priceList,
    state.salesPreferences.lastPricesByKey,
  ]);

  useEffect(() => {
    if (!priceManuallyEdited) {
      setCustomPriceInput(String(autoPricePerKg));
    }
  }, [autoPricePerKg, priceManuallyEdited]);

  const activeDraftPricePerKg = useMemo(() => {
    const parsed = roundTzs(Number(customPriceInput));
    return perms.canOverrideSalePrice && Number.isFinite(parsed) && parsed > 0
      ? parsed
      : autoPricePerKg;
  }, [customPriceInput, autoPricePerKg, perms.canOverrideSalePrice]);

  const draftKgNum = Math.max(0, roundKg(Number(kgInput) || 0));
  const draftCountNum = Math.max(0, Math.round(Number(countInput) || 0));
  const draftLineTotalTzs = roundTzs(draftKgNum * activeDraftPricePerKg);

  const draftAvgKgPerFish = useMemo(() => {
    if (draftKgNum > 0 && draftCountNum > 0) {
      return draftKgNum / draftCountNum;
    }
    if (sourceMode === 'pond' && selectedPond) {
      const batch = state.batches.find((b) => b.pondCode === selectedPond.code);
      if (batch && batch.currentAvgWeightG > 0) {
        return batch.currentAvgWeightG / 1000;
      }
    }
    return 0.45;
  }, [draftKgNum, draftCountNum, sourceMode, selectedPond, state.batches]);

  const handleSelectCustomer = (cust: Customer) => {
    setSelectedCustomerId(cust.id);
    setDeliveryAddress(cust.location || '');
    setSubmitError('');
    setPriceManuallyEdited(false);
    setLines((prev) =>
      prev.map((ln) => {
        const tierPrice = getPriceForItem(
          state.priceList,
          ln.species,
          ln.grade,
          cust.priceTier,
          state.salesPreferences.lastPricesByKey
        );
        return tierPrice > 0 ? { ...ln, pricePerKgTzs: tierPrice } : ln;
      })
    );
  };

  const renderGradeLabel = (g: FishGrade) =>
    g === 'Large'
      ? tr(language, 'Kubwa', 'Large')
      : g === 'Medium'
        ? tr(language, 'Saizi ya Kati', 'Medium')
        : tr(language, 'Ndogo', 'Small');

  const goToStep = (next: 1 | 2 | 3) => {
    if (next === wizardStep) return;
    if (next >= 2 && !selectedCustomer) {
      setSubmitError(tr(language, 'Tafadhali chagua mteja kwanza.', 'Please select a customer first.'));
      return;
    }
    if (next === 3 && lines.length === 0) {
      setWeighError(
        tr(
          language,
          'Ongeza angalau kipimo kimoja cha samaki kabla ya kuendelea na malipo.',
          'Add at least one fish weighing line before proceeding to payment.'
        )
      );
      setWeighShake((s) => s + 1);
      return;
    }
    setSubmitError('');
    setWeighError('');
    setStepDirection(next > wizardStep ? 1 : -1);
    setWizardStep(next);
    if (next === 2) {
      window.setTimeout(() => weightInputRef.current?.focus(), 220);
    } else if (next === 3) {
      window.setTimeout(() => paidInputRef.current?.focus(), 220);
    }
  };

  // Totals (Subtotal, Discount, VAT 18%, Total Payable)
  const totalKg = roundKg(lines.reduce((sum, l) => sum + l.kg, 0));
  const subtotalTzs = roundTzs(
    lines.reduce((sum, l) => sum + roundTzs(l.kg * l.pricePerKgTzs), 0)
  );
  const discountTzs = Math.min(subtotalTzs, Math.max(0, roundTzs(Number(discountInput) || 0)));
  const taxableBaseTzs = Math.max(0, subtotalTzs - discountTzs);
  const taxTzs = applyTax ? roundTzs(taxableBaseTzs * TAX_RATE) : 0;
  const totalTzs = roundTzs(taxableBaseTzs + taxTzs);

  useEffect(() => {
    if (!paidManuallyEdited && !creditPayLater) {
      setPaidInput(String(totalTzs));
    }
  }, [totalTzs, paidManuallyEdited, creditPayLater]);

  const orderedCustomers = useMemo(() => {
    const ordered: Customer[] = [];
    if (state.salesPreferences.lastCustomerId) {
      const last = state.customers.find((c) => c.id === state.salesPreferences.lastCustomerId);
      if (last) ordered.push(last);
    }
    state.sales.forEach((s) => {
      const c = state.customers.find((cu) => cu.id === s.customerId);
      if (c && !ordered.some((o) => o.id === c.id)) ordered.push(c);
    });
    if (!recentOnly) {
      state.customers.forEach((c) => {
        if (!ordered.some((o) => o.id === c.id)) ordered.push(c);
      });
    }
    return ordered;
  }, [state.customers, state.sales, state.salesPreferences.lastCustomerId, recentOnly]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return orderedCustomers;
    const q = customerSearch.toLowerCase();
    const digits = q.replace(/\D/g, '');
    return orderedCustomers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (digits.length > 0 && c.phone.includes(digits)) ||
        c.location.toLowerCase().includes(q) ||
        c.type.toLowerCase().includes(q)
    );
  }, [orderedCustomers, customerSearch]);

  const getAvailableKgForSelected = (targetGrade: FishGrade): number => {
    if (sourceMode === 'lot' && selectedLot) {
      const lotRem = getLotRemainingForGrade(selectedLot, targetGrade);
      const alreadyDrafted = lines
        .filter((l) => l.lotId === selectedLot.id && l.grade === targetGrade)
        .reduce((sum, l) => sum + l.kg, 0);
      return roundKg(Math.max(0, lotRem - alreadyDrafted));
    }
    if (sourceMode === 'pond' && selectedPond) {
      const batch = state.batches.find((b) => b.pondCode === selectedPond.code);
      const avgKg = batch ? Math.max(0.15, batch.currentAvgWeightG / 1000) : 0.35;
      const estTotalKg = roundKg(selectedPond.currentFish * avgKg);
      const alreadyDrafted = lines
        .filter((l) => l.sourceType === 'pond' && l.pondCode === selectedPond.code)
        .reduce((sum, l) => sum + l.kg, 0);
      return roundKg(Math.max(0, estTotalKg - alreadyDrafted));
    }
    return 0;
  };

  const handleAddNewCustomer = () => {
    setNewCustError('');
    if (!newCustName.trim()) {
      setNewCustError(
        language === 'sw' ? 'Jina la mteja linahitajika.' : 'Customer name is required.'
      );
      setNewCustShake((s) => s + 1);
      return;
    }
    const normalized = normalizeTzPhone(newCustPhone);
    if (!normalized) {
      setNewCustError(
        language === 'sw'
          ? 'Namba sahihi ya simu ya Tanzania inahitajika (07... au 255...).'
          : 'Enter a valid Tanzanian phone number (e.g. 0712345678).'
      );
      setNewCustShake((s) => s + 1);
      return;
    }
    const res = onQuickCreateCustomer({ name: newCustName.trim(), phone: normalized });
    if (!res.ok || !res.customer) {
      setNewCustError(
        res.error || tr(language, 'Imeshindikana kusajili mteja.', 'Could not create customer.')
      );
      setNewCustShake((s) => s + 1);
      return;
    }
    handleSelectCustomer(res.customer);
    setShowNewCustomer(false);
    setNewCustName('');
    setNewCustPhone('');
  };

  const handleAddWeighing = () => {
    setWeighError('');
    setSubmitError('');
    const kg = roundKg(Number(kgInput));
    const count = Math.max(0, Math.round(Number(countInput) || 0));

    if (!Number.isFinite(kg) || kg <= 0) {
      setWeighError(
        language === 'sw' ? 'Weka uzito sahihi (kg > 0).' : 'Enter a valid weight greater than 0 kg.'
      );
      setWeighShake((s) => s + 1);
      return;
    }

    const avail = getAvailableKgForSelected(grade);
    if (kg > avail) {
      setWeighError(
        language === 'sw'
          ? `Uzito umezidi akiba iliyopo (${avail.toFixed(2)} kg tu zipo kwa ${renderGradeLabel(grade)}).`
          : `Weight exceeds available stock (only ${avail.toFixed(2)} kg available for ${grade}).`
      );
      setWeighShake((s) => s + 1);
      return;
    }

    if (sourceMode === 'lot') {
      if (!selectedLot) {
        setWeighError(tr(language, 'Chagua kundi la mavuno kwanza.', 'Select a harvest lot first.'));
        setWeighShake((s) => s + 1);
        return;
      }

      setLines((prev) => [
        ...prev,
        {
          id: `dl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          sourceType: 'lot',
          lotId: selectedLot.id,
          lotCode: selectedLot.lotCode,
          pondCode: selectedLot.pondCode,
          batchCode: selectedLot.batchCode,
          species: selectedLot.species,
          grade,
          kg,
          count,
          pricePerKgTzs: activeDraftPricePerKg,
        },
      ]);
    } else {
      if (!selectedPond) {
        setWeighError(tr(language, 'Chagua bwawa hai kwanza.', 'Select an active pond first.'));
        setWeighShake((s) => s + 1);
        return;
      }
      const batch = state.batches.find((b) => b.pondCode === selectedPond.code);
      if (count > selectedPond.currentFish) {
        setWeighError(
          tr(
            language,
            `Idadi ya samaki (${count}) imezidi samaki hai kwenye ${selectedPond.code} (${selectedPond.currentFish}).`,
            `Fish count (${count}) exceeds live fish in ${selectedPond.code} (${selectedPond.currentFish}).`
          )
        );
        setWeighShake((s) => s + 1);
        return;
      }

      setLines((prev) => [
        ...prev,
        {
          id: `dl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          sourceType: 'pond',
          pondCode: selectedPond.code,
          batchCode: batch?.batchCode || 'DIRECT',
          species: selectedPond.species,
          grade,
          kg,
          count,
          pricePerKgTzs: activeDraftPricePerKg,
        },
      ]);
    }

    setKgInput('');
    setCountInput('');
    setPriceManuallyEdited(false);
  };

  // Payment, credit & validation checks
  const paidTzs = roundTzs(Number(paidInput) || 0);
  const balanceTzs = Math.max(0, totalTzs - paidTzs);
  const currentDebt = selectedCustomer
    ? getCustomerOutstandingBalance(state.sales, selectedCustomer.id)
    : 0;
  const projectedDebt = currentDebt + balanceTzs;
  const exceedsCreditLimit =
    selectedCustomer !== null &&
    balanceTzs > 0 &&
    projectedDebt > selectedCustomer.creditLimitTzs;

  const pinRequired = totalTzs >= state.salesPreferences.pinThresholdTzs || discountTzs > 0;
  const resolvedVehicle =
    vehiclePreset === '__custom__'
      ? customVehicle.trim() || 'Farm Gate Pickup'
      : vehiclePreset;

  const failSubmit = (msg: string) => {
    setSubmitError(msg);
    setSubmitShake((s) => s + 1);
  };

  const handleConfirm = async () => {
    if (submitLockRef.current || isSubmitting) return;
    setSubmitError('');

    if (!selectedCustomer) {
      failSubmit(tr(language, 'Tafadhali chagua mteja.', 'Please select a customer.'));
      goToStep(1);
      return;
    }
    if (!normalizeTzPhone(selectedCustomer.phone)) {
      failSubmit(
        tr(
          language,
          'Mteja aliyechaguliwa hana namba sahihi ya simu (255XXXXXXXXX).',
          'Selected customer does not have a valid 255XXXXXXXXX phone number.'
        )
      );
      goToStep(1);
      return;
    }
    if (lines.length === 0) {
      failSubmit(tr(language, 'Ongeza angalau kipimo kimoja cha samaki.', 'Add at least one fish weighing line.'));
      goToStep(2);
      return;
    }
    if (lines.some((l) => l.pricePerKgTzs <= 0 || l.kg <= 0)) {
      failSubmit(
        tr(
          language,
          'Kila kipengee lazima kiwe na uzito > 0 na bei/kg > 0.',
          'Every line must have weight > 0 and price/kg > 0.'
        )
      );
      goToStep(2);
      return;
    }
    const rawDiscount = Math.max(0, roundTzs(Number(discountInput) || 0));
    if (rawDiscount > subtotalTzs) {
      failSubmit(tr(language, 'Punguzo haliwezi kuzidi jumla ndogo.', 'Discount cannot exceed subtotal.'));
      return;
    }
    if (discountTzs > 0 && !discountReason.trim()) {
      failSubmit(tr(language, 'Tafadhali weka sababu ya punguzo.', 'Please provide a reason for the discount.'));
      return;
    }
    if (discountTzs > 0 && !perms.canOverrideSalePrice) {
      failSubmit(
        tr(
          language,
          'Wajibu wako wa sasa hauwezi kuidhinisha punguzo. Badili kwenda Meneja au Mmiliki.',
          'Your current role cannot approve discounts. Switch to Manager or Owner.'
        )
      );
      return;
    }
    if (paidInput.trim() === '' || paidTzs < 0 || paidTzs > totalTzs) {
      failSubmit(
        tr(
          language,
          `Kiasi kilicholipwa lazima kiwe kati ya TZS 0 na ${formatTzs(totalTzs)}.`,
          `Paid amount must be between TZS 0 and ${formatTzs(totalTzs)}.`
        )
      );
      return;
    }
    if (exceedsCreditLimit) {
      failSubmit(
        tr(
          language,
          `Kikomo cha mkopo kimepitishwa kwa ${selectedCustomer.name}. Kikomo: ${formatTzs(
            selectedCustomer.creditLimitTzs
          )}, Deni la Sasa: ${formatTzs(currentDebt)}, Salio Jipya: ${formatTzs(balanceTzs)}.`,
          `Credit limit exceeded for ${selectedCustomer.name}. Limit: ${formatTzs(
            selectedCustomer.creditLimitTzs
          )}, Current Debt: ${formatTzs(currentDebt)}, New Balance: ${formatTzs(balanceTzs)}.`
        )
      );
      return;
    }
    if (deliveryStatus !== 'Delivered' && !deliveryAddress.trim()) {
      failSubmit(
        tr(
          language,
          'Anwani ya uwasilishaji inahitajika ikiwa hali ni Inasubiri Kusafirishwa au Njiani.',
          'Delivery address is required when status is Pending dispatch or In transit.'
        )
      );
      return;
    }
    if (pinRequired && !/^\d{4}$/.test(pin.trim())) {
      failSubmit(
        tr(
          language,
          'Weka msimbo wako wa PIN wa tarakimu 4 kuthibitisha mauzo haya.',
          'Enter your 4-digit PIN approval code to confirm this sale.'
        )
      );
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
      const res = await onSubmitSale({
        idempotencyKey,
        customerId: selectedCustomer.id,
        lines: lines.map((l) => ({
          sourceType: l.sourceType,
          lotId: l.lotId,
          pondCode: l.pondCode,
          batchCode: l.batchCode,
          species: l.species,
          grade: l.grade,
          kg: l.kg,
          count: l.count,
          pricePerKgTzs: l.pricePerKgTzs,
        })),
        discountTzs,
        discountReason: discountReason.trim(),
        applyTax,
        paidTzs,
        paymentMethod,
        paymentReference: paymentReference.trim(),
        deliveryStatus,
        deliveryAddress: deliveryAddress.trim() || selectedCustomer.location || 'Farm Gate',
        vehicleOrDriver: resolvedVehicle,
        pin: pinRequired ? pin.trim() : undefined,
        preOrderId: initialPreOrder?.id,
      });

      if (!res.ok) {
        failSubmit(
          res.error ||
            tr(
              language,
              'Uthibitishaji wa seva umeshindikana — akiba haikupunguzwa.',
              'Backend confirmation failed — stock was not deducted.'
            )
        );
        return;
      }

      if (effectiveReducedMotion) {
        onSaleConfirmed?.(res.sale);
        onClose();
        return;
      }

      setCelebratingSale({
        invoiceNo: res.sale?.invoiceNo,
        customerName: selectedCustomer.name,
      });
      window.setTimeout(() => {
        onSaleConfirmed?.(res.sale);
        resetWizardState();
      }, 950);
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  const step1Done = Boolean(selectedCustomer) && wizardStep > 1;
  const step2Done = lines.length > 0 && wizardStep > 2;
  const previewLotText =
    sourceMode === 'lot' && selectedLot
      ? `${selectedLot.lotCode} · ${formatReadableDate(selectedLot.date, language)}`
      : `${previewAutoHarvestLotCode(state.invoiceSequence, todayIso())} · ${formatReadableDate(todayIso(), language)}`;

  const selectedCustomerDebt = selectedCustomer
    ? getCustomerOutstandingBalance(state.sales, selectedCustomer.id)
    : 0;

  return (
    <div className="space-y-5">
      {celebratingSale ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: DURATIONS.base, ease: EASE_OUT }}
          className="rounded-2xl border border-emerald-200/80 bg-white p-10 shadow-sm dark:border-emerald-900/50 dark:bg-slate-900"
        >
          <SuccessMoment
            title={
              celebratingSale.invoiceNo
                ? tr(
                    language,
                    `Mauzo ${celebratingSale.invoiceNo} Yamethibitishwa`,
                    `Sale ${celebratingSale.invoiceNo} Confirmed`
                  )
                : tr(language, 'Mauzo Yamethibitishwa', 'Sale Confirmed')
            }
            subtitle={tr(
              language,
              `Akiba imehakikiwa na kusasishwa. Inaandaa risiti ya ${celebratingSale.customerName}...`,
              `Stock verified & updated. Preparing receipt for ${celebratingSale.customerName}...`
            )}
          />
        </motion.div>
      ) : (
        <>
          {/* 3-STEP GUIDED WIZARD STEPPER */}
          <div
            role="tablist"
            aria-label={tr(language, 'Hatua za mchawi wa mauzo', 'Sale wizard steps')}
            className="grid grid-cols-1 gap-3 md:grid-cols-3"
          >
            {[
              {
                n: 1 as const,
                title: tr(language, 'Mteja', 'Customer'),
                subtitle: tr(language, 'Nani ananunua?', 'Who is buying?'),
                done: step1Done,
              },
              {
                n: 2 as const,
                title: tr(language, 'Samaki na Uzito', 'Fish & Weight'),
                subtitle: tr(language, 'Aina na kiasi gani?', 'What and how much?'),
                done: step2Done,
              },
              {
                n: 3 as const,
                title: tr(language, 'Malipo na Usafirishaji', 'Payment & Dispatch'),
                subtitle: tr(language, 'Lipa na tuma mzigo', 'Pay and deliver'),
                done: false,
              },
            ].map((step) => {
              const isCurrent = wizardStep === step.n;
              const isDone = step.done;
              return (
                <motion.button
                  key={step.n}
                  type="button"
                  role="tab"
                  aria-selected={isCurrent}
                  whileHover={effectiveReducedMotion ? undefined : { y: -1 }}
                  whileTap={effectiveReducedMotion ? undefined : { scale: 0.99 }}
                  transition={{ duration: DURATIONS.fast, ease: EASE_OUT }}
                  onClick={() => goToStep(step.n)}
                  className={`flex items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left transition-all ${
                    isCurrent
                      ? 'border-[#0B7E91] bg-white shadow-sm ring-2 ring-[#0B7E91]/15 dark:border-cyan-500 dark:bg-slate-900 dark:ring-cyan-500/20'
                      : isDone
                        ? 'border-emerald-200/90 bg-white/95 hover:border-emerald-300 dark:border-emerald-900/50 dark:bg-slate-900/90'
                        : 'border-slate-200/90 bg-white/80 hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900/70'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold transition-colors ${
                      isDone
                        ? 'bg-[#17A85C] text-white shadow-xs'
                        : isCurrent
                          ? 'bg-[#0B7189] text-white shadow-xs'
                          : 'bg-slate-200/85 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {isDone ? <Check className="h-4.5 w-4.5 stroke-[2.75]" /> : step.n}
                  </span>
                  <div className="min-w-0">
                    <div
                      className={`truncate text-sm font-bold ${
                        isCurrent
                          ? 'text-slate-900 dark:text-white'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {step.title}
                    </div>
                    <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {step.subtitle}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* TWO-COLUMN SPACED WORKSPACE */}
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_330px] xl:grid-cols-[minmax(0,1fr)_360px]">
            {/* LEFT ACTIVE STEP PANEL */}
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <AnimatePresence mode="wait" custom={stepDirection}>
                {wizardStep === 1 && (
                  <motion.div
                    key="wizard-step-1"
                    custom={stepDirection}
                    variants={effectiveReducedMotion ? undefined : stepPanelVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: DURATIONS.base, ease: EASE_OUT }}
                    className="space-y-5 p-5 sm:p-7"
                  >
                    <div>
                      <h3 className="font-display text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
                        {tr(language, 'Nani ananunua?', 'Who is buying?')}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {tr(
                          language,
                          'Andika jina, namba ya simu au eneo. Chagua kwenye orodha na taarifa zitajazwa kiotomatiki.',
                          'Type a name, phone number or area. Pick from the list and the details fill in for you.'
                        )}
                      </p>
                    </div>

                    {/* Customer Search */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="qs-customer-search"
                          className="text-xs font-bold text-slate-700 dark:text-slate-300"
                        >
                          {tr(
                            language,
                            'Tafuta mteja (jina, simu au eneo)',
                            'Search customer (name, phone or area)'
                          )}
                        </label>
                        <button
                          type="button"
                          onClick={() => setRecentOnly((prev) => !prev)}
                          className={`text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                            recentOnly
                              ? 'text-[#0B7189] underline dark:text-cyan-400'
                              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                          }`}
                        >
                          {recentOnly
                            ? tr(language, 'Wateja wa mara kwa mara (Onyesha wote)', 'Showing frequent buyers (Show all)')
                            : tr(language, 'Chuja wateja wa mara kwa mara', 'Filter frequent buyers')}
                        </button>
                      </div>
                      <div className="relative">
                        <Search className="pointer-events-none absolute top-3.5 left-3.5 h-4 w-4 text-slate-400" />
                        <input
                          id="qs-customer-search"
                          type="text"
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          placeholder={tr(
                            language,
                            'Tafuta kwa jina la mteja, simu +255, au eneo la soko...',
                            'Search by customer name, +255 phone, or market area...'
                          )}
                          className={`${INPUT_CLASS} min-h-[46px] pl-10 pr-9 text-sm`}
                        />
                        {customerSearch && (
                          <button
                            type="button"
                            onClick={() => setCustomerSearch('')}
                            aria-label={tr(language, 'Futa utafutaji wa mteja', 'Clear customer search')}
                            className="absolute top-3 right-3 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Selectable Customer Cards */}
                    <div className="max-h-[280px] space-y-2.5 overflow-y-auto pr-1">
                      {filteredCustomers.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                          {tr(language, 'Hakuna mteja anayelingana na', 'No customer matches')} &ldquo;{customerSearch}&rdquo;.{' '}
                          {tr(language, 'Tumia', 'Use')}{' '}
                          <button
                            type="button"
                            onClick={() => setShowNewCustomer(true)}
                            className="font-bold text-[#0B7189] underline dark:text-cyan-400"
                          >
                            {tr(language, '+ Mteja Mpya', '+ New customer')}
                          </button>{' '}
                          {tr(language, 'hapa chini.', 'below.')}
                        </div>
                      ) : (
                        filteredCustomers.map((c) => {
                          const debt = getCustomerOutstandingBalance(state.sales, c.id);
                          const isSel = selectedCustomerId === c.id;
                          return (
                            <motion.button
                              key={c.id}
                              type="button"
                              whileTap={effectiveReducedMotion ? undefined : { scale: 0.995 }}
                              onClick={() => handleSelectCustomer(c)}
                              className={`flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-all sm:flex-nowrap ${
                                isSel
                                  ? 'border-[#0D8A9E] bg-[#F2FAFB] ring-1 ring-[#0D8A9E]/30 dark:border-cyan-500 dark:bg-cyan-950/30 dark:ring-cyan-500/30'
                                  : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/60'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-bold text-slate-900 dark:text-white">
                                  {c.name}
                                </div>
                                <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                                  {tDomain(language, c.priceTier)} · {formatTzPhoneDisplay(c.phone)} · {c.location}
                                </div>
                              </div>

                              <div className="flex shrink-0 items-center gap-2.5">
                                {debt > 0 ? (
                                  <span className="rounded-lg bg-orange-100/90 px-2.5 py-1 text-xs font-semibold text-orange-800 tabular-nums dark:bg-orange-950/70 dark:text-orange-300">
                                    {tr(language, 'Anadaiwa', 'Owes')} {formatTzs(debt)} · {tr(language, 'ukomo', 'limit')} {formatNumber(c.creditLimitTzs)}
                                  </span>
                                ) : (
                                  <span className="rounded-lg bg-emerald-100/80 px-2.5 py-1 text-xs font-semibold text-emerald-800 tabular-nums dark:bg-emerald-950/70 dark:text-emerald-300">
                                    {tr(language, 'Mkopo Sawa', 'Credit OK')} · {tr(language, 'ukomo', 'limit')} {formatTzs(c.creditLimitTzs)}
                                  </span>
                                )}
                                {isSel && (
                                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0B7189] text-white shadow-xs">
                                    <Check className="h-3.5 w-3.5 stroke-[2.75]" />
                                  </span>
                                )}
                              </div>
                            </motion.button>
                          );
                        })
                      )}
                    </div>

                    {/* Auto-filled Customer Details (2x2 grid matching design) */}
                    {selectedCustomer && (
                      <div className="grid grid-cols-1 gap-3.5 pt-1 sm:grid-cols-2">
                        <div>
                          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                            <span>{tr(language, 'Jina la mteja', 'Customer name')}</span>
                            <span className="rounded bg-[#0B7E91] px-1.5 py-0.5 text-[10px] font-bold text-white">
                              {tr(language, 'Otomatiki', 'Auto')}
                            </span>
                          </div>
                          <div className="rounded-xl border border-[#BCE3E8] bg-[#EFF8F9] px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-white">
                            {selectedCustomer.name}
                          </div>
                        </div>
                        <div>
                          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                            <span>{tr(language, 'Namba ya simu', 'Phone number')}</span>
                            <span className="rounded bg-[#0B7E91] px-1.5 py-0.5 text-[10px] font-bold text-white">
                              {tr(language, 'Otomatiki', 'Auto')}
                            </span>
                          </div>
                          <div className="rounded-xl border border-[#BCE3E8] bg-[#EFF8F9] px-3.5 py-2.5 font-mono text-sm font-medium text-slate-900 tabular-nums dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-white">
                            {formatTzPhoneDisplay(selectedCustomer.phone)}
                          </div>
                        </div>
                        <div>
                          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                            <span>{tr(language, 'Aina ya mteja', 'Customer type')}</span>
                            <span className="rounded bg-[#0B7E91] px-1.5 py-0.5 text-[10px] font-bold text-white">
                              {tr(language, 'Otomatiki', 'Auto')}
                            </span>
                          </div>
                          <div className="rounded-xl border border-[#BCE3E8] bg-[#EFF8F9] px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-white">
                            {tDomain(language, selectedCustomer.priceTier)}
                          </div>
                        </div>
                        <div>
                          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                            <span>{tr(language, 'Eneo', 'Area')}</span>
                            <span className="rounded bg-[#0B7E91] px-1.5 py-0.5 text-[10px] font-bold text-white">
                              {tr(language, 'Otomatiki', 'Auto')}
                            </span>
                          </div>
                          <div className="rounded-xl border border-[#BCE3E8] bg-[#EFF8F9] px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-white">
                            {selectedCustomer.location}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Inline Quick Add Customer Drawer */}
                    <AnimatePresence initial={false}>
                      {showNewCustomer && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: DURATIONS.base, ease: EASE_OUT }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/50 p-4 dark:border-cyan-900/60 dark:bg-cyan-950/25">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900 dark:text-white">
                                {tr(language, 'Sajili Mteja Haraka', 'Quick Register Customer')}
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowNewCustomer(false)}
                                className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400"
                              >
                                {tr(language, 'Funga', 'Close')}
                              </button>
                            </div>
                            <FormError message={newCustError} shakeKey={newCustShake} />
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div>
                                <label
                                  htmlFor="qs-new-cust-name"
                                  className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300"
                                >
                                  <span>{tr(language, 'Jina *', 'Name *')}</span>
                                  <ValidCheck valid={newCustName.trim().length > 1} />
                                </label>
                                <input
                                  id="qs-new-cust-name"
                                  type="text"
                                  value={newCustName}
                                  onChange={(e) => setNewCustName(e.target.value)}
                                  placeholder={tr(
                                    language,
                                    'mf. Zanzibar Fresh Traders',
                                    'e.g. Zanzibar Fresh Traders'
                                  )}
                                  className={`${INPUT_CLASS} min-h-[42px] text-sm`}
                                />
                              </div>
                              <div>
                                <label
                                  htmlFor="qs-new-cust-phone"
                                  className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300"
                                >
                                  <span>{tr(language, 'Simu (07... / 255...) *', 'Phone (07... / 255...) *')}</span>
                                  <ValidCheck valid={Boolean(normalizeTzPhone(newCustPhone))} />
                                </label>
                                <input
                                  id="qs-new-cust-phone"
                                  type="tel"
                                  inputMode="tel"
                                  value={newCustPhone}
                                  onChange={(e) => setNewCustPhone(e.target.value)}
                                  placeholder="0712 345 678"
                                  className={`${INPUT_CLASS} min-h-[42px] font-mono text-sm`}
                                />
                              </div>
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setShowNewCustomer(false)}
                              >
                                {tr(language, 'Ghairi', 'Cancel')}
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={handleAddNewCustomer}
                              >
                                {tr(language, 'Hifadhi na Chagua', 'Save & Select')}
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Step 1 Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setShowNewCustomer((prev) => !prev)}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#0B7189]/60 bg-white px-4 text-sm font-bold text-[#0B5C73] transition-colors hover:bg-teal-50/70 whitespace-nowrap shrink-0 dark:border-cyan-700 dark:bg-slate-900 dark:text-cyan-300 dark:hover:bg-slate-800"
                      >
                        <UserPlus className="h-4 w-4" />
                        <span>{tr(language, '+ Mteja Mpya', '+ New customer')}</span>
                      </button>

                      <button
                        type="button"
                        disabled={!selectedCustomer}
                        onClick={() => goToStep(2)}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-[#095580] to-[#0B7E91] px-6 text-sm font-bold text-white shadow-sm transition-all hover:brightness-105 disabled:opacity-50 whitespace-nowrap shrink-0"
                      >
                        <span>{tr(language, 'Inayofuata: Samaki na Uzito', 'Next: Fish & Weight')}</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {wizardStep === 2 && (
                  <motion.div
                    key="wizard-step-2"
                    custom={stepDirection}
                    variants={effectiveReducedMotion ? undefined : stepPanelVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: DURATIONS.base, ease: EASE_OUT }}
                    className="space-y-5 p-5 sm:p-7"
                  >
                    <div>
                      <h3 className="font-display text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
                        {tr(language, 'Unauza nini?', 'What are you selling?')}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {tr(
                          language,
                          'Chagua chanzo. Aina ya samaki, kundi la mavuno na bei vitajazwa kiotomatiki.',
                          'Choose the source. Species, harvest lot and price fill in automatically.'
                        )}
                      </p>
                    </div>

                    {/* Source Mode Toggle */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSourceMode('pond');
                          setWeighError('');
                          setPriceManuallyEdited(false);
                        }}
                        className={`flex min-h-[46px] items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold transition-all whitespace-nowrap ${
                          sourceMode === 'pond'
                            ? 'border-[#0B7189] bg-[#0B7189] text-white shadow-xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <Sprout className="h-4 w-4 shrink-0" />
                        <span>
                          {tr(
                            language,
                            `Moja kwa moja kutoka bwawani (mabwawa ${activePonds.length} tayari)`,
                            `Direct from pond (${activePonds.length} ponds ready)`
                          )}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSourceMode('lot');
                          setWeighError('');
                          setPriceManuallyEdited(false);
                        }}
                        className={`flex min-h-[46px] items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold transition-all whitespace-nowrap ${
                          sourceMode === 'lot'
                            ? 'border-[#0B7189] bg-[#0B7189] text-white shadow-xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <Fish className="h-4 w-4 shrink-0" />
                        <span>
                          {tr(
                            language,
                            `Kutoka akiba (makundi ${availableLots.length})`,
                            `From stock (${availableLots.length} lots)`
                          )}
                        </span>
                      </button>
                    </div>

                    {/* Pond / Harvest Lot + Auto Lot Ref */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {sourceMode === 'pond' ? (
                        <div>
                          <label
                            htmlFor="qs-pond-select"
                            className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300"
                          >
                            {tr(
                              language,
                              'Bwawa (kundi huundwa ukithibitisha)',
                              'Pond (lot is created when you confirm)'
                            )}
                          </label>
                          <select
                            id="qs-pond-select"
                            value={selectedPond?.code || ''}
                            onChange={(e) => {
                              setSelectedPondCode(e.target.value);
                              setWeighError('');
                              setPriceManuallyEdited(false);
                            }}
                            className={`${INPUT_CLASS} min-h-[46px] text-sm font-semibold`}
                          >
                            {activePonds.map((p) => (
                              <option key={p.id} value={p.code}>
                                {p.code} — {p.species} · {formatNumber(p.currentFish)}{' '}
                                {tr(language, 'samaki', 'fish')}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : availableLots.length === 0 ? (
                        <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                          <span>
                            {tr(
                              language,
                              'Hakuna makundi ya mavuno baridi kwenye akiba sasa hivi.',
                              'No chilled harvest lots in stock right now.'
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSourceMode('pond')}
                            className="shrink-0 rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-amber-700"
                          >
                            {tr(language, 'Tumia Bwawa', 'Use Pond')}
                          </button>
                        </div>
                      ) : (
                        <div>
                          <label
                            htmlFor="qs-lot-select"
                            className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300"
                          >
                            {tr(
                              language,
                              'Kundi la mavuno (hupunguzwa ukithibitisha)',
                              'Harvest lot (deducts on confirm)'
                            )}
                          </label>
                          <select
                            id="qs-lot-select"
                            value={selectedLot?.id || ''}
                            onChange={(e) => {
                              setSelectedLotId(e.target.value);
                              setWeighError('');
                              setPriceManuallyEdited(false);
                            }}
                            className={`${INPUT_CLASS} min-h-[46px] text-sm font-semibold`}
                          >
                            {availableLots.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.lotCode} · {l.pondCode} ({l.species}) —{' '}
                                {getLotTotalRemainingKg(l).toFixed(1)} kg
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                          <span>{tr(language, 'Kundi la mavuno · tarehe', 'Harvest lot · date')}</span>
                          <span className="rounded bg-[#0B7E91] px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {tr(language, 'Otomatiki', 'Auto')}
                          </span>
                        </div>
                        <div className="flex min-h-[46px] items-center rounded-xl border border-[#BCE3E8] bg-[#EFF8F9] px-3.5 text-sm font-semibold text-slate-900 tabular-nums dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-white">
                          {previewLotText}
                        </div>
                      </div>
                    </div>

                    {/* Fish Size (Grade) Selector */}
                    <div>
                      <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                        <span>{tr(language, 'Ukubwa wa samaki (daraja)', 'Fish size (grade)')}</span>
                        <span className="font-medium text-slate-500 dark:text-slate-400">
                          {tr(
                            language,
                            `Bei ya ${tDomain(language, selectedCustomer?.priceTier || 'Standard')}`,
                            `${selectedCustomer?.priceTier || 'Standard'} pricing`
                          )}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {GRADES.map((g) => {
                          const avail = getAvailableKgForSelected(g);
                          const tierPrice =
                            getPriceForItem(
                              state.priceList,
                              activeSpecies,
                              g,
                              selectedCustomer?.priceTier || 'Standard',
                              state.salesPreferences.lastPricesByKey
                            ) || 8500;
                          const active = grade === g;

                          return (
                            <motion.button
                              key={g}
                              type="button"
                              whileTap={effectiveReducedMotion ? undefined : { scale: 0.985 }}
                              onClick={() => {
                                setGrade(g);
                                setWeighError('');
                                setPriceManuallyEdited(false);
                              }}
                              className={`relative rounded-xl border p-3.5 text-left transition-all ${
                                active
                                  ? 'border-[#0D8A9E] bg-[#F2FAFB] ring-1 ring-[#0D8A9E]/30 dark:border-cyan-500 dark:bg-cyan-950/30'
                                  : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/60'
                              }`}
                            >
                              {active && (
                                <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#0B7E91] text-white">
                                  <Check className="h-3 w-3 stroke-[3]" />
                                </span>
                              )}
                              <div className="text-sm font-bold text-slate-900 dark:text-white">
                                {renderGradeLabel(g)}
                              </div>
                              <div className="mt-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                                {formatNumber(Math.round(avail))} kg{' '}
                                {tr(language, 'zinapatikana', 'available')}
                              </div>
                              <div className="mt-1 text-xs font-extrabold text-[#0B7189] tabular-nums dark:text-cyan-400">
                                {formatTzs(tierPrice)} {tr(language, 'kwa kg', 'per kg')}
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Weight, Fish Count, Auto Price & Live Line Total */}
                    <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-[0.9fr_1fr_0.95fr_1.35fr]">
                      <div>
                        <label
                          htmlFor="qs-weight-kg"
                          className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300"
                        >
                          <span>{tr(language, 'Uzito (kilogramu)', 'Weight (kilograms)')}</span>
                          <ValidCheck
                            valid={
                              Number(kgInput) > 0 &&
                              Number(kgInput) <= getAvailableKgForSelected(grade)
                            }
                          />
                        </label>
                        <input
                          ref={weightInputRef}
                          id="qs-weight-kg"
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          min="0"
                          placeholder="0.0"
                          value={kgInput}
                          onChange={(e) => {
                            setKgInput(e.target.value);
                            setWeighError('');
                          }}
                          className={`${INPUT_CLASS} min-h-[46px] text-base font-bold tabular-nums`}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="qs-fish-count"
                          className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300"
                        >
                          {tr(language, 'Idadi ya samaki (si lazima)', 'Number of fish (optional)')}
                        </label>
                        <input
                          id="qs-fish-count"
                          type="number"
                          inputMode="numeric"
                          min="0"
                          placeholder="0"
                          value={countInput}
                          onChange={(e) => setCountInput(e.target.value)}
                          className={`${INPUT_CLASS} min-h-[46px] text-base font-bold tabular-nums`}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="qs-price-per-kg"
                          className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300"
                        >
                          <span>{tr(language, 'Bei kwa kg', 'Price per kg')}</span>
                          <span className="rounded bg-[#0B7E91] px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {tr(language, 'Otomatiki', 'Auto')}
                          </span>
                        </label>
                        {perms.canOverrideSalePrice ? (
                          <input
                            id="qs-price-per-kg"
                            type="number"
                            inputMode="numeric"
                            min="1"
                            value={customPriceInput}
                            onChange={(e) => {
                              setPriceManuallyEdited(true);
                              setCustomPriceInput(e.target.value);
                            }}
                            className="min-h-[46px] w-full rounded-xl border border-[#BCE3E8] bg-[#EFF8F9] px-3 text-sm font-bold text-slate-900 tabular-nums focus:border-[#0B7E91] focus:outline-none dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-white"
                          />
                        ) : (
                          <div className="flex min-h-[46px] items-center rounded-xl border border-[#BCE3E8] bg-[#EFF8F9] px-3 text-sm font-bold text-slate-900 tabular-nums dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-white">
                            {formatTzs(activeDraftPricePerKg)}
                          </div>
                        )}
                      </div>

                      <div className="flex min-h-[60px] flex-col justify-center rounded-xl bg-gradient-to-br from-[#062246] via-[#074470] to-[#087786] px-4 py-2 text-white shadow-sm">
                        <div className="text-[11px] font-medium text-sky-100/90 tabular-nums">
                          {tr(language, 'Jumla ya mstari', 'Line total')} ·{' '}
                          {tr(language, 'wastani', 'avg')} {draftAvgKgPerFish.toFixed(2)} kg{' '}
                          {tr(language, 'kwa samaki', 'per fish')}
                        </div>
                        <div className="font-display text-xl font-extrabold text-amber-300 tabular-nums">
                          {formatTzs(draftLineTotalTzs)}
                        </div>
                      </div>
                    </div>

                    <FormError message={weighError} shakeKey={weighShake} />

                    {/* Full-Width Emerald Add Line CTA */}
                    <button
                      type="button"
                      onClick={handleAddWeighing}
                      className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#14A45B] to-[#1EB866] px-4 text-sm font-extrabold text-white shadow-xs transition-all hover:brightness-105 active:scale-[0.995]"
                    >
                      <Plus className="h-4 w-4 stroke-[2.5]" />
                      <span>
                        {tr(
                          language,
                          `Ongeza ${activeSpecies} (${renderGradeLabel(grade)}) kwenye mauzo`,
                          `Add ${grade} ${activeSpecies} to sale`
                        )}
                      </span>
                    </button>

                    {/* Added Lines Summary Box */}
                    {lines.length > 0 && (
                      <div className="rounded-xl border border-slate-200/90 bg-slate-50/75 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                        <div className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                          {tr(language, 'Vilivyoongezwa kwenye mauzo haya', 'Added to this sale')}
                        </div>
                        <div className="space-y-2">
                          <AnimatePresence initial={false}>
                            {lines.map((ln) => (
                              <motion.div
                                key={ln.id}
                                layout
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: DURATIONS.fast, ease: EASE_OUT }}
                                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                              >
                                <div className="min-w-0 truncate text-slate-800 dark:text-slate-200">
                                  <span className="font-semibold">{ln.species}</span> ·{' '}
                                  {renderGradeLabel(ln.grade)} ·{' '}
                                  <span className="tabular-nums">{ln.kg.toFixed(2)} kg</span>
                                  {ln.count > 0 && (
                                    <span className="tabular-nums">
                                      {' '}
                                      · {ln.count} {tr(language, 'samaki', 'fish')}
                                    </span>
                                  )}
                                  <span className="ml-2 text-xs text-slate-400">
                                    ({ln.lotCode || ln.pondCode})
                                  </span>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  <span className="font-bold text-slate-900 tabular-nums dark:text-white">
                                    {formatTzs(roundTzs(ln.kg * ln.pricePerKgTzs))}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setLines((prev) => prev.filter((x) => x.id !== ln.id))
                                    }
                                    aria-label={tr(
                                      language,
                                      `Ondoa mstari wa ${renderGradeLabel(ln.grade)}`,
                                      `Remove ${ln.grade} line`
                                    )}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                      </div>
                    )}

                    {/* Step 2 Navigation Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => goToStep(1)}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        <span>{tr(language, 'Rudi', 'Back')}</span>
                      </button>

                      <button
                        type="button"
                        disabled={lines.length === 0}
                        onClick={() => goToStep(3)}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-[#095580] to-[#0B7E91] px-6 text-sm font-bold text-white shadow-sm transition-all hover:brightness-105 disabled:opacity-50 whitespace-nowrap shrink-0"
                      >
                        <span>
                          {tr(language, 'Inayofuata: Malipo na Usafirishaji', 'Next: Payment & Dispatch')}
                        </span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {wizardStep === 3 && (
                  <motion.div
                    key="wizard-step-3"
                    custom={stepDirection}
                    variants={effectiveReducedMotion ? undefined : stepPanelVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: DURATIONS.base, ease: EASE_OUT }}
                    className="space-y-5 p-5 sm:p-7"
                  >
                    <div>
                      <h3 className="font-display text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
                        {tr(language, 'Atalipa na kupokeaje?', 'How will they pay and receive?')}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {tr(
                          language,
                          'Chagua njia ya malipo, weka kiasi, kisha panga usafirishaji.',
                          'Pick a payment method, enter the amount, then set delivery.'
                        )}
                      </p>
                    </div>

                    {/* Payment Method 4x2 Grid */}
                    <div>
                      <div className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                        {tr(language, 'Njia ya malipo', 'Payment method')}
                      </div>
                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                        {PAYMENT_OPTIONS.map((opt) => {
                          const isSelected = opt.isCredit
                            ? creditPayLater
                            : !creditPayLater && paymentMethod === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                if (opt.isCredit) {
                                  setCreditPayLater(true);
                                  setPaidManuallyEdited(true);
                                  setPaidInput('0');
                                } else {
                                  setCreditPayLater(false);
                                  setPaymentMethod(opt.id as PaymentMethod);
                                  if (!paidManuallyEdited || paidInput === '0') {
                                    setPaidManuallyEdited(false);
                                    setPaidInput(String(totalTzs));
                                  }
                                }
                              }}
                              className={`flex min-h-[46px] items-center justify-between gap-2 rounded-xl border px-3.5 text-left text-xs font-bold transition-all sm:text-sm ${
                                isSelected
                                  ? 'border-[#0D8A9E] bg-[#F2FAFB] text-slate-900 ring-1 ring-[#0D8A9E]/30 dark:border-cyan-500 dark:bg-cyan-950/30 dark:text-white'
                                  : 'border-slate-200/90 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                              }`}
                            >
                              <span className="truncate">
                                {language === 'sw' ? opt.swLabel : opt.enLabel}
                              </span>
                              {isSelected && (
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0B7E91] text-white">
                                  <Check className="h-3 w-3 stroke-[3]" />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Amount Paid Now + Payment Reference */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="qs-paid-amount"
                          className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300"
                        >
                          <span>{tr(language, 'Kiasi kilicholipwa sasa (TZS)', 'Amount paid now (TZS)')}</span>
                          <ValidCheck
                            valid={paidInput.trim() !== '' && paidTzs >= 0 && paidTzs <= totalTzs}
                          />
                        </label>
                        <input
                          ref={paidInputRef}
                          id="qs-paid-amount"
                          type="number"
                          inputMode="numeric"
                          min="0"
                          max={totalTzs}
                          value={paidInput}
                          onChange={(e) => {
                            setPaidManuallyEdited(true);
                            setCreditPayLater(Number(e.target.value) === 0);
                            setPaidInput(e.target.value);
                          }}
                          className={`${INPUT_CLASS} min-h-[46px] text-base font-bold tabular-nums`}
                        />
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setCreditPayLater(false);
                              setPaidManuallyEdited(false);
                              setPaidInput(String(totalTzs));
                            }}
                            className="rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-semibold text-[#0B5C73] hover:bg-sky-100 tabular-nums dark:bg-slate-800 dark:text-cyan-300"
                          >
                            {tr(language, 'Kamili', 'Full')} {formatNumber(totalTzs)}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCreditPayLater(false);
                              setPaidManuallyEdited(true);
                              setPaidInput(String(Math.round(totalTzs / 2)));
                            }}
                            className="rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-semibold text-[#0B5C73] hover:bg-sky-100 tabular-nums dark:bg-slate-800 dark:text-cyan-300"
                          >
                            {tr(language, 'Nusu', 'Half')} {formatNumber(Math.round(totalTzs / 2))}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCreditPayLater(true);
                              setPaidManuallyEdited(true);
                              setPaidInput('0');
                            }}
                            className="rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-semibold text-[#0B5C73] hover:bg-sky-100 tabular-nums dark:bg-slate-800 dark:text-cyan-300"
                          >
                            {tr(language, 'Lipa baadaye', 'Pay later')} 0
                          </button>
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="qs-pay-ref"
                          className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300"
                        >
                          {tr(
                            language,
                            'Kumbukumbu ya malipo (simu au benki)',
                            'Payment reference (mobile money or bank)'
                          )}
                        </label>
                        <input
                          id="qs-pay-ref"
                          type="text"
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                          placeholder={tr(
                            language,
                            'Namba ya muamala, mf. MPESA TRX123456',
                            'Transaction ID, for example MPESA TRX123456'
                          )}
                          className={`${INPUT_CLASS} min-h-[46px] text-sm`}
                        />
                      </div>
                    </div>

                    {/* Manager Discount + Conditional PIN */}
                    {(perms.canOverrideSalePrice || pinRequired) && (
                      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-800/40">
                        {perms.canOverrideSalePrice && (
                          <>
                            <div>
                              <label
                                htmlFor="qs-discount"
                                className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                              >
                                {tr(language, 'Punguzo (TZS)', 'Discount (TZS)')}
                              </label>
                              <input
                                id="qs-discount"
                                type="number"
                                inputMode="numeric"
                                min="0"
                                value={discountInput}
                                onChange={(e) => setDiscountInput(e.target.value)}
                                className={`${INPUT_CLASS} min-h-[40px] text-sm tabular-nums`}
                              />
                            </div>
                            <div>
                              <label
                                htmlFor="qs-discount-reason"
                                className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                              >
                                {tr(language, 'Sababu ya punguzo', 'Discount reason')}{' '}
                                {discountTzs > 0 ? '*' : ''}
                              </label>
                              <input
                                id="qs-discount-reason"
                                type="text"
                                disabled={discountTzs === 0}
                                value={discountReason}
                                onChange={(e) => setDiscountReason(e.target.value)}
                                placeholder={
                                  discountTzs > 0
                                    ? tr(language, 'Sababu inahitajika', 'Reason required')
                                    : tr(language, 'Si lazima', 'Optional')
                                }
                                className={`${INPUT_CLASS} min-h-[40px] text-sm disabled:opacity-55`}
                              />
                            </div>
                          </>
                        )}

                        {pinRequired && (
                          <div>
                            <label
                              htmlFor="qs-pin"
                              className="mb-1 flex items-center justify-between text-xs font-semibold text-amber-800 dark:text-amber-300"
                            >
                              <span className="flex items-center gap-1">
                                <Lock className="h-3.5 w-3.5" />
                                {tr(language, 'Idhini ya PIN (tarakimu 4)', 'PIN approval (4 digits)')}
                              </span>
                              <ValidCheck valid={/^\d{4}$/.test(pin)} />
                            </label>
                            <input
                              id="qs-pin"
                              type="password"
                              inputMode="numeric"
                              maxLength={4}
                              placeholder={tr(language, 'Weka PIN ya tarakimu 4', 'Enter 4-digit PIN')}
                              value={pin}
                              onChange={(e) => setPin(e.target.value)}
                              className={`${INPUT_CLASS} min-h-[40px] font-mono text-sm tracking-widest`}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Delivery Status Segmented Buttons */}
                    <div>
                      <div className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                        {tr(language, 'Hali ya uwasilishaji', 'Delivery status')}
                      </div>
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                        {DELIVERY_STATUS_OPTIONS.map((st) => {
                          const active = deliveryStatus === st.value;
                          return (
                            <button
                              key={st.value}
                              type="button"
                              onClick={() => setDeliveryStatus(st.value)}
                              className={`min-h-[44px] rounded-xl border px-4 text-sm font-bold transition-all whitespace-nowrap ${
                                active
                                  ? 'border-[#0B7189] bg-[#0B7189] text-white shadow-xs'
                                  : 'border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                              }`}
                            >
                              {language === 'sw' ? st.swLabel : st.enLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Delivery Address + Vehicle & Driver */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="qs-del-address"
                          className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300"
                        >
                          <span>{tr(language, 'Anwani ya uwasilishaji', 'Delivery address')}</span>
                          <span className="rounded bg-[#0B7E91] px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {tr(language, 'Otomatiki', 'Auto')}
                          </span>
                        </label>
                        <input
                          id="qs-del-address"
                          type="text"
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          placeholder={tr(language, 'Weka anwani ya uwasilishaji...', 'Enter delivery address...')}
                          className="min-h-[46px] w-full rounded-xl border border-[#BCE3E8] bg-[#EFF8F9] px-3.5 text-sm font-medium text-slate-900 focus:border-[#0B7E91] focus:outline-none dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-white"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="qs-del-vehicle"
                          className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300"
                        >
                          {tr(
                            language,
                            'Gari na dereva (chagua kwenye orodha)',
                            'Vehicle and driver (pick from list)'
                          )}
                        </label>
                        <select
                          id="qs-del-vehicle"
                          value={vehiclePreset}
                          onChange={(e) => setVehiclePreset(e.target.value)}
                          className={`${INPUT_CLASS} min-h-[46px] text-sm font-medium`}
                        >
                          {FLEET_VEHICLE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {language === 'sw' ? opt.swLabel : opt.enLabel}
                            </option>
                          ))}
                          <option value="__custom__">
                            {tr(language, 'Gari / dereva mwingine...', 'Other vehicle / driver...')}
                          </option>
                        </select>
                        {vehiclePreset === '__custom__' && (
                          <input
                            type="text"
                            value={customVehicle}
                            onChange={(e) => setCustomVehicle(e.target.value)}
                            placeholder={tr(
                              language,
                              'Weka namba ya gari na jina la dereva...',
                              'Enter plate number & driver name...'
                            )}
                            className={`${INPUT_CLASS} mt-2 min-h-[40px] text-sm`}
                          />
                        )}
                      </div>
                    </div>

                    {/* Step 3 Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => goToStep(2)}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        <span>{tr(language, 'Rudi', 'Back')}</span>
                      </button>

                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={handleConfirm}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-[#14A45B] to-[#1EB866] px-5 text-sm font-extrabold text-white shadow-sm transition-all hover:brightness-105 disabled:opacity-55 lg:hidden"
                      >
                        <Check className="h-4 w-4" />
                        <span>
                          {tr(language, 'Thibitisha mauzo na toa risiti', 'Confirm sale & issue receipt')}
                        </span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* RIGHT PERSISTENT STICKY SALE SUMMARY PANEL */}
            <aside
              aria-label={tr(language, 'Muhtasari wa mauzo', 'Sale summary')}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm lg:sticky lg:top-24 dark:border-slate-800 dark:bg-slate-900 sm:p-6"
            >
              <h3 className="font-display text-lg font-extrabold text-slate-900 dark:text-white">
                {tr(language, 'Muhtasari wa mauzo', 'Sale summary')}
              </h3>

              {/* Customer Summary Box */}
              <div className="mt-3.5 rounded-xl border border-sky-100 bg-sky-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/60">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {tr(language, 'Mteja', 'Customer')}
                </div>
                <div className="mt-0.5 truncate text-sm font-bold text-slate-900 dark:text-white">
                  {selectedCustomer
                    ? selectedCustomer.name
                    : tr(language, 'Hakuna mteja aliyechaguliwa', 'No customer selected')}
                </div>
                {selectedCustomer && (
                  <div className="mt-0.5 text-xs text-slate-600 tabular-nums dark:text-slate-300">
                    {selectedCustomerDebt > 0
                      ? `${tr(language, 'Anadaiwa', 'Owes')} ${formatTzs(selectedCustomerDebt)} · ${tr(language, 'ukomo', 'limit')} ${formatTzs(selectedCustomer.creditLimitTzs)}`
                      : `${tr(language, 'Mkopo Sawa', 'Credit OK')} · ${tr(language, 'ukomo', 'limit')} ${formatTzs(selectedCustomer.creditLimitTzs)}`}
                  </div>
                )}
              </div>

              {/* Line Totals Breakdown */}
              <div className="mt-4 space-y-2.5 text-sm">
                {lines.length === 0 ? (
                  <div className="py-1 text-sm text-slate-500 dark:text-slate-400">
                    {tr(language, 'Hakuna samaki walioongezwa bado.', 'No fish added yet.')}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">
                        {tr(language, 'Bidhaa', 'Items')}
                      </span>
                      <span className="font-bold text-slate-900 tabular-nums dark:text-white">
                        {lines.length} · {totalKg.toFixed(2)} kg
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">
                        {tr(language, 'Jumla ndogo', 'Subtotal')}
                      </span>
                      <span className="font-bold text-slate-900 tabular-nums dark:text-white">
                        {formatTzs(subtotalTzs)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">
                        {tr(language, 'Punguzo', 'Discount')}
                      </span>
                      <span className="font-bold text-slate-900 tabular-nums dark:text-white">
                        {discountTzs > 0 ? `-${formatTzs(discountTzs)}` : 'TZS 0'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 text-slate-600 dark:text-slate-400">
                        <input
                          type="checkbox"
                          checked={applyTax}
                          onChange={(e) => setApplyTax(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-[#0B7189] focus:ring-[#0B7189]"
                        />
                        <span>VAT (18%)</span>
                      </label>
                      <span className="font-bold text-slate-900 tabular-nums dark:text-white">
                        {formatTzs(taxTzs)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Ocean Gradient Total Payable Box */}
              <div className="mt-4 rounded-2xl bg-gradient-to-br from-[#062246] via-[#074470] to-[#087786] p-4 text-white shadow-md">
                <div className="text-xs font-medium text-sky-100/90">
                  {tr(language, 'Jumla ya kulipa', 'Total payable')}
                </div>
                <div className="mt-1 font-display text-2xl font-extrabold text-amber-300 tabular-nums sm:text-[26px]">
                  <CountUpNumber value={totalTzs} formatter={formatTzs} />
                </div>
              </div>

              {/* Amount Paid & Balance Owed (visible once items added or in Step 3) */}
              {lines.length > 0 && wizardStep === 3 && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">
                      {tr(language, 'Kiasi kilicholipwa', 'Amount paid')}
                    </span>
                    <span className="font-bold text-slate-900 tabular-nums dark:text-white">
                      {formatTzs(paidTzs)}
                    </span>
                  </div>

                  {balanceTzs > 0 ? (
                    <div className="rounded-xl border border-orange-200/80 bg-orange-100/75 p-3.5 dark:border-orange-900/60 dark:bg-orange-950/40">
                      <div className="text-xs font-semibold text-orange-900 dark:text-orange-200">
                        {tr(language, 'Baki inayodaiwa', 'Balance owed')}
                      </div>
                      <div className="mt-0.5 font-display text-lg font-extrabold text-orange-950 tabular-nums dark:text-orange-100">
                        {formatTzs(balanceTzs)}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-2.5 text-xs font-bold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/35 dark:text-emerald-300">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      <span>
                        {tr(language, 'Imelipwa yote · TZS 0 deni', 'Paid in full · TZS 0 owed')}
                      </span>
                    </div>
                  )}

                  <FormError message={submitError} shakeKey={submitShake} />

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleConfirm}
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#14A45B] to-[#1EB866] px-4 py-3 text-sm font-extrabold text-white shadow-sm transition-all hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{tr(language, 'Inathibitisha mauzo...', 'Confirming sale...')}</span>
                      </>
                    ) : (
                      <>
                        <Printer className="h-4 w-4" />
                        <span>
                          {tr(language, 'Thibitisha mauzo na toa risiti', 'Confirm sale & issue receipt')}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {lines.length > 0 && wizardStep < 3 && (
                <button
                  type="button"
                  onClick={() => goToStep(3)}
                  className="mt-4 flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#0B7189]/40 bg-teal-50/60 px-3 text-xs font-bold text-[#0B5C73] transition-colors hover:bg-teal-100/70 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-300"
                >
                  <span>
                    {tr(language, 'Endelea kwenye Malipo na Usafirishaji', 'Proceed to Payment & Dispatch')}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
};
