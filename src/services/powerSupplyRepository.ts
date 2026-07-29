import { supabase } from './supabaseClient';

export interface PowerSupplyRow {
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
      `period, kwh_purchased, purchased_power_cost, kwh_sold, sales_revenue,
       branches ( name )`
    )
    .order('period', { ascending: true });

  if (error) throw new Error(`Failed to fetch power supply history: ${error.message}`);

  return (data as any[]).map((row) => ({
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
