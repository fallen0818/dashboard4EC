export type GridRegion = 'Luzon' | 'Visayas' | 'Mindanao';

export interface WesmPrice {
  id: string;
  grid_region: GridRegion;
  period_start: string; // ISO date
  period_end: string;   // ISO date
  price_per_kwh: number;
  created_at: string;
}

export interface PowerSupplyRecord {
  id: string;
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
  created_at: string;
}

// Shape returned by the joined query in powerSupplyService
export interface PowerSupplyWithPrice extends PowerSupplyRecord {
  wesm_prices: Pick<WesmPrice, 'grid_region' | 'price_per_kwh'> | null;
}
