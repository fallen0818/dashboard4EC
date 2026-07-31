import { supabase } from './supabase/client';
import type { PowerSupplyWithPrice, PowerSupplyRecord, WesmPrice } from '../models/powerSupply.types';

/**
 * Fetch power supply records for a branch, joined with the matching WESM price row,
 * ordered by period ascending (for time-series charts).
 */
export async function getPowerSupplyData(branchId: string): Promise<PowerSupplyWithPrice[]> {
  const { data, error } = await supabase
    .from('power_supply')
    .select(
      `
      id,
      branch_id,
      wesm_price_id,
      period_start,
      period_end,
      kwh_purchased,
      kwh_sold,
      purchased_power_cost,
      generation_charge,
      transmission_charge,
      system_loss_charge,
      created_at,
      wesm_prices ( grid_region, price_per_kwh )
    `
    )
    .eq('branch_id', branchId)
    .order('period_start', { ascending: true });

  if (error) throw error;
  return data as unknown as PowerSupplyWithPrice[];
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
 * branches table first). Convenient for the power-supply entry form, which only
 * has a branchId to work with.
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
  wesm_price_id: string | null;
  period_start: string;
  period_end: string;
  kwh_purchased: number;
  kwh_sold: number;
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

export async function updatePowerSupplyRecord(id: string, input: NewPowerSupply): Promise<PowerSupplyRecord> {
  const { data, error } = await supabase.from('power_supply').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data as PowerSupplyRecord;
}

export async function deletePowerSupplyRecord(id: string): Promise<void> {
  const { error } = await supabase.from('power_supply').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Derived metric: average purchased power cost per kWh sold, per period.
 * Useful for spotting whether cost increases are being passed through efficiently.
 */
export function computeCostPerKwhSold(records: PowerSupplyWithPrice[]) {
  return records.map((r) => ({
    period_start: r.period_start,
    cost_per_kwh_sold: r.kwh_sold > 0 ? r.purchased_power_cost / r.kwh_sold : 0,
    wesm_price_per_kwh: r.wesm_prices?.price_per_kwh ?? null,
  }));
}
