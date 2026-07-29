import { useEffect, useState } from 'react';
import { getCollectionsHistory, CollectionRow } from '../services/collectionsRepository';

export interface CollectionsTrendPoint {
  period: string;
  totalBilled: number;
  totalCollected: number;
  totalReceivable: number;
  collectionEfficiencyPercent: number;
}

export function useCollections() {
  const [rows, setRows] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await getCollectionsHistory();
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

  const trend: CollectionsTrendPoint[] = Object.values(
    rows.reduce((acc, row) => {
      const key = row.period;
      if (!acc[key]) {
        acc[key] = {
          period: key,
          totalBilled: 0,
          totalCollected: 0,
          totalReceivable: 0,
          collectionEfficiencyPercent: 0,
        };
      }
      acc[key].totalBilled += row.amount_billed;
      acc[key].totalCollected += row.amount_collected;
      return acc;
    }, {} as Record<string, CollectionsTrendPoint>)
  )
    .map((point) => ({
      ...point,
      totalReceivable: point.totalBilled - point.totalCollected,
      collectionEfficiencyPercent:
        point.totalBilled > 0
          ? Number(((point.totalCollected / point.totalBilled) * 100).toFixed(2))
          : 0,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  return { rows, trend, loading, error, refresh };
}
