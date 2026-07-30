import { useState, useEffect, useCallback } from 'react';
import { getSystemLossData } from '../services/systemLossService';
import type { SystemLossRecord } from '../models/systemLoss.types';

export function useSystemLoss(branchId: string) {
  const [data, setData] = useState<SystemLossRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!branchId) return;
    let active = true;
    setLoading(true);
    getSystemLossData(branchId)
      .then((res) => { if (active) setData(res); })
      .catch((err) => { if (active) setError(err); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [branchId, reloadKey]);

  return { data, loading, error, refetch };
}
