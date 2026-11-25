import React, { useState } from 'react';
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
import { TRANSLATIONS } from '../../i18n/translations';
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
  CountUpNumber,
  DURATIONS,
  EASE_OUT,
  EmptyState,
  getStaggerDelay,
  INPUT_CLASS,
  PullToRefresh,
  ThemeMode,
  usePreferences,
} from '../../ui';

const PERIOD_OPTIONS: Array<{ id: TimeFilterPeriod; label: string }> = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'all', label: 'All' },
];

export const InventoryModule: React.FC<{
  state: AquacultureState;
  onQuickAction: (a: QuickActionType) => void;
  onBackToMenu?: () => void;
  onRestockItem?: (itemId: string) => void;
}> = ({ state, onQuickAction, onBackToMenu, onRestockItem }) => {
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
              <ArrowLeft className="h-4 w-4" /> Back to Menu
            </Button>
          )}
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Inventory KPIs & Stock Purchase Reports
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage existing products &amp; new purchases, store valuation, low-stock reorder alerts &amp; supplier credit.
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
                [
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
                  p.category,
                  p.lotNumber,
                  p.invoiceNo || '',
                  p.supplier,
                  p.quantity,
                  p.unit,
                  p.unitCostTzs,
                  p.totalCostTzs,
                  p.paidAmountTzs ?? (p.paymentStatus === 'Paid' ? p.totalCostTzs : 0),
                  Math.max(0, p.totalCostTzs - (p.paidAmountTzs ?? (p.paymentStatus === 'Paid' ? p.totalCostTzs : 0))),
                  p.paymentStatus,
                ])
              )
            }
          >
            <FileDown className="h-4 w-4 text-teal-600 dark:text-teal-400" /> Export Purchase Report
          </Button>
          <Button variant="success" size="sm" onClick={() => onQuickAction('inventory')}>
            <Package className="h-4 w-4" /> Add Stock / Purchase
          </Button>
        </div>
      </Card>

      {/* 4 INVENTORY & PURCHASE KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Current Inventory Valuation</span>
            <Package className="h-4 w-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="mt-1 text-xl font-extrabold text-slate-900 tabular-nums dark:text-white">
            <CountUpNumber value={totalStockValueTzs} formatter={(v) => formatTzs(v)} />
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Across {state.inventory.length} tracked stock items
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Period Stock Purchases</span>
            <ShoppingCart className="h-4 w-4 text-blue-600 dark:text-sky-400" />
          </div>
          <div className="mt-1 text-xl font-extrabold text-blue-700 tabular-nums dark:text-sky-400">
            <CountUpNumber value={periodPurchaseSpend} formatter={(v) => formatTzs(v)} />
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500 tabular-nums dark:text-slate-400">
            {filteredPurchases.length} purchase order(s) in period
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Feed Balance & Coverage</span>
            <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-1 text-xl font-extrabold text-emerald-700 tabular-nums dark:text-emerald-400">
            <CountUpNumber value={feedStockKg} formatter={(v) => formatNumber(v)} suffix=" kg" />
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500 tabular-nums dark:text-slate-400">
            ≈ {Math.max(1, Math.round(feedStockKg / 170))} days feeding reserve
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Low Stock & Supplier Credit</span>
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-1 text-xl font-extrabold text-amber-700 tabular-nums dark:text-amber-400">
            <CountUpNumber value={lowStockItems.length} suffix=" Low Stock" />
          </div>
          <div className="mt-0.5 text-[11px] font-semibold text-rose-700 tabular-nums dark:text-rose-400">
            Supplier credit due: {formatTzs(periodUnpaidCredit)}
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
              { id: 'purchases', label: `Stock Purchase Reports (${filteredPurchases.length})` },
              { id: 'stock', label: `Current Stock Balance (${filteredInventory.length})` },
            ]}
          />

          <AnimatedTabs
            layoutId="inventory-periods"
            activeId={period}
            onChange={(val) => setPeriod(val as TimeFilterPeriod)}
            tabs={PERIOD_OPTIONS}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search className="pointer-events-none absolute top-3.5 left-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search item, SKU, lot, supplier..."
              className={`${INPUT_CLASS} min-h-[42px] py-2 pr-3 pl-9`}
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by category"
            className={`${INPUT_CLASS} min-h-[42px] w-auto min-w-[155px] py-2`}
          >
            <option value="all">All Categories</option>
            <option value="Feed">Feed</option>
            <option value="Fingerlings">Fingerlings</option>
            <option value="Medicine">Medicine</option>
            <option value="Fuel">Fuel</option>
            <option value="Equipment">Equipment</option>
          </select>
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            aria-label="Filter by supplier"
            className={`${INPUT_CLASS} min-h-[42px] w-auto min-w-[165px] py-2`}
          >
            <option value="all">All Suppliers</option>
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
                <span className="font-semibold text-slate-700 dark:text-slate-200">{c.category}</span>
                <span className="tabular-nums">{share}%</span>
              </div>
              <div className="mt-1 font-extrabold text-slate-900 tabular-nums dark:text-white">
                {formatTzs(c.totalTzs)}
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <motion.div
                  className="h-full rounded-full bg-teal-600 dark:bg-teal-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${share}%` }}
                  transition={{ duration: 0.45, ease: EASE_OUT }}
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
              Stock Purchase Report Ledger ({PERIOD_OPTIONS.find((p) => p.id === period)?.label})
            </h3>
            <span className="text-xs font-semibold text-slate-600 tabular-nums dark:text-slate-300">
              Period Total: {formatTzs(periodPurchaseSpend)}
            </span>
          </div>
          {filteredPurchases.length === 0 ? (
            <EmptyState
              icon={<ShoppingCart className="h-6 w-6" />}
              title="No stock purchases in this period"
              description="Adjust your time range or click Add Stock / Purchase to record a supplier delivery."
            />
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="py-2">Date</th>
                  <th className="py-2">Item</th>
                  <th className="py-2">Category</th>
                  <th className="py-2">Supplier</th>
                  <th className="py-2">Invoice / Lot #</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Unit Cost</th>
                  <th className="py-2 text-right">Total Cost</th>
                  <th className="py-2 pl-3">Payment / Due</th>
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
                            Exp: {p.expiryDate}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 text-slate-600 dark:text-slate-300">{p.category}</td>
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
                          {p.paymentStatus}
                        </Badge>
                        {dueAmt > 0 && (
                          <div className="mt-0.5 text-[10px] font-semibold text-rose-700 tabular-nums dark:text-rose-400">
                            Due: {formatTzs(dueAmt)}
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
                <th className="py-2">Item &amp; SKU</th>
                <th className="py-2">Category</th>
                <th className="py-2">Lot / Batch</th>
                <th className="py-2">Supplier</th>
                <th className="py-2 text-right">Stock / Reorder</th>
                <th className="py-2 text-right">Unit Cost</th>
                <th className="py-2 text-right">Stock Value</th>
                <th className="py-2 pl-3">Expiry</th>
                <th className="py-2">Status</th>
                <th className="py-2 text-right">Action</th>
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
                  <td className="py-2.5 text-slate-600 dark:text-slate-300">{i.category}</td>
                  <td className="py-2.5 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                    {i.batchOrLot}
                  </td>
                  <td className="py-2.5 text-slate-700 dark:text-slate-300">{i.supplier}</td>
                  <td className="py-2.5 text-right tabular-nums dark:text-slate-200">
                    <div className="font-bold">
                      {formatNumber(i.stock)} {i.unit}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Min: {formatNumber(i.reorderLevel)}
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
                    <Badge variant={i.status === 'In Stock' ? 'success' : 'warning'}>{i.status}</Badge>
                  </td>
                  <td className="py-2.5 text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => (onRestockItem ? onRestockItem(i.id) : onQuickAction('inventory'))}
                    >
                      + Restock
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

  if (!perms.canViewFullFinance) {
    return (
      <Card className="border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-800/60 dark:bg-amber-950/40">
        <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-amber-600 dark:text-amber-400" />
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Financial Access Restricted by RBAC Policy
        </h3>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
          Your current role ({state.activeUser.roleLabel}) has restricted financial visibility. Switch to{' '}
          <strong>Owner / Boss</strong> or <strong>Farm Manager</strong> in the sidebar to inspect full TZS profitability ledgers.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Module G: Finance, Unit Economics & FiRCIS Reports
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Track cost/kg produced, feed cost share, batch profitability, and customer/supplier balances in TZS.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => onQuickAction('report')}>
          <FileDown className="h-4 w-4" /> Export CSV Reports
        </Button>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <div className="text-xs text-slate-500 dark:text-slate-400">Total Revenue</div>
          <div className="mt-1 text-lg font-extrabold text-slate-900 tabular-nums dark:text-white">
            <CountUpNumber value={totalRevenue} formatter={(v) => formatTzs(v)} />
          </div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500 dark:text-slate-400">Total Expenses</div>
          <div className="mt-1 text-lg font-extrabold text-rose-700 tabular-nums dark:text-rose-400">
            <CountUpNumber value={totalExpenses} formatter={(v) => formatTzs(v)} />
          </div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500 dark:text-slate-400">Gross Profit</div>
          <div className="mt-1 text-lg font-extrabold text-emerald-700 tabular-nums dark:text-emerald-400">
            <CountUpNumber value={totalRevenue - totalExpenses} formatter={(v) => formatTzs(v)} />
          </div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500 dark:text-slate-400">Est. Production Cost / kg</div>
          <div className="mt-1 text-lg font-extrabold text-blue-700 tabular-nums dark:text-sky-400">
            {formatTzs(costPerKg)}/kg · Feed {Math.round((feedExpenses / Math.max(1, totalExpenses)) * 100)}%
          </div>
        </Card>
      </div>

      <Card className="overflow-x-auto">
        <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
          TZS Farm Cashflow & Debt Ledger
        </h3>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <th className="py-2">Date</th>
              <th className="py-2">Type</th>
              <th className="py-2">Category</th>
              <th className="py-2">Description</th>
              <th className="py-2">Counterparty</th>
              <th className="py-2 text-right">Amount</th>
              <th className="py-2 pl-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {state.finances.map((f) => (
              <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="py-2.5 text-slate-500 tabular-nums dark:text-slate-400">{f.date}</td>
                <td className="py-2.5">
                  <Badge variant={f.type === 'Revenue' ? 'success' : 'danger'}>{f.type}</Badge>
                </td>
                <td className="py-2.5 font-medium text-slate-700 dark:text-slate-300">{f.category}</td>
                <td className="py-2.5 text-slate-800 dark:text-slate-200">{f.description}</td>
                <td className="py-2.5 text-slate-600 dark:text-slate-400">{f.counterparty}</td>
                <td className="py-2.5 text-right font-bold tabular-nums dark:text-white">
                  {formatTzs(f.amountTzs)}
                </td>
                <td className="py-2.5 pl-3">
                  <Badge variant={f.paymentStatus === 'Paid' ? 'success' : 'warning'}>
                    {f.paymentStatus}
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
  const roles: UserRole[] = ['owner', 'manager', 'technician', 'keeper', 'storekeeper'];

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Module H: Digital Responsibility, RBAC Permissions & Immutable Audit Trail
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Switch active employee persona below to experience real role-based permissions, PIN signatures, and tamper-proof audit logging.
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
                  {isActive && <Badge variant="info">Active</Badge>}
                </div>
                <div className="mt-0.5 text-[11px] font-semibold text-blue-700 dark:text-sky-400">
                  {emp.roleLabel}
                </div>
                <div className="mt-1 text-slate-500 dark:text-slate-400">{emp.phone}</div>
                <div className="mt-1 text-slate-600 dark:text-slate-300">
                  PIN: <span className="font-mono font-bold">••••</span> (Configured) · Reports:{' '}
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
                  {isActive ? 'Current Persona' : 'Switch to Role'}
                </Button>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* RBAC Matrix */}
      <Card className="overflow-x-auto">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          <Users className="h-4 w-4 text-blue-600 dark:text-sky-400" /> Permission & Responsibility Matrix
        </h3>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <th className="py-2">Role</th>
              <th className="py-2">Record Feeding</th>
              <th className="py-2">Approve Feed Plan</th>
              <th className="py-2">Issue Store Feed</th>
              <th className="py-2">Delete Mortality</th>
              <th className="py-2">Approve Treatment</th>
              <th className="py-2">Approve Harvest</th>
              <th className="py-2">Full Finance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {roles.map((r) => {
              const p = ROLE_MATRIX[r];
              const badge = (yes: boolean) =>
                yes ? <Badge variant="success">Yes</Badge> : <Badge variant="neutral">No</Badge>;
              return (
                <tr key={r}>
                  <td className="py-2 font-bold capitalize text-slate-900 dark:text-white">{r}</td>
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
          Immutable Activity Audit Logs
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
                  {log.actorName} ({log.actorRole}) · {log.pinVerified ? 'PIN Verified' : 'Standard'}
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
  const { effectiveReducedMotion } = usePreferences();

  return (
    <PullToRefresh onRefresh={async () => {}}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Assigned Farm Tasks
            </h2>
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              Swipe right or tap to complete
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
                      {isAuto && <Badge variant="auto">Auto</Badge>}
                    </div>
                    <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                      {t.pondCode} · {t.assignedTo} · Due {t.dueTime} · Priority: {t.priority}
                    </div>
                  </div>
                  <Button
                    variant={isDone ? 'secondary' : 'primary'}
                    size="sm"
                    disabled={isDone}
                    onClick={() => onCompleteTask(t.id)}
                  >
                    {isDone ? 'Completed' : 'Mark Done'}
                  </Button>
                </motion.div>
              );
            })}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
            <Bell className="h-4 w-4 text-amber-500" /> System & Operational Alerts
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
                        {a.severity}
                      </Badge>
                      {isAuto && <Badge variant="auto">Auto</Badge>}
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
                    {a.acknowledged ? 'Acknowledged' : 'Acknowledge'}
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
}> = ({ mode, state, language = 'en', onToggleOffline, onSyncNow, onExportAll }) => {
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
            Tanzania Aquaculture Compliance & Field Operations Guide
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 text-xs leading-relaxed text-slate-700 md:grid-cols-2 dark:text-slate-300">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
            <h3 className="mb-1.5 font-bold text-slate-900 dark:text-white">
              Fisheries (Aquaculture) Regulations, 2024 & FiRCIS
            </h3>
            <p>
              Every farm branch tracks its FiRCIS permit number, permitted species restrictions, fingerling hatchery origin, and withdrawal periods before market harvest. Use the CSV Report Generator for Ministry of Livestock and Fisheries or TAFIRI inspections.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
            <h3 className="mb-1.5 font-bold text-slate-900 dark:text-white">
              7 Anti-Tampering Accountability Controls
            </h3>
            <p>
              1. No silent deletion of mortality/feed/finance logs · 2. Dual confirmation between Storekeeper & Keeper · 3. 4-digit PIN signatures · 4. Timestamped server audit trails · 5. Photo/GPS evidence · 6. Manager approval for treatments/transfers/harvests · 7. Daily stock & feed variance reconciliation.
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
        System Settings — Offline-First Sync, Display & Performance
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
                Offline Field Operation Mode
              </div>
              <Button
                variant={state.offlineMode ? 'warning' : 'success'}
                size="sm"
                onClick={onToggleOffline}
              >
                {state.offlineMode ? 'Offline (Local Queue)' : 'Online (Live Sync)'}
              </Button>
            </div>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              Queued local transactions:{' '}
              <strong className="tabular-nums">{state.pendingSyncQueue.length}</strong>
            </p>
            {state.pendingSyncQueue.length > 0 && (
              <Button variant="primary" size="sm" onClick={onSyncNow} className="mt-2">
                Synchronize Queued Records Now
              </Button>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 p-4 text-xs dark:border-slate-700 dark:bg-slate-800/40">
            <div className="font-bold text-slate-900 dark:text-white">
              Tanzania Traceability Backup
            </div>
            <p className="mt-1 text-slate-600 dark:text-slate-300">
              Export complete batch, feeding, and TZS ledger records as CSV for offline archiving.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => {
                onExportAll();
                exportToCsv(
                  `dukaaqusmart-full-backup-${todayIso()}.csv`,
                  ['Pond', 'Species', 'Current Fish', 'Max Capacity', 'Status'],
                  state.ponds.map((p) => [p.code, p.species, p.currentFish, p.maxCapacity, p.status])
                );
              }}
            >
              <FileDown className="h-3.5 w-3.5" /> Download Backup CSV
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
