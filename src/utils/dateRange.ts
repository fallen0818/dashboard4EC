// Date-range helpers shared by the dashboard filters.
// Values are ISO date strings (YYYY-MM-DD) to match the period/date columns.

export interface DateRange {
  from: string | null; // inclusive lower bound; null = no lower bound
  to: string | null; // inclusive upper bound; null = no upper bound
}

export type PresetKey =
  | 'all'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'ytd'
  | 'last_year'
  | 'custom';

export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'this_quarter', label: 'This quarter' },
  { key: 'ytd', label: 'Year to date' },
  { key: 'last_year', label: 'Last year' },
  { key: 'custom', label: 'Custom' },
];

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return iso(new Date());
}

export function rangeForPreset(key: PresetKey, now = new Date()): DateRange | null {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (key) {
    case 'all':
      return { from: null, to: null };
    case 'this_month':
      return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
    case 'last_month':
      return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case 'this_quarter': {
      const q = Math.floor(m / 3);
      return { from: iso(new Date(y, q * 3, 1)), to: iso(new Date(y, q * 3 + 3, 0)) };
    }
    case 'ytd':
      return { from: iso(new Date(y, 0, 1)), to: todayISO() };
    case 'last_year':
      return { from: iso(new Date(y - 1, 0, 1)), to: iso(new Date(y - 1, 11, 31)) };
    case 'custom':
      return null;
  }
}

// True when a date string falls within [from, to] (inclusive; null = open).
// Only the date portion is compared, so ISO datetimes (e.g. outage start_time)
// are matched by their calendar day.
export function inRange(dateStr: string, range: DateRange): boolean {
  const day = dateStr.slice(0, 10);
  if (range.from && day < range.from) return false;
  if (range.to && day > range.to) return false;
  return true;
}

export function describeRange(range: DateRange): string {
  if (!range.from && !range.to) return 'All time';
  const fmt = (s: string) =>
    new Date(s).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  if (range.from && range.to) return `${fmt(range.from)} – ${fmt(range.to)}`;
  if (range.from) return `From ${fmt(range.from)}`;
  return `Through ${fmt(range.to as string)}`;
}
