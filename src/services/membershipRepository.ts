import { supabase } from './supabaseClient';

export interface MembershipRow {
  id: string;
  branch_id: string;
  period: string;
  branch_name: string;
  connection_type: string;
  consumer_count: number;
}

export async function getMembership(): Promise<MembershipRow[]> {
  const { data, error } = await supabase
    .from('membership')
    .select(`id, branch_id, period, connection_type, consumer_count, branches ( name )`)
    .order('period', { ascending: false });

  if (error) throw new Error(`Failed to fetch membership: ${error.message}`);

  return (data as any[]).map((row) => ({
    id: row.id,
    branch_id: row.branch_id,
    period: row.period,
    branch_name: row.branches?.name ?? 'Unknown',
    connection_type: row.connection_type,
    consumer_count: row.consumer_count,
  }));
}

export interface NewMembership {
  branch_id: string;
  period: string;
  connection_type: string;
  consumer_count: number;
}

export async function createMembership(entry: NewMembership): Promise<void> {
  const { error } = await supabase.from('membership').insert(entry);
  if (error) throw new Error(`Failed to add membership entry: ${error.message}`);
}

export async function updateMembership(id: string, entry: NewMembership): Promise<void> {
  const { error } = await supabase.from('membership').update(entry).eq('id', id);
  if (error) throw new Error(`Failed to update entry: ${error.message}`);
}

export async function deleteMembership(id: string): Promise<void> {
  const { error } = await supabase.from('membership').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete entry: ${error.message}`);
}
