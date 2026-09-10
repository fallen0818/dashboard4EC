import { supabase } from './supabaseClient';

// The app treats every reporting record as a single month keyed by
// `period` (first-of-month). The DB stores period_start/period_end and
// uses kwh_input/kwh_billed instead of kwh_purchased/kwh_sold. This
// repository translates between the two so pages can stay put.

export interface SystemLossRow {
  id: string;
  branch_id: string;
  period: string;
  branch_name: string;
  kwh_purchased: number;
  kwh_sold: number;
  system_loss_kwh: number;
  system_loss_percent: number;
}

type Raw = {
  id: string;
  branch_id: string;
  period_start: string;
  kwh_input: number;
  kwh_billed: number;
  system_loss_kwh: number;
  system_loss_percent: number;
  branches: { name: string } | null;
};

export async function getSystemLossHistory(): Promise<SystemLossRow[]> {
  const { data, error } = await supabase
    .from('system_loss')
    .select(`
      id, branch_id, period_start, kwh_input, kwh_billed,
      system_loss_kwh, system_loss_percent,
      branches ( name )
    `)
    .order('period_start', { ascending: false });

  if (error) throw new Error(`Failed to fetch system loss history: ${error.message}`);

  return ((data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id,
    branch_id: r.branch_id,
    period: r.period_start,
    branch_name: r.branches?.name ?? 'Unknown',
    kwh_purchased: Number(r.kwh_input),
    kwh_sold: Number(r.kwh_billed),
    system_loss_kwh: Number(r.system_loss_kwh),
    system_loss_percent: Number(r.system_loss_percent),
  }));
}

export interface NewSystemLoss {
  branch_id: string;
  period: string;
  kwh_purchased: number;
  kwh_sold: number;
}

function toDbRow(entry: NewSystemLoss) {
  return {
    branch_id: entry.branch_id,
    period_start: entry.period,
    period_end: endOfMonth(entry.period),
    kwh_input: entry.kwh_purchased,
    kwh_billed: entry.kwh_sold,
  };
}

export async function createSystemLoss(entry: NewSystemLoss): Promise<void> {
  const { error } = await supabase.from('system_loss').insert(toDbRow(entry));
  if (error) throw new Error(`Failed to add system loss entry: ${error.message}`);
}

export async function updateSystemLoss(id: string, entry: NewSystemLoss): Promise<void> {
  const { error } = await supabase.from('system_loss').update(toDbRow(entry)).eq('id', id);
  if (error) throw new Error(`Failed to update entry: ${error.message}`);
}

export async function deleteSystemLoss(id: string): Promise<void> {
  const { error } = await supabase.from('system_loss').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete entry: ${error.message}`);
}

/** Given a YYYY-MM-01, return the YYYY-MM-DD of the last day of that month. */
function endOfMonth(firstOfMonth: string): string {
  const [y, m] = firstOfMonth.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 0)); // day 0 of next month = last day of this
  return d.toISOString().slice(0, 10);
}
