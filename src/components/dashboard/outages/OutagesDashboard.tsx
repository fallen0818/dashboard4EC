'use client';

import { useState } from 'react';
import { useOutages } from '../../../hooks/useOutages';
import { computeOutageDurationMinutes, deleteOutage } from '../../../services/outageService';
import OutageForm from './OutageForm';
import FilterBar, { FilterSelect } from '../../ui/FilterBar';
import RowActions from '../../ui/RowActions';
import { useDateRange } from '../../../hooks/useDateRange';
import { inRange } from '../../../utils/dateRange';
import type { OutageRecord } from '../../../models/outage.types';

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
  const [editing, setEditing] = useState<OutageRecord | null>(null);
  const { preset, setPreset, custom, setCustom, range } = useDateRange('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  if (loading) return <div>Loading outage records...</div>;
  if (error) return <div style={{ color: 'var(--signal-bad)' }}>Error loading outage records: {error.message}</div>;

  // Restored = the interruption ended or a restoration was recorded.
  const isRestored = (o: OutageRecord) => !!(o.restored_at || o.end_time);

  const all = data ?? [];
  const rows = all.filter((o) => {
    if (!inRange(o.start_time, range)) return false;
    if (typeFilter !== 'all' && o.outage_type !== typeFilter) return false;
    if (statusFilter === 'ongoing' && isRestored(o)) return false;
    if (statusFilter === 'resolved' && !isRestored(o)) return false;
    return true;
  });
  const totalAffected = rows.reduce((sum, o) => sum + o.affected_consumers, 0);
  const restoredCount = rows.filter(isRestored).length;
  const unresolvedCount = rows.length - restoredCount;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>Outages / Service Interruptions</h1>
        <button onClick={() => { setEditing(null); setFormOpen(true); }}>+ Log Outage</button>
      </div>
      <div className="sld-divider"><span className="sld-node" /></div>

      <OutageForm
        branchId={branchId}
        open={formOpen}
        editing={editing}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSaved={refetch}
      />

      <FilterBar
        preset={preset}
        onPresetChange={setPreset}
        custom={custom}
        onCustomChange={setCustom}
        range={range}
        resultNote={`${rows.length} of ${all.length} shown`}
      >
        <FilterSelect
          label="Type"
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: 'all', label: 'All types' },
            { value: 'scheduled', label: 'Scheduled' },
            { value: 'unscheduled', label: 'Unscheduled' },
            { value: 'force_majeure', label: 'Force majeure' },
          ]}
        />
        <FilterSelect
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'ongoing', label: 'Ongoing' },
            { value: 'resolved', label: 'Resolved' },
          ]}
        />
      </FilterBar>

      {all.length === 0 && <div className="card">No outage records for this branch yet.</div>}
      {all.length > 0 && rows.length === 0 && <div className="card">No outages match the current filters.</div>}

      {rows.length > 0 && (<>
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
            <span className="stat-label">Restored</span>
            <span className="stat-value data good">{restoredCount}</span>
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
              <th>Status</th>
              <th>Restoration Report</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const durationMin = computeOutageDurationMinutes(o);
              const restored = isRestored(o);
              return (
                <tr key={o.id}>
                  <td>{o.feeder_name}</td>
                  <td><span className={`badge ${TYPE_BADGE[o.outage_type] ?? 'warn'}`}>{o.outage_type}</span></td>
                  <td>{o.cause ?? '—'}</td>
                  <td className="data">{new Date(o.start_time).toLocaleString()}</td>
                  <td className="data">{durationMin !== null ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m` : 'Ongoing'}</td>
                  <td className="data">{o.affected_consumers.toLocaleString()}</td>
                  <td><span className={`badge ${restored ? 'good' : 'warn'}`}>{restored ? 'Restored' : 'Ongoing'}</span></td>
                  <td style={{ maxWidth: 260 }}>
                    {o.restoration_report ? (
                      <>
                        <div>{o.restoration_report}</div>
                        {(o.restored_by || o.restored_at) && (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: 2 }}>
                            {o.restored_by ?? ''}
                            {o.restored_by && o.restored_at ? ' · ' : ''}
                            {o.restored_at ? new Date(o.restored_at).toLocaleDateString() : ''}
                          </div>
                        )}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <RowActions
                      onEdit={() => { setEditing(o); setFormOpen(true); }}
                      onDelete={async () => { await deleteOutage(o.id); refetch(); }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </>)}
    </div>
  );
}
