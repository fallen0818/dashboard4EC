'use client';

import { useState, FormEvent } from 'react';
import FormModal from '../../ui/FormModal';
import { Field, SelectField } from '../../ui/fields';
import { createPayment } from '../../../services/billingService';
import type { BillWithMember } from '../../../models/billing.types';

interface Props {
  bills: BillWithMember[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function PaymentForm({ bills, open, onClose, onSaved }: Props) {
  const [billId, setBillId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only bills with an outstanding balance are worth paying against.
  const openBills = bills.filter((b) => b.total_amount - b.amount_paid > 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createPayment({
        bill_id: billId,
        amount: Number(amount),
        payment_method: method || null,
      });
      setBillId(''); setAmount(''); setMethod('cash');
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormModal
      title="Record Payment"
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
      submitLabel="Record payment"
    >
      <SelectField label="Bill" name="bill_id" value={billId} onChange={setBillId} required>
        <option value="" disabled>Select an outstanding bill…</option>
        {openBills.map((b) => (
          <option key={b.id} value={b.id}>
            {b.members.account_number} · {b.members.full_name} · balance ₱{(b.total_amount - b.amount_paid).toFixed(2)}
          </option>
        ))}
      </SelectField>
      <Field label="Amount (₱)" name="amount" type="number" step="0.01" min="0" value={amount} onChange={setAmount} required />
      <SelectField label="Method" name="payment_method" value={method} onChange={setMethod}>
        <option value="cash">Cash</option>
        <option value="bank_transfer">Bank Transfer</option>
        <option value="gcash">GCash</option>
        <option value="check">Check</option>
      </SelectField>
    </FormModal>
  );
}
