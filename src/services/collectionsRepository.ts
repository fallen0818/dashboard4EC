import { supabase } from './supabaseClient';

// There is no `collections` table in the live schema. Collection
// efficiency is derived from bills (amount billed) and payments
// (amount collected), grouped by the bill's branch and billing month.
//
// Writes are not supported here — collections are a computed view of
// bills + payments, not a first-class table. Use the billing workflow
// to record real activity.

export interface CollectionRow {
  id: string;
  branch_id: string;
  period: string;
  branch_name: string;
  amount_billed: number;
  amount_collected: number;
  collection_efficiency_percent: number;
}

interface BillRow {
  id: string;
  billing_period_start: string;
  total_amount: number;
  members: { branch_id: string; branches: { name: string } | null } | null;
}

interface PaymentRow {
  bill_id: string;
  amount: number;
}

export async function getCollectionsHistory(): Promise<CollectionRow[]> {
  const [{ data: bills, error: bErr }, { data: payments, error: pErr }] = await Promise.all([
    supabase
      .from('bills')
      .select(`
        id, billing_period_start, total_amount,
        members ( branch_id, branches ( name ) )
      `)
      .order('billing_period_start', { ascending: true }),
    supabase
      .from('payments')
      .select('bill_id, amount'),
  ]);

  if (bErr) throw new Error(`Failed to fetch bills: ${bErr.message}`);
  if (pErr) throw new Error(`Failed to fetch payments: ${pErr.message}`);

  // Payments summed by bill_id.
  const paidByBill = new Map<string, number>();
  for (const p of (payments ?? []) as PaymentRow[]) {
    paidByBill.set(p.bill_id, (paidByBill.get(p.bill_id) ?? 0) + (Number(p.amount) || 0));
  }

  // Fold bills into (branch, first-of-month) buckets.
  type Bucket = { branch_id: string; branch_name: string; period: string; billed: number; collected: number };
  const buckets = new Map<string, Bucket>();

  for (const b of ((bills ?? []) as unknown as BillRow[])) {
    if (!b.members?.branch_id) continue; // no branch to attribute — skip
    const period = firstOfMonth(b.billing_period_start);
    const key = `${b.members.branch_id}|${period}`;
    const bucket = buckets.get(key) ?? {
      branch_id: b.members.branch_id,
      branch_name: b.members.branches?.name ?? 'Unknown',
      period,
      billed: 0,
      collected: 0,
    };
    bucket.billed += Number(b.total_amount) || 0;
    bucket.collected += paidByBill.get(b.id) ?? 0;
    buckets.set(key, bucket);
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((r) => ({
      id: `${r.branch_id}|${r.period}`,
      branch_id: r.branch_id,
      period: r.period,
      branch_name: r.branch_name,
      amount_billed: round2(r.billed),
      amount_collected: round2(r.collected),
      collection_efficiency_percent:
        r.billed > 0 ? round2((r.collected / r.billed) * 100) : 0,
    }));
}

export interface NewCollection {
  branch_id: string;
  period: string;
  amount_billed: number;
  amount_collected: number;
}

const WRITE_NOT_SUPPORTED =
  'Collections are derived from bills and payments — record activity there instead.';

export async function createCollection(_entry: NewCollection): Promise<void> {
  throw new Error(WRITE_NOT_SUPPORTED);
}

export async function updateCollection(_id: string, _entry: NewCollection): Promise<void> {
  throw new Error(WRITE_NOT_SUPPORTED);
}

export async function deleteCollection(_id: string): Promise<void> {
  throw new Error(WRITE_NOT_SUPPORTED);
}

function firstOfMonth(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
