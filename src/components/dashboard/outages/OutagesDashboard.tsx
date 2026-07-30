'use client';

import { useState } from 'react';
import { useOutages } from '../../../hooks/useOutages';
import { computeOutageDurationMinutes } from '../../../services/outageService';
import OutageForm from './OutageForm';

interface Props {
  branchId: string;
}

const TYPE_BADGE: Record<string, string> = {
  scheduled: 'good',
  unscheduled: 'warn',
  force_majeure: 'bad',
};

export default function OutagesDashboard({ branchId }: Props) {
  const { data, loading, error, refetch } = useOutages(branchId);
  const [formOpen, setFormOpen] = useState(false);

  if (loading) return <div>Loading outage records...</div>;
  if (error) return <div style={{ color: 'var(--signal-bad)' }}>Error loading outage records: {error.message}</div>;

  const rows = data ?? [];
  const totalAffected = rows.reduce((sum, o) => sum + o.affected_consumers, 0);
  const unresolvedCount = rows.filter((o) => !o.end_time).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>Outages / Service Interruptions</h1>
        <button onClick={() => setFormOpen(true)}>+ Log Outage</button>
      </div>
      <div className="sld-divider"><span className="sld-node" /></div>

      <OutageForm branchId={branchId} open={formOpen} onClose={() => setFormOpen(false)} onSaved={refetch} />

      {rows.length === 0 && <div className="card">No outage records for this branch yet.</div>}

      <div className="card">
        <div className="stat-row">
          <div className="stat">
            <span className="stat-label">Total Recorded</span>
            <span className="stat-value data">{rows.length}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Consumers Affected (cumulative)</span>
            <span className="stat-value data">{totalAffected.toLocaleString()}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Ongoing / Unresolved</span>
            <span className={`stat-value data ${unresolvedCount > 0 ? 'bad' : 'good'}`}>{unresolvedCount}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Recent Outages</h3>
        <table>
          <thead>
            <tr>
              <th>Feeder</th>
              <th>Type</th>
              <th>Cause</th>
              <th>Start</th>
              <th>Duration</th>
              <th>Affected</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const durationMin = computeOutageDurationMinutes(o);
              return (
                <tr key={o.id}>
                  <td>{o.feeder_name}</td>
                  <td><span className={`badge ${TYPE_BADGE[o.outage_type] ?? 'warn'}`}>{o.outage_type}</span></td>
                  <td>{o.cause ?? '—'}</td>
                  <td className="data">{new Date(o.start_time).toLocaleString()}</td>
                  <td className="data">{durationMin !== null ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m` : 'Ongoing'}</td>
                  <td className="data">{o.affected_consumers.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
