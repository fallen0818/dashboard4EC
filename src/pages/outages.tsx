import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useOutages } from '../hooks/useOutages';
import { createOutage, updateOutage, deleteOutage, OutageRow } from '../services/outagesRepository';
import CsvIO, { CsvSchema } from "../components/CsvIO";
import { supabase } from '../services/supabaseClient';

const CAUSE_COLORS = ['#FF4D6D', '#FFB84D', '#9CA3D9', '#4DA6FF', '#22F0B0'];

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
    avgDuration,
    byCause,
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
      <div className="min-h-screen bg-[#08091C] text-[#F5F0FF] flex items-center justify-center">
        <p className="font-mono text-sm tracking-wide text-[#9CA3D9]">Loading outages…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#08091C] text-[#F5F0FF] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="font-mono text-sm text-[#FF4D6D] mb-4">Couldn&apos;t load outages: {error}</p>
          <button
            onClick={refresh}
            className="border border-[#4A4F9C] px-4 py-2 text-sm hover:bg-[#171A38] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08091C] text-[#F5F0FF]">
      <div className="max-w-4xl mx-auto px-6 py-14">
        <header className="mb-10 border-b border-[#2C3168] pb-6 flex justify-between items-start">
          <div>
            <Link
              href="/"
              className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] hover:text-[#F5F0FF] inline-block mb-4"
            >
              ← Dashboard
            </Link>
            <p className="font-mono text-xs tracking-[0.2em] text-[#9CA3D9] uppercase mb-2">
              Cooperative Report
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Outages</h1>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
            className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] hover:text-[#F5F0FF] border border-[#2C3168] rounded px-3 py-1.5"
          >
            {showForm ? 'Cancel' : '+ Log Outage'}
          </button>
            <CsvIO rows={rows} schema={outagesCsvSchema()} onAfterImport={refresh} />
          </div>
        </header>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          <div className="border border-[#2C3168] rounded-lg p-4">
            <p className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] mb-1">
              Total Outages
            </p>
            <p className="font-mono text-2xl tabular-nums">{totalOutages}</p>
          </div>
          <div className="border border-[#2C3168] rounded-lg p-4">
            <p className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] mb-1">
              Total Downtime
            </p>
            <p className="font-mono text-2xl tabular-nums">{formatDuration(totalMinutes)}</p>
          </div>
          <div className="border border-[#2C3168] rounded-lg p-4">
            <p className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] mb-1">
              Avg. Duration
            </p>
            <p className="font-mono text-2xl tabular-nums">{formatDuration(avgDuration)}</p>
          </div>
        </div>

        {/* Cause breakdown chart */}
        {byCause.length > 0 && (
          <div className="border border-[#2C3168] rounded-lg p-6 mb-10">
            <p className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] mb-4">
              Outages by Cause
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byCause} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2C3168" horizontal={false} />
                <XAxis type="number" stroke="#9CA3D9" fontSize={12} fontFamily="monospace" allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="cause"
                  stroke="#9CA3D9"
                  fontSize={12}
                  fontFamily="monospace"
                  width={140}
                />
                <Tooltip
                  contentStyle={{
                    background: '#171A38',
                    border: '1px solid #2C3168',
                    borderRadius: 6,
                    fontFamily: 'monospace',
                    fontSize: 12,
                  }}
                  formatter={(value: unknown, _name: unknown, item: { payload?: { minutes?: number } }) => [
                    `${Number(value)} outage${Number(value) === 1 ? '' : 's'} · ${item.payload?.minutes ?? 0}m total`,
                    'Count',
                  ]}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {byCause.map((_, i) => (
                    <Cell key={i} fill={CAUSE_COLORS[i % CAUSE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Add outage form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-10 border border-[#2C3168] rounded-lg p-5 space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] block mb-1">
                  Branch
                </label>
                <select
                  required
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full bg-[#171A38] border border-[#2C3168] rounded px-3 py-2 text-sm"
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
                <label className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] block mb-1">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-[#171A38] border border-[#2C3168] rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] block mb-1">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="w-full bg-[#171A38] border border-[#2C3168] rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] block mb-1">
                  Consumers Affected
                </label>
                <input
                  type="number"
                  min={0}
                  value={consumersAffected}
                  onChange={(e) => setConsumersAffected(e.target.value)}
                  className="w-full bg-[#171A38] border border-[#2C3168] rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] block mb-1">
                  Cause
                </label>
                <input
                  type="text"
                  value={cause}
                  onChange={(e) => setCause(e.target.value)}
                  placeholder="e.g. Line maintenance"
                  className="w-full bg-[#171A38] border border-[#2C3168] rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] block mb-1">
                  Area Affected
                </label>
                <input
                  type="text"
                  value={areaAffected}
                  onChange={(e) => setAreaAffected(e.target.value)}
                  placeholder="e.g. Sitio 3"
                  className="w-full bg-[#171A38] border border-[#2C3168] rounded px-3 py-2 text-sm"
                />
              </div>
            </div>

            {formError && <p className="font-mono text-xs text-[#FF4D6D]">{formError}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="bg-[#F5F0FF] text-[#08091C] font-medium text-sm px-4 py-2 rounded hover:bg-white transition-colors disabled:opacity-50"
            >
              {submitting ? 'Logging…' : 'Log Outage'}
            </button>
          </form>
        )}

        {/* History table */}
        {rows.length === 0 ? (
          <p className="font-mono text-sm text-[#9CA3D9]">No outages logged yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2C3168] font-mono text-xs uppercase tracking-wide text-[#9CA3D9]">
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
                <tr key={r.id} className="border-b border-[#1F2450]">
                  <td className="py-2.5 font-mono text-[#6C74A8]">{formatDate(r.date)}</td>
                  <td className="py-2.5">{r.branch_name}</td>
                  <td className="py-2.5">{r.area_affected || '—'}</td>
                  <td className="py-2.5 text-[#9CA3D9]">{r.cause || '—'}</td>
                  <td className="py-2.5 text-right font-mono tabular-nums">
                    {formatDuration(r.duration_minutes)}
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums">
                    {r.consumers_affected.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(r)} className="font-mono text-xs text-[#9CA3D9] hover:text-[#F5F0FF] mr-3">Edit</button>
                    {confirmingId === r.id ? (
                      <>
                        <button onClick={() => handleDelete(r.id)} className="font-mono text-xs text-[#FF4D6D] mr-2">Confirm</button>
                        <button onClick={() => setConfirmingId(null)} className="font-mono text-xs text-[#9CA3D9]">Cancel</button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmingId(r.id)} className="font-mono text-xs text-[#9CA3D9] hover:text-[#FF4D6D]">Delete</button>
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

// ==================================================================
//  CSV schema — outages
// ==================================================================
type OutageNew = { branch_id: string; date: string; duration_minutes: number; cause: string; area_affected: string; consumers_affected: number };

function outagesCsvSchema(): CsvSchema<OutageRow, OutageNew> {
  return {
    filename: "outages.csv",
    headers: ["branch_id", "date", "branch_name", "duration_minutes", "cause", "area_affected", "consumers_affected"],
    serialize: (r) => [r.branch_id, r.date, r.branch_name, r.duration_minutes, r.cause ?? "", r.area_affected ?? "", r.consumers_affected],
    templateRow: {
      branch_id: "<uuid from branches>",
      date: "2026-07-15",
      branch_name: "(export-only)",
      duration_minutes: "120",
      cause: "Typhoon",
      area_affected: "Feeder 3",
      consumers_affected: "1500",
    },
    parseRow: (rec) => {
      const branch_id = (rec.branch_id || "").trim();
      const date = (rec.date || "").trim();
      if (!branch_id) throw new Error("branch_id is required");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("date must be YYYY-MM-DD");
      const duration_minutes = Number(String(rec.duration_minutes || "0").replace(/,/g, ""));
      const consumers_affected = Number(String(rec.consumers_affected || "0").replace(/,/g, ""));
      if (!isFinite(duration_minutes) || duration_minutes < 0) throw new Error("duration_minutes must be a non-negative number");
      if (!isFinite(consumers_affected) || consumers_affected < 0) throw new Error("consumers_affected must be a non-negative integer");
      return {
        branch_id,
        date,
        duration_minutes: Math.round(duration_minutes),
        cause: (rec.cause || "").trim(),
        area_affected: (rec.area_affected || "").trim(),
        consumers_affected: Math.round(consumers_affected),
      };
    },
    onImport: async (payload) => { await createOutage(payload); },
  };
}
