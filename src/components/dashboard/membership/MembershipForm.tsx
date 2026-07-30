'use client';

import { useState, FormEvent } from 'react';
import FormModal from '../../ui/FormModal';
import { Field } from '../../ui/fields';
import { createMembershipRecord } from '../../../services/membershipService';

interface Props {
  branchId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function MembershipForm({ branchId, open, onClose, onSaved }: Props) {
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [totalConsumers, setTotalConsumers] = useState('');
  const [newConnections, setNewConnections] = useState('0');
  const [disconnections, setDisconnections] = useState('0');
  const [reconnections, setReconnections] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createMembershipRecord({
        branch_id: branchId,
        period_start: periodStart,
        period_end: periodEnd,
        total_consumers: Number(totalConsumers),
        new_connections: Number(newConnections),
        disconnections: Number(disconnections),
        reconnections: Number(reconnections),
      });
      setPeriodStart(''); setPeriodEnd(''); setTotalConsumers('');
      setNewConnections('0'); setDisconnections('0'); setReconnections('0');
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save membership record');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormModal
      title="Add Membership Record"
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
      submitLabel="Save record"
    >
      <Field label="Period Start" name="period_start" type="date" value={periodStart} onChange={setPeriodStart} required />
      <Field label="Period End" name="period_end" type="date" value={periodEnd} onChange={setPeriodEnd} required />
      <Field label="Total Consumers" name="total_consumers" type="number" min="0" value={totalConsumers} onChange={setTotalConsumers} required />
      <Field label="New Connections" name="new_connections" type="number" min="0" value={newConnections} onChange={setNewConnections} required />
      <Field label="Disconnections" name="disconnections" type="number" min="0" value={disconnections} onChange={setDisconnections} required />
      <Field label="Reconnections" name="reconnections" type="number" min="0" value={reconnections} onChange={setReconnections} required />
    </FormModal>
  );
}
