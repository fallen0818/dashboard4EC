import { useEffect, useState } from 'react';
import { getPowerSupplyHistory, PowerSupplyRow } from '../services/powerSupplyRepository';

export interface PowerSupplyTrendPoint {
  period: string;
  totalKwhPurchased: number;
  totalKwhSold: number;
  totalCost: number;
  totalRevenue: number;
  margin: number;
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
    refresh();
  }, []);

  const trend: PowerSupplyTrendPoint[] = Object.values(
    rows.reduce((acc, row) => {
      const key = row.period;
      if (!acc[key]) {
        acc[key] = {
          period: key,
          totalKwhPurchased: 0,
          totalKwhSold: 0,
          totalCost: 0,
          totalRevenue: 0,
          margin: 0,
        };
      }
      acc[key].totalKwhPurchased += row.kwh_purchased;
      acc[key].totalKwhSold += row.kwh_sold;
      acc[key].totalCost += row.purchased_power_cost;
      acc[key].totalRevenue += row.sales_revenue;
      return acc;
    }, {} as Record<string, PowerSupplyTrendPoint>)
  )
    .map((point) => ({ ...point, margin: point.totalRevenue - point.totalCost }))
    .sort((a, b) => a.period.localeCompare(b.period));

  return { rows, trend, loading, error, refresh };
}
