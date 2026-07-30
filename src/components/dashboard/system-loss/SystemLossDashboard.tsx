'use client';

import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useSystemLoss } from '../../../hooks/useSystemLoss';
import SystemLossForm from './SystemLossForm';

interface Props {
  branchId: string;
}

export default function SystemLossDashboard({ branchId }: Props) {
  const { data, loading, error, refetch } = useSystemLoss(branchId);
  const [formOpen, setFormOpen] = useState(false);

  if (loading) return <div>Loading system loss data...</div>;
  if (error) return <div style={{ color: 'var(--signal-bad)' }}>Error loading system loss data: {error.message}</div>;

  const rows = data ?? [];
  const latest = rows.length > 0 ? rows[rows.length - 1] : null;
  const overCap = latest ? latest.system_loss_percent > latest.cap_percent : false;
  const chartData = rows.map((r) => ({
    period: r.period_start,
    system_loss_percent: r.system_loss_percent,
    cap_percent: r.cap_percent,
  }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>System Loss</h1>
        <button onClick={() => setFormOpen(true)}>+ Add Record</button>
      </div>
      <div className="sld-divider"><span className="sld-node" /></div>

      <SystemLossForm branchId={branchId} open={formOpen} onClose={() => setFormOpen(false)} onSaved={refetch} />

      {rows.length === 0 && <div className="card">No system loss records for this branch yet.</div>}

      {latest && (
      <div className="card">
        <h3>Latest Period &middot; {latest.period_start} to {latest.period_end}</h3>
        <div className="stat-row" style={{ marginTop: 12 }}>
          <div className="stat">
            <span className="stat-label">kWh Input</span>
            <span className="stat-value data">{latest.kwh_input.toLocaleString()}</span>
          </div>
          <div className="stat">
            <span className="stat-label">kWh Billed</span>
            <span className="stat-value data">{latest.kwh_billed.toLocaleString()}</span>
          </div>
          <div className="stat">
            <span className="stat-label">System Loss</span>
            <span className={`stat-value data ${overCap ? 'bad' : 'good'}`}>
              {latest.system_loss_percent.toFixed(2)}%
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">NEA Cap</span>
            <span className="stat-value data">{latest.cap_percent}%</span>
          </div>
          <div className="stat">
            <span className="stat-label">Status</span>
            <span className={`badge ${overCap ? 'bad' : 'good'}`}>{overCap ? 'Over cap' : 'Within cap'}</span>
          </div>
        </div>
      </div>
      )}

      {rows.length > 0 && (
      <div className="card" style={{ height: 300 }}>
        <h3>System Loss % Trend vs Cap</h3>
        <ResponsiveContainer width="100%" height="90%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
            <XAxis dataKey="period" stroke="var(--text-muted)" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }} />
            <YAxis stroke="var(--text-muted)" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: 'var(--panel-raised)', border: '1px solid var(--line)', fontFamily: 'var(--font-mono)' }} />
            <Legend />
            <Line type="monotone" dataKey="system_loss_percent" stroke="#E2574C" name="System Loss %" strokeWidth={2} />
            <Line type="monotone" dataKey="cap_percent" stroke="#8CA0B3" strokeDasharray="4 4" name="Cap %" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      )}
    </div>
  );
}
