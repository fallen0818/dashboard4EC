import { supabase } from './supabaseClient';
import { AppRole } from '../hooks/useRole';

export interface UserWithRole {
  user_id: string;
  email: string | null;
  role: AppRole;
  created_at: string;
}

/**
 * List every user with their role. Admin-only in practice (RLS on
 * user_roles limits SELECT to `is_admin()`; non-admins get 0 rows).
 * Emails come from auth.users via a joined view we create in-line here
 * — since we can't select from auth.users directly through PostgREST,
 * we join in the RPC instead. But no RPC needed: `user_roles` alone
 * has enough for the app, and we can render user_id when no email
 * lookup is available.
 */
export async function listUsers(): Promise<UserWithRole[]> {
  // Backed by a SECURITY DEFINER RPC that internally enforces is_admin().
  const { data, error } = await supabase.rpc('list_users_with_role');
  if (error) throw new Error(`Failed to load users: ${error.message}`);
  return ((data as UserWithRole[] | null) ?? [])
    .slice()
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function setUserRole(user_id: string, role: AppRole): Promise<void> {
  const { error } = await supabase
    .from('user_roles')
    .upsert({ user_id, role }, { onConflict: 'user_id' });
  if (error) throw new Error(`Failed to set role: ${error.message}`);
}

export async function removeUserRole(user_id: string): Promise<void> {
  const { error } = await supabase.from('user_roles').delete().eq('user_id', user_id);
  if (error) throw new Error(`Failed to remove role: ${error.message}`);
}
