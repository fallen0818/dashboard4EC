'use client';

import { useState, useEffect, FormEvent } from 'react';
import FormModal from '../../ui/FormModal';
import { Field } from '../../ui/fields';
import { createSystemLossRecord, updateSystemLossRecord } from '../../../services/systemLossService';
import type { SystemLossRecord } from '../../../models/systemLoss.types';

interface Props {
  branchId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: SystemLossRecord | null;
}

export default function SystemLossForm({ branchId, open, onClose, onSaved, editing }: Props) {
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [kwhInput, setKwhInput] = useState('');
  const [kwhBilled, setKwhBilled] = useState('');
  const [capPercent, setCapPercent] = useState('5.00');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setPeriodStart(editing.period_start);
      setPeriodEnd(editing.period_end);
      setKwhInput(String(editing.kwh_input));
      setKwhBilled(String(editing.kwh_billed));
      setCapPercent(String(editing.cap_percent));
    } else {
      setPeriodStart(''); setPeriodEnd(''); setKwhInput(''); setKwhBilled(''); setCapPercent('5.00');
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
        period_start: periodStart,
        period_end: periodEnd,
        kwh_input: Number(kwhInput),
        kwh_billed: Number(kwhBilled),
        cap_percent: Number(capPercent),
      };
      if (editing) await updateSystemLossRecord(editing.id, payload);
      else await createSystemLossRecord(payload);
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
      title={editing ? 'Edit System Loss Record' : 'Add System Loss Record'}
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
      submitLabel={editing ? 'Update record' : 'Save record'}
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
