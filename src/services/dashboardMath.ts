// Pure math helpers for dashboard metrics. Kept free of Supabase types so
// they can be unit-tested without any DB fixture, and re-used anywhere a
// derived metric is displayed.

export function systemLossPercent(kwhPurchased: number, kwhSold: number): number {
  if (kwhPurchased <= 0) return 0;
  return round2(((kwhPurchased - kwhSold) / kwhPurchased) * 100);
}

export function collectionEfficiencyPercent(
  amountBilled: number,
  amountCollected: number,
): number {
  if (amountBilled <= 0) return 0;
  return round2((amountCollected / amountBilled) * 100);
}

export function sumBy<T extends Record<string, unknown>>(
  rows: readonly T[] | null | undefined,
  key: keyof T,
): number {
  return (rows ?? []).reduce((acc, row) => acc + (Number(row[key]) || 0), 0);
}

/** Add one calendar month to a `YYYY-MM-DD` date string, TZ-safe. */
export function addOneMonth(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(Date.UTC(y, m /* 0-indexed +1 */, d));
  return next.toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
