import { computeCollectionEfficiency, computeReceivablesAging } from '../billingService';
import type { Bill } from '../../models/billing.types';

function bill(partial: Partial<Bill>): Bill {
  return {
    id: 'x',
    member_id: 'm',
    billing_period_start: '2026-07-01',
    billing_period_end: '2026-07-31',
    due_date: '2026-08-15',
    total_amount: 0,
    amount_paid: 0,
    status: 'unpaid',
    created_at: '2026-07-01T00:00:00Z',
    ...partial,
  };
}

describe('computeCollectionEfficiency', () => {
  it('returns collected / billed', () => {
    const bills = [
      bill({ total_amount: 100, amount_paid: 100 }),
      bill({ total_amount: 100, amount_paid: 50 }),
    ];
    expect(computeCollectionEfficiency(bills)).toBeCloseTo(0.75);
  });

  it('returns 0 when nothing is billed', () => {
    expect(computeCollectionEfficiency([])).toBe(0);
  });
});

describe('computeReceivablesAging', () => {
  it('buckets an unpaid balance by days overdue', () => {
    const asOf = new Date('2026-09-30');
    const buckets = computeReceivablesAging(
      [bill({ total_amount: 1000, amount_paid: 0, due_date: '2026-08-15' })],
      asOf
    );
    // 46 days overdue -> 31-60 bucket
    expect(buckets.days_31_60).toBe(1000);
    expect(buckets.current).toBe(0);
  });

  it('ignores fully paid bills', () => {
    const buckets = computeReceivablesAging([bill({ total_amount: 500, amount_paid: 500 })]);
    expect(Object.values(buckets).every((v) => v === 0)).toBe(true);
  });
});
