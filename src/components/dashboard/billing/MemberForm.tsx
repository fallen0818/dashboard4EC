'use client';

import { useState, useEffect, FormEvent } from 'react';
import FormModal from '../../ui/FormModal';
import { Field, SelectField } from '../../ui/fields';
import { createMember, updateMember } from '../../../services/billingService';
import type { Member } from '../../../models/billing.types';

interface Props {
  branchId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: Member | null;
}

export default function MemberForm({ branchId, open, onClose, onSaved, editing }: Props) {
  const [accountNumber, setAccountNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState('active');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setAccountNumber(editing.account_number);
      setFullName(editing.full_name);
      setAddress(editing.address ?? '');
      setStatus(editing.status);
    } else {
      setAccountNumber(''); setFullName(''); setAddress(''); setStatus('active');
    }
    setError(null);
  }, [open, editing]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        branch_id: branchId,
        account_number: accountNumber,
        full_name: fullName,
        address: address || null,
        status: status as 'active' | 'disconnected' | 'closed',
      };
      if (editing) await updateMember(editing.id, payload);
      else await createMember(payload);
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
      title={editing ? 'Edit Member' : 'Add Member'}
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
      submitLabel={editing ? 'Update member' : 'Save member'}
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
