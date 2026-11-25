export type TimeFilterPeriod = 'day' | 'week' | 'month' | 'year' | 'all';

export function formatTzs(amount: number): string {
  return `TZS ${Math.round(amount).toLocaleString('en-US')}`;
}

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function nowTimestamp(): string {
  const d = new Date();
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isDateInPeriod(dateStr: string, period: TimeFilterPeriod): boolean {
  if (period === 'all') return true;
  const refDateStr = todayIso();
  const ref = new Date(`${refDateStr}T00:00:00`);
  const target = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(target.getTime())) return true;

  if (period === 'day') {
    return dateStr === refDateStr;
  }
  if (period === 'week') {
    const diffDays = Math.floor((ref.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 6;
  }
  if (period === 'month') {
    return (
      target.getFullYear() === ref.getFullYear() && target.getMonth() === ref.getMonth()
    );
  }
  if (period === 'year') {
    return target.getFullYear() === ref.getFullYear();
  }
  return true;
}

export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escape = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
