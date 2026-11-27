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
  Coins,
  ArrowLeft,
  ChevronLeft,
  MoreHorizontal,
} from 'lucide-react';
import { DURATIONS, EASE_OUT, SPRING_SNAPPY, dropdownMenu, fadeUp, usePreferences } from './ui';
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
import { TRANSLATIONS, tDomain, tr } from './i18n/translations';
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
import { FarmPondsModule, FarmsModuleSection } from './components/modules/FarmPondsModule';
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
import type {
  QuickSaleSubmitPayload,
  QuickSaleSubmitResult,
} from './components/sales/QuickSaleFlow';
import { InvoiceReceiptModal } from './components/sales/InvoiceReceiptModal';
import { AquaIntelligenceView } from './components/modules/AquaIntelligenceView';
import { useDeviceAndPWA } from './hooks/useDeviceAndPWA';
import { OfflineStatusPill, PWAInstallButton, PWAInstallCard } from './components/pwa/PWAInstallUI';
import { MobileAppScreens } from './components/mobile/MobileAppScreens';
import { MobileMoreSheet } from './components/mobile/MobileMoreSheet';

const STORAGE_KEY = 'dukaaqusmart_state_v1';

const MOBILE_SHOWCASE_NAVS = new Set<NavSection>([
  'dashboard',
  'farms-ponds',
  'fish-species',
  'fish-stock',
  'feeding',
  'water-quality',
  'fish-health',
  'harvest-sales',
  'inventory',
  'finance',
  'tasks-alerts',
  'aqua-intelligence',
]);

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

  const [activeNav, setActiveNav] = useState<NavSection>(() => {
    if (typeof window !== 'undefined') {
      const view = new URLSearchParams(window.location.search).get('view') as NavSection | null;
      if (view && MOBILE_SHOWCASE_NAVS.has(view)) return view;
    }
    return 'dashboard';
  });
  const [farmsSubView, setFarmsSubView] = useState<FarmsModuleSection>('overview');
  const [farmsNavExpanded, setFarmsNavExpanded] = useState<boolean>(false);
  const [selectedFarmId, setSelectedFarmId] = useState<string>('farm-dsm');
  const [quickAction, setQuickAction] = useState<QuickActionType>(null);
  const [inventoryInitialItemId, setInventoryInitialItemId] = useState<string | null>(null);
  const [harvestInitialPondCode, setHarvestInitialPondCode] = useState<string | null>(null);
  const [saleWizardTriggerKey, setSaleWizardTriggerKey] = useState(0);
  const [quickSaleInitialLotId, setQuickSaleInitialLotId] = useState<string | undefined>(undefined);
  const [quickSaleInitialPondCode, setQuickSaleInitialPondCode] = useState<string | undefined>(undefined);
  const [quickSalePreOrder, setQuickSalePreOrder] = useState<PreOrder | null>(null);
  const [activeReceiptSaleId, setActiveReceiptSaleId] = useState<string | null>(null);
  const [selectedPondQr, setSelectedPondQr] = useState<Pond | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [mobileFullWorkspace, setMobileFullWorkspace] = useState(false);
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
    kind?: 'success' | 'sale' | 'stock' | 'payment' | 'alert' | 'info';
    undoSnapshot?: AquacultureState;
    undoCloseReceipt?: boolean;
  } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const inFlightSaleKeysRef = useRef<Set<string>>(new Set());
  const committedSaleKeysRef = useRef<Set<string>>(new Set());

  const { language, setLanguage, themeMode, cycleThemeMode, effectiveReducedMotion, triggerHaptic } =
    usePreferences();
  const devicePwa = useDeviceAndPWA();

  const navigateTo = (nav: NavSection, opts?: { fullWorkspace?: boolean; farmsSection?: FarmsModuleSection }) => {
    setActiveNav(nav);
    setMobileFullWorkspace(Boolean(opts?.fullWorkspace));
    if (opts?.farmsSection) {
      setFarmsSubView(opts.farmsSection);
    }
    setMobileMenuOpen(false);
    setMobileMoreOpen(false);
  };

  const activeReceiptSale =
    activeReceiptSaleId ? state.sales.find((s) => s.id === activeReceiptSaleId) || null : null;

  const openQuickSaleModal = (opts?: { lotId?: string; pondCode?: string; preOrder?: PreOrder }) => {
    setFabOpen(false);
    setQuickSaleInitialLotId(opts?.lotId);
    setQuickSaleInitialPondCode(opts?.pondCode);
    setQuickSalePreOrder(opts?.preOrder || null);
    setSaleWizardTriggerKey((k) => k + 1);
    setMobileFullWorkspace(true);
    setActiveNav('harvest-sales');
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
    opts?: {
      kind?: 'success' | 'sale' | 'stock' | 'payment' | 'alert' | 'info';
      undoSnapshot?: AquacultureState;
      undoCloseReceipt?: boolean;
    }
  ) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    const id = Date.now();
    setToastState({
      id,
      message,
      kind: opts?.kind || 'success',
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
    setToastState({ id: Date.now(), message: TRANSLATIONS[language].ui.undone, kind: 'info' });
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
      showToast(
        tr(language, 'Kumbukumbu zote za shamba zimesawazishwa.', 'All queued farm records synced.'),
        { kind: 'info' }
      );
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
    showToast(
      tr(
        language,
        `Umebadilisha akaunti kwenda ${emp.name} (${tDomain(language, emp.roleLabel)})`,
        `Switched active role to ${emp.name} (${emp.roleLabel})`
      )
    );
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
      return {
        ok: false,
        error: tr(
          language,
          'PIN ya tarakimu 4 si sahihi. Tafadhali hakikisha PIN yako na ujaribu tena.',
          'Invalid 4-digit PIN. Please check your PIN and try again.'
        ),
      };
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
    showToast(
      tr(
        language,
        `Ulishaji wa ${payload.pondCode} umerekodiwa (${payload.actualFedKg} kg).`,
        `Feeding logged for ${payload.pondCode} (${payload.actualFedKg} kg).`
      ),
      {
        undoSnapshot: prevSnapshot,
      }
    );
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

    const existingPre =
      (payload.existingItemId
        ? state.inventory.find((i) => i.id === payload.existingItemId)
        : undefined) ||
      state.inventory.find((i) => i.name.toLowerCase() === payload.name.toLowerCase());

    const catPrefix =
      payload.category === 'Feed'
        ? 'FD'
        : payload.category === 'Fingerlings'
          ? 'FG'
          : payload.category === 'Medicine'
            ? 'MD'
            : payload.category === 'Fuel'
              ? 'FL'
              : 'EQ';
    const nameSlug =
      payload.name
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 3) || 'ITM';
    const resolvedSku =
      existingPre?.sku ||
      payload.sku ||
      `${catPrefix}-${nameSlug}-${String(101 + state.inventory.length).padStart(3, '0')}`;

    const prevSnapshot = state;
    setState((prev) => {
      const existing =
        (payload.existingItemId
          ? prev.inventory.find((i) => i.id === payload.existingItemId)
          : undefined) ||
        prev.inventory.find((i) => i.name.toLowerCase() === payload.name.toLowerCase());

      const newItemId = existing?.id || `inv-${Date.now()}`;
      const finalSku = existing?.sku || resolvedSku;
      const updatedInventory = existing
        ? prev.inventory.map((i) => {
            if (i.id !== existing.id) return i;
            const nextStock = i.stock + payload.quantity;
            const nextReorder = payload.reorderLevel >= 0 ? payload.reorderLevel : i.reorderLevel;
            return {
              ...i,
              name: payload.name,
              sku: finalSku,
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
              sku: finalSku,
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
            sku: finalSku,
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
            description: `${existing ? 'Restocked' : 'New item'} – ${payload.name} (${payload.quantity} ${payload.unit}) · SKU ${finalSku}${
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
            title: `${existing ? 'Restocked' : 'Purchase added'} – ${payload.name} (${finalSku})`,
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
            details: `${payload.name} [SKU: ${finalSku}] (+${payload.quantity} ${payload.unit} @ TZS ${payload.unitCostTzs.toLocaleString()}) from ${payload.supplier}. Lot: ${payload.lotNumber}. Status: ${payload.paymentStatus}.`,
            pinVerified: false,
          },
          ...prev.auditLogs,
        ],
      };
    });
    triggerHaptic(10);
    showToast(
      tr(
        language,
        `Imehifadhiwa ${payload.quantity} ${payload.unit} za ${payload.name} · SKU: ${resolvedSku}`,
        `Saved ${payload.quantity} ${payload.unit} of ${payload.name} · SKU: ${resolvedSku}`
      ),
      { kind: 'stock', undoSnapshot: prevSnapshot }
    );
    return {
      sku: resolvedSku,
      lotNumber: payload.lotNumber,
      itemName: payload.name,
      quantity: payload.quantity,
      unit: payload.unit,
      totalCostTzs: totalCost,
      isNew: !existingPre,
    };
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
    showToast(
      tr(
        language,
        `Ubora wa maji wa ${payload.pondCode} umerekodiwa.`,
        `Water quality recorded for ${payload.pondCode}.`
      )
    );
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
      return {
        ok: false,
        error: tr(
          language,
          `Wajibu wa ${tDomain(language, state.activeUser.roleLabel)} hauruhusiwi kuripoti vifo vya samaki.`,
          `Role ${state.activeUser.roleLabel} does not report pond mortality.`
        ),
      };
    }
    if (payload.pin !== state.activeUser.pin) {
      return {
        ok: false,
        error: tr(
          language,
          'PIN ya tarakimu 4 si sahihi. Tafadhali hakikisha PIN yako na ujaribu tena.',
          'Invalid 4-digit PIN. Please check your PIN and try again.'
        ),
      };
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
    showToast(
      tr(
        language,
        `Vifo vya ${payload.pondCode} vimeripotiwa. Ufutaji umefungwa kwa uwajibikaji.`,
        `Mortality logged for ${payload.pondCode}. Deletion locked for accountability.`
      )
    );
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
        error: tr(
          language,
          `Wajibu wa ${tDomain(language, state.activeUser.roleLabel)} hauwezi kuidhinisha mavuno. Badilisha kwenda Mmiliki au Meneja wa Shamba.`,
          `Role ${state.activeUser.roleLabel} cannot approve harvests. Switch to Owner or Farm Manager.`
        ),
      };
    }
    if (payload.pin !== state.activeUser.pin) {
      return {
        ok: false,
        error: tr(
          language,
          'PIN ya tarakimu 4 si sahihi. Tafadhali hakikisha PIN yako na ujaribu tena.',
          'Invalid 4-digit PIN. Please check your PIN and try again.'
        ),
      };
    }

    const pond = state.ponds.find((p) => p.code === payload.pondCode);
    if (!pond) {
      return {
        ok: false,
        error: tr(language, 'Bwawa lililochaguliwa halijapatikana.', 'Selected pond was not found.'),
      };
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
      return {
        ok: false,
        error: tr(
          language,
          'Weka idadi na uzito wa samaki waliopangwa daraja zaidi ya 0.',
          'Enter graded fish counts and weights greater than 0.'
        ),
      };
    }
    if (totalCount > pond.currentFish) {
      return {
        ok: false,
        error: tr(
          language,
          `Idadi ya mavuno (${totalCount.toLocaleString()}) inazidi samaki hai waliopo ${pond.code} (${pond.currentFish.toLocaleString()}).`,
          `Harvest count (${totalCount.toLocaleString()}) exceeds live fish in ${pond.code} (${pond.currentFish.toLocaleString()}).`
        ),
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
    showToast(
      tr(
        language,
        `Mavuno ${lotCode} yamehifadhiwa (${totalKg.toFixed(1)} kg tayari kuuzwa).`,
        `Harvest lot ${lotCode} saved (${totalKg.toFixed(1)} kg ready to sell).`
      ),
      {
        undoSnapshot: prevSnapshot,
      }
    );
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
        error: tr(
          language,
          `Wajibu wa ${tDomain(language, state.activeUser.roleLabel)} hauwezi kuongeza akiba ya samaki kwa mkono.`,
          `Role ${state.activeUser.roleLabel} cannot create manual fish stock lots.`
        ),
      };
    }
    if (payload.pin !== state.activeUser.pin) {
      return {
        ok: false,
        error: tr(language, 'PIN ya tarakimu 4 si sahihi.', 'Invalid 4-digit approval PIN.'),
      };
    }

    const totalCount =
      Math.max(0, Math.round(payload.largeCount)) +
      Math.max(0, Math.round(payload.mediumCount)) +
      Math.max(0, Math.round(payload.smallCount));
    const totalKg = roundKg(
      Math.max(0, payload.largeKg) + Math.max(0, payload.mediumKg) + Math.max(0, payload.smallKg)
    );
    if (totalKg <= 0) {
      return {
        ok: false,
        error: tr(
          language,
          'Weka uzito wa samaki waliopangwa daraja zaidi ya 0 kg.',
          'Enter graded stock weight greater than 0 kg.'
        ),
      };
    }

    const sourcePond =
      payload.pondCode !== 'EXTERNAL'
        ? state.ponds.find((p) => p.code === payload.pondCode)
        : undefined;
    if (payload.deductFromPond && sourcePond && totalCount > sourcePond.currentFish) {
      return {
        ok: false,
        error: tr(
          language,
          `Idadi ya samaki (${totalCount.toLocaleString()}) inazidi samaki hai waliopo ${sourcePond.code} (${sourcePond.currentFish.toLocaleString()}).`,
          `Fish count (${totalCount.toLocaleString()}) exceeds live fish in ${sourcePond.code} (${sourcePond.currentFish.toLocaleString()}).`
        ),
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
    showToast(
      tr(
        language,
        `Akiba ya mkono ${lotCode} imehifadhiwa (${totalKg.toFixed(1)} kg).`,
        `Manual stock lot ${lotCode} saved (${totalKg.toFixed(1)} kg).`
      ),
      {
        undoSnapshot: prevSnapshot,
      }
    );
    return { ok: true, lotId };
  };

  const handleRegisterPondStock = (
    payload: ManualPondStockPayload
  ): { ok: boolean; error?: string } => {
    const pond = state.ponds.find((p) => p.code === payload.pondCode);
    if (!pond) {
      return {
        ok: false,
        error: tr(language, 'Bwawa lililochaguliwa halijapatikana.', 'Selected pond was not found.'),
      };
    }
    if (pond.currentFish + payload.fishCount > pond.maxCapacity) {
      return {
        ok: false,
        error: tr(
          language,
          `Ulinzi wa ujazo: ${pond.code} uwezo wa juu ni samaki ${pond.maxCapacity.toLocaleString()} (nafasi iliyobaki: ${(
            pond.maxCapacity - pond.currentFish
          ).toLocaleString()}).`,
          `Capacity guard: ${pond.code} max capacity is ${pond.maxCapacity.toLocaleString()} fish (available space: ${(
            pond.maxCapacity - pond.currentFish
          ).toLocaleString()}).`
        ),
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
    showToast(
      tr(
        language,
        `Samaki ${payload.fishCount.toLocaleString()} wameongezwa kwenye ${pond.code} (${batchCode}).`,
        `Added ${payload.fishCount.toLocaleString()} fish to ${pond.code} (${batchCode}).`
      ),
      {
        undoSnapshot: prevSnapshot,
      }
    );
    return { ok: true };
  };

  // --- SALES & CUSTOMERS HANDLERS (PHASE 1) ---
  const handleQuickCreateCustomer = (payload: {
    name: string;
    phone: string;
  }): { ok: boolean; customer?: Customer; error?: string } => {
    const normalized = normalizeTzPhone(payload.phone);
    if (!payload.name.trim()) {
      return {
        ok: false,
        error: tr(language, 'Jina la mteja linahitajika.', 'Customer name is required.'),
      };
    }
    if (!normalized) {
      return {
        ok: false,
        error: tr(
          language,
          'Namba sahihi ya simu ya Tanzania inahitajika (mfano 255712345678).',
          'Valid Tanzania phone required (e.g. 255712345678).'
        ),
      };
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
    showToast(tr(language, `Mteja ${customer.name} ameongezwa.`, `Added customer ${customer.name}`));
    return { ok: true, customer };
  };

  const handleAddCustomer = (
    payload: Omit<Customer, 'id' | 'createdAt'>
  ): { ok: boolean; error?: string } => {
    const perms = getPermissions(state.activeUser.role);
    if (!perms.canManageCustomers && !perms.canRecordSale) {
      return {
        ok: false,
        error: tr(
          language,
          'Wajibu wako hauruhusiwi kusajili wateja.',
          'Your role cannot register customers.'
        ),
      };
    }
    const normalized = normalizeTzPhone(payload.phone);
    if (!normalized) {
      return {
        ok: false,
        error: tr(
          language,
          'Namba sahihi ya simu ya Tanzania inahitajika (255XXXXXXXXX).',
          'Valid Tanzania phone required (255XXXXXXXXX).'
        ),
      };
    }
    if (state.customers.some((c) => c.phone === normalized)) {
      return {
        ok: false,
        error: tr(
          language,
          'Mteja mwenye namba hii ya simu tayari yupo.',
          'A customer with this phone number already exists.'
        ),
      };
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
    showToast(
      tr(language, `Mteja ${newCust.name} amesajiliwa.`, `Customer ${newCust.name} registered.`)
    );
    return { ok: true };
  };

  const handleUpdateCustomer = (id: string, patch: Partial<Customer>) => {
    setState((prev) => ({
      ...prev,
      customers: prev.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
    showToast(tr(language, 'Taarifa za mteja zimesasishwa.', 'Customer profile updated.'));
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
    showToast(tr(language, 'Orodha ya bei imesasishwa.', 'Price list updated.'));
  };

  const handleCreateQuickSale = async (
    payload: QuickSaleSubmitPayload
  ): Promise<QuickSaleSubmitResult> => {
    const idempotencyKey = (payload.idempotencyKey || '').trim();
    if (!idempotencyKey) {
      return {
        ok: false,
        error: tr(
          language,
          'Ufunguo wa muamala haupo. Fungua tena Uza Haraka na ujaribu.',
          'Missing transaction key. Re-open Quick Sale and try again.'
        ),
      };
    }

    if (
      inFlightSaleKeysRef.current.has(idempotencyKey) ||
      committedSaleKeysRef.current.has(idempotencyKey) ||
      state.sales.some((s) => s.idempotencyKey === idempotencyKey)
    ) {
      return {
        ok: false,
        duplicate: true,
        error: tr(
          language,
          'Muamala umezuiwa kujirudia: mauzo haya tayari yametumwa.',
          'Duplicate submission prevented: this sale has already been submitted.'
        ),
      };
    }

    const perms = getPermissions(state.activeUser.role);
    if (!perms.canRecordSale) {
      return {
        ok: false,
        error: tr(
          language,
          `Wajibu wa ${tDomain(language, state.activeUser.roleLabel)} hauwezi kurekodi mauzo.`,
          `Role ${state.activeUser.roleLabel} cannot record sales.`
        ),
      };
    }

    const customer = state.customers.find((c) => c.id === payload.customerId);
    if (!customer) {
      return {
        ok: false,
        error: tr(language, 'Mteja aliyechaguliwa hajapatikana.', 'Selected customer not found.'),
      };
    }
    if (!normalizeTzPhone(customer.phone)) {
      return {
        ok: false,
        error: tr(
          language,
          'Namba ya simu ya mteja lazima iwe sahihi (255XXXXXXXXX).',
          'Customer phone must be a valid 255XXXXXXXXX number.'
        ),
      };
    }
    if (payload.lines.length === 0) {
      return {
        ok: false,
        error: tr(language, 'Ongeza angalau mstari mmoja wa uzito wa samaki.', 'Add at least one weighing line.'),
      };
    }

    const subtotalTzs = roundTzs(
      payload.lines.reduce((sum, l) => sum + roundTzs(roundKg(l.kg) * roundTzs(l.pricePerKgTzs)), 0)
    );
    const discountTzs = Math.max(0, roundTzs(payload.discountTzs));
    if (discountTzs > subtotalTzs) {
      return {
        ok: false,
        error: tr(language, 'Punguzo haliwezi kuzidi jumla ndogo.', 'Discount cannot exceed subtotal.'),
      };
    }
    if (discountTzs > 0 && !perms.canOverrideSalePrice) {
      return {
        ok: false,
        error: tr(
          language,
          'Ni Mmiliki au Meneja wa Shamba pekee anayeweza kuidhinisha punguzo.',
          'Only Owner or Farm Manager can approve discounts.'
        ),
      };
    }
    if (discountTzs > 0 && !payload.discountReason.trim()) {
      return {
        ok: false,
        error: tr(language, 'Sababu ya punguzo inahitajika.', 'Discount reason is required.'),
      };
    }

    const taxableBase = Math.max(0, subtotalTzs - discountTzs);
    const taxRatePct = payload.applyTax ? 18 : 0;
    const taxTzs = payload.applyTax ? roundTzs(taxableBase * 0.18) : 0;
    const totalTzs = roundTzs(taxableBase + taxTzs);

    const paidTzs = roundTzs(payload.paidTzs);
    if (paidTzs < 0 || paidTzs > totalTzs) {
      return {
        ok: false,
        error: tr(
          language,
          'Kiasi kilicholipwa lazima kiwe kati ya TZS 0 na jumla ya ankara.',
          'Paid amount must be between TZS 0 and invoice total.'
        ),
      };
    }
    const balanceTzs = roundTzs(totalTzs - paidTzs);

    const existingDebt = getCustomerOutstandingBalance(state.sales, customer.id);
    if (balanceTzs > 0 && existingDebt + balanceTzs > customer.creditLimitTzs) {
      return {
        ok: false,
        error: tr(
          language,
          `Kikomo cha mkopo kimezidi kwa ${customer.name} (kikomo TZS ${customer.creditLimitTzs.toLocaleString()}).`,
          `Credit limit exceeded for ${customer.name} (limit TZS ${customer.creditLimitTzs.toLocaleString()}).`
        ),
      };
    }

    const pinRequired = totalTzs >= state.salesPreferences.pinThresholdTzs || discountTzs > 0;
    if (pinRequired && payload.pin !== state.activeUser.pin) {
      return {
        ok: false,
        error: tr(
          language,
          'PIN ya tarakimu 4 si sahihi. Tafadhali hakikisha PIN yako na ujaribu tena.',
          'Invalid 4-digit PIN. Please check your PIN and try again.'
        ),
      };
    }

    // Validate lot stock availability across lines referencing existing lots before contacting backend
    const lotKgUsage: Record<string, { large: number; medium: number; small: number }> = {};
    for (const line of payload.lines) {
      const kg = roundKg(line.kg);
      if (kg <= 0 || line.pricePerKgTzs <= 0) {
        return {
          ok: false,
          error: tr(
            language,
            'Mistari yote inahitaji uzito > 0 na bei > 0.',
            'All lines require weight > 0 and price > 0.'
          ),
        };
      }
      if (line.sourceType === 'lot' && line.lotId) {
        const lot = state.harvestLots.find((l) => l.id === line.lotId);
        if (!lot) {
          return {
            ok: false,
            error: tr(language, 'Mavuno (lot) yaliyochaguliwa hayajapatikana.', 'Selected harvest lot not found.'),
          };
        }
        if (!lotKgUsage[lot.id]) lotKgUsage[lot.id] = { large: 0, medium: 0, small: 0 };
        const key = line.grade.toLowerCase() as 'large' | 'medium' | 'small';
        lotKgUsage[lot.id][key] = roundKg(lotKgUsage[lot.id][key] + kg);
        const avail = getLotRemainingForGrade(lot, line.grade);
        if (lotKgUsage[lot.id][key] > avail) {
          return {
            ok: false,
            error: tr(
              language,
              `Akiba ya daraja ${tDomain(language, line.grade)} haitoshi kwenye ${lot.lotCode} (${avail.toFixed(2)} kg zilizopo).`,
              `Insufficient ${line.grade} stock in ${lot.lotCode} (${avail.toFixed(2)} kg available).`
            ),
          };
        }
      } else if (line.sourceType === 'pond') {
        const pond = state.ponds.find((p) => p.code === line.pondCode);
        if (!pond || pond.currentFish <= 0) {
          return {
            ok: false,
            error: tr(
              language,
              `Hakuna samaki hai kwenye ${line.pondCode}.`,
              `No live fish available in ${line.pondCode}.`
            ),
          };
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
            tr(
              language,
              'Uthibitisho wa seva umeshindikana — akiba HAIJAPUNGUZWA na hakuna lot iliyoundwa.',
              'Backend confirmation failed — stock was NOT deducted and no harvest lot was created.'
            ),
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
        error: tr(
          language,
          'Seva ya uthibitisho haipatikani — akiba HAIJAPUNGUZWA na hakuna lot iliyoundwa.',
          'Unable to reach confirmation server — stock was NOT deducted and no harvest lot was created.'
        ),
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

    setQuickSaleInitialLotId(undefined);
    setQuickSaleInitialPondCode(undefined);
    setQuickSalePreOrder(null);
    triggerHaptic(12);
    window.setTimeout(
      () => {
        setActiveReceiptSaleId(saleId);
      },
      effectiveReducedMotion ? 0 : 750
    );
    showToast(
      tr(
        language,
        `Ankara ${invoiceNo} imeundwa kwa ${customer.name}.`,
        `Invoice ${invoiceNo} created for ${customer.name}.`
      ),
      {
        kind: 'sale',
        undoSnapshot: prevSnapshot,
        undoCloseReceipt: true,
      }
    );
    return { ok: true, sale: newSale };
  };

  const handleCollectSalePayment = (payload: {
    saleId: string;
    amountTzs: number;
    method: PaymentMethod;
    reference: string;
  }): { ok: boolean; error?: string } => {
    const target = state.sales.find((s) => s.id === payload.saleId);
    if (!target) {
      return { ok: false, error: tr(language, 'Ankara haijapatikana.', 'Invoice not found.') };
    }
    const amt = roundTzs(payload.amountTzs);
    if (amt <= 0 || amt > target.balanceTzs) {
      return {
        ok: false,
        error: tr(
          language,
          `Kiasi lazima kiwe kati ya TZS 1 na TZS ${target.balanceTzs.toLocaleString()}.`,
          `Amount must be between TZS 1 and TZS ${target.balanceTzs.toLocaleString()}.`
        ),
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
    showToast(
      tr(
        language,
        `Malipo ya TZS ${amt.toLocaleString()} yamerekodiwa kwenye ${target.invoiceNo}.`,
        `Recorded TZS ${amt.toLocaleString()} payment on ${target.invoiceNo}.`
      ),
      {
        kind: 'payment',
        undoSnapshot: prevSnapshot,
      }
    );
    return { ok: true };
  };

  const handleUpdateSaleDelivery = (saleId: string, status: Sale['deliveryStatus']) => {
    const prevSnapshot = state;
    setState((prev) => ({
      ...prev,
      sales: prev.sales.map((s) => (s.id === saleId ? { ...s, deliveryStatus: status } : s)),
    }));
    triggerHaptic(8);
    showToast(
      tr(
        language,
        `Hali ya usafirishaji imebadilishwa kuwa ${tDomain(language, status)}.`,
        `Delivery status updated to ${status}.`
      ),
      { undoSnapshot: prevSnapshot }
    );
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
    showToast(tr(language, 'Oda ya awali imehifadhiwa.', 'Pre-order saved.'));
    return { ok: true };
  };

  const handleCancelPreOrder = (id: string) => {
    setState((prev) => ({
      ...prev,
      preOrders: prev.preOrders.map((po) =>
        po.id === id ? { ...po, status: 'Cancelled' as const } : po
      ),
    }));
    showToast(tr(language, 'Oda ya awali imefutwa.', 'Pre-order cancelled.'));
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
      {/* TABLET COLLAPSIBLE DRAWER OVERLAY */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATIONS.base }}
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-40 hidden bg-slate-950/60 backdrop-blur-[1px] md:block lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* LEFT SIDEBAR (Tablet collapsible drawer + Desktop sticky sidebar) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 hidden w-[202px] shrink-0 flex-col bg-gradient-to-b from-[#081C3A] via-[#061630] to-[#041024] text-white transition-transform duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] md:flex lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-3 pt-3 pb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 via-cyan-500 to-emerald-500 shadow-sm ring-1 ring-white/25">
              <Fish className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="truncate font-display text-[15px] font-extrabold leading-none tracking-tight text-white">
                DukaAquSmart
              </div>
              <div className="mt-0.5 truncate text-[9px] font-medium leading-tight text-sky-200/80">
                {t.brandTagline}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label={tr(language, 'Funga menyu ya pembeni', 'Close navigation menu')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Links with layoutId sliding highlight */}
        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeNav === item.id;
            const isFarmsParent = item.id === 'farms-ponds';
            const showFarmsChildren = isFarmsParent && farmsNavExpanded;
            const farmsChildren: Array<{ id: FarmsModuleSection; label: string }> = [
              { id: 'overview', label: tr(language, 'Muhtasari wa Mashamba', 'Farm Overview') },
              { id: 'map', label: tr(language, 'Ramani ya Shamba', 'Farm Map') },
              { id: 'register-farm', label: tr(language, 'Sajili Shamba', 'Register Farm') },
              { id: 'register-pond', label: tr(language, 'Sajili Bwawa / Kizimba', 'Register Pond / Cage') },
              { id: 'directory', label: tr(language, 'Orodha ya Mabwawa', 'Pond Directory') },
            ];

            return (
              <div key={item.id} className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    if (isFarmsParent) {
                      if (activeNav === 'farms-ponds') {
                        setFarmsNavExpanded((prev) => !prev);
                      } else {
                        setActiveNav('farms-ponds');
                        setFarmsNavExpanded(true);
                        setMobileMenuOpen(false);
                      }
                      return;
                    }
                    if (item.id === 'harvest-sales') {
                      setQuickSaleInitialLotId(undefined);
                      setQuickSaleInitialPondCode(undefined);
                      setQuickSalePreOrder(null);
                    }
                    setActiveNav(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`relative z-10 flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[11.5px] font-medium transition-colors ${
                    active ? 'text-white' : 'text-slate-200/90 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-active-pill"
                      transition={SPRING_SNAPPY}
                      className="absolute inset-0 -z-10 rounded-lg bg-[#1D72E8] shadow-sm"
                    />
                  )}
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {item.badge !== undefined && item.badge > 0 && (
                      <span
                        className={`ml-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9.5px] font-bold text-white tabular-nums ${
                          item.badgeTone === 'red' ? 'bg-red-500' : 'bg-orange-500'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                    {isFarmsParent && (
                      <ChevronDown
                        className={`h-3 w-3 text-white/75 transition-transform duration-150 ${
                          showFarmsChildren ? 'rotate-180' : ''
                        }`}
                      />
                    )}
                  </span>
                </button>

                {showFarmsChildren && (
                  <div className="ml-4 space-y-0.5 border-l border-white/15 pl-2 py-0.5">
                    {farmsChildren.map((child) => {
                      const childActive = active && farmsSubView === child.id;
                      return (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => {
                            setActiveNav('farms-ponds');
                            setFarmsSubView(child.id);
                            setFarmsNavExpanded(true);
                            setMobileMenuOpen(false);
                          }}
                          className={`flex w-full items-center rounded-md px-2 py-1 text-left text-[11px] font-medium whitespace-nowrap transition-colors ${
                            childActive
                              ? 'bg-white/15 text-white font-semibold'
                              : 'text-sky-100/75 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span className="truncate">{child.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Language Switcher (Compact) */}
        <div className="border-t border-white/10 px-2.5 pt-2 pb-1.5">
          <div className="flex items-center justify-between rounded-lg border border-white/15 bg-white/5 px-2 py-1">
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 16" className="h-3 w-4.5 shrink-0 rounded-[2px]">
                <rect width="24" height="16" fill="#1EB53A" />
                <polygon points="0,16 24,0 24,16" fill="#00A3DD" />
                <polygon points="0,13 21,0 24,0 24,3 3,16 0,16" fill="#FCD116" />
                <polygon points="0,14 22,0 24,0 24,2 2,16 0,16" fill="#000000" />
              </svg>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                aria-label={tr(language, 'Chagua Lugha', 'Select Language')}
                className="bg-transparent text-[11px] font-semibold text-white focus:outline-none"
              >
                <option value="sw" className="bg-[#081C3A] text-white">
                  Kiswahili
                </option>
                <option value="en" className="bg-[#081C3A] text-white">
                  English
                </option>
              </select>
            </div>
            <ChevronDown className="h-3 w-3 text-white/60" />
          </div>
        </div>

        {/* Compact User Profile + Interactive Role Switcher */}
        <div className="relative px-2.5 pb-2.5">
          <AnimatePresence>
            {roleMenuOpen && (
              <motion.div
                variants={dropdownMenu}
                initial="initial"
                animate="animate"
                exit="exit"
                className="absolute bottom-16 left-2.5 right-2.5 z-50 rounded-xl border border-white/15 bg-[#0C254A] p-2 shadow-xl"
              >
                <div className="mb-1 px-2 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                  {tr(language, 'Badilisha Mhusika', 'Switch Active Persona')}
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
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{emp.name}</div>
                      <div className="truncate text-[10px] text-sky-200">{tDomain(language, emp.roleLabel)}</div>
                    </div>
                    <span className="ml-1 shrink-0 text-[10px] text-sky-200/80">
                      {state.activeUser.id === emp.id
                        ? tr(language, 'Anatumika', 'Active')
                        : tDomain(language, emp.role)}
                    </span>
                  </button>
                ))}
                {!devicePwa.isInstalled && (
                  <div className="mt-2 border-t border-white/10 pt-2">
                    <PWAInstallCard
                      language={language}
                      platform={devicePwa.platform}
                      isInstallable={devicePwa.isInstallable}
                      isInstalled={devicePwa.isInstalled}
                      onInstall={devicePwa.install}
                      compact
                    />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="button"
            onClick={() => setRoleMenuOpen(!roleMenuOpen)}
            title={t.actions.switchRole}
            className="flex w-full items-center gap-2 rounded-lg bg-white/10 p-1.5 text-left transition-colors hover:bg-white/15"
          >
            <img
              src={state.activeUser.avatarUrl || ASSET_IMAGES.avatar}
              alt={state.activeUser.name}
              referrerPolicy="no-referrer"
              className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-emerald-400/70"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11px] font-bold text-white">{state.activeUser.name}</div>
              <div className="truncate text-[9.5px] text-sky-200">{tDomain(language, state.activeUser.roleLabel)}</div>
            </div>
            <LogOut className="h-3.5 w-3.5 shrink-0 text-white/70" />
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT SHELL */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* MOBILE NATIVE TOP APP BAR (< md) */}
        <header className="pt-safe sticky top-0 z-40 border-b border-white/10 bg-[#081C3A] text-white shadow-sm md:hidden">
          <div className="flex h-13 items-center justify-between px-3.5">
            <div className="flex min-w-0 items-center gap-2">
              {(activeNav !== 'dashboard' || mobileFullWorkspace) && (
                <button
                  type="button"
                  onClick={() => {
                    if (mobileFullWorkspace) {
                      setMobileFullWorkspace(false);
                    } else {
                      setActiveNav('dashboard');
                    }
                  }}
                  aria-label={tr(language, 'Rudi nyuma', 'Go back')}
                  className="-ml-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/90 active:bg-white/10"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => navigateTo('dashboard')}
                className="flex items-center gap-2 text-left"
              >
                <img
                  src="/icon.svg"
                  alt="DukaAquSmart"
                  className="h-7 w-7 shrink-0 rounded-full ring-1 ring-sky-300/40"
                />
                <span className="font-display text-[17px] font-extrabold tracking-tight">
                  <span className="text-white">DukaAqu</span>
                  <span className="text-sky-400">Smart</span>
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <OfflineStatusPill isOnline={devicePwa.isOnline} language={language} />
              <PWAInstallButton
                language={language}
                platform={devicePwa.platform}
                isInstallable={devicePwa.isInstallable}
                isInstalled={devicePwa.isInstalled}
                onInstall={devicePwa.install}
                variant="mobile-pill"
              />
              <button
                type="button"
                onClick={() => navigateTo('tasks-alerts')}
                aria-label={tr(language, 'Arifa za shamba', 'Notifications')}
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-white/90 active:bg-white/10"
              >
                <Bell className="h-5 w-5" />
                {openTasksAlertsCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9.5px] font-bold text-white tabular-nums ring-2 ring-[#081C3A]">
                    {openTasksAlertsCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {(state.offlineMode || state.pendingSyncQueue.length > 0 || isSyncing) && (
            <div className="flex items-center justify-between gap-2 bg-amber-500/20 px-3.5 py-1 text-[10.5px] font-semibold text-amber-100">
              <span className="truncate">
                {state.offlineMode
                  ? t.ui.offlineBanner
                  : `${state.pendingSyncQueue.length} ${t.ui.pendingQueueLabel}`}
              </span>
              {state.pendingSyncQueue.length > 0 && (
                <button
                  type="button"
                  onClick={handleSyncNow}
                  disabled={isSyncing}
                  className="shrink-0 rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-slate-950"
                >
                  {isSyncing ? t.ui.syncingNow : t.ui.syncNow}
                </button>
              )}
            </div>
          )}
        </header>

        {/* STICKY TOP SCENIC TANZANIA AQUACULTURE HEADER BANNER (Tablet & Desktop) */}
        <header
          className={`sticky top-0 z-30 hidden border-b border-slate-200/80 bg-white transition-shadow duration-200 dark:border-slate-800 dark:bg-slate-900 md:block ${
            isScrolled ? 'shadow-md dark:shadow-slate-950/60' : ''
          }`}
        >
          <div className="relative flex flex-wrap items-center justify-between gap-2.5 overflow-hidden px-3.5 py-2.5 sm:px-5 sm:py-3">
            {/* Crisp, high-visibility scenic aquaculture background image */}
            <img
              src={ASSET_IMAGES.banner}
              alt={t.heroTitle}
              referrerPolicy="no-referrer"
              className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[center_62%] contrast-[1.06] saturate-[1.12]"
            />

            {/* Targeted directional contrast scrim: protects left headline legibility while keeping center-right ponds crystal clear */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#eef6ff]/92 via-[#eef6ff]/62 via-42% to-transparent dark:from-[#07162c]/88 dark:via-[#07162c]/52 dark:via-45% dark:to-[#07162c]/12" />

            <div className="relative z-10 flex items-center gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label={tr(language, 'Fungua menyu', 'Open menu')}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white/95 text-slate-700 dark:border-slate-700 dark:bg-slate-800/95 dark:text-slate-200 lg:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div>
                <h1 className="font-display text-base font-extrabold tracking-tight text-[#0A2540] drop-shadow-[0_1px_1px_rgba(255,255,255,0.75)] dark:text-white dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)] sm:text-[20px]">
                  {t.heroTitle}
                </h1>
                <p className="hidden text-xs font-semibold text-[#114A80] drop-shadow-[0_1px_1px_rgba(255,255,255,0.75)] dark:text-sky-200 dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)] sm:block">
                  {t.heroSubtitle}
                </p>
              </div>
            </div>

            {/* Right Header Controls */}
            <div className="relative z-10 flex flex-wrap items-center gap-1.5 sm:gap-2">
              <div className="hidden items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/95 px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs dark:border-slate-700 dark:bg-slate-800/95 dark:text-slate-200 md:flex">
                <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-sky-400" />
                <span>{tr(language, 'Jumanne, 19 Nov 2026', 'Tue, 19 Nov 2026')}</span>
              </div>

              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/95 px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs dark:border-slate-700 dark:bg-slate-800/95 dark:text-slate-200">
                <MapPin className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <select
                  value={selectedFarmId}
                  onChange={(e) => setSelectedFarmId(e.target.value)}
                  aria-label={tr(language, 'Chagua Eneo la Shamba', 'Select Farm Location')}
                  className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none dark:text-slate-100"
                >
                  {state.farms.map((f) => (
                    <option key={f.id} value={f.id} className="dark:bg-slate-900">
                      {f.region}
                    </option>
                  ))}
                  <option value="all" className="dark:bg-slate-900">
                    {tr(language, 'Mashamba Yote Tanzania', 'All Tanzania Farms')}
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
                  aria-label={tr(language, 'Arifa za shamba', 'Notifications')}
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
                      variants={dropdownMenu}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="absolute right-0 top-11 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-modal dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                        <span>{tr(language, `Tahadhari za Shamba (${openTasksAlertsCount})`, `Farm Alerts (${openTasksAlertsCount})`)}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setNotifOpen(false);
                            setActiveNav('tasks-alerts');
                          }}
                          className="text-blue-600 hover:underline dark:text-sky-400"
                        >
                          {tr(language, 'Fungua Kituo', 'Open Center')}
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

              <OfflineStatusPill isOnline={devicePwa.isOnline} language={language} />

              <PWAInstallButton
                language={language}
                platform={devicePwa.platform}
                isInstallable={devicePwa.isInstallable}
                isInstalled={devicePwa.isInstalled}
                onInstall={devicePwa.install}
                variant="header"
              />

              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={tr(language, 'Skrini nzima', 'Toggle Fullscreen')}
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
                        {state.pendingSyncQueue.length} {tr(language, 'foleni', 'queued')}
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
              initial={{ opacity: 0, x: 18, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 14, y: 6, scale: 0.96 }}
              transition={{ duration: DURATIONS.dropdown, ease: EASE_OUT }}
              className="no-print fixed inset-x-3 bottom-20 z-[1100] flex items-center justify-between gap-3 rounded-2xl border border-emerald-300/40 bg-emerald-950/95 px-4 py-2.5 text-xs font-semibold text-white shadow-modal backdrop-blur-xs sm:inset-x-auto sm:top-4 sm:right-5 sm:bottom-auto sm:max-w-md"
            >
              <div className="flex items-center gap-2 min-w-0">
                {toastState.kind === 'sale' ? (
                  <ShoppingBag className="h-4 w-4 shrink-0 text-sky-400" />
                ) : toastState.kind === 'stock' ? (
                  <Package className="h-4 w-4 shrink-0 text-amber-400" />
                ) : toastState.kind === 'payment' ? (
                  <Coins className="h-4 w-4 shrink-0 text-emerald-400" />
                ) : toastState.kind === 'alert' ? (
                  <Bell className="h-4 w-4 shrink-0 text-orange-400" />
                ) : toastState.kind === 'info' ? (
                  <RefreshCw className="h-4 w-4 shrink-0 text-sky-300" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                )}
                <span className="truncate">{toastState.message}</span>
              </div>
              {toastState.undoSnapshot && (
                <button
                  type="button"
                  onClick={handleUndoToast}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1 text-[11px] font-bold text-emerald-200 transition-colors duration-150 hover:bg-white/25"
                >
                  <RotateCcw className="h-3 w-3" /> {t.ui.undo}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* MAIN VIEWPORT WITH PAGE CROSS-FADE */}
        <main className="flex-1 px-3.5 pt-3.5 pb-24 sm:p-5 lg:px-7 lg:py-6 lg:pb-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeNav}-${devicePwa.isMobile && !mobileFullWorkspace ? 'mob' : 'full'}`}
              variants={fadeUp}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {devicePwa.isMobile &&
                mobileFullWorkspace &&
                MOBILE_SHOWCASE_NAVS.has(activeNav) &&
                activeNav !== 'harvest-sales' && (
                <div className="mb-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => setMobileFullWorkspace(false)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 text-xs font-bold text-[#1D72E8] dark:text-sky-400"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>{tr(language, 'Rudi Mwonekano wa Simu', 'Back to Mobile Summary')}</span>
                  </button>
                  <span className="text-[10.5px] font-semibold text-slate-400">
                    {tr(language, 'Modi Kamili', 'Full Workspace')}
                  </span>
                </div>
              )}

              {devicePwa.isMobile && !mobileFullWorkspace && MOBILE_SHOWCASE_NAVS.has(activeNav) ? (
                <MobileAppScreens
                  activeNav={activeNav}
                  state={state}
                  language={language}
                  selectedFarmId={selectedFarmId}
                  onSelectFarmId={setSelectedFarmId}
                  onNavigate={(nav) => navigateTo(nav)}
                  onOpenMore={() => setMobileMoreOpen(true)}
                  onQuickAction={setQuickAction}
                  onOpenQuickSale={openQuickSaleModal}
                  onSelectPondQr={setSelectedPondQr}
                  onViewInvoice={(sale) => setActiveReceiptSaleId(sale.id)}
                  onCompleteTask={(taskId) => {
                    const prevSnapshot = state;
                    setState((prev) => ({
                      ...prev,
                      tasks: prev.tasks.map((tk) =>
                        tk.id === taskId ? { ...tk, status: 'Completed' } : tk
                      ),
                    }));
                    triggerHaptic(10);
                    showToast(tr(language, 'Kazi imekamilika.', 'Task marked completed.'), {
                      undoSnapshot: prevSnapshot,
                    });
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
                    showToast(tr(language, 'Tahadhari imethibitishwa.', 'Alert acknowledged.'), {
                      kind: 'alert',
                      undoSnapshot: prevSnapshot,
                    });
                  }}
                  onToggleAerator={(pondId) => {
                    setState((prev) => ({
                      ...prev,
                      ponds: prev.ponds.map((p) =>
                        p.id === pondId ? { ...p, aeratorRelayOn: !p.aeratorRelayOn } : p
                      ),
                    }));
                    showToast(
                      tr(language, 'Hali ya kipulizia hewa imesasishwa.', 'Aerator relay state updated.')
                    );
                  }}
                  onOpenFullWorkspace={(section) => {
                    if (section) setFarmsSubView(section);
                    setMobileFullWorkspace(true);
                  }}
                  onRestockItem={(itemId) => openInventoryModal(itemId)}
                  platform={devicePwa.platform}
                  isInstallable={devicePwa.isInstallable}
                  isInstalled={devicePwa.isInstalled}
                  onInstallApp={devicePwa.install}
                />
              ) : (
                <>
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
                    showToast(tr(language, 'Tahadhari imethibitishwa.', 'Alert acknowledged.'), {
                      kind: 'alert',
                      undoSnapshot: prevSnapshot,
                    });
                  }}
                />
              )}

          {activeNav === 'farms-ponds' && (
            <FarmPondsModule
              state={state}
              selectedFarmId={selectedFarmId}
              activeSection={farmsSubView}
              onSectionChange={setFarmsSubView}
              onSelectFarmId={setSelectedFarmId}
              onSelectPondQr={setSelectedPondQr}
              onSaveFarmLocation={(payload) => {
                if (
                  state.farms.some((f) => f.name.toLowerCase() === payload.name.toLowerCase())
                ) {
                  return {
                    ok: false,
                    error: tr(
                      language,
                      `Shamba "${payload.name}" tayari lipo.`,
                      `Farm "${payload.name}" already exists.`
                    ),
                  };
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
                showToast(
                  tr(
                    language,
                    `Shamba "${payload.name}" limewekwa kwenye ramani na kuhifadhiwa.`,
                    `Farm "${payload.name}" located and saved.`
                  )
                );
                return { ok: true, farmId: newFarmId };
              }}
              onToggleAerator={(pondId) => {
                setState((prev) => ({
                  ...prev,
                  ponds: prev.ponds.map((p) =>
                    p.id === pondId ? { ...p, aeratorRelayOn: !p.aeratorRelayOn } : p
                  ),
                }));
                showToast(
                  tr(language, 'Hali ya kipulizia hewa imesasishwa.', 'Aerator relay state updated.')
                );
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
                showToast(
                  tr(
                    language,
                    `${m.label} imewekwa kwenye ramani ya shamba.`,
                    `Mapped ${m.label} on farm map.`
                  )
                );
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
                  showToast(
                    tr(
                      language,
                      `Mpaka wa ${payload.code} umesasishwa (${payload.areaSqm.toLocaleString()} m²).`,
                      `Updated boundary for ${payload.code} (${payload.areaSqm.toLocaleString()} m²).`
                    )
                  );
                  return { ok: true };
                }

                if (state.ponds.some((p) => p.code.toLowerCase() === payload.code.toLowerCase())) {
                  return {
                    ok: false,
                    error: tr(
                      language,
                      `Namba ya bwawa ${payload.code} tayari ipo.`,
                      `Pond code ${payload.code} already exists.`
                    ),
                  };
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
                showToast(
                  tr(
                    language,
                    `${payload.code} imehifadhiwa (${payload.areaSqm.toLocaleString()} m²).`,
                    `Saved ${payload.code} (${payload.areaSqm.toLocaleString()} m²).`
                  )
                );
                return { ok: true };
              }}
            />
          )}

          {activeNav === 'fish-species' && (
            <FishSpeciesModule
              state={state}
              onStockNewBatch={(payload) => {
                const pond = state.ponds.find((p) => p.code === payload.pondCode);
                if (!pond) {
                  return { ok: false, error: tr(language, 'Bwawa halijapatikana.', 'Pond not found.') };
                }
                if (pond.currentFish + payload.count > pond.maxCapacity) {
                  return {
                    ok: false,
                    error: tr(
                      language,
                      `Ulinzi wa ujazo umeanza: uwezo wa juu wa ${pond.code} ni samaki ${pond.maxCapacity.toLocaleString()}. Nafasi iliyobaki ni ${(pond.maxCapacity - pond.currentFish).toLocaleString()}.`,
                      `Capacity guard triggered: ${pond.code} max capacity is ${pond.maxCapacity.toLocaleString()} fish. Available space is ${(pond.maxCapacity - pond.currentFish).toLocaleString()}.`
                    ),
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
                  return {
                    ok: false,
                    error: tr(
                      language,
                      'PIN ya tarakimu 4 si sahihi. Tafadhali hakikisha PIN yako na ujaribu tena.',
                      'Invalid 4-digit PIN. Please check your PIN and try again.'
                    ),
                  };
                }
                const batch = state.batches.find((b) => b.id === payload.batchId);
                const destPond = state.ponds.find((p) => p.code === payload.toPondCode);
                if (!batch || !destPond) {
                  return {
                    ok: false,
                    error: tr(language, 'Kundi au bwawa lengwa halijapatikana.', 'Batch or destination pond not found.'),
                  };
                }
                if (destPond.currentFish + payload.fishCount > destPond.maxCapacity) {
                  return {
                    ok: false,
                    error: tr(
                      language,
                      `Ulinzi wa ujazo wa bwawa lengwa: uwezo wa juu wa ${destPond.code} ni samaki ${destPond.maxCapacity.toLocaleString()}.`,
                      `Destination capacity guard: ${destPond.code} max capacity is ${destPond.maxCapacity.toLocaleString()}.`
                    ),
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
                showToast(
                  tr(
                    language,
                    'Tofauti ya chakula imetatuliwa na kurekodiwa kwenye ukaguzi.',
                    'Feed variance resolved and logged in audit trail.'
                  )
                );
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
                showToast(tr(language, 'Kipulizia hewa kimewashwa/kuzimwa.', 'Aerator relay toggled.'));
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
                showToast(
                  tr(
                    language,
                    'Uthibitisho wa mtaalamu umehifadhiwa; inasubiri idhini ya Meneja.',
                    'Technician verification saved; awaiting Manager approval.'
                  )
                );
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
                showToast(tr(language, 'Mpango wa matibabu umeidhinishwa.', 'Treatment plan approved.'));
              }}
            />
          )}

          {activeNav === 'harvest-sales' && (
            <SalesModule
              state={state}
              language={language}
              initialWizardLotId={quickSaleInitialLotId}
              initialWizardPondCode={quickSaleInitialPondCode}
              initialWizardPreOrder={quickSalePreOrder}
              wizardTriggerKey={saleWizardTriggerKey}
              onQuickAction={setQuickAction}
              onOpenQuickSale={openQuickSaleModal}
              onQuickCreateCustomer={handleQuickCreateCustomer}
              onSubmitSale={handleCreateQuickSale}
              onBackToMenu={() =>
                devicePwa.isMobile ? setMobileFullWorkspace(false) : setActiveNav('dashboard')
              }
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
                showToast(tr(language, 'Kazi imekamilika.', 'Task marked completed.'), {
                  undoSnapshot: prevSnapshot,
                });
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
                showToast(tr(language, 'Tahadhari imethibitishwa.', 'Alert acknowledged.'), {
                  undoSnapshot: prevSnapshot,
                });
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
              onExportAll={() =>
                showToast(tr(language, 'Nakala ya CSV imepakuliwa.', 'Backup CSV exported.'))
              }
            />
          )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* BOTTOM TANZANIA VALUE BANNER FOOTER (Tablet & Desktop) */}
        <footer className="mt-auto hidden flex-wrap items-center justify-between overflow-hidden bg-gradient-to-r from-[#081D3D] via-[#0B2954] to-[#0D3366] text-white md:flex">
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

      {/* MOBILE 5-TAB BOTTOM NAVIGATION BAR (Home, Farms, Stock, Sales, More) */}
      <nav
        aria-label={tr(language, 'Menyu kuu ya simu', 'Mobile primary navigation')}
        className="no-print pb-safe fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 border-t border-slate-200/90 bg-white/95 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 md:hidden"
      >
        {[
          {
            id: 'home',
            label: tr(language, 'Nyumbani', 'Home'),
            icon: LayoutDashboard,
            active: !mobileMoreOpen && activeNav === 'dashboard',
            onClick: () => navigateTo('dashboard'),
          },
          {
            id: 'farms',
            label: tr(language, 'Mashamba', 'Farms'),
            icon: MapPin,
            active: !mobileMoreOpen && activeNav === 'farms-ponds',
            onClick: () => navigateTo('farms-ponds'),
          },
          {
            id: 'stock',
            label: tr(language, 'Akiba', 'Stock'),
            icon: Fish,
            active: !mobileMoreOpen && (activeNav === 'fish-stock' || activeNav === 'fish-species'),
            onClick: () => navigateTo('fish-stock'),
          },
          {
            id: 'sales',
            label: tr(language, 'Mauzo', 'Sales'),
            icon: ShoppingBag,
            active: !mobileMoreOpen && activeNav === 'harvest-sales',
            onClick: () => navigateTo('harvest-sales'),
          },
          {
            id: 'more',
            label: tr(language, 'Zaidi', 'More'),
            icon: MoreHorizontal,
            badge: openTasksAlertsCount,
            active:
              mobileMoreOpen ||
              (activeNav !== 'dashboard' &&
                activeNav !== 'farms-ponds' &&
                activeNav !== 'fish-stock' &&
                activeNav !== 'fish-species' &&
                activeNav !== 'harvest-sales'),
            onClick: () => setMobileMoreOpen(true),
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={`relative flex min-h-[48px] flex-col items-center justify-center gap-0.5 text-[10.5px] font-bold transition-colors ${
                item.active
                  ? 'text-[#1D72E8] dark:text-sky-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {item.active && (
                <motion.span
                  layoutId="mobile-bottom-active"
                  transition={SPRING_SNAPPY}
                  className="absolute top-0 h-[3px] w-9 rounded-full bg-[#1D72E8] dark:bg-sky-400"
                />
              )}
              <div className="relative">
                <Icon className="h-5 w-5" />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-rose-600 px-1 text-[8.5px] font-bold text-white tabular-nums">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <MobileMoreSheet
        open={mobileMoreOpen}
        onClose={() => setMobileMoreOpen(false)}
        state={state}
        language={language}
        themeMode={themeMode}
        onCycleTheme={cycleThemeMode}
        onChangeLanguage={setLanguage}
        onNavigate={(nav) => navigateTo(nav)}
        onSwitchUser={handleSwitchUser}
        onSyncNow={handleSyncNow}
        isSyncing={isSyncing}
        platform={devicePwa.platform}
        isInstallable={devicePwa.isInstallable}
        isInstalled={devicePwa.isInstalled}
        onInstallApp={devicePwa.install}
      />

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
