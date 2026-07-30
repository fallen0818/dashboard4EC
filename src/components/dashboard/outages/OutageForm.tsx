'use client';

import { useState, FormEvent } from 'react';
import FormModal from '../../ui/FormModal';
import { Field, SelectField } from '../../ui/fields';
import { createOutage } from '../../../services/outageService';

interface Props {
  branchId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function OutageForm({ branchId, open, onClose, onSaved }: Props) {
  const [feederName, setFeederName] = useState('');
  const [outageType, setOutageType] = useState('unscheduled');
  const [cause, setCause] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [affected, setAffected] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createOutage({
        branch_id: branchId,
        feeder_name: feederName,
        outage_type: outageType as 'scheduled' | 'unscheduled' | 'force_majeure',
        cause: cause || null,
        start_time: new Date(startTime).toISOString(),
        end_time: endTime ? new Date(endTime).toISOString() : null,
        affected_consumers: Number(affected),
      });
      setFeederName(''); setCause(''); setStartTime(''); setEndTime(''); setAffected('0');
      setOutageType('unscheduled');
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save outage');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormModal
      title="Log Outage"
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
      submitLabel="Save outage"
    >
      <Field label="Feeder Name" name="feeder_name" value={feederName} onChange={setFeederName} required />
      <SelectField label="Type" name="outage_type" value={outageType} onChange={setOutageType} required>
        <option value="scheduled">Scheduled</option>
        <option value="unscheduled">Unscheduled</option>
        <option value="force_majeure">Force Majeure</option>
      </SelectField>
      <Field label="Cause" name="cause" value={cause} onChange={setCause} placeholder="Optional" />
      <Field label="Start Time" name="start_time" type="datetime-local" value={startTime} onChange={setStartTime} required />
      <Field label="End Time" name="end_time" type="datetime-local" value={endTime} onChange={setEndTime} placeholder="Leave blank if ongoing" />
      <Field label="Affected Consumers" name="affected_consumers" type="number" min="0" value={affected} onChange={setAffected} required />
    </FormModal>
  );
}
