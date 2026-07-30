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

export interface NewPayment {
  bill_id: string;
  amount: number;
  payment_method: string | null;
}

/**
 * Record a payment and reconcile the parent bill's amount_paid + status.
 * Two round-trips (fetch bill, insert payment, update bill) — for strict
 * atomicity move this into a Postgres function/RPC, but this is adequate for
 * single-operator branch entry.
 */
export async function createPayment(input: NewPayment): Promise<Payment> {
  const { data: bill, error: billErr } = await supabase
    .from('bills')
    .select('total_amount, amount_paid')
    .eq('id', input.bill_id)
    .single();
  if (billErr) throw billErr;

  const { data: payment, error: payErr } = await supabase
    .from('payments')
    .insert(input)
    .select()
    .single();
  if (payErr) throw payErr;

  const newPaid = Number(bill.amount_paid) + input.amount;
  const total = Number(bill.total_amount);
  const status: Bill['status'] = newPaid >= total ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';

  const { error: updErr } = await supabase
    .from('bills')
    .update({ amount_paid: newPaid, status })
    .eq('id', input.bill_id);
  if (updErr) throw updErr;

  return payment as Payment;
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
