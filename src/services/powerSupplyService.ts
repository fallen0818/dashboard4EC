import { supabase } from './supabase/client';
import type {
  PowerSupplyWithRefs,
  PowerSupplyRecord,
  PowerSupplier,
  SupplierType,
  WesmPrice,
} from '../models/powerSupply.types';

// ============================================================================
// Suppliers (per-branch reference data)
// ============================================================================

export async function getSuppliersForBranch(branchId: string): Promise<PowerSupplier[]> {
  const { data, error } = await supabase
    .from('power_suppliers')
    .select('*')
    .eq('branch_id', branchId)
    .order('supplier_type', { ascending: true })
    .order('code', { ascending: true });

  if (error) throw error;
  return data as PowerSupplier[];
}

export interface NewSupplier {
  branch_id: string;
  code: string;
  name: string;
  supplier_type: SupplierType;
  active: boolean;
}

export async function createSupplier(input: NewSupplier): Promise<PowerSupplier> {
  const { data, error } = await supabase.from('power_suppliers').insert(input).select().single();
  if (error) throw error;
  return data as PowerSupplier;
}

export async function updateSupplier(id: string, input: NewSupplier): Promise<PowerSupplier> {
  const { data, error } = await supabase
    .from('power_suppliers')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as PowerSupplier;
}

// Deleting a supplier cascades to its power_supply rows (ON DELETE CASCADE).
export async function deleteSupplier(id: string): Promise<void> {
  const { error } = await supabase.from('power_suppliers').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================================
// Power supply records (one row per supplier per period)
// ============================================================================

/**
 * Fetch power supply records for a branch, each joined with its supplier and
 * (for WESM rows) the matching spot price. Ordered by period then supplier code
 * so the dashboard can group cleanly.
 */
export async function getPowerSupplyData(branchId: string): Promise<PowerSupplyWithRefs[]> {
  const { data, error } = await supabase
    .from('power_supply')
    .select(
      `
      id,
      branch_id,
      supplier_id,
      wesm_price_id,
      period_start,
      period_end,
      kwh_purchased,
      purchased_power_cost,
      generation_charge,
      transmission_charge,
      system_loss_charge,
      created_at,
      power_suppliers ( code, name, supplier_type ),
      wesm_prices ( grid_region, price_per_kwh )
    `
    )
    .eq('branch_id', branchId)
    .order('period_start', { ascending: true });

  if (error) throw error;
  return data as unknown as PowerSupplyWithRefs[];
}

/**
 * WESM prices for a grid region, most recent first — used to populate the
 * optional price dropdown on the power-supply entry form.
 */
export async function getWesmPrices(gridRegion: string): Promise<WesmPrice[]> {
  const { data, error } = await supabase
    .from('wesm_prices')
    .select('*')
    .eq('grid_region', gridRegion)
    .order('period_start', { ascending: false });

  if (error) throw error;
  return data as WesmPrice[];
}

/**
 * WESM prices matching a branch's grid region (resolves the region from the
 * branches table first).
 */
export async function getWesmPricesForBranch(branchId: string): Promise<WesmPrice[]> {
  const { data: branch, error: branchErr } = await supabase
    .from('branches')
    .select('grid_region')
    .eq('id', branchId)
    .single();
  if (branchErr) throw branchErr;
  return getWesmPrices(branch.grid_region as string);
}

export interface NewPowerSupply {
  branch_id: string;
  supplier_id: string;
  wesm_price_id: string | null;
  period_start: string;
  period_end: string;
  kwh_purchased: number;
  purchased_power_cost: number;
  generation_charge: number | null;
  transmission_charge: number | null;
  system_loss_charge: number | null;
}

export async function createPowerSupplyRecord(input: NewPowerSupply): Promise<PowerSupplyRecord> {
  const { data, error } = await supabase.from('power_supply').insert(input).select().single();
  if (error) throw error;
  return data as PowerSupplyRecord;
}

export async function updatePowerSupplyRecord(
  id: string,
  input: NewPowerSupply
): Promise<PowerSupplyRecord> {
  const { data, error } = await supabase
    .from('power_supply')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as PowerSupplyRecord;
}

export async function deletePowerSupplyRecord(id: string): Promise<void> {
  const { error } = await supabase.from('power_supply').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================================
// Derived metrics
// ============================================================================

export interface PeriodTotal {
  period_start: string;
  period_end: string;
  total_kwh: number;
  total_cost: number;
  cost_per_kwh: number; // total_cost / total_kwh
}

/**
 * Aggregate per-supplier rows into one total per period (blended purchased
 * power cost across all suppliers).
 */
export function computePeriodTotals(records: PowerSupplyWithRefs[]): PeriodTotal[] {
  const byPeriod = new Map<string, PeriodTotal>();

  for (const r of records) {
    const existing = byPeriod.get(r.period_start);
    if (existing) {
      existing.total_kwh += r.kwh_purchased;
      existing.total_cost += r.purchased_power_cost;
    } else {
      byPeriod.set(r.period_start, {
        period_start: r.period_start,
        period_end: r.period_end,
        total_kwh: r.kwh_purchased,
        total_cost: r.purchased_power_cost,
        cost_per_kwh: 0,
      });
    }
  }

  const totals = Array.from(byPeriod.values()).sort((a, b) =>
    a.period_start.localeCompare(b.period_start)
  );
  for (const t of totals) {
    t.cost_per_kwh = t.total_kwh > 0 ? t.total_cost / t.total_kwh : 0;
  }
  return totals;
}

/**
 * Reshape records into rows for a stacked chart: one row per period with a
 * column of purchased kWh per supplier code, e.g.
 *   { period_start, TLI: 500000, SPI: 350000, WESM: 145000, ... }
 */
export function computeSupplierMix(
  records: PowerSupplyWithRefs[]
): Array<Record<string, string | number>> {
  const byPeriod = new Map<string, Record<string, string | number>>();

  for (const r of records) {
    const code = r.power_suppliers?.code ?? 'Unknown';
    const row = byPeriod.get(r.period_start) ?? { period_start: r.period_start };
    row[code] = (Number(row[code]) || 0) + r.kwh_purchased;
    byPeriod.set(r.period_start, row);
  }

  return Array.from(byPeriod.values()).sort((a, b) =>
    String(a.period_start).localeCompare(String(b.period_start))
  );
}

/**
 * Total purchased cost and kWh per supplier across all periods in the set —
 * for a supplier-level breakdown table / share chart.
 */
export function computeSupplierBreakdown(records: PowerSupplyWithRefs[]) {
  const bySupplier = new Map<
    string,
    { code: string; name: string; supplier_type: string; total_kwh: number; total_cost: number }
  >();

  for (const r of records) {
    const code = r.power_suppliers?.code ?? 'Unknown';
    const entry = bySupplier.get(code) ?? {
      code,
      name: r.power_suppliers?.name ?? code,
      supplier_type: r.power_suppliers?.supplier_type ?? 'bilateral',
      total_kwh: 0,
      total_cost: 0,
    };
    entry.total_kwh += r.kwh_purchased;
    entry.total_cost += r.purchased_power_cost;
    bySupplier.set(code, entry);
  }

  return Array.from(bySupplier.values()).sort((a, b) => b.total_kwh - a.total_kwh);
}
