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

type Raw = {
  id: string;
  branch_id: string;
  start_time: string;
  end_time: string | null;
  cause: string | null;
  feeder_name: string | null;
  affected_consumers: number;
  branches: { name: string } | null;
};

export async function getOutages(): Promise<OutageRow[]> {
  const { data, error } = await supabase
    .from('outages')
    .select(`
      id, branch_id, start_time, end_time, cause, feeder_name, affected_consumers,
      branches ( name )
    `)
    .order('start_time', { ascending: false });

  if (error) throw new Error(`Failed to fetch outages: ${error.message}`);

  return ((data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id,
    branch_id: r.branch_id,
    branch_name: r.branches?.name ?? 'Unknown',
    date: r.start_time.slice(0, 10),
    duration_minutes: minutesBetween(r.start_time, r.end_time),
    cause: r.cause,
    area_affected: r.feeder_name,
    consumers_affected: Number(r.affected_consumers) || 0,
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

function toDbRow(entry: NewOutage) {
  const start = new Date(`${entry.date}T00:00:00Z`);
  const end = new Date(start.getTime() + entry.duration_minutes * 60_000);
  return {
    branch_id: entry.branch_id,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    cause: entry.cause,
    feeder_name: entry.area_affected,
    affected_consumers: entry.consumers_affected,
    outage_type: 'unscheduled' as const,
  };
}

export async function createOutage(outage: NewOutage): Promise<void> {
  const { error } = await supabase.from('outages').insert(toDbRow(outage));
  if (error) throw new Error(`Failed to log outage: ${error.message}`);
}

export async function updateOutage(id: string, outage: NewOutage): Promise<void> {
  const { error } = await supabase.from('outages').update(toDbRow(outage)).eq('id', id);
  if (error) throw new Error(`Failed to update outage: ${error.message}`);
}

export async function deleteOutage(id: string): Promise<void> {
  const { error } = await supabase.from('outages').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete outage: ${error.message}`);
}

function minutesBetween(startISO: string, endISO: string | null): number {
  if (!endISO) return 0;
  return Math.max(0, Math.round((Date.parse(endISO) - Date.parse(startISO)) / 60_000));
}
