import { useEffect, useMemo, useState } from 'react';
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
    return () => { cancelled = true; };
  }, []);

  // Distinct months (YYYY-MM-01, newest first) and their years.
  const months = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(`${r.period.slice(0, 7)}-01`);
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [rows]);

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const m of months) set.add(Number(m.slice(0, 4)));
    return Array.from(set).sort((a, b) => b - a);
  }, [months]);

  return { rows, months, years, loading, error, refresh };
}

/**
 * Derive per-type / per-branch aggregates + totals for a given subset
 * of membership rows (already filtered to the currently-selected period).
 */
export function membershipAggregates(rows: MembershipRow[]) {
  const byType = Object.values(
    rows.reduce((acc, r) => {
      acc[r.connection_type] = acc[r.connection_type] || { type: r.connection_type, count: 0, energy: 0 };
      acc[r.connection_type].count  += r.consumer_count;
      acc[r.connection_type].energy += r.energy_kwh;
      return acc;
    }, {} as Record<string, { type: string; count: number; energy: number }>),
  );

  const byBranch = Object.values(
    rows.reduce((acc, r) => {
      acc[r.branch_name] = acc[r.branch_name] || { branch: r.branch_name, count: 0, energy: 0 };
      acc[r.branch_name].count  += r.consumer_count;
      acc[r.branch_name].energy += r.energy_kwh;
      return acc;
    }, {} as Record<string, { branch: string; count: number; energy: number }>),
  );

  const totalConsumers = rows.reduce((s, r) => s + r.consumer_count, 0);
  const totalEnergy    = rows.reduce((s, r) => s + r.energy_kwh, 0);

  return { byType, byBranch, totalConsumers, totalEnergy };
}
