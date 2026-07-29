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

// Finds the most recent period present in system_loss (used as the
// reference month for the whole dashboard, since all tables are seeded
// on the same monthly cadence).
async function getLatestPeriod(): Promise<string | null> {
  const { data, error } = await supabase
    .from('system_loss')
    .select('period')
    .order('period', { ascending: false })
    .limit(1);

  if (error) throw new Error(`Failed to determine latest period: ${error.message}`);
  return data?.[0]?.period ?? null;
}

export async function getDashboardSummary(): Promise<DashboardSummary | null> {
  const period = await getLatestPeriod();
  if (!period) return null;

  const [branchesRes, systemLossRes, collectionsRes, membershipRes, outagesRes, wesmRes] =
    await Promise.all([
      supabase.from('branches').select('id'),
      supabase.from('system_loss').select('kwh_purchased, kwh_sold').eq('period', period),
      supabase.from('collections').select('amount_billed, amount_collected').eq('period', period),
      supabase.from('membership').select('consumer_count').eq('period', period),
      // Outages for the same calendar month as `period`
      supabase
        .from('outages')
        .select('duration_minutes')
        .gte('date', period)
        .lt('date', addOneMonth(period)),
      supabase
        .from('wesm_prices')
        .select('weighted_average_price, grid, period')
        .order('period', { ascending: false })
        .limit(1),
    ]);

  if (systemLossRes.error) throw new Error(systemLossRes.error.message);
  if (collectionsRes.error) throw new Error(collectionsRes.error.message);
  if (membershipRes.error) throw new Error(membershipRes.error.message);
  if (outagesRes.error) throw new Error(outagesRes.error.message);
  if (wesmRes.error) throw new Error(wesmRes.error.message);

  const totalKwhPurchased = sum(systemLossRes.data, 'kwh_purchased');
  const totalKwhSold = sum(systemLossRes.data, 'kwh_sold');
  const systemLossPercent =
    totalKwhPurchased > 0
      ? Number((((totalKwhPurchased - totalKwhSold) / totalKwhPurchased) * 100).toFixed(2))
      : 0;

  const totalBilled = sum(collectionsRes.data, 'amount_billed');
  const totalCollected = sum(collectionsRes.data, 'amount_collected');
  const collectionEfficiencyPercent =
    totalBilled > 0 ? Number(((totalCollected / totalBilled) * 100).toFixed(2)) : 0;

  const totalConsumers = sum(membershipRes.data, 'consumer_count');
  const outageCount = outagesRes.data?.length ?? 0;
  const totalOutageMinutes = sum(outagesRes.data, 'duration_minutes');

  return {
    period,
    totalKwhPurchased,
    totalKwhSold,
    systemLossPercent,
    totalBilled,
    totalCollected,
    collectionEfficiencyPercent,
    totalConsumers,
    outageCount,
    totalOutageMinutes,
    latestWesmPrice: wesmRes.data?.[0]?.weighted_average_price ?? null,
    wesmGrid: wesmRes.data?.[0]?.grid ?? null,
    branchCount: branchesRes.data?.length ?? 0,
  };
}

function sum(rows: any[] | null, key: string): number {
  return (rows ?? []).reduce((s, r) => s + (Number(r[key]) || 0), 0);
}

function addOneMonth(dateStr: string): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}
