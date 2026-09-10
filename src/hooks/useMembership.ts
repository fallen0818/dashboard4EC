import { useEffect, useState } from 'react';
import { getMembership, MembershipRow } from '../services/membershipRepository';

export function useMembership() {
  const [rows, setRows] = useState<MembershipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await getMembership();
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
        const data = await getMembership();
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

  const latestPeriod = rows[0]?.period;
  const latestRows = rows.filter((r) => r.period === latestPeriod);

  const byType = Object.values(
    latestRows.reduce((acc, r) => {
      acc[r.connection_type] = acc[r.connection_type] || { type: r.connection_type, count: 0 };
      acc[r.connection_type].count += r.consumer_count;
      return acc;
    }, {} as Record<string, { type: string; count: number }>)
  );

  const byBranch = Object.values(
    latestRows.reduce((acc, r) => {
      acc[r.branch_name] = acc[r.branch_name] || { branch: r.branch_name, count: 0 };
      acc[r.branch_name].count += r.consumer_count;
      return acc;
    }, {} as Record<string, { branch: string; count: number }>)
  );

  const totalConsumers = latestRows.reduce((s, r) => s + r.consumer_count, 0);

  return { rows: latestRows, byType, byBranch, totalConsumers, latestPeriod, loading, error, refresh };
}
