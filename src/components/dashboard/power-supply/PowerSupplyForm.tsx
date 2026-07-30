'use client';

import { useState, useEffect, FormEvent } from 'react';
import FormModal from '../../ui/FormModal';
import { Field, SelectField } from '../../ui/fields';
import { createPowerSupplyRecord, getWesmPricesForBranch } from '../../../services/powerSupplyService';
import type { WesmPrice } from '../../../models/powerSupply.types';

interface Props {
  branchId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function PowerSupplyForm({ branchId, open, onClose, onSaved }: Props) {
  const [prices, setPrices] = useState<WesmPrice[]>([]);
  const [wesmPriceId, setWesmPriceId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [kwhPurchased, setKwhPurchased] = useState('');
  const [kwhSold, setKwhSold] = useState('');
  const [purchasedCost, setPurchasedCost] = useState('');
  const [genCharge, setGenCharge] = useState('');
  const [transCharge, setTransCharge] = useState('');
  const [lossCharge, setLossCharge] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    getWesmPricesForBranch(branchId).then(setPrices).catch(() => setPrices([]));
  }, [open, branchId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createPowerSupplyRecord({
        branch_id: branchId,
        wesm_price_id: wesmPriceId || null,
        period_start: periodStart,
        period_end: periodEnd,
        kwh_purchased: Number(kwhPurchased),
        kwh_sold: Number(kwhSold),
        purchased_power_cost: Number(purchasedCost),
        generation_charge: genCharge ? Number(genCharge) : null,
        transmission_charge: transCharge ? Number(transCharge) : null,
        system_loss_charge: lossCharge ? Number(lossCharge) : null,
      });
      setWesmPriceId(''); setPeriodStart(''); setPeriodEnd('');
      setKwhPurchased(''); setKwhSold(''); setPurchasedCost('');
      setGenCharge(''); setTransCharge(''); setLossCharge('');
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
      title="Add Power Supply Record"
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
      submitLabel="Save record"
    >
      <Field label="Period Start" name="period_start" type="date" value={periodStart} onChange={setPeriodStart} required />
      <Field label="Period End" name="period_end" type="date" value={periodEnd} onChange={setPeriodEnd} required />
      <SelectField label="WESM Price (optional)" name="wesm_price_id" value={wesmPriceId} onChange={setWesmPriceId}>
        <option value="">— None —</option>
        {prices.map((p) => (
          <option key={p.id} value={p.id}>
            {p.period_start} → {p.period_end} · ₱{p.price_per_kwh}/kWh
          </option>
        ))}
      </SelectField>
      <Field label="kWh Purchased" name="kwh_purchased" type="number" step="0.01" min="0" value={kwhPurchased} onChange={setKwhPurchased} required />
      <Field label="kWh Sold" name="kwh_sold" type="number" step="0.01" min="0" value={kwhSold} onChange={setKwhSold} required />
      <Field label="Purchased Power Cost (₱)" name="purchased_power_cost" type="number" step="0.01" min="0" value={purchasedCost} onChange={setPurchasedCost} required />
      <Field label="Generation Charge (₱)" name="generation_charge" type="number" step="0.01" min="0" value={genCharge} onChange={setGenCharge} placeholder="Optional" />
      <Field label="Transmission Charge (₱)" name="transmission_charge" type="number" step="0.01" min="0" value={transCharge} onChange={setTransCharge} placeholder="Optional" />
      <Field label="System Loss Charge (₱)" name="system_loss_charge" type="number" step="0.01" min="0" value={lossCharge} onChange={setLossCharge} placeholder="Optional" />
    </FormModal>
  );
}
