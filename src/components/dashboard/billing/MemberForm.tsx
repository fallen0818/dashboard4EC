'use client';

import { useState, FormEvent } from 'react';
import FormModal from '../../ui/FormModal';
import { Field, SelectField } from '../../ui/fields';
import { createMember } from '../../../services/billingService';

interface Props {
  branchId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function MemberForm({ branchId, open, onClose, onSaved }: Props) {
  const [accountNumber, setAccountNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState('active');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createMember({
        branch_id: branchId,
        account_number: accountNumber,
        full_name: fullName,
        address: address || null,
        status: status as 'active' | 'disconnected' | 'closed',
      });
      setAccountNumber(''); setFullName(''); setAddress(''); setStatus('active');
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save member');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormModal
      title="Add Member"
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
      submitLabel="Save member"
    >
      <Field label="Account Number" name="account_number" value={accountNumber} onChange={setAccountNumber} required placeholder="ACC-00001" />
      <Field label="Full Name" name="full_name" value={fullName} onChange={setFullName} required />
      <Field label="Address" name="address" value={address} onChange={setAddress} placeholder="Optional" />
      <SelectField label="Status" name="status" value={status} onChange={setStatus} required>
        <option value="active">Active</option>
        <option value="disconnected">Disconnected</option>
        <option value="closed">Closed</option>
      </SelectField>
    </FormModal>
  );
}
