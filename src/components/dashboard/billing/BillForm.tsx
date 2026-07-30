'use client';

import { useState, useEffect, FormEvent } from 'react';
import FormModal from '../../ui/FormModal';
import { Field, SelectField } from '../../ui/fields';
import { createBill, getMembersForBranch } from '../../../services/billingService';
import type { Member } from '../../../models/billing.types';

interface Props {
  branchId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function BillForm({ branchId, open, onClose, onSaved }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [memberId, setMemberId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [status, setStatus] = useState('unpaid');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    getMembersForBranch(branchId).then(setMembers).catch(() => setMembers([]));
  }, [open, branchId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createBill({
        member_id: memberId,
        billing_period_start: periodStart,
        billing_period_end: periodEnd,
        due_date: dueDate,
        total_amount: Number(totalAmount),
        amount_paid: 0,
        status: status as 'unpaid' | 'partial' | 'paid' | 'overdue',
      });
      setMemberId(''); setPeriodStart(''); setPeriodEnd(''); setDueDate('');
      setTotalAmount(''); setStatus('unpaid');
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save bill');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormModal
      title="Generate Bill"
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
      submitLabel="Save bill"
    >
      <SelectField label="Member" name="member_id" value={memberId} onChange={setMemberId} required>
        <option value="" disabled>Select a member…</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>{m.account_number} · {m.full_name}</option>
        ))}
      </SelectField>
      <Field label="Period Start" name="billing_period_start" type="date" value={periodStart} onChange={setPeriodStart} required />
      <Field label="Period End" name="billing_period_end" type="date" value={periodEnd} onChange={setPeriodEnd} required />
      <Field label="Due Date" name="due_date" type="date" value={dueDate} onChange={setDueDate} required />
      <Field label="Total Amount (₱)" name="total_amount" type="number" step="0.01" min="0" value={totalAmount} onChange={setTotalAmount} required />
      <SelectField label="Status" name="status" value={status} onChange={setStatus} required>
        <option value="unpaid">Unpaid</option>
        <option value="partial">Partial</option>
        <option value="paid">Paid</option>
        <option value="overdue">Overdue</option>
      </SelectField>
    </FormModal>
  );
}
