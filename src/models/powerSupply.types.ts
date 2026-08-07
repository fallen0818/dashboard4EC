export type GridRegion = 'Luzon' | 'Visayas' | 'Mindanao';

export type SupplierType = 'bilateral' | 'wesm' | 'net_metering';

export interface PowerSupplier {
  id: string;
  branch_id: string;
  code: string;
  name: string;
  supplier_type: SupplierType;
  active: boolean;
  sort_order: number;
  created_at: string;
}

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
  supplier_id: string;
  wesm_price_id: string | null;
  period_start: string;
  period_end: string;
  kwh_purchased: number;
  purchased_power_cost: number;
  generation_charge: number | null;
  transmission_charge: number | null;
  system_loss_charge: number | null;
  created_at: string;
}

// Shape returned by the joined query in powerSupplyService: each record carries
// its supplier and (for WESM rows) the matching spot price.
export interface PowerSupplyWithRefs extends PowerSupplyRecord {
  power_suppliers: Pick<PowerSupplier, 'code' | 'name' | 'supplier_type' | 'sort_order'> | null;
  wesm_prices: Pick<WesmPrice, 'grid_region' | 'price_per_kwh'> | null;
}
