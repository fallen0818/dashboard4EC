import { supabase } from './supabase/client';
import type { MembershipRecord } from '../models/membership.types';

export async function getMembershipData(branchId: string): Promise<MembershipRecord[]> {
  const { data, error } = await supabase
    .from('membership')
    .select('*')
    .eq('branch_id', branchId)
    .order('period_start', { ascending: true });

  if (error) throw error;
  return data as MembershipRecord[];
}

export interface NewMembership {
  branch_id: string;
  period_start: string;
  period_end: string;
  total_consumers: number;
  new_connections: number;
  disconnections: number;
  reconnections: number;
}

export async function createMembershipRecord(input: NewMembership): Promise<MembershipRecord> {
  const { data, error } = await supabase.from('membership').insert(input).select().single();
  if (error) throw error;
  return data as MembershipRecord;
}
