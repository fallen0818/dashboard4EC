'use client';

import { useState, useEffect } from 'react';
import { useBillingData } from '../../../hooks/useBillingData';
import {
  computeCollectionEfficiency,
  computeReceivablesAging,
  getMembersForBranch,
  deleteMember,
  deleteBill,
} from '../../../services/billingService';
import { formatCurrency, formatPercent } from '../../../lib/utils';
import MemberForm from './MemberForm';
import BillForm from './BillForm';
import PaymentForm from './PaymentForm';
import FilterBar, { FilterSelect } from '../../ui/FilterBar';
import RowActions from '../../ui/RowActions';
import { useDateRange } from '../../../hooks/useDateRange';
import { inRange } from '../../../utils/dateRange';
import type { Member, BillWithMember } from '../../../models/billing.types';

interface Props {
  branchId: string;
}

const STATUS_BADGE: Record<string, string> = {
  paid: 'good',
  unpaid: 'warn',
  partial: 'warn',
  overdue: 'bad',
};

const MEMBER_BADGE: Record<string, string> = {
  active: 'good',
  disconnected: 'warn',
  closed: 'bad',
};

export default function BillingDashboard({ branchId }: Props) {
  const { data, loading, error, refetch } = useBillingData(branchId);

  const [memberOpen, setMemberOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editingBill, setEditingBill] = useState<BillWithMember | null>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [membersReload, setMembersReload] = useState(0);
  useEffect(() => {
    getMembersForBranch(branchId).then(setMembers).catch(() => setMembers([]));
  }, [branchId, membersReload]);
  const reloadMembers = () => setMembersReload((x) => x + 1);

  const { preset, setPreset, custom, setCustom, range } = useDateRange('all');
  const [statusFilter, setStatusFilter] = useState('all');

  if (loading) return <div>Loading billing data...</div>;
  if (error) return <div style={{ color: 'var(--signal-bad)' }}>Error loading billing data: {error.message}</div>;

  const all = data ?? [];
  const rows = all.filter((b) => {
    if (!inRange(b.billing_period_start, range)) return false;
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    return true;
  });
  const efficiency = computeCollectionEfficiency(rows);
  const aging = computeReceivablesAging(rows);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>Billing &amp; Collections</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="secondary" onClick={() => { setEditingMember(null); setMemberOpen(true); }}>+ Member</button>
          <button className="secondary" onClick={() => { setEditingBill(null); setBillOpen(true); }}>+ Bill</button>
          <button onClick={() => setPaymentOpen(true)}>+ Payment</button>
        </div>
      </div>
      <div className="sld-divider"><span className="sld-node" /></div>

      <MemberForm
        branchId={branchId}
        open={memberOpen}
        editing={editingMember}
        onClose={() => { setMemberOpen(false); setEditingMember(null); }}
        onSaved={() => { reloadMembers(); refetch(); }}
      />
      <BillForm
        branchId={branchId}
        open={billOpen}
        editing={editingBill}
        onClose={() => { setBillOpen(false); setEditingBill(null); }}
        onSaved={refetch}
      />
      <PaymentForm bills={all} open={paymentOpen} onClose={() => setPaymentOpen(false)} onSaved={refetch} />

      <FilterBar
        preset={preset}
        onPresetChange={setPreset}
        custom={custom}
        onCustomChange={setCustom}
        range={range}
        resultNote={`${rows.length} of ${all.length} bills`}
      >
        <FilterSelect
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All statuses' },
            { value: 'paid', label: 'Paid' },
            { value: 'unpaid', label: 'Unpaid' },
            { value: 'partial', label: 'Partial' },
            { value: 'overdue', label: 'Overdue' },
          ]}
        />
      </FilterBar>

      {/* Members management (not affected by the bill date filter) */}
      {members.length > 0 && (
        <div className="card">
          <h3>Members</h3>
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Name</th>
                <th>Address</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="data">{m.account_number}</td>
                  <td>{m.full_name}</td>
                  <td>{m.address ?? '—'}</td>
                  <td><span className={`badge ${MEMBER_BADGE[m.status] ?? 'warn'}`}>{m.status}</span></td>
                  <td>
                    <RowActions
                      confirmLabel="Also deletes their bills"
                      onEdit={() => { setEditingMember(m); setMemberOpen(true); }}
                      onDelete={async () => { await deleteMember(m.id); reloadMembers(); refetch(); }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {all.length === 0 && <div className="card">No bills for this branch yet. Add a member and generate a bill to get started.</div>}
      {all.length > 0 && rows.length === 0 && <div className="card">No bills match the current filters.</div>}

      {rows.length > 0 && (<>
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
              <th>Actions</th>
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
                <td>
                  <RowActions
                    onEdit={() => { setEditingBill(b); setBillOpen(true); }}
                    onDelete={async () => { await deleteBill(b.id); refetch(); }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>)}
    </div>
  );
}
