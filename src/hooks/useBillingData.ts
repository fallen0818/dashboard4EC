import { useState, useEffect, useCallback } from 'react';
import { getBillsForBranch } from '../services/billingService';
import type { BillWithMember } from '../models/billing.types';

export function useBillingData(branchId: string) {
  const [data, setData] = useState<BillWithMember[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!branchId) return;
    let active = true;
    setLoading(true);
    getBillsForBranch(branchId)
      .then((res) => { if (active) setData(res); })
      .catch((err) => { if (active) setError(err); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [branchId, reloadKey]);

  return { data, loading, error, refetch };
}
