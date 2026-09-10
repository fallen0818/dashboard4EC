import { useEffect, useState } from 'react';
import { getOutages, OutageRow } from '../services/outagesRepository';

export function useOutages() {
  const [rows, setRows] = useState<OutageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await getOutages();
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
        const data = await getOutages();
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

  const totalOutages = rows.length;
  const totalMinutes = rows.reduce((s, r) => s + r.duration_minutes, 0);
  const totalConsumersAffected = rows.reduce((s, r) => s + r.consumers_affected, 0);
  const avgDuration = totalOutages > 0 ? Math.round(totalMinutes / totalOutages) : 0;

  const byCause = Object.values(
    rows.reduce((acc, r) => {
      const key = r.cause?.trim() || 'Unspecified';
      if (!acc[key]) acc[key] = { cause: key, count: 0, minutes: 0 };
      acc[key].count += 1;
      acc[key].minutes += r.duration_minutes;
      return acc;
    }, {} as Record<string, { cause: string; count: number; minutes: number }>)
  ).sort((a, b) => b.count - a.count);

  return {
    rows,
    loading,
    error,
    refresh,
    totalOutages,
    totalMinutes,
    totalConsumersAffected,
    avgDuration,
    byCause,
  };
}
