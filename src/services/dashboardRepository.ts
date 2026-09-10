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

// One round-trip: the RPC anchors on the calendar month of the newest
// system_loss row and aggregates every table over that month window.
// Definition lives in supabase/migrations/0003_dashboard_summary_rpc.sql.
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

export async function getDashboardSummary(): Promise<DashboardSummary | null> {
  const { data, error } = await supabase.rpc('dashboard_summary');
  if (error) throw new Error(`Failed to load dashboard summary: ${error.message}`);

  const row = (data as RpcRow[] | null)?.[0];
  if (!row || !row.period) return null; // no data yet

  const n = (v: string | number | null | undefined): number =>
    v === null || v === undefined ? 0 : Number(v);

  return {
    period: row.period,
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
