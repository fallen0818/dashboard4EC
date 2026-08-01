'use client';

import { useState, useEffect, FormEvent } from 'react';
import FormModal from '../../ui/FormModal';
import { Field, SelectField } from '../../ui/fields';
import { createSupplier, updateSupplier } from '../../../services/powerSupplyService';
import type { PowerSupplier, SupplierType } from '../../../models/powerSupply.types';

interface Props {
  branchId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: PowerSupplier | null;
}

const TYPE_OPTIONS: { value: SupplierType; label: string }[] = [
  { value: 'bilateral', label: 'Bilateral / PSA (IPP)' },
  { value: 'wesm', label: 'WESM (spot market)' },
  { value: 'net_metering', label: 'Net Metering (member exports)' },
];

export default function SupplierForm({ branchId, open, onClose, onSaved, editing }: Props) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [supplierType, setSupplierType] = useState<SupplierType>('bilateral');
  const [active, setActive] = useState('true');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCode(editing.code);
      setName(editing.name);
      setSupplierType(editing.supplier_type);
      setActive(editing.active ? 'true' : 'false');
    } else {
      setCode(''); setName(''); setSupplierType('bilateral'); setActive('true');
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
        code: code.trim().toUpperCase(),
        name: name.trim(),
        supplier_type: supplierType,
        active: active === 'true',
      };
      if (editing) await updateSupplier(editing.id, payload);
      else await createSupplier(payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save supplier');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormModal
      title={editing ? 'Edit Supplier' : 'Add Supplier'}
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
      submitLabel={editing ? 'Update supplier' : 'Save supplier'}
    >
      <Field label="Code" name="code" value={code} onChange={setCode} required placeholder="e.g. TLI, WESM" />
      <Field label="Name" name="name" value={name} onChange={setName} required placeholder="e.g. Therma Luzon Inc. (PSA)" />
      <SelectField
        label="Supplier Type"
        name="supplier_type"
        value={supplierType}
        onChange={(v) => setSupplierType(v as SupplierType)}
        required
      >
        {TYPE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </SelectField>
      <SelectField label="Status" name="active" value={active} onChange={setActive}>
        <option value="true">Active</option>
        <option value="false">Inactive</option>
      </SelectField>
    </FormModal>
  );
}
