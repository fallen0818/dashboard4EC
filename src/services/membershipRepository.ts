import { supabase } from './supabaseClient';

export interface MembershipRow {
  period: string;
  branch_name: string;
  connection_type: string;
  consumer_count: number;
}

export async function getMembership(): Promise<MembershipRow[]> {
  const { data, error } = await supabase
    .from('membership')
    .select(`period, connection_type, consumer_count, branches ( name )`)
    .order('period', { ascending: false });

  if (error) throw new Error(`Failed to fetch membership: ${error.message}`);

  return (data as any[]).map((row) => ({
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
