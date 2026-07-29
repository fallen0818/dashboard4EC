export interface Branch {
  id: string;
  name: string;
}

export interface SystemLoss {
  id: string;
  branch_id: string;
  period: string;
  kwh_purchased: number;
  kwh_sold: number;
  system_loss_kwh: number;
  system_loss_percent: number;
}

export interface PowerSupply {
  id: string;
  branch_id: string;
  period: string;
  kwh_purchased: number;
  purchased_power_cost: number;
  kwh_sold: number;
  sales_revenue: number;
}

export interface Collection {
  id: string;
  branch_id: string;
  period: string;
  amount_billed: number;
  amount_collected: number;
  collection_efficiency_percent: number;
}

export type ConnectionType = 'residential' | 'commercial' | 'industrial' | 'government' | 'other';

export interface Membership {
  id: string;
  branch_id: string;
  period: string;
  connection_type: ConnectionType;
  consumer_count: number;
}

export interface Outage {
  id: string;
  branch_id: string;
  date: string;
  duration_minutes: number;
  cause: string | null;
  area_affected: string | null;
  consumers_affected: number;
}

export interface WesmPrice {
  id: string;
  period: string;
  grid: 'Luzon' | 'Visayas' | 'Mindanao';
  weighted_average_price: number;
}
