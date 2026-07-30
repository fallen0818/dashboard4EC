'use client';

import { useState, FormEvent } from 'react';
import FormModal from '../../ui/FormModal';
import { Field } from '../../ui/fields';
import { createSystemLossRecord } from '../../../services/systemLossService';

interface Props {
  branchId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function SystemLossForm({ branchId, open, onClose, onSaved }: Props) {
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [kwhInput, setKwhInput] = useState('');
  const [kwhBilled, setKwhBilled] = useState('');
  const [capPercent, setCapPercent] = useState('5.00');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createSystemLossRecord({
        branch_id: branchId,
        period_start: periodStart,
        period_end: periodEnd,
        kwh_input: Number(kwhInput),
        kwh_billed: Number(kwhBilled),
        cap_percent: Number(capPercent),
      });
      setPeriodStart(''); setPeriodEnd(''); setKwhInput(''); setKwhBilled(''); setCapPercent('5.00');
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save system loss record');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormModal
      title="Add System Loss Record"
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
      submitLabel="Save record"
    >
      <Field label="Period Start" name="period_start" type="date" value={periodStart} onChange={setPeriodStart} required />
      <Field label="Period End" name="period_end" type="date" value={periodEnd} onChange={setPeriodEnd} required />
      <Field label="kWh Input" name="kwh_input" type="number" step="0.01" min="0" value={kwhInput} onChange={setKwhInput} required />
      <Field label="kWh Billed" name="kwh_billed" type="number" step="0.01" min="0" value={kwhBilled} onChange={setKwhBilled} required />
      <Field label="NEA Cap %" name="cap_percent" type="number" step="0.01" min="0" value={capPercent} onChange={setCapPercent} required />
      <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 10 }}>
        Loss kWh and loss % are computed automatically from input and billed kWh.
      </p>
    </FormModal>
  );
}
