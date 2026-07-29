import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useOutages } from '../hooks/useOutages';
import { createOutage, updateOutage, deleteOutage, OutageRow } from '../services/outagesRepository';
import { supabase } from '../services/supabaseClient';

interface BranchOption {
  id: string;
  name: string;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

export default function OutagesPage() {
  const {
    rows,
    loading,
    error,
    refresh,
    totalOutages,
    totalMinutes,
    totalConsumersAffected,
    avgDuration,
  } = useOutages();

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const [branchId, setBranchId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [durationMinutes, setDurationMinutes] = useState('');
  const [cause, setCause] = useState('');
  const [areaAffected, setAreaAffected] = useState('');
  const [consumersAffected, setConsumersAffected] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('branches')
      .select('id, name')
      .then(({ data }) => setBranches(data ?? []));
  }, []);

  function resetForm() {
    setBranchId('');
    setDurationMinutes('');
    setCause('');
    setAreaAffected('');
    setConsumersAffected('');
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(row: OutageRow) {
    setEditingId(row.id);
    setBranchId(row.branch_id);
    setDate(row.date);
    setDurationMinutes(String(row.duration_minutes));
    setCause(row.cause ?? '');
    setAreaAffected(row.area_affected ?? '');
    setConsumersAffected(String(row.consumers_affected));
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const entry = {
        branch_id: branchId,
        date,
        duration_minutes: Number(durationMinutes) || 0,
        cause,
        area_affected: areaAffected,
        consumers_affected: Number(consumersAffected) || 0,
      };
      if (editingId) {
        await updateOutage(editingId, entry);
      } else {
        await createOutage(entry);
      }
      resetForm();
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save outage');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteOutage(id);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete outage');
    } finally {
      setConfirmingId(null);
    }
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F1214] text-[#E8E6E1] flex items-center justify-center">
        <p className="font-mono text-sm tracking-wide text-[#8A8F94]">Loading outages…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0F1214] text-[#E8E6E1] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="font-mono text-sm text-[#D9705C] mb-4">Couldn't load outages: {error}</p>
          <button
            onClick={refresh}
            className="border border-[#3A3F44] px-4 py-2 text-sm hover:bg-[#1A1D20] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1214] text-[#E8E6E1]">
      <div className="max-w-4xl mx-auto px-6 py-14">
        <header className="mb-10 border-b border-[#2A2E32] pb-6 flex justify-between items-start">
          <div>
            <Link
              href="/"
              className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] hover:text-[#E8E6E1] inline-block mb-4"
            >
              ← Dashboard
            </Link>
            <p className="font-mono text-xs tracking-[0.2em] text-[#8A8F94] uppercase mb-2">
              Cooperative Report
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Outages</h1>
          </div>
          <button
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
            className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] hover:text-[#E8E6E1] border border-[#2A2E32] rounded px-3 py-1.5"
          >
            {showForm ? 'Cancel' : '+ Log Outage'}
          </button>
        </header>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          <div className="border border-[#2A2E32] rounded-lg p-4">
            <p className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] mb-1">
              Total Outages
            </p>
            <p className="font-mono text-2xl tabular-nums">{totalOutages}</p>
          </div>
          <div className="border border-[#2A2E32] rounded-lg p-4">
            <p className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] mb-1">
              Total Downtime
            </p>
            <p className="font-mono text-2xl tabular-nums">{formatDuration(totalMinutes)}</p>
          </div>
          <div className="border border-[#2A2E32] rounded-lg p-4">
            <p className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] mb-1">
              Avg. Duration
            </p>
            <p className="font-mono text-2xl tabular-nums">{formatDuration(avgDuration)}</p>
          </div>
        </div>

        {/* Add outage form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-10 border border-[#2A2E32] rounded-lg p-5 space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] block mb-1">
                  Branch
                </label>
                <select
                  required
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full bg-[#1A1D20] border border-[#2A2E32] rounded px-3 py-2 text-sm"
                >
                  <option value="">Select branch…</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] block mb-1">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-[#1A1D20] border border-[#2A2E32] rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] block mb-1">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="w-full bg-[#1A1D20] border border-[#2A2E32] rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] block mb-1">
                  Consumers Affected
                </label>
                <input
                  type="number"
                  min={0}
                  value={consumersAffected}
                  onChange={(e) => setConsumersAffected(e.target.value)}
                  className="w-full bg-[#1A1D20] border border-[#2A2E32] rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] block mb-1">
                  Cause
                </label>
                <input
                  type="text"
                  value={cause}
                  onChange={(e) => setCause(e.target.value)}
                  placeholder="e.g. Line maintenance"
                  className="w-full bg-[#1A1D20] border border-[#2A2E32] rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] block mb-1">
                  Area Affected
                </label>
                <input
                  type="text"
                  value={areaAffected}
                  onChange={(e) => setAreaAffected(e.target.value)}
                  placeholder="e.g. Sitio 3"
                  className="w-full bg-[#1A1D20] border border-[#2A2E32] rounded px-3 py-2 text-sm"
                />
              </div>
            </div>

            {formError && <p className="font-mono text-xs text-[#D9705C]">{formError}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="bg-[#E8E6E1] text-[#0F1214] font-medium text-sm px-4 py-2 rounded hover:bg-white transition-colors disabled:opacity-50"
            >
              {submitting ? 'Logging…' : 'Log Outage'}
            </button>
          </form>
        )}

        {/* History table */}
        {rows.length === 0 ? (
          <p className="font-mono text-sm text-[#8A8F94]">No outages logged yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2A2E32] font-mono text-xs uppercase tracking-wide text-[#8A8F94]">
                <th className="text-left py-2 font-normal">Date</th>
                <th className="text-left py-2 font-normal">Branch</th>
                <th className="text-left py-2 font-normal">Area</th>
                <th className="text-left py-2 font-normal">Cause</th>
                <th className="text-right py-2 font-normal">Duration</th>
                <th className="text-right py-2 font-normal">Consumers</th>
                <th className="text-right py-2 font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[#1E2225]">
                  <td className="py-2.5 font-mono text-[#6B7075]">{formatDate(r.date)}</td>
                  <td className="py-2.5">{r.branch_name}</td>
                  <td className="py-2.5">{r.area_affected || '—'}</td>
                  <td className="py-2.5 text-[#8A8F94]">{r.cause || '—'}</td>
                  <td className="py-2.5 text-right font-mono tabular-nums">
                    {formatDuration(r.duration_minutes)}
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums">
                    {r.consumers_affected.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(r)} className="font-mono text-xs text-[#8A8F94] hover:text-[#E8E6E1] mr-3">Edit</button>
                    {confirmingId === r.id ? (
                      <>
                        <button onClick={() => handleDelete(r.id)} className="font-mono text-xs text-[#D9705C] mr-2">Confirm</button>
                        <button onClick={() => setConfirmingId(null)} className="font-mono text-xs text-[#8A8F94]">Cancel</button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmingId(r.id)} className="font-mono text-xs text-[#8A8F94] hover:text-[#D9705C]">Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
