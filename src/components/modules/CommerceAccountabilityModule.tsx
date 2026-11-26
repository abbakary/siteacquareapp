import React, { lazy, Suspense, useState } from 'react';
import { motion } from 'motion/react';
import {
  Package,
  Users,
  Bell,
  ShieldCheck,
  FileDown,
  WifiOff,
  Wifi,
  CheckCircle2,
  BookOpen,
  TrendingUp,
  AlertTriangle,
  Search,
  ShoppingCart,
  Sun,
  Moon,
  Monitor,
  Smartphone,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import { AquacultureState, Language, UserRole } from '../../types/aquaculture';
import { TRANSLATIONS, tDomain, tr } from '../../i18n/translations';
import {
  formatNumber,
  formatTzs,
  todayIso,
  exportToCsv,
  isDateInPeriod,
  TimeFilterPeriod,
} from '../../utils/formatters';
import { getPermissions, ROLE_MATRIX } from '../../utils/rbac';
import { QuickActionType } from '../QuickActionModals';
import {
  AnimatedTabs,
  Badge,
  Button,
  Card,
  ChartSkeleton,
  CountUpNumber,
  DURATIONS,
  EASE_OUT,
  EmptyState,
  getStaggerDelay,
  INPUT_CLASS,
  PullToRefresh,
  ThemeMode,
  useLanguage,
  usePreferences,
} from '../../ui';

const AnimatedBarChart = lazy(() =>
  import('../DashboardCharts').then((m) => ({ default: m.AnimatedBarChart }))
);
const AnimatedDonutChart = lazy(() =>
  import('../DashboardCharts').then((m) => ({ default: m.AnimatedDonutChart }))
);

export const InventoryModule: React.FC<{
  state: AquacultureState;
  onQuickAction: (a: QuickActionType) => void;
  onBackToMenu?: () => void;
  onRestockItem?: (itemId: string) => void;
}> = ({ state, onQuickAction, onBackToMenu, onRestockItem }) => {
  const { language } = useLanguage();
  const t = TRANSLATIONS[language];
  const periodOptions: Array<{ id: TimeFilterPeriod; label: string }> = [
    { id: 'day', label: tr(language, 'Siku', 'Day') },
    { id: 'week', label: tr(language, 'Wiki', 'Week') },
    { id: 'month', label: tr(language, 'Mwezi', 'Month') },
    { id: 'year', label: tr(language, 'Mwaka', 'Year') },
    { id: 'all', label: tr(language, 'Zote', 'All') },
  ];
  const [period, setPeriod] = useState<TimeFilterPeriod>('month');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'purchases' | 'stock'>('purchases');

  const purchases = state.stockPurchases || [];
  const suppliers = Array.from(new Set(purchases.map((p) => p.supplier)));

  const totalStockValueTzs = state.inventory.reduce(
    (sum, item) => sum + item.stock * item.unitCostTzs,
    0
  );
  const feedStockKg = state.inventory
    .filter((i) => i.category === 'Feed')
    .reduce((sum, i) => sum + i.stock, 0);
  const lowStockItems = state.inventory.filter((i) => i.status !== 'In Stock');

  const filteredPurchases = purchases.filter((p) => {
    if (!isDateInPeriod(p.date, period)) return false;
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    if (supplierFilter !== 'all' && p.supplier !== supplierFilter) return false;
    if (
      searchQuery.trim() &&
      !`${p.itemName} ${p.supplier} ${p.lotNumber} ${p.category}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const periodPurchaseSpend = filteredPurchases.reduce((sum, p) => sum + p.totalCostTzs, 0);
  const periodUnpaidCredit = filteredPurchases
    .filter((p) => p.paymentStatus !== 'Paid')
    .reduce((sum, p) => sum + Math.max(0, p.totalCostTzs - (p.paidAmountTzs ?? 0)), 0);

  const filteredInventory = state.inventory.filter((i) => {
    if (categoryFilter !== 'all' && i.category !== categoryFilter) return false;
    if (
      searchQuery.trim() &&
      !`${i.name} ${i.supplier} ${i.batchOrLot}`.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const categoryBreakdown = (['Feed', 'Fingerlings', 'Medicine', 'Fuel', 'Equipment'] as const).map(
    (cat) => ({
      category: cat,
      totalTzs: filteredPurchases
        .filter((p) => p.category === cat)
        .reduce((sum, p) => sum + p.totalCostTzs, 0),
    })
  );

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          {onBackToMenu && (
            <Button variant="secondary" size="sm" onClick={onBackToMenu}>
              <ArrowLeft className="h-4 w-4" /> {t.ui.backToMenu}
            </Button>
          )}
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {tr(language, 'Viashiria vya Bohari na Ripoti za Ununuzi wa Akiba', 'Inventory KPIs & Stock Purchase Reports')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {tr(
                language,
                'Simamia bidhaa zilizopo na manunuzi mapya, thamani ya bohari, arifa za akiba ndogo na mikopo ya wauzaji.',
                'Manage existing products & new purchases, store valuation, low-stock reorder alerts & supplier credit.'
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              exportToCsv(
                `dukaaqusmart-stock-purchases-${period}-${todayIso()}.csv`,
                language === 'sw'
                  ? [
                      'Tarehe',
                      'Bidhaa',
                      'Kundi',
                      'Kifurushi (Lot)',
                      'Ankara #',
                      'Muuzaji',
                      'Kiasi',
                      'Kipimo',
                      'Bei ya Kizio (TZS)',
                      'Jumla (TZS)',
                      'Kilicholipwa (TZS)',
                      'Salio la Deni (TZS)',
                      'Hali ya Malipo',
                    ]
                  : [
                      'Date',
                      'Item',
                      'Category',
                      'Lot',
                      'Invoice #',
                      'Supplier',
                      'Quantity',
                      'Unit',
                      'Unit Cost (TZS)',
                      'Total Cost (TZS)',
                      'Paid (TZS)',
                      'Balance Due (TZS)',
                      'Payment Status',
                    ],
                filteredPurchases.map((p) => [
                  p.date,
                  p.itemName,
                  tDomain(language, p.category),
                  p.lotNumber,
                  p.invoiceNo || '',
                  p.supplier,
                  p.quantity,
                  p.unit,
                  p.unitCostTzs,
                  p.totalCostTzs,
                  p.paidAmountTzs ?? (p.paymentStatus === 'Paid' ? p.totalCostTzs : 0),
                  Math.max(0, p.totalCostTzs - (p.paidAmountTzs ?? (p.paymentStatus === 'Paid' ? p.totalCostTzs : 0))),
                  tDomain(language, p.paymentStatus),
                ])
              )
            }
          >
            <FileDown className="h-4 w-4 text-teal-600 dark:text-teal-400" />{' '}
            {tr(language, 'Pakua Ripoti ya Manunuzi', 'Export Purchase Report')}
          </Button>
          <Button variant="success" size="sm" onClick={() => onQuickAction('inventory')}>
            <Package className="h-4 w-4" />{' '}
            {tr(language, 'Ongeza Akiba / Ununuzi', 'Add Stock / Purchase')}
          </Button>
        </div>
      </Card>

      {/* 4 INVENTORY & PURCHASE KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card hoverable className="group">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{tr(language, 'Thamani ya Bohari Sasa', 'Current Inventory Valuation')}</span>
            <Package className="h-4 w-4 text-teal-600 transition-transform duration-150 group-hover:scale-110 dark:text-teal-400" />
          </div>
          <div className="mt-1 text-xl font-extrabold text-slate-900 tabular-nums dark:text-white">
            <CountUpNumber value={totalStockValueTzs} formatter={(v) => formatTzs(v)} />
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {tr(
              language,
              `Katika bidhaa ${state.inventory.length} zinazofuatiliwa`,
              `Across ${state.inventory.length} tracked stock items`
            )}
          </div>
        </Card>

        <Card hoverable className="group">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{tr(language, 'Manunuzi ya Kipindi', 'Period Stock Purchases')}</span>
            <ShoppingCart className="h-4 w-4 text-blue-600 transition-transform duration-150 group-hover:scale-110 dark:text-sky-400" />
          </div>
          <div className="mt-1 text-xl font-extrabold text-blue-700 tabular-nums dark:text-sky-400">
            <CountUpNumber value={periodPurchaseSpend} formatter={(v) => formatTzs(v)} />
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500 tabular-nums dark:text-slate-400">
            {tr(
              language,
              `Oda ${filteredPurchases.length} za manunuzi katika kipindi`,
              `${filteredPurchases.length} purchase order(s) in period`
            )}
          </div>
        </Card>

        <Card hoverable className="group">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{tr(language, 'Salio la Chakula na Siku', 'Feed Balance & Coverage')}</span>
            <TrendingUp className="h-4 w-4 text-emerald-600 transition-transform duration-150 group-hover:scale-110 dark:text-emerald-400" />
          </div>
          <div className="mt-1 text-xl font-extrabold text-emerald-700 tabular-nums dark:text-emerald-400">
            <CountUpNumber value={feedStockKg} formatter={(v) => formatNumber(v)} suffix=" kg" />
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500 tabular-nums dark:text-slate-400">
            ≈ {Math.max(1, Math.round(feedStockKg / 170))}{' '}
            {tr(language, 'siku za akiba ya chakula', 'days feeding reserve')}
          </div>
        </Card>

        <Card hoverable className="group">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{tr(language, 'Akiba Ndogo na Deni la Muuzaji', 'Low Stock & Supplier Credit')}</span>
            <AlertTriangle className="h-4 w-4 text-amber-600 transition-transform duration-150 group-hover:scale-110 dark:text-amber-400" />
          </div>
          <div className="mt-1 text-xl font-extrabold text-amber-700 tabular-nums dark:text-amber-400">
            <CountUpNumber
              value={lowStockItems.length}
              suffix={tr(language, ' Akiba Ndogo', ' Low Stock')}
            />
          </div>
          <div className="mt-0.5 text-[11px] font-semibold text-rose-700 tabular-nums dark:text-rose-400">
            {tr(language, 'Deni la muuzaji:', 'Supplier credit due:')} {formatTzs(periodUnpaidCredit)}
          </div>
        </Card>
      </div>

      {/* FILTER & TAB CONTROLS */}
      <Card padded={false} className="flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <AnimatedTabs
            layoutId="inventory-subtabs"
            activeId={activeTab}
            onChange={(val) => setActiveTab(val as 'purchases' | 'stock')}
            tabs={[
              {
                id: 'purchases',
                label: tr(
                  language,
                  `Ripoti za Manunuzi (${filteredPurchases.length})`,
                  `Stock Purchase Reports (${filteredPurchases.length})`
                ),
              },
              {
                id: 'stock',
                label: tr(
                  language,
                  `Salio la Bohari Sasa (${filteredInventory.length})`,
                  `Current Stock Balance (${filteredInventory.length})`
                ),
              },
            ]}
          />

          <AnimatedTabs
            layoutId="inventory-periods"
            activeId={period}
            onChange={(val) => setPeriod(val as TimeFilterPeriod)}
            tabs={periodOptions}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search className="pointer-events-none absolute top-3.5 left-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tr(
                language,
                'Tafuta bidhaa, SKU, lot, muuzaji...',
                'Search item, SKU, lot, supplier...'
              )}
              className={`${INPUT_CLASS} min-h-[42px] py-2 pr-3 pl-9`}
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label={tr(language, 'Chuja kwa kundi', 'Filter by category')}
            className={`${INPUT_CLASS} min-h-[42px] w-auto min-w-[155px] py-2`}
          >
            <option value="all">{tr(language, 'Makundi Yote', 'All Categories')}</option>
            <option value="Feed">{tDomain(language, 'Feed')}</option>
            <option value="Fingerlings">{tDomain(language, 'Fingerlings')}</option>
            <option value="Medicine">{tDomain(language, 'Medicine')}</option>
            <option value="Fuel">{tDomain(language, 'Fuel')}</option>
            <option value="Equipment">{tDomain(language, 'Equipment')}</option>
          </select>
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            aria-label={tr(language, 'Chuja kwa muuzaji', 'Filter by supplier')}
            className={`${INPUT_CLASS} min-h-[42px] w-auto min-w-[165px] py-2`}
          >
            <option value="all">{tr(language, 'Wauzaji Wote', 'All Suppliers')}</option>
            {suppliers.map((sup) => (
              <option key={sup} value={sup}>
                {sup}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* CATEGORY SPEND BREAKDOWN BAR */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {categoryBreakdown.map((c) => {
          const share =
            periodPurchaseSpend > 0 ? Math.round((c.totalTzs / periodPurchaseSpend) * 100) : 0;
          return (
            <Card key={c.category} padded={false} className="p-3 text-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {tDomain(language, c.category)}
                </span>
                <span className="tabular-nums">{share}%</span>
              </div>
              <div className="mt-1 font-extrabold text-slate-900 tabular-nums dark:text-white">
                {formatTzs(c.totalTzs)}
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <motion.div
                  className="h-full origin-left rounded-full bg-teal-600 dark:bg-teal-400"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: share / 100 }}
                  transition={{ duration: DURATIONS.chart, ease: EASE_OUT }}
                />
              </div>
            </Card>
          );
        })}
      </div>

      {activeTab === 'purchases' ? (
        <Card className="overflow-x-auto">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {tr(language, 'Daftari la Ripoti za Manunuzi', 'Stock Purchase Report Ledger')} (
              {periodOptions.find((p) => p.id === period)?.label})
            </h3>
            <span className="text-xs font-semibold text-slate-600 tabular-nums dark:text-slate-300">
              {tr(language, 'Jumla ya Kipindi:', 'Period Total:')} {formatTzs(periodPurchaseSpend)}
            </span>
          </div>
          {filteredPurchases.length === 0 ? (
            <EmptyState
              icon={<ShoppingCart className="h-6 w-6" />}
              title={tr(language, 'Hakuna manunuzi katika kipindi hiki', 'No stock purchases in this period')}
              description={tr(
                language,
                'Badilisha muda au bofya Ongeza Akiba / Ununuzi kurekodi mzigo mpya wa muuzaji.',
                'Adjust your time range or click Add Stock / Purchase to record a supplier delivery.'
              )}
            />
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="py-2">{tr(language, 'Tarehe', 'Date')}</th>
                  <th className="py-2">{tr(language, 'Bidhaa', 'Item')}</th>
                  <th className="py-2">{tr(language, 'Kundi', 'Category')}</th>
                  <th className="py-2">{tr(language, 'Muuzaji', 'Supplier')}</th>
                  <th className="py-2">{tr(language, 'Ankara / Lot #', 'Invoice / Lot #')}</th>
                  <th className="py-2 text-right">{tr(language, 'Kiasi', 'Qty')}</th>
                  <th className="py-2 text-right">{tr(language, 'Bei ya Kizio', 'Unit Cost')}</th>
                  <th className="py-2 text-right">{tr(language, 'Jumla', 'Total Cost')}</th>
                  <th className="py-2 pl-3">{tr(language, 'Malipo / Deni', 'Payment / Due')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredPurchases.map((p) => {
                  const paidAmt = p.paidAmountTzs ?? (p.paymentStatus === 'Paid' ? p.totalCostTzs : 0);
                  const dueAmt = Math.max(0, p.totalCostTzs - paidAmt);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2.5 text-slate-500 tabular-nums dark:text-slate-400">{p.date}</td>
                      <td className="py-2.5 font-bold text-slate-900 dark:text-white">
                        <div>{p.itemName}</div>
                        {p.expiryDate && (
                          <div className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                            {tr(language, 'Mwisho:', 'Exp:')} {p.expiryDate}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 text-slate-600 dark:text-slate-300">
                        {tDomain(language, p.category)}
                      </td>
                      <td className="py-2.5 text-slate-700 dark:text-slate-300">
                        <div>{p.supplier}</div>
                        {p.supplierPhone && (
                          <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                            {p.supplierPhone}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        <div>{p.lotNumber}</div>
                        {p.invoiceNo && <div className="text-[10px] text-slate-400">{p.invoiceNo}</div>}
                      </td>
                      <td className="py-2.5 text-right font-semibold tabular-nums dark:text-slate-200">
                        {formatNumber(p.quantity)} {p.unit}
                      </td>
                      <td className="py-2.5 text-right tabular-nums dark:text-slate-300">
                        {formatTzs(p.unitCostTzs)}
                      </td>
                      <td className="py-2.5 text-right font-extrabold text-slate-900 tabular-nums dark:text-white">
                        {formatTzs(p.totalCostTzs)}
                      </td>
                      <td className="py-2.5 pl-3">
                        <Badge
                          variant={
                            p.paymentStatus === 'Paid'
                              ? 'success'
                              : p.paymentStatus === 'Partial'
                                ? 'warning'
                                : 'danger'
                          }
                        >
                          {tDomain(language, p.paymentStatus)}
                        </Badge>
                        {dueAmt > 0 && (
                          <div className="mt-0.5 text-[10px] font-semibold text-rose-700 tabular-nums dark:text-rose-400">
                            {tr(language, 'Deni:', 'Due:')} {formatTzs(dueAmt)}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="py-2">{tr(language, 'Bidhaa & SKU', 'Item & SKU')}</th>
                <th className="py-2">{tr(language, 'Kundi', 'Category')}</th>
                <th className="py-2">{tr(language, 'Kifurushi / Lot', 'Lot / Batch')}</th>
                <th className="py-2">{tr(language, 'Muuzaji', 'Supplier')}</th>
                <th className="py-2 text-right">{tr(language, 'Akiba / Kiwango', 'Stock / Reorder')}</th>
                <th className="py-2 text-right">{tr(language, 'Bei ya Kizio', 'Unit Cost')}</th>
                <th className="py-2 text-right">{tr(language, 'Thamani ya Akiba', 'Stock Value')}</th>
                <th className="py-2 pl-3">{tr(language, 'Mwisho wa Matumizi', 'Expiry')}</th>
                <th className="py-2">{tr(language, 'Hali', 'Status')}</th>
                <th className="py-2 text-right">{tr(language, 'Kitendo', 'Action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredInventory.map((i) => (
                <tr key={i.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-2.5 font-bold text-slate-900 dark:text-white">
                    <div>{i.name}</div>
                    {i.sku && (
                      <div className="font-mono text-[10px] font-normal text-slate-500 dark:text-slate-400">
                        {i.sku}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 text-slate-600 dark:text-slate-300">
                    {tDomain(language, i.category)}
                  </td>
                  <td className="py-2.5 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                    {i.batchOrLot}
                  </td>
                  <td className="py-2.5 text-slate-700 dark:text-slate-300">{i.supplier}</td>
                  <td className="py-2.5 text-right tabular-nums dark:text-slate-200">
                    <div className="font-bold">
                      {formatNumber(i.stock)} {i.unit}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      {tr(language, 'Kiwango:', 'Min:')} {formatNumber(i.reorderLevel)}
                    </div>
                  </td>
                  <td className="py-2.5 text-right tabular-nums dark:text-slate-300">
                    {formatTzs(i.unitCostTzs)}
                  </td>
                  <td className="py-2.5 text-right font-bold text-slate-900 tabular-nums dark:text-white">
                    {formatTzs(i.stock * i.unitCostTzs)}
                  </td>
                  <td className="py-2.5 pl-3 text-slate-500 dark:text-slate-400">
                    {i.expiryDate || '—'}
                  </td>
                  <td className="py-2.5">
                    <Badge variant={i.status === 'In Stock' ? 'success' : 'warning'}>
                      {tDomain(language, i.status)}
                    </Badge>
                  </td>
                  <td className="py-2.5 text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => (onRestockItem ? onRestockItem(i.id) : onQuickAction('inventory'))}
                    >
                      {tr(language, '+ Ongeza Akiba', '+ Restock')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
};

export const FinanceReportsModule: React.FC<{
  state: AquacultureState;
  onQuickAction: (a: QuickActionType) => void;
}> = ({ state, onQuickAction }) => {
  const { language } = useLanguage();
  const perms = getPermissions(state.activeUser.role);
  const totalRevenue = state.finances
    .filter((f) => f.type === 'Revenue')
    .reduce((a, b) => a + b.amountTzs, 0);
  const totalExpenses = state.finances
    .filter((f) => f.type === 'Expense')
    .reduce((a, b) => a + b.amountTzs, 0);
  const feedExpenses = state.finances
    .filter((f) => f.category === 'Feed Purchase')
    .reduce((a, b) => a + b.amountTzs, 0);
  const totalBiomassKg = state.batches.reduce(
    (acc, b) => acc + (b.currentEstimatedFish * b.currentAvgWeightG) / 1000,
    0
  );
  const costPerKg = totalBiomassKg > 0 ? totalExpenses / totalBiomassKg : 0;

  const feedCostSharePct = Math.round((feedExpenses / Math.max(1, totalExpenses)) * 100);

  const monthNames =
    language === 'sw'
      ? ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ago', 'Sep', 'Okt', 'Nov', 'Des']
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyCashflowMap = new Map<string, { label: string; primary: number; secondary: number }>();
  state.finances.forEach((f) => {
    const dt = new Date(f.date);
    const key = Number.isNaN(dt.getTime()) ? f.date.slice(0, 7) : `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    const label = Number.isNaN(dt.getTime()) ? key : `${monthNames[dt.getMonth()]} '${String(dt.getFullYear()).slice(-2)}`;
    const entry = monthlyCashflowMap.get(key) || { label, primary: 0, secondary: 0 };
    if (f.type === 'Revenue') entry.primary += f.amountTzs;
    else entry.secondary += f.amountTzs;
    monthlyCashflowMap.set(key, entry);
  });
  const monthlyCashflowData = Array.from(monthlyCashflowMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([, val]) => val);

  const expenseMixMap = new Map<string, number>();
  state.finances
    .filter((f) => f.type === 'Expense')
    .forEach((f) => {
      expenseMixMap.set(f.category, (expenseMixMap.get(f.category) || 0) + f.amountTzs);
    });
  const donutPalette = ['#2563EB', '#0D9488', '#F97316', '#8B5CF6', '#EC4899', '#EAB308'];
  const expenseMixSegments = Array.from(expenseMixMap.entries()).map(([label, value], idx) => ({
    label: tDomain(language, label),
    value,
    color: donutPalette[idx % donutPalette.length],
  }));

  if (!perms.canViewFullFinance) {
    return (
      <Card className="border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-800/60 dark:bg-amber-950/40">
        <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-amber-600 dark:text-amber-400" />
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          {tr(
            language,
            'Ufikiaji wa Fedha Umezuiwa na Sera ya Majukumu (RBAC)',
            'Financial Access Restricted by RBAC Policy'
          )}
        </h3>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
          {language === 'sw' ? (
            <>
              Wajibu wako wa sasa ({tDomain(language, state.activeUser.roleLabel)}) una mipaka ya kuona fedha. Badili kuwa{' '}
              <strong>Mmiliki wa Shamba</strong> au <strong>Meneja wa Shamba</strong> upande wa pembeni kuona daftari kamili la faida (TZS).
            </>
          ) : (
            <>
              Your current role ({state.activeUser.roleLabel}) has restricted financial visibility. Switch to{' '}
              <strong>Owner / Boss</strong> or <strong>Farm Manager</strong> in the sidebar to inspect full TZS profitability ledgers.
            </>
          )}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {tr(language, 'Sehemu G: Fedha, Gharama kwa Kilo na Ripoti za FiRCIS', 'Module G: Finance, Unit Economics & FiRCIS Reports')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {tr(
              language,
              'Fuatilia gharama kwa kilo iliyozalishwa, sehemu ya gharama ya chakula, faida ya makundi, na salio la wateja/wauzaji kwa TZS.',
              'Track cost/kg produced, feed cost share, batch profitability, and customer/supplier balances in TZS.'
            )}
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => onQuickAction('report')}>
          <FileDown className="h-4 w-4" /> {tr(language, 'Pakua Ripoti za CSV', 'Export CSV Reports')}
        </Button>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card hoverable>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {tr(language, 'Jumla ya Mapato', 'Total Revenue')}
          </div>
          <div className="mt-1 text-lg font-extrabold text-slate-900 tabular-nums dark:text-white">
            <CountUpNumber value={totalRevenue} formatter={(v) => formatTzs(v)} />
          </div>
        </Card>
        <Card hoverable>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {tr(language, 'Jumla ya Matumizi', 'Total Expenses')}
          </div>
          <div className="mt-1 text-lg font-extrabold text-rose-700 tabular-nums dark:text-rose-400">
            <CountUpNumber value={totalExpenses} formatter={(v) => formatTzs(v)} />
          </div>
        </Card>
        <Card hoverable>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {tr(language, 'Faida Ghafi', 'Gross Profit')}
          </div>
          <div className="mt-1 text-lg font-extrabold text-emerald-700 tabular-nums dark:text-emerald-400">
            <CountUpNumber value={totalRevenue - totalExpenses} formatter={(v) => formatTzs(v)} />
          </div>
        </Card>
        <Card hoverable>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {tr(language, 'Makadirio ya Gharama / kg', 'Est. Production Cost / kg')}
          </div>
          <div className="mt-1 text-lg font-extrabold text-blue-700 tabular-nums dark:text-sky-400">
            <CountUpNumber value={costPerKg} formatter={(v) => formatTzs(v)} />
            /kg · {tr(language, 'Chakula', 'Feed')} <CountUpNumber value={feedCostSharePct} suffix="%" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card hoverable className="lg:col-span-7">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {tr(language, 'Mtiririko wa Fedha kwa Mwezi (Mapato vs Matumizi)', 'Monthly Cashflow (Revenue vs Expenses)')}
            </h3>
            <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" /> {tr(language, 'Mapato', 'Revenue')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-orange-500" /> {tr(language, 'Matumizi', 'Expenses')}
              </span>
            </div>
          </div>
          <Suspense fallback={<ChartSkeleton heightClass="h-[190px]" />}>
            <AnimatedBarChart
              data={monthlyCashflowData}
              primaryLabel={tr(language, 'Mapato', 'Revenue')}
              secondaryLabel={tr(language, 'Matumizi', 'Expenses')}
              formatValue={(v) => formatTzs(v)}
            />
          </Suspense>
        </Card>

        <Card hoverable className="lg:col-span-5">
          <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
            {tr(language, 'Mgawanyo wa Matumizi kwa Kundi', 'Expense Category Breakdown')}
          </h3>
          <Suspense fallback={<ChartSkeleton heightClass="h-[170px]" />}>
            <AnimatedDonutChart
              segments={expenseMixSegments}
              centerLabel={tr(language, 'Matumizi', 'Expenses')}
              centerValue={formatTzs(totalExpenses)}
              formatValue={(v) => formatTzs(v)}
            />
          </Suspense>
        </Card>
      </div>

      <Card className="overflow-x-auto">
        <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
          {tr(language, 'Daftari la Mtiririko wa Fedha na Madeni (TZS)', 'TZS Farm Cashflow & Debt Ledger')}
        </h3>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <th className="py-2">{tr(language, 'Tarehe', 'Date')}</th>
              <th className="py-2">{tr(language, 'Aina', 'Type')}</th>
              <th className="py-2">{tr(language, 'Kundi', 'Category')}</th>
              <th className="py-2">{tr(language, 'Maelezo', 'Description')}</th>
              <th className="py-2">{tr(language, 'Mhusika', 'Counterparty')}</th>
              <th className="py-2 text-right">{tr(language, 'Kiasi', 'Amount')}</th>
              <th className="py-2 pl-3">{tr(language, 'Hali', 'Status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {state.finances.map((f) => (
              <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="py-2.5 text-slate-500 tabular-nums dark:text-slate-400">{f.date}</td>
                <td className="py-2.5">
                  <Badge variant={f.type === 'Revenue' ? 'success' : 'danger'}>
                    {tDomain(language, f.type)}
                  </Badge>
                </td>
                <td className="py-2.5 font-medium text-slate-700 dark:text-slate-300">
                  {tDomain(language, f.category)}
                </td>
                <td className="py-2.5 text-slate-800 dark:text-slate-200">{f.description}</td>
                <td className="py-2.5 text-slate-600 dark:text-slate-400">{f.counterparty}</td>
                <td className="py-2.5 text-right font-bold tabular-nums dark:text-white">
                  {formatTzs(f.amountTzs)}
                </td>
                <td className="py-2.5 pl-3">
                  <Badge variant={f.paymentStatus === 'Paid' ? 'success' : 'warning'}>
                    {tDomain(language, f.paymentStatus)}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

export const EmployeesAccountabilityModule: React.FC<{
  state: AquacultureState;
  onSwitchUser: (empId: string) => void;
}> = ({ state, onSwitchUser }) => {
  const { language } = useLanguage();
  const roles: UserRole[] = ['owner', 'manager', 'technician', 'keeper', 'storekeeper'];

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          {tr(
            language,
            'Sehemu H: Uwajibikaji wa Kidijitali, Ruhusa za RBAC na Kumbukumbu Isiyofutika',
            'Module H: Digital Responsibility, RBAC Permissions & Immutable Audit Trail'
          )}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {tr(
            language,
            'Badilisha mfanyakazi aliyeingia hapa chini ili kuona ruhusa halisi za wajibu, saini za PIN, na kumbukumbu za ukaguzi.',
            'Switch active employee persona below to experience real role-based permissions, PIN signatures, and tamper-proof audit logging.'
          )}
        </p>
      </Card>

      {/* Employee Cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {state.employees.map((emp, idx) => {
          const isActive = state.activeUser.id === emp.id;
          return (
            <motion.div
              key={emp.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: getStaggerDelay(idx), duration: DURATIONS.base, ease: EASE_OUT }}
            >
              <Card
                padded={false}
                className={`p-3.5 text-xs ${
                  isActive
                    ? 'border-blue-500 bg-blue-50/50 dark:border-sky-500 dark:bg-sky-950/30'
                    : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900 dark:text-white">{emp.name}</span>
                  {isActive && <Badge variant="info">{tr(language, 'Hai', 'Active')}</Badge>}
                </div>
                <div className="mt-0.5 text-[11px] font-semibold text-blue-700 dark:text-sky-400">
                  {tDomain(language, emp.roleLabel)}
                </div>
                <div className="mt-1 text-slate-500 dark:text-slate-400">{emp.phone}</div>
                <div className="mt-1 text-slate-600 dark:text-slate-300">
                  PIN: <span className="font-mono font-bold">••••</span> (
                  {tr(language, 'Imesanidiwa', 'Configured')}) · {tr(language, 'Ripoti:', 'Reports:')}{' '}
                  {emp.reportsSubmittedToday}
                </div>
                <Button
                  variant={isActive ? 'secondary' : 'primary'}
                  size="sm"
                  fullWidth
                  disabled={isActive}
                  onClick={() => onSwitchUser(emp.id)}
                  className="mt-2.5"
                >
                  {isActive
                    ? tr(language, 'Wajibu wa Sasa', 'Current Persona')
                    : tr(language, 'Chagua Wajibu Huu', 'Switch to Role')}
                </Button>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* RBAC Matrix */}
      <Card className="overflow-x-auto">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          <Users className="h-4 w-4 text-blue-600 dark:text-sky-400" />{' '}
          {tr(language, 'Jedwali la Ruhusa na Uwajibikaji', 'Permission & Responsibility Matrix')}
        </h3>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <th className="py-2">{tr(language, 'Wajibu', 'Role')}</th>
              <th className="py-2">{tr(language, 'Rekodi Ulishaji', 'Record Feeding')}</th>
              <th className="py-2">{tr(language, 'Idhinisha Mpango wa Chakula', 'Approve Feed Plan')}</th>
              <th className="py-2">{tr(language, 'Toa Chakula Bohari', 'Issue Store Feed')}</th>
              <th className="py-2">{tr(language, 'Futa Rekodi ya Vifo', 'Delete Mortality')}</th>
              <th className="py-2">{tr(language, 'Idhinisha Matibabu', 'Approve Treatment')}</th>
              <th className="py-2">{tr(language, 'Idhinisha Mavuno', 'Approve Harvest')}</th>
              <th className="py-2">{tr(language, 'Fedha Zote', 'Full Finance')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {roles.map((r) => {
              const p = ROLE_MATRIX[r];
              const badge = (yes: boolean) =>
                yes ? (
                  <Badge variant="success">{tr(language, 'Ndiyo', 'Yes')}</Badge>
                ) : (
                  <Badge variant="neutral">{tr(language, 'Hapana', 'No')}</Badge>
                );
              return (
                <tr key={r}>
                  <td className="py-2 font-bold text-slate-900 dark:text-white">{tDomain(language, r)}</td>
                  <td className="py-2">{badge(p.canRecordFeeding)}</td>
                  <td className="py-2">{badge(p.canApproveFeedingPlan)}</td>
                  <td className="py-2">{badge(p.canIssueFeedFromStore)}</td>
                  <td className="py-2">{badge(p.canDeleteMortality)}</td>
                  <td className="py-2">{badge(p.canApproveTreatment)}</td>
                  <td className="py-2">{badge(p.canApproveHarvest)}</td>
                  <td className="py-2">{badge(p.canViewFullFinance)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Immutable Audit Log */}
      <Card>
        <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
          {tr(language, 'Kumbukumbu za Ukaguzi Zisizoweza Kufutwa', 'Immutable Activity Audit Logs')}
        </h3>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {state.auditLogs.map((log) => (
            <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs">
              <div>
                <div className="font-bold text-slate-900 dark:text-white">
                  [{log.module}] {log.action}
                </div>
                <div className="text-slate-600 dark:text-slate-300">{log.details}</div>
              </div>
              <div className="text-right text-[11px] text-slate-500 dark:text-slate-400">
                <div>
                  {log.actorName} ({tDomain(language, log.actorRole)}) ·{' '}
                  {log.pinVerified
                    ? tr(language, 'Imethibitishwa na PIN', 'PIN Verified')
                    : tr(language, 'Kawaida', 'Standard')}
                </div>
                <div className="font-mono">{log.timestamp}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export const TasksAlertsModule: React.FC<{
  state: AquacultureState;
  onCompleteTask: (taskId: string) => void;
  onAcknowledgeAlert: (alertId: string) => void;
}> = ({ state, onCompleteTask, onAcknowledgeAlert }) => {
  const { language } = useLanguage();
  const { effectiveReducedMotion } = usePreferences();

  return (
    <PullToRefresh onRefresh={async () => {}}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />{' '}
              {tr(language, 'Kazi Zilizopangiwa Shambani', 'Assigned Farm Tasks')}
            </h2>
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              {tr(language, 'Telezesha kulia au gusa kukamilisha', 'Swipe right or tap to complete')}
            </span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {state.tasks.map((t, idx) => {
              const isDone = t.status === 'Completed';
              const isAuto =
                t.id.includes('auto') ||
                t.title.toLowerCase().includes('auto') ||
                t.title.toLowerCase().includes('aerator') ||
                t.title.toLowerCase().includes('variance');
              return (
                <motion.div
                  key={t.id}
                  layout
                  drag={!isDone && !effectiveReducedMotion ? 'x' : false}
                  dragConstraints={{ left: 0, right: 110 }}
                  dragElastic={0.25}
                  onDragEnd={(_e, info) => {
                    if (info.offset.x > 70 && !isDone) {
                      onCompleteTask(t.id);
                    }
                  }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: isDone ? 0.62 : 1, y: 0 }}
                  transition={{
                    delay: getStaggerDelay(idx),
                    duration: DURATIONS.base,
                    ease: EASE_OUT,
                  }}
                  className="flex touch-pan-y items-center justify-between gap-2 py-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`font-bold transition-all ${
                          isDone
                            ? 'text-slate-400 line-through dark:text-slate-500'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {t.title}
                      </span>
                      {isAuto && <Badge variant="auto">{tr(language, 'Otomatiki', 'Auto')}</Badge>}
                    </div>
                    <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                      {t.pondCode} · {t.assignedTo} · {tr(language, 'Muda', 'Due')} {t.dueTime} ·{' '}
                      {tr(language, 'Kipaumbele:', 'Priority:')} {tDomain(language, t.priority)}
                    </div>
                  </div>
                  <Button
                    variant={isDone ? 'secondary' : 'primary'}
                    size="sm"
                    disabled={isDone}
                    onClick={() => onCompleteTask(t.id)}
                  >
                    {isDone
                      ? tr(language, 'Imekamilika', 'Completed')
                      : tr(language, 'Kamilisha', 'Mark Done')}
                  </Button>
                </motion.div>
              );
            })}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
            <Bell className="h-4 w-4 text-amber-500" />{' '}
            {tr(language, 'Tahadhari za Mfumo na Uendeshaji', 'System & Operational Alerts')}
          </h2>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {state.alerts.map((a, idx) => {
              const isAuto =
                a.title.toLowerCase().includes('esp32') ||
                a.title.toLowerCase().includes('auto') ||
                a.title.toLowerCase().includes('variance') ||
                a.title.toLowerCase().includes('low do');
              const variant =
                a.severity === 'High'
                  ? 'danger'
                  : a.severity === 'Medium'
                    ? 'warning'
                    : a.severity === 'Info'
                      ? 'info'
                      : 'success';
              return (
                <motion.div
                  key={a.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: getStaggerDelay(idx),
                    duration: DURATIONS.base,
                    ease: EASE_OUT,
                  }}
                  className="flex items-center justify-between gap-2 py-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant={variant}
                        pulseDot={a.severity === 'High' && !a.acknowledged}
                      >
                        {tDomain(language, a.severity)}
                      </Badge>
                      {isAuto && <Badge variant="auto">{tr(language, 'Otomatiki', 'Auto')}</Badge>}
                      <span className="font-bold text-slate-900 dark:text-white">{a.title}</span>
                    </div>
                    <div className="mt-1 text-slate-600 dark:text-slate-300">{a.detail}</div>
                  </div>
                  <Button
                    variant={a.acknowledged ? 'secondary' : 'warning'}
                    size="sm"
                    disabled={a.acknowledged}
                    onClick={() => onAcknowledgeAlert(a.id)}
                  >
                    {a.acknowledged
                      ? tr(language, 'Imethibitishwa', 'Acknowledged')
                      : tr(language, 'Thibitisha', 'Acknowledge')}
                  </Button>
                </motion.div>
              );
            })}
          </div>
        </Card>
      </div>
    </PullToRefresh>
  );
};

export const SettingsHelpModule: React.FC<{
  mode: 'settings' | 'help';
  state: AquacultureState;
  language?: Language;
  onToggleOffline: () => void;
  onSyncNow: () => void;
  onExportAll: () => void;
}> = ({ mode, state, language = 'sw', onToggleOffline, onSyncNow, onExportAll }) => {
  const t = TRANSLATIONS[language];
  const {
    themeMode,
    setThemeMode,
    reduceAnimations,
    setReduceAnimations,
    lowEndDeviceDetected,
    triggerHaptic,
  } = usePreferences();

  if (mode === 'help') {
    return (
      <Card className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-blue-600 dark:text-sky-400" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {tr(
              language,
              'Mwongozo wa Sheria za Ufugaji Samaki Tanzania na Uendeshaji Shambani',
              'Tanzania Aquaculture Compliance & Field Operations Guide'
            )}
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 text-xs leading-relaxed text-slate-700 md:grid-cols-2 dark:text-slate-300">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
            <h3 className="mb-1.5 font-bold text-slate-900 dark:text-white">
              {tr(
                language,
                'Kanuni za Uvuvi (Ufugaji Samaki), 2024 & FiRCIS',
                'Fisheries (Aquaculture) Regulations, 2024 & FiRCIS'
              )}
            </h3>
            <p>
              {tr(
                language,
                'Kila tawi la shamba linafuatilia namba yake ya kibali cha FiRCIS, masharti ya aina ya samaki wanaoruhusiwa, asili ya vifaranga, na muda wa kusubiri kabla ya kuvuna. Tumia kitengeneza ripoti cha CSV kwa ukaguzi wa Wizara ya Mifugo na Uvuvi au TAFIRI.',
                'Every farm branch tracks its FiRCIS permit number, permitted species restrictions, fingerling hatchery origin, and withdrawal periods before market harvest. Use the CSV Report Generator for Ministry of Livestock and Fisheries or TAFIRI inspections.'
              )}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
            <h3 className="mb-1.5 font-bold text-slate-900 dark:text-white">
              {tr(
                language,
                'Vidhibiti 7 vya Kuzuia Udanganyifu wa Rekodi',
                '7 Anti-Tampering Accountability Controls'
              )}
            </h3>
            <p>
              {tr(
                language,
                '1. Hakuna kufuta rekodi za vifo, chakula au fedha kimyakimya · 2. Uthibitisho wa pande mbili kati ya Mtunza Bohari na Msimamizi · 3. Saini ya PIN ya tarakimu 4 · 4. Kumbukumbu zenye muhuri wa muda · 5. Ushahidi wa Picha/GPS · 6. Idhini ya Meneja kwa matibabu, uhamishaji na mavuno · 7. Uhakiki wa kila siku wa tofauti za chakula na akiba.',
                '1. No silent deletion of mortality/feed/finance logs · 2. Dual confirmation between Storekeeper & Keeper · 3. 4-digit PIN signatures · 4. Timestamped server audit trails · 5. Photo/GPS evidence · 6. Manager approval for treatments/transfers/harvests · 7. Daily stock & feed variance reconciliation.'
              )}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const themeOptions: Array<{ id: ThemeMode; label: string; icon: React.ReactNode }> = [
    { id: 'light', label: t.ui.themeLight, icon: <Sun className="h-3.5 w-3.5" /> },
    { id: 'dark', label: t.ui.themeDark, icon: <Moon className="h-3.5 w-3.5" /> },
    { id: 'system', label: t.ui.themeSystem, icon: <Monitor className="h-3.5 w-3.5" /> },
  ];

  return (
    <Card className="space-y-4 p-5">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
        {tr(
          language,
          'Mipangilio ya Mfumo — Usawazishaji Nje ya Mtandao, Mwonekano na Kasi',
          'System Settings — Offline-First Sync, Display & Performance'
        )}
      </h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Theme & Low-End Performance Mode */}
        <div className="space-y-4 rounded-xl border border-slate-200 p-4 text-xs dark:border-slate-700 dark:bg-slate-800/40">
          <div>
            <div className="mb-2 flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <Sparkles className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              {t.ui.themeLabel}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map((opt) => {
                const active = themeMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic(8);
                      setThemeMode(opt.id);
                    }}
                    className={`flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                      active
                        ? 'border-blue-600 bg-blue-600 text-white dark:border-sky-500 dark:bg-sky-500 dark:text-slate-950'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    {opt.icon}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3 dark:border-slate-700">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                  <Smartphone className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  {t.ui.reduceAnimations}
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {t.ui.reduceAnimationsHint}
                </p>
                {lowEndDeviceDetected && (
                  <p className="mt-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    {t.ui.lowEndAutoHint}
                  </p>
                )}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={reduceAnimations}
                onClick={() => {
                  triggerHaptic(8);
                  setReduceAnimations(!reduceAnimations);
                }}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors ${
                  reduceAnimations
                    ? 'bg-emerald-600'
                    : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    reduceAnimations ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Offline Sync & CSV Backup */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 p-4 text-xs dark:border-slate-700 dark:bg-slate-800/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                {state.offlineMode ? (
                  <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                ) : (
                  <Wifi className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                )}
                {tr(language, 'Hali ya Kufanya Kazi Nje ya Mtandao', 'Offline Field Operation Mode')}
              </div>
              <Button
                variant={state.offlineMode ? 'warning' : 'success'}
                size="sm"
                onClick={onToggleOffline}
              >
                {state.offlineMode
                  ? tr(language, 'Nje ya Mtandao (Foleni ya Kifaa)', 'Offline (Local Queue)')
                  : tr(language, 'Mtandaoni (Usawazishaji Hai)', 'Online (Live Sync)')}
              </Button>
            </div>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              {tr(language, 'Kumbukumbu zinazosubiri kwenye kifaa:', 'Queued local transactions:')}{' '}
              <strong className="tabular-nums">{state.pendingSyncQueue.length}</strong>
            </p>
            {state.pendingSyncQueue.length > 0 && (
              <Button variant="primary" size="sm" onClick={onSyncNow} className="mt-2">
                {tr(language, 'Sawazisha Rekodi Sasa', 'Synchronize Queued Records Now')}
              </Button>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 p-4 text-xs dark:border-slate-700 dark:bg-slate-800/40">
            <div className="font-bold text-slate-900 dark:text-white">
              {tr(language, 'Nakala ya Usalama wa Ufuatiliaji (Tanzania)', 'Tanzania Traceability Backup')}
            </div>
            <p className="mt-1 text-slate-600 dark:text-slate-300">
              {tr(
                language,
                'Pakua rekodi kamili za makundi, ulishaji, na daftari la TZS kama CSV kwa kuhifadhi nje ya mtandao.',
                'Export complete batch, feeding, and TZS ledger records as CSV for offline archiving.'
              )}
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => {
                onExportAll();
                exportToCsv(
                  `dukaaqusmart-full-backup-${todayIso()}.csv`,
                  language === 'sw'
                    ? ['Bwawa', 'Aina ya Samaki', 'Samaki Sasa', 'Uwezo wa Juu', 'Hali']
                    : ['Pond', 'Species', 'Current Fish', 'Max Capacity', 'Status'],
                  state.ponds.map((p) => [
                    p.code,
                    p.species,
                    p.currentFish,
                    p.maxCapacity,
                    tDomain(language, p.status),
                  ])
                );
              }}
            >
              <FileDown className="h-3.5 w-3.5" /> {tr(language, 'Pakua Nakala ya CSV', 'Download Backup CSV')}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
