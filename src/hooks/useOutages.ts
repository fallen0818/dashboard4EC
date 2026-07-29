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
    refresh();
  }, []);

  const totalOutages = rows.length;
  const totalMinutes = rows.reduce((s, r) => s + r.duration_minutes, 0);
  const totalConsumersAffected = rows.reduce((s, r) => s + r.consumers_affected, 0);
  const avgDuration = totalOutages > 0 ? Math.round(totalMinutes / totalOutages) : 0;

  return {
    rows,
    loading,
    error,
    refresh,
    totalOutages,
    totalMinutes,
    totalConsumersAffected,
    avgDuration,
  };
}
