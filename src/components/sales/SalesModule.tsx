import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Scale,
  Coins,
  TrendingUp,
  CreditCard,
  FileDown,
  Search,
  Plus,
  FileText,
  MessageCircle,
  Phone,
  Users,
  Tag,
  Package,
  CalendarClock,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Boxes,
  Lock,
} from 'lucide-react';
import {
  AquacultureState,
  Customer,
  CustomerType,
  FishGrade,
  Language,
  PaymentMethod,
  PreOrder,
  PriceListItem,
  PriceTier,
  Sale,
} from '../../types/aquaculture';
import {
  exportToCsv,
  formatNumber,
  formatTzs,
  isDateInPeriod,
  TimeFilterPeriod,
  todayIso,
} from '../../utils/formatters';
import { getPermissions } from '../../utils/rbac';
import {
  buildWhatsAppReminderUrl,
  formatTzPhoneDisplay,
  getAgingBucket,
  getCustomerOutstandingBalance,
  getDaysSince,
  getLotTotalRemainingKg,
  getPriceForItem,
  normalizeTzPhone,
  roundKg,
  roundTzs,
} from '../../utils/sales';
import { TRANSLATIONS } from '../../i18n/translations';
import { QuickActionType } from '../QuickActionModals';
import {
  AnimatedTabs,
  Badge,
  Button,
  Card,
  CountUpNumber,
  EmptyState,
  FormError,
  INPUT_CLASS,
  PullToRefresh,
  Sheet,
  ValidCheck,
  listItem,
} from '../../ui';

const PERIOD_OPTIONS: Array<{ id: TimeFilterPeriod; label: string }> = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'all', label: 'All' },
];

const PAYMENT_METHODS: PaymentMethod[] = [
  'Cash',
  'M-Pesa',
  'Tigo Pesa',
  'Airtel Money',
  'Halopesa',
  'Bank Transfer',
  'Cheque',
];

const TIERS: PriceTier[] = ['Wholesale', 'Hotel/HORECA', 'Retail', 'Standard'];
const GRADES: FishGrade[] = ['Large', 'Medium', 'Small'];

type SalesTab = 'sales' | 'customers' | 'price-list' | 'receivables' | 'lots' | 'pre-orders';

interface SalesModuleProps {
  state: AquacultureState;
  language: Language;
  onQuickAction: (a: QuickActionType) => void;
  onOpenQuickSale: (opts?: { lotId?: string; preOrder?: PreOrder }) => void;
  onBackToMenu?: () => void;
  onOpenFishStock?: () => void;
  onViewInvoice: (sale: Sale) => void;
  onCollectPayment: (payload: {
    saleId: string;
    amountTzs: number;
    method: PaymentMethod;
    reference: string;
  }) => { ok: boolean; error?: string };
  onUpdateDeliveryStatus: (saleId: string, status: Sale['deliveryStatus']) => void;
  onAddCustomer: (payload: Omit<Customer, 'id' | 'createdAt'>) => { ok: boolean; error?: string };
  onUpdateCustomer: (id: string, patch: Partial<Customer>) => void;
  onSavePriceItem: (payload: Omit<PriceListItem, 'id'> & { id?: string }) => void;
  onAddPreOrder: (payload: Omit<PreOrder, 'id' | 'status' | 'date'>) => { ok: boolean; error?: string };
  onCancelPreOrder: (id: string) => void;
}

export const SalesModule: React.FC<SalesModuleProps> = ({
  state,
  language,
  onQuickAction,
  onOpenQuickSale,
  onBackToMenu,
  onOpenFishStock,
  onViewInvoice,
  onCollectPayment,
  onUpdateDeliveryStatus,
  onAddCustomer,
  onUpdateCustomer,
  onSavePriceItem,
  onAddPreOrder,
  onCancelPreOrder,
}) => {
  const t = TRANSLATIONS[language];
  const perms = getPermissions(state.activeUser.role);

  const [activeTab, setActiveTab] = useState<SalesTab>('sales');
  const [period, setPeriod] = useState<TimeFilterPeriod>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [speciesFilter, setSpeciesFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'Paid' | 'Partial' | 'Credit'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Collect Payment Modal state
  const [payTargetSale, setPayTargetSale] = useState<Sale | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>(
    state.salesPreferences.lastPaymentMethod || 'M-Pesa'
  );
  const [payRef, setPayRef] = useState<string>('');
  const [payError, setPayError] = useState<string>('');
  const [payShake, setPayShake] = useState(0);
  const [lastRefreshedLabel, setLastRefreshedLabel] = useState<string | null>(null);

  // Add Customer form state (no dummy defaults!)
  const [showCustForm, setShowCustForm] = useState(false);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custType, setCustType] = useState<CustomerType>('Retailer');
  const [custLocation, setCustLocation] = useState('');
  const [custTier, setCustTier] = useState<PriceTier>('Retail');
  const [custLimit, setCustLimit] = useState('');
  const [custTerms, setCustTerms] = useState('');
  const [custNotes, setCustNotes] = useState('');
  const [custError, setCustError] = useState('');

  // Price List add/edit state
  const [priceSpecies, setPriceSpecies] = useState('Nile Tilapia');
  const [priceGrade, setPriceGrade] = useState<FishGrade>('Large');
  const [priceTier, setPriceTier] = useState<PriceTier>('Retail');
  const [priceAmount, setPriceAmount] = useState('');
  const [priceError, setPriceError] = useState('');

  // Pre-order form state
  const [showPreOrderForm, setShowPreOrderForm] = useState(false);
  const [poCustomerId, setPoCustomerId] = useState('');
  const [poSpecies, setPoSpecies] = useState('Nile Tilapia');
  const [poGrade, setPoGrade] = useState<FishGrade>('Large');
  const [poKg, setPoKg] = useState('');
  const [poExpectedDate, setPoExpectedDate] = useState('');
  const [poPrice, setPoPrice] = useState('');
  const [poDeposit, setPoDeposit] = useState('0');
  const [poNotes, setPoNotes] = useState('');
  const [poError, setPoError] = useState('');

  const filteredSales = state.sales.filter((s) => {
    if (!isDateInPeriod(s.date, period)) return false;
    if (customerFilter !== 'all' && s.customerId !== customerFilter) return false;
    if (speciesFilter !== 'all' && !s.lines.some((l) => l.species === speciesFilter)) return false;
    if (paymentFilter !== 'all' && s.paymentStatus !== paymentFilter) return false;
    if (
      searchQuery.trim() &&
      !`${s.invoiceNo} ${s.customerName} ${s.lines.map((l) => `${l.pondCode} ${l.species}`).join(' ')}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const periodRevenue = filteredSales.reduce((sum, s) => sum + s.totalTzs, 0);
  const periodKgSold = roundKg(
    filteredSales.reduce((sum, s) => sum + s.lines.reduce((ls, l) => ls + l.kg, 0), 0)
  );
  const avgPricePerKg = periodKgSold > 0 ? roundTzs(periodRevenue / periodKgSold) : 0;
  const totalReceivables = state.sales.reduce((sum, s) => sum + s.balanceTzs, 0);

  // Receivables aging buckets
  const unpaidSales = state.sales.filter((s) => s.balanceTzs > 0);
  const aging0_7 = unpaidSales
    .filter((s) => getAgingBucket(s.date) === '0-7')
    .reduce((sum, s) => sum + s.balanceTzs, 0);
  const aging8_30 = unpaidSales
    .filter((s) => getAgingBucket(s.date) === '8-30')
    .reduce((sum, s) => sum + s.balanceTzs, 0);
  const aging30Plus = unpaidSales
    .filter((s) => getAgingBucket(s.date) === '30+')
    .reduce((sum, s) => sum + s.balanceTzs, 0);

  const openCollectModal = (sale: Sale) => {
    setPayTargetSale(sale);
    setPayAmount(String(sale.balanceTzs));
    setPayMethod(state.salesPreferences.lastPaymentMethod || 'M-Pesa');
    setPayRef('');
    setPayError('');
  };

  const handleCollectSubmit = () => {
    if (!payTargetSale) return;
    setPayError('');
    const amt = roundTzs(Number(payAmount));
    if (!Number.isFinite(amt) || amt <= 0) {
      setPayError('Enter a payment amount greater than TZS 0.');
      setPayShake((s) => s + 1);
      return;
    }
    if (amt > payTargetSale.balanceTzs) {
      setPayError(`Amount cannot exceed invoice balance (${formatTzs(payTargetSale.balanceTzs)}).`);
      setPayShake((s) => s + 1);
      return;
    }
    const res = onCollectPayment({
      saleId: payTargetSale.id,
      amountTzs: amt,
      method: payMethod,
      reference: payRef.trim(),
    });
    if (!res.ok) {
      setPayError(res.error || 'Failed to record payment.');
      setPayShake((s) => s + 1);
      return;
    }
    setPayTargetSale(null);
  };

  const handleCreateCustomerSubmit = () => {
    setCustError('');
    if (!custName.trim()) {
      setCustError('Customer name is required.');
      return;
    }
    const normalizedPhone = normalizeTzPhone(custPhone);
    if (!normalizedPhone) {
      setCustError('Valid Tanzania phone number required (e.g. 0712345678 or 255712345678).');
      return;
    }
    const creditLimit = roundTzs(Number(custLimit) || 0);
    const terms = Math.max(0, Math.round(Number(custTerms) || 0));
    const res = onAddCustomer({
      name: custName.trim(),
      phone: normalizedPhone,
      type: custType,
      location: custLocation.trim() || 'Dar es Salaam',
      priceTier: custTier,
      creditLimitTzs: creditLimit,
      paymentTermsDays: terms,
      notes: custNotes.trim(),
    });
    if (!res.ok) {
      setCustError(res.error || 'Could not add customer.');
      return;
    }
    setShowCustForm(false);
    setCustName('');
    setCustPhone('');
    setCustLocation('');
    setCustLimit('');
    setCustTerms('');
    setCustNotes('');
  };

  const handleAddPriceSubmit = () => {
    setPriceError('');
    const amt = roundTzs(Number(priceAmount));
    if (!Number.isFinite(amt) || amt <= 0) {
      setPriceError('Enter a valid price per kg > 0.');
      return;
    }
    const existing = state.priceList.find(
      (p) => p.species === priceSpecies && p.grade === priceGrade && p.tier === priceTier
    );
    onSavePriceItem({
      id: existing?.id,
      species: priceSpecies,
      grade: priceGrade,
      tier: priceTier,
      pricePerKgTzs: amt,
      validFrom: todayIso(),
    });
    setPriceAmount('');
  };

  const handleCreatePreOrderSubmit = () => {
    setPoError('');
    if (!poCustomerId) {
      setPoError('Select a customer.');
      return;
    }
    const kg = roundKg(Number(poKg));
    if (!Number.isFinite(kg) || kg <= 0) {
      setPoError('Requested kg must be > 0.');
      return;
    }
    if (!poExpectedDate) {
      setPoError('Expected harvest/delivery date is required.');
      return;
    }
    const price = roundTzs(Number(poPrice));
    if (!Number.isFinite(price) || price <= 0) {
      setPoError('Agreed price/kg must be > 0.');
      return;
    }
    const deposit = Math.max(0, roundTzs(Number(poDeposit) || 0));
    const res = onAddPreOrder({
      customerId: poCustomerId,
      species: poSpecies,
      grade: poGrade,
      requestedKg: kg,
      expectedDate: poExpectedDate,
      agreedPricePerKgTzs: price,
      depositTzs: deposit,
      notes: poNotes.trim(),
    });
    if (!res.ok) {
      setPoError(res.error || 'Failed to save pre-order.');
      return;
    }
    setShowPreOrderForm(false);
    setPoKg('');
    setPoExpectedDate('');
    setPoPrice('');
    setPoDeposit('0');
    setPoNotes('');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-start gap-3">
          {onBackToMenu && (
            <Button variant="secondary" size="md" onClick={onBackToMenu}>
              <ArrowLeft className="h-4 w-4" /> {t.ui.backToMenu}
            </Button>
          )}
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t.sales.title}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.sales.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onOpenFishStock && (
            <Button variant="secondary" size="md" onClick={onOpenFishStock}>
              <Boxes className="h-4 w-4 text-teal-600 dark:text-teal-400" /> {t.nav.fishStock}
            </Button>
          )}
          <Button
            variant="secondary"
            size="md"
            onClick={() =>
              exportToCsv(
                `dukaaqusmart-sales-${period}-${todayIso()}.csv`,
                [
                  'Invoice No',
                  'Date',
                  'Customer',
                  'Phone',
                  'Items',
                  'Total kg',
                  'Total (TZS)',
                  'Paid (TZS)',
                  'Balance (TZS)',
                  'Payment Status',
                  'Delivery Status',
                ],
                filteredSales.map((s) => [
                  s.invoiceNo,
                  s.date,
                  s.customerName,
                  s.customerPhone,
                  s.lines.map((l) => `${l.species} ${l.grade} ${l.kg}kg`).join('; '),
                  s.lines.reduce((sum, l) => sum + l.kg, 0).toFixed(2),
                  s.totalTzs,
                  s.paidTzs,
                  s.balanceTzs,
                  s.paymentStatus,
                  s.deliveryStatus,
                ])
              )
            }
          >
            <FileDown className="h-4 w-4 text-blue-600 dark:text-sky-400" /> {t.sales.exportCsvBtn}
          </Button>
          <Button
            variant="warning"
            size="md"
            onClick={() => onQuickAction('harvest')}
          >
            <Scale className="h-4 w-4" /> {t.sales.recordHarvestBtn}
          </Button>
          <Button
            variant="success"
            size="md"
            onClick={() => onOpenQuickSale()}
          >
            <Plus className="h-4 w-4" /> {t.sales.quickSaleBtn}
          </Button>
        </div>
      </Card>

      {/* 4 KPI Cards with CountUpNumber */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card hoverable>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{t.sales.kpiRevenue}</span>
            <Coins className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="mt-1 font-display text-xl font-extrabold text-slate-900 dark:text-white">
            <CountUpNumber value={periodRevenue} formatter={formatTzs} />
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-emerald-700 tabular-nums dark:text-emerald-400">
            {filteredSales.length} invoice(s) in filter
          </div>
        </Card>

        <Card hoverable>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{t.sales.kpiKgSold}</span>
            <Scale className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-1 font-display text-xl font-extrabold text-slate-900 dark:text-white">
            <CountUpNumber value={periodKgSold} decimals={1} suffix=" kg" />
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Across {state.harvestLots.filter((l) => getLotTotalRemainingKg(l) > 0).length} active lot(s) in stock
          </div>
        </Card>

        <Card hoverable>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{t.sales.kpiAvgPrice}</span>
            <TrendingUp className="h-4 w-4 text-blue-600 dark:text-sky-400" />
          </div>
          <div className="mt-1 font-display text-xl font-extrabold text-blue-700 dark:text-sky-400">
            <CountUpNumber value={avgPricePerKg} formatter={formatTzs} suffix="/kg" />
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Tiered across {state.priceList.length} price rules
          </div>
        </Card>

        <Card hoverable>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{t.sales.kpiReceivables}</span>
            <CreditCard className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-1 font-display text-xl font-extrabold text-amber-700 dark:text-amber-400">
            <CountUpNumber value={totalReceivables} formatter={formatTzs} />
          </div>
          <div className="mt-0.5 text-[11px] font-semibold text-slate-500 tabular-nums dark:text-slate-400">
            {unpaidSales.length} open invoice(s)
          </div>
        </Card>
      </div>

      {/* Sub-navigation Tabs with layoutId indicator */}
      <Card padded={false} className="p-2">
        <AnimatedTabs<SalesTab>
          layoutId="sales-sub-tabs"
          activeId={activeTab}
          onChange={setActiveTab}
          className="w-full"
          tabs={[
            {
              id: 'sales',
              label: `${t.sales.tabs.sales} (${state.sales.length})`,
              icon: <FileText className="h-3.5 w-3.5" />,
            },
            {
              id: 'customers',
              label: `${t.sales.tabs.customers} (${state.customers.length})`,
              icon: <Users className="h-3.5 w-3.5" />,
            },
            {
              id: 'price-list',
              label: t.sales.tabs.priceList,
              icon: <Tag className="h-3.5 w-3.5" />,
            },
            {
              id: 'receivables',
              label: `${t.sales.tabs.receivables} (${unpaidSales.length})`,
              icon: <CreditCard className="h-3.5 w-3.5" />,
            },
            {
              id: 'lots',
              label: `${t.sales.tabs.lots} (${state.harvestLots.filter((l) => getLotTotalRemainingKg(l) > 0).length})`,
              icon: <Package className="h-3.5 w-3.5" />,
            },
            {
              id: 'pre-orders',
              label: `${t.sales.tabs.preOrders} (${state.preOrders.filter((p) => p.status === 'Open').length})`,
              icon: <CalendarClock className="h-3.5 w-3.5" />,
            },
          ]}
        />
      </Card>

      {/* TAB 1: SALES */}
      {activeTab === 'sales' && (
        <PullToRefresh
          onRefresh={() => {
            setLastRefreshedLabel(new Date().toLocaleTimeString().slice(0, 5));
          }}
        >
          <div className="space-y-3">
            {/* Filters */}
            <Card padded={false} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <AnimatedTabs<TimeFilterPeriod>
                layoutId="sales-period-pills"
                size="sm"
                activeId={period}
                onChange={setPeriod}
                tabs={PERIOD_OPTIONS}
              />

              <div className="flex flex-wrap items-center gap-2">
                {lastRefreshedLabel && (
                  <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                    Synced {lastRefreshedLabel}
                  </span>
                )}
                <div className="relative min-w-[220px] flex-1 sm:flex-initial">
                  <Search className="pointer-events-none absolute top-3.5 left-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Invoice #, customer, pond..."
                    aria-label="Search sales"
                    className={`${INPUT_CLASS} min-h-[42px] py-2 pl-9`}
                  />
                </div>
                <select
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  aria-label="Filter by customer"
                  className={`${INPUT_CLASS} min-h-[42px] w-auto min-w-[165px] py-2 font-medium`}
                >
                  <option value="all">All Customers</option>
                  {state.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={speciesFilter}
                  onChange={(e) => setSpeciesFilter(e.target.value)}
                  aria-label="Filter by species"
                  className={`${INPUT_CLASS} min-h-[42px] w-auto min-w-[150px] py-2 font-medium`}
                >
                  <option value="all">All Species</option>
                  {state.speciesCatalogue.map((s) => (
                    <option key={s.id} value={s.commonName}>
                      {s.commonName}
                    </option>
                  ))}
                </select>
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value as 'all' | 'Paid' | 'Partial' | 'Credit')}
                  aria-label="Filter by payment status"
                  className={`${INPUT_CLASS} min-h-[42px] w-auto min-w-[140px] py-2 font-medium`}
                >
                  <option value="all">All Statuses</option>
                  <option value="Paid">Paid</option>
                  <option value="Partial">Partial</option>
                  <option value="Credit">Credit</option>
                </select>
              </div>
            </Card>

            {filteredSales.length === 0 ? (
              <EmptyState
                title="No sales match the selected filters"
                description="Adjust your filters or start a 30-second Quick Sale."
                action={
                  <Button variant="success" onClick={() => onOpenQuickSale()}>
                    <Plus className="h-4 w-4" /> Create First Sale
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {filteredSales.map((sale, idx) => {
                    const saleKg = roundKg(sale.lines.reduce((s, l) => s + l.kg, 0));
                    const salePayments = state.payments.filter((p) => p.saleId === sale.id);
                    return (
                      <motion.div
                        key={sale.id}
                        layout
                        custom={idx}
                        variants={listItem}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                      >
                        <Card hoverable>
                          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs font-extrabold text-blue-700 dark:text-sky-400">
                                  {sale.invoiceNo}
                                </span>
                                <span className="text-sm font-bold text-slate-900 dark:text-white">
                                  {sale.customerName}
                                </span>
                                <Badge
                                  variant={
                                    sale.paymentStatus === 'Paid'
                                      ? 'success'
                                      : sale.paymentStatus === 'Partial'
                                        ? 'warning'
                                        : 'danger'
                                  }
                                >
                                  {sale.paymentStatus}
                                </Badge>
                              </div>
                              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                {sale.date} · {formatTzPhoneDisplay(sale.customerPhone)} · {saleKg.toFixed(2)} kg ·{' '}
                                {sale.lines.length} line(s) · Driver: {sale.vehicleOrDriver}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <div className="mr-2 text-right">
                                <div className="text-base font-extrabold text-slate-900 tabular-nums dark:text-white">
                                  {formatTzs(sale.totalTzs)}
                                </div>
                                <div className="text-[11px] font-semibold tabular-nums">
                                  <span className="text-emerald-700 dark:text-emerald-400">
                                    Paid: {formatTzs(sale.paidTzs)}
                                  </span>
                                  {sale.balanceTzs > 0 && (
                                    <span className="ml-2 text-rose-700 dark:text-rose-400">
                                      Due: {formatTzs(sale.balanceTzs)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <select
                                aria-label={`Delivery status for ${sale.invoiceNo}`}
                                value={sale.deliveryStatus}
                                onChange={(e) =>
                                  onUpdateDeliveryStatus(sale.id, e.target.value as Sale['deliveryStatus'])
                                }
                                className={`${INPUT_CLASS} min-h-[40px] w-auto min-w-[155px] py-1.5 text-xs font-semibold`}
                              >
                                <option value="Pending Dispatch">Pending Dispatch</option>
                                <option value="In Transit">In Transit</option>
                                <option value="Delivered">Delivered</option>
                              </select>

                              <Button variant="secondary" size="sm" onClick={() => onViewInvoice(sale)}>
                                <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-sky-400" /> Invoice / Print
                              </Button>

                              {sale.balanceTzs > 0 && (
                                <Button variant="success" size="sm" onClick={() => openCollectModal(sale)}>
                                  <CreditCard className="h-3.5 w-3.5" /> {t.sales.collectPayment}
                                </Button>
                              )}
                            </div>
                          </div>

                          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex flex-wrap gap-2">
                              {sale.lines.map((l, lineIdx) => (
                                <span
                                  key={`${l.lotId}-${l.grade}-${lineIdx}`}
                                  className="rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                >
                                  <strong>
                                    {l.species} ({l.grade})
                                  </strong>{' '}
                                  {l.kg} kg × {formatTzs(l.pricePerKgTzs)} ({l.pondCode})
                                </span>
                              ))}
                            </div>
                            {salePayments.length > 0 && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                Payments: {salePayments.map((p) => `${p.method} (${formatTzs(p.amountTzs)})`).join(', ')}
                              </div>
                            )}
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </PullToRefresh>
      )}

      {/* TAB 2: CUSTOMERS */}
      {activeTab === 'customers' && (
        <div className="space-y-3">
          <Card className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Customer Directory & Credit Limits
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage buyer price tiers, credit limits (TZS), payment terms, and live receivables.
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={() => setShowCustForm(!showCustForm)}>
              <Plus className="h-4 w-4" /> Add Customer
            </Button>
          </Card>

          {showCustForm && (
            <Card className="space-y-3 border-blue-200 dark:border-sky-800/60">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Register New Customer</h4>
              <FormError message={custError} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="cust-name"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Name *
                  </label>
                  <input
                    id="cust-name"
                    type="text"
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    className={`${INPUT_CLASS} min-h-[42px]`}
                  />
                </div>
                <div>
                  <label
                    htmlFor="cust-phone"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Phone (255XXXXXXXXX or 07...) *
                  </label>
                  <input
                    id="cust-phone"
                    type="tel"
                    inputMode="tel"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    className={`${INPUT_CLASS} min-h-[42px] font-mono`}
                  />
                </div>
                <div>
                  <label
                    htmlFor="cust-type"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Customer Type
                  </label>
                  <select
                    id="cust-type"
                    value={custType}
                    onChange={(e) => setCustType(e.target.value as CustomerType)}
                    className={`${INPUT_CLASS} min-h-[42px]`}
                  >
                    <option value="Market">Market</option>
                    <option value="Hotel/Restaurant">Hotel/Restaurant</option>
                    <option value="Retailer">Retailer</option>
                    <option value="Wholesaler">Wholesaler</option>
                    <option value="Individual">Individual</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="cust-loc"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Location / Delivery Area
                  </label>
                  <input
                    id="cust-loc"
                    type="text"
                    value={custLocation}
                    onChange={(e) => setCustLocation(e.target.value)}
                    className={`${INPUT_CLASS} min-h-[42px]`}
                  />
                </div>
                <div>
                  <label
                    htmlFor="cust-tier"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Price Tier
                  </label>
                  <select
                    id="cust-tier"
                    value={custTier}
                    onChange={(e) => setCustTier(e.target.value as PriceTier)}
                    className={`${INPUT_CLASS} min-h-[42px]`}
                  >
                    {TIERS.map((tr) => (
                      <option key={tr} value={tr}>
                        {tr}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="cust-limit"
                      className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Credit Limit (TZS)
                    </label>
                    <input
                      id="cust-limit"
                      type="number"
                      inputMode="numeric"
                      value={custLimit}
                      onChange={(e) => setCustLimit(e.target.value)}
                      className={`${INPUT_CLASS} min-h-[42px] tabular-nums`}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="cust-terms"
                      className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Terms (Days)
                    </label>
                    <input
                      id="cust-terms"
                      type="number"
                      inputMode="numeric"
                      value={custTerms}
                      onChange={(e) => setCustTerms(e.target.value)}
                      className={`${INPUT_CLASS} min-h-[42px] tabular-nums`}
                    />
                  </div>
                </div>
              </div>
              <div>
                <label
                  htmlFor="cust-notes"
                  className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Notes
                </label>
                <input
                  id="cust-notes"
                  type="text"
                  value={custNotes}
                  onChange={(e) => setCustNotes(e.target.value)}
                  className={`${INPUT_CLASS} min-h-[42px]`}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowCustForm(false)}>
                  Cancel
                </Button>
                <Button variant="success" size="sm" onClick={handleCreateCustomerSubmit}>
                  Save Customer
                </Button>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {state.customers.map((c, idx) => {
              const debt = getCustomerOutstandingBalance(state.sales, c.id);
              const pct =
                c.creditLimitTzs > 0 ? Math.min(100, Math.round((debt / c.creditLimitTzs) * 100)) : 0;
              return (
                <motion.div
                  key={c.id}
                  custom={idx}
                  initial="hidden"
                  animate="visible"
                  variants={listItem}
                >
                  <Card hoverable className="text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">{c.name}</div>
                        <div className="mt-0.5 font-mono text-slate-600 dark:text-slate-400">
                          {formatTzPhoneDisplay(c.phone)} · {c.location}
                        </div>
                      </div>
                      <Badge variant="info">{c.type}</Badge>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/70">
                      <div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Price Tier</div>
                        {perms.canManageCustomers ? (
                          <select
                            aria-label={`Price tier for ${c.name}`}
                            value={c.priceTier}
                            onChange={(e) =>
                              onUpdateCustomer(c.id, { priceTier: e.target.value as PriceTier })
                            }
                            className="mt-1 min-h-[36px] w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          >
                            {TIERS.map((tr) => (
                              <option key={tr} value={tr}>
                                {tr}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="font-bold text-slate-800 dark:text-slate-200">{c.priceTier}</div>
                        )}
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Credit Limit</div>
                        <div className="font-bold text-slate-900 tabular-nums dark:text-white">
                          {formatTzs(c.creditLimitTzs)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Outstanding</div>
                        <div
                          className={`font-extrabold tabular-nums ${
                            debt > 0
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {formatTzs(debt)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <motion.div
                          className={`h-full rounded-full transition-colors duration-300 ${
                            pct >= 90 ? 'bg-rose-600' : pct >= 60 ? 'bg-amber-500' : 'bg-emerald-600'
                          }`}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.45 }}
                        />
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span>
                          Terms: {c.paymentTermsDays} days · Credit used {pct}%
                        </span>
                        <button
                          type="button"
                          onClick={() => onOpenQuickSale()}
                          className="font-bold text-blue-600 hover:underline dark:text-sky-400"
                        >
                          New Sale →
                        </button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: PRICE LIST */}
      {activeTab === 'price-list' && (
        <div className="space-y-3">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Species × Grade × Tier Price List (TZS/kg)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Prices auto-fill in Quick Sale based on customer tier. Only Owner / Farm Manager can modify prices.
                </p>
              </div>
              {!perms.canOverrideSalePrice && (
                <Badge variant="neutral">
                  <Lock className="h-3.5 w-3.5" /> View Only ({state.activeUser.roleLabel})
                </Badge>
              )}
            </div>

            {perms.canOverrideSalePrice && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
                <FormError message={priceError} className="mb-2" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div>
                    <label
                      htmlFor="pl-species"
                      className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300"
                    >
                      Species
                    </label>
                    <select
                      id="pl-species"
                      value={priceSpecies}
                      onChange={(e) => setPriceSpecies(e.target.value)}
                      className={`${INPUT_CLASS} min-h-[42px]`}
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
                      htmlFor="pl-grade"
                      className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300"
                    >
                      Grade
                    </label>
                    <select
                      id="pl-grade"
                      value={priceGrade}
                      onChange={(e) => setPriceGrade(e.target.value as FishGrade)}
                      className={`${INPUT_CLASS} min-h-[42px]`}
                    >
                      {GRADES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="pl-tier"
                      className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300"
                    >
                      Tier
                    </label>
                    <select
                      id="pl-tier"
                      value={priceTier}
                      onChange={(e) => setPriceTier(e.target.value as PriceTier)}
                      className={`${INPUT_CLASS} min-h-[42px]`}
                    >
                      {TIERS.map((tr) => (
                        <option key={tr} value={tr}>
                          {tr}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="pl-price"
                      className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300"
                    >
                      Price/kg (TZS)
                    </label>
                    <input
                      id="pl-price"
                      type="number"
                      inputMode="numeric"
                      value={priceAmount}
                      onChange={(e) => setPriceAmount(e.target.value)}
                      className={`${INPUT_CLASS} min-h-[42px] tabular-nums`}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button variant="primary" size="md" fullWidth onClick={handleAddPriceSubmit}>
                      Set / Update Price
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="py-2">Species</th>
                    <th className="py-2">Grade</th>
                    {TIERS.map((tr) => (
                      <th key={tr} className="py-2 text-right">
                        {tr}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {state.speciesCatalogue.slice(0, 2).flatMap((sp) =>
                    GRADES.map((g) => (
                      <tr key={`${sp.id}-${g}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-2.5 font-bold text-slate-900 dark:text-white">
                          {sp.commonName}
                        </td>
                        <td className="py-2.5 font-semibold text-blue-700 dark:text-sky-400">{g}</td>
                        {TIERS.map((tr) => {
                          const item = state.priceList.find(
                            (p) => p.species === sp.commonName && p.grade === g && p.tier === tr
                          );
                          return (
                            <td
                              key={tr}
                              className="py-2.5 text-right font-mono font-bold text-slate-900 tabular-nums dark:text-white"
                            >
                              {item ? formatTzs(item.pricePerKgTzs) : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: RECEIVABLES & AGING */}
      {activeTab === 'receivables' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/35">
              <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                0–7 Days Aging
              </div>
              <div className="mt-1 text-lg font-extrabold text-emerald-900 tabular-nums dark:text-emerald-200">
                <CountUpNumber value={aging0_7} formatter={(v) => formatTzs(v)} />
              </div>
            </Card>
            <Card className="border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/35">
              <div className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                8–30 Days Aging
              </div>
              <div className="mt-1 text-lg font-extrabold text-amber-900 tabular-nums dark:text-amber-200">
                <CountUpNumber value={aging8_30} formatter={(v) => formatTzs(v)} />
              </div>
            </Card>
            <Card className="border-rose-200 bg-rose-50/70 dark:border-rose-900/60 dark:bg-rose-950/35">
              <div className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                30+ Days Overdue
              </div>
              <div className="mt-1 text-lg font-extrabold text-rose-900 tabular-nums dark:text-rose-200">
                <CountUpNumber value={aging30Plus} formatter={(v) => formatTzs(v)} />
              </div>
            </Card>
          </div>

          {unpaidSales.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />}
              title="All customer invoices are paid in full"
              description="No outstanding customer credit balances right now."
            />
          ) : (
            <Card padded={false} className="divide-y divide-slate-100 dark:divide-slate-800">
              {unpaidSales.map((sale) => {
                const days = getDaysSince(sale.date);
                const bucket = getAgingBucket(sale.date);
                const farmName = state.farms[0]?.name || 'DukaAquSmart Farm';
                const waRemind = buildWhatsAppReminderUrl(sale, farmName, language);
                const smsRemind = `sms:+${sale.customerPhone}?body=${encodeURIComponent(
                  `Reminder: Invoice ${sale.invoiceNo} (${sale.date}) balance ${formatTzs(sale.balanceTzs)} due to ${farmName}.`
                )}`;
                return (
                  <div
                    key={sale.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-4 text-xs"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-blue-700 dark:text-sky-400">
                          {sale.invoiceNo}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {sale.customerName}
                        </span>
                        <Badge
                          variant={
                            bucket === '30+' ? 'danger' : bucket === '8-30' ? 'warning' : 'info'
                          }
                          pulseDot={bucket === '30+'}
                        >
                          {days}d ({bucket} days)
                        </Badge>
                      </div>
                      <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                        Invoice Date: {sale.date} · Total: {formatTzs(sale.totalTzs)} · Paid:{' '}
                        {formatTzs(sale.paidTzs)}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="mr-2 text-sm font-extrabold text-rose-700 tabular-nums dark:text-rose-400">
                        Due: {formatTzs(sale.balanceTzs)}
                      </span>
                      <a
                        href={waRemind}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-h-[38px] items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> {t.sales.remind} (WA)
                      </a>
                      <a
                        href={smsRemind}
                        className="flex min-h-[38px] items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <Phone className="h-3.5 w-3.5" /> SMS
                      </a>
                      <Button variant="success" size="sm" onClick={() => openCollectModal(sale)}>
                        <CreditCard className="h-3.5 w-3.5" /> {t.sales.collectPayment}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      )}

      {/* TAB 5: LOTS IN STOCK */}
      {activeTab === 'lots' && (
        <div className="space-y-3">
          {state.harvestLots.length === 0 ? (
            <EmptyState
              icon={<Package className="h-6 w-6" />}
              title="No harvest lots recorded yet"
              description="Record a pond harvest to grade fish into sellable chilled lots."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {state.harvestLots.map((lot, idx) => {
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
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-slate-800">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-extrabold text-blue-700 dark:text-sky-400">
                              {lot.lotCode}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {lot.pondCode} · {lot.species}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Harvested {lot.date} · Batch {lot.batchCode} · Approved by {lot.approvedBy}
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

                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Total harvested: {origTotal.toFixed(1)} kg (Damaged: {lot.grades.damagedKg} kg)
                        </span>
                        {remTotal > 0 && (
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => onOpenQuickSale({ lotId: lot.id })}
                          >
                            Sell from Lot <ArrowRight className="h-3.5 w-3.5" />
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

      {/* TAB 6: PRE-ORDERS */}
      {activeTab === 'pre-orders' && (
        <div className="space-y-3">
          <Card className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Customer Pre-Orders & Harvest Bookings
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Reserve upcoming harvest tonnage for key customers and convert to a Sale in one tap.
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={() => setShowPreOrderForm(!showPreOrderForm)}>
              <Plus className="h-4 w-4" /> New Pre-Order
            </Button>
          </Card>

          {showPreOrderForm && (
            <Card className="space-y-3 border-blue-200 dark:border-sky-800/60">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Book Upcoming Fish Pre-Order
              </h4>
              <FormError message={poError} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="po-cust"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Customer *
                  </label>
                  <select
                    id="po-cust"
                    value={poCustomerId}
                    onChange={(e) => {
                      const cid = e.target.value;
                      setPoCustomerId(cid);
                      const cust = state.customers.find((c) => c.id === cid);
                      if (cust) {
                        const suggested = getPriceForItem(
                          state.priceList,
                          poSpecies,
                          poGrade,
                          cust.priceTier
                        );
                        if (suggested > 0) setPoPrice(String(suggested));
                      }
                    }}
                    className={`${INPUT_CLASS} min-h-[42px]`}
                  >
                    <option value="">Select customer...</option>
                    {state.customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.priceTier})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="po-species"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Species *
                  </label>
                  <select
                    id="po-species"
                    value={poSpecies}
                    onChange={(e) => setPoSpecies(e.target.value)}
                    className={`${INPUT_CLASS} min-h-[42px]`}
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
                    htmlFor="po-grade"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Grade *
                  </label>
                  <select
                    id="po-grade"
                    value={poGrade}
                    onChange={(e) => setPoGrade(e.target.value as FishGrade)}
                    className={`${INPUT_CLASS} min-h-[42px]`}
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="po-kg"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Requested Weight (kg) *
                  </label>
                  <input
                    id="po-kg"
                    type="number"
                    inputMode="decimal"
                    value={poKg}
                    onChange={(e) => setPoKg(e.target.value)}
                    className={`${INPUT_CLASS} min-h-[42px] tabular-nums`}
                  />
                </div>
                <div>
                  <label
                    htmlFor="po-date"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Expected Date *
                  </label>
                  <input
                    id="po-date"
                    type="date"
                    value={poExpectedDate}
                    onChange={(e) => setPoExpectedDate(e.target.value)}
                    className={`${INPUT_CLASS} min-h-[42px]`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="po-price"
                      className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Agreed Price/kg *
                    </label>
                    <input
                      id="po-price"
                      type="number"
                      inputMode="numeric"
                      value={poPrice}
                      onChange={(e) => setPoPrice(e.target.value)}
                      className={`${INPUT_CLASS} min-h-[42px] tabular-nums`}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="po-dep"
                      className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Deposit (TZS)
                    </label>
                    <input
                      id="po-dep"
                      type="number"
                      inputMode="numeric"
                      value={poDeposit}
                      onChange={(e) => setPoDeposit(e.target.value)}
                      className={`${INPUT_CLASS} min-h-[42px] tabular-nums`}
                    />
                  </div>
                </div>
              </div>
              <div>
                <label
                  htmlFor="po-notes"
                  className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Notes
                </label>
                <input
                  id="po-notes"
                  type="text"
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  className={`${INPUT_CLASS} min-h-[42px]`}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowPreOrderForm(false)}>
                  Cancel
                </Button>
                <Button variant="success" size="sm" onClick={handleCreatePreOrderSubmit}>
                  Save Pre-Order
                </Button>
              </div>
            </Card>
          )}

          <Card padded={false} className="divide-y divide-slate-100 dark:divide-slate-800">
            {state.preOrders.map((po) => {
              const cust = state.customers.find((c) => c.id === po.customerId);
              return (
                <div
                  key={po.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {cust?.name || 'Customer'}
                      </span>
                      <Badge
                        variant={
                          po.status === 'Open'
                            ? 'info'
                            : po.status === 'Converted'
                              ? 'success'
                              : 'neutral'
                        }
                      >
                        {po.status}
                      </Badge>
                    </div>
                    <div className="mt-0.5 text-slate-600 dark:text-slate-300">
                      <strong>
                        {po.requestedKg} kg {po.species} ({po.grade})
                      </strong>{' '}
                      @ {formatTzs(po.agreedPricePerKgTzs)}/kg · Expected {po.expectedDate} · Deposit:{' '}
                      {formatTzs(po.depositTzs)}
                    </div>
                    {po.notes && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{po.notes}</div>
                    )}
                  </div>
                  {po.status === 'Open' && (
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" size="sm" onClick={() => onCancelPreOrder(po.id)}>
                        Cancel
                      </Button>
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => onOpenQuickSale({ preOrder: po })}
                      >
                        {t.sales.convertToSale} <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        </div>
      )}

      {/* COLLECT PAYMENT SHEET */}
      <Sheet
        open={Boolean(payTargetSale)}
        onClose={() => setPayTargetSale(null)}
        maxWidthClass="sm:max-w-md"
        title={payTargetSale ? `Collect Payment — ${payTargetSale.invoiceNo}` : 'Collect Payment'}
        subtitle={
          payTargetSale
            ? `${payTargetSale.customerName} · Due: ${formatTzs(payTargetSale.balanceTzs)}`
            : undefined
        }
      >
        {payTargetSale && (
          <div className="space-y-4">
            <FormError message={payError} shakeKey={payShake} />

            <div>
              <label
                htmlFor="cp-amount"
                className="mb-1 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                <span>Amount Received (TZS) *</span>
                <ValidCheck
                  valid={Number(payAmount) > 0 && Number(payAmount) <= payTargetSale.balanceTzs}
                />
              </label>
              <input
                id="cp-amount"
                type="number"
                inputMode="numeric"
                min="1"
                max={payTargetSale.balanceTzs}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className={`${INPUT_CLASS} min-h-[46px] text-base font-extrabold text-emerald-700 tabular-nums dark:text-emerald-400`}
              />
            </div>

            <div>
              <div className="mb-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                Payment Method *
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPayMethod(m)}
                    className={`min-h-[38px] rounded-xl border px-2.5 text-xs font-bold transition-colors ${
                      payMethod === m
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="cp-ref"
                className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Transaction Reference / Receipt #
              </label>
              <input
                id="cp-ref"
                type="text"
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                className={`${INPUT_CLASS} min-h-[42px] font-mono`}
              />
            </div>

            <Button variant="success" size="lg" fullWidth onClick={handleCollectSubmit}>
              <CheckCircle2 className="h-4 w-4" /> Record Payment
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
};
