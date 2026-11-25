export type UserRole = 'owner' | 'manager' | 'technician' | 'keeper' | 'storekeeper';

export type Language = 'en' | 'sw';

export type NavSection =
  | 'dashboard'
  | 'farms-ponds'
  | 'fish-species'
  | 'feeding'
  | 'water-quality'
  | 'fish-health'
  | 'harvest-sales'
  | 'inventory'
  | 'finance'
  | 'employees'
  | 'tasks-alerts'
  | 'aqua-intelligence'
  | 'settings'
  | 'help';

export type OperationType =
  | 'Hatchery'
  | 'Nursery'
  | 'Grow-out Pond'
  | 'Cage Farming'
  | 'Tank Farming'
  | 'Processing'
  | 'Distribution';

export interface Employee {
  id: string;
  name: string;
  role: UserRole;
  roleLabel: string;
  phone: string;
  assignedFarmId: string;
  assignedPondIds: string[];
  pin: string; // 4-digit digital signature PIN
  online: boolean;
  attendanceToday: 'Present' | 'Field' | 'Off';
  reportsSubmittedToday: number;
  avatarUrl?: string;
}

export interface Farm {
  id: string;
  name: string;
  region: string;
  gps: [number, number]; // [lat, lng]
  operationTypes: OperationType[];
  waterSource: string;
  drainageSystem: string;
  fircisPermitNo: string;
  equipment: {
    id: string;
    name: string;
    type: 'Pump' | 'Aerator' | 'Generator' | 'Water Kit' | 'Feeder' | 'IoT Gateway';
    status: 'Operational' | 'Maintenance' | 'Standby';
    lastServiceDate: string;
  }[];
  managerId: string;
}

export interface Pond {
  id: string;
  code: string; // e.g. POND-001
  name: string; // e.g. Pond 1
  farmId: string;
  unitType: 'Earthen Pond' | 'Lined Pond' | 'Concrete Tank' | 'Lake Cage';
  operationStage: OperationType;
  species: string;
  currentFish: number;
  maxCapacity: number;
  dimensions: string;
  waterCapacityM3: number;
  status: 'Healthy' | 'Attention' | 'Preparing' | 'Harvest Ready';
  readinessPct: number;
  assignedKeeperId: string;
  assignedTechnicianId: string;
  gps: [number, number];
  polygon: [number, number][];
  aeratorRelayOn: boolean;
  qrCodeToken: string;
}

export interface SpeciesInfo {
  id: string;
  commonName: string;
  swahiliName: string;
  scientificName: string;
  category: 'Freshwater Finfish' | 'Marine Finfish' | 'Seaweed';
  optimalTempRange: string;
  optimalDoMin: number;
  optimalPhRange: string;
  typicalCycleDays: number;
  fircisPermitted: boolean;
  regulatoryNote: string;
}

export interface BatchEvent {
  id: string;
  step: number;
  title: string;
  detail: string;
  date: string;
  actor: string;
}

export interface BatchMovement {
  id: string;
  batchId: string;
  fromPondCode: string;
  toPondCode: string;
  fishCount: number;
  avgWeightGrams: number;
  date: string;
  reason: string;
  approvedBy: string;
}

export interface FishBatch {
  id: string;
  batchCode: string; // e.g. TIL-2026-001
  species: string;
  scientificName: string;
  sourceHatchery: string;
  supplier: string;
  pondId: string;
  pondCode: string;
  initialStocking: number;
  currentEstimatedFish: number;
  physicallyVerifiedFish: number;
  lastVerifiedDate: string;
  avgInitialWeightG: number;
  currentAvgWeightG: number;
  stockingDate: string;
  plannedHarvestDate: string;
  responsibleKeeper: string;
  status: 'Growing' | 'Harvest Ready' | 'Partial Harvest' | 'Completed';
  feedConsumedKg: number;
  totalMortality: number;
  history: BatchEvent[];
}

export interface GrowthSample {
  id: string;
  batchId: string;
  pondCode: string;
  date: string;
  sampleSize: number;
  avgWeightG: number;
  adgGramsPerDay: number;
  estimatedBiomassKg: number;
  recordedBy: string;
}

export interface FeedIssuance {
  id: string;
  date: string;
  time: string;
  pondCode: string;
  batchCode: string;
  feedType: string;
  approvedKg: number;
  issuedByStorekeeperKg: number;
  confirmedReceivedKg: number | null;
  actualFedKg: number | null;
  varianceKg: number;
  varianceFlagged: boolean;
  approvedBy: string;
  storekeeper: string;
  keeper: string;
  status: 'Issued' | 'Received' | 'Fed & Reconciled' | 'Variance Flagged';
  signedPinHash?: string;
}

export interface WaterQualityReading {
  id: string;
  pondCode: string;
  farmId: string;
  timestamp: string;
  ph: number;
  dissolvedOxygen: number; // mg/L
  temperature: number; // °C
  ammonia: number; // mg/L NH3
  nitrite: number; // mg/L NO2
  transparencyCm: number;
  waterLevelPct: number;
  sourceLevel: 'Manual (Mobile)' | 'Bluetooth Meter' | 'IoT ESP32 Sensor';
  instrument: string;
  recordedBy: string;
  status: 'Safe' | 'Attention' | 'Critical';
  aeratorTriggered: boolean;
}

export interface HealthIncident {
  id: string;
  pondCode: string;
  batchCode: string;
  dateTime: string;
  deadCount: number;
  affectedCount: number;
  symptoms: string;
  waterSnapshot: string;
  photoDataUrl?: string;
  reportedBy: string;
  technicianObservation?: string;
  suspectedDiagnosis?: string;
  prescribedTreatment?: string;
  withdrawalDays?: number;
  treatmentApprovedBy?: string;
  status: 'Reported' | 'Technician Verified' | 'Treatment Approved' | 'Resolved';
  lockedDeletion: true; // Keepers cannot delete mortality records
}

export interface InventoryItem {
  id: string;
  name: string;
  category: 'Feed' | 'Fingerlings' | 'Medicine' | 'Fuel' | 'Equipment';
  stock: number;
  unit: string;
  reorderLevel: number;
  unitCostTzs: number;
  batchOrLot: string;
  supplier: string;
  expiryDate?: string;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
}

export interface StockPurchaseRecord {
  id: string;
  date: string;
  itemName: string;
  category: 'Feed' | 'Fingerlings' | 'Medicine' | 'Fuel' | 'Equipment';
  quantity: number;
  unit: string;
  unitCostTzs: number;
  totalCostTzs: number;
  supplier: string;
  lotNumber: string;
  paymentStatus: 'Paid' | 'Credit Debt' | 'Partial';
  recordedBy: string;
}

export interface HarvestRecord {
  id: string;
  date: string;
  pondCode: string;
  batchCode: string;
  species: string;
  totalFishHarvested: number;
  totalWeightKg: number;
  grades: {
    largeCount: number;
    largeKg: number;
    mediumCount: number;
    mediumKg: number;
    smallCount: number;
    smallKg: number;
    damagedKg: number;
  };
  customerName: string;
  customerPhone: string;
  pricePerKgTzs: number;
  totalAmountTzs: number;
  paidAmountTzs: number;
  deliveryStatus: 'Delivered' | 'In Transit' | 'Pending Dispatch';
  approvedBy: string;
}

export interface FinanceTransaction {
  id: string;
  date: string;
  type: 'Revenue' | 'Expense';
  category:
    | 'Harvest Sales'
    | 'Fingerling Purchase'
    | 'Feed Purchase'
    | 'Salaries & Allowances'
    | 'Fuel & Electricity'
    | 'Equipment Maintenance'
    | 'Medicine & Treatments'
    | 'Transport'
    | 'Pond Repairs';
  description: string;
  pondCode?: string;
  batchCode?: string;
  amountTzs: number;
  counterparty: string;
  paymentStatus: 'Paid' | 'Pending Debt' | 'Partial';
}

export interface FarmTask {
  id: string;
  title: string;
  pondCode: string;
  assignedTo: string;
  role: UserRole;
  dueTime: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'Completed';
}

export interface SystemAlert {
  id: string;
  severity: 'High' | 'Medium' | 'Info' | 'Success';
  title: string;
  detail: string;
  pondCode?: string;
  timeAgo: string;
  acknowledged: boolean;
  assignedTo?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: UserRole;
  module: string;
  action: string;
  details: string;
  reason?: string;
  pinVerified: boolean;
}

export interface ActivityFeedItem {
  id: string;
  kind: 'feeding' | 'water' | 'harvest' | 'purchase' | 'payment' | 'mortality';
  title: string;
  subtitle: string;
  timeAgo: string;
}

export interface PendingSyncItem {
  id: string;
  createdAt: string;
  module: string;
  summary: string;
}

export interface AquacultureState {
  activeUser: Employee;
  employees: Employee[];
  farms: Farm[];
  ponds: Pond[];
  speciesCatalogue: SpeciesInfo[];
  batches: FishBatch[];
  movements: BatchMovement[];
  growthSamples: GrowthSample[];
  feedIssuances: FeedIssuance[];
  waterReadings: WaterQualityReading[];
  healthIncidents: HealthIncident[];
  inventory: InventoryItem[];
  stockPurchases: StockPurchaseRecord[];
  harvests: HarvestRecord[];
  finances: FinanceTransaction[];
  tasks: FarmTask[];
  alerts: SystemAlert[];
  auditLogs: AuditLogEntry[];
  activities: ActivityFeedItem[];
  offlineMode: boolean;
  pendingSyncQueue: PendingSyncItem[];
  esp32AutoMode: boolean;
}
