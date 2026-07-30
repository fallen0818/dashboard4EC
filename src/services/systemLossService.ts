import { supabase } from './supabase/client';
import type { SystemLossRecord } from '../models/systemLoss.types';

export async function getSystemLossData(branchId: string): Promise<SystemLossRecord[]> {
  const { data, error } = await supabase
    .from('system_loss')
    .select('*')
    .eq('branch_id', branchId)
    .order('period_start', { ascending: true });

  if (error) throw error;
  return data as SystemLossRecord[];
}

export interface NewSystemLoss {
  branch_id: string;
  period_start: string;
  period_end: string;
  kwh_input: number;
  kwh_billed: number;
  cap_percent?: number;
}

// system_loss_kwh and system_loss_percent are generated columns — never inserted.
export async function createSystemLossRecord(input: NewSystemLoss): Promise<SystemLossRecord> {
  const { data, error } = await supabase.from('system_loss').insert(input).select().single();
  if (error) throw error;
  return data as SystemLossRecord;
}
