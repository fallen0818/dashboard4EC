import { useEffect, useState } from 'react';
import { getSystemLossHistory, SystemLossRow } from '../services/systemLossRepository';

export interface MonthlyTrendPoint {
  period: string;
  totalKwhPurchased: number;
  totalKwhSold: number;
  systemLossPercent: number;
}

export function useSystemLoss() {
  const [rows, setRows] = useState<SystemLossRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await getSystemLossHistory();
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
        const data = await getSystemLossHistory();
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

  // Aggregate across branches, one point per month, for the trend chart.
  const trend: MonthlyTrendPoint[] = Object.values(
    rows.reduce((acc, row) => {
      const key = row.period;
      if (!acc[key]) {
        acc[key] = { period: key, totalKwhPurchased: 0, totalKwhSold: 0, systemLossPercent: 0 };
      }
      acc[key].totalKwhPurchased += row.kwh_purchased;
      acc[key].totalKwhSold += row.kwh_sold;
      return acc;
    }, {} as Record<string, MonthlyTrendPoint>)
  )
    .map((point) => ({
      ...point,
      systemLossPercent:
        point.totalKwhPurchased > 0
          ? Number(
              (
                ((point.totalKwhPurchased - point.totalKwhSold) / point.totalKwhPurchased) *
                100
              ).toFixed(2)
            )
          : 0,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  return { rows, trend, loading, error, refresh };
}
