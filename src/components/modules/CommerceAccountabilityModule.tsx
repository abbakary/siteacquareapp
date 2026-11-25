import React, { useState } from 'react';
import {
  Scale,
  Package,
  Coins,
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
  CreditCard,
} from 'lucide-react';
import { AquacultureState, UserRole } from '../../types/aquaculture';
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

const PERIOD_OPTIONS: Array<{ id: TimeFilterPeriod; label: string }> = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'all', label: 'All' },
];

export const HarvestSalesModule: React.FC<{
  state: AquacultureState;
  onQuickAction: (a: QuickActionType) => void;
  onCollectHarvestPayment: (harvestId: string) => void;
}> = ({ state, onQuickAction, onCollectHarvestPayment }) => {
  const [period, setPeriod] = useState<TimeFilterPeriod>('month');
  const [speciesFilter, setSpeciesFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'due'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredHarvests = state.harvests.filter((h) => {
    if (!isDateInPeriod(h.date, period)) return false;
    if (speciesFilter !== 'all' && h.species !== speciesFilter) return false;
    const balance = h.totalAmountTzs - h.paidAmountTzs;
    if (paymentFilter === 'paid' && balance > 0) return false;
    if (paymentFilter === 'due' && balance <= 0) return false;
    if (
      searchQuery.trim() &&
      !`${h.customerName} ${h.pondCode} ${h.batchCode} ${h.species}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const periodRevenue = filteredHarvests.reduce((sum, h) => sum + h.totalAmountTzs, 0);
  const periodPaid = filteredHarvests.reduce((sum, h) => sum + h.paidAmountTzs, 0);
  const periodReceivables = Math.max(0, periodRevenue - periodPaid);
  const periodWeightKg = filteredHarvests.reduce((sum, h) => sum + h.totalWeightKg, 0);
  const periodFishCount = filteredHarvests.reduce((sum, h) => sum + h.totalFishHarvested, 0);
  const periodLargeKg = filteredHarvests.reduce((sum, h) => sum + h.grades.largeKg, 0);
  const avgPricePerKg = periodWeightKg > 0 ? periodRevenue / periodWeightKg : 0;
  const gradeASharePct = periodWeightKg > 0 ? Math.round((periodLargeKg / periodWeightKg) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Module F: Harvest Grading, Customer Sales & Receivables
          </h2>
          <p className="text-xs text-slate-500">
            Filter harvest performance by Day, Week, Month, or Year; monitor TZS sales KPIs, Grade A yield & customer receivables.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              exportToCsv(
                `dukaaqusmart-sales-${period}-${todayIso()}.csv`,
                [
                  'Date',
                  'Pond',
                  'Batch',
                  'Species',
                  'Fish Qty',
                  'Weight (kg)',
                  'Customer',
                  'Price/kg (TZS)',
                  'Total (TZS)',
                  'Paid (TZS)',
                  'Balance (TZS)',
                ],
                filteredHarvests.map((h) => [
                  h.date,
                  h.pondCode,
                  h.batchCode,
                  h.species,
                  h.totalFishHarvested,
                  h.totalWeightKg,
                  h.customerName,
                  h.pricePerKgTzs,
                  h.totalAmountTzs,
                  h.paidAmountTzs,
                  h.totalAmountTzs - h.paidAmountTzs,
                ])
              )
            }
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            <FileDown className="h-4 w-4 text-blue-600" /> Export Sales CSV
          </button>
          <button
            type="button"
            onClick={() => onQuickAction('harvest')}
            className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-orange-700"
          >
            <Scale className="h-4 w-4" /> Record New Harvest & Sale
          </button>
        </div>
      </div>

      {/* SALES KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Harvest Sales Revenue</span>
            <Coins className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="mt-1 text-xl font-extrabold text-slate-900 tabular-nums">
            {formatTzs(periodRevenue)}
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-emerald-700 tabular-nums">
            {filteredHarvests.length} order(s) in period
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Total Harvested Volume</span>
            <Scale className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-1 text-xl font-extrabold text-slate-900 tabular-nums">
            {formatNumber(periodWeightKg)} kg
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500 tabular-nums">
            {formatNumber(periodFishCount)} fish harvested
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Avg Selling Price & Grade A</span>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-1 text-xl font-extrabold text-blue-700 tabular-nums">
            {formatTzs(avgPricePerKg)}/kg
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500 tabular-nums">
            Large Grade share: {gradeASharePct}%
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Collected vs Receivables</span>
            <CreditCard className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-1 text-xl font-extrabold text-emerald-700 tabular-nums">
            {formatTzs(periodPaid)}
          </div>
          <div className="mt-0.5 text-[11px] font-semibold text-amber-700 tabular-nums">
            Due balance: {formatTzs(periodReceivables)}
          </div>
        </div>
      </div>

      {/* TIME & ATTRIBUTE FILTERS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPeriod(opt.id)}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                period === opt.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute top-2 left-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer, pond, batch..."
              className="rounded-lg border border-slate-200 py-1.5 pr-3 pl-8 text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>
          <select
            value={speciesFilter}
            onChange={(e) => setSpeciesFilter(e.target.value)}
            aria-label="Filter by species"
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700"
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
            onChange={(e) => setPaymentFilter(e.target.value as 'all' | 'paid' | 'due')}
            aria-label="Filter by payment status"
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700"
          >
            <option value="all">All Payments</option>
            <option value="paid">Fully Paid</option>
            <option value="due">Balance Due</option>
          </select>
        </div>
      </div>

      {filteredHarvests.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
          No harvest sales match the selected timeframe or filters. Try switching to Month, Year, or All.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHarvests.map((h) => {
            const balanceDue = Math.max(0, h.totalAmountTzs - h.paidAmountTzs);
            return (
              <div key={h.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {h.pondCode} ({h.batchCode}) · {h.species}
                    </div>
                    <div className="text-xs text-slate-500">
                      Harvested {h.date} · Customer: <strong>{h.customerName}</strong> ({h.customerPhone}) · Approved by {h.approvedBy}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-base font-extrabold text-emerald-700 tabular-nums">
                        {formatTzs(h.totalAmountTzs)}
                      </div>
                      <div className="text-[11px] font-semibold text-slate-500 tabular-nums">
                        Paid: {formatTzs(h.paidAmountTzs)} · {h.deliveryStatus}
                      </div>
                    </div>
                    {balanceDue > 0 && (
                      <button
                        type="button"
                        onClick={() => onCollectHarvestPayment(h.id)}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Collect {formatTzs(balanceDue)}
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <div className="text-slate-500">Large Grade</div>
                    <div className="font-bold text-slate-900 tabular-nums">
                      {h.grades.largeCount} fish · {h.grades.largeKg} kg
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <div className="text-slate-500">Medium Grade</div>
                    <div className="font-bold text-slate-900 tabular-nums">
                      {h.grades.mediumCount} fish · {h.grades.mediumKg} kg
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <div className="text-slate-500">Small Grade</div>
                    <div className="font-bold text-slate-900 tabular-nums">
                      {h.grades.smallCount} fish · {h.grades.smallKg} kg
                    </div>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-2.5">
                    <div className="text-emerald-700">Total Harvested</div>
                    <div className="font-extrabold text-emerald-900 tabular-nums">
                      {h.totalFishHarvested} fish · {h.totalWeightKg} kg
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const InventoryModule: React.FC<{
  state: AquacultureState;
  onQuickAction: (a: QuickActionType) => void;
}> = ({ state, onQuickAction }) => {
  const [period, setPeriod] = useState<TimeFilterPeriod>('month');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'purchases' | 'stock'>('purchases');

  const purchases = state.stockPurchases || [];
  const suppliers = Array.from(new Set(purchases.map((p) => p.supplier)));

  // Inventory KPIs
  const totalStockValueTzs = state.inventory.reduce(
    (sum, item) => sum + item.stock * item.unitCostTzs,
    0
  );
  const feedStockKg = state.inventory
    .filter((i) => i.category === 'Feed')
    .reduce((sum, i) => sum + i.stock, 0);
  const lowStockItems = state.inventory.filter((i) => i.status !== 'In Stock');

  // Filtered Stock Purchases
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
    .reduce((sum, p) => sum + p.totalCostTzs, 0);

  // Filtered Current Inventory Table
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

  // Category spend summary for selected period
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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Inventory KPIs & Stock Purchase Reports
          </h2>
          <p className="text-xs text-slate-500">
            Monitor store stock valuation, low-stock alerts, supplier deliveries & procurement spend by Day, Week, Month, or Year.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              exportToCsv(
                `dukaaqusmart-stock-purchases-${period}-${todayIso()}.csv`,
                [
                  'Date',
                  'Item',
                  'Category',
                  'Lot',
                  'Supplier',
                  'Quantity',
                  'Unit',
                  'Unit Cost (TZS)',
                  'Total Cost (TZS)',
                  'Payment Status',
                ],
                filteredPurchases.map((p) => [
                  p.date,
                  p.itemName,
                  p.category,
                  p.lotNumber,
                  p.supplier,
                  p.quantity,
                  p.unit,
                  p.unitCostTzs,
                  p.totalCostTzs,
                  p.paymentStatus,
                ])
              )
            }
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            <FileDown className="h-4 w-4 text-teal-600" /> Export Purchase Report
          </button>
          <button
            type="button"
            onClick={() => onQuickAction('inventory')}
            className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-700"
          >
            <Package className="h-4 w-4" /> Add Stock / Purchase
          </button>
        </div>
      </div>

      {/* 4 INVENTORY & PURCHASE KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Current Inventory Valuation</span>
            <Package className="h-4 w-4 text-teal-600" />
          </div>
          <div className="mt-1 text-xl font-extrabold text-slate-900 tabular-nums">
            {formatTzs(totalStockValueTzs)}
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500">
            Across {state.inventory.length} tracked stock items
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Period Stock Purchases</span>
            <ShoppingCart className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-1 text-xl font-extrabold text-blue-700 tabular-nums">
            {formatTzs(periodPurchaseSpend)}
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500 tabular-nums">
            {filteredPurchases.length} purchase order(s) in period
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Feed Balance & Coverage</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-1 text-xl font-extrabold text-emerald-700 tabular-nums">
            {formatNumber(feedStockKg)} kg
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500 tabular-nums">
            ≈ {Math.max(1, Math.round(feedStockKg / 170))} days feeding reserve
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Low Stock & Supplier Credit</span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-1 text-xl font-extrabold text-amber-700 tabular-nums">
            {lowStockItems.length} Low Stock
          </div>
          <div className="mt-0.5 text-[11px] font-semibold text-rose-700 tabular-nums">
            Supplier credit due: {formatTzs(periodUnpaidCredit)}
          </div>
        </div>
      </div>

      {/* FILTER & TAB CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('purchases')}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                activeTab === 'purchases'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Stock Purchase Reports ({filteredPurchases.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('stock')}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                activeTab === 'stock'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Current Stock Balance ({filteredInventory.length})
            </button>
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPeriod(opt.id)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  period === opt.id
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute top-2 left-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search item, lot, supplier..."
              className="rounded-lg border border-slate-200 py-1.5 pr-3 pl-8 text-xs focus:border-teal-500 focus:outline-none"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by category"
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700"
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
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700"
          >
            <option value="all">All Suppliers</option>
            {suppliers.map((sup) => (
              <option key={sup} value={sup}>
                {sup}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* CATEGORY SPEND BREAKDOWN BAR */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {categoryBreakdown.map((c) => {
          const share =
            periodPurchaseSpend > 0 ? Math.round((c.totalTzs / periodPurchaseSpend) * 100) : 0;
          return (
            <div key={c.category} className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="font-semibold text-slate-700">{c.category}</span>
                <span className="tabular-nums">{share}%</span>
              </div>
              <div className="mt-1 font-extrabold text-slate-900 tabular-nums">
                {formatTzs(c.totalTzs)}
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-teal-600" style={{ width: `${share}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {activeTab === 'purchases' ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 overflow-x-auto">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Stock Purchase Report Ledger ({PERIOD_OPTIONS.find((p) => p.id === period)?.label})
            </h3>
            <span className="text-xs font-semibold text-slate-600 tabular-nums">
              Period Total: {formatTzs(periodPurchaseSpend)}
            </span>
          </div>
          {filteredPurchases.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              No stock purchases recorded in this period/filter. Click &ldquo;Add Stock / Purchase&rdquo; or select Month / Year.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                  <th className="py-2">Date</th>
                  <th className="py-2">Item</th>
                  <th className="py-2">Category</th>
                  <th className="py-2">Supplier</th>
                  <th className="py-2">Lot #</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Unit Cost</th>
                  <th className="py-2 text-right">Total Cost</th>
                  <th className="py-2 pl-3">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPurchases.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-2.5 text-slate-500 tabular-nums">{p.date}</td>
                    <td className="py-2.5 font-bold text-slate-900">{p.itemName}</td>
                    <td className="py-2.5 text-slate-600">{p.category}</td>
                    <td className="py-2.5 text-slate-700">{p.supplier}</td>
                    <td className="py-2.5 font-mono text-[11px] text-slate-500">{p.lotNumber}</td>
                    <td className="py-2.5 text-right font-semibold tabular-nums">
                      {formatNumber(p.quantity)} {p.unit}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{formatTzs(p.unitCostTzs)}</td>
                    <td className="py-2.5 text-right font-extrabold text-slate-900 tabular-nums">
                      {formatTzs(p.totalCostTzs)}
                    </td>
                    <td className="py-2.5 pl-3">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          p.paymentStatus === 'Paid'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {p.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                <th className="py-2">Item Name</th>
                <th className="py-2">Category</th>
                <th className="py-2">Lot / Batch</th>
                <th className="py-2">Supplier</th>
                <th className="py-2 text-right">Stock</th>
                <th className="py-2 text-right">Unit Cost</th>
                <th className="py-2 text-right">Stock Value</th>
                <th className="py-2 pl-3">Expiry</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInventory.map((i) => (
                <tr key={i.id} className="hover:bg-slate-50">
                  <td className="py-2.5 font-bold text-slate-900">{i.name}</td>
                  <td className="py-2.5 text-slate-600">{i.category}</td>
                  <td className="py-2.5 font-mono text-[11px] text-slate-600">{i.batchOrLot}</td>
                  <td className="py-2.5 text-slate-700">{i.supplier}</td>
                  <td className="py-2.5 text-right font-bold tabular-nums">
                    {formatNumber(i.stock)} {i.unit}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{formatTzs(i.unitCostTzs)}</td>
                  <td className="py-2.5 text-right font-bold text-slate-900 tabular-nums">
                    {formatTzs(i.stock * i.unitCostTzs)}
                  </td>
                  <td className="py-2.5 pl-3 text-slate-500">{i.expiryDate || '—'}</td>
                  <td className="py-2.5">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                        i.status === 'In Stock'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {i.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
        <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-amber-600" />
        <h3 className="text-base font-bold text-slate-900">Financial Access Restricted by RBAC Policy</h3>
        <p className="mt-1 text-xs text-slate-600">
          Your current role ({state.activeUser.roleLabel}) has restricted financial visibility. Switch to{' '}
          <strong>Owner / Boss</strong> or <strong>Farm Manager</strong> in the sidebar to inspect full TZS profitability ledgers.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Module G: Finance, Unit Economics & FiRCIS Reports</h2>
          <p className="text-xs text-slate-500">
            Track cost/kg produced, feed cost share, batch profitability, and customer/supplier balances in TZS.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onQuickAction('report')}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          <FileDown className="h-4 w-4" /> Export CSV Reports
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Total Revenue</div>
          <div className="mt-1 text-lg font-extrabold text-slate-900 tabular-nums">{formatTzs(totalRevenue)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Total Expenses</div>
          <div className="mt-1 text-lg font-extrabold text-rose-700 tabular-nums">{formatTzs(totalExpenses)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Gross Profit</div>
          <div className="mt-1 text-lg font-extrabold text-emerald-700 tabular-nums">
            {formatTzs(totalRevenue - totalExpenses)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Est. Production Cost / kg</div>
          <div className="mt-1 text-lg font-extrabold text-blue-700 tabular-nums">
            {formatTzs(costPerKg)}/kg · Feed {Math.round((feedExpenses / Math.max(1, totalExpenses)) * 100)}%
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 overflow-x-auto">
        <h3 className="mb-3 text-sm font-bold text-slate-900">TZS Farm Cashflow & Debt Ledger</h3>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
              <th className="py-2">Date</th>
              <th className="py-2">Type</th>
              <th className="py-2">Category</th>
              <th className="py-2">Description</th>
              <th className="py-2">Counterparty</th>
              <th className="py-2 text-right">Amount</th>
              <th className="py-2 pl-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {state.finances.map((f) => (
              <tr key={f.id} className="hover:bg-slate-50">
                <td className="py-2.5 text-slate-500 tabular-nums">{f.date}</td>
                <td className="py-2.5">
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                      f.type === 'Revenue' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {f.type}
                  </span>
                </td>
                <td className="py-2.5 font-medium text-slate-700">{f.category}</td>
                <td className="py-2.5 text-slate-800">{f.description}</td>
                <td className="py-2.5 text-slate-600">{f.counterparty}</td>
                <td className="py-2.5 text-right font-bold tabular-nums">{formatTzs(f.amountTzs)}</td>
                <td className="py-2.5 pl-3">
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                      f.paymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {f.paymentStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-bold text-slate-900">
          Module H: Digital Responsibility, RBAC Permissions & Immutable Audit Trail
        </h2>
        <p className="text-xs text-slate-500">
          Switch active employee persona below to experience real role-based permissions, PIN signatures, and tamper-proof audit logging.
        </p>
      </div>

      {/* Employee Cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {state.employees.map((emp) => {
          const isActive = state.activeUser.id === emp.id;
          return (
            <div
              key={emp.id}
              className={`rounded-xl border p-3.5 text-xs ${
                isActive ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">{emp.name}</span>
                {isActive && (
                  <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">Active</span>
                )}
              </div>
              <div className="text-[11px] font-semibold text-blue-700">{emp.roleLabel}</div>
              <div className="mt-1 text-slate-500">{emp.phone}</div>
              <div className="mt-1 text-slate-600">
                PIN: <span className="font-mono font-bold">{emp.pin}</span> · Reports: {emp.reportsSubmittedToday}
              </div>
              <button
                type="button"
                onClick={() => onSwitchUser(emp.id)}
                disabled={isActive}
                className="mt-2.5 w-full rounded-lg border border-slate-200 bg-white py-1.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                {isActive ? 'Current Persona' : 'Switch to Role'}
              </button>
            </div>
          );
        })}
      </div>

      {/* RBAC Matrix */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 overflow-x-auto">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
          <Users className="h-4 w-4 text-blue-600" /> Permission & Responsibility Matrix
        </h3>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
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
          <tbody className="divide-y divide-slate-100">
            {roles.map((r) => {
              const p = ROLE_MATRIX[r];
              const badge = (yes: boolean) =>
                yes ? (
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Yes</span>
                ) : (
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">No</span>
                );
              return (
                <tr key={r}>
                  <td className="py-2 font-bold capitalize text-slate-900">{r}</td>
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
      </div>

      {/* Immutable Audit Log */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-bold text-slate-900">Immutable Activity Audit Logs</h3>
        <div className="divide-y divide-slate-100">
          {state.auditLogs.map((log) => (
            <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs">
              <div>
                <div className="font-bold text-slate-900">
                  [{log.module}] {log.action}
                </div>
                <div className="text-slate-600">{log.details}</div>
              </div>
              <div className="text-right text-[11px] text-slate-500">
                <div>
                  {log.actorName} ({log.actorRole}) · {log.pinVerified ? 'PIN Verified' : 'Standard'}
                </div>
                <div className="font-mono">{log.timestamp}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const TasksAlertsModule: React.FC<{
  state: AquacultureState;
  onCompleteTask: (taskId: string) => void;
  onAcknowledgeAlert: (alertId: string) => void;
}> = ({ state, onCompleteTask, onAcknowledgeAlert }) => {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-900">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Assigned Farm Tasks
        </h2>
        <div className="divide-y divide-slate-100">
          {state.tasks.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2 py-3 text-xs">
              <div>
                <div className="font-bold text-slate-900">{t.title}</div>
                <div className="text-slate-500">
                  {t.pondCode} · {t.assignedTo} · Due {t.dueTime} · Priority: {t.priority}
                </div>
              </div>
              <button
                type="button"
                disabled={t.status === 'Completed'}
                onClick={() => onCompleteTask(t.id)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold ${
                  t.status === 'Completed'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {t.status === 'Completed' ? 'Completed' : 'Mark Done'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-900">
          <Bell className="h-4 w-4 text-amber-500" /> System & IoT Alerts
        </h2>
        <div className="divide-y divide-slate-100">
          {state.alerts.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 py-3 text-xs">
              <div>
                <div className="font-bold text-slate-900">
                  [{a.severity}] {a.title}
                </div>
                <div className="text-slate-600">{a.detail}</div>
              </div>
              <button
                type="button"
                disabled={a.acknowledged}
                onClick={() => onAcknowledgeAlert(a.id)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold ${
                  a.acknowledged
                    ? 'bg-slate-100 text-slate-500'
                    : 'bg-amber-500 text-white hover:bg-amber-600'
                }`}
              >
                {a.acknowledged ? 'Acknowledged' : 'Acknowledge'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const SettingsHelpModule: React.FC<{
  mode: 'settings' | 'help';
  state: AquacultureState;
  onToggleOffline: () => void;
  onSyncNow: () => void;
  onExportAll: () => void;
}> = ({ mode, state, onToggleOffline, onSyncNow, onExportAll }) => {
  if (mode === 'help') {
    return (
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-bold text-slate-900">
            Tanzania Aquaculture Compliance & Field Operations Guide
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-xs text-slate-700 leading-relaxed">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-1.5 font-bold text-slate-900">
              Fisheries (Aquaculture) Regulations, 2024 & FiRCIS
            </h3>
            <p>
              Every farm branch tracks its FiRCIS permit number, permitted species restrictions, fingerling hatchery origin, and withdrawal periods before market harvest. Use the CSV Report Generator for Ministry of Livestock and Fisheries or TAFIRI inspections.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-1.5 font-bold text-slate-900">
              7 Anti-Tampering Accountability Controls
            </h3>
            <p>
              1. No silent deletion of mortality/feed/finance logs · 2. Dual confirmation between Storekeeper & Keeper · 3. 4-digit PIN signatures · 4. Timestamped server audit trails · 5. Photo/GPS evidence · 6. Manager approval for treatments/transfers/harvests · 7. Daily stock & feed variance reconciliation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-bold text-slate-900">
        System Settings — Offline-First Sync, Low-Data Mode & Backups
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              {state.offlineMode ? (
                <WifiOff className="h-4 w-4 text-amber-600" />
              ) : (
                <Wifi className="h-4 w-4 text-emerald-600" />
              )}
              Offline Field Operation Mode
            </div>
            <button
              type="button"
              onClick={onToggleOffline}
              className={`rounded-lg px-3 py-1.5 font-semibold text-white ${
                state.offlineMode ? 'bg-amber-600' : 'bg-emerald-600'
              }`}
            >
              {state.offlineMode ? 'Offline (Local Queue)' : 'Online (Live Sync)'}
            </button>
          </div>
          <p className="mt-2 text-slate-600">
            Queued local transactions: <strong className="tabular-nums">{state.pendingSyncQueue.length}</strong>
          </p>
          {state.pendingSyncQueue.length > 0 && (
            <button
              type="button"
              onClick={onSyncNow}
              className="mt-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Synchronize Queued Records Now
            </button>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 p-4 text-xs">
          <div className="font-bold text-slate-900">Tanzania Traceability Backup</div>
          <p className="mt-1 text-slate-600">
            Export complete batch, feeding, and TZS ledger records as CSV for offline archiving.
          </p>
          <button
            type="button"
            onClick={() => {
              onExportAll();
              exportToCsv(
                `dukaaqusmart-full-backup-${todayIso()}.csv`,
                ['Pond', 'Species', 'Current Fish', 'Max Capacity', 'Status'],
                state.ponds.map((p) => [p.code, p.species, p.currentFish, p.maxCapacity, p.status])
              );
            }}
            className="mt-3 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Download Backup CSV
          </button>
        </div>
      </div>
    </div>
  );
};
