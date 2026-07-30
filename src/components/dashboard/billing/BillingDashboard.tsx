'use client';

import { useState } from 'react';
import { useBillingData } from '../../../hooks/useBillingData';
import { computeCollectionEfficiency, computeReceivablesAging } from '../../../services/billingService';
import { formatCurrency, formatPercent } from '../../../lib/utils';
import MemberForm from './MemberForm';
import BillForm from './BillForm';
import PaymentForm from './PaymentForm';

interface Props {
  branchId: string;
}

const STATUS_BADGE: Record<string, string> = {
  paid: 'good',
  unpaid: 'warn',
  partial: 'warn',
  overdue: 'bad',
};

export default function BillingDashboard({ branchId }: Props) {
  const { data, loading, error, refetch } = useBillingData(branchId);
  const [memberOpen, setMemberOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  if (loading) return <div>Loading billing data...</div>;
  if (error) return <div style={{ color: 'var(--signal-bad)' }}>Error loading billing data: {error.message}</div>;

  const rows = data ?? [];
  const efficiency = computeCollectionEfficiency(rows);
  const aging = computeReceivablesAging(rows);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>Billing &amp; Collections</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="secondary" onClick={() => setMemberOpen(true)}>+ Member</button>
          <button className="secondary" onClick={() => setBillOpen(true)}>+ Bill</button>
          <button onClick={() => setPaymentOpen(true)}>+ Payment</button>
        </div>
      </div>
      <div className="sld-divider"><span className="sld-node" /></div>

      <MemberForm branchId={branchId} open={memberOpen} onClose={() => setMemberOpen(false)} onSaved={refetch} />
      <BillForm branchId={branchId} open={billOpen} onClose={() => setBillOpen(false)} onSaved={refetch} />
      <PaymentForm bills={rows} open={paymentOpen} onClose={() => setPaymentOpen(false)} onSaved={refetch} />

      {rows.length === 0 && <div className="card">No bills for this branch yet. Add a member and generate a bill to get started.</div>}

      <div className="card">
        <h3>Collection Efficiency</h3>
        <div className="stat" style={{ marginTop: 8 }}>
          <span className={`stat-value data ${efficiency >= 0.9 ? 'good' : efficiency >= 0.7 ? 'warn' : 'bad'}`}>
            {formatPercent(efficiency)}
          </span>
          <span className="stat-label">of billed amount collected across {rows.length} bills</span>
        </div>
      </div>

      <div className="card">
        <h3>Receivables Aging</h3>
        <table>
          <thead>
            <tr>
              <th>Current</th>
              <th>1–30 days</th>
              <th>31–60 days</th>
              <th>61–90 days</th>
              <th>Over 90 days</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="data">{formatCurrency(aging.current)}</td>
              <td className="data">{formatCurrency(aging.days_1_30)}</td>
              <td className="data">{formatCurrency(aging.days_31_60)}</td>
              <td className="data">{formatCurrency(aging.days_61_90)}</td>
              <td className="data" style={{ color: aging.over_90 > 0 ? 'var(--signal-bad)' : undefined }}>
                {formatCurrency(aging.over_90)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Bills</h3>
        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th>Member</th>
              <th>Period</th>
              <th>Due</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td className="data">{b.members.account_number}</td>
                <td>{b.members.full_name}</td>
                <td className="data">{b.billing_period_start} – {b.billing_period_end}</td>
                <td className="data">{b.due_date}</td>
                <td className="data">{formatCurrency(b.total_amount)}</td>
                <td className="data">{formatCurrency(b.amount_paid)}</td>
                <td><span className={`badge ${STATUS_BADGE[b.status] ?? 'warn'}`}>{b.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
