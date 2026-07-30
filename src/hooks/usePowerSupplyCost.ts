import { useState, useEffect, useCallback } from 'react';
import { getPowerSupplyData } from '../services/powerSupplyService';
import type { PowerSupplyWithPrice } from '../models/powerSupply.types';

export function usePowerSupplyCost(branchId: string) {
  const [data, setData] = useState<PowerSupplyWithPrice[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!branchId) return;
    let active = true;
    setLoading(true);
    getPowerSupplyData(branchId)
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) setError(err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [branchId, reloadKey]);

  return { data, loading, error, refetch };
}
