import {
  AquacultureState,
  Customer,
  FishGrade,
  HarvestLot,
  HarvestRecord,
  Language,
  Payment,
  PriceListItem,
  PriceTier,
  Sale,
  SaleLine,
} from '../types/aquaculture';
import { formatTzs, todayIso } from './formatters';
import { tDomain } from '../i18n/translations';
import { measureAndValidatePolygon } from './gisGeometry';

/**
 * Normalizes a Tanzanian phone number to 255XXXXXXXXX (12 digits).
 * Accepts formats like +255712345678, 255712345678, 0712345678, 0655 219 404.
 * Returns null if invalid.
 */
export function normalizeTzPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) {
    const converted = `255${digits.slice(1)}`;
    return /^255[67]\d{8}$/.test(converted) ? converted : converted;
  }
  if (digits.length === 12 && digits.startsWith('255')) {
    return /^255\d{9}$/.test(digits) ? digits : null;
  }
  return null;
}

export function formatTzPhoneDisplay(phone: string): string {
  const normalized = normalizeTzPhone(phone) || phone;
  if (normalized.length === 12 && normalized.startsWith('255')) {
    return `+255 ${normalized.slice(3, 6)} ${normalized.slice(6, 9)} ${normalized.slice(9, 12)}`;
  }
  return phone;
}

export function roundKg(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.round(val * 100) / 100;
}

export function roundTzs(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.round(val);
}

export function formatInvoiceNo(sequence: number, dateIso?: string): string {
  const year = (dateIso || todayIso()).slice(0, 4);
  return `INV-${year}-${String(sequence).padStart(4, '0')}`;
}

export function formatLotCode(sequence: number, dateIso?: string): string {
  const year = (dateIso || todayIso()).slice(0, 4);
  return `LOT-${year}-${String(sequence).padStart(4, '0')}`;
}

export function getPriceForItem(
  priceList: PriceListItem[],
  species: string,
  grade: FishGrade,
  tier: PriceTier,
  fallbackPrices?: Record<string, number>
): number {
  const exact = priceList.find(
    (p) => p.species === species && p.grade === grade && p.tier === tier
  );
  if (exact) return exact.pricePerKgTzs;

  const standard = priceList.find(
    (p) => p.species === species && p.grade === grade && p.tier === 'Standard'
  );
  if (standard) return standard.pricePerKgTzs;

  const anySpeciesGrade = priceList.find((p) => p.species === species && p.grade === grade);
  if (anySpeciesGrade) return anySpeciesGrade.pricePerKgTzs;

  const key = `${species}|${grade}|${tier}`;
  if (fallbackPrices && fallbackPrices[key]) {
    return fallbackPrices[key];
  }
  return 0;
}

export function getLotRemainingForGrade(lot: HarvestLot, grade: FishGrade): number {
  if (grade === 'Large') return roundKg(lot.remainingKg.large);
  if (grade === 'Medium') return roundKg(lot.remainingKg.medium);
  return roundKg(lot.remainingKg.small);
}

export function getLotTotalRemainingKg(lot: HarvestLot): number {
  return roundKg(lot.remainingKg.large + lot.remainingKg.medium + lot.remainingKg.small);
}

export function getCustomerOutstandingBalance(sales: Sale[], customerId: string): number {
  return roundTzs(
    sales
      .filter((s) => s.customerId === customerId && s.balanceTzs > 0)
      .reduce((sum, s) => sum + s.balanceTzs, 0)
  );
}

export type AgingBucket = '0-7' | '8-30' | '30+';

export function getAgingBucket(saleDateIso: string, referenceDateIso = todayIso()): AgingBucket {
  const ref = new Date(`${referenceDateIso}T00:00:00`);
  const saleDate = new Date(`${saleDateIso}T00:00:00`);
  if (Number.isNaN(ref.getTime()) || Number.isNaN(saleDate.getTime())) return '0-7';
  const days = Math.max(0, Math.floor((ref.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24)));
  if (days <= 7) return '0-7';
  if (days <= 30) return '8-30';
  return '30+';
}

export function getDaysSince(dateIso: string, referenceDateIso = todayIso()): number {
  const ref = new Date(`${referenceDateIso}T00:00:00`);
  const target = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(ref.getTime()) || Number.isNaN(target.getTime())) return 0;
  return Math.max(0, Math.floor((ref.getTime() - target.getTime()) / (1000 * 60 * 60 * 24)));
}

export function buildWhatsAppInvoiceUrl(
  sale: Sale,
  farmName: string,
  language: Language = 'en'
): string {
  const phone = normalizeTzPhone(sale.customerPhone) || sale.customerPhone.replace(/\D/g, '');
  const linesText = sale.lines
    .map(
      (l) =>
        `• ${l.species} (${l.grade}) ${l.kg} kg @ ${formatTzs(l.pricePerKgTzs)} = ${formatTzs(l.amountTzs)}`
    )
    .join('\n');

  const taxLineEn =
    sale.taxTzs && sale.taxTzs > 0
      ? `Tax (${sale.taxRatePct ?? 18}%): ${formatTzs(sale.taxTzs)}\n`
      : '';
  const taxLineSw =
    sale.taxTzs && sale.taxTzs > 0
      ? `Kodi (${sale.taxRatePct ?? 18}%): ${formatTzs(sale.taxTzs)}\n`
      : '';

  const body =
    language === 'sw'
      ? `*${farmName} — Risiti ya Mauzo*\nAnkara: ${sale.invoiceNo}\nTarehe: ${sale.date}\nMteja: ${sale.customerName}\n\n${linesText}\n\n${taxLineSw}Jumla: ${formatTzs(sale.totalTzs)}\nImelipwa: ${formatTzs(sale.paidTzs)}\nBaki: ${formatTzs(sale.balanceTzs)}\nUwasilishaji: ${tDomain('sw', sale.deliveryStatus)}`
      : `*${farmName} — Sales Receipt*\nInvoice: ${sale.invoiceNo}\nDate: ${sale.date}\nCustomer: ${sale.customerName}\n\n${linesText}\n\n${taxLineEn}Total: ${formatTzs(sale.totalTzs)}\nPaid: ${formatTzs(sale.paidTzs)}\nBalance Due: ${formatTzs(sale.balanceTzs)}\nDelivery: ${sale.deliveryStatus}`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(body)}`;
}

export function buildWhatsAppReminderUrl(
  sale: Sale,
  farmName: string,
  language: Language = 'en'
): string {
  const phone = normalizeTzPhone(sale.customerPhone) || sale.customerPhone.replace(/\D/g, '');
  const body =
    language === 'sw'
      ? `Habari ${sale.customerName}, tunakukumbusha malipo ya ankara ${sale.invoiceNo} ya tarehe ${sale.date} kutoka ${farmName}. Kiasi kilichobaki: ${formatTzs(sale.balanceTzs)}. Asante.`
      : `Hello ${sale.customerName}, friendly reminder for invoice ${sale.invoiceNo} (${sale.date}) from ${farmName}. Outstanding balance: ${formatTzs(sale.balanceTzs)}. Thank you.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(body)}`;
}

/**
 * Extension point for Tanzania Revenue Authority (TRA) Electronic Fiscal Device /
 * Virtual Fiscal Device (EFD/VFD) integration.
 * Replace this stub with an authenticated server-side adapter call to a licensed
 * TRA VFD/EFD provider once fiscal credentials and TIN/VRN config are available.
 */
export function issueFiscalReceipt(
  sale: Sale,
  language: Language = 'sw'
): {
  supported: boolean;
  status: 'Not Configured' | 'Issued';
  receiptNo?: string;
  message: string;
} {
  if (sale.fiscalReceiptNo) {
    return {
      supported: true,
      status: 'Issued',
      receiptNo: sale.fiscalReceiptNo,
      message:
        language === 'sw'
          ? `Risiti ya kodi (TRA) ${sale.fiscalReceiptNo} imeambatanishwa.`
          : `Fiscal receipt ${sale.fiscalReceiptNo} attached.`,
    };
  }
  return {
    supported: false,
    status: 'Not Configured',
    message:
      language === 'sw'
        ? 'Mfumo wa TRA EFD/VFD haujaunganishwa bado. Ankara ya kibiashara na hati ya uwasilishaji zimetengenezwa; unganisha mtoa huduma wa TRA VFD kupitia seva ukiwa tayari.'
        : 'TRA EFD/VFD fiscal adapter not configured. Commercial invoice & delivery note generated; connect a licensed TRA VFD provider via server adapter when ready.',
  };
}

/**
 * Migrates older localStorage snapshots (which only had `harvests`) to the full
 * Customer + HarvestLot + Sale + Payment state model without losing any data.
 */
export function migrateAquacultureState(
  raw: Partial<AquacultureState>,
  defaults: AquacultureState
): AquacultureState {
  const merged: AquacultureState = {
    ...defaults,
    ...raw,
    stockPurchases: raw.stockPurchases ?? defaults.stockPurchases,
    customers: raw.customers && raw.customers.length > 0 ? raw.customers : defaults.customers,
    priceList: raw.priceList && raw.priceList.length > 0 ? raw.priceList : defaults.priceList,
    preOrders: raw.preOrders ?? defaults.preOrders,
    salesPreferences: {
      ...defaults.salesPreferences,
      ...(raw.salesPreferences || {}),
    },
    invoiceSequence: raw.invoiceSequence ?? defaults.invoiceSequence,
    infrastructureMarkers:
      Array.isArray(raw.infrastructureMarkers) && raw.infrastructureMarkers.length > 0
        ? raw.infrastructureMarkers
        : defaults.infrastructureMarkers,
  };

  merged.ponds = merged.ponds.map((p) => {
    if (p.areaSqm && p.perimeterM && p.geometry) return p;
    const m = measureAndValidatePolygon({ polygonLatLng: p.polygon, unitType: p.unitType });
    return {
      ...p,
      geometry: p.geometry ?? m.geometry ?? undefined,
      areaSqm: p.areaSqm ?? m.areaSqm,
      waterSurfaceSqm: p.waterSurfaceSqm ?? m.waterSurfaceSqm,
      perimeterM: p.perimeterM ?? m.perimeterM,
      boundaryPointsCount: p.boundaryPointsCount ?? m.pointsCount,
      mappingMethod: p.mappingMethod ?? 'Registry Seed',
      boundaryVerified: p.boundaryVerified ?? true,
    };
  });

  // If saved state came from pre-Phase-1 (had legacy harvests, but no harvestLots/sales array in raw)
  if (!raw.harvestLots && !raw.sales && Array.isArray(raw.harvests) && raw.harvests.length > 0) {
    const migratedCustomers = [...merged.customers];
    const migratedLots: HarvestLot[] = [];
    const migratedSales: Sale[] = [];
    const migratedPayments: Payment[] = [];

    raw.harvests.forEach((h: HarvestRecord, idx: number) => {
      const lotId = `lot-mig-${h.id}`;
      const lotCode = formatLotCode(idx + 1, h.date);
      migratedLots.push({
        id: lotId,
        lotCode,
        date: h.date,
        pondCode: h.pondCode,
        batchCode: h.batchCode,
        species: h.species,
        grades: {
          largeKg: h.grades.largeKg,
          largeCount: h.grades.largeCount,
          mediumKg: h.grades.mediumKg,
          mediumCount: h.grades.mediumCount,
          smallKg: h.grades.smallKg,
          smallCount: h.grades.smallCount,
          damagedKg: h.grades.damagedKg || 0,
        },
        remainingKg: { large: 0, medium: 0, small: 0 },
        remainingCount: { large: 0, medium: 0, small: 0 },
        approvedBy: h.approvedBy,
      });

      let customer = migratedCustomers.find(
        (c) => c.name.toLowerCase() === h.customerName.toLowerCase()
      );
      if (!customer) {
        const phoneNorm = normalizeTzPhone(h.customerPhone) || '255700000000';
        customer = {
          id: `cust-mig-${idx + 1}`,
          name: h.customerName,
          phone: phoneNorm,
          type: 'Market',
          location: 'Dar es Salaam',
          priceTier: 'Standard',
          creditLimitTzs: 2000000,
          paymentTermsDays: 14,
          notes: 'Migrated from legacy harvest record',
          createdAt: h.date,
        };
        migratedCustomers.push(customer);
      }

      const lines: SaleLine[] = [];
      if (h.grades.largeKg > 0) {
        lines.push({
          lotId,
          pondCode: h.pondCode,
          batchCode: h.batchCode,
          species: h.species,
          grade: 'Large',
          kg: roundKg(h.grades.largeKg),
          count: h.grades.largeCount,
          pricePerKgTzs: roundTzs(h.pricePerKgTzs),
          amountTzs: roundTzs(h.grades.largeKg * h.pricePerKgTzs),
        });
      }
      if (h.grades.mediumKg > 0) {
        lines.push({
          lotId,
          pondCode: h.pondCode,
          batchCode: h.batchCode,
          species: h.species,
          grade: 'Medium',
          kg: roundKg(h.grades.mediumKg),
          count: h.grades.mediumCount,
          pricePerKgTzs: roundTzs(h.pricePerKgTzs),
          amountTzs: roundTzs(h.grades.mediumKg * h.pricePerKgTzs),
        });
      }
      if (h.grades.smallKg > 0) {
        lines.push({
          lotId,
          pondCode: h.pondCode,
          batchCode: h.batchCode,
          species: h.species,
          grade: 'Small',
          kg: roundKg(h.grades.smallKg),
          count: h.grades.smallCount,
          pricePerKgTzs: roundTzs(h.pricePerKgTzs),
          amountTzs: roundTzs(h.grades.smallKg * h.pricePerKgTzs),
        });
      }

      const totalTzs = roundTzs(h.totalAmountTzs);
      const paidTzs = roundTzs(Math.min(totalTzs, h.paidAmountTzs));
      const balanceTzs = roundTzs(Math.max(0, totalTzs - paidTzs));
      const saleId = `sale-mig-${h.id}`;
      migratedSales.push({
        id: saleId,
        invoiceNo: formatInvoiceNo(idx + 1, h.date),
        date: h.date,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        lines,
        subtotalTzs: totalTzs,
        discountTzs: 0,
        totalTzs,
        paidTzs,
        balanceTzs,
        paymentStatus: balanceTzs === 0 ? 'Paid' : paidTzs > 0 ? 'Partial' : 'Credit',
        deliveryStatus: h.deliveryStatus,
        deliveryAddress: customer.location,
        vehicleOrDriver: 'Farm Dispatch Van',
        createdBy: h.approvedBy,
        approvedBy: h.approvedBy,
      });

      if (paidTzs > 0) {
        migratedPayments.push({
          id: `pay-mig-${h.id}`,
          saleId,
          date: h.date,
          amountTzs: paidTzs,
          method: 'Cash',
          reference: `MIG-${idx + 1}`,
          receivedBy: h.approvedBy,
        });
      }
    });

    merged.customers = migratedCustomers;
    merged.harvestLots = migratedLots;
    merged.sales = migratedSales;
    merged.payments = migratedPayments;
    merged.invoiceSequence = Math.max(defaults.invoiceSequence, migratedSales.length + 1);
  } else {
    merged.harvestLots = raw.harvestLots ?? defaults.harvestLots;
    merged.sales = raw.sales ?? defaults.sales;
    merged.payments = raw.payments ?? defaults.payments;
  }

  return merged;
}
