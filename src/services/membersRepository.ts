import { supabase } from './supabaseClient';

export type MemberStatus = 'active' | 'disconnected' | 'closed';

export interface Member {
  id: string;
  branch_id: string;
  branch_name: string;
  account_number: string;
  full_name: string;
  address: string | null;
  status: MemberStatus;
  created_at: string;
}

type Raw = {
  id: string;
  branch_id: string;
  account_number: string;
  full_name: string;
  address: string | null;
  status: MemberStatus;
  created_at: string;
  branches: { name: string } | null;
};

export async function listMembers(): Promise<Member[]> {
  const { data, error } = await supabase
    .from('members')
    .select(`id, branch_id, account_number, full_name, address, status, created_at, branches ( name )`)
    .order('account_number', { ascending: true });
  if (error) throw new Error(`Failed to load members: ${error.message}`);
  return ((data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id,
    branch_id: r.branch_id,
    branch_name: r.branches?.name ?? 'Unknown',
    account_number: r.account_number,
    full_name: r.full_name,
    address: r.address,
    status: r.status,
    created_at: r.created_at,
  }));
}

export interface NewMember {
  branch_id: string;
  account_number: string;
  full_name: string;
  address: string | null;
  status: MemberStatus;
}

export async function createMember(entry: NewMember): Promise<void> {
  const { error } = await supabase.from('members').insert(entry);
  if (error) throw new Error(`Failed to add member: ${error.message}`);
}

export async function updateMemberRow(id: string, entry: Partial<NewMember>): Promise<void> {
  const { error } = await supabase.from('members').update(entry).eq('id', id);
  if (error) throw new Error(`Failed to update member: ${error.message}`);
}

export async function deleteMember(id: string): Promise<void> {
  const { error } = await supabase.from('members').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
