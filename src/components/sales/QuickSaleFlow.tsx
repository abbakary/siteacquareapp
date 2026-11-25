import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  Anchor,
  ArrowLeft,
  ArrowRight,
  Banknote,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Fish,
  Hash,
  Loader2,
  Lock,
  MapPin,
  Printer,
  Scale,
  Search,
  ShieldCheck,
  ShoppingBasket,
  ShoppingCart,
  Smartphone,
  Sprout,
  Store,
  Trash2,
  Truck,
  User,
  UserPlus,
  Users,
  Utensils,
  Wallet,
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
import { ASSET_IMAGES } from '../../data/seedData';
import { formatNumber, formatTzs } from '../../utils/formatters';
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
import { TRANSLATIONS } from '../../i18n/translations';
import {
  Button,
  CountUpNumber,
  DURATIONS,
  EASE_OUT,
  FormError,
  INPUT_CLASS,
  SuccessMoment,
  ValidCheck,
  backdropFade,
  usePreferences,
} from '../../ui';

const PAYMENT_METHODS: PaymentMethod[] = [
  'Cash',
  'M-Pesa',
  'Tigo Pesa',
  'Airtel Money',
  'Halopesa',
  'Bank Transfer',
  'Cheque',
];

const GRADES: FishGrade[] = ['Large', 'Medium', 'Small'];

const TAX_RATE = 0.18;

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `qs-${crypto.randomUUID()}`;
  }
  return `qs-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
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
  onClose: () => void;
  onBackToMenu?: () => void;
  onQuickCreateCustomer: (payload: { name: string; phone: string }) => {
    ok: boolean;
    customer?: Customer;
    error?: string;
  };
  onSubmitSale: (payload: QuickSaleSubmitPayload) => Promise<QuickSaleSubmitResult>;
}

function renderCustomerCategoryIcon(type: Customer['type']) {
  switch (type) {
    case 'Wholesaler':
      return <Anchor className="h-4 w-4 text-blue-600 dark:text-sky-400" />;
    case 'Market':
      return <Store className="h-4 w-4 text-blue-600 dark:text-sky-400" />;
    case 'Hotel/Restaurant':
      return <Utensils className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />;
    case 'Retailer':
      return <ShoppingBasket className="h-4 w-4 text-sky-600 dark:text-sky-400" />;
    default:
      return <User className="h-4 w-4 text-blue-600 dark:text-sky-400" />;
  }
}

function renderPaymentMethodIcon(method: PaymentMethod) {
  switch (method) {
    case 'Cash':
      return (
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
          <Banknote className="h-4 w-4" />
        </span>
      );
    case 'M-Pesa':
      return (
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
          <Smartphone className="h-4 w-4" />
        </span>
      );
    case 'Tigo Pesa':
      return (
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-sky-300">
          <Smartphone className="h-4 w-4" />
        </span>
      );
    case 'Airtel Money':
      return (
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300">
          <Smartphone className="h-4 w-4" />
        </span>
      );
    case 'Halopesa':
      return (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-xs font-extrabold text-white">
          H
        </span>
      );
    case 'Bank Transfer':
      return (
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <Building2 className="h-4 w-4" />
        </span>
      );
    case 'Cheque':
      return (
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300">
          <CreditCard className="h-4 w-4" />
        </span>
      );
  }
}

export const QuickSaleFlow: React.FC<QuickSaleFlowProps> = ({
  open,
  state,
  language,
  initialLotId,
  initialPondCode,
  initialPreOrder,
  onClose,
  onBackToMenu,
  onQuickCreateCustomer,
  onSubmitSale,
}) => {
  const t = TRANSLATIONS[language];
  const perms = getPermissions(state.activeUser.role);
  const { effectiveReducedMotion } = usePreferences();

  const col1Ref = useRef<HTMLDivElement | null>(null);
  const col2Ref = useRef<HTMLDivElement | null>(null);
  const col3Ref = useRef<HTMLDivElement | null>(null);
  const weightInputRef = useRef<HTMLInputElement | null>(null);
  const paidInputRef = useRef<HTMLInputElement | null>(null);
  const submitLockRef = useRef<boolean>(false);

  const [focusedSection, setFocusedSection] = useState<1 | 2 | 3>(1);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => generateIdempotencyKey());
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [celebratingSale, setCelebratingSale] = useState<{
    invoiceNo?: string;
    customerName: string;
  } | null>(null);

  // Column 1: Customer
  const [customerSearch, setCustomerSearch] = useState('');
  const [recentOnly, setRecentOnly] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustError, setNewCustError] = useState('');
  const [newCustShake, setNewCustShake] = useState(0);

  // Column 2: Fish & Weight
  const availableLots = useMemo(
    () => state.harvestLots.filter((l) => getLotTotalRemainingKg(l) > 0),
    [state.harvestLots]
  );
  const activePonds = useMemo(
    () => state.ponds.filter((p) => p.currentFish > 0),
    [state.ponds]
  );

  const [sourceMode, setSourceMode] = useState<'lot' | 'pond'>('lot');
  const [selectedLotId, setSelectedLotId] = useState<string>('');
  const [selectedPondCode, setSelectedPondCode] = useState<string>('');
  const [grade, setGrade] = useState<FishGrade>('Large');
  const [kgInput, setKgInput] = useState<string>('');
  const [countInput, setCountInput] = useState<string>('');
  const [weighError, setWeighError] = useState<string>('');
  const [weighShake, setWeighShake] = useState(0);
  const [lines, setLines] = useState<DraftLine[]>([]);

  // Column 3 & 4: Pay, Dispatch & Tax
  const [discountInput, setDiscountInput] = useState<string>('0');
  const [discountReason, setDiscountReason] = useState<string>('');
  const [applyTax, setApplyTax] = useState<boolean>(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    state.salesPreferences.lastPaymentMethod || 'Cash'
  );
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [paidInput, setPaidInput] = useState<string>('');
  const [paidManuallyEdited, setPaidManuallyEdited] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState<Sale['deliveryStatus']>('Pending Dispatch');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [vehicleOrDriver, setVehicleOrDriver] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [submitError, setSubmitError] = useState<string>('');
  const [submitShake, setSubmitShake] = useState(0);

  // Lock body scroll & handle Escape when open
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, isSubmitting, onClose]);

  // Reset / Initialize workspace when opened
  useEffect(() => {
    if (!open) return;
    submitLockRef.current = false;
    setIsSubmitting(false);
    setIdempotencyKey(generateIdempotencyKey());
    setFocusedSection(1);
    setCelebratingSale(null);
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
    setPaymentReference('');
    setPaidManuallyEdited(false);
    setDeliveryStatus('Pending Dispatch');
    setVehicleOrDriver('');
    setKgInput('');
    setCountInput('');
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
    } else if (initialLotId) {
      const lastCustId = state.salesPreferences.lastCustomerId || state.customers[0]?.id || '';
      setSelectedCustomerId(lastCustId);
      const cust = state.customers.find((c) => c.id === lastCustId);
      setDeliveryAddress(cust?.location || '');
      setSourceMode('lot');
      setSelectedLotId(initialLotId);
      setSelectedPondCode(activePonds[0]?.code || '');
    } else if (initialPondCode) {
      const lastCustId = state.salesPreferences.lastCustomerId || state.customers[0]?.id || '';
      setSelectedCustomerId(lastCustId);
      const cust = state.customers.find((c) => c.id === lastCustId);
      setDeliveryAddress(cust?.location || '');
      setSourceMode('pond');
      setSelectedLotId(availableLots[0]?.id || '');
      setSelectedPondCode(initialPondCode);
      setFocusedSection(2);
    } else {
      const lastCustId = state.salesPreferences.lastCustomerId || state.customers[0]?.id || '';
      setSelectedCustomerId(lastCustId);
      const cust = state.customers.find((c) => c.id === lastCustId);
      setDeliveryAddress(cust?.location || '');
      // Prefer In Stock if available lots exist, otherwise Direct from Pond
      setSourceMode(availableLots.length > 0 ? 'lot' : 'pond');
      setSelectedLotId(availableLots[0]?.id || '');
      setSelectedPondCode(activePonds[0]?.code || '');
    }
  }, [open, initialLotId, initialPondCode, initialPreOrder]);

  const selectedCustomer = state.customers.find((c) => c.id === selectedCustomerId) || null;
  const selectedLot =
    state.harvestLots.find((l) => l.id === selectedLotId) || availableLots[0] || null;
  const selectedPond =
    state.ponds.find((p) => p.code === selectedPondCode) || activePonds[0] || null;

  const handleSelectCustomer = (cust: Customer) => {
    setSelectedCustomerId(cust.id);
    setDeliveryAddress(cust.location || '');
    setSubmitError('');
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

  const focusSection = (section: 1 | 2 | 3) => {
    setFocusedSection(section);
    if (section === 1) {
      col1Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (section === 2) {
      col2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      window.setTimeout(() => weightInputRef.current?.focus(), 160);
    } else {
      col3Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      window.setTimeout(() => paidInputRef.current?.focus(), 160);
    }
  };

  // Totals (Subtotal, Discount, Tax 18%, Total Payable)
  const totalKg = roundKg(lines.reduce((sum, l) => sum + l.kg, 0));
  const subtotalTzs = roundTzs(
    lines.reduce((sum, l) => sum + roundTzs(l.kg * l.pricePerKgTzs), 0)
  );
  const discountTzs = Math.min(subtotalTzs, Math.max(0, roundTzs(Number(discountInput) || 0)));
  const taxableBaseTzs = Math.max(0, subtotalTzs - discountTzs);
  const taxTzs = applyTax ? roundTzs(taxableBaseTzs * TAX_RATE) : 0;
  const totalTzs = roundTzs(taxableBaseTzs + taxTzs);

  useEffect(() => {
    if (!paidManuallyEdited) {
      setPaidInput(String(totalTzs));
    }
  }, [totalTzs, paidManuallyEdited]);

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
      setNewCustError(res.error || 'Could not create customer.');
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
          ? `Uzito umezidi akiba iliyopo (${avail.toFixed(2)} kg tu zipo kwa ${grade}).`
          : `Weight exceeds available stock (only ${avail.toFixed(2)} kg available for ${grade}).`
      );
      setWeighShake((s) => s + 1);
      return;
    }

    if (sourceMode === 'lot') {
      if (!selectedLot) {
        setWeighError('Select a harvest lot first.');
        setWeighShake((s) => s + 1);
        return;
      }
      const tier = selectedCustomer?.priceTier || 'Standard';
      const defaultPrice =
        initialPreOrder &&
        initialPreOrder.species === selectedLot.species &&
        initialPreOrder.grade === grade
          ? initialPreOrder.agreedPricePerKgTzs
          : getPriceForItem(
              state.priceList,
              selectedLot.species,
              grade,
              tier,
              state.salesPreferences.lastPricesByKey
            );

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
          pricePerKgTzs: defaultPrice || 8500,
        },
      ]);
    } else {
      if (!selectedPond) {
        setWeighError('Select an active pond first.');
        setWeighShake((s) => s + 1);
        return;
      }
      const batch = state.batches.find((b) => b.pondCode === selectedPond.code);
      if (count > selectedPond.currentFish) {
        setWeighError(
          `Fish count (${count}) exceeds live fish in ${selectedPond.code} (${selectedPond.currentFish}).`
        );
        setWeighShake((s) => s + 1);
        return;
      }
      const tier = selectedCustomer?.priceTier || 'Standard';
      const defaultPrice =
        getPriceForItem(
          state.priceList,
          selectedPond.species,
          grade,
          tier,
          state.salesPreferences.lastPricesByKey
        ) || 8500;

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
          pricePerKgTzs: defaultPrice,
        },
      ]);
    }

    setKgInput('');
    setCountInput('');
    setFocusedSection(2);
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

  const pinRequired =
    totalTzs >= state.salesPreferences.pinThresholdTzs || discountTzs > 0;

  const readinessStatus = useMemo(() => {
    if (!selectedCustomer) {
      return { ready: false, title: 'Select Customer', detail: 'Choose or create a buyer in Column 1' };
    }
    if (!normalizeTzPhone(selectedCustomer.phone)) {
      return { ready: false, title: 'Invalid Phone', detail: 'Customer requires valid 255 phone' };
    }
    if (lines.length === 0) {
      return { ready: false, title: 'Add Fish Weight', detail: 'Weigh fish in Column 2 to continue' };
    }
    if (paidInput.trim() === '' || paidTzs < 0 || paidTzs > totalTzs) {
      return { ready: false, title: 'Check Paid Amount', detail: `Must be TZS 0 – ${formatTzs(totalTzs)}` };
    }
    if (exceedsCreditLimit) {
      return {
        ready: false,
        title: 'Credit Limit Exceeded',
        detail: `Limit ${formatTzs(selectedCustomer.creditLimitTzs)} exceeded`,
      };
    }
    if (discountTzs > 0 && !discountReason.trim()) {
      return { ready: false, title: 'Discount Reason', detail: 'Enter reason for discount' };
    }
    if (deliveryStatus !== 'Delivered' && !deliveryAddress.trim()) {
      return { ready: false, title: 'Delivery Address', detail: 'Required for Pending / In Transit' };
    }
    if (pinRequired && !/^\d{4}$/.test(pin.trim())) {
      return { ready: false, title: 'PIN Required', detail: 'Enter your 4-digit approval PIN' };
    }
    return { ready: true, title: 'Ready to Confirm', detail: 'All details are valid' };
  }, [
    selectedCustomer,
    lines.length,
    paidInput,
    paidTzs,
    totalTzs,
    exceedsCreditLimit,
    discountTzs,
    discountReason,
    deliveryStatus,
    deliveryAddress,
    pinRequired,
    pin,
  ]);

  const failSubmit = (msg: string) => {
    setSubmitError(msg);
    setSubmitShake((s) => s + 1);
  };

  const handleConfirm = async () => {
    if (submitLockRef.current || isSubmitting) return;
    setSubmitError('');

    if (!selectedCustomer) {
      failSubmit('Please select a customer.');
      focusSection(1);
      return;
    }
    if (!normalizeTzPhone(selectedCustomer.phone)) {
      failSubmit('Selected customer does not have a valid 255XXXXXXXXX phone number.');
      focusSection(1);
      return;
    }
    if (lines.length === 0) {
      failSubmit('Add at least one fish weighing line.');
      focusSection(2);
      return;
    }
    if (lines.some((l) => l.pricePerKgTzs <= 0 || l.kg <= 0)) {
      failSubmit('Every line must have weight > 0 and price/kg > 0.');
      focusSection(2);
      return;
    }
    const rawDiscount = Math.max(0, roundTzs(Number(discountInput) || 0));
    if (rawDiscount > subtotalTzs) {
      failSubmit('Discount cannot exceed subtotal.');
      focusSection(3);
      return;
    }
    if (discountTzs > 0 && !discountReason.trim()) {
      failSubmit('Please provide a reason for the discount.');
      focusSection(3);
      return;
    }
    if (discountTzs > 0 && !perms.canOverrideSalePrice) {
      failSubmit('Your current role cannot approve discounts. Switch to Manager or Owner.');
      focusSection(3);
      return;
    }
    if (paidInput.trim() === '' || paidTzs < 0 || paidTzs > totalTzs) {
      failSubmit(`Paid amount must be between TZS 0 and ${formatTzs(totalTzs)}.`);
      focusSection(3);
      return;
    }
    if (exceedsCreditLimit) {
      failSubmit(
        `Credit limit exceeded for ${selectedCustomer.name}. Limit: ${formatTzs(
          selectedCustomer.creditLimitTzs
        )}, Current Debt: ${formatTzs(currentDebt)}, New Balance: ${formatTzs(balanceTzs)}.`
      );
      focusSection(3);
      return;
    }
    if (deliveryStatus !== 'Delivered' && !deliveryAddress.trim()) {
      failSubmit('Delivery address is required when status is Pending Dispatch or In Transit.');
      focusSection(3);
      return;
    }
    if (pinRequired && !pin.trim()) {
      failSubmit('4-digit PIN approval is required for this sale.');
      focusSection(3);
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
        vehicleOrDriver: vehicleOrDriver.trim() || 'Farm Gate Pickup',
        pin: pinRequired ? pin.trim() : undefined,
        preOrderId: initialPreOrder?.id,
      });

      if (!res.ok) {
        failSubmit(res.error || 'Backend confirmation failed — stock was not deducted.');
        return;
      }

      if (effectiveReducedMotion) {
        onClose();
        return;
      }

      setCelebratingSale({
        invoiceNo: res.sale?.invoiceNo,
        customerName: selectedCustomer.name,
      });
      window.setTimeout(() => {
        onClose();
      }, 700);
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const step1Done = Boolean(selectedCustomer);
  const step2Done = lines.length > 0;
  const step3Done = readinessStatus.ready;

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-2 sm:p-3 lg:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Duka+ Smart Fish Sales Workspace"
        >
          {/* Backdrop */}
          <motion.div
            key="qs-workspace-backdrop"
            variants={backdropFade}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={() => {
              if (!isSubmitting) onClose();
            }}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-[3px]"
          />

          {/* Full Workspace Panel */}
          <motion.div
            key="qs-workspace-panel"
            initial={effectiveReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 10 }}
            animate={effectiveReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={effectiveReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: DURATIONS.base, ease: EASE_OUT }}
            className="relative z-10 flex max-h-[96vh] w-full max-w-[1460px] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-[#EDF3FA] text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
          >
            {celebratingSale ? (
              <div className="bg-white p-10 dark:bg-slate-900">
                <SuccessMoment
                  title={
                    celebratingSale.invoiceNo
                      ? `Sale ${celebratingSale.invoiceNo} Confirmed!`
                      : 'Sale Confirmed!'
                  }
                  subtitle={`Backend verified & stock updated. Preparing receipt for ${celebratingSale.customerName}...`}
                />
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2.5 sm:p-3.5">
                {/* 1. HERO OCEAN BANNER ("Quick Sale (30s)" + "Sell Smart... Grow Together") */}
                <div className="relative mb-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-[#07264D] via-[#0B3E78] to-[#0A6782] px-4 py-3 text-white shadow-sm">
                  <img
                    src={ASSET_IMAGES.banner}
                    alt=""
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20 mix-blend-luminosity"
                  />
                  <div className="relative flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-amber-300/80 bg-amber-400/20 text-amber-300 shadow-inner">
                        <Clock className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-display text-base font-extrabold tracking-tight sm:text-lg">
                            {t.sales.quickSaleBtn}
                          </h2>
                          <span className="rounded bg-white/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-sky-100 backdrop-blur-xs">
                            Duka+ Smart Fish Sales Workspace
                          </span>
                        </div>
                        <p className="text-xs text-sky-100/90">
                          {initialPreOrder
                            ? `Converting Pre-Order · ${initialPreOrder.requestedKg} kg ${initialPreOrder.species}`
                            : selectedCustomer
                              ? `${selectedCustomer.name} · ${selectedCustomer.priceTier}`
                              : language === 'sw'
                                ? 'Chagua mteja, pima samaki, lipa na toa risiti'
                                : 'Customer, weighing, payment, dispatch & summary in one view'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="hidden font-display text-sm font-bold italic tracking-wide text-sky-100 md:inline">
                        &ldquo;Sell Smart... Grow Together&rdquo;
                      </span>
                      {onBackToMenu && (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => {
                            onClose();
                            onBackToMenu();
                          }}
                          className="flex min-h-[38px] items-center gap-1.5 rounded-xl border border-white/25 bg-white/12 px-3 text-xs font-bold text-white transition-colors hover:bg-white/25 disabled:opacity-50"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                          <span>{t.ui.backToMenu}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={onClose}
                        aria-label="Close quick sale workspace"
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/12 text-white transition-colors hover:bg-white/25 disabled:opacity-50"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. 3-STEP PROGRESS BAR */}
                <div className="mb-3 flex items-center justify-center px-2">
                  <div className="flex w-full max-w-3xl items-center">
                    {[
                      {
                        n: 1 as const,
                        label: t.sales.steps.customer,
                        done: step1Done,
                      },
                      {
                        n: 2 as const,
                        label: t.sales.steps.fish,
                        done: step2Done,
                      },
                      {
                        n: 3 as const,
                        label: t.sales.steps.pay,
                        done: step3Done,
                      },
                    ].map((s, idx) => {
                      const active = focusedSection === s.n || s.done;
                      return (
                        <React.Fragment key={s.n}>
                          <button
                            type="button"
                            onClick={() => focusSection(s.n)}
                            className="group flex shrink-0 items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-white/70 dark:hover:bg-slate-800/70"
                          >
                            <span
                              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold transition-colors ${
                                s.done
                                  ? 'bg-[#136EE6] text-white shadow-xs'
                                  : active
                                    ? 'border-2 border-[#136EE6] bg-white text-[#136EE6] dark:bg-slate-900 dark:text-sky-400'
                                    : 'bg-slate-300/80 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {s.done ? <Check className="h-4 w-4 stroke-[2.75]" /> : s.n}
                            </span>
                            <span
                              className={`text-xs font-bold sm:text-sm ${
                                s.done || focusedSection === s.n
                                  ? 'text-[#0E56BD] dark:text-sky-300'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {s.label}
                            </span>
                          </button>
                          {idx < 2 && (
                            <div className="mx-2 h-0.5 flex-1 overflow-hidden rounded-full bg-slate-300/80 dark:bg-slate-700">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  s.done ? 'w-full bg-[#136EE6]' : 'w-0 bg-[#136EE6]'
                                }`}
                              />
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                {/* 3. FOUR-COLUMN SMART WORKSPACE */}
                <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-2 xl:grid-cols-[1.06fr_1.18fr_1.02fr_0.86fr]">
                  {/* ================= COLUMN 1: CUSTOMER SELECTION ================= */}
                  <section
                    ref={col1Ref}
                    aria-label="Customer Selection"
                    onFocusCapture={() => setFocusedSection(1)}
                    className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex items-center gap-2.5 bg-gradient-to-r from-[#136EE6] to-[#0B56C5] px-4 py-3 text-white">
                      <Users className="h-5 w-5 shrink-0 text-sky-100" />
                      <div className="min-w-0">
                        <h3 className="font-display text-sm font-extrabold leading-tight">
                          Customer Selection
                        </h3>
                        <p className="text-[11px] text-sky-100">Find or register your customer</p>
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col gap-2.5 p-3">
                      {/* Search Row */}
                      <div className="flex items-center gap-1.5">
                        <div className="relative flex-1">
                          <Search className="pointer-events-none absolute top-3.5 left-3 h-4 w-4 text-slate-400" />
                          <input
                            id="qs-customer-search"
                            type="text"
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value)}
                            placeholder="Search Customer (Name, Phone, Area)..."
                            className={`${INPUT_CLASS} min-h-[44px] pl-9 text-sm`}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setCustomerSearch((s) => s.trim())}
                          className="min-h-[44px] shrink-0 rounded-xl bg-[#136EE6] px-4 text-xs font-bold text-white transition-colors hover:bg-[#0D59BF]"
                        >
                          Search
                        </button>
                      </div>

                      {/* Recent Filter & + New Customer */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setRecentOnly((prev) => !prev)}
                          className={`flex min-h-[36px] items-center justify-center gap-1.5 rounded-xl px-2.5 text-[11px] font-bold transition-colors ${
                            recentOnly
                              ? 'bg-[#0B56C5] text-white shadow-xs ring-2 ring-blue-300'
                              : 'bg-[#136EE6] text-white hover:bg-[#0D59BF]'
                          }`}
                        >
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {recentOnly ? 'Showing Recent Only' : 'Recent & Frequent Customers'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowNewCustomer((prev) => !prev)}
                          className="flex min-h-[36px] items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-2.5 text-[11px] font-bold text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                        >
                          <UserPlus className="h-3.5 w-3.5 shrink-0 text-[#136EE6] dark:text-sky-400" />
                          <span>New Customer</span>
                        </button>
                      </div>

                      {/* Inline Quick Add Customer */}
                      <AnimatePresence initial={false}>
                        {showNewCustomer && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50/60 p-2.5 dark:border-blue-900/60 dark:bg-blue-950/30">
                              <div className="text-[11px] font-bold text-slate-900 dark:text-white">
                                Quick Register Customer
                              </div>
                              <FormError message={newCustError} shakeKey={newCustShake} />
                              <div className="space-y-2">
                                <div>
                                  <label
                                    htmlFor="qs-new-cust-name"
                                    className="mb-0.5 flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300"
                                  >
                                    <span>Name *</span>
                                    <ValidCheck valid={newCustName.trim().length > 1} />
                                  </label>
                                  <input
                                    id="qs-new-cust-name"
                                    type="text"
                                    value={newCustName}
                                    onChange={(e) => setNewCustName(e.target.value)}
                                    placeholder="e.g. Zanzibar Fresh Traders"
                                    className={`${INPUT_CLASS} min-h-[42px] text-sm`}
                                  />
                                </div>
                                <div>
                                  <label
                                    htmlFor="qs-new-cust-phone"
                                    className="mb-0.5 flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300"
                                  >
                                    <span>Phone (07... / 255...) *</span>
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
                              <div className="flex justify-end gap-1.5">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => setShowNewCustomer(false)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={handleAddNewCustomer}
                                >
                                  Save & Select
                                </Button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Customer Radio Cards */}
                      <div className="max-h-[370px] flex-1 space-y-2 overflow-y-auto pr-0.5">
                        {filteredCustomers.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                            No customer matches &ldquo;{customerSearch}&rdquo;. Use{' '}
                            <strong>New Customer</strong> above.
                          </div>
                        ) : (
                          filteredCustomers.map((c) => {
                            const debt = getCustomerOutstandingBalance(state.sales, c.id);
                            const isSel = selectedCustomerId === c.id;
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => handleSelectCustomer(c)}
                                className={`flex w-full items-center justify-between gap-2 rounded-xl border p-2.5 text-left transition-all ${
                                  isSel
                                    ? 'border-[#136EE6] bg-blue-50/60 ring-1 ring-[#136EE6] dark:border-sky-500 dark:bg-blue-950/40 dark:ring-sky-500'
                                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/70'
                                }`}
                              >
                                <div className="flex min-w-0 items-center gap-2">
                                  <span
                                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                      isSel
                                        ? 'border-[#136EE6] bg-white dark:border-sky-400 dark:bg-slate-900'
                                        : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800'
                                    }`}
                                  >
                                    {isSel && (
                                      <span className="h-2 w-2 rounded-full bg-[#136EE6] dark:bg-sky-400" />
                                    )}
                                  </span>

                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                                    {renderCustomerCategoryIcon(c.type)}
                                  </div>

                                  <div className="min-w-0">
                                    <div
                                      className={`truncate text-xs font-extrabold ${
                                        isSel
                                          ? 'text-[#0B56C5] underline decoration-blue-400/70 underline-offset-2 dark:text-sky-300'
                                          : 'text-slate-900 dark:text-white'
                                      }`}
                                    >
                                      {c.name}
                                    </div>
                                    <div className="truncate text-[10px] text-slate-600 dark:text-slate-400">
                                      {c.priceTier} · {formatTzPhoneDisplay(c.phone)}
                                    </div>
                                    <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                                      {c.location}
                                    </div>
                                  </div>
                                </div>

                                <div className="shrink-0 text-right">
                                  {debt > 0 ? (
                                    <div className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 tabular-nums dark:border-rose-900/60 dark:bg-rose-950/60 dark:text-rose-300">
                                      <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                                      <span>Debt: {formatTzs(debt)}</span>
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-300">
                                      <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
                                      <span>Credit OK</span>
                                    </div>
                                  )}
                                  <div className="mt-0.5 text-[10px] font-medium text-slate-500 tabular-nums dark:text-slate-400">
                                    Limit: {formatTzs(c.creditLimitTzs)}
                                  </div>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>

                      {/* Column 1 Footer Total + Next */}
                      <div className="mt-auto space-y-2 pt-1">
                        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/70">
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                            <Scale className="h-4 w-4 text-slate-500" />
                            Total Weight:{' '}
                            <strong className="font-extrabold text-slate-900 tabular-nums dark:text-white">
                              {totalKg.toFixed(2)} kg
                            </strong>
                          </span>
                          <span className="text-xs font-extrabold text-emerald-700 tabular-nums dark:text-emerald-400">
                            {formatTzs(subtotalTzs)}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={!selectedCustomer}
                          onClick={() => focusSection(2)}
                          className="flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#136EE6] px-4 text-xs font-extrabold text-white shadow-xs transition-colors hover:bg-[#0D59BF] disabled:opacity-50"
                        >
                          <span>Next: Weigh Fish &amp; Select Stock</span>
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </section>

                  {/* ================= COLUMN 2: FISH & WEIGHT ================= */}
                  <section
                    ref={col2Ref}
                    aria-label="Fish and Weight"
                    onFocusCapture={() => setFocusedSection(2)}
                    className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex items-center gap-2.5 bg-gradient-to-r from-[#157D58] to-[#0E6446] px-4 py-3 text-white">
                      <Fish className="h-5 w-5 shrink-0 text-emerald-100" />
                      <div className="min-w-0">
                        <h3 className="font-display text-sm font-extrabold leading-tight">
                          Fish &amp; Weight
                        </h3>
                        <p className="text-[11px] text-emerald-100">
                          Select fish, pond or harvest lot
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col gap-3 p-3">
                      {/* Inventory Source Switcher: In Stock vs Direct from Pond */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSourceMode('lot');
                            setWeighError('');
                          }}
                          className={`relative flex min-h-[48px] flex-col items-center justify-center rounded-xl border px-2 py-1.5 text-center transition-all ${
                            sourceMode === 'lot'
                              ? 'border-[#163A70] bg-[#163A70] text-white shadow-xs'
                              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 text-xs font-extrabold">
                            <Fish className="h-3.5 w-3.5 text-emerald-400" />
                            In Stock
                          </span>
                          <span
                            className={`text-[10px] font-bold tabular-nums ${
                              sourceMode === 'lot'
                                ? 'text-sky-200'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            ({availableLots.length})
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSourceMode('pond');
                            setWeighError('');
                          }}
                          className={`relative flex min-h-[48px] flex-col items-center justify-center rounded-xl border px-2 py-1.5 text-center transition-all ${
                            sourceMode === 'pond'
                              ? 'border-[#163A70] bg-[#163A70] text-white shadow-xs'
                              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 text-xs font-extrabold">
                            <Sprout className="h-3.5 w-3.5 text-emerald-400" />
                            Direct from Pond
                          </span>
                          <span
                            className={`text-[10px] font-bold tabular-nums ${
                              sourceMode === 'pond'
                                ? 'text-sky-200'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            ({activePonds.length})
                          </span>
                        </button>
                      </div>

                      {/* Source Selector Dropdown */}
                      {sourceMode === 'lot' ? (
                        availableLots.length === 0 ? (
                          <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-200">
                            <span>No harvest lots in stock.</span>
                            <button
                              type="button"
                              onClick={() => setSourceMode('pond')}
                              className="shrink-0 rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-700"
                            >
                              Use Pond
                            </button>
                          </div>
                        ) : (
                          <div>
                            <label
                              htmlFor="qs-lot-select"
                              className="mb-1 block text-xs font-bold text-slate-800 dark:text-slate-200"
                            >
                              Select Harvest Lot{' '}
                              <span className="font-normal text-slate-500">
                                (deducts on confirm)
                              </span>
                            </label>
                            <select
                              id="qs-lot-select"
                              value={selectedLot?.id || ''}
                              onChange={(e) => {
                                setSelectedLotId(e.target.value);
                                setWeighError('');
                              }}
                              className={`${INPUT_CLASS} min-h-[44px] text-sm font-semibold`}
                            >
                              {availableLots.map((l) => (
                                <option key={l.id} value={l.id}>
                                  {l.lotCode} · {l.pondCode} ({l.species}) — Rem:{' '}
                                  {getLotTotalRemainingKg(l).toFixed(1)} kg
                                </option>
                              ))}
                            </select>
                          </div>
                        )
                      ) : (
                        <div>
                          <label
                            htmlFor="qs-pond-select"
                            className="mb-1 block text-xs font-bold text-slate-800 dark:text-slate-200"
                          >
                            Select Active Pond{' '}
                            <span className="font-normal text-slate-500">
                              (auto-creates harvest lot on confirm)
                            </span>
                          </label>
                          <select
                            id="qs-pond-select"
                            value={selectedPond?.code || ''}
                            onChange={(e) => {
                              setSelectedPondCode(e.target.value);
                              setWeighError('');
                            }}
                            className={`${INPUT_CLASS} min-h-[44px] text-sm font-semibold`}
                          >
                            {activePonds.map((p) => (
                              <option key={p.id} value={p.code}>
                                {p.code} — {p.species} ({formatNumber(p.currentFish)} fish)
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Select Fish Grade Cards (Large / Medium / Small) */}
                      <div>
                        <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                          <span>Select Fish Grade</span>
                          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            {selectedCustomer?.priceTier || 'Standard'} pricing
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {GRADES.map((g) => {
                            const avail = getAvailableKgForSelected(g);
                            const species =
                              sourceMode === 'lot'
                                ? selectedLot?.species || 'Nile Tilapia'
                                : selectedPond?.species || 'Nile Tilapia';
                            const tierPrice = getPriceForItem(
                              state.priceList,
                              species,
                              g,
                              selectedCustomer?.priceTier || 'Standard',
                              state.salesPreferences.lastPricesByKey
                            );
                            const active = grade === g;
                            const imgScale =
                              g === 'Large' ? 'scale-105' : g === 'Medium' ? 'scale-95' : 'scale-85';

                            return (
                              <motion.button
                                key={g}
                                type="button"
                                whileTap={{ scale: 0.97 }}
                                onClick={() => {
                                  setGrade(g);
                                  setWeighError('');
                                }}
                                className={`relative flex flex-col items-center rounded-xl border p-2 text-center transition-all ${
                                  active
                                    ? 'border-[#136EE6] bg-blue-50/70 ring-1 ring-[#136EE6] dark:border-sky-400 dark:bg-blue-950/50 dark:ring-sky-400'
                                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800'
                                }`}
                              >
                                {active && (
                                  <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#136EE6] text-white shadow-xs">
                                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                                  </span>
                                )}
                                <div className="mb-1 flex h-10 w-full items-center justify-center overflow-hidden rounded-lg bg-slate-100/80 dark:bg-slate-900/60">
                                  <img
                                    src={ASSET_IMAGES.tilapia}
                                    alt={`${g} grade tilapia`}
                                    className={`h-full w-full object-cover ${imgScale}`}
                                  />
                                </div>
                                <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                                  {g}
                                </div>
                                <div className="text-[10px] font-medium text-slate-500 tabular-nums dark:text-slate-400">
                                  {avail.toFixed(1)} kg avail
                                </div>
                                <div className="mt-0.5 text-[10px] font-extrabold text-emerald-700 tabular-nums dark:text-emerald-400">
                                  {formatTzs(tierPrice)}/kg
                                </div>
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Weight (kg) * + Fish Count (optional) */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label
                            htmlFor="qs-weight-kg"
                            className="mb-1 flex items-center justify-between text-xs font-bold text-[#136EE6] dark:text-sky-400"
                          >
                            <span>Weight (kg) *</span>
                            <ValidCheck
                              valid={
                                Number(kgInput) > 0 &&
                                Number(kgInput) <= getAvailableKgForSelected(grade)
                              }
                            />
                          </label>
                          <div className="relative">
                            <Scale className="pointer-events-none absolute top-3.5 left-3 h-4 w-4 text-slate-400" />
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
                              className={`${INPUT_CLASS} min-h-[44px] pl-9 text-sm font-extrabold tabular-nums`}
                            />
                          </div>
                        </div>

                        <div>
                          <label
                            htmlFor="qs-fish-count"
                            className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300"
                          >
                            Fish Count (optional)
                          </label>
                          <div className="relative">
                            <Hash className="pointer-events-none absolute top-3.5 left-3 h-4 w-4 text-slate-400" />
                            <input
                              id="qs-fish-count"
                              type="number"
                              inputMode="numeric"
                              min="0"
                              placeholder="0"
                              value={countInput}
                              onChange={(e) => setCountInput(e.target.value)}
                              className={`${INPUT_CLASS} min-h-[44px] pl-9 text-sm font-extrabold tabular-nums`}
                            />
                          </div>
                        </div>
                      </div>

                      <FormError message={weighError} shakeKey={weighShake} />

                      {/* Green Add Weighing Button */}
                      <button
                        type="button"
                        onClick={handleAddWeighing}
                        className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-[#169B4E] px-3 text-xs font-extrabold text-white shadow-xs transition-colors hover:bg-[#128140]"
                      >
                        <Scale className="h-4 w-4" />
                        <span>Add {grade} Weighing to Sale</span>
                      </button>

                      {/* Added Weighings List */}
                      {lines.length > 0 && (
                        <div className="max-h-[125px] space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/70 p-2 dark:border-slate-800 dark:bg-slate-800/50">
                          <AnimatePresence initial={false}>
                            {lines.map((ln) => (
                              <motion.div
                                key={ln.id}
                                layout
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: DURATIONS.fast, ease: EASE_OUT }}
                                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-900"
                              >
                                <div className="min-w-0">
                                  <div className="truncate font-bold text-slate-900 dark:text-white">
                                    {ln.grade} {ln.species} ·{' '}
                                    <span className="tabular-nums">{ln.kg.toFixed(2)} kg</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                                    <span>{ln.lotCode || ln.pondCode}</span>
                                    {ln.count > 0 && <span>· {ln.count} fish</span>}
                                    <span>·</span>
                                    {perms.canOverrideSalePrice ? (
                                      <input
                                        type="number"
                                        inputMode="numeric"
                                        aria-label={`Price per kg for ${ln.grade}`}
                                        value={ln.pricePerKgTzs}
                                        onChange={(e) => {
                                          const nextPrice = Math.max(
                                            0,
                                            roundTzs(Number(e.target.value) || 0)
                                          );
                                          setLines((prev) =>
                                            prev.map((x) =>
                                              x.id === ln.id
                                                ? { ...x, pricePerKgTzs: nextPrice }
                                                : x
                                            )
                                          );
                                        }}
                                        className="w-28 min-h-[34px] rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-right font-mono text-xs font-bold text-slate-900 tabular-nums dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                                      />
                                    ) : (
                                      <span className="font-mono tabular-nums">
                                        {formatTzs(ln.pricePerKgTzs)}/kg
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5">
                                  <span className="font-bold text-emerald-700 tabular-nums dark:text-emerald-400">
                                    {formatTzs(roundTzs(ln.kg * ln.pricePerKgTzs))}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setLines((prev) => prev.filter((x) => x.id !== ln.id))
                                    }
                                    aria-label={`Remove ${ln.grade} line`}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/60"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                      )}

                      {/* Green Summary Pill + Back/Next */}
                      <div className="mt-auto space-y-2 pt-1">
                        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900/60 dark:bg-emerald-950/40">
                          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            Total Weight:{' '}
                            <span className="font-extrabold tabular-nums">
                              {totalKg.toFixed(2)} kg
                            </span>
                          </span>
                          <span className="text-sm font-extrabold text-emerald-700 tabular-nums dark:text-emerald-400">
                            {formatTzs(subtotalTzs)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => focusSection(1)}
                            className="flex min-h-[42px] items-center justify-center gap-1 rounded-xl border border-slate-300 bg-slate-100 px-3.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          >
                            <ArrowLeft className="h-3.5 w-3.5" />
                            <span>Back</span>
                          </button>
                          <button
                            type="button"
                            disabled={lines.length === 0}
                            onClick={() => focusSection(3)}
                            className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#136EE6] px-4 text-xs font-extrabold text-white shadow-xs transition-colors hover:bg-[#0D59BF] disabled:opacity-50"
                          >
                            <span>Next: Pay &amp; Dispatch</span>
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* ================= COLUMN 3: PAYMENT & DISPATCH ================= */}
                  <section
                    ref={col3Ref}
                    aria-label="Payment and Dispatch"
                    onFocusCapture={() => setFocusedSection(3)}
                    className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex items-center gap-2.5 bg-gradient-to-r from-[#16396E] to-[#0D254B] px-4 py-3 text-white">
                      <Wallet className="h-5 w-5 shrink-0 text-sky-200" />
                      <div className="min-w-0">
                        <h3 className="font-display text-sm font-extrabold leading-tight">
                          Payment &amp; Dispatch
                        </h3>
                        <p className="text-[11px] text-sky-200">
                          Choose payment and delivery status
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col gap-2.5 p-3">
                      {/* Payment Method Grid */}
                      <div>
                        <div className="mb-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                          Payment Method *
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {PAYMENT_METHODS.map((m) => {
                            const active = paymentMethod === m;
                            return (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setPaymentMethod(m)}
                                className={`flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-xl border px-1 py-1.5 text-center transition-all ${
                                  active
                                    ? 'border-[#136EE6] bg-blue-50/70 text-[#0B56C5] ring-1 ring-[#136EE6] dark:border-sky-400 dark:bg-blue-950/50 dark:text-sky-300 dark:ring-sky-400'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200'
                                }`}
                              >
                                {renderPaymentMethodIcon(m)}
                                <span className="text-[10px] font-bold leading-tight">{m}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Amount Paid Now + Quick Full/50%/Credit */}
                      <div>
                        <label
                          htmlFor="qs-paid-amount"
                          className="mb-1 flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200"
                        >
                          <span>Amount Paid Now (TZS) *</span>
                          <ValidCheck
                            valid={paidInput.trim() !== '' && paidTzs >= 0 && paidTzs <= totalTzs}
                          />
                        </label>
                        <div className="flex items-center gap-1.5">
                          <div className="relative flex-1">
                            <Banknote className="pointer-events-none absolute top-3.5 left-3 h-4 w-4 text-slate-400" />
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
                                setPaidInput(e.target.value);
                              }}
                              className={`${INPUT_CLASS} min-h-[44px] pl-9 text-sm font-extrabold text-slate-900 tabular-nums dark:text-white`}
                            />
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setPaidManuallyEdited(false);
                                setPaidInput(String(totalTzs));
                              }}
                              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                              Full
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPaidManuallyEdited(true);
                                setPaidInput(String(Math.round(totalTzs / 2)));
                              }}
                              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                              50%
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPaidManuallyEdited(true);
                                setPaidInput('0');
                              }}
                              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                              Credit
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Payment Reference */}
                      <div>
                        <label
                          htmlFor="qs-pay-ref"
                          className="mb-1 block text-xs font-bold text-slate-800 dark:text-slate-200"
                        >
                          Payment Reference
                        </label>
                        <div className="relative">
                          <FileText className="pointer-events-none absolute top-3.5 left-3 h-4 w-4 text-slate-400" />
                          <input
                            id="qs-pay-ref"
                            type="text"
                            value={paymentReference}
                            onChange={(e) => setPaymentReference(e.target.value)}
                            placeholder="e.g. MPESA TRX123456"
                            className={`${INPUT_CLASS} min-h-[44px] pl-9 font-mono text-sm`}
                          />
                        </div>
                      </div>

                      {/* Delivery Status Segmented Buttons */}
                      <div>
                        <div className="mb-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                          Delivery Status
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(['Pending Dispatch', 'In Transit', 'Delivered'] as const).map(
                            (st) => (
                              <button
                                key={st}
                                type="button"
                                onClick={() => setDeliveryStatus(st)}
                                className={`min-h-[42px] rounded-xl border px-1.5 py-1 text-[11px] font-bold leading-tight transition-colors ${
                                  deliveryStatus === st
                                    ? 'border-[#136EE6] bg-[#136EE6] text-white shadow-xs'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                                }`}
                              >
                                {st}
                              </button>
                            )
                          )}
                        </div>
                      </div>

                      {/* Delivery Address */}
                      <div>
                        <label
                          htmlFor="qs-del-address"
                          className="mb-1 block text-xs font-bold text-slate-800 dark:text-slate-200"
                        >
                          Delivery Address {deliveryStatus !== 'Delivered' ? '*' : ''}
                        </label>
                        <div className="relative">
                          <MapPin className="pointer-events-none absolute top-3.5 left-3 h-4 w-4 text-slate-400" />
                          <input
                            id="qs-del-address"
                            type="text"
                            value={deliveryAddress}
                            onChange={(e) => setDeliveryAddress(e.target.value)}
                            placeholder="Enter delivery address..."
                            className={`${INPUT_CLASS} min-h-[44px] pl-9 text-sm`}
                          />
                        </div>
                      </div>

                      {/* Vehicle / Driver */}
                      <div>
                        <label
                          htmlFor="qs-del-vehicle"
                          className="mb-1 block text-xs font-bold text-slate-800 dark:text-slate-200"
                        >
                          Vehicle / Driver (Optional)
                        </label>
                        <div className="relative">
                          <Truck className="pointer-events-none absolute top-3.5 left-3 h-4 w-4 text-slate-400" />
                          <input
                            id="qs-del-vehicle"
                            type="text"
                            value={vehicleOrDriver}
                            onChange={(e) => setVehicleOrDriver(e.target.value)}
                            placeholder="Enter vehicle & driver..."
                            className={`${INPUT_CLASS} min-h-[44px] pl-9 text-sm`}
                          />
                        </div>
                      </div>

                      {/* Discount row (Owner / Manager only, clean compact strip) */}
                      <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                        <div>
                          <label
                            htmlFor="qs-discount"
                            className="mb-0.5 flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300"
                          >
                            <span>Discount (TZS)</span>
                            {!perms.canOverrideSalePrice && <Lock className="h-3 w-3 text-slate-400" />}
                          </label>
                          <input
                            id="qs-discount"
                            type="number"
                            inputMode="numeric"
                            min="0"
                            disabled={!perms.canOverrideSalePrice}
                            value={discountInput}
                            onChange={(e) => setDiscountInput(e.target.value)}
                            className={`${INPUT_CLASS} min-h-[42px] text-sm font-bold tabular-nums disabled:opacity-60`}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="qs-discount-reason"
                            className="mb-0.5 block text-[11px] font-bold text-slate-700 dark:text-slate-300"
                          >
                            Discount Reason {discountTzs > 0 ? '*' : ''}
                          </label>
                          <input
                            id="qs-discount-reason"
                            type="text"
                            disabled={!perms.canOverrideSalePrice || discountTzs === 0}
                            value={discountReason}
                            onChange={(e) => setDiscountReason(e.target.value)}
                            placeholder={discountTzs > 0 ? 'Reason required' : 'Optional'}
                            className={`${INPUT_CLASS} min-h-[42px] text-sm disabled:opacity-60`}
                          />
                        </div>
                      </div>

                      {/* Conditional 4-Digit PIN Approval (never displays PIN value!) */}
                      {pinRequired && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 dark:border-amber-900/60 dark:bg-amber-950/40">
                          <label
                            htmlFor="qs-pin"
                            className="mb-1 flex items-center justify-between text-[11px] font-bold text-slate-800 dark:text-slate-200"
                          >
                            <span className="flex items-center gap-1">
                              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              PIN Approval Required (≥ {formatTzs(state.salesPreferences.pinThresholdTzs)})
                            </span>
                            <ValidCheck valid={/^\d{4}$/.test(pin)} />
                          </label>
                          <input
                            id="qs-pin"
                            type="password"
                            inputMode="numeric"
                            maxLength={4}
                            placeholder="Enter 4-digit PIN"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            className={`${INPUT_CLASS} min-h-[44px] font-mono text-sm tracking-widest`}
                          />
                        </div>
                      )}
                    </div>
                  </section>

                  {/* ================= COLUMN 4: SALE SUMMARY ================= */}
                  <section
                    aria-label="Sale Summary"
                    className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex items-center gap-2.5 bg-gradient-to-r from-[#109457] to-[#0B7745] px-4 py-3 text-white">
                      <BarChart3 className="h-5 w-5 shrink-0 text-emerald-100" />
                      <div>
                        <h3 className="font-display text-sm font-extrabold leading-tight">
                          Sale Summary
                        </h3>
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col gap-2.5 p-3">
                      {/* Item & Weight Rows */}
                      <div className="space-y-2 border-b border-slate-100 pb-2.5 text-xs dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                            <ShoppingCart className="h-4 w-4 text-[#16396E] dark:text-sky-400" />
                            Fish Items
                          </span>
                          <span className="font-extrabold text-slate-900 tabular-nums dark:text-white">
                            {lines.length}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                            <Scale className="h-4 w-4 text-[#16396E] dark:text-sky-400" />
                            Total Weight
                          </span>
                          <span className="font-extrabold text-slate-900 tabular-nums dark:text-white">
                            {totalKg.toFixed(2)} kg
                          </span>
                        </div>
                      </div>

                      {/* Financial Breakdown */}
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 dark:text-slate-400">Subtotal</span>
                          <span className="font-bold text-slate-900 tabular-nums dark:text-white">
                            {formatTzs(subtotalTzs)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 dark:text-slate-400">Discount</span>
                          <span
                            className={`font-bold tabular-nums ${
                              discountTzs > 0
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {discountTzs > 0 ? `-${formatTzs(discountTzs)}` : 'TZS 0'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="inline-flex cursor-pointer items-center gap-1.5 text-slate-600 dark:text-slate-400">
                            <input
                              type="checkbox"
                              checked={applyTax}
                              onChange={(e) => setApplyTax(e.target.checked)}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span>Tax (18%)</span>
                          </label>
                          <span className="font-bold text-slate-900 tabular-nums dark:text-white">
                            {formatTzs(taxTzs)}
                          </span>
                        </div>
                      </div>

                      {/* Highlighted Summary Cards */}
                      <div className="space-y-2 pt-1">
                        {/* Total Payable Card */}
                        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/90 px-3 py-2.5 dark:border-emerald-900/60 dark:bg-emerald-950/40">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                            <Banknote className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <div className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">
                              Total Payable
                            </div>
                            <div className="font-display text-base font-extrabold text-emerald-800 tabular-nums dark:text-emerald-300">
                              <CountUpNumber value={totalTzs} formatter={formatTzs} />
                            </div>
                          </div>
                        </div>

                        {/* Amount Paid Card */}
                        <div className="flex items-center gap-2.5 rounded-xl border border-sky-200 bg-sky-50/90 px-3 py-2.5 dark:border-sky-900/60 dark:bg-sky-950/40">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#16396E] text-white">
                            <Wallet className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <div className="text-[11px] font-bold text-slate-700 dark:text-sky-200">
                              Amount Paid
                            </div>
                            <div className="font-display text-base font-extrabold text-[#0B2B5C] tabular-nums dark:text-sky-300">
                              {formatTzs(paidTzs)}
                            </div>
                          </div>
                        </div>

                        {/* Outstanding Card */}
                        {balanceTzs > 0 ? (
                          <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50/90 px-3 py-2.5 dark:border-rose-900/60 dark:bg-rose-950/40">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white">
                              <AlertTriangle className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <div className="text-[11px] font-bold text-rose-800 dark:text-rose-200">
                                Outstanding
                              </div>
                              <div className="font-display text-base font-extrabold text-rose-700 tabular-nums dark:text-rose-300">
                                {formatTzs(balanceTzs)}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-3 py-2 text-xs font-bold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            <span>Paid in Full (TZS 0 balance)</span>
                          </div>
                        )}
                      </div>

                      <FormError message={submitError} shakeKey={submitShake} />

                      {/* Readiness Indicator + Confirm Button */}
                      <div className="mt-auto space-y-2.5 pt-1">
                        <div
                          className={`flex flex-col items-center rounded-xl border px-3 py-2.5 text-center ${
                            readinessStatus.ready
                              ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/60 dark:bg-emerald-950/40'
                              : 'border-amber-200 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/40'
                          }`}
                        >
                          <span
                            className={`mb-1 flex h-8 w-8 items-center justify-center rounded-full text-white ${
                              readinessStatus.ready ? 'bg-emerald-600' : 'bg-amber-500'
                            }`}
                          >
                            {readinessStatus.ready ? (
                              <ShieldCheck className="h-4 w-4" />
                            ) : (
                              <AlertTriangle className="h-4 w-4" />
                            )}
                          </span>
                          <div
                            className={`text-xs font-extrabold ${
                              readinessStatus.ready
                                ? 'text-emerald-900 dark:text-emerald-200'
                                : 'text-amber-900 dark:text-amber-200'
                            }`}
                          >
                            {readinessStatus.title}
                          </div>
                          <div
                            className={`text-[11px] ${
                              readinessStatus.ready
                                ? 'text-emerald-700 dark:text-emerald-300'
                                : 'text-amber-800 dark:text-amber-300'
                            }`}
                          >
                            {readinessStatus.detail}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={handleConfirm}
                          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#11A653] px-3 py-2.5 text-xs font-extrabold text-white shadow-sm transition-all hover:bg-[#0D8F46] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Confirming Sale...</span>
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4 stroke-[2.5]" />
                              <span>Confirm Sale &amp; Issue Receipt</span>
                              <Printer className="h-4 w-4" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
