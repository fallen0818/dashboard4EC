import { supabase } from './supabaseClient';

export interface PowerSupplyRow {
  id: string;
  branch_id: string;
  period: string;
  branch_name: string;
  kwh_purchased: number;
  purchased_power_cost: number;
  kwh_sold: number;
  sales_revenue: number;
}

export async function getPowerSupplyHistory(): Promise<PowerSupplyRow[]> {
  const { data, error } = await supabase
    .from('power_supply')
    .select(
      `id, branch_id, period, kwh_purchased, purchased_power_cost, kwh_sold, sales_revenue,
       branches ( name )`
    )
    .order('period', { ascending: true });

  if (error) throw new Error(`Failed to fetch power supply history: ${error.message}`);

  return (data as any[]).map((row) => ({
    id: row.id,
    branch_id: row.branch_id,
    period: row.period,
    branch_name: row.branches?.name ?? 'Unknown',
    kwh_purchased: row.kwh_purchased,
    purchased_power_cost: row.purchased_power_cost,
    kwh_sold: row.kwh_sold,
    sales_revenue: row.sales_revenue,
  }));
}

export interface NewPowerSupply {
  branch_id: string;
  period: string;
  kwh_purchased: number;
  purchased_power_cost: number;
  kwh_sold: number;
  sales_revenue: number;
}

export async function createPowerSupply(entry: NewPowerSupply): Promise<void> {
  const { error } = await supabase.from('power_supply').insert(entry);
  if (error) throw new Error(`Failed to add power supply entry: ${error.message}`);
}

export async function updatePowerSupply(id: string, entry: NewPowerSupply): Promise<void> {
  const { error } = await supabase.from('power_supply').update(entry).eq('id', id);
  if (error) throw new Error(`Failed to update entry: ${error.message}`);
}

export async function deletePowerSupply(id: string): Promise<void> {
  const { error } = await supabase.from('power_supply').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete entry: ${error.message}`);
}
