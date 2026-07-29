import { supabase } from './supabaseClient';

export interface CollectionRow {
  period: string;
  branch_name: string;
  amount_billed: number;
  amount_collected: number;
  collection_efficiency_percent: number;
}

export async function getCollectionsHistory(): Promise<CollectionRow[]> {
  const { data, error } = await supabase
    .from('collections')
    .select(
      `period, amount_billed, amount_collected, collection_efficiency_percent,
       branches ( name )`
    )
    .order('period', { ascending: true });

  if (error) throw new Error(`Failed to fetch collections history: ${error.message}`);

  return (data as any[]).map((row) => ({
    period: row.period,
    branch_name: row.branches?.name ?? 'Unknown',
    amount_billed: row.amount_billed,
    amount_collected: row.amount_collected,
    collection_efficiency_percent: row.collection_efficiency_percent,
  }));
}

export interface NewCollection {
  branch_id: string;
  period: string;
  amount_billed: number;
  amount_collected: number;
}

export async function createCollection(entry: NewCollection): Promise<void> {
  const { error } = await supabase.from('collections').insert(entry);
  if (error) throw new Error(`Failed to add collection entry: ${error.message}`);
}
