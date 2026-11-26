import { Language } from '../types/aquaculture';

export interface AppTranslations {
  brandTagline: string;
  heroTitle: string;
  heroSubtitle: string;
  nav: {
    dashboard: string;
    farmsPonds: string;
    fishSpecies: string;
    fishStock: string;
    feeding: string;
    waterQuality: string;
    fishHealth: string;
    harvestSales: string;
    inventory: string;
    finance: string;
    employees: string;
    tasksAlerts: string;
    aquaIntelligence: string;
    settings: string;
    help: string;
  };
  kpi: {
    totalLiveFish: string;
    activePonds: string;
    feedStock: string;
    totalRevenue: string;
  };
  widgets: {
    farmOverview: string;
    waterQualityStatus: string;
    fishHealthMonitor: string;
    inventoryManagement: string;
    recentActivities: string;
    pondStatus: string;
    quickActions: string;
    salesFinance: string;
    alertsNotifications: string;
    farmMap: string;
    viewAll: string;
    viewDetails: string;
  };
  actions: {
    recordFeeding: string;
    addInventory: string;
    recordWaterQuality: string;
    reportMortality: string;
    planHarvest: string;
    quickSale: string;
    generateReport: string;
    logout: string;
    switchRole: string;
  };
  sales: {
    title: string;
    subtitle: string;
    quickSaleBtn: string;
    recordHarvestBtn: string;
    exportCsvBtn: string;
    kpiRevenue: string;
    kpiKgSold: string;
    kpiAvgPrice: string;
    kpiReceivables: string;
    tabs: {
      sales: string;
      customers: string;
      priceList: string;
      receivables: string;
      lots: string;
      preOrders: string;
    };
    steps: {
      customer: string;
      fish: string;
      pay: string;
    };
    invoice: string;
    deliveryNote: string;
    downloadPdf: string;
    shareWhatsapp: string;
    collectPayment: string;
    remind: string;
    newCustomer: string;
    convertToSale: string;
  };
  ui: {
    undo: string;
    undone: string;
    offlineBanner: string;
    pendingQueueLabel: string;
    syncNow: string;
    syncingNow: string;
    themeLabel: string;
    themeLight: string;
    themeDark: string;
    themeSystem: string;
    reduceAnimations: string;
    reduceAnimationsHint: string;
    lowEndAutoHint: string;
    mobileFeed: string;
    mobileWater: string;
    mobileSale: string;
    mobileMortality: string;
    mobileTasks: string;
    backToMenu: string;
  };
  footer: {
    p1: string;
    p2: string;
    p3: string;
    p4: string;
    slogan: string;
  };
}

export const TRANSLATIONS: Record<Language, AppTranslations> = {
  en: {
    brandTagline: 'Smart Aquaculture Management Tanzania',
    heroTitle: 'Innovative Aquaculture for a Prosperous Tanzania',
    heroSubtitle: 'Monitor • Manage • Grow',
    nav: {
      dashboard: 'Dashboard',
      farmsPonds: 'Farm & Ponds',
      fishSpecies: 'Fish & Species',
      fishStock: 'Fish Stock',
      feeding: 'Feeding Management',
      waterQuality: 'Water Quality',
      fishHealth: 'Fish Health',
      harvestSales: 'Harvest & Sales',
      inventory: 'Inventory Management',
      finance: 'Finance & Reports',
      employees: 'Employees & Roles',
      tasksAlerts: 'Tasks & Alerts',
      aquaIntelligence: 'Aqua Intelligence AI',
      settings: 'Settings',
      help: 'Help & Support',
    },
    kpi: {
      totalLiveFish: 'Total Live Fish',
      activePonds: 'Active Ponds',
      feedStock: 'Feed Stock',
      totalRevenue: 'Total Revenue',
    },
    widgets: {
      farmOverview: 'Farm Overview',
      waterQualityStatus: 'Water Quality Status',
      fishHealthMonitor: 'Fish Health Monitor',
      inventoryManagement: 'Inventory Management',
      recentActivities: 'Recent Activities',
      pondStatus: 'Pond Status',
      quickActions: 'Quick Actions',
      salesFinance: 'Sales & Finance Summary',
      alertsNotifications: 'Alerts & Notifications',
      farmMap: 'Farm Map',
      viewAll: 'View All →',
      viewDetails: 'View Details →',
    },
    actions: {
      recordFeeding: 'Record Feeding',
      addInventory: 'Add Inventory',
      recordWaterQuality: 'Record Water Quality',
      reportMortality: 'Report Mortality',
      planHarvest: 'Record Harvest Lot',
      quickSale: 'Quick Sale',
      generateReport: 'Generate Report',
      logout: 'Logout',
      switchRole: 'Switch Role',
    },
    sales: {
      title: 'Harvest Lots, Customer Sales & Receivables',
      subtitle: 'Sell graded harvest lots to multiple customers with price tiers, credit limits, payment history, invoices & delivery notes.',
      quickSaleBtn: 'Quick Sale (30s)',
      recordHarvestBtn: 'Record Harvest Lot',
      exportCsvBtn: 'Export Sales CSV',
      kpiRevenue: 'Sales Revenue',
      kpiKgSold: 'Fish Sold (kg)',
      kpiAvgPrice: 'Average Price / kg',
      kpiReceivables: 'Total Receivables',
      tabs: {
        sales: 'Sales',
        customers: 'Customers',
        priceList: 'Price List',
        receivables: 'Receivables',
        lots: 'Lots in Stock',
        preOrders: 'Pre-Orders',
      },
      steps: {
        customer: '1. Customer',
        fish: '2. Fish & Weight',
        pay: '3. Pay & Dispatch',
      },
      invoice: 'Invoice & Receipt',
      deliveryNote: 'Delivery Note',
      downloadPdf: 'Download PDF / Print',
      shareWhatsapp: 'Share via WhatsApp',
      collectPayment: 'Collect Payment',
      remind: 'Remind',
      newCustomer: 'New Customer',
      convertToSale: 'Convert to Sale',
    },
    ui: {
      undo: 'Undo',
      undone: 'Action undone.',
      offlineBanner: 'Offline field mode active — changes are saved locally on this device.',
      pendingQueueLabel: 'queued items waiting to sync',
      syncNow: 'Sync Now',
      syncingNow: 'Syncing...',
      themeLabel: 'Appearance Theme',
      themeLight: 'Light',
      themeDark: 'Dark',
      themeSystem: 'System',
      reduceAnimations: 'Reduce animations (low-end phone mode)',
      reduceAnimationsHint: 'Disables shimmer waves, count-up transitions, and parallax motion for smoother battery & low-RAM performance.',
      lowEndAutoHint: 'Auto-enabled because this device has 4 or fewer CPU cores.',
      mobileFeed: 'Feed',
      mobileWater: 'Water',
      mobileSale: 'Sale',
      mobileMortality: 'Mortality',
      mobileTasks: 'Tasks',
      backToMenu: 'Back to Menu',
    },
    footer: {
      p1: 'Higher Productivity',
      p2: 'Better Control',
      p3: 'Greater Profit',
      p4: 'Sustainable Aquaculture',
      slogan: 'Smart Farm. Healthy Fish. Prosperous Tanzania.',
    },
  },
  sw: {
    brandTagline: 'Mfumo Mahiri wa Ufugaji Samaki Tanzania',
    heroTitle: 'Ufugaji Samaki wa Kisasa kwa Tanzania yenye Mafanikio',
    heroSubtitle: 'Fuatilia • Simamia • Kua',
    nav: {
      dashboard: 'Dashibodi',
      farmsPonds: 'Mashamba na Mabwawa',
      fishSpecies: 'Samaki na Makundi',
      fishStock: 'Akiba ya Samaki',
      feeding: 'Usimamizi wa Chakula',
      waterQuality: 'Ubora wa Maji',
      fishHealth: 'Afya ya Samaki',
      harvestSales: 'Mavuno na Mauzo',
      inventory: 'Bohari na Vifaa',
      finance: 'Fedha na Ripoti',
      employees: 'Wafanyakazi na Majukumu',
      tasksAlerts: 'Kazi na Tahadhari',
      aquaIntelligence: 'Aqua Intelligence AI',
      settings: 'Mipangilio',
      help: 'Msaada na Mwongozo',
    },
    kpi: {
      totalLiveFish: 'Jumla ya Samaki Hai',
      activePonds: 'Mabwawa Yanayotumika',
      feedStock: 'Akiba ya Chakula',
      totalRevenue: 'Mapato Yote',
    },
    widgets: {
      farmOverview: 'Muhtasari wa Shamba',
      waterQualityStatus: 'Hali ya Ubora wa Maji',
      fishHealthMonitor: 'Ufuatiliaji wa Afya ya Samaki',
      inventoryManagement: 'Usimamizi wa Bohari',
      recentActivities: 'Shughuli za Hivi Karibuni',
      pondStatus: 'Hali ya Mabwawa',
      quickActions: 'Vitendo vya Haraka',
      salesFinance: 'Muhtasari wa Mauzo na Fedha',
      alertsNotifications: 'Tahadhari na Arifa',
      farmMap: 'Ramani ya Shamba',
      viewAll: 'Ona Zote →',
      viewDetails: 'Angalia Maelezo →',
    },
    actions: {
      recordFeeding: 'Rekodi Ulishaji',
      addInventory: 'Ongeza Bohari',
      recordWaterQuality: 'Rekodi Ubora wa Maji',
      reportMortality: 'Ripoti Vifo vya Samaki',
      planHarvest: 'Rekodi Mavuno (Lot)',
      quickSale: 'Uza Haraka',
      generateReport: 'Tengeneza Ripoti',
      logout: 'Ondoka',
      switchRole: 'Badilisha Wajibu',
    },
    sales: {
      title: 'Mavuno, Mauzo kwa Wateja na Madeni',
      subtitle: 'Uza mavuno kwa wateja wengi kwa bei za daraja, vikomo vya mkopo, historia ya malipo, ankara na hati za usafirishaji.',
      quickSaleBtn: 'Uza Haraka (30s)',
      recordHarvestBtn: 'Rekodi Mavuno (Lot)',
      exportCsvBtn: 'Pakua CSV ya Mauzo',
      kpiRevenue: 'Mapato ya Mauzo',
      kpiKgSold: 'Kilo Zilizouzwa',
      kpiAvgPrice: 'Bei ya Wastani / kg',
      kpiReceivables: 'Jumla ya Madeni',
      tabs: {
        sales: 'Mauzo',
        customers: 'Wateja',
        priceList: 'Orodha ya Bei',
        receivables: 'Madeni',
        lots: 'Akiba ya Mavuno',
        preOrders: 'Oda za Awali',
      },
      steps: {
        customer: '1. Mteja',
        fish: '2. Samaki na Uzito',
        pay: '3. Malipo na Usafiri',
      },
      invoice: 'Ankara na Risiti',
      deliveryNote: 'Hati ya Uwasilishaji',
      downloadPdf: 'Pakua PDF / Chapisha',
      shareWhatsapp: 'Tuma WhatsApp',
      collectPayment: 'Pokea Malipo',
      remind: 'Kumbusha',
      newCustomer: 'Mteja Mpya',
      convertToSale: 'Geuza Kuwa Mauzo',
    },
    ui: {
      undo: 'Tengua',
      undone: 'Kitendo kimetenguliwa.',
      offlineBanner: 'Hali ya nje ya mtandao — rekodi zinahifadhiwa kwenye kifaa hiki.',
      pendingQueueLabel: 'kumbukumbu zinasubiri kutumwa',
      syncNow: 'Sawazisha Sasa',
      syncingNow: 'Inasawazisha...',
      themeLabel: 'Mwonekano (Theme)',
      themeLight: 'Mwangaza',
      themeDark: 'Giza',
      themeSystem: 'Kifaa',
      reduceAnimations: 'Punguza michoro (simu za uwezo mdogo)',
      reduceAnimationsHint: 'Huzima mawimbi na michoro ya ziada ili kuokoa betri na kuongeza kasi.',
      lowEndAutoHint: 'Imewashwa kiotomatiki kwa sababu kifaa kina CPU 4 au chini.',
      mobileFeed: 'Chakula',
      mobileWater: 'Maji',
      mobileSale: 'Uza',
      mobileMortality: 'Vifo',
      mobileTasks: 'Kazi',
      backToMenu: 'Rudi kwenye Menyu',
    },
    footer: {
      p1: 'Uzalishaji Mkubwa',
      p2: 'Udhibiti Bora',
      p3: 'Faida Zaidi',
      p4: 'Ufugaji Endelevu',
      slogan: 'Shamba Mahiri. Samaki Wenye Afya. Tanzania Yenye Mafanikio.',
    },
  },
};

export function tr(language: Language, swText: string, enText: string): string {
  return language === 'sw' ? swText : enText;
}

const DOMAIN_SW_MAP: Record<string, string> = {
  // Pond & Water & Health Statuses
  Healthy: 'Salama',
  Attention: 'Tahadhari',
  Preparing: 'Maandalizi',
  'Harvest Ready': 'Tayari Kuvunwa',
  Safe: 'Salama',
  Critical: 'Hatari',
  Growing: 'Wanakua',
  'Partial Harvest': 'Mavuno ya Sehemu',
  Completed: 'Imekamilika',
  'In Stock': 'Ipo Bohari',
  'Low Stock': 'Akiba Ndogo',
  'Out of Stock': 'Imeisha Bohari',
  Paid: 'Imelipwa',
  Partial: 'Nusu',
  Credit: 'Mkopo',
  'Credit Debt': 'Deni / Mkopo',
  'Pending Debt': 'Deni Linasubiri',
  'Pending Dispatch': 'Inasubiri Kutumwa',
  'In Transit': 'Njiani',
  Delivered: 'Imefikishwa',
  Open: 'Wazi',
  Converted: 'Imekuwa Mauzo',
  Cancelled: 'Imefutwa',
  Reported: 'Imeripotiwa',
  'Technician Verified': 'Imethibitishwa na Mtaalamu',
  'Treatment Approved': 'Matibabu Yameidhinishwa',
  'Fed & Reconciled': 'Imelishwa na Kuhakikiwa',
  'Variance Flagged': 'Tofauti Imebainika',
  Approved: 'Imeidhinishwa',
  'Pending Store Issuance': 'Inasubiri Kutolewa Bohari',
  'Issued to Keeper': 'Imetolewa kwa Msimamizi',
  Pending: 'Inasubiri',
  'In Progress': 'Inaendelea',
  High: 'Juu',
  Medium: 'Wastani',
  Low: 'Chini',
  Info: 'Taarifa',
  Operational: 'Inafanya Kazi',
  Maintenance: 'Matengenezo',
  'No Stock': 'Hakuna Akiba',
  Active: 'Inafanya Kazi',

  // Fish Grades, Customer Types & Tiers
  Large: 'Kubwa',
  Small: 'Ndogo',
  Wholesale: 'Jumla',
  Wholesaler: 'Muuzaji wa Jumla',
  Retail: 'Rejareja',
  Retailer: 'Muuzaji Rejareja',
  'Hotel/HORECA': 'Hoteli / Mgahawa',
  'Hotel/Restaurant': 'Hoteli / Mgahawa',
  Market: 'Soko',
  Individual: 'Mtu Binafsi',
  Exporter: 'Msafirishaji Nje',
  Standard: 'Kawaida',
  VIP: 'VIP',
  Harvest: 'Mavuno',
  Farm: 'Shamba',

  // Payment Methods
  Cash: 'Taslimu',
  'Bank Transfer': 'Benki',
  Cheque: 'Hundi',
  'M-Pesa': 'M-Pesa',
  'Tigo Pesa': 'Tigo Pesa',
  'Airtel Money': 'Airtel Money',
  Halopesa: 'Halopesa',

  // Unit & Operation Types
  'Lined Pond': 'Bwawa la Plastiki',
  'Earthen Pond': 'Bwawa la Udongo',
  'Concrete Tank': 'Tanki la Zege',
  'Lake Cage': 'Kizimba Ziwani',
  Hatchery: 'Kitalu cha Vifaranga',
  Nursery: 'Bwawa la Kulelea',
  'Grow-out Pond': 'Bwawa la Kukuzia',
  'Cage Farming': 'Ufugaji wa Vizimba',
  'Tank Farming': 'Ufugaji wa Matanki',

  // Infrastructure Markers
  'Water Inlet': 'Mlango wa Kuingiza Maji',
  'Water Outlet': 'Mlango wa Kutoa Maji',
  'Drainage Channel': 'Mfereji wa Maji',
  Borehole: 'Kisima Kirefu',
  Pump: 'Pampu ya Maji',
  Aerator: 'Kipulizia Hewa',
  'Water Sensor': 'Kipima Maji (Sensor)',
  Feeder: 'Chombo cha Chakula',
  Generator: 'Jenereta',
  Security: 'Ulinzi',

  // Inventory & Finance Categories
  Feed: 'Chakula',
  Fingerlings: 'Vifaranga',
  Medicine: 'Dawa',
  Fuel: 'Mafuta',
  Equipment: 'Vifaa',
  Revenue: 'Mapato',
  Expense: 'Matumizi',
  'Harvest Sales': 'Mauzo ya Mavuno',
  'Feed Purchase': 'Ununuzi wa Chakula',
  'Fingerling Purchase': 'Ununuzi wa Vifaranga',
  'Medicine & Treatments': 'Dawa na Matibabu',
  'Salaries & Labor': 'Mishahara na Vibaruwa',
  'Fuel & Electricity': 'Mafuta na Umeme',
  'Equipment Maintenance': 'Matengenezo ya Vifaa',

  // Roles
  owner: 'Mmiliki wa Shamba',
  manager: 'Meneja wa Shamba',
  technician: 'Mtaalamu wa Samaki',
  keeper: 'Msimamizi wa Bwawa',
  storekeeper: 'Mtunza Bohari',
  'Farm Owner': 'Mmiliki wa Shamba',
  'Farm Manager': 'Meneja wa Shamba',
  'Fisheries Technician': 'Mtaalamu wa Samaki',
  'Pond Keeper': 'Msimamizi wa Bwawa',
  Storekeeper: 'Mtunza Bohari',

  // GIS & Sources
  'Satellite Drawing': 'Mchoro wa Satelaiti',
  'GPS Boundary Walk': 'Kutembea Mpaka wa GPS',
  'GPX/GeoJSON Import': 'Upakiaji GPX/GeoJSON',
  'Registry Seed': 'Usajili wa Awali',
  'Manual Stock': 'Akiba ya Mkono',
  'Manual (Mobile)': 'Kipimo cha Mkono (Simu)',
  'Bluetooth Meter': 'Kipima cha Bluetooth',
  'IoT ESP32 Sensor': 'Sensor ya IoT ESP32',

  // Relative time
  'Just now': 'Sasa hivi',
};

export function tDomain(language: Language, value?: string | null): string {
  if (!value) return '';
  if (language === 'en') return value;
  if (DOMAIN_SW_MAP[value]) return DOMAIN_SW_MAP[value];
  // Handle relative time phrases from seed data gracefully
  if (/^\d+\s+mins?\s+ago$/i.test(value)) {
    return `Dakika ${value.replace(/\D+/g, '')} zilizopita`;
  }
  if (/^\d+\s+hours?\s+ago$/i.test(value)) {
    return `Saa ${value.replace(/\D+/g, '')} zilizopita`;
  }
  if (/^\d+\s+days?\s+ago$/i.test(value)) {
    return `Siku ${value.replace(/\D+/g, '')} zilizopita`;
  }
  return value;
}
