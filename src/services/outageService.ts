import { supabase } from './supabase/client';
import type { OutageRecord } from '../models/outage.types';

export async function getOutageData(branchId: string): Promise<OutageRecord[]> {
  const { data, error } = await supabase
    .from('outages')
    .select('*')
    .eq('branch_id', branchId)
    .order('start_time', { ascending: false });

  if (error) throw error;
  return data as OutageRecord[];
}

export interface NewOutage {
  branch_id: string;
  feeder_name: string;
  outage_type: OutageRecord['outage_type'];
  cause: string | null;
  start_time: string;
  end_time: string | null;
  affected_consumers: number;
}

export async function createOutage(input: NewOutage): Promise<OutageRecord> {
  const { data, error } = await supabase.from('outages').insert(input).select().single();
  if (error) throw error;
  return data as OutageRecord;
}

export function computeOutageDurationMinutes(outage: OutageRecord): number | null {
  if (!outage.end_time) return null;
  const start = new Date(outage.start_time).getTime();
  const end = new Date(outage.end_time).getTime();
  return Math.round((end - start) / 60000);
}
