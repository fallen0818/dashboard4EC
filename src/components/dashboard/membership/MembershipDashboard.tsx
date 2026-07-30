'use client';

import { useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useMembership } from '../../../hooks/useMembership';
import MembershipForm from './MembershipForm';

interface Props {
  branchId: string;
}

const axisStyle = { fontFamily: 'var(--font-mono)', fontSize: 11 };
const tooltipStyle = { background: 'var(--panel-raised)', border: '1px solid var(--line)', fontFamily: 'var(--font-mono)' };

export default function MembershipDashboard({ branchId }: Props) {
  const { data, loading, error, refetch } = useMembership(branchId);
  const [formOpen, setFormOpen] = useState(false);

  if (loading) return <div>Loading membership data...</div>;
  if (error) return <div style={{ color: 'var(--signal-bad)' }}>Error loading membership data: {error.message}</div>;

  const rows = data ?? [];
  const latest = rows.length > 0 ? rows[rows.length - 1] : null;
  const totalTrend = rows.map((r) => ({ period: r.period_start, total_consumers: r.total_consumers }));
  const flowData = rows.map((r) => ({
    period: r.period_start,
    new_connections: r.new_connections,
    disconnections: r.disconnections,
    reconnections: r.reconnections,
  }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Membership</h1>
        <button onClick={() => setFormOpen(true)}>+ Add Record</button>
      </div>
      <div className="sld-divider"><span className="sld-node" /></div>

      <MembershipForm branchId={branchId} open={formOpen} onClose={() => setFormOpen(false)} onSaved={refetch} />

      {rows.length === 0 && <div className="card">No membership records for this branch yet.</div>}

      {latest && (
      <div className="card">
        <h3>Latest Period &middot; {latest.period_start} to {latest.period_end}</h3>
        <div className="stat-row" style={{ marginTop: 12 }}>
          <div className="stat">
            <span className="stat-label">Total Consumers</span>
            <span className="stat-value data">{latest.total_consumers.toLocaleString()}</span>
          </div>
          <div className="stat">
            <span className="stat-label">New Connections</span>
            <span className="stat-value data good">{latest.new_connections}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Disconnections</span>
            <span className="stat-value data bad">{latest.disconnections}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Reconnections</span>
            <span className="stat-value data">{latest.reconnections}</span>
          </div>
        </div>
      </div>
      )}

      {rows.length > 0 && (<>
      <div className="card" style={{ height: 280 }}>
        <h3>Total Consumers Trend</h3>
        <ResponsiveContainer width="100%" height="90%">
          <LineChart data={totalTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
            <XAxis dataKey="period" stroke="var(--text-muted)" style={axisStyle} />
            <YAxis domain={['auto', 'auto']} stroke="var(--text-muted)" style={axisStyle} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="total_consumers" stroke="#4CAF7D" name="Total Consumers" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card" style={{ height: 280 }}>
        <h3>New Connections / Disconnections / Reconnections</h3>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={flowData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
            <XAxis dataKey="period" stroke="var(--text-muted)" style={axisStyle} />
            <YAxis stroke="var(--text-muted)" style={axisStyle} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Bar dataKey="new_connections" fill="#4CAF7D" name="New" />
            <Bar dataKey="disconnections" fill="#E2574C" name="Disconnected" />
            <Bar dataKey="reconnections" fill="#E2B33F" name="Reconnected" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      </>)}
    </div>
  );
}
