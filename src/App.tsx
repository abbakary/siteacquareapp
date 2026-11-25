import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import {
  AquacultureState,
  Language,
  NavSection,
  OperationType,
  Pond,
} from './types/aquaculture';
import { ASSET_IMAGES, INITIAL_STATE } from './data/seedData';
import { TRANSLATIONS } from './i18n/translations';
import { nowTimestamp, todayIso } from './utils/formatters';
import { getPermissions } from './utils/rbac';
import { DashboardView } from './components/DashboardView';
import { PondQrModal, QuickActionModals, QuickActionType } from './components/QuickActionModals';
import { FarmPondsModule } from './components/modules/FarmPondsModule';
import { FishSpeciesModule } from './components/modules/FishSpeciesModule';
import {
  FeedingModule,
  FishHealthModule,
  WaterQualityModule,
} from './components/modules/FeedingWaterHealthModule';
import {
  EmployeesAccountabilityModule,
  FinanceReportsModule,
  HarvestSalesModule,
  InventoryModule,
  SettingsHelpModule,
  TasksAlertsModule,
} from './components/modules/CommerceAccountabilityModule';
import { AquaIntelligenceView } from './components/modules/AquaIntelligenceView';

const STORAGE_KEY = 'dukaaqusmart_state_v1';

export default function App() {
  const [state, setState] = useState<AquacultureState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<AquacultureState>;
        return {
          ...INITIAL_STATE,
          ...parsed,
          stockPurchases: parsed.stockPurchases ?? INITIAL_STATE.stockPurchases,
        };
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
  const [selectedPondQr, setSelectedPondQr] = useState<Pond | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore quota errors
    }
  }, [state]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const t = TRANSLATIONS[language];
  const lowStockCount = state.inventory.filter((i) => i.status !== 'In Stock').length + 1;
  const openTasksAlertsCount =
    state.tasks.filter((tk) => tk.status === 'Pending').length +
    state.alerts.filter((al) => !al.acknowledged).length;

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
      return { ok: false, error: `Invalid PIN. Please enter ${state.activeUser.pin} for ${state.activeUser.name}.` };
    }
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
          signedPinHash: `PIN-${payload.pin}-OK`,
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
    showToast(`Feeding logged for ${payload.pondCode} (${payload.actualFedKg} kg).`);
    return { ok: true };
  };

  const handleAddInventory = (payload: {
    name: string;
    category: 'Feed' | 'Fingerlings' | 'Medicine' | 'Fuel' | 'Equipment';
    quantity: number;
    unit: string;
    unitCostTzs: number;
    supplier: string;
  }) => {
    const totalCost = payload.quantity * payload.unitCostTzs;
    setState((prev) => {
      const existing = prev.inventory.find((i) => i.name.toLowerCase() === payload.name.toLowerCase());
      const updatedInventory = existing
        ? prev.inventory.map((i) =>
            i.id === existing.id
              ? {
                  ...i,
                  stock: i.stock + payload.quantity,
                  status: i.stock + payload.quantity <= i.reorderLevel ? ('Low Stock' as const) : ('In Stock' as const),
                }
              : i
          )
        : [
            {
              id: `inv-${Date.now()}`,
              name: payload.name,
              category: payload.category,
              stock: payload.quantity,
              unit: payload.unit,
              reorderLevel: 50,
              unitCostTzs: payload.unitCostTzs,
              batchOrLot: `LOT-${Date.now().toString().slice(-4)}`,
              supplier: payload.supplier,
              status: 'In Stock' as const,
            },
            ...prev.inventory,
          ];

      const lotNumber = `LOT-${Date.now().toString().slice(-4)}`;
      return {
        ...prev,
        inventory: updatedInventory,
        stockPurchases: [
          {
            id: `pur-${Date.now()}`,
            date: todayIso(),
            itemName: payload.name,
            category: payload.category,
            quantity: payload.quantity,
            unit: payload.unit,
            unitCostTzs: payload.unitCostTzs,
            totalCostTzs: totalCost,
            supplier: payload.supplier,
            lotNumber,
            paymentStatus: 'Paid',
            recordedBy: prev.activeUser.name,
          },
          ...(prev.stockPurchases || []),
        ],
        finances: [
          {
            id: `fin-${Date.now()}`,
            date: todayIso(),
            type: 'Expense',
            category: payload.category === 'Feed' ? 'Feed Purchase' : 'Equipment Maintenance',
            description: `Purchase added – ${payload.name} (${payload.quantity} ${payload.unit})`,
            amountTzs: totalCost,
            counterparty: payload.supplier,
            paymentStatus: 'Paid',
          },
          ...prev.finances,
        ],
        activities: [
          {
            id: `act-${Date.now()}`,
            kind: 'purchase',
            title: `Purchase added – ${payload.name}`,
            subtitle: `${payload.quantity} ${payload.unit} from ${payload.supplier}`,
            timeAgo: 'Just now',
          },
          ...prev.activities,
        ],
      };
    });
    showToast(`Added ${payload.quantity} ${payload.unit} of ${payload.name} to inventory.`);
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
      return { ok: false, error: `Invalid PIN. Expected ${state.activeUser.pin}.` };
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
    customerName: string;
    pricePerKgTzs: number;
    paidAmountTzs: number;
    pin: string;
  }) => {
    if (payload.pin !== state.activeUser.pin) {
      return { ok: false, error: `Invalid PIN. Expected ${state.activeUser.pin}.` };
    }
    const totalCount = payload.largeCount + payload.mediumCount + payload.smallCount;
    const totalKg = payload.largeKg + payload.mediumKg + payload.smallKg;
    const totalAmount = totalKg * payload.pricePerKgTzs;
    const pond = state.ponds.find((p) => p.code === payload.pondCode);
    const batch = state.batches.find((b) => b.pondCode === payload.pondCode);

    setState((prev) => ({
      ...prev,
      harvests: [
        {
          id: `harv-${Date.now()}`,
          date: todayIso(),
          pondCode: payload.pondCode,
          batchCode: batch?.batchCode || 'BATCH',
          species: pond?.species || 'Nile Tilapia',
          totalFishHarvested: totalCount,
          totalWeightKg: totalKg,
          grades: {
            largeCount: payload.largeCount,
            largeKg: payload.largeKg,
            mediumCount: payload.mediumCount,
            mediumKg: payload.mediumKg,
            smallCount: payload.smallCount,
            smallKg: payload.smallKg,
            damagedKg: 0,
          },
          customerName: payload.customerName,
          customerPhone: '+255 712 000 111',
          pricePerKgTzs: payload.pricePerKgTzs,
          totalAmountTzs: totalAmount,
          paidAmountTzs: payload.paidAmountTzs,
          deliveryStatus: 'Delivered',
          approvedBy: prev.activeUser.name,
        },
        ...prev.harvests,
      ],
      ponds: prev.ponds.map((p) =>
        p.code === payload.pondCode
          ? { ...p, currentFish: Math.max(0, p.currentFish - totalCount) }
          : p
      ),
      finances: [
        {
          id: `fin-${Date.now()}`,
          date: todayIso(),
          type: 'Revenue',
          category: 'Harvest Sales',
          description: `Harvest sale – ${totalKg} kg (${payload.pondCode})`,
          pondCode: payload.pondCode,
          batchCode: batch?.batchCode,
          amountTzs: totalAmount,
          counterparty: payload.customerName,
          paymentStatus: payload.paidAmountTzs >= totalAmount ? 'Paid' : 'Partial',
        },
        ...prev.finances,
      ],
      activities: [
        {
          id: `act-${Date.now()}`,
          kind: 'harvest',
          title: `Harvest completed – ${payload.pondCode}`,
          subtitle: `${totalKg} kg sold to ${payload.customerName}`,
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
          action: 'Harvest Approved & Invoice Generated',
          details: `${payload.pondCode}: ${totalCount} fish (${totalKg} kg) sold for TZS ${totalAmount.toLocaleString()}.`,
          pinVerified: true,
        },
        ...prev.auditLogs,
      ],
    }));
    showToast(`Harvest recorded for ${payload.pondCode} (${totalKg} kg).`);
    return { ok: true };
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
    <div className="flex min-h-screen bg-[#E9F0F7] text-slate-900">
      {/* MOBILE OVERLAY */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
        />
      )}

      {/* LEFT SIDEBAR (Deep Navy matching reference image) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[236px] shrink-0 flex-col bg-gradient-to-b from-[#081C3A] via-[#061630] to-[#041024] text-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 via-cyan-500 to-emerald-500 shadow-md ring-2 ring-white/20">
              <Fish className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-display text-[17px] font-extrabold tracking-tight text-white leading-none">
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
            className="rounded p-1 text-white/70 hover:bg-white/10 lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Links */}
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
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[12.5px] font-medium transition-colors ${
                  active
                    ? 'bg-[#1D72E8] text-white shadow-sm'
                    : 'text-slate-200/90 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon className="h-4 w-4 shrink-0 opacity-90" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`ml-2 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${
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
              {/* Tanzania Flag SVG */}
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
          {roleMenuOpen && (
            <div className="absolute bottom-24 left-3 right-3 z-50 rounded-xl border border-white/15 bg-[#0C254A] p-2 shadow-xl">
              <div className="mb-1 px-2 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                Switch Active Persona
              </div>
              {state.employees.map((emp) => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => handleSwitchUser(emp.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs ${
                    state.activeUser.id === emp.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <div>
                    <div className="font-semibold">{emp.name}</div>
                    <div className="text-[10px] text-sky-200">{emp.roleLabel}</div>
                  </div>
                  <span className="font-mono text-[10px] opacity-80">PIN {emp.pin}</span>
                </button>
              ))}
            </div>
          )}

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
        {/* TOP SCENIC TANZANIA AQUACULTURE HEADER BANNER */}
        <header className="relative overflow-hidden border-b border-slate-200/80 bg-white">
          <div
            className="relative flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5"
            style={{
              backgroundImage: `linear-gradient(90deg, rgba(240,247,255,0.95) 0%, rgba(240,247,255,0.82) 48%, rgba(255,255,255,0.35) 100%), url(${ASSET_IMAGES.banner})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-lg border border-slate-300 bg-white/90 p-2 text-slate-700 lg:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div>
                <h1 className="font-display text-lg font-extrabold tracking-tight text-[#0A2540] sm:text-[21px]">
                  {t.heroTitle}
                </h1>
                <p className="text-xs font-semibold text-[#16538E]">{t.heroSubtitle}</p>
              </div>
            </div>

            {/* Right Header Controls matching screenshot */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white/95 px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs">
                <Calendar className="h-3.5 w-3.5 text-blue-600" />
                <span>Tue, 19 Nov 2026</span>
              </div>

              <div className="flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white/95 px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs">
                <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                <select
                  value={selectedFarmId}
                  onChange={(e) => setSelectedFarmId(e.target.value)}
                  aria-label="Select Farm Location"
                  className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none"
                >
                  {state.farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.region}
                    </option>
                  ))}
                  <option value="all">All Tanzania Farms</option>
                </select>
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotifOpen(!notifOpen)}
                  aria-label="Notifications"
                  className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/90 bg-white/95 text-slate-700 shadow-xs hover:bg-slate-50"
                >
                  <Bell className="h-4 w-4" />
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                    {openTasksAlertsCount}
                  </span>
                </button>

                {notifOpen && (
                  <div className="absolute right-0 top-10 z-50 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                    <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-900">
                      <span>Farm Alerts ({openTasksAlertsCount})</span>
                      <button
                        type="button"
                        onClick={() => {
                          setNotifOpen(false);
                          setActiveNav('tasks-alerts');
                        }}
                        className="text-blue-600 hover:underline"
                      >
                        Open Center
                      </button>
                    </div>
                    <div className="space-y-2">
                      {state.alerts.slice(0, 3).map((al) => (
                        <div key={al.id} className="rounded-lg bg-slate-50 p-2 text-xs">
                          <div className="font-bold text-slate-900">{al.title}</div>
                          <div className="text-[11px] text-slate-500">{al.detail}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label="Toggle Fullscreen"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/90 bg-white/95 text-slate-700 shadow-xs hover:bg-slate-50"
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </header>

        {/* TOAST NOTIFICATION */}
        {toastMsg && (
          <div className="fixed bottom-16 right-5 z-[1100] flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xl">
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            {toastMsg}
          </div>
        )}

        {/* MAIN VIEWPORT */}
        <main className="flex-1 p-3.5 sm:p-4">
          {activeNav === 'dashboard' && (
            <DashboardView
              state={state}
              language={language}
              selectedFarmId={selectedFarmId}
              onNavigate={setActiveNav}
              onQuickAction={setQuickAction}
              onSelectPond={(pond) => setSelectedPondQr(pond)}
              onAcknowledgeAlert={(id) => {
                setState((prev) => ({
                  ...prev,
                  alerts: prev.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
                }));
                showToast('Alert acknowledged.');
              }}
            />
          )}

          {activeNav === 'farms-ponds' && (
            <FarmPondsModule
              state={state}
              selectedFarmId={selectedFarmId}
              onSelectPondQr={setSelectedPondQr}
              onToggleAerator={(pondId) => {
                setState((prev) => ({
                  ...prev,
                  ponds: prev.ponds.map((p) =>
                    p.id === pondId ? { ...p, aeratorRelayOn: !p.aeratorRelayOn } : p
                  ),
                }));
                showToast('Aerator relay state updated.');
              }}
              onAddPond={(newP) => {
                if (state.ponds.some((p) => p.code.toLowerCase() === newP.code.toLowerCase())) {
                  return { ok: false, error: `Pond code ${newP.code} already exists.` };
                }
                const baseLat = -6.8675;
                const baseLng = 39.3292;
                const offset = state.ponds.length * 0.0004;
                setState((prev) => ({
                  ...prev,
                  ponds: [
                    ...prev.ponds,
                    {
                      id: `pond-${Date.now()}`,
                      code: newP.code,
                      name: newP.name,
                      farmId: newP.farmId,
                      unitType: newP.unitType,
                      operationStage: newP.operationStage,
                      species: newP.species,
                      currentFish: 0,
                      maxCapacity: newP.maxCapacity,
                      dimensions: newP.dimensions,
                      waterCapacityM3: newP.waterCapacityM3,
                      status: 'Preparing',
                      readinessPct: 0,
                      assignedKeeperId: 'emp-keep-1',
                      assignedTechnicianId: 'emp-tech-1',
                      gps: [baseLat - offset, baseLng],
                      polygon: [
                        [baseLat - offset + 0.0002, baseLng - 0.0004],
                        [baseLat - offset + 0.0002, baseLng + 0.0004],
                        [baseLat - offset - 0.0002, baseLng + 0.0004],
                        [baseLat - offset - 0.0002, baseLng - 0.0004],
                      ],
                      aeratorRelayOn: false,
                      qrCodeToken: `DUKA-QR-${newP.code}`,
                    },
                  ],
                }));
                showToast(`Registered ${newP.code} (${newP.name}).`);
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
                  return { ok: false, error: `Invalid PIN. Expected ${state.activeUser.pin}.` };
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
            <HarvestSalesModule
              state={state}
              onQuickAction={setQuickAction}
              onCollectHarvestPayment={(harvestId) => {
                setState((prev) => {
                  const target = prev.harvests.find((h) => h.id === harvestId);
                  if (!target) return prev;
                  const balance = Math.max(0, target.totalAmountTzs - target.paidAmountTzs);
                  return {
                    ...prev,
                    harvests: prev.harvests.map((h) =>
                      h.id === harvestId ? { ...h, paidAmountTzs: h.totalAmountTzs } : h
                    ),
                    finances: [
                      {
                        id: `fin-${Date.now()}`,
                        date: todayIso(),
                        type: 'Revenue',
                        category: 'Harvest Sales',
                        description: `Customer receivable settled – ${target.customerName} (${target.pondCode})`,
                        pondCode: target.pondCode,
                        batchCode: target.batchCode,
                        amountTzs: balance,
                        counterparty: target.customerName,
                        paymentStatus: 'Paid',
                      },
                      ...prev.finances,
                    ],
                    activities: [
                      {
                        id: `act-${Date.now()}`,
                        kind: 'payment',
                        title: `Payment received – ${target.customerName}`,
                        subtitle: `TZS ${balance.toLocaleString()}`,
                        timeAgo: 'Just now',
                      },
                      ...prev.activities,
                    ],
                  };
                });
                showToast('Customer balance settled and recorded in TZS ledger.');
              }}
            />
          )}

          {activeNav === 'inventory' && (
            <InventoryModule state={state} onQuickAction={setQuickAction} />
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
                setState((prev) => ({
                  ...prev,
                  tasks: prev.tasks.map((tk) =>
                    tk.id === taskId ? { ...tk, status: 'Completed' } : tk
                  ),
                }));
                showToast('Task marked completed.');
              }}
              onAcknowledgeAlert={(alertId) => {
                setState((prev) => ({
                  ...prev,
                  alerts: prev.alerts.map((al) =>
                    al.id === alertId ? { ...al, acknowledged: true } : al
                  ),
                }));
                showToast('Alert acknowledged.');
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
              onToggleOffline={() =>
                setState((prev) => ({ ...prev, offlineMode: !prev.offlineMode }))
              }
              onSyncNow={() =>
                setState((prev) => ({ ...prev, pendingSyncQueue: [] }))
              }
              onExportAll={() => showToast('Backup CSV exported.')}
            />
          )}
        </main>

        {/* BOTTOM TANZANIA VALUE BANNER FOOTER (Exact Reference Style) */}
        <footer className="mt-auto flex flex-wrap items-center justify-between overflow-hidden bg-gradient-to-r from-[#081D3D] via-[#0B2954] to-[#0D3366] text-white">
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

      {/* MODALS */}
      <QuickActionModals
        activeModal={quickAction}
        state={state}
        onClose={() => setQuickAction(null)}
        onRecordFeeding={handleRecordFeeding}
        onAddInventory={handleAddInventory}
        onRecordWater={handleRecordWater}
        onReportMortality={handleReportMortality}
        onRecordHarvest={handleRecordHarvest}
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
