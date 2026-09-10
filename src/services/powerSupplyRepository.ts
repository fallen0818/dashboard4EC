import { supabase } from './supabaseClient';

// Fields exposed by the Power Supply page:
//   YYYYMM · SUPPLIER_NAME · ENERGY · POWER_COST · RATE
// RATE is derived (power_cost / energy). branch_id on the DB row is
// inferred from the chosen supplier (power_suppliers.branch_id).

export interface PowerSupplyRow {
  id: string;
  period: string;           // YYYY-MM-01 (first of month)
  yyyymm: string;           // e.g. "202607"
  supplier_id: string;
  supplier_name: string;
  branch_id: string;
  energy: number;           // kWh purchased from this supplier
  power_cost: number;       // ₱ paid for that energy
  rate: number;             // ₱ / kWh, derived
}

type Raw = {
  id: string;
  branch_id: string;
  period_start: string;
  kwh_purchased: number;
  purchased_power_cost: number;
  supplier_id: string;
  power_suppliers: { name: string } | null;
};

export async function getPowerSupplyHistory(): Promise<PowerSupplyRow[]> {
  const { data, error } = await supabase
    .from('power_supply')
    .select(`
      id, branch_id, period_start, kwh_purchased, purchased_power_cost, supplier_id,
      power_suppliers ( name )
    `)
    .order('period_start', { ascending: true });

  if (error) throw new Error(`Failed to fetch power supply: ${error.message}`);

  return ((data ?? []) as unknown as Raw[]).map((r) => {
    const energy = Number(r.kwh_purchased) || 0;
    const power_cost = Number(r.purchased_power_cost) || 0;
    const period = firstOfMonth(r.period_start);
    return {
      id: r.id,
      period,
      yyyymm: period.slice(0, 7).replace('-', ''),
      supplier_id: r.supplier_id,
      supplier_name: r.power_suppliers?.name ?? 'Unknown',
      branch_id: r.branch_id,
      energy,
      power_cost,
      rate: energy > 0 ? round4(power_cost / energy) : 0,
    };
  });
}

export interface NewPowerSupply {
  period: string;       // YYYY-MM-01
  supplier_id: string;
  energy: number;
  power_cost: number;
}

async function branchIdForSupplier(supplier_id: string): Promise<string> {
  const { data, error } = await supabase
    .from('power_suppliers')
    .select('branch_id')
    .eq('id', supplier_id)
    .single();
  if (error || !data) throw new Error(`Unknown supplier: ${error?.message ?? supplier_id}`);
  return data.branch_id as string;
}

async function toDbRow(entry: NewPowerSupply) {
  return {
    branch_id: await branchIdForSupplier(entry.supplier_id),
    supplier_id: entry.supplier_id,
    period_start: entry.period,
    period_end: endOfMonth(entry.period),
    kwh_purchased: entry.energy,
    purchased_power_cost: entry.power_cost,
  };
}

export async function createPowerSupply(entry: NewPowerSupply): Promise<void> {
  const row = await toDbRow(entry);
  const { error } = await supabase.from('power_supply').insert(row);
  if (error) throw new Error(`Failed to add power supply entry: ${error.message}`);
}

export async function updatePowerSupply(id: string, entry: NewPowerSupply): Promise<void> {
  const row = await toDbRow(entry);
  const { error } = await supabase.from('power_supply').update(row).eq('id', id);
  if (error) throw new Error(`Failed to update entry: ${error.message}`);
}

export async function deletePowerSupply(id: string): Promise<void> {
  const { error } = await supabase.from('power_supply').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete entry: ${error.message}`);
}

// Suppliers picker source for the form.
export interface SupplierOption {
  id: string;
  name: string;
  code: string | null;
}
export async function listActiveSuppliers(): Promise<SupplierOption[]> {
  const { data, error } = await supabase
    .from('power_suppliers')
    .select('id, name, code, active, sort_order')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw new Error(`Failed to load suppliers: ${error.message}`);
  return ((data ?? []) as Array<{ id: string; name: string; code: string | null }>).map((s) => ({
    id: s.id, name: s.name, code: s.code,
  }));
}

function firstOfMonth(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}
function endOfMonth(firstOfMonthStr: string): string {
  const [y, m] = firstOfMonthStr.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ============================================================
//  Supplier management (used by the "Manage Suppliers" drawer)
// ============================================================

export type SupplierType = 'bilateral' | 'wesm' | 'net_metering';

export interface Supplier {
  id: string;
  branch_id: string;
  code: string | null;
  name: string;
  supplier_type: SupplierType;
  active: boolean;
  sort_order: number | null;
}

export async function listAllSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from('power_suppliers')
    .select('id, branch_id, code, name, supplier_type, active, sort_order')
    .order('active', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw new Error(`Failed to load suppliers: ${error.message}`);
  return (data ?? []) as Supplier[];
}

export interface NewSupplier {
  branch_id: string;
  code: string | null;
  name: string;
  supplier_type: SupplierType;
  active: boolean;
  sort_order: number | null;
}

export async function createSupplier(entry: NewSupplier): Promise<void> {
  const { error } = await supabase.from('power_suppliers').insert(entry);
  if (error) throw new Error(`Failed to create supplier: ${error.message}`);
}

export async function updateSupplier(id: string, entry: Partial<NewSupplier>): Promise<void> {
  const { error } = await supabase.from('power_suppliers').update(entry).eq('id', id);
  if (error) throw new Error(`Failed to update supplier: ${error.message}`);
}

export async function deleteSupplier(id: string): Promise<void> {
  // Will FK-fail if this supplier has power_supply entries — the caller
  // should catch and show that message; we recommend deactivating instead.
  const { error } = await supabase.from('power_suppliers').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// Branches for the supplier form (usually just one).
export interface BranchOption { id: string; name: string; }
export async function listBranches(): Promise<BranchOption[]> {
  const { data, error } = await supabase
    .from('branches')
    .select('id, name')
    .order('name', { ascending: true });
  if (error) throw new Error(`Failed to load branches: ${error.message}`);
  return (data ?? []) as BranchOption[];
}
