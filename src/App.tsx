import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  LayoutDashboard,
  Waves,
  Fish,
  Utensils,
  Droplets,
  HeartPulse,
  ShoppingBag,
  Package,
  BarChart3,
  Users,
  Bell,
  Bot,
  Settings,
  HelpCircle,
  LogOut,
  Calendar,
  MapPin,
  Maximize2,
  Minimize2,
  ChevronDown,
  Menu,
  X,
  ShieldCheck,
  TrendingUp,
  Leaf,
  CheckCircle2,
  Sun,
  Moon,
  Monitor,
  Plus,
  WifiOff,
  RefreshCw,
  RotateCcw,
  Boxes,
} from 'lucide-react';
import { DURATIONS, EASE_OUT, SPRING_SNAPPY, fadeUp, usePreferences } from './ui';
import {
  AquacultureState,
  Customer,
  HarvestLot,
  Language,
  NavSection,
  Payment,
  PaymentMethod,
  Pond,
  PreOrder,
  PriceListItem,
  Sale,
  SaleLine,
} from './types/aquaculture';
import { ASSET_IMAGES, INITIAL_STATE } from './data/seedData';
import { TRANSLATIONS } from './i18n/translations';
import { nowTimestamp, todayIso } from './utils/formatters';
import { getPermissions } from './utils/rbac';
import {
  formatInvoiceNo,
  formatLotCode,
  getCustomerOutstandingBalance,
  getLotRemainingForGrade,
  migrateAquacultureState,
  normalizeTzPhone,
  roundKg,
  roundTzs,
} from './utils/sales';
import { DashboardView } from './components/DashboardView';
import {
  AddInventoryPayload,
  PondQrModal,
  QuickActionModals,
  QuickActionType,
} from './components/QuickActionModals';
import { FarmPondsModule } from './components/modules/FarmPondsModule';
import { FishSpeciesModule } from './components/modules/FishSpeciesModule';
import {
  FishStockModule,
  ManualPondStockPayload,
  ManualStockLotPayload,
} from './components/modules/FishStockModule';
import {
  FeedingModule,
  FishHealthModule,
  WaterQualityModule,
} from './components/modules/FeedingWaterHealthModule';
import {
  EmployeesAccountabilityModule,
  FinanceReportsModule,
  InventoryModule,
  SettingsHelpModule,
  TasksAlertsModule,
} from './components/modules/CommerceAccountabilityModule';
import { SalesModule } from './components/sales/SalesModule';
import {
  QuickSaleFlow,
  QuickSaleSubmitPayload,
  QuickSaleSubmitResult,
} from './components/sales/QuickSaleFlow';
import { InvoiceReceiptModal } from './components/sales/InvoiceReceiptModal';
import { AquaIntelligenceView } from './components/modules/AquaIntelligenceView';

const STORAGE_KEY = 'dukaaqusmart_state_v1';

export default function App() {
  const [state, setState] = useState<AquacultureState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<AquacultureState>;
        return migrateAquacultureState(parsed, INITIAL_STATE);
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_STATE;
  });

  const [activeNav, setActiveNav] = useState<NavSection>('dashboard');
  const [language, setLanguage] = useState<Language>('en');
  const [selectedFarmId, setSelectedFarmId] = useState<string>('farm-dsm');
  const [quickAction, setQuickAction] = useState<QuickActionType>(null);
  const [inventoryInitialItemId, setInventoryInitialItemId] = useState<string | null>(null);
  const [harvestInitialPondCode, setHarvestInitialPondCode] = useState<string | null>(null);
  const [quickSaleOpen, setQuickSaleOpen] = useState(false);
  const [quickSaleInitialLotId, setQuickSaleInitialLotId] = useState<string | undefined>(undefined);
  const [quickSaleInitialPondCode, setQuickSaleInitialPondCode] = useState<string | undefined>(undefined);
  const [quickSalePreOrder, setQuickSalePreOrder] = useState<PreOrder | null>(null);
  const [activeReceiptSaleId, setActiveReceiptSaleId] = useState<string | null>(null);
  const [selectedPondQr, setSelectedPondQr] = useState<Pond | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [toastState, setToastState] = useState<{
    id: number;
    message: string;
    undoSnapshot?: AquacultureState;
    undoCloseReceipt?: boolean;
  } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const inFlightSaleKeysRef = useRef<Set<string>>(new Set());
  const committedSaleKeysRef = useRef<Set<string>>(new Set());

  const { themeMode, cycleThemeMode, effectiveReducedMotion, triggerHaptic } = usePreferences();

  const activeReceiptSale =
    activeReceiptSaleId ? state.sales.find((s) => s.id === activeReceiptSaleId) || null : null;

  const openQuickSaleModal = (opts?: { lotId?: string; pondCode?: string; preOrder?: PreOrder }) => {
    setFabOpen(false);
    setQuickSaleInitialLotId(opts?.lotId);
    setQuickSaleInitialPondCode(opts?.pondCode);
    setQuickSalePreOrder(opts?.preOrder || null);
    setQuickSaleOpen(true);
  };

  const openInventoryModal = (itemId?: string | null) => {
    setFabOpen(false);
    setInventoryInitialItemId(itemId || null);
    setQuickAction('inventory');
  };

  const openHarvestModal = (pondCode?: string | null) => {
    setFabOpen(false);
    setHarvestInitialPondCode(pondCode || null);
    setQuickAction('harvest');
  };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore quota errors
    }
  }, [state]);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const showToast = (
    message: string,
    opts?: { undoSnapshot?: AquacultureState; undoCloseReceipt?: boolean }
  ) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    const id = Date.now();
    setToastState({
      id,
      message,
      undoSnapshot: opts?.undoSnapshot,
      undoCloseReceipt: opts?.undoCloseReceipt,
    });
    toastTimerRef.current = window.setTimeout(() => {
      setToastState(null);
    }, opts?.undoSnapshot ? 5500 : 3500);
  };

  const handleUndoToast = () => {
    if (!toastState?.undoSnapshot) return;
    setState(toastState.undoSnapshot);
    if (toastState.undoCloseReceipt) {
      setActiveReceiptSaleId(null);
    }
    triggerHaptic(8);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToastState({ id: Date.now(), message: TRANSLATIONS[language].ui.undone });
    toastTimerRef.current = window.setTimeout(() => setToastState(null), 2400);
  };

  const handleSyncNow = () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncProgress(25);
    window.setTimeout(() => setSyncProgress(72), 240);
    window.setTimeout(() => {
      setSyncProgress(100);
      setState((prev) => ({ ...prev, pendingSyncQueue: [] }));
      triggerHaptic(10);
      showToast('All queued farm records synced.');
      window.setTimeout(() => {
        setIsSyncing(false);
        setSyncProgress(0);
      }, 220);
    }, 620);
  };

  const t = TRANSLATIONS[language];
  const lowStockCount = state.inventory.filter((i) => i.status !== 'In Stock').length + 1;
  const openTasksAlertsCount =
    state.tasks.filter((tk) => tk.status === 'Pending').length +
    state.alerts.filter((al) => !al.acknowledged).length;

  const prevAlertsCountRef = useRef<number>(openTasksAlertsCount);
  const [bellPulseKey, setBellPulseKey] = useState(0);

  useEffect(() => {
    if (openTasksAlertsCount > prevAlertsCountRef.current) {
      setBellPulseKey((k) => k + 1);
    }
    prevAlertsCountRef.current = openTasksAlertsCount;
  }, [openTasksAlertsCount]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // --- STATE MUTATION HANDLERS WITH AUDIT LOGS & ACCOUNTABILITY ---
  const handleSwitchUser = (empId: string) => {
    const emp = state.employees.find((e) => e.id === empId);
    if (!emp) return;
    setState((prev) => ({
      ...prev,
      activeUser: emp,
      auditLogs: [
        {
          id: `aud-${Date.now()}`,
          timestamp: nowTimestamp(),
          actorName: emp.name,
          actorRole: emp.role,
          module: 'Auth & RBAC',
          action: 'Active Persona Switched',
          details: `Switched session to ${emp.name} (${emp.roleLabel}).`,
          pinVerified: true,
        },
        ...prev.auditLogs,
      ],
    }));
    setRoleMenuOpen(false);
    showToast(`Switched active role to ${emp.name} (${emp.roleLabel})`);
  };

  const handleRecordFeeding = (payload: {
    pondCode: string;
    batchCode: string;
    feedType: string;
    approvedKg: number;
    issuedKg: number;
    actualFedKg: number;
    pin: string;
  }) => {
    if (payload.pin !== state.activeUser.pin) {
      return { ok: false, error: 'Invalid 4-digit PIN. Please check your PIN and try again.' };
    }
    const prevSnapshot = state;
    const variance = Number(Math.abs(payload.issuedKg - payload.actualFedKg).toFixed(2));
    const varianceFlagged = variance > 0.5;

    setState((prev) => ({
      ...prev,
      feedIssuances: [
        {
          id: `feed-${Date.now()}`,
          date: todayIso(),
          time: new Date().toTimeString().slice(0, 5),
          pondCode: payload.pondCode,
          batchCode: payload.batchCode,
          feedType: payload.feedType,
          approvedKg: payload.approvedKg,
          issuedByStorekeeperKg: payload.issuedKg,
          confirmedReceivedKg: payload.issuedKg,
          actualFedKg: payload.actualFedKg,
          varianceKg: variance,
          varianceFlagged,
          approvedBy: 'John M. Mwakasege',
          storekeeper: 'Grace M. Shayo',
          keeper: prev.activeUser.name,
          status: varianceFlagged ? 'Variance Flagged' : 'Fed & Reconciled',
          signedPinHash: `SIGNED-${prev.activeUser.id}-${Date.now()}`,
        },
        ...prev.feedIssuances,
      ],
      inventory: prev.inventory.map((item) => {
        if (item.category === 'Feed' && item.name.toLowerCase().includes('grower')) {
          const nextStock = Math.max(0, item.stock - payload.actualFedKg);
          return {
            ...item,
            stock: nextStock,
            status: nextStock <= item.reorderLevel ? 'Low Stock' : 'In Stock',
          };
        }
        return item;
      }),
      activities: [
        {
          id: `act-${Date.now()}`,
          kind: 'feeding',
          title: `Feeding recorded – ${payload.pondCode}`,
          subtitle: `${payload.actualFedKg} kg by ${prev.activeUser.name}`,
          timeAgo: 'Just now',
        },
        ...prev.activities,
      ],
      alerts: varianceFlagged
        ? [
            {
              id: `alt-${Date.now()}`,
              severity: 'High',
              title: `${payload.pondCode}: Feed variance (${variance} kg)`,
              detail: `Issued ${payload.issuedKg} kg vs fed ${payload.actualFedKg} kg`,
              pondCode: payload.pondCode,
              timeAgo: 'Just now',
              acknowledged: false,
            },
            ...prev.alerts,
          ]
        : prev.alerts,
      auditLogs: [
        {
          id: `aud-${Date.now()}`,
          timestamp: nowTimestamp(),
          actorName: prev.activeUser.name,
          actorRole: prev.activeUser.role,
          module: 'Feeding Management',
          action: varianceFlagged ? 'Feeding Recorded (Variance Flagged)' : 'Feeding Recorded & Reconciled',
          details: `${payload.pondCode}: Issued ${payload.issuedKg} kg, Fed ${payload.actualFedKg} kg (Variance ${variance} kg).`,
          pinVerified: true,
        },
        ...prev.auditLogs,
      ],
    }));
    triggerHaptic(10);
    showToast(`Feeding logged for ${payload.pondCode} (${payload.actualFedKg} kg).`, {
      undoSnapshot: prevSnapshot,
    });
    return { ok: true };
  };

  const handleAddInventory = (payload: AddInventoryPayload) => {
    const totalCost = Math.round(payload.quantity * payload.unitCostTzs);
    const finCategory =
      payload.category === 'Feed'
        ? ('Feed Purchase' as const)
        : payload.category === 'Fingerlings'
          ? ('Fingerling Purchase' as const)
          : payload.category === 'Medicine'
            ? ('Medicine & Treatments' as const)
            : payload.category === 'Fuel'
              ? ('Fuel & Electricity' as const)
              : ('Equipment Maintenance' as const);
    const finPaymentStatus =
      payload.paymentStatus === 'Paid'
        ? ('Paid' as const)
        : payload.paymentStatus === 'Partial'
          ? ('Partial' as const)
          : ('Pending Debt' as const);

    const prevSnapshot = state;
    setState((prev) => {
      const existing =
        (payload.existingItemId
          ? prev.inventory.find((i) => i.id === payload.existingItemId)
          : undefined) ||
        prev.inventory.find((i) => i.name.toLowerCase() === payload.name.toLowerCase());

      const newItemId = existing?.id || `inv-${Date.now()}`;
      const updatedInventory = existing
        ? prev.inventory.map((i) => {
            if (i.id !== existing.id) return i;
            const nextStock = i.stock + payload.quantity;
            const nextReorder = payload.reorderLevel >= 0 ? payload.reorderLevel : i.reorderLevel;
            return {
              ...i,
              name: payload.name,
              sku: payload.sku || i.sku,
              category: payload.category,
              stock: nextStock,
              unit: payload.unit,
              reorderLevel: nextReorder,
              unitCostTzs: payload.unitCostTzs,
              batchOrLot: payload.lotNumber,
              expiryDate: payload.expiryDate || i.expiryDate,
              supplier: payload.supplier,
              lastRestockedDate: payload.purchaseDate,
              notes: payload.notes || i.notes,
              status: nextStock <= nextReorder ? ('Low Stock' as const) : ('In Stock' as const),
            };
          })
        : [
            {
              id: newItemId,
              sku: payload.sku || `SKU-${Date.now().toString().slice(-4)}`,
              name: payload.name,
              category: payload.category,
              stock: payload.quantity,
              unit: payload.unit,
              reorderLevel: payload.reorderLevel,
              unitCostTzs: payload.unitCostTzs,
              batchOrLot: payload.lotNumber,
              expiryDate: payload.expiryDate,
              supplier: payload.supplier,
              lastRestockedDate: payload.purchaseDate,
              notes: payload.notes,
              status:
                payload.quantity <= payload.reorderLevel ? ('Low Stock' as const) : ('In Stock' as const),
            },
            ...prev.inventory,
          ];

      return {
        ...prev,
        inventory: updatedInventory,
        stockPurchases: [
          {
            id: `pur-${Date.now()}`,
            itemId: newItemId,
            date: payload.purchaseDate,
            itemName: payload.name,
            category: payload.category,
            quantity: payload.quantity,
            unit: payload.unit,
            unitCostTzs: payload.unitCostTzs,
            totalCostTzs: totalCost,
            paidAmountTzs: payload.paidAmountTzs,
            supplier: payload.supplier,
            supplierPhone: payload.supplierPhone,
            invoiceNo: payload.invoiceNo,
            lotNumber: payload.lotNumber,
            expiryDate: payload.expiryDate,
            paymentStatus: payload.paymentStatus,
            recordedBy: prev.activeUser.name,
            notes: payload.notes,
          },
          ...(prev.stockPurchases || []),
        ],
        finances: [
          {
            id: `fin-${Date.now()}`,
            date: payload.purchaseDate,
            type: 'Expense',
            category: finCategory,
            description: `${existing ? 'Restocked' : 'New item'} – ${payload.name} (${payload.quantity} ${payload.unit})${
              payload.invoiceNo ? ` · Inv ${payload.invoiceNo}` : ''
            }`,
            amountTzs: totalCost,
            counterparty: payload.supplier,
            paymentStatus: finPaymentStatus,
          },
          ...prev.finances,
        ],
        activities: [
          {
            id: `act-${Date.now()}`,
            kind: 'purchase',
            title: `${existing ? 'Restocked' : 'Purchase added'} – ${payload.name}`,
            subtitle: `${payload.quantity} ${payload.unit} (${formatTzsInline(totalCost)}) from ${payload.supplier}`,
            timeAgo: 'Just now',
          },
          ...prev.activities,
        ],
        auditLogs: [
          {
            id: `aud-${Date.now()}`,
            timestamp: nowTimestamp(),
            actorName: prev.activeUser.name,
            actorRole: prev.activeUser.role,
            module: 'Inventory & Procurement',
            action: existing ? 'Existing Inventory Restocked' : 'New Inventory Product Purchased',
            details: `${payload.name} (+${payload.quantity} ${payload.unit} @ TZS ${payload.unitCostTzs.toLocaleString()}) from ${payload.supplier}. Lot: ${payload.lotNumber}. Status: ${payload.paymentStatus}.`,
            pinVerified: false,
          },
          ...prev.auditLogs,
        ],
      };
    });
    triggerHaptic(10);
    showToast(
      `Saved ${payload.quantity} ${payload.unit} of ${payload.name} (${payload.paymentStatus}).`,
      { undoSnapshot: prevSnapshot }
    );
  };

  const handleRecordWater = (payload: {
    pondCode: string;
    ph: number;
    doVal: number;
    temp: number;
    ammonia: number;
    nitrite: number;
    sourceLevel: 'Manual (Mobile)' | 'Bluetooth Meter' | 'IoT ESP32 Sensor';
    instrument: string;
  }) => {
    const lowDo = payload.doVal < 4.5 || payload.ammonia > 0.05;
    setState((prev) => ({
      ...prev,
      waterReadings: [
        {
          id: `wq-${Date.now()}`,
          pondCode: payload.pondCode,
          farmId: 'farm-dsm',
          timestamp: nowTimestamp().slice(0, 16),
          ph: payload.ph,
          dissolvedOxygen: payload.doVal,
          temperature: payload.temp,
          ammonia: payload.ammonia,
          nitrite: payload.nitrite,
          transparencyCm: 34,
          waterLevelPct: 95,
          sourceLevel: payload.sourceLevel,
          instrument: payload.instrument,
          recordedBy: prev.activeUser.name,
          status: lowDo ? 'Attention' : 'Safe',
          aeratorTriggered: payload.doVal < 4.5,
        },
        ...prev.waterReadings,
      ],
      ponds: prev.ponds.map((p) =>
        p.code === payload.pondCode
          ? {
              ...p,
              status: lowDo ? 'Attention' : p.currentFish > 0 ? 'Healthy' : 'Preparing',
              aeratorRelayOn: payload.doVal < 4.5 ? true : p.aeratorRelayOn,
            }
          : p
      ),
      activities: [
        {
          id: `act-${Date.now()}`,
          kind: 'water',
          title: `Water quality updated – ${payload.pondCode}`,
          subtitle: `pH: ${payload.ph}, DO: ${payload.doVal} mg/L`,
          timeAgo: 'Just now',
        },
        ...prev.activities,
      ],
      alerts: lowDo
        ? [
            {
              id: `alt-${Date.now()}`,
              severity: 'High',
              title: `${payload.pondCode}: Low DO (${payload.doVal} mg/L)`,
              detail: 'Aerator relay triggered automatically — inspect aeration',
              pondCode: payload.pondCode,
              timeAgo: 'Just now',
              acknowledged: false,
            },
            ...prev.alerts,
          ]
        : prev.alerts,
    }));
    showToast(`Water quality recorded for ${payload.pondCode}.`);
  };

  const handleReportMortality = (payload: {
    pondCode: string;
    deadCount: number;
    affectedCount: number;
    symptoms: string;
    pin: string;
  }) => {
    const perms = getPermissions(state.activeUser.role);
    if (!perms.canReportMortality) {
      return { ok: false, error: `Role ${state.activeUser.roleLabel} does not report pond mortality.` };
    }
    if (payload.pin !== state.activeUser.pin) {
      return { ok: false, error: 'Invalid 4-digit PIN. Please check your PIN and try again.' };
    }
    const batch = state.batches.find((b) => b.pondCode === payload.pondCode);
    const wq = state.waterReadings.find((w) => w.pondCode === payload.pondCode);

    setState((prev) => ({
      ...prev,
      healthIncidents: [
        {
          id: `hlth-${Date.now()}`,
          pondCode: payload.pondCode,
          batchCode: batch?.batchCode || 'UNASSIGNED',
          dateTime: nowTimestamp().slice(0, 16),
          deadCount: payload.deadCount,
          affectedCount: payload.affectedCount,
          symptoms: payload.symptoms,
          waterSnapshot: wq
            ? `DO ${wq.dissolvedOxygen} mg/L, Temp ${wq.temperature}°C, pH ${wq.ph}`
            : 'Snapshot pending',
          reportedBy: prev.activeUser.name,
          status: 'Reported',
          lockedDeletion: true,
        },
        ...prev.healthIncidents,
      ],
      ponds: prev.ponds.map((p) =>
        p.code === payload.pondCode
          ? {
              ...p,
              currentFish: Math.max(0, p.currentFish - payload.deadCount),
              status: payload.deadCount >= 10 ? 'Attention' : p.status,
            }
          : p
      ),
      batches: prev.batches.map((b) =>
        b.pondCode === payload.pondCode
          ? {
              ...b,
              currentEstimatedFish: Math.max(0, b.currentEstimatedFish - payload.deadCount),
              totalMortality: b.totalMortality + payload.deadCount,
            }
          : b
      ),
      activities: [
        {
          id: `act-${Date.now()}`,
          kind: 'mortality',
          title: `Mortality reported – ${payload.pondCode}`,
          subtitle: `${payload.deadCount} fish logged by ${prev.activeUser.name}`,
          timeAgo: 'Just now',
        },
        ...prev.activities,
      ],
      auditLogs: [
        {
          id: `aud-${Date.now()}`,
          timestamp: nowTimestamp(),
          actorName: prev.activeUser.name,
          actorRole: prev.activeUser.role,
          module: 'Fish Health',
          action: 'Immutable Mortality Record Logged',
          details: `${payload.pondCode}: ${payload.deadCount} dead fish recorded. Deletion permanently locked.`,
          pinVerified: true,
        },
        ...prev.auditLogs,
      ],
    }));
    showToast(`Mortality logged for ${payload.pondCode}. Deletion locked for accountability.`);
    return { ok: true };
  };

  const handleRecordHarvest = (payload: {
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
  }): { ok: boolean; lotId?: string; error?: string } => {
    const perms = getPermissions(state.activeUser.role);
    if (!perms.canApproveHarvest) {
      return {
        ok: false,
        error: `Role ${state.activeUser.roleLabel} cannot approve harvests. Switch to Owner or Farm Manager.`,
      };
    }
    if (payload.pin !== state.activeUser.pin) {
      return { ok: false, error: 'Invalid 4-digit PIN. Please check your PIN and try again.' };
    }

    const pond = state.ponds.find((p) => p.code === payload.pondCode);
    if (!pond) {
      return { ok: false, error: 'Selected pond was not found.' };
    }

    const totalCount =
      Math.max(0, Math.round(payload.largeCount)) +
      Math.max(0, Math.round(payload.mediumCount)) +
      Math.max(0, Math.round(payload.smallCount));
    const totalKg = roundKg(
      Math.max(0, payload.largeKg) + Math.max(0, payload.mediumKg) + Math.max(0, payload.smallKg)
    );
    const damagedKg = roundKg(Math.max(0, payload.damagedKg || 0));

    if (totalKg <= 0 || totalCount <= 0) {
      return { ok: false, error: 'Enter graded fish counts and weights greater than 0.' };
    }
    if (totalCount > pond.currentFish) {
      return {
        ok: false,
        error: `Harvest count (${totalCount.toLocaleString()}) exceeds live fish in ${pond.code} (${pond.currentFish.toLocaleString()}).`,
      };
    }

    const batch = state.batches.find(
      (b) => b.pondCode === payload.pondCode && b.status !== 'Completed'
    ) || state.batches.find((b) => b.pondCode === payload.pondCode);

    const lotId = `lot-${Date.now()}`;
    const lotCode = formatLotCode(state.harvestLots.length + 1, todayIso());
    const newLot: HarvestLot = {
      id: lotId,
      lotCode,
      date: todayIso(),
      pondCode: payload.pondCode,
      batchCode: batch?.batchCode || 'UNASSIGNED',
      species: pond.species,
      grades: {
        largeKg: roundKg(payload.largeKg),
        largeCount: Math.round(payload.largeCount),
        mediumKg: roundKg(payload.mediumKg),
        mediumCount: Math.round(payload.mediumCount),
        smallKg: roundKg(payload.smallKg),
        smallCount: Math.round(payload.smallCount),
        damagedKg,
      },
      remainingKg: {
        large: roundKg(payload.largeKg),
        medium: roundKg(payload.mediumKg),
        small: roundKg(payload.smallKg),
      },
      remainingCount: {
        large: Math.round(payload.largeCount),
        medium: Math.round(payload.mediumCount),
        small: Math.round(payload.smallCount),
      },
      approvedBy: prevUserName(state),
      notes: payload.notes.trim() || undefined,
    };

    const prevSnapshot = state;
    setState((prev) => ({
      ...prev,
      harvestLots: [newLot, ...prev.harvestLots],
      ponds: prev.ponds.map((p) => {
        if (p.code !== payload.pondCode) return p;
        const nextFish = Math.max(0, p.currentFish - totalCount);
        return {
          ...p,
          currentFish: nextFish,
          status: nextFish === 0 ? 'Preparing' : p.status,
          readinessPct: nextFish === 0 ? 0 : p.readinessPct,
        };
      }),
      batches: prev.batches.map((b) => {
        if (batch && b.id !== batch.id) return b;
        if (!batch && b.pondCode !== payload.pondCode) return b;
        const remaining = Math.max(0, b.currentEstimatedFish - totalCount);
        const nextStatus = remaining === 0 ? ('Completed' as const) : ('Partial Harvest' as const);
        return {
          ...b,
          currentEstimatedFish: remaining,
          status: nextStatus,
          history: [
            ...b.history,
            {
              id: `ev-${Date.now()}`,
              step: b.history.length + 1,
              title: `${nextStatus} (${lotCode})`,
              detail: `Harvested ${totalCount.toLocaleString()} fish (${totalKg.toFixed(1)} kg graded into chilled lot ${lotCode}; ${remaining.toLocaleString()} remaining in pond).`,
              date: todayIso(),
              actor: prev.activeUser.name,
            },
          ],
        };
      }),
      activities: [
        {
          id: `act-${Date.now()}`,
          kind: 'harvest',
          title: `Harvest lot ${lotCode} graded – ${payload.pondCode}`,
          subtitle: `${totalKg.toFixed(1)} kg (${totalCount.toLocaleString()} fish) ready for sales`,
          timeAgo: 'Just now',
        },
        ...prev.activities,
      ],
      auditLogs: [
        {
          id: `aud-${Date.now()}`,
          timestamp: nowTimestamp(),
          actorName: prev.activeUser.name,
          actorRole: prev.activeUser.role,
          module: 'Harvest & Sales',
          action: 'Harvest Lot Graded & Stocked',
          details: `${lotCode} (${payload.pondCode}): ${totalCount.toLocaleString()} fish (${totalKg.toFixed(1)} kg + ${damagedKg} kg damaged). Ready for multi-customer dispatch.`,
          pinVerified: true,
        },
        ...prev.auditLogs,
      ],
    }));
    triggerHaptic(10);
    showToast(`Harvest lot ${lotCode} saved (${totalKg.toFixed(1)} kg ready to sell).`, {
      undoSnapshot: prevSnapshot,
    });
    return { ok: true, lotId };
  };

  // --- FISH STOCK MODULE HANDLERS (MANUAL LOT + POND STOCKING) ---
  const handleCreateManualStockLot = (
    payload: ManualStockLotPayload
  ): { ok: boolean; lotId?: string; error?: string } => {
    const perms = getPermissions(state.activeUser.role);
    if (!perms.canApproveHarvest && !perms.canRecordSale) {
      return {
        ok: false,
        error: `Role ${state.activeUser.roleLabel} cannot create manual fish stock lots.`,
      };
    }
    if (payload.pin !== state.activeUser.pin) {
      return { ok: false, error: 'Invalid 4-digit approval PIN.' };
    }

    const totalCount =
      Math.max(0, Math.round(payload.largeCount)) +
      Math.max(0, Math.round(payload.mediumCount)) +
      Math.max(0, Math.round(payload.smallCount));
    const totalKg = roundKg(
      Math.max(0, payload.largeKg) + Math.max(0, payload.mediumKg) + Math.max(0, payload.smallKg)
    );
    if (totalKg <= 0) {
      return { ok: false, error: 'Enter graded stock weight greater than 0 kg.' };
    }

    const sourcePond =
      payload.pondCode !== 'EXTERNAL'
        ? state.ponds.find((p) => p.code === payload.pondCode)
        : undefined;
    if (payload.deductFromPond && sourcePond && totalCount > sourcePond.currentFish) {
      return {
        ok: false,
        error: `Fish count (${totalCount.toLocaleString()}) exceeds live fish in ${sourcePond.code} (${sourcePond.currentFish.toLocaleString()}).`,
      };
    }

    const lotId = `lot-man-${Date.now()}`;
    const lotCode = formatLotCode(state.harvestLots.length + 1, todayIso());
    const newLot: HarvestLot = {
      id: lotId,
      lotCode,
      date: todayIso(),
      pondCode: payload.pondCode,
      batchCode: payload.batchCode || 'MANUAL',
      species: payload.species,
      source: 'Manual Stock',
      grades: {
        largeKg: roundKg(payload.largeKg),
        largeCount: Math.round(payload.largeCount),
        mediumKg: roundKg(payload.mediumKg),
        mediumCount: Math.round(payload.mediumCount),
        smallKg: roundKg(payload.smallKg),
        smallCount: Math.round(payload.smallCount),
        damagedKg: 0,
      },
      remainingKg: {
        large: roundKg(payload.largeKg),
        medium: roundKg(payload.mediumKg),
        small: roundKg(payload.smallKg),
      },
      remainingCount: {
        large: Math.round(payload.largeCount),
        medium: Math.round(payload.mediumCount),
        small: Math.round(payload.smallCount),
      },
      approvedBy: state.activeUser.name,
      notes: payload.notes || 'Manual stock entry',
    };

    const prevSnapshot = state;
    setState((prev) => ({
      ...prev,
      harvestLots: [newLot, ...prev.harvestLots],
      ponds:
        payload.deductFromPond && sourcePond && totalCount > 0
          ? prev.ponds.map((p) => {
              if (p.code !== sourcePond.code) return p;
              const nextFish = Math.max(0, p.currentFish - totalCount);
              return {
                ...p,
                currentFish: nextFish,
                status: nextFish === 0 ? 'Preparing' : p.status,
              };
            })
          : prev.ponds,
      batches:
        payload.deductFromPond && sourcePond && totalCount > 0
          ? prev.batches.map((b) => {
              if (b.pondCode !== sourcePond.code || b.status === 'Completed') return b;
              const rem = Math.max(0, b.currentEstimatedFish - totalCount);
              return {
                ...b,
                currentEstimatedFish: rem,
                status: rem === 0 ? ('Completed' as const) : ('Partial Harvest' as const),
              };
            })
          : prev.batches,
      activities: [
        {
          id: `act-${Date.now()}`,
          kind: 'harvest',
          title: `Manual fish stock ${lotCode} added`,
          subtitle: `${totalKg.toFixed(1)} kg ${payload.species} (${payload.pondCode})`,
          timeAgo: 'Just now',
        },
        ...prev.activities,
      ],
      auditLogs: [
        {
          id: `aud-${Date.now()}`,
          timestamp: nowTimestamp(),
          actorName: prev.activeUser.name,
          actorRole: prev.activeUser.role,
          module: 'Fish Stock Control',
          action: 'Manual Graded Stock Lot Created',
          details: `${lotCode}: ${totalKg.toFixed(1)} kg ${payload.species} from ${payload.pondCode}${
            payload.deductFromPond && totalCount > 0 ? ` (deducted ${totalCount} fish)` : ''
          }.`,
          pinVerified: true,
        },
        ...prev.auditLogs,
      ],
    }));

    triggerHaptic(10);
    showToast(`Manual stock lot ${lotCode} saved (${totalKg.toFixed(1)} kg).`, {
      undoSnapshot: prevSnapshot,
    });
    return { ok: true, lotId };
  };

  const handleRegisterPondStock = (
    payload: ManualPondStockPayload
  ): { ok: boolean; error?: string } => {
    const pond = state.ponds.find((p) => p.code === payload.pondCode);
    if (!pond) return { ok: false, error: 'Selected pond was not found.' };
    if (pond.currentFish + payload.fishCount > pond.maxCapacity) {
      return {
        ok: false,
        error: `Capacity guard: ${pond.code} max capacity is ${pond.maxCapacity.toLocaleString()} fish (available space: ${(
          pond.maxCapacity - pond.currentFish
        ).toLocaleString()}).`,
      };
    }

    const sp = state.speciesCatalogue.find((s) => s.commonName === payload.species);
    const codePrefix = payload.species.toLowerCase().includes('catfish') ? 'CAT' : 'TIL';
    const batchCode = `${codePrefix}-2026-${String(state.batches.length + 1).padStart(3, '0')}`;
    const prevSnapshot = state;

    setState((prev) => ({
      ...prev,
      ponds: prev.ponds.map((p) =>
        p.id === pond.id
          ? {
              ...p,
              species: payload.species,
              currentFish: p.currentFish + payload.fishCount,
              status: 'Healthy',
              readinessPct: Math.max(p.readinessPct, 25),
            }
          : p
      ),
      batches: [
        {
          id: `batch-${Date.now()}`,
          batchCode,
          species: payload.species,
          scientificName: sp?.scientificName || 'Oreochromis niloticus',
          sourceHatchery: payload.sourceHatchery || 'Farm Hatchery Stock',
          supplier: payload.supplier || 'Internal Stocking',
          pondId: pond.id,
          pondCode: pond.code,
          initialStocking: payload.fishCount,
          currentEstimatedFish: payload.fishCount,
          physicallyVerifiedFish: payload.fishCount,
          lastVerifiedDate: todayIso(),
          avgInitialWeightG: payload.avgWeightG,
          currentAvgWeightG: payload.avgWeightG,
          stockingDate: todayIso(),
          plannedHarvestDate: '2027-05-15',
          responsibleKeeper: prev.activeUser.name,
          status: 'Growing',
          feedConsumedKg: 0,
          totalMortality: 0,
          history: [
            {
              id: `ev-${Date.now()}`,
              step: 1,
              title: 'Live pond stock registered',
              detail: `${payload.fishCount.toLocaleString()} ${payload.species} (${payload.avgWeightG}g avg) stocked into ${pond.code}${
                payload.notes ? ` — ${payload.notes}` : ''
              }.`,
              date: todayIso(),
              actor: prev.activeUser.name,
            },
          ],
        },
        ...prev.batches,
      ],
      activities: [
        {
          id: `act-${Date.now()}`,
          kind: 'purchase',
          title: `Pond stock added – ${pond.code}`,
          subtitle: `+${payload.fishCount.toLocaleString()} ${payload.species} (${payload.avgWeightG}g avg)`,
          timeAgo: 'Just now',
        },
        ...prev.activities,
      ],
      auditLogs: [
        {
          id: `aud-${Date.now()}`,
          timestamp: nowTimestamp(),
          actorName: prev.activeUser.name,
          actorRole: prev.activeUser.role,
          module: 'Fish Stock Control',
          action: 'Live Pond Fish Stocked',
          details: `Added ${payload.fishCount.toLocaleString()} ${payload.species} (${payload.avgWeightG}g avg) to ${pond.code} as batch ${batchCode}.`,
          pinVerified: false,
        },
        ...prev.auditLogs,
      ],
    }));

    triggerHaptic(10);
    showToast(`Added ${payload.fishCount.toLocaleString()} fish to ${pond.code} (${batchCode}).`, {
      undoSnapshot: prevSnapshot,
    });
    return { ok: true };
  };

  // --- SALES & CUSTOMERS HANDLERS (PHASE 1) ---
  const handleQuickCreateCustomer = (payload: {
    name: string;
    phone: string;
  }): { ok: boolean; customer?: Customer; error?: string } => {
    const normalized = normalizeTzPhone(payload.phone);
    if (!payload.name.trim()) {
      return { ok: false, error: 'Customer name is required.' };
    }
    if (!normalized) {
      return { ok: false, error: 'Valid Tanzania phone required (e.g. 255712345678).' };
    }
    const existing = state.customers.find((c) => c.phone === normalized);
    if (existing) {
      return { ok: true, customer: existing };
    }
    const customer: Customer = {
      id: `cust-${Date.now()}`,
      name: payload.name.trim(),
      phone: normalized,
      type: 'Individual',
      location: 'Dar es Salaam',
      priceTier: 'Standard',
      creditLimitTzs: 500000,
      paymentTermsDays: 7,
      notes: 'Quick-added during field sale',
      createdAt: todayIso(),
    };
    setState((prev) => ({
      ...prev,
      customers: [customer, ...prev.customers],
    }));
    showToast(`Added customer ${customer.name}`);
    return { ok: true, customer };
  };

  const handleAddCustomer = (
    payload: Omit<Customer, 'id' | 'createdAt'>
  ): { ok: boolean; error?: string } => {
    const perms = getPermissions(state.activeUser.role);
    if (!perms.canManageCustomers && !perms.canRecordSale) {
      return { ok: false, error: 'Your role cannot register customers.' };
    }
    const normalized = normalizeTzPhone(payload.phone);
    if (!normalized) {
      return { ok: false, error: 'Valid Tanzania phone required (255XXXXXXXXX).' };
    }
    if (state.customers.some((c) => c.phone === normalized)) {
      return { ok: false, error: 'A customer with this phone number already exists.' };
    }
    const newCust: Customer = {
      ...payload,
      phone: normalized,
      id: `cust-${Date.now()}`,
      createdAt: todayIso(),
    };
    setState((prev) => ({
      ...prev,
      customers: [newCust, ...prev.customers],
      auditLogs: [
        {
          id: `aud-${Date.now()}`,
          timestamp: nowTimestamp(),
          actorName: prev.activeUser.name,
          actorRole: prev.activeUser.role,
          module: 'Sales & CRM',
          action: 'Customer Registered',
          details: `${newCust.name} (${newCust.type}, ${newCust.priceTier}, credit limit ${newCust.creditLimitTzs.toLocaleString()} TZS).`,
          pinVerified: false,
        },
        ...prev.auditLogs,
      ],
    }));
    showToast(`Customer ${newCust.name} registered.`);
    return { ok: true };
  };

  const handleUpdateCustomer = (id: string, patch: Partial<Customer>) => {
    setState((prev) => ({
      ...prev,
      customers: prev.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
    showToast('Customer profile updated.');
  };

  const handleSavePriceItem = (payload: Omit<PriceListItem, 'id'> & { id?: string }) => {
    setState((prev) => {
      const exists = payload.id
        ? prev.priceList.some((p) => p.id === payload.id)
        : prev.priceList.some(
            (p) =>
              p.species === payload.species && p.grade === payload.grade && p.tier === payload.tier
          );
      const nextList = exists
        ? prev.priceList.map((p) =>
            p.id === payload.id ||
            (p.species === payload.species && p.grade === payload.grade && p.tier === payload.tier)
              ? { ...p, pricePerKgTzs: roundTzs(payload.pricePerKgTzs), validFrom: payload.validFrom }
              : p
          )
        : [{ ...payload, id: `pl-${Date.now()}`, pricePerKgTzs: roundTzs(payload.pricePerKgTzs) }, ...prev.priceList];
      return {
        ...prev,
        priceList: nextList,
        auditLogs: [
          {
            id: `aud-${Date.now()}`,
            timestamp: nowTimestamp(),
            actorName: prev.activeUser.name,
            actorRole: prev.activeUser.role,
            module: 'Sales & Pricing',
            action: 'Price List Updated',
            details: `${payload.species} (${payload.grade} / ${payload.tier}) set to TZS ${roundTzs(payload.pricePerKgTzs).toLocaleString()}/kg.`,
            pinVerified: false,
          },
          ...prev.auditLogs,
        ],
      };
    });
    showToast('Price list updated.');
  };

  const handleCreateQuickSale = async (
    payload: QuickSaleSubmitPayload
  ): Promise<QuickSaleSubmitResult> => {
    const idempotencyKey = (payload.idempotencyKey || '').trim();
    if (!idempotencyKey) {
      return { ok: false, error: 'Missing transaction key. Re-open Quick Sale and try again.' };
    }

    if (
      inFlightSaleKeysRef.current.has(idempotencyKey) ||
      committedSaleKeysRef.current.has(idempotencyKey) ||
      state.sales.some((s) => s.idempotencyKey === idempotencyKey)
    ) {
      return {
        ok: false,
        duplicate: true,
        error: 'Duplicate submission prevented: this sale has already been submitted.',
      };
    }

    const perms = getPermissions(state.activeUser.role);
    if (!perms.canRecordSale) {
      return {
        ok: false,
        error: `Role ${state.activeUser.roleLabel} cannot record sales.`,
      };
    }

    const customer = state.customers.find((c) => c.id === payload.customerId);
    if (!customer) {
      return { ok: false, error: 'Selected customer not found.' };
    }
    if (!normalizeTzPhone(customer.phone)) {
      return { ok: false, error: 'Customer phone must be a valid 255XXXXXXXXX number.' };
    }
    if (payload.lines.length === 0) {
      return { ok: false, error: 'Add at least one weighing line.' };
    }

    const subtotalTzs = roundTzs(
      payload.lines.reduce((sum, l) => sum + roundTzs(roundKg(l.kg) * roundTzs(l.pricePerKgTzs)), 0)
    );
    const discountTzs = Math.max(0, roundTzs(payload.discountTzs));
    if (discountTzs > subtotalTzs) {
      return { ok: false, error: 'Discount cannot exceed subtotal.' };
    }
    if (discountTzs > 0 && !perms.canOverrideSalePrice) {
      return { ok: false, error: 'Only Owner or Farm Manager can approve discounts.' };
    }
    if (discountTzs > 0 && !payload.discountReason.trim()) {
      return { ok: false, error: 'Discount reason is required.' };
    }

    const taxableBase = Math.max(0, subtotalTzs - discountTzs);
    const taxRatePct = payload.applyTax ? 18 : 0;
    const taxTzs = payload.applyTax ? roundTzs(taxableBase * 0.18) : 0;
    const totalTzs = roundTzs(taxableBase + taxTzs);

    const paidTzs = roundTzs(payload.paidTzs);
    if (paidTzs < 0 || paidTzs > totalTzs) {
      return { ok: false, error: 'Paid amount must be between TZS 0 and invoice total.' };
    }
    const balanceTzs = roundTzs(totalTzs - paidTzs);

    const existingDebt = getCustomerOutstandingBalance(state.sales, customer.id);
    if (balanceTzs > 0 && existingDebt + balanceTzs > customer.creditLimitTzs) {
      return {
        ok: false,
        error: `Credit limit exceeded for ${customer.name} (limit TZS ${customer.creditLimitTzs.toLocaleString()}).`,
      };
    }

    const pinRequired = totalTzs >= state.salesPreferences.pinThresholdTzs || discountTzs > 0;
    if (pinRequired && payload.pin !== state.activeUser.pin) {
      return { ok: false, error: 'Invalid 4-digit PIN. Please check your PIN and try again.' };
    }

    // Validate lot stock availability across lines referencing existing lots before contacting backend
    const lotKgUsage: Record<string, { large: number; medium: number; small: number }> = {};
    for (const line of payload.lines) {
      const kg = roundKg(line.kg);
      if (kg <= 0 || line.pricePerKgTzs <= 0) {
        return { ok: false, error: 'All lines require weight > 0 and price > 0.' };
      }
      if (line.sourceType === 'lot' && line.lotId) {
        const lot = state.harvestLots.find((l) => l.id === line.lotId);
        if (!lot) return { ok: false, error: 'Selected harvest lot not found.' };
        if (!lotKgUsage[lot.id]) lotKgUsage[lot.id] = { large: 0, medium: 0, small: 0 };
        const key = line.grade.toLowerCase() as 'large' | 'medium' | 'small';
        lotKgUsage[lot.id][key] = roundKg(lotKgUsage[lot.id][key] + kg);
        const avail = getLotRemainingForGrade(lot, line.grade);
        if (lotKgUsage[lot.id][key] > avail) {
          return {
            ok: false,
            error: `Insufficient ${line.grade} stock in ${lot.lotCode} (${avail.toFixed(2)} kg available).`,
          };
        }
      } else if (line.sourceType === 'pond') {
        const pond = state.ponds.find((p) => p.code === line.pondCode);
        if (!pond || pond.currentFish <= 0) {
          return { ok: false, error: `No live fish available in ${line.pondCode}.` };
        }
      }
    }

    // Backend confirmation gate: stock deduction & harvest lot creation occur ONLY after 200 OK
    inFlightSaleKeysRef.current.add(idempotencyKey);
    let backendConfirmationId = '';
    let verifiedTotals = {
      subtotalTzs,
      discountTzs,
      taxRatePct,
      taxTzs,
      totalTzs,
      paidTzs,
      balanceTzs,
    };

    try {
      const response = await fetch('/api/sales/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey,
          customerId: customer.id,
          customerPhone: customer.phone,
          lines: payload.lines,
          discountTzs,
          discountReason: payload.discountReason.trim(),
          applyTax: payload.applyTax,
          paidTzs,
          paymentMethod: payload.paymentMethod,
          paymentReference: payload.paymentReference,
          deliveryStatus: payload.deliveryStatus,
          deliveryAddress: payload.deliveryAddress,
          vehicleOrDriver: payload.vehicleOrDriver,
          pinRequired,
          pin: pinRequired ? payload.pin : undefined,
        }),
      });

      const confirmData = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        duplicate?: boolean;
        error?: string;
        confirmationId?: string;
        totals?: typeof verifiedTotals;
      };

      if (!response.ok || !confirmData?.ok || confirmData?.duplicate) {
        return {
          ok: false,
          duplicate: Boolean(confirmData?.duplicate),
          error:
            confirmData?.error ||
            'Backend confirmation failed — stock was NOT deducted and no harvest lot was created.',
        };
      }

      backendConfirmationId = confirmData.confirmationId || '';
      if (confirmData.totals) {
        verifiedTotals = confirmData.totals;
      }
      committedSaleKeysRef.current.add(idempotencyKey);
    } catch {
      return {
        ok: false,
        error:
          'Unable to reach confirmation server — stock was NOT deducted and no harvest lot was created.',
      };
    } finally {
      inFlightSaleKeysRef.current.delete(idempotencyKey);
    }

    const today = todayIso();
    const saleId = `sale-${Date.now()}`;
    const invoiceNo = formatInvoiceNo(state.invoiceSequence, today);

    // Build any instant HarvestLots for direct-from-pond lines, and resolve final SaleLines
    const directLotsCreated: HarvestLot[] = [];
    const pondDeductions: Record<string, { fishCount: number; kg: number; lotCode: string }> = {};
    const finalLines: SaleLine[] = [];

    const pondGroups = payload.lines.filter((l) => l.sourceType === 'pond');
    const uniqueDirectPonds = Array.from(new Set(pondGroups.map((l) => l.pondCode)));

    uniqueDirectPonds.forEach((pCode, idx) => {
      const pond = state.ponds.find((p) => p.code === pCode);
      const batch = state.batches.find((b) => b.pondCode === pCode && b.status !== 'Completed') ||
        state.batches.find((b) => b.pondCode === pCode);
      const pLines = pondGroups.filter((l) => l.pondCode === pCode);

      const avgWeightKg = batch ? Math.max(0.15, batch.currentAvgWeightG / 1000) : 0.35;
      const sumByGrade = (g: 'Large' | 'Medium' | 'Small') => {
        const kg = roundKg(pLines.filter((l) => l.grade === g).reduce((s, l) => s + l.kg, 0));
        const explicitCount = pLines.filter((l) => l.grade === g).reduce((s, l) => s + l.count, 0);
        const estCount = explicitCount > 0 ? explicitCount : Math.round(kg / avgWeightKg);
        return { kg, count: estCount };
      };

      const lg = sumByGrade('Large');
      const md = sumByGrade('Medium');
      const sm = sumByGrade('Small');
      const totalDirectCount = Math.min(pond?.currentFish || 0, lg.count + md.count + sm.count);
      const totalDirectKg = roundKg(lg.kg + md.kg + sm.kg);

      const newLotId = `lot-dir-${Date.now()}-${idx}`;
      const newLotCode = formatLotCode(state.harvestLots.length + 1 + idx, today);

      directLotsCreated.push({
        id: newLotId,
        lotCode: newLotCode,
        date: today,
        pondCode: pCode,
        batchCode: batch?.batchCode || 'DIRECT',
        species: pond?.species || pLines[0].species,
        grades: {
          largeKg: lg.kg,
          largeCount: lg.count,
          mediumKg: md.kg,
          mediumCount: md.count,
          smallKg: sm.kg,
          smallCount: sm.count,
          damagedKg: 0,
        },
        remainingKg: { large: 0, medium: 0, small: 0 },
        remainingCount: { large: 0, medium: 0, small: 0 },
        approvedBy: state.activeUser.name,
        notes: `Direct pond harvest for ${invoiceNo}`,
      });

      pondDeductions[pCode] = {
        fishCount: totalDirectCount,
        kg: totalDirectKg,
        lotCode: newLotCode,
      };

      pLines.forEach((pl) => {
        const kg = roundKg(pl.kg);
        const price = roundTzs(pl.pricePerKgTzs);
        finalLines.push({
          lotId: newLotId,
          pondCode: pl.pondCode,
          batchCode: batch?.batchCode || pl.batchCode,
          species: pl.species,
          grade: pl.grade,
          kg,
          count: pl.count > 0 ? pl.count : Math.round(kg / avgWeightKg),
          pricePerKgTzs: price,
          amountTzs: roundTzs(kg * price),
        });
      });
    });

    payload.lines
      .filter((l) => l.sourceType === 'lot' && l.lotId)
      .forEach((l) => {
        const kg = roundKg(l.kg);
        const price = roundTzs(l.pricePerKgTzs);
        finalLines.push({
          lotId: l.lotId!,
          pondCode: l.pondCode,
          batchCode: l.batchCode,
          species: l.species,
          grade: l.grade,
          kg,
          count: l.count,
          pricePerKgTzs: price,
          amountTzs: roundTzs(kg * price),
        });
      });

    const newSale: Sale = {
      id: saleId,
      invoiceNo,
      date: today,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      lines: finalLines,
      subtotalTzs: verifiedTotals.subtotalTzs,
      discountTzs: verifiedTotals.discountTzs,
      discountReason: verifiedTotals.discountTzs > 0 ? payload.discountReason.trim() : undefined,
      taxRatePct: verifiedTotals.taxRatePct,
      taxTzs: verifiedTotals.taxTzs,
      totalTzs: verifiedTotals.totalTzs,
      paidTzs: verifiedTotals.paidTzs,
      balanceTzs: verifiedTotals.balanceTzs,
      paymentStatus:
        verifiedTotals.balanceTzs === 0
          ? 'Paid'
          : verifiedTotals.paidTzs > 0
            ? 'Partial'
            : 'Credit',
      deliveryStatus: payload.deliveryStatus,
      deliveryAddress: payload.deliveryAddress,
      vehicleOrDriver: payload.vehicleOrDriver,
      createdBy: state.activeUser.name,
      approvedBy: state.activeUser.name,
      idempotencyKey,
      backendConfirmationId,
    };

    const newPayment: Payment | null =
      verifiedTotals.paidTzs > 0
        ? {
            id: `pay-${Date.now()}`,
            saleId,
            date: today,
            amountTzs: verifiedTotals.paidTzs,
            method: payload.paymentMethod,
            reference: payload.paymentReference || `${payload.paymentMethod.toUpperCase()}-${invoiceNo}`,
            receivedBy: state.activeUser.name,
          }
        : null;

    const totalSoldKg = roundKg(finalLines.reduce((s, l) => s + l.kg, 0));
    const nextPricesByKey = { ...state.salesPreferences.lastPricesByKey };
    finalLines.forEach((l) => {
      nextPricesByKey[`${l.species}|${l.grade}|${customer.priceTier}`] = l.pricePerKgTzs;
    });

    const prevSnapshot = state;
    setState((prev) => {
      if (prev.sales.some((s) => s.idempotencyKey === idempotencyKey)) {
        return prev;
      }
      return {
        ...prev,
        harvestLots: [
        ...directLotsCreated,
        ...prev.harvestLots.map((lot) => {
          const usage = lotKgUsage[lot.id];
          if (!usage) return lot;
          const nextRemLg = roundKg(Math.max(0, lot.remainingKg.large - usage.large));
          const nextRemMd = roundKg(Math.max(0, lot.remainingKg.medium - usage.medium));
          const nextRemSm = roundKg(Math.max(0, lot.remainingKg.small - usage.small));
          const ratioLg = lot.remainingKg.large > 0 ? nextRemLg / lot.remainingKg.large : 0;
          const ratioMd = lot.remainingKg.medium > 0 ? nextRemMd / lot.remainingKg.medium : 0;
          const ratioSm = lot.remainingKg.small > 0 ? nextRemSm / lot.remainingKg.small : 0;
          return {
            ...lot,
            remainingKg: { large: nextRemLg, medium: nextRemMd, small: nextRemSm },
            remainingCount: {
              large: Math.round(lot.remainingCount.large * ratioLg),
              medium: Math.round(lot.remainingCount.medium * ratioMd),
              small: Math.round(lot.remainingCount.small * ratioSm),
            },
          };
        }),
      ],
      ponds: prev.ponds.map((p) => {
        const ded = pondDeductions[p.code];
        if (!ded) return p;
        const nextFish = Math.max(0, p.currentFish - ded.fishCount);
        return {
          ...p,
          currentFish: nextFish,
          status: nextFish === 0 ? 'Preparing' : p.status,
          readinessPct: nextFish === 0 ? 0 : p.readinessPct,
        };
      }),
      batches: prev.batches.map((b) => {
        const ded = pondDeductions[b.pondCode];
        if (!ded || b.status === 'Completed') return b;
        const nextRemaining = Math.max(0, b.currentEstimatedFish - ded.fishCount);
        const nextStatus = nextRemaining === 0 ? ('Completed' as const) : ('Partial Harvest' as const);
        return {
          ...b,
          currentEstimatedFish: nextRemaining,
          status: nextStatus,
          history: [
            ...b.history,
            {
              id: `ev-${Date.now()}-${b.id}`,
              step: b.history.length + 1,
              title: `Direct Harvest & Sale (${invoiceNo})`,
              detail: `Sold ${ded.kg.toFixed(1)} kg (~${ded.fishCount.toLocaleString()} fish) to ${customer.name} via ${ded.lotCode}.`,
              date: today,
              actor: prev.activeUser.name,
            },
          ],
        };
      }),
      sales: [newSale, ...prev.sales],
      payments: newPayment ? [newPayment, ...prev.payments] : prev.payments,
      invoiceSequence: prev.invoiceSequence + 1,
      preOrders: payload.preOrderId
        ? prev.preOrders.map((po) =>
            po.id === payload.preOrderId
              ? { ...po, status: 'Converted' as const, convertedSaleId: saleId }
              : po
          )
        : prev.preOrders,
      salesPreferences: {
        ...prev.salesPreferences,
        lastCustomerId: customer.id,
        lastPaymentMethod: payload.paymentMethod,
        lastPricesByKey: nextPricesByKey,
      },
      finances: [
        {
          id: `fin-${Date.now()}`,
          date: today,
          type: 'Revenue',
          category: 'Harvest Sales',
          description: `Invoice ${invoiceNo} – ${totalSoldKg.toFixed(1)} kg (${customer.name})`,
          pondCode: finalLines[0]?.pondCode,
          batchCode: finalLines[0]?.batchCode,
          amountTzs: verifiedTotals.totalTzs,
          counterparty: customer.name,
          paymentStatus:
            verifiedTotals.balanceTzs === 0
              ? 'Paid'
              : verifiedTotals.paidTzs > 0
                ? 'Partial'
                : 'Pending Debt',
        },
        ...prev.finances,
      ],
      activities: [
        {
          id: `act-${Date.now()}`,
          kind: 'harvest',
          title: `Sale ${invoiceNo} – ${customer.name}`,
          subtitle: `${totalSoldKg.toFixed(1)} kg · TZS ${verifiedTotals.totalTzs.toLocaleString()} (${newSale.paymentStatus})`,
          timeAgo: 'Just now',
        },
        ...prev.activities,
      ],
      auditLogs: [
        {
          id: `aud-${Date.now()}`,
          timestamp: nowTimestamp(),
          actorName: prev.activeUser.name,
          actorRole: prev.activeUser.role,
          module: 'Sales & Invoicing',
          action: `Sale Recorded (${invoiceNo})`,
          details: `Sold ${totalSoldKg.toFixed(2)} kg to ${customer.name} for TZS ${verifiedTotals.totalTzs.toLocaleString()} (Paid TZS ${verifiedTotals.paidTzs.toLocaleString()} via ${payload.paymentMethod}). Ref: ${backendConfirmationId}`,
          pinVerified: pinRequired,
        },
        ...prev.auditLogs,
      ],
    };
    });

    triggerHaptic(12);
    window.setTimeout(
      () => {
        setActiveReceiptSaleId(saleId);
      },
      effectiveReducedMotion ? 0 : 750
    );
    showToast(`Invoice ${invoiceNo} created for ${customer.name}.`, {
      undoSnapshot: prevSnapshot,
      undoCloseReceipt: true,
    });
    return { ok: true, sale: newSale };
  };

  const handleCollectSalePayment = (payload: {
    saleId: string;
    amountTzs: number;
    method: PaymentMethod;
    reference: string;
  }): { ok: boolean; error?: string } => {
    const target = state.sales.find((s) => s.id === payload.saleId);
    if (!target) return { ok: false, error: 'Invoice not found.' };
    const amt = roundTzs(payload.amountTzs);
    if (amt <= 0 || amt > target.balanceTzs) {
      return {
        ok: false,
        error: `Amount must be between TZS 1 and TZS ${target.balanceTzs.toLocaleString()}.`,
      };
    }

    const nextPaid = roundTzs(target.paidTzs + amt);
    const nextBalance = roundTzs(Math.max(0, target.totalTzs - nextPaid));
    const nextStatus: Sale['paymentStatus'] =
      nextBalance === 0 ? 'Paid' : nextPaid > 0 ? 'Partial' : 'Credit';

    const payment: Payment = {
      id: `pay-${Date.now()}`,
      saleId: target.id,
      date: todayIso(),
      amountTzs: amt,
      method: payload.method,
      reference: payload.reference || `${payload.method.toUpperCase()}-${Date.now().toString().slice(-5)}`,
      receivedBy: state.activeUser.name,
    };

    const prevSnapshot = state;
    setState((prev) => ({
      ...prev,
      sales: prev.sales.map((s) =>
        s.id === target.id
          ? { ...s, paidTzs: nextPaid, balanceTzs: nextBalance, paymentStatus: nextStatus }
          : s
      ),
      payments: [payment, ...prev.payments],
      salesPreferences: {
        ...prev.salesPreferences,
        lastPaymentMethod: payload.method,
      },
      activities: [
        {
          id: `act-${Date.now()}`,
          kind: 'payment',
          title: `Payment collected – ${target.invoiceNo}`,
          subtitle: `TZS ${amt.toLocaleString()} via ${payload.method} (${target.customerName})`,
          timeAgo: 'Just now',
        },
        ...prev.activities,
      ],
      auditLogs: [
        {
          id: `aud-${Date.now()}`,
          timestamp: nowTimestamp(),
          actorName: prev.activeUser.name,
          actorRole: prev.activeUser.role,
          module: 'Receivables & Cash',
          action: `Payment Recorded (${target.invoiceNo})`,
          details: `Collected TZS ${amt.toLocaleString()} via ${payload.method} (${payment.reference}). Remaining balance: TZS ${nextBalance.toLocaleString()}.`,
          pinVerified: false,
        },
        ...prev.auditLogs,
      ],
    }));
    triggerHaptic(10);
    showToast(`Recorded TZS ${amt.toLocaleString()} payment on ${target.invoiceNo}.`, {
      undoSnapshot: prevSnapshot,
    });
    return { ok: true };
  };

  const handleUpdateSaleDelivery = (saleId: string, status: Sale['deliveryStatus']) => {
    const prevSnapshot = state;
    setState((prev) => ({
      ...prev,
      sales: prev.sales.map((s) => (s.id === saleId ? { ...s, deliveryStatus: status } : s)),
    }));
    triggerHaptic(8);
    showToast(`Delivery status updated to ${status}.`, { undoSnapshot: prevSnapshot });
  };

  const handleAddPreOrder = (
    payload: Omit<PreOrder, 'id' | 'status' | 'date'>
  ): { ok: boolean; error?: string } => {
    const newPo: PreOrder = {
      ...payload,
      id: `po-${Date.now()}`,
      date: todayIso(),
      status: 'Open',
    };
    setState((prev) => ({
      ...prev,
      preOrders: [newPo, ...prev.preOrders],
    }));
    showToast('Pre-order saved.');
    return { ok: true };
  };

  const handleCancelPreOrder = (id: string) => {
    setState((prev) => ({
      ...prev,
      preOrders: prev.preOrders.map((po) =>
        po.id === id ? { ...po, status: 'Cancelled' as const } : po
      ),
    }));
    showToast('Pre-order cancelled.');
  };

  const navItems: Array<{
    id: NavSection;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
    badgeTone?: 'red' | 'orange';
  }> = [
    { id: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
    { id: 'farms-ponds', label: t.nav.farmsPonds, icon: Waves },
    { id: 'fish-species', label: t.nav.fishSpecies, icon: Fish },
    { id: 'fish-stock', label: t.nav.fishStock, icon: Boxes },
    { id: 'feeding', label: t.nav.feeding, icon: Utensils },
    { id: 'water-quality', label: t.nav.waterQuality, icon: Droplets },
    { id: 'fish-health', label: t.nav.fishHealth, icon: HeartPulse },
    { id: 'harvest-sales', label: t.nav.harvestSales, icon: ShoppingBag },
    { id: 'inventory', label: t.nav.inventory, icon: Package, badge: lowStockCount, badgeTone: 'red' },
    { id: 'finance', label: t.nav.finance, icon: BarChart3 },
    { id: 'employees', label: t.nav.employees, icon: Users },
    { id: 'tasks-alerts', label: t.nav.tasksAlerts, icon: Bell, badge: openTasksAlertsCount, badgeTone: 'orange' },
    { id: 'aqua-intelligence', label: t.nav.aquaIntelligence, icon: Bot },
    { id: 'settings', label: t.nav.settings, icon: Settings },
    { id: 'help', label: t.nav.help, icon: HelpCircle },
  ];

  return (
    <div className="flex min-h-screen bg-[#E9F0F7] text-slate-900 transition-colors duration-200 dark:bg-[#060f1e] dark:text-slate-100">
      {/* MOBILE OVERLAY */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATIONS.base }}
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-[1px] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* LEFT SIDEBAR (Deep Navy matching brand identity) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[236px] shrink-0 flex-col bg-gradient-to-b from-[#081C3A] via-[#061630] to-[#041024] text-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 via-cyan-500 to-emerald-500 shadow-md ring-2 ring-white/20">
              <Fish className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-display text-[17px] font-extrabold leading-none tracking-tight text-white">
                DukaAquSmart
              </div>
              <div className="mt-1 text-[9.5px] font-medium leading-tight text-sky-200/80">
                {t.brandTagline}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Links with layoutId sliding highlight */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveNav(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`relative z-10 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[12.5px] font-medium transition-colors ${
                  active ? 'text-white' : 'text-slate-200/90 hover:bg-white/10 hover:text-white'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-active-pill"
                    transition={SPRING_SNAPPY}
                    className="absolute inset-0 -z-10 rounded-xl bg-[#1D72E8] shadow-sm"
                  />
                )}
                <span className="flex min-w-0 items-center gap-2.5">
                  <Icon className="h-4 w-4 shrink-0 opacity-90" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`ml-2 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white tabular-nums ${
                      item.badgeTone === 'red' ? 'bg-red-500' : 'bg-orange-500'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Language Switcher (Tanzania Flag + EN/SW) */}
        <div className="border-t border-white/10 px-3 pt-2.5 pb-2">
          <div className="flex items-center justify-between rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 16" className="h-3.5 w-5 shrink-0 rounded-[2px]">
                <rect width="24" height="16" fill="#1EB53A" />
                <polygon points="0,16 24,0 24,16" fill="#00A3DD" />
                <polygon points="0,13 21,0 24,0 24,3 3,16 0,16" fill="#FCD116" />
                <polygon points="0,14 22,0 24,0 24,2 2,16 0,16" fill="#000000" />
              </svg>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                aria-label="Select Language"
                className="bg-transparent text-xs font-semibold text-white focus:outline-none"
              >
                <option value="en" className="bg-[#081C3A] text-white">
                  English
                </option>
                <option value="sw" className="bg-[#081C3A] text-white">
                  Kiswahili
                </option>
              </select>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-white/60" />
          </div>
        </div>

        {/* User Profile + Interactive Role Switcher */}
        <div className="relative px-3 pb-3">
          <AnimatePresence>
            {roleMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: DURATIONS.fast, ease: EASE_OUT }}
                className="absolute bottom-24 left-3 right-3 z-50 rounded-xl border border-white/15 bg-[#0C254A] p-2 shadow-xl"
              >
                <div className="mb-1 px-2 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                  Switch Active Persona
                </div>
                {state.employees.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => handleSwitchUser(emp.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                      state.activeUser.id === emp.id
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{emp.name}</div>
                      <div className="text-[10px] text-sky-200">{emp.roleLabel}</div>
                    </div>
                    <span className="text-[10px] text-sky-200/80">
                      {state.activeUser.id === emp.id ? 'Active' : emp.role}
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="button"
            onClick={() => setRoleMenuOpen(!roleMenuOpen)}
            className="flex w-full items-center gap-2.5 rounded-xl bg-white/10 p-2 text-left transition-colors hover:bg-white/15"
          >
            <img
              src={state.activeUser.avatarUrl || ASSET_IMAGES.avatar}
              alt={state.activeUser.name}
              referrerPolicy="no-referrer"
              className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-emerald-400/70"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-bold text-white">{state.activeUser.name}</div>
              <div className="truncate text-[10px] text-sky-200">{state.activeUser.roleLabel}</div>
              <div className="flex items-center gap-1 text-[10px] text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Online
              </div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/70" />
          </button>

          <button
            type="button"
            onClick={() => setRoleMenuOpen(!roleMenuOpen)}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10"
          >
            <LogOut className="h-3.5 w-3.5" /> {t.actions.switchRole}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT SHELL */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* STICKY TOP SCENIC TANZANIA AQUACULTURE HEADER BANNER */}
        <header
          className={`sticky top-0 z-30 border-b border-slate-200/80 bg-white transition-shadow duration-200 dark:border-slate-800 dark:bg-slate-900 ${
            isScrolled ? 'shadow-md dark:shadow-slate-950/60' : ''
          }`}
        >
          <div
            className="relative flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2.5 sm:px-5 sm:py-3"
            style={{
              backgroundImage: `linear-gradient(90deg, rgba(240,247,255,0.95) 0%, rgba(240,247,255,0.82) 48%, rgba(255,255,255,0.35) 100%), url(${ASSET_IMAGES.banner})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {/* Dark overlay layer for crisp readability over scenic banner in dark mode */}
            <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-r from-[#07162c]/95 via-[#091c38]/90 to-[#0d1a2e]/85 dark:block" />

            <div className="relative z-10 flex items-center gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open menu"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white/95 text-slate-700 dark:border-slate-700 dark:bg-slate-800/95 dark:text-slate-200 lg:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div>
                <h1 className="font-display text-base font-extrabold tracking-tight text-[#0A2540] dark:text-white sm:text-[20px]">
                  {t.heroTitle}
                </h1>
                <p className="hidden text-xs font-semibold text-[#16538E] dark:text-sky-300 sm:block">
                  {t.heroSubtitle}
                </p>
              </div>
            </div>

            {/* Right Header Controls */}
            <div className="relative z-10 flex flex-wrap items-center gap-1.5 sm:gap-2">
              <div className="hidden items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/95 px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs dark:border-slate-700 dark:bg-slate-800/95 dark:text-slate-200 md:flex">
                <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-sky-400" />
                <span>Tue, 19 Nov 2026</span>
              </div>

              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/95 px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs dark:border-slate-700 dark:bg-slate-800/95 dark:text-slate-200">
                <MapPin className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <select
                  value={selectedFarmId}
                  onChange={(e) => setSelectedFarmId(e.target.value)}
                  aria-label="Select Farm Location"
                  className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none dark:text-slate-100"
                >
                  {state.farms.map((f) => (
                    <option key={f.id} value={f.id} className="dark:bg-slate-900">
                      {f.region}
                    </option>
                  ))}
                  <option value="all" className="dark:bg-slate-900">
                    All Tanzania Farms
                  </option>
                </select>
              </div>

              {/* Theme quick toggle */}
              <button
                type="button"
                onClick={cycleThemeMode}
                title={`${t.ui.themeLabel}: ${themeMode}`}
                aria-label={`${t.ui.themeLabel}: ${themeMode}`}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 bg-white/95 text-slate-700 shadow-xs transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/95 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {themeMode === 'dark' ? (
                  <Moon className="h-4 w-4 text-sky-400" />
                ) : themeMode === 'system' ? (
                  <Monitor className="h-4 w-4 text-blue-600 dark:text-sky-300" />
                ) : (
                  <Sun className="h-4 w-4 text-amber-500" />
                )}
              </button>

              {/* Pulsing Alert Bell */}
              <div className="relative">
                <motion.button
                  key={`bell-${bellPulseKey}`}
                  type="button"
                  onClick={() => setNotifOpen(!notifOpen)}
                  aria-label="Notifications"
                  initial={bellPulseKey > 0 ? { scale: 1, rotate: 0 } : false}
                  animate={
                    bellPulseKey > 0 && !effectiveReducedMotion
                      ? { scale: [1, 1.15, 1], rotate: [0, -10, 10, -6, 0] }
                      : { scale: 1 }
                  }
                  transition={{ duration: 0.45 }}
                  className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 bg-white/95 text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/95 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Bell className="h-4 w-4" />
                  <motion.span
                    key={`badge-${openTasksAlertsCount}`}
                    initial={effectiveReducedMotion ? false : { scale: 0.7 }}
                    animate={{ scale: 1 }}
                    transition={SPRING_SNAPPY}
                    aria-live="polite"
                    className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white tabular-nums"
                  >
                    {openTasksAlertsCount}
                  </motion.span>
                </motion.button>

                <AnimatePresence>
                  {notifOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.97 }}
                      transition={{ duration: DURATIONS.fast, ease: EASE_OUT }}
                      className="absolute right-0 top-11 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-modal dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                        <span>Farm Alerts ({openTasksAlertsCount})</span>
                        <button
                          type="button"
                          onClick={() => {
                            setNotifOpen(false);
                            setActiveNav('tasks-alerts');
                          }}
                          className="text-blue-600 hover:underline dark:text-sky-400"
                        >
                          Open Center
                        </button>
                      </div>
                      <div className="space-y-2">
                        {state.alerts.slice(0, 3).map((al) => (
                          <div
                            key={al.id}
                            className="rounded-xl bg-slate-50 p-2 text-xs dark:bg-slate-800/80"
                          >
                            <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                              {al.severity === 'High' && !al.acknowledged && (
                                <span className="relative flex h-2 w-2 shrink-0">
                                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                                </span>
                              )}
                              <span className="truncate">{al.title}</span>
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                              {al.detail}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label="Toggle Fullscreen"
                className="hidden h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 bg-white/95 text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/95 dark:text-slate-200 dark:hover:bg-slate-700 sm:flex"
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* SLIDING OFFLINE / SYNC QUEUE BANNER */}
          <AnimatePresence>
            {(state.offlineMode || state.pendingSyncQueue.length > 0 || isSyncing) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: DURATIONS.base, ease: EASE_OUT }}
                className="overflow-hidden border-t border-amber-200 bg-amber-50/95 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-200"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-[11px] font-semibold sm:px-5">
                  <div className="flex items-center gap-2">
                    <WifiOff className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>
                      {state.offlineMode
                        ? t.ui.offlineBanner
                        : `${state.pendingSyncQueue.length} ${t.ui.pendingQueueLabel}`}
                    </span>
                    {state.pendingSyncQueue.length > 0 && (
                      <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-amber-900 tabular-nums dark:bg-amber-900 dark:text-amber-200">
                        {state.pendingSyncQueue.length} queued
                      </span>
                    )}
                  </div>
                  {state.pendingSyncQueue.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSyncNow}
                      disabled={isSyncing}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-700 disabled:opacity-60"
                    >
                      <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
                      {isSyncing ? t.ui.syncingNow : t.ui.syncNow}
                    </button>
                  )}
                </div>
                {isSyncing && (
                  <div className="h-1 w-full bg-amber-200/60 dark:bg-amber-900/60">
                    <div
                      className="h-full bg-emerald-500 transition-[width] duration-200"
                      style={{ width: `${syncProgress}%` }}
                    />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* TOAST NOTIFICATION WITH UNDO (Bottom on mobile, Top-right on desktop) */}
        <AnimatePresence>
          {toastState && (
            <motion.div
              key={toastState.id}
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: DURATIONS.base, ease: EASE_OUT }}
              className="no-print fixed inset-x-3 bottom-20 z-[1100] flex items-center justify-between gap-3 rounded-2xl border border-emerald-300/40 bg-emerald-950/95 px-4 py-2.5 text-xs font-semibold text-white shadow-modal backdrop-blur-xs sm:inset-x-auto sm:top-4 sm:right-5 sm:bottom-auto sm:max-w-md"
            >
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span className="truncate">{toastState.message}</span>
              </div>
              {toastState.undoSnapshot && (
                <button
                  type="button"
                  onClick={handleUndoToast}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1 text-[11px] font-bold text-emerald-200 hover:bg-white/25"
                >
                  <RotateCcw className="h-3 w-3" /> {t.ui.undo}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* MAIN VIEWPORT WITH PAGE CROSS-FADE */}
        <main className="flex-1 p-3.5 pb-24 sm:p-4 lg:pb-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeNav}
              variants={fadeUp}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {activeNav === 'dashboard' && (
                <DashboardView
                  state={state}
                  language={language}
                  selectedFarmId={selectedFarmId}
                  onNavigate={setActiveNav}
                  onQuickAction={setQuickAction}
                  onOpenQuickSale={() => openQuickSaleModal()}
                  onSelectPond={(pond) => setSelectedPondQr(pond)}
                  onAcknowledgeAlert={(id) => {
                    const prevSnapshot = state;
                    setState((prev) => ({
                      ...prev,
                      alerts: prev.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
                    }));
                    triggerHaptic(8);
                    showToast('Alert acknowledged.', { undoSnapshot: prevSnapshot });
                  }}
                />
              )}

          {activeNav === 'farms-ponds' && (
            <FarmPondsModule
              state={state}
              selectedFarmId={selectedFarmId}
              onSelectPondQr={setSelectedPondQr}
              onSaveFarmLocation={(payload) => {
                if (
                  state.farms.some((f) => f.name.toLowerCase() === payload.name.toLowerCase())
                ) {
                  return { ok: false, error: `Farm "${payload.name}" already exists.` };
                }
                const newFarmId = `farm-${Date.now()}`;
                setState((prev) => ({
                  ...prev,
                  farms: [
                    ...prev.farms,
                    {
                      id: newFarmId,
                      name: payload.name,
                      region: payload.region,
                      gps: payload.gps,
                      locationAccuracyM: payload.locationAccuracyM,
                      locationSource: payload.locationSource,
                      placeName: payload.placeName,
                      locationGeojson: {
                        type: 'Point',
                        coordinates: [payload.gps[1], payload.gps[0]],
                      },
                      operationTypes: ['Grow-out Pond', 'Nursery'],
                      waterSource: payload.waterSource,
                      drainageSystem: payload.drainageSystem,
                      fircisPermitNo: payload.fircisPermitNo,
                      equipment: [],
                      managerId: prev.activeUser.id,
                    },
                  ],
                  auditLogs: [
                    {
                      id: `aud-${Date.now()}`,
                      timestamp: nowTimestamp(),
                      actorName: prev.activeUser.name,
                      actorRole: prev.activeUser.role,
                      module: 'Farm & GIS Mapping',
                      action: 'Farm Site Registered',
                      details: `${payload.name} located at ${payload.gps[0].toFixed(5)}, ${payload.gps[1].toFixed(5)} (${payload.locationSource}, ${payload.placeName}).`,
                      pinVerified: false,
                    },
                    ...prev.auditLogs,
                  ],
                }));
                showToast(`Farm "${payload.name}" located and saved.`);
                return { ok: true, farmId: newFarmId };
              }}
              onToggleAerator={(pondId) => {
                setState((prev) => ({
                  ...prev,
                  ponds: prev.ponds.map((p) =>
                    p.id === pondId ? { ...p, aeratorRelayOn: !p.aeratorRelayOn } : p
                  ),
                }));
                showToast('Aerator relay state updated.');
              }}
              onAddInfrastructureMarker={(m) => {
                const newMarker = {
                  id: `inf-${Date.now()}`,
                  farmId: m.farmId,
                  pondCode: m.pondCode,
                  type: m.type,
                  label: m.label,
                  gps: m.gps,
                  status: 'Operational' as const,
                  createdBy: state.activeUser.name,
                  createdAt: todayIso(),
                };
                setState((prev) => ({
                  ...prev,
                  infrastructureMarkers: [...(prev.infrastructureMarkers || []), newMarker],
                  auditLogs: [
                    {
                      id: `aud-${Date.now()}`,
                      timestamp: nowTimestamp(),
                      actorName: prev.activeUser.name,
                      actorRole: prev.activeUser.role,
                      module: 'Farm & GIS Mapping',
                      action: 'Infrastructure Pin Mapped',
                      details: `Placed ${m.type} (${m.label}) at ${m.gps[0].toFixed(5)}, ${m.gps[1].toFixed(5)}.`,
                      pinVerified: false,
                    },
                    ...prev.auditLogs,
                  ],
                }));
                showToast(`Mapped ${m.label} on farm map.`);
              }}
              onSavePondGis={(payload) => {
                if (payload.editingPondId) {
                  setState((prev) => {
                    const updatedMarkers = [
                      ...(prev.infrastructureMarkers || []).filter(
                        (m) => m.pondCode !== payload.code && m.pondId !== payload.editingPondId
                      ),
                      ...payload.infraMarkers.map((dm) => ({
                        id: dm.id.startsWith('inf-draft-') ? `inf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` : dm.id,
                        farmId: payload.farmId,
                        pondId: payload.editingPondId,
                        pondCode: payload.code,
                        type: dm.type,
                        label: `${payload.code} ${dm.type}`,
                        gps: dm.gps,
                        status: 'Operational' as const,
                        createdBy: prev.activeUser.name,
                        createdAt: todayIso(),
                      })),
                    ];
                    return {
                      ...prev,
                      ponds: prev.ponds.map((p) =>
                        p.id === payload.editingPondId
                          ? {
                              ...p,
                              name: payload.name,
                              farmId: payload.farmId,
                              unitType: payload.unitType,
                              operationStage: payload.operationStage,
                              species: payload.species,
                              maxCapacity: payload.maxCapacity,
                              dimensions: payload.dimensions,
                              waterCapacityM3: payload.waterCapacityM3,
                              waterSource: payload.waterSource,
                              drainageSystem: payload.drainageSystem,
                              gps: payload.gps,
                              polygon: payload.polygon,
                              geometry: payload.geometry,
                              rawGpsTrack: payload.rawGpsTrack ?? p.rawGpsTrack,
                              boundarySource: payload.boundarySource,
                              areaSqm: payload.areaSqm,
                              waterSurfaceSqm: payload.waterSurfaceSqm,
                              perimeterM: payload.perimeterM,
                              boundaryPointsCount: payload.boundaryPointsCount,
                              mappingMethod: payload.mappingMethod,
                              gpsAccuracyM: payload.gpsAccuracyM,
                              boundaryVerified: payload.boundaryVerified,
                              updatedBy: prev.activeUser.name,
                              mappedAt: nowTimestamp(),
                            }
                          : p
                      ),
                      infrastructureMarkers: updatedMarkers,
                      auditLogs: [
                        {
                          id: `aud-${Date.now()}`,
                          timestamp: nowTimestamp(),
                          actorName: prev.activeUser.name,
                          actorRole: prev.activeUser.role,
                          module: 'Farm & GIS Mapping',
                          action: 'Pond Digital Boundary Updated',
                          details: `${payload.code} boundary updated (${payload.areaSqm} m², ${payload.perimeterM} m, ${payload.mappingMethod}).`,
                          pinVerified: false,
                        },
                        ...prev.auditLogs,
                      ],
                    };
                  });
                  showToast(`Updated boundary for ${payload.code} (${payload.areaSqm.toLocaleString()} m²).`);
                  return { ok: true };
                }

                if (state.ponds.some((p) => p.code.toLowerCase() === payload.code.toLowerCase())) {
                  return { ok: false, error: `Pond code ${payload.code} already exists.` };
                }

                const newPondId = `pond-${Date.now()}`;
                setState((prev) => ({
                  ...prev,
                  ponds: [
                    ...prev.ponds,
                    {
                      id: newPondId,
                      code: payload.code,
                      name: payload.name,
                      farmId: payload.farmId,
                      unitType: payload.unitType,
                      operationStage: payload.operationStage,
                      species: payload.species,
                      currentFish: 0,
                      maxCapacity: payload.maxCapacity,
                      dimensions: payload.dimensions,
                      waterCapacityM3: payload.waterCapacityM3,
                      waterSource: payload.waterSource,
                      drainageSystem: payload.drainageSystem,
                      status: 'Preparing',
                      readinessPct: 0,
                      assignedKeeperId: 'emp-keep-1',
                      assignedTechnicianId: 'emp-tech-1',
                      gps: payload.gps,
                      polygon: payload.polygon,
                      geometry: payload.geometry,
                      rawGpsTrack: payload.rawGpsTrack,
                      boundarySource: payload.boundarySource,
                      areaSqm: payload.areaSqm,
                      waterSurfaceSqm: payload.waterSurfaceSqm,
                      perimeterM: payload.perimeterM,
                      boundaryPointsCount: payload.boundaryPointsCount,
                      mappingMethod: payload.mappingMethod,
                      gpsAccuracyM: payload.gpsAccuracyM,
                      boundaryVerified: payload.boundaryVerified,
                      mappedBy: prev.activeUser.name,
                      mappedAt: nowTimestamp(),
                      aeratorRelayOn: false,
                      qrCodeToken: `DUKA-QR-${payload.code}`,
                    },
                  ],
                  infrastructureMarkers: [
                    ...(prev.infrastructureMarkers || []),
                    ...payload.infraMarkers.map((dm) => ({
                      id: `inf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                      farmId: payload.farmId,
                      pondId: newPondId,
                      pondCode: payload.code,
                      type: dm.type,
                      label: `${payload.code} ${dm.type}`,
                      gps: dm.gps,
                      status: 'Operational' as const,
                      createdBy: prev.activeUser.name,
                      createdAt: todayIso(),
                    })),
                  ],
                  auditLogs: [
                    {
                      id: `aud-${Date.now()}`,
                      timestamp: nowTimestamp(),
                      actorName: prev.activeUser.name,
                      actorRole: prev.activeUser.role,
                      module: 'Farm & GIS Mapping',
                      action: 'Production Unit Registered',
                      details: `${payload.code} (${payload.name}) mapped via ${payload.mappingMethod}: ${payload.areaSqm} m², ${payload.perimeterM} m perimeter.`,
                      pinVerified: false,
                    },
                    ...prev.auditLogs,
                  ],
                }));
                showToast(`Saved ${payload.code} (${payload.areaSqm.toLocaleString()} m²).`);
                return { ok: true };
              }}
            />
          )}

          {activeNav === 'fish-species' && (
            <FishSpeciesModule
              state={state}
              onStockNewBatch={(payload) => {
                const pond = state.ponds.find((p) => p.code === payload.pondCode);
                if (!pond) return { ok: false, error: 'Pond not found.' };
                if (pond.currentFish + payload.count > pond.maxCapacity) {
                  return {
                    ok: false,
                    error: `Capacity guard triggered: ${pond.code} max capacity is ${pond.maxCapacity.toLocaleString()} fish. Available space is ${(pond.maxCapacity - pond.currentFish).toLocaleString()}.`,
                  };
                }
                const sp = state.speciesCatalogue.find((s) => s.commonName === payload.species);
                const codePrefix = payload.species.toLowerCase().includes('catfish') ? 'CAT' : 'TIL';
                const batchCode = `${codePrefix}-2026-00${state.batches.length + 1}`;
                setState((prev) => ({
                  ...prev,
                  batches: [
                    {
                      id: `batch-${Date.now()}`,
                      batchCode,
                      species: payload.species,
                      scientificName: sp?.scientificName || 'Oreochromis niloticus',
                      sourceHatchery: payload.sourceHatchery,
                      supplier: payload.supplier,
                      pondId: pond.id,
                      pondCode: pond.code,
                      initialStocking: payload.count,
                      currentEstimatedFish: payload.count,
                      physicallyVerifiedFish: payload.count,
                      lastVerifiedDate: todayIso(),
                      avgInitialWeightG: payload.avgInitialWeightG,
                      currentAvgWeightG: payload.avgInitialWeightG,
                      stockingDate: todayIso(),
                      plannedHarvestDate: '2027-05-15',
                      responsibleKeeper: prev.activeUser.name,
                      status: 'Growing',
                      feedConsumedKg: 0,
                      totalMortality: 0,
                      history: [
                        {
                          id: `ev-${Date.now()}`,
                          step: 1,
                          title: 'Fingerlings received & verified',
                          detail: `${payload.count.toLocaleString()} ${payload.species} stocked into ${pond.code} (${payload.avgInitialWeightG}g avg).`,
                          date: todayIso(),
                          actor: prev.activeUser.name,
                        },
                      ],
                    },
                    ...prev.batches,
                  ],
                  ponds: prev.ponds.map((p) =>
                    p.id === pond.id
                      ? {
                          ...p,
                          species: payload.species,
                          currentFish: p.currentFish + payload.count,
                          status: 'Healthy',
                          readinessPct: 25,
                        }
                      : p
                  ),
                }));
                return { ok: true };
              }}
              onTransferBatch={(payload) => {
                if (payload.pin !== state.activeUser.pin) {
                  return { ok: false, error: 'Invalid 4-digit PIN. Please check your PIN and try again.' };
                }
                const batch = state.batches.find((b) => b.id === payload.batchId);
                const destPond = state.ponds.find((p) => p.code === payload.toPondCode);
                if (!batch || !destPond) return { ok: false, error: 'Batch or destination pond not found.' };
                if (destPond.currentFish + payload.fishCount > destPond.maxCapacity) {
                  return {
                    ok: false,
                    error: `Destination capacity guard: ${destPond.code} max capacity is ${destPond.maxCapacity.toLocaleString()}.`,
                  };
                }
                setState((prev) => ({
                  ...prev,
                  ponds: prev.ponds.map((p) => {
                    if (p.code === batch.pondCode) {
                      return { ...p, currentFish: Math.max(0, p.currentFish - payload.fishCount) };
                    }
                    if (p.code === destPond.code) {
                      return {
                        ...p,
                        currentFish: p.currentFish + payload.fishCount,
                        species: batch.species,
                        status: 'Healthy',
                        readinessPct: Math.max(p.readinessPct, 50),
                      };
                    }
                    return p;
                  }),
                  batches: prev.batches.map((b) =>
                    b.id === batch.id
                      ? {
                          ...b,
                          history: [
                            ...b.history,
                            {
                              id: `ev-${Date.now()}`,
                              step: b.history.length + 1,
                              title: `Partial transfer to ${destPond.code}`,
                              detail: `Transferred ${payload.fishCount.toLocaleString()} fish from ${b.pondCode} to ${destPond.code} (${payload.reason}). Original batch history preserved.`,
                              date: todayIso(),
                              actor: prev.activeUser.name,
                            },
                          ],
                        }
                      : b
                  ),
                  movements: [
                    {
                      id: `mov-${Date.now()}`,
                      batchId: batch.id,
                      fromPondCode: batch.pondCode,
                      toPondCode: destPond.code,
                      fishCount: payload.fishCount,
                      avgWeightGrams: batch.currentAvgWeightG,
                      date: todayIso(),
                      reason: payload.reason,
                      approvedBy: prev.activeUser.name,
                    },
                    ...prev.movements,
                  ],
                }));
                return { ok: true };
              }}
              onRecordGrowthSample={(payload) => {
                setState((prev) => ({
                  ...prev,
                  batches: prev.batches.map((b) =>
                    b.id === payload.batchId
                      ? {
                          ...b,
                          currentAvgWeightG: payload.avgWeightG,
                          lastVerifiedDate: todayIso(),
                          history: [
                            ...b.history,
                            {
                              id: `ev-${Date.now()}`,
                              step: b.history.length + 1,
                              title: 'Sampling & grading recorded',
                              detail: `Sampled ${payload.sampleSize} fish: avg weight ${payload.avgWeightG}g.`,
                              date: todayIso(),
                              actor: prev.activeUser.name,
                            },
                          ],
                        }
                      : b
                  ),
                }));
              }}
            />
          )}

          {activeNav === 'fish-stock' && (
            <FishStockModule
              state={state}
              language={language}
              onBackToMenu={() => setActiveNav('dashboard')}
              onHarvestPond={(pondCode) => openHarvestModal(pondCode)}
              onQuickSalePond={(pondCode) => openQuickSaleModal({ pondCode })}
              onQuickSaleLot={(lotId) => openQuickSaleModal({ lotId })}
              onCreateManualStockLot={handleCreateManualStockLot}
              onRegisterPondStock={handleRegisterPondStock}
            />
          )}

          {activeNav === 'feeding' && (
            <FeedingModule
              state={state}
              onQuickAction={setQuickAction}
              onResolveFeedVariance={(feedId, note) => {
                setState((prev) => ({
                  ...prev,
                  feedIssuances: prev.feedIssuances.map((f) =>
                    f.id === feedId ? { ...f, varianceFlagged: false, status: 'Fed & Reconciled' } : f
                  ),
                  auditLogs: [
                    {
                      id: `aud-${Date.now()}`,
                      timestamp: nowTimestamp(),
                      actorName: prev.activeUser.name,
                      actorRole: prev.activeUser.role,
                      module: 'Feeding Management',
                      action: 'Feed Variance Reconciled',
                      details: note,
                      pinVerified: true,
                    },
                    ...prev.auditLogs,
                  ],
                }));
                showToast('Feed variance resolved and logged in audit trail.');
              }}
            />
          )}

          {activeNav === 'water-quality' && (
            <WaterQualityModule
              state={state}
              onQuickAction={setQuickAction}
              onToggleAerator={(pondId) => {
                setState((prev) => ({
                  ...prev,
                  ponds: prev.ponds.map((p) =>
                    p.id === pondId ? { ...p, aeratorRelayOn: !p.aeratorRelayOn } : p
                  ),
                }));
                showToast('Aerator relay toggled.');
              }}
              onSimulateEsp32Drop={() => {
                handleRecordWater({
                  pondCode: 'POND-003',
                  ph: 7.4,
                  doVal: 3.8,
                  temp: 29.8,
                  ammonia: 0.06,
                  nitrite: 0.04,
                  sourceLevel: 'IoT ESP32 Sensor',
                  instrument: 'ESP32-DO-pH Node #3',
                });
              }}
            />
          )}

          {activeNav === 'fish-health' && (
            <FishHealthModule
              state={state}
              language={language}
              onQuickAction={setQuickAction}
              onVerifyIncident={(id, obs, diag, treatment, withdrawalDays) => {
                setState((prev) => ({
                  ...prev,
                  healthIncidents: prev.healthIncidents.map((h) =>
                    h.id === id
                      ? {
                          ...h,
                          technicianObservation: obs,
                          suspectedDiagnosis: diag,
                          prescribedTreatment: treatment,
                          withdrawalDays,
                          status: 'Technician Verified',
                        }
                      : h
                  ),
                }));
                showToast('Technician verification saved; awaiting Manager approval.');
              }}
              onApproveTreatment={(id) => {
                setState((prev) => ({
                  ...prev,
                  healthIncidents: prev.healthIncidents.map((h) =>
                    h.id === id
                      ? {
                          ...h,
                          treatmentApprovedBy: prev.activeUser.name,
                          status: 'Treatment Approved',
                        }
                      : h
                  ),
                }));
                showToast('Treatment plan approved.');
              }}
            />
          )}

          {activeNav === 'harvest-sales' && (
            <SalesModule
              state={state}
              language={language}
              onQuickAction={setQuickAction}
              onOpenQuickSale={openQuickSaleModal}
              onBackToMenu={() => setActiveNav('dashboard')}
              onOpenFishStock={() => setActiveNav('fish-stock')}
              onViewInvoice={(sale) => setActiveReceiptSaleId(sale.id)}
              onCollectPayment={handleCollectSalePayment}
              onUpdateDeliveryStatus={handleUpdateSaleDelivery}
              onAddCustomer={handleAddCustomer}
              onUpdateCustomer={handleUpdateCustomer}
              onSavePriceItem={handleSavePriceItem}
              onAddPreOrder={handleAddPreOrder}
              onCancelPreOrder={handleCancelPreOrder}
            />
          )}

          {activeNav === 'inventory' && (
            <InventoryModule
              state={state}
              onQuickAction={(action) =>
                action === 'inventory' ? openInventoryModal() : setQuickAction(action)
              }
              onBackToMenu={() => setActiveNav('dashboard')}
              onRestockItem={(itemId) => openInventoryModal(itemId)}
            />
          )}

          {activeNav === 'finance' && (
            <FinanceReportsModule state={state} onQuickAction={setQuickAction} />
          )}

          {activeNav === 'employees' && (
            <EmployeesAccountabilityModule state={state} onSwitchUser={handleSwitchUser} />
          )}

          {activeNav === 'tasks-alerts' && (
            <TasksAlertsModule
              state={state}
              onCompleteTask={(taskId) => {
                const prevSnapshot = state;
                setState((prev) => ({
                  ...prev,
                  tasks: prev.tasks.map((tk) =>
                    tk.id === taskId ? { ...tk, status: 'Completed' } : tk
                  ),
                }));
                triggerHaptic(10);
                showToast('Task marked completed.', { undoSnapshot: prevSnapshot });
              }}
              onAcknowledgeAlert={(alertId) => {
                const prevSnapshot = state;
                setState((prev) => ({
                  ...prev,
                  alerts: prev.alerts.map((al) =>
                    al.id === alertId ? { ...al, acknowledged: true } : al
                  ),
                }));
                triggerHaptic(8);
                showToast('Alert acknowledged.', { undoSnapshot: prevSnapshot });
              }}
            />
          )}

          {activeNav === 'aqua-intelligence' && (
            <AquaIntelligenceView state={state} language={language} />
          )}

          {(activeNav === 'settings' || activeNav === 'help') && (
            <SettingsHelpModule
              mode={activeNav}
              state={state}
              language={language}
              onToggleOffline={() =>
                setState((prev) => ({ ...prev, offlineMode: !prev.offlineMode }))
              }
              onSyncNow={handleSyncNow}
              onExportAll={() => showToast('Backup CSV exported.')}
            />
          )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* BOTTOM TANZANIA VALUE BANNER FOOTER */}
        <footer className="mt-auto mb-14 flex flex-wrap items-center justify-between overflow-hidden bg-gradient-to-r from-[#081D3D] via-[#0B2954] to-[#0D3366] text-white lg:mb-0">
          <div className="flex flex-wrap items-center gap-6 px-5 py-2.5 text-xs font-semibold text-slate-100">
            <span className="flex items-center gap-2">
              <Fish className="h-4 w-4 text-sky-300" /> {t.footer.p1}
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-sky-300" /> {t.footer.p2}
            </span>
            <span className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-sky-300" /> {t.footer.p3}
            </span>
            <span className="flex items-center gap-2">
              <Leaf className="h-4 w-4 text-emerald-400" /> {t.footer.p4}
            </span>
          </div>

          <div
            className="relative flex items-center gap-3 bg-gradient-to-r from-[#168A47] via-[#1C9B52] to-[#0E7490] px-6 py-2.5 text-xs font-bold italic text-white"
            style={{ clipPath: 'polygon(18px 0, 100% 0, 100% 100%, 0 100%)' }}
          >
            <span>{t.footer.slogan}</span>
            <svg viewBox="0 0 24 16" className="h-4 w-6 shrink-0 rounded-[2px] shadow-xs">
              <rect width="24" height="16" fill="#1EB53A" />
              <polygon points="0,16 24,0 24,16" fill="#00A3DD" />
              <polygon points="0,13 21,0 24,0 24,3 3,16 0,16" fill="#FCD116" />
              <polygon points="0,14 22,0 24,0 24,2 2,16 0,16" fill="#000000" />
            </svg>
          </div>
        </footer>
      </div>

      {/* MOBILE FLOATING "+" QUICK-ADD FAB */}
      <div className="no-print lg:hidden">
        <AnimatePresence>
          {fabOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DURATIONS.fast }}
                onClick={() => setFabOpen(false)}
                className="fixed inset-0 z-40 bg-slate-950/35"
              />
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.92 }}
                transition={SPRING_SNAPPY}
                className="fixed right-3.5 bottom-32 z-50 flex flex-col items-end gap-2"
              >
                {[
                  {
                    label: t.actions.quickSale,
                    tone: 'bg-emerald-600 text-white',
                    onClick: () => openQuickSaleModal(),
                  },
                  {
                    label: t.actions.recordFeeding,
                    tone: 'bg-[#1D72E8] text-white',
                    onClick: () => {
                      setFabOpen(false);
                      setQuickAction('feeding');
                    },
                  },
                  {
                    label: t.actions.recordWaterQuality,
                    tone: 'bg-cyan-600 text-white',
                    onClick: () => {
                      setFabOpen(false);
                      setQuickAction('water');
                    },
                  },
                  {
                    label: t.actions.planHarvest,
                    tone: 'bg-amber-600 text-white',
                    onClick: () => openHarvestModal(),
                  },
                  {
                    label: t.actions.addInventory,
                    tone: 'bg-slate-800 text-white dark:bg-slate-700',
                    onClick: () => openInventoryModal(),
                  },
                ].map((act) => (
                  <button
                    key={act.label}
                    type="button"
                    onClick={act.onClick}
                    className={`min-h-[40px] rounded-full px-4 py-2 text-xs font-bold shadow-lg ${act.tone}`}
                  >
                    {act.label}
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <motion.button
          type="button"
          onClick={() => {
            triggerHaptic(8);
            setFabOpen((prev) => !prev);
          }}
          whileTap={{ scale: 0.92 }}
          animate={{ rotate: fabOpen ? 45 : 0 }}
          transition={SPRING_SNAPPY}
          aria-label="Quick add action"
          className="fixed right-3.5 bottom-[70px] z-50 flex h-12 w-12 items-center justify-center rounded-full bg-orange-600 text-white shadow-lg ring-2 ring-white dark:ring-slate-900"
        >
          <Plus className="h-5 w-5" />
        </motion.button>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR (Feed, Water, Sale, Mortality, Tasks) */}
      <nav
        aria-label="Mobile quick actions navigation"
        className="no-print pb-safe fixed inset-x-0 bottom-0 z-40 grid h-14 grid-cols-5 border-t border-slate-200/90 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 lg:hidden"
      >
        {[
          {
            id: 'feed',
            label: t.ui.mobileFeed,
            icon: Utensils,
            active: quickAction === 'feeding' || activeNav === 'feeding',
            onClick: () => setQuickAction('feeding'),
          },
          {
            id: 'water',
            label: t.ui.mobileWater,
            icon: Droplets,
            active: quickAction === 'water' || activeNav === 'water-quality',
            onClick: () => setQuickAction('water'),
          },
          {
            id: 'sale',
            label: t.ui.mobileSale,
            icon: ShoppingBag,
            active: quickSaleOpen || activeNav === 'harvest-sales',
            onClick: () => openQuickSaleModal(),
          },
          {
            id: 'mortality',
            label: t.ui.mobileMortality,
            icon: HeartPulse,
            active: quickAction === 'mortality' || activeNav === 'fish-health',
            onClick: () => setQuickAction('mortality'),
          },
          {
            id: 'tasks',
            label: t.ui.mobileTasks,
            icon: Bell,
            badge: openTasksAlertsCount,
            active: activeNav === 'tasks-alerts',
            onClick: () => setActiveNav('tasks-alerts'),
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={`relative flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
                item.active
                  ? 'text-[#1D72E8] dark:text-sky-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {item.active && (
                <motion.span
                  layoutId="mobile-bottom-active"
                  transition={SPRING_SNAPPY}
                  className="absolute top-0 h-0.5 w-8 rounded-full bg-[#1D72E8] dark:bg-sky-400"
                />
              )}
              <div className="relative">
                <Icon className="h-4 w-4" />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white tabular-nums">
                    {item.badge}
                  </span>
                )}
              </div>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* MODALS */}
      <QuickActionModals
        activeModal={quickAction}
        state={state}
        initialInventoryItemId={inventoryInitialItemId}
        initialHarvestPondCode={harvestInitialPondCode}
        onClose={() => {
          setQuickAction(null);
          setInventoryInitialItemId(null);
          setHarvestInitialPondCode(null);
        }}
        onRecordFeeding={handleRecordFeeding}
        onAddInventory={handleAddInventory}
        onRecordWater={handleRecordWater}
        onReportMortality={handleReportMortality}
        onRecordHarvest={handleRecordHarvest}
        onOpenQuickSaleForLot={(lotId) => openQuickSaleModal({ lotId })}
      />

      <QuickSaleFlow
        open={quickSaleOpen}
        state={state}
        language={language}
        initialLotId={quickSaleInitialLotId}
        initialPondCode={quickSaleInitialPondCode}
        initialPreOrder={quickSalePreOrder}
        onClose={() => {
          setQuickSaleOpen(false);
          setQuickSaleInitialLotId(undefined);
          setQuickSaleInitialPondCode(undefined);
          setQuickSalePreOrder(null);
        }}
        onBackToMenu={() => setActiveNav('dashboard')}
        onQuickCreateCustomer={handleQuickCreateCustomer}
        onSubmitSale={handleCreateQuickSale}
      />

      <InvoiceReceiptModal
        sale={activeReceiptSale}
        state={state}
        language={language}
        onClose={() => setActiveReceiptSaleId(null)}
      />

      <PondQrModal
        pond={selectedPondQr}
        state={state}
        onClose={() => setSelectedPondQr(null)}
        onQuickAction={setQuickAction}
      />
    </div>
  );
}

function prevUserName(s: AquacultureState): string {
  return s.activeUser.name;
}

function formatTzsInline(val: number): string {
  return `TZS ${Math.round(val).toLocaleString()}`;
}
