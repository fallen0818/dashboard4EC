import { supabase } from './supabase/client';
import { buildCsv, parseCsv } from '../lib/csv';
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
    .order('sort_order', { ascending: true });

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
 * (for WESM rows) the matching spot price. Ordered by period (most recent
 * first), then by each supplier's sort_order.
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
      power_suppliers ( code, name, supplier_type, sort_order ),
      wesm_prices ( grid_region, price_per_kwh )
    `
    )
    .eq('branch_id', branchId)
    .order('period_start', { ascending: false })
    .order('sort_order', { ascending: true, foreignTable: 'power_suppliers' });

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

/**
 * Insert many records in a single statement (used by CSV import). Postgres
 * runs a multi-row INSERT as one statement, so this is all-or-nothing: if any
 * row violates a constraint (e.g. duplicate branch+supplier+period), none of
 * them are inserted.
 */
export async function bulkInsertPowerSupplyRecords(
  records: NewPowerSupply[]
): Promise<PowerSupplyRecord[]> {
  const { data, error } = await supabase.from('power_supply').insert(records).select();
  if (error) throw error;
  return data as PowerSupplyRecord[];
}

// ============================================================================
// CSV export / import
// ============================================================================

const CSV_HEADERS = [
  'period_start',
  'period_end',
  'supplier_code',
  'kwh_purchased',
  'purchased_power_cost',
  'generation_charge',
  'transmission_charge',
  'system_loss_charge',
];

/** Serialize records (as returned by getPowerSupplyData) into CSV text. */
export function exportPowerSupplyCsv(records: PowerSupplyWithRefs[]): string {
  const rows = records.map((r) => [
    r.period_start,
    r.period_end,
    r.power_suppliers?.code ?? '',
    r.kwh_purchased,
    r.purchased_power_cost,
    r.generation_charge,
    r.transmission_charge,
    r.system_loss_charge,
  ]);
  return buildCsv(CSV_HEADERS, rows);
}

/** A ready-to-download blank template matching the import format. */
export function powerSupplyCsvTemplate(): string {
  return buildCsv(CSV_HEADERS, [
    ['2026-05-01', '2026-05-31', 'TLI', 500000, 2750000, '', '', ''],
  ]);
}

export interface ImportRowResult {
  row: number; // 1-based, matching the CSV file's line numbers (header = 1)
  record: NewPowerSupply | null;
  errors: string[];
}

export interface ParsedPowerSupplyImport {
  results: ImportRowResult[];
  valid: NewPowerSupply[];
  errorCount: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseOptionalNumber(raw: string, field: string, errors: string[]): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  if (Number.isNaN(n)) { errors.push(`${field}: "${raw}" is not a number`); return null; }
  return n;
}

/**
 * Parse and validate CSV text against the branch's known suppliers. Expects
 * the header row produced by exportPowerSupplyCsv / powerSupplyCsvTemplate
 * (column order does not matter, matched by name; unknown columns ignored).
 */
export function parsePowerSupplyImportCsv(
  text: string,
  branchId: string,
  suppliers: PowerSupplier[]
): ParsedPowerSupplyImport {
  const table = parseCsv(text);
  const results: ImportRowResult[] = [];

  if (table.length === 0) {
    return { results: [], valid: [], errorCount: 0 };
  }

  const header = table[0].map((h) => h.trim().toLowerCase());
  const colIndex = (name: string) => header.indexOf(name);
  const idx = {
    period_start: colIndex('period_start'),
    period_end: colIndex('period_end'),
    supplier_code: colIndex('supplier_code'),
    kwh_purchased: colIndex('kwh_purchased'),
    purchased_power_cost: colIndex('purchased_power_cost'),
    generation_charge: colIndex('generation_charge'),
    transmission_charge: colIndex('transmission_charge'),
    system_loss_charge: colIndex('system_loss_charge'),
  };

  const missingCols = (['period_start', 'period_end', 'supplier_code', 'kwh_purchased', 'purchased_power_cost'] as const)
    .filter((k) => idx[k] === -1);
  if (missingCols.length > 0) {
    return {
      results: [{
        row: 1,
        record: null,
        errors: [`Missing required column(s): ${missingCols.join(', ')}`],
      }],
      valid: [],
      errorCount: 1,
    };
  }

  const suppliersByCode = new Map(suppliers.map((s) => [s.code.trim().toUpperCase(), s]));

  for (let i = 1; i < table.length; i++) {
    const cols = table[i];
    if (cols.length === 1 && cols[0].trim() === '') continue; // blank line
    const errors: string[] = [];

    const periodStart = (cols[idx.period_start] ?? '').trim();
    const periodEnd = (cols[idx.period_end] ?? '').trim();
    const supplierCode = (cols[idx.supplier_code] ?? '').trim();
    const kwhRaw = (cols[idx.kwh_purchased] ?? '').trim();
    const costRaw = (cols[idx.purchased_power_cost] ?? '').trim();

    if (!DATE_RE.test(periodStart)) errors.push(`period_start: "${periodStart}" is not YYYY-MM-DD`);
    if (!DATE_RE.test(periodEnd)) errors.push(`period_end: "${periodEnd}" is not YYYY-MM-DD`);
    if (DATE_RE.test(periodStart) && DATE_RE.test(periodEnd) && periodEnd < periodStart) {
      errors.push('period_end is before period_start');
    }

    const supplier = suppliersByCode.get(supplierCode.toUpperCase());
    if (!supplierCode) errors.push('supplier_code is required');
    else if (!supplier) errors.push(`supplier_code: unknown supplier "${supplierCode}"`);

    const kwhPurchased = Number(kwhRaw);
    if (kwhRaw === '' || Number.isNaN(kwhPurchased)) errors.push(`kwh_purchased: "${kwhRaw}" is not a number`);

    const purchasedCost = Number(costRaw);
    if (costRaw === '' || Number.isNaN(purchasedCost)) errors.push(`purchased_power_cost: "${costRaw}" is not a number`);

    const genCharge = parseOptionalNumber(cols[idx.generation_charge] ?? '', 'generation_charge', errors);
    const transCharge = parseOptionalNumber(cols[idx.transmission_charge] ?? '', 'transmission_charge', errors);
    const lossCharge = parseOptionalNumber(cols[idx.system_loss_charge] ?? '', 'system_loss_charge', errors);

    const record: NewPowerSupply | null = errors.length === 0 && supplier ? {
      branch_id: branchId,
      supplier_id: supplier.id,
      wesm_price_id: null,
      period_start: periodStart,
      period_end: periodEnd,
      kwh_purchased: kwhPurchased,
      purchased_power_cost: purchasedCost,
      generation_charge: genCharge,
      transmission_charge: transCharge,
      system_loss_charge: lossCharge,
    } : null;

    results.push({ row: i + 1, record, errors });
  }

  const valid = results.filter((r) => r.record !== null).map((r) => r.record!);
  const errorCount = results.filter((r) => r.errors.length > 0).length;

  return { results, valid, errorCount };
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
