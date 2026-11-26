import React, { useState } from 'react';
import {
  Printer,
  Share2,
  FileText,
  Truck,
  CheckCircle2,
  CreditCard,
  ShieldCheck,
  X,
} from 'lucide-react';
import { AquacultureState, Language, Sale } from '../../types/aquaculture';
import { formatNumber, formatTzs } from '../../utils/formatters';
import {
  buildWhatsAppInvoiceUrl,
  formatTzPhoneDisplay,
  issueFiscalReceipt,
} from '../../utils/sales';
import { TRANSLATIONS, tDomain, tr } from '../../i18n/translations';
import { AnimatedTabs, Button, Sheet } from '../../ui';

interface InvoiceReceiptModalProps {
  sale: Sale | null;
  state: AquacultureState;
  language: Language;
  onClose: () => void;
  onCollectPayment?: (sale: Sale) => void;
}

export const InvoiceReceiptModal: React.FC<InvoiceReceiptModalProps> = ({
  sale,
  state,
  language,
  onClose,
  onCollectPayment,
}) => {
  const [docMode, setDocMode] = useState<'invoice' | 'delivery'>('invoice');
  const t = TRANSLATIONS[language];

  const renderGradeLabel = (grade: string) =>
    grade === 'Large'
      ? tr(language, 'Kubwa', 'Large')
      : grade === 'Medium'
        ? tr(language, 'Saizi ya Kati', 'Medium')
        : tr(language, 'Ndogo', 'Small');

  const renderContent = () => {
    if (!sale) return null;

    const farm = state.farms[0];
    const customer = state.customers.find((c) => c.id === sale.customerId);
    const salePayments = state.payments.filter((p) => p.saleId === sale.id);
    const fiscalInfo = issueFiscalReceipt(sale, language);
    const totalKg = sale.lines.reduce((s, l) => s + l.kg, 0);
    const totalCount = sale.lines.reduce((s, l) => s + l.count, 0);
    const waUrl = buildWhatsAppInvoiceUrl(sale, farm?.name || 'DukaAquSmart Farm', language);

    return (
      <div className="flex flex-col">
        {/* Top Action Bar (hidden when printing) */}
        <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
          <AnimatedTabs
            layoutId="invoice-doc-mode"
            size="sm"
            activeId={docMode}
            onChange={setDocMode}
            tabs={[
              {
                id: 'invoice',
                label: t.sales.invoice,
                icon: <FileText className="h-3.5 w-3.5" />,
              },
              {
                id: 'delivery',
                label: t.sales.deliveryNote,
                icon: <Truck className="h-3.5 w-3.5" />,
              },
            ]}
          />

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.print()}
            >
              <Printer className="h-3.5 w-3.5 text-blue-600 dark:text-sky-400" />
              <span className="hidden sm:inline">{t.sales.downloadPdf}</span>
              <span className="sm:hidden">PDF</span>
            </Button>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[10px] bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>WhatsApp</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label={tr(language, 'Funga risiti', 'Close receipt')}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Body (Paper white for faithful PDF/print output) */}
        <div
          id="printable-invoice-sheet"
          className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-800 dark:border-slate-700 sm:p-5"
        >
          {/* Farm & Document Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-slate-900 pb-4">
            <div>
              <div className="font-display text-lg font-extrabold tracking-tight text-[#081C3A]">
                DukaAquSmart — {farm?.name || 'Kigamboni Aquaculture Park'}
              </div>
              <div className="mt-0.5 text-slate-600">
                {farm?.region || 'Dar es Salaam'}, Tanzania · {tr(language, 'Kibali cha FiRCIS:', 'FiRCIS Permit:')}{' '}
                <span className="font-mono font-semibold">{farm?.fircisPermitNo || 'FiRCIS-TZ-2026'}</span>
              </div>
              <div className="mt-0.5 text-slate-500">
                {tr(language, 'Imetolewa na:', 'Issued by:')} {sale.createdBy} ·{' '}
                {tr(language, 'Imeidhinishwa na:', 'Approved by:')} {sale.approvedBy}
              </div>
            </div>
            <div className="text-right">
              <div className="inline-block rounded bg-[#081C3A] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                {docMode === 'invoice'
                  ? language === 'sw'
                    ? 'ANKARA NA RISITI YA MAUZO'
                    : 'SALES INVOICE & RECEIPT'
                  : language === 'sw'
                    ? 'HATI YA UWASILISHAJI'
                    : 'DELIVERY NOTE'}
              </div>
              <div className="mt-1.5 font-mono text-sm font-extrabold text-slate-900">
                {sale.invoiceNo}
              </div>
              <div className="text-slate-500 tabular-nums">
                {tr(language, 'Tarehe:', 'Date:')} {sale.date}
              </div>
            </div>
          </div>

          {/* Customer & Dispatch Meta */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {language === 'sw' ? 'Mteja / Mnunuzi' : 'Bill To / Buyer'}
              </div>
              <div className="mt-1 text-sm font-bold text-slate-900">{sale.customerName}</div>
              <div className="mt-0.5 font-mono text-slate-700">
                {formatTzPhoneDisplay(sale.customerPhone)}
              </div>
              {customer && (
                <div className="mt-0.5 text-slate-500">
                  {tDomain(language, customer.type)} · {tr(language, 'Daraja:', 'Tier:')}{' '}
                  <strong>{tDomain(language, customer.priceTier)}</strong> · {customer.location}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {language === 'sw' ? 'Usafirishaji na Hali' : 'Dispatch & Status'}
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="font-bold text-slate-900">{tDomain(language, sale.deliveryStatus)}</span>
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                    sale.paymentStatus === 'Paid'
                      ? 'bg-emerald-100 text-emerald-800'
                      : sale.paymentStatus === 'Partial'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {tDomain(language, sale.paymentStatus)}
                </span>
              </div>
              <div className="mt-1 text-slate-600">
                {tr(language, 'Anwani:', 'Address:')}{' '}
                <strong>{sale.deliveryAddress || tr(language, 'Kuchukulia Shambani', 'Farm Gate Pickup')}</strong>
              </div>
              <div className="text-slate-600">
                {tr(language, 'Gari / Dereva:', 'Vehicle / Driver:')}{' '}
                <strong>{sale.vehicleOrDriver || tr(language, 'Mteja Anachukua', 'Customer Pickup')}</strong>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b-2 border-slate-200 text-[11px] font-bold text-slate-600">
                  <th className="py-2">{tr(language, 'Spishi na Daraja', 'Species & Grade')}</th>
                  <th className="py-2">{tr(language, 'Bwawa / Kundi', 'Pond / Batch')}</th>
                  <th className="py-2 text-right">{tr(language, 'Idadi ya Samaki', 'Fish Qty')}</th>
                  <th className="py-2 text-right">{tr(language, 'Uzito (kg)', 'Weight (kg)')}</th>
                  {docMode === 'invoice' && (
                    <>
                      <th className="py-2 text-right">{tr(language, 'Bei/kg', 'Price/kg')}</th>
                      <th className="py-2 text-right">{tr(language, 'Kiasi (TZS)', 'Amount (TZS)')}</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sale.lines.map((line, idx) => (
                  <tr key={`${line.lotId}-${line.grade}-${idx}`}>
                    <td className="py-2.5 font-bold text-slate-900">
                      {tDomain(language, line.species)}{' '}
                      <span className="font-semibold text-blue-700">({renderGradeLabel(line.grade)})</span>
                    </td>
                    <td className="py-2.5 text-slate-600">
                      {line.pondCode} · <span className="font-mono text-[11px]">{line.batchCode}</span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {line.count > 0 ? formatNumber(line.count) : '—'}
                    </td>
                    <td className="py-2.5 text-right font-bold tabular-nums">{line.kg.toFixed(2)} kg</td>
                    {docMode === 'invoice' && (
                      <>
                        <td className="py-2.5 text-right tabular-nums">
                          {formatTzs(line.pricePerKgTzs)}
                        </td>
                        <td className="py-2.5 text-right font-bold text-slate-900 tabular-nums">
                          {formatTzs(line.amountTzs)}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 font-bold text-slate-900">
                  <td colSpan={2} className="py-2.5">
                    {tr(
                      language,
                      `Jumla (vipengee ${sale.lines.length})`,
                      `Total (${sale.lines.length} line${sale.lines.length === 1 ? '' : 's'})`
                    )}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    {totalCount > 0 ? formatNumber(totalCount) : '—'}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{totalKg.toFixed(2)} kg</td>
                  {docMode === 'invoice' && (
                    <>
                      <td className="py-2.5" />
                      <td className="py-2.5 text-right tabular-nums">{formatTzs(sale.subtotalTzs)}</td>
                    </>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>

          {docMode === 'invoice' ? (
            <>
              {/* Financial Totals */}
              <div className="mt-4 flex flex-col items-end">
                <div className="w-full space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 sm:w-72">
                  <div className="flex justify-between text-slate-600">
                    <span>{tr(language, 'Jumla Ndogo', 'Subtotal')}</span>
                    <span className="font-semibold tabular-nums">{formatTzs(sale.subtotalTzs)}</span>
                  </div>
                  {sale.discountTzs > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>
                        {tr(language, 'Punguzo', 'Discount')} ({sale.discountReason || tr(language, 'Imeidhinishwa', 'Approved')})
                      </span>
                      <span className="font-semibold tabular-nums">-{formatTzs(sale.discountTzs)}</span>
                    </div>
                  )}
                  {typeof sale.taxTzs === 'number' && sale.taxTzs > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>{tr(language, 'Kodi', 'Tax')} ({sale.taxRatePct ?? 18}%)</span>
                      <span className="font-semibold tabular-nums">{formatTzs(sale.taxTzs)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-extrabold text-slate-900">
                    <span>{tr(language, 'Jumla ya Ankara', 'Total Invoice')}</span>
                    <span className="tabular-nums">{formatTzs(sale.totalTzs)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>{tr(language, 'Kiasi Kilicholipwa', 'Amount Paid')}</span>
                    <span className="font-bold tabular-nums">{formatTzs(sale.paidTzs)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-extrabold">
                    <span>{tr(language, 'Salio Linalodaiwa', 'Balance Due')}</span>
                    <span
                      className={`tabular-nums ${
                        sale.balanceTzs > 0 ? 'text-rose-700' : 'text-emerald-700'
                      }`}
                    >
                      {formatTzs(sale.balanceTzs)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment History */}
              <div className="mt-4">
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {tr(language, `Historia ya Malipo (${salePayments.length})`, `Payment History (${salePayments.length})`)}
                </div>
                {salePayments.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 p-2.5 text-slate-500">
                    {tr(
                      language,
                      'Hakuna malipo yaliyorekodiwa bado — kiasi chote kiko kwa mkopo.',
                      'No payments recorded yet — full amount on credit terms.'
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {salePayments.map((pay) => (
                      <div key={pay.id} className="flex items-center justify-between px-3 py-2">
                        <div>
                          <span className="font-bold text-slate-900">{tDomain(language, pay.method)}</span> ·{' '}
                          <span className="font-mono text-slate-600">{pay.reference || tr(language, 'TASLIMU', 'CASH')}</span>
                          <div className="text-[11px] text-slate-500">
                            {pay.date} · {tr(language, 'Imepokelewa na', 'Received by')} {pay.receivedBy}
                          </div>
                        </div>
                        <div className="font-extrabold text-emerald-700 tabular-nums">
                          {formatTzs(pay.amountTzs)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* TRA EFD/VFD Extension Point Notice */}
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <div>
                  <span className="font-bold text-slate-800">
                    {tr(language, 'Hali ya TRA EFD/VFD:', 'TRA EFD/VFD Status:')} {fiscalInfo.status}
                  </span>{' '}
                  — {fiscalInfo.message}
                </div>
              </div>
            </>
          ) : (
            /* Delivery Note Signatures */
            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                <div className="font-bold text-slate-900">
                  {tr(language, 'Tamko la Mnyororo wa Baridi na Ufuatiliaji', 'Cold-Chain & Traceability Declaration')}
                </div>
                <p className="mt-1">
                  {tr(
                    language,
                    `Samaki wote hapo juu wametoka kwenye mabwawa yenye kibali cha FiRCIS na wamekidhi masharti ya uondoaji dawa. Bidhaa zimekaguliwa wakati wa kuondoka (jumla ${totalKg.toFixed(2)} kg).`,
                    `All fish above are sourced from FiRCIS-permitted ponds with verified withdrawal compliance. Goods inspected on dispatch (${totalKg.toFixed(2)} kg total).`
                  )}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4">
                <div className="border-t border-slate-400 pt-1.5">
                  <div className="font-bold text-slate-800">
                    {tr(language, 'Msafirishaji wa Shamba', 'Farm Dispatcher')}
                  </div>
                  <div className="text-[11px] text-slate-500">{sale.createdBy}</div>
                </div>
                <div className="border-t border-slate-400 pt-1.5">
                  <div className="font-bold text-slate-800">{tr(language, 'Dereva / Mchukuzi', 'Driver / Courier')}</div>
                  <div className="text-[11px] text-slate-500">
                    {sale.vehicleOrDriver || tr(language, 'Saini na Tarehe', 'Sign & Date')}
                  </div>
                </div>
                <div className="border-t border-slate-400 pt-1.5">
                  <div className="font-bold text-slate-800">
                    {tr(language, 'Imepokelewa Na (Mteja)', 'Received By (Customer)')}
                  </div>
                  <div className="text-[11px] text-slate-500">{sale.customerName}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom CTA bar */}
        {sale.balanceTzs > 0 && onCollectPayment && (
          <div className="no-print mt-3 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 dark:border-amber-900/50 dark:bg-amber-950/50">
            <div className="text-xs font-semibold text-amber-900 dark:text-amber-200">
              {tr(language, 'Salio linalodaiwa:', 'Balance due:')}{' '}
              <span className="font-extrabold tabular-nums">{formatTzs(sale.balanceTzs)}</span>
            </div>
            <Button variant="success" size="sm" onClick={() => onCollectPayment(sale)}>
              <CreditCard className="h-3.5 w-3.5" /> {t.sales.collectPayment}
            </Button>
          </div>
        )}
        {sale.balanceTzs === 0 && (
          <div className="no-print mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />{' '}
            {tr(language, 'Imelipwa Kamili', 'Paid in Full')}
          </div>
        )}
      </div>
    );
  };

  return (
    <Sheet
      open={Boolean(sale)}
      onClose={onClose}
      hideDefaultHeader
      maxWidthClass="sm:max-w-2xl"
    >
      {renderContent()}
    </Sheet>
  );
};
