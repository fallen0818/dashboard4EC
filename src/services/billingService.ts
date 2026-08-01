import { supabase } from './supabase/client';
import type { BillWithMember, Bill, Member, Payment } from '../models/billing.types';

/**
 * Fetch bills joined with member info, for a branch, ordered by due date.
 */
export async function getBillsForBranch(branchId: string): Promise<BillWithMember[]> {
  const { data, error } = await supabase
    .from('bills')
    .select(
      `
      id, member_id, billing_period_start, billing_period_end, due_date,
      total_amount, amount_paid, status, created_at,
      members!inner ( account_number, full_name, status, branch_id )
    `
    )
    .eq('members.branch_id', branchId)
    .order('due_date', { ascending: true });

  if (error) throw error;
  return data as unknown as BillWithMember[];
}

/**
 * Members for a branch, for populating dropdowns on the bill/payment forms.
 */
export async function getMembersForBranch(branchId: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('branch_id', branchId)
    .order('account_number', { ascending: true });

  if (error) throw error;
  return data as Member[];
}

export interface NewMember {
  branch_id: string;
  account_number: string;
  full_name: string;
  address: string | null;
  status: Member['status'];
}

export async function createMember(input: NewMember): Promise<Member> {
  const { data, error } = await supabase.from('members').insert(input).select().single();
  if (error) throw error;
  return data as Member;
}

export async function updateMember(id: string, input: NewMember): Promise<Member> {
  const { data, error } = await supabase.from('members').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data as Member;
}

// Deleting a member cascades to their meters, bills, payments, etc. via the
// schema's ON DELETE CASCADE foreign keys — use with care.
export async function deleteMember(id: string): Promise<void> {
  const { error } = await supabase.from('members').delete().eq('id', id);
  if (error) throw error;
}

export interface NewBill {
  member_id: string;
  billing_period_start: string;
  billing_period_end: string;
  due_date: string;
  total_amount: number;
  amount_paid?: number;
  status: Bill['status'];
}

export async function createBill(input: NewBill): Promise<Bill> {
  const { data, error } = await supabase.from('bills').insert(input).select().single();
  if (error) throw error;
  return data as Bill;
}

export async function updateBill(id: string, input: NewBill): Promise<Bill> {
  const { data, error } = await supabase.from('bills').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data as Bill;
}

export async function deleteBill(id: string): Promise<void> {
  const { error } = await supabase.from('bills').delete().eq('id', id);
  if (error) throw error;
}

export interface NewPayment {
  bill_id: string;
  amount: number;
  payment_method: string | null;
}

/**
 * Record a payment and reconcile the parent bill's amount_paid + status in a
 * single atomic transaction via the `record_payment` Postgres function
 * (migration 0010). This replaces the previous three-round-trip client logic,
 * which could leave a payment inserted but the bill un-reconciled on failure.
 */
export async function createPayment(input: NewPayment): Promise<Payment> {
  const { data, error } = await supabase.rpc('record_payment', {
    p_bill_id: input.bill_id,
    p_amount: input.amount,
    p_payment_method: input.payment_method,
  });
  if (error) throw error;
  return data as Payment;
}

/**
 * Collection efficiency = total amount collected / total amount billed, for a set of bills.
 */
export function computeCollectionEfficiency(bills: Bill[]) {
  const totalBilled = bills.reduce((sum, b) => sum + b.total_amount, 0);
  const totalCollected = bills.reduce((sum, b) => sum + b.amount_paid, 0);
  return totalBilled > 0 ? totalCollected / totalBilled : 0;
}

/**
 * Receivables aging: bucket unpaid/partial balances by days overdue.
 */
export function computeReceivablesAging(bills: Bill[], asOf: Date = new Date()) {
  const buckets = { current: 0, days_1_30: 0, days_31_60: 0, days_61_90: 0, over_90: 0 };

  for (const b of bills) {
    const balance = b.total_amount - b.amount_paid;
    if (balance <= 0) continue;

    const due = new Date(b.due_date).getTime();
    const daysOverdue = Math.floor((asOf.getTime() - due) / (1000 * 60 * 60 * 24));

    if (daysOverdue <= 0) buckets.current += balance;
    else if (daysOverdue <= 30) buckets.days_1_30 += balance;
    else if (daysOverdue <= 60) buckets.days_31_60 += balance;
    else if (daysOverdue <= 90) buckets.days_61_90 += balance;
    else buckets.over_90 += balance;
  }

  return buckets;
}
