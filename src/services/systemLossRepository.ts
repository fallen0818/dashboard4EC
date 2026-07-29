import { supabase } from './supabaseClient';

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

// Fetches every system_loss record joined with the branch name, oldest first.
export async function getSystemLossHistory(): Promise<SystemLossRow[]> {
  const { data, error } = await supabase
    .from('system_loss')
    .select(
      `id, branch_id, period, kwh_purchased, kwh_sold, system_loss_kwh, system_loss_percent,
       branches ( name )`
    )
    .order('period', { ascending: true });

  if (error) throw new Error(`Failed to fetch system loss history: ${error.message}`);

  return (data as any[]).map((row) => ({
    id: row.id,
    branch_id: row.branch_id,
    period: row.period,
    branch_name: row.branches?.name ?? 'Unknown',
    kwh_purchased: row.kwh_purchased,
    kwh_sold: row.kwh_sold,
    system_loss_kwh: row.system_loss_kwh,
    system_loss_percent: row.system_loss_percent,
  }));
}

export async function updateSystemLoss(id: string, entry: NewSystemLoss): Promise<void> {
  const { error } = await supabase.from('system_loss').update(entry).eq('id', id);
  if (error) throw new Error(`Failed to update entry: ${error.message}`);
}

export async function deleteSystemLoss(id: string): Promise<void> {
  const { error } = await supabase.from('system_loss').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete entry: ${error.message}`);
}


export interface NewSystemLoss {
  branch_id: string;
  period: string;
  kwh_purchased: number;
  kwh_sold: number;
}

export async function createSystemLoss(entry: NewSystemLoss): Promise<void> {
  const { error } = await supabase.from('system_loss').insert(entry);
  if (error) throw new Error(`Failed to add system loss entry: ${error.message}`);
}
