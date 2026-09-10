import { supabase } from './supabaseClient';

export interface DashboardSummary {
  period: string;
  totalKwhPurchased: number;
  totalKwhSold: number;
  systemLossPercent: number;
  totalBilled: number;
  totalCollected: number;
  collectionEfficiencyPercent: number;
  totalConsumers: number;
  outageCount: number;
  totalOutageMinutes: number;
  latestWesmPrice: number | null;
  wesmGrid: string | null;
  branchCount: number;
}

export type PeriodMode = 'month' | 'year';

export interface PeriodRange {
  mode: PeriodMode;
  /** YYYY-MM-01 for month, YYYY-01-01 for year. */
  from: string;
  /** Exclusive upper bound (first-of-next-month / first-of-next-year). */
  to: string;
  /** Human label: "Jul 2026" or "2026". */
  label: string;
}

interface RpcRow {
  period: string | null;
  total_kwh_purchased: string | number;
  total_kwh_sold: string | number;
  system_loss_percent: string | number;
  total_billed: string | number;
  total_collected: string | number;
  collection_efficiency_percent: string | number;
  total_consumers: string | number;
  outage_count: string | number;
  total_outage_minutes: string | number;
  latest_wesm_price: string | number | null;
  wesm_grid: string | null;
  branch_count: string | number;
}

const n = (v: string | number | null | undefined): number =>
  v === null || v === undefined ? 0 : Number(v);

function mapRow(row: RpcRow, fallbackPeriod: string): DashboardSummary {
  return {
    period: row.period ?? fallbackPeriod,
    totalKwhPurchased: n(row.total_kwh_purchased),
    totalKwhSold: n(row.total_kwh_sold),
    systemLossPercent: n(row.system_loss_percent),
    totalBilled: n(row.total_billed),
    totalCollected: n(row.total_collected),
    collectionEfficiencyPercent: n(row.collection_efficiency_percent),
    totalConsumers: n(row.total_consumers),
    outageCount: n(row.outage_count),
    totalOutageMinutes: n(row.total_outage_minutes),
    latestWesmPrice: row.latest_wesm_price === null ? null : n(row.latest_wesm_price),
    wesmGrid: row.wesm_grid ?? null,
    branchCount: n(row.branch_count),
  };
}

/**
 * Load the dashboard for a specific range, or omit `range` to get the
 * latest month automatically (backwards-compatible with the old caller).
 */
export async function getDashboardSummary(range?: PeriodRange): Promise<DashboardSummary | null> {
  if (!range) {
    const { data, error } = await supabase.rpc('dashboard_summary');
    if (error) throw new Error(`Failed to load dashboard summary: ${error.message}`);
    const row = (data as RpcRow[] | null)?.[0];
    if (!row || !row.period) return null;
    return mapRow(row, row.period);
  }

  const { data, error } = await supabase.rpc('dashboard_summary_range', {
    p_from: range.from,
    p_to: range.to,
  });
  if (error) throw new Error(`Failed to load dashboard summary: ${error.message}`);
  const row = (data as RpcRow[] | null)?.[0];
  if (!row) return null;
  return mapRow(row, range.from);
}

/** Distinct months present in system_loss (newest first). */
export async function getAvailablePeriods(): Promise<{ months: string[]; years: number[] }> {
  const { data, error } = await supabase.rpc('dashboard_available_periods');
  if (error) throw new Error(`Failed to load available periods: ${error.message}`);
  const months = ((data as Array<{ month: string }> | null) ?? []).map((r) => r.month);
  const years = Array.from(new Set(months.map((m) => Number(m.slice(0, 4))))).sort((a, b) => b - a);
  return { months, years };
}
