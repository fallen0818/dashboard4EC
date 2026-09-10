import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

export type AppRole = 'admin' | 'editor' | 'viewer';

/**
 * Loads the current user's role from public.user_roles.
 * Returns 'viewer' as the safe default while loading or if no row exists,
 * so UI never accidentally offers write access it hasn't confirmed.
 */
export function useRole() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) { setRole(null); setLoading(false); }
          return;
        }
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          setRole('viewer'); // safest fallback
        } else {
          setRole((data?.role as AppRole | undefined) ?? 'viewer');
        }
      } catch {
        if (!cancelled) setRole('viewer');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const isAdmin  = role === 'admin';
  const isEditor = role === 'editor';
  const canWrite = isAdmin || isEditor;   // insert + update
  const canDelete = isAdmin;              // admin only

  return { role, loading, isAdmin, isEditor, canWrite, canDelete };
}
