import { supabase } from './supabaseClient';

// ============================================================
//  KPI trend — one row per month, N months back
// ============================================================
export interface KpiTrendPoint {
  month: string;                                // YYYY-MM-01
  totalKwhPurchased: number;
  totalKwhSold: number;
  systemLossPercent: number | null;
  totalBilled: number;
  totalCollected: number;
  collectionEfficiencyPercent: number | null;
  totalConsumers: number;
  outageCount: number;
  totalOutageMinutes: number;
  genMixRate: number | null;
  prevSystemLossPercent: number | null;
  prevCollectionEfficiencyPercent: number | null;
  prevGenMixRate: number | null;
  prevTotalConsumers: number;
}

interface RawKpiRow {
  month: string;
  total_kwh_purchased: string | number;
  total_kwh_sold: string | number;
  system_loss_percent: string | number | null;
  total_billed: string | number;
  total_collected: string | number;
  collection_efficiency_percent: string | number | null;
  total_consumers: string | number;
  outage_count: string | number;
  total_outage_minutes: string | number;
  gen_mix_rate: string | number | null;
  prev_system_loss_percent: string | number | null;
  prev_collection_efficiency_percent: string | number | null;
  prev_gen_mix_rate: string | number | null;
  prev_total_consumers: string | number;
}

const num = (v: string | number | null | undefined): number =>
  v === null || v === undefined ? 0 : Number(v);
const numOrNull = (v: string | number | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);

export async function getKpiTrend(months = 24): Promise<KpiTrendPoint[]> {
  const { data, error } = await supabase.rpc('analytics_kpi_trend', { p_months: months });
  if (error) throw new Error(`Failed to load KPI trend: ${error.message}`);
  return ((data as RawKpiRow[] | null) ?? []).map((r) => ({
    month: r.month,
    totalKwhPurchased: num(r.total_kwh_purchased),
    totalKwhSold: num(r.total_kwh_sold),
    systemLossPercent: numOrNull(r.system_loss_percent),
    totalBilled: num(r.total_billed),
    totalCollected: num(r.total_collected),
    collectionEfficiencyPercent: numOrNull(r.collection_efficiency_percent),
    totalConsumers: num(r.total_consumers),
    outageCount: num(r.outage_count),
    totalOutageMinutes: num(r.total_outage_minutes),
    genMixRate: numOrNull(r.gen_mix_rate),
    prevSystemLossPercent: numOrNull(r.prev_system_loss_percent),
    prevCollectionEfficiencyPercent: numOrNull(r.prev_collection_efficiency_percent),
    prevGenMixRate: numOrNull(r.prev_gen_mix_rate),
    prevTotalConsumers: num(r.prev_total_consumers),
  }));
}

// ============================================================
//  Supplier mix — rows per (month, supplier) in a date range
// ============================================================
export interface SupplierMixRow {
  month: string;               // YYYY-MM-01
  supplierId: string;
  supplierName: string;
  energy: number;
  cost: number;
  rate: number;
}

interface RawSupplierMixRow {
  month: string;
  supplier_id: string;
  supplier_name: string | null;
  energy: string | number;
  cost: string | number;
  rate: string | number;
}

export async function getSupplierMix(from: string, to: string): Promise<SupplierMixRow[]> {
  const { data, error } = await supabase.rpc('analytics_supplier_mix', {
    p_from: from,
    p_to: to,
  });
  if (error) throw new Error(`Failed to load supplier mix: ${error.message}`);
  return ((data as RawSupplierMixRow[] | null) ?? []).map((r) => ({
    month: r.month,
    supplierId: r.supplier_id,
    supplierName: r.supplier_name ?? 'Unknown',
    energy: num(r.energy),
    cost: num(r.cost),
    rate: num(r.rate),
  }));
}

// ============================================================
//  Outage matrix — rows per (month, cause)
// ============================================================
export interface OutageMatrixRow {
  month: string;
  cause: string;
  outageCount: number;
  totalMinutes: number;
  consumerMinutes: number;
}

interface RawOutageMatrixRow {
  month: string;
  cause: string;
  outage_count: string | number;
  total_minutes: string | number;
  consumer_minutes: string | number;
}

export async function getOutageMatrix(from: string, to: string): Promise<OutageMatrixRow[]> {
  const { data, error } = await supabase.rpc('analytics_outage_matrix', {
    p_from: from,
    p_to: to,
  });
  if (error) throw new Error(`Failed to load outage matrix: ${error.message}`);
  return ((data as RawOutageMatrixRow[] | null) ?? []).map((r) => ({
    month: r.month,
    cause: r.cause,
    outageCount: num(r.outage_count),
    totalMinutes: num(r.total_minutes),
    consumerMinutes: num(r.consumer_minutes),
  }));
}

// ============================================================
//  Collection aging — per month billing + notices
// ============================================================
export interface CollectionAgingRow {
  month: string;
  billed: number;
  collected: number;
  overdue: number;
  billsPaid: number;
  billsPartial: number;
  billsUnpaid: number;
  billsOverdue: number;
  openNotices: number;
}

interface RawCollectionAgingRow {
  month: string;
  billed: string | number;
  collected: string | number;
  overdue: string | number;
  bills_paid: string | number;
  bills_partial: string | number;
  bills_unpaid: string | number;
  bills_overdue: string | number;
  open_notices: string | number;
}

export async function getCollectionAging(from: string, to: string): Promise<CollectionAgingRow[]> {
  const { data, error } = await supabase.rpc('analytics_collection_aging', {
    p_from: from,
    p_to: to,
  });
  if (error) throw new Error(`Failed to load collection aging: ${error.message}`);
  return ((data as RawCollectionAgingRow[] | null) ?? []).map((r) => ({
    month: r.month,
    billed: num(r.billed),
    collected: num(r.collected),
    overdue: num(r.overdue),
    billsPaid: num(r.bills_paid),
    billsPartial: num(r.bills_partial),
    billsUnpaid: num(r.bills_unpaid),
    billsOverdue: num(r.bills_overdue),
    openNotices: num(r.open_notices),
  }));
}

// ============================================================
//  Year-vs-Year compare — one row per (year, month) for two years
// ============================================================
export interface YearCompareRow {
  year: number;
  month: number;             // 1..12
  systemLossPercent: number | null;
  collectionEfficiencyPercent: number | null;
  genMixRate: number | null;
  totalConsumers: number;
  totalKwhPurchased: number;
  totalKwhSold: number;
}

interface RawYearCompareRow {
  year: string | number;
  month: string | number;
  system_loss_percent: string | number | null;
  collection_efficiency_percent: string | number | null;
  gen_mix_rate: string | number | null;
  total_consumers: string | number;
  total_kwh_purchased: string | number;
  total_kwh_sold: string | number;
}

export async function getYearCompare(yearA: number, yearB: number): Promise<YearCompareRow[]> {
  const { data, error } = await supabase.rpc('analytics_year_compare', {
    p_year_a: yearA,
    p_year_b: yearB,
  });
  if (error) throw new Error(`Failed to load year comparison: ${error.message}`);
  return ((data as RawYearCompareRow[] | null) ?? []).map((r) => ({
    year: Number(r.year),
    month: Number(r.month),
    systemLossPercent: numOrNull(r.system_loss_percent),
    collectionEfficiencyPercent: numOrNull(r.collection_efficiency_percent),
    genMixRate: numOrNull(r.gen_mix_rate),
    totalConsumers: num(r.total_consumers),
    totalKwhPurchased: num(r.total_kwh_purchased),
    totalKwhSold: num(r.total_kwh_sold),
  }));
}
