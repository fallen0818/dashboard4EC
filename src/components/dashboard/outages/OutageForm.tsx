'use client';

import { useState, useEffect, FormEvent } from 'react';
import FormModal from '../../ui/FormModal';
import { Field, SelectField, TextAreaField } from '../../ui/fields';
import { createOutage, updateOutage } from '../../../services/outageService';
import type { OutageRecord } from '../../../models/outage.types';

interface Props {
  branchId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: OutageRecord | null;
}

export default function OutageForm({ branchId, open, onClose, onSaved, editing }: Props) {
  const [feederName, setFeederName] = useState('');
  const [outageType, setOutageType] = useState('unscheduled');
  const [cause, setCause] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [affected, setAffected] = useState('0');
  const [restorationReport, setRestorationReport] = useState('');
  const [restoredBy, setRestoredBy] = useState('');
  const [restoredAt, setRestoredAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill when opening in edit mode; reset when opening fresh.
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setFeederName(editing.feeder_name);
      setOutageType(editing.outage_type);
      setCause(editing.cause ?? '');
      setStartTime(editing.start_time ? editing.start_time.slice(0, 16) : '');
      setEndTime(editing.end_time ? editing.end_time.slice(0, 16) : '');
      setAffected(String(editing.affected_consumers));
      setRestorationReport(editing.restoration_report ?? '');
      setRestoredBy(editing.restored_by ?? '');
      setRestoredAt(editing.restored_at ? editing.restored_at.slice(0, 16) : '');
    } else {
      setFeederName(''); setOutageType('unscheduled'); setCause('');
      setStartTime(''); setEndTime(''); setAffected('0');
      setRestorationReport(''); setRestoredBy(''); setRestoredAt('');
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
        feeder_name: feederName,
        outage_type: outageType as 'scheduled' | 'unscheduled' | 'force_majeure',
        cause: cause || null,
        start_time: new Date(startTime).toISOString(),
        end_time: endTime ? new Date(endTime).toISOString() : null,
        affected_consumers: Number(affected),
        restoration_report: restorationReport.trim() || null,
        restored_by: restoredBy.trim() || null,
        restored_at: restoredAt ? new Date(restoredAt).toISOString() : null,
      };
      if (editing) await updateOutage(editing.id, payload);
      else await createOutage(payload);
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
      title={editing ? 'Edit Outage' : 'Log Outage'}
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
      submitLabel={editing ? 'Update outage' : 'Save outage'}
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

      <div className="sld-divider" style={{ marginTop: 20 }}><span className="sld-node" /></div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>
        Restoration / Accomplishment
      </p>
      <TextAreaField
        label="Restoration Report"
        name="restoration_report"
        value={restorationReport}
        onChange={setRestorationReport}
        placeholder="Action taken to restore service (leave blank if still ongoing)"
      />
      <Field label="Restored By" name="restored_by" value={restoredBy} onChange={setRestoredBy} placeholder="Crew / personnel" />
      <Field label="Restored On" name="restored_at" type="datetime-local" value={restoredAt} onChange={setRestoredAt} />
    </FormModal>
  );
}
