'use client';

import { useState, useEffect, FormEvent } from 'react';
import FormModal from '../../ui/FormModal';
import { Field, SelectField } from '../../ui/fields';
import {
  createPowerSupplyRecord,
  updatePowerSupplyRecord,
  getWesmPricesForBranch,
  getSuppliersForBranch,
} from '../../../services/powerSupplyService';
import type {
  WesmPrice,
  PowerSupplyRecord,
  PowerSupplier,
} from '../../../models/powerSupply.types';

interface Props {
  branchId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: PowerSupplyRecord | null;
}

export default function PowerSupplyForm({ branchId, open, onClose, onSaved, editing }: Props) {
  const [suppliers, setSuppliers] = useState<PowerSupplier[]>([]);
  const [prices, setPrices] = useState<WesmPrice[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [wesmPriceId, setWesmPriceId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [kwhPurchased, setKwhPurchased] = useState('');
  const [purchasedCost, setPurchasedCost] = useState('');
  const [genCharge, setGenCharge] = useState('');
  const [transCharge, setTransCharge] = useState('');
  const [lossCharge, setLossCharge] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    getSuppliersForBranch(branchId).then(setSuppliers).catch(() => setSuppliers([]));
    getWesmPricesForBranch(branchId).then(setPrices).catch(() => setPrices([]));
  }, [open, branchId]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setSupplierId(editing.supplier_id);
      setWesmPriceId(editing.wesm_price_id ?? '');
      setPeriodStart(editing.period_start);
      setPeriodEnd(editing.period_end);
      setKwhPurchased(String(editing.kwh_purchased));
      setPurchasedCost(String(editing.purchased_power_cost));
      setGenCharge(editing.generation_charge != null ? String(editing.generation_charge) : '');
      setTransCharge(editing.transmission_charge != null ? String(editing.transmission_charge) : '');
      setLossCharge(editing.system_loss_charge != null ? String(editing.system_loss_charge) : '');
    } else {
      setSupplierId(''); setWesmPriceId(''); setPeriodStart(''); setPeriodEnd('');
      setKwhPurchased(''); setPurchasedCost('');
      setGenCharge(''); setTransCharge(''); setLossCharge('');
    }
    setError(null);
  }, [open, editing]);

  // Whether the selected supplier is the WESM spot market — only then is the
  // WESM price reference relevant.
  const selectedSupplier = suppliers.find((s) => s.id === supplierId);
  const isWesm = selectedSupplier?.supplier_type === 'wesm';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        branch_id: branchId,
        supplier_id: supplierId,
        wesm_price_id: isWesm ? wesmPriceId || null : null,
        period_start: periodStart,
        period_end: periodEnd,
        kwh_purchased: Number(kwhPurchased),
        purchased_power_cost: Number(purchasedCost),
        generation_charge: genCharge ? Number(genCharge) : null,
        transmission_charge: transCharge ? Number(transCharge) : null,
        system_loss_charge: lossCharge ? Number(lossCharge) : null,
      };
      if (editing) await updatePowerSupplyRecord(editing.id, payload);
      else await createPowerSupplyRecord(payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save power supply record');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormModal
      title={editing ? 'Edit Power Supply Record' : 'Add Power Supply Record'}
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
      submitLabel={editing ? 'Update record' : 'Save record'}
    >
      <SelectField label="Supplier" name="supplier_id" value={supplierId} onChange={setSupplierId} required>
        <option value="" disabled>— Select supplier —</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.code} · {s.name}
          </option>
        ))}
      </SelectField>
      <Field label="Period Start" name="period_start" type="date" value={periodStart} onChange={setPeriodStart} required />
      <Field label="Period End" name="period_end" type="date" value={periodEnd} onChange={setPeriodEnd} required />
      {isWesm && (
        <SelectField label="WESM Price (optional)" name="wesm_price_id" value={wesmPriceId} onChange={setWesmPriceId}>
          <option value="">— None —</option>
          {prices.map((p) => (
            <option key={p.id} value={p.id}>
              {p.period_start} → {p.period_end} · ₱{p.price_per_kwh}/kWh
            </option>
          ))}
        </SelectField>
      )}
      <Field label="kWh Purchased" name="kwh_purchased" type="number" step="0.01" min="0" value={kwhPurchased} onChange={setKwhPurchased} required />
      <Field label="Purchased Power Cost (₱)" name="purchased_power_cost" type="number" step="0.01" min="0" value={purchasedCost} onChange={setPurchasedCost} required />
      <Field label="Generation Charge (₱)" name="generation_charge" type="number" step="0.01" min="0" value={genCharge} onChange={setGenCharge} placeholder="Optional" />
      <Field label="Transmission Charge (₱)" name="transmission_charge" type="number" step="0.01" min="0" value={transCharge} onChange={setTransCharge} placeholder="Optional" />
      <Field label="System Loss Charge (₱)" name="system_loss_charge" type="number" step="0.01" min="0" value={lossCharge} onChange={setLossCharge} placeholder="Optional" />
    </FormModal>
  );
}
