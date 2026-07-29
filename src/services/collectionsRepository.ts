import { supabase } from './supabaseClient';

export interface CollectionRow {
  id: string;
  branch_id: string;
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
      `id, branch_id, period, amount_billed, amount_collected, collection_efficiency_percent,
       branches ( name )`
    )
    .order('period', { ascending: true });

  if (error) throw new Error(`Failed to fetch collections history: ${error.message}`);

  return (data as any[]).map((row) => ({
    id: row.id,
    branch_id: row.branch_id,
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

export async function updateCollection(id: string, entry: NewCollection): Promise<void> {
  const { error } = await supabase.from('collections').update(entry).eq('id', id);
  if (error) throw new Error(`Failed to update entry: ${error.message}`);
}

export async function deleteCollection(id: string): Promise<void> {
  const { error } = await supabase.from('collections').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete entry: ${error.message}`);
}
