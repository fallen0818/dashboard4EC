import { useEffect, useState } from 'react';
import { getPowerSupplyHistory, PowerSupplyRow } from '../services/powerSupplyRepository';

export interface PowerSupplyTrendPoint {
  yyyymm: string;
  period: string;
  totalEnergy: number;
  totalCost: number;
  weightedRate: number;   // ₱ / kWh across all suppliers that month
}

export function usePowerSupply() {
  const [rows, setRows] = useState<PowerSupplyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await getPowerSupplyHistory();
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getPowerSupplyHistory();
        if (!cancelled) {
          setRows(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const trend: PowerSupplyTrendPoint[] = Object.values(
    rows.reduce((acc, row) => {
      const key = row.period;
      if (!acc[key]) {
        acc[key] = {
          yyyymm: row.yyyymm,
          period: key,
          totalEnergy: 0,
          totalCost: 0,
          weightedRate: 0,
        };
      }
      acc[key].totalEnergy += row.energy;
      acc[key].totalCost += row.power_cost;
      return acc;
    }, {} as Record<string, PowerSupplyTrendPoint>),
  )
    .map((p) => ({
      ...p,
      weightedRate: p.totalEnergy > 0 ? Number((p.totalCost / p.totalEnergy).toFixed(4)) : 0,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  return { rows, trend, loading, error, refresh };
}
