import { useEffect, useState } from 'react';
import {
  DashboardSummary,
  PeriodRange,
  getDashboardSummary,
} from '../services/dashboardRepository';

export function useDashboard(range?: PeriodRange | null) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboardSummary(range ?? undefined);
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  // Re-load whenever the range changes.
  const rangeKey = range ? `${range.mode}:${range.from}:${range.to}` : '__latest__';
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getDashboardSummary(range ?? undefined);
        if (!cancelled) {
          setSummary(data);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey]);

  return { summary, loading, error, refresh };
}
