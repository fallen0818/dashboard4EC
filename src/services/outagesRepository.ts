import { supabase } from './supabaseClient';

export interface OutageRow {
  id: string;
  branch_id: string;
  branch_name: string;
  went_off: string;                 // ISO datetime, e.g. "2026-07-15T14:30:00Z"
  restored: string | null;          // ISO datetime or null if unresolved
  date: string;                     // YYYY-MM-DD of went_off (kept for compat)
  duration_minutes: number;         // derived from went_off / restored
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
    went_off: r.start_time,
    restored: r.end_time,
    date: r.start_time.slice(0, 10),
    duration_minutes: minutesBetween(r.start_time, r.end_time),
    cause: r.cause,
    area_affected: r.feeder_name,
    consumers_affected: Number(r.affected_consumers) || 0,
  }));
}

export interface NewOutage {
  branch_id: string;
  went_off: string;                 // ISO datetime
  restored: string;                 // ISO datetime (required for now)
  cause: string;
  area_affected: string;
  consumers_affected: number;
}

function toDbRow(entry: NewOutage) {
  const startMs = Date.parse(entry.went_off);
  const endMs = Date.parse(entry.restored);
  if (!isFinite(startMs)) throw new Error('Time went-off is not a valid date/time');
  if (!isFinite(endMs))   throw new Error('Time restored is not a valid date/time');
  if (endMs < startMs)    throw new Error('Time restored is earlier than time went-off');
  return {
    branch_id: entry.branch_id,
    start_time: new Date(startMs).toISOString(),
    end_time:   new Date(endMs).toISOString(),
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

export function minutesBetween(startISO: string, endISO: string | null): number {
  if (!endISO) return 0;
  return Math.max(0, Math.round((Date.parse(endISO) - Date.parse(startISO)) / 60_000));
}

/** Converts an ISO timestamp to the value expected by <input type="datetime-local">. */
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
