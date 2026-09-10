import { supabase } from './supabaseClient';

export interface MembershipRow {
  id: string;
  branch_id: string;
  period: string;
  branch_name: string;
  connection_type: string;
  consumer_count: number;
}

type Raw = {
  id: string;
  branch_id: string;
  period_start: string;
  total_consumers: number;
  branches: { name: string } | null;
};

// The live schema has no connection_type breakdown on `membership` —
// it stores a single `total_consumers` per branch/period. We surface
// each row as connection_type='all' so the existing UI still works.
export async function getMembership(): Promise<MembershipRow[]> {
  const { data, error } = await supabase
    .from('membership')
    .select(`id, branch_id, period_start, total_consumers, branches ( name )`)
    .order('period_start', { ascending: false });

  if (error) throw new Error(`Failed to fetch membership: ${error.message}`);

  return ((data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id,
    branch_id: r.branch_id,
    period: r.period_start,
    branch_name: r.branches?.name ?? 'Unknown',
    connection_type: 'all',
    consumer_count: Number(r.total_consumers) || 0,
  }));
}

export interface NewMembership {
  branch_id: string;
  period: string;
  connection_type: string; // ignored — schema has no such column
  consumer_count: number;
}

function toDbRow(entry: NewMembership) {
  return {
    branch_id: entry.branch_id,
    period_start: entry.period,
    period_end: endOfMonth(entry.period),
    total_consumers: entry.consumer_count,
  };
}

export async function createMembership(entry: NewMembership): Promise<void> {
  const { error } = await supabase.from('membership').insert(toDbRow(entry));
  if (error) throw new Error(`Failed to add membership entry: ${error.message}`);
}

export async function updateMembership(id: string, entry: NewMembership): Promise<void> {
  const { error } = await supabase.from('membership').update(toDbRow(entry)).eq('id', id);
  if (error) throw new Error(`Failed to update entry: ${error.message}`);
}

export async function deleteMembership(id: string): Promise<void> {
  const { error } = await supabase.from('membership').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete entry: ${error.message}`);
}

function endOfMonth(firstOfMonth: string): string {
  const [y, m] = firstOfMonth.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
