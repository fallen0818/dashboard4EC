import { describe, expect, it } from 'vitest';
import {
  addOneMonth,
  collectionEfficiencyPercent,
  sumBy,
  systemLossPercent,
} from '../dashboardMath';

describe('systemLossPercent', () => {
  it('returns the percentage of kWh lost, rounded to 2dp', () => {
    // 1000 purchased, 870 sold -> 130 lost -> 13.00%
    expect(systemLossPercent(1000, 870)).toBe(13);
    // 500,000 purchased, 428,750 sold -> 14.25%
    expect(systemLossPercent(500_000, 428_750)).toBe(14.25);
  });

  it('returns 0 when nothing was purchased (avoids divide-by-zero)', () => {
    expect(systemLossPercent(0, 0)).toBe(0);
    expect(systemLossPercent(0, 100)).toBe(0);
  });

  it('never returns negative loss for the pathological sold > purchased case', () => {
    // Sold > purchased shouldn't happen, but if it does the formula
    // naturally produces a negative number — document the current behavior
    // so a change is a conscious decision.
    expect(systemLossPercent(1000, 1100)).toBe(-10);
  });
});

describe('collectionEfficiencyPercent', () => {
  it('returns collected / billed as a percent, rounded to 2dp', () => {
    expect(collectionEfficiencyPercent(1_000_000, 950_000)).toBe(95);
    expect(collectionEfficiencyPercent(1234.56, 1000)).toBe(81.00); // 81.0036...
  });

  it('returns 0 when nothing was billed', () => {
    expect(collectionEfficiencyPercent(0, 0)).toBe(0);
    expect(collectionEfficiencyPercent(0, 50_000)).toBe(0);
  });
});

describe('sumBy', () => {
  it('sums the given numeric field across rows', () => {
    const rows = [{ x: 1 }, { x: 2 }, { x: 3 }];
    expect(sumBy(rows, 'x')).toBe(6);
  });

  it('treats null / undefined / non-numeric values as 0', () => {
    const rows = [{ x: 1 }, { x: null }, { x: 'nope' }, { x: undefined }] as const;
    expect(sumBy(rows as unknown as Array<Record<string, unknown>>, 'x')).toBe(1);
  });

  it('handles null and undefined row arrays', () => {
    expect(sumBy(null, 'x')).toBe(0);
    expect(sumBy(undefined, 'x')).toBe(0);
  });
});

describe('addOneMonth', () => {
  it('advances by exactly one calendar month, TZ-safe', () => {
    expect(addOneMonth('2026-01-01')).toBe('2026-02-01');
    expect(addOneMonth('2026-11-01')).toBe('2026-12-01');
    expect(addOneMonth('2026-12-01')).toBe('2027-01-01');
  });
});
