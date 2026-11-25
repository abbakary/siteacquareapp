import { Language } from '../types/aquaculture';

export const TRANSLATIONS: Record<
  Language,
  {
    brandTagline: string;
    heroTitle: string;
    heroSubtitle: string;
    nav: {
      dashboard: string;
      farmsPonds: string;
      fishSpecies: string;
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
      generateReport: string;
      logout: string;
      switchRole: string;
    };
    footer: {
      p1: string;
      p2: string;
      p3: string;
      p4: string;
      slogan: string;
    };
  }
> = {
  en: {
    brandTagline: 'Smart Aquaculture Management Tanzania',
    heroTitle: 'Innovative Aquaculture for a Prosperous Tanzania',
    heroSubtitle: 'Monitor • Manage • Grow',
    nav: {
      dashboard: 'Dashboard',
      farmsPonds: 'Farm & Ponds',
      fishSpecies: 'Fish & Species',
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
      planHarvest: 'Plan Harvest',
      generateReport: 'Generate Report',
      logout: 'Logout',
      switchRole: 'Switch Role',
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
      planHarvest: 'Panga Mavuno',
      generateReport: 'Tengeneza Ripoti',
      logout: 'Ondoka',
      switchRole: 'Badilisha Wajibu',
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
