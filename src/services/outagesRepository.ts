import { supabase } from './supabaseClient';

export interface OutageRow {
  id: string;
  branch_id: string;
  branch_name: string;
  date: string;
  duration_minutes: number;
  cause: string | null;
  area_affected: string | null;
  consumers_affected: number;
}

export async function getOutages(): Promise<OutageRow[]> {
  const { data, error } = await supabase
    .from('outages')
    .select(
      `id, branch_id, date, duration_minutes, cause, area_affected, consumers_affected,
       branches ( name )`
    )
    .order('date', { ascending: false });

  if (error) throw new Error(`Failed to fetch outages: ${error.message}`);

  return (data as any[]).map((row) => ({
    id: row.id,
    branch_id: row.branch_id,
    branch_name: row.branches?.name ?? 'Unknown',
    date: row.date,
    duration_minutes: row.duration_minutes,
    cause: row.cause,
    area_affected: row.area_affected,
    consumers_affected: row.consumers_affected,
  }));
}

export interface NewOutage {
  branch_id: string;
  date: string;
  duration_minutes: number;
  cause: string;
  area_affected: string;
  consumers_affected: number;
}

export async function createOutage(outage: NewOutage): Promise<void> {
  const { error } = await supabase.from('outages').insert(outage);
  if (error) throw new Error(`Failed to log outage: ${error.message}`);
}

export async function updateOutage(id: string, outage: NewOutage): Promise<void> {
  const { error } = await supabase.from('outages').update(outage).eq('id', id);
  if (error) throw new Error(`Failed to update outage: ${error.message}`);
}

export async function deleteOutage(id: string): Promise<void> {
  const { error } = await supabase.from('outages').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete outage: ${error.message}`);
}
