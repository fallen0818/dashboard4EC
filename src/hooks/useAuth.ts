import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase/client';
import type { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Branch scoping comes from the JWT's app_metadata.branch_id claim, set by the
  // signup trigger (migration 0008) or an admin update. RLS policies key off the
  // same claim, so using it here guarantees reads/writes are self-consistent.
  const branchId = (user?.app_metadata?.branch_id as string | undefined) ?? null;

  return { user, loading, branchId };
}
