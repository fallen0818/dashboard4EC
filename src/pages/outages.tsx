import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useOutages } from '../hooks/useOutages';
import { useRole } from "../hooks/useRole";
import { createOutage, updateOutage, deleteOutage, OutageRow, isoToLocalInput } from '../services/outagesRepository';
import CsvIO, { CsvSchema } from "../components/CsvIO";
import { parseFlexibleDate } from "../lib/dates";
import { supabase } from '../services/supabaseClient';

const CAUSE_COLORS = ['#FF4D6D', '#FFB84D', '#9CA3D9', '#4DA6FF', '#22F0B0'];

interface BranchOption {
  id: string;
  name: string;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function _formatDate(dateStr: string): string {
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
  const { canWrite, canDelete } = useRole();

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const [branchId, setBranchId] = useState('');
  const [wentOff, setWentOff] = useState(isoToLocalInput(new Date().toISOString()));
  const [restored, setRestored] = useState(isoToLocalInput(new Date().toISOString()));
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
    setRestored(isoToLocalInput(new Date().toISOString()));
    setCause('');
    setAreaAffected('');
    setConsumersAffected('');
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(row: OutageRow) {
    setEditingId(row.id);
    setBranchId(row.branch_id);
    setWentOff(isoToLocalInput(row.went_off));
    setRestored(isoToLocalInput(row.restored));
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
        went_off: new Date(wentOff).toISOString(),
        restored: new Date(restored).toISOString(),
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
            {(canWrite || showForm) && (
            <button
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
            className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] hover:text-[#F5F0FF] border border-[#2C3168] rounded px-3 py-1.5"
          >
            {showForm ? 'Cancel' : '+ Log Outage'}
          </button>
          )}
            <CsvIO rows={rows} schema={outagesCsvSchema()} onAfterImport={refresh} canImport={canWrite} />
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
                  Time Went-Off
                </label>
                <input
                  type="datetime-local"
                  required
                  value={wentOff}
                  onChange={(e) => setWentOff(e.target.value)}
                  className="w-full bg-[#171A38] border border-[#2C3168] rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] block mb-1">
                  Time Restored
                </label>
                <input
                  type="datetime-local"
                  required
                  value={restored}
                  onChange={(e) => setRestored(e.target.value)}
                  className="w-full bg-[#171A38] border border-[#2C3168] rounded px-3 py-2 text-sm"
                />
              </div>
              <div className="col-span-2">
                <p className="font-mono text-xs text-[#6C74A8]">
                  Duration (derived): {(() => {
                    const s = Date.parse(wentOff);
                    const e = Date.parse(restored);
                    if (!isFinite(s) || !isFinite(e) || e < s) return "—";
                    const mins = Math.round((e - s) / 60000);
                    return formatDuration(mins);
                  })()}
                </p>
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
          <div className="border border-dashed border-[#2C3168] rounded-lg py-10 text-center bg-[#0F1230]">
            <p className="font-mono text-sm text-[#9CA3D9]">No outages logged yet.</p>
          </div>
        ) : (
          <div className="border border-[#2C3168] rounded-lg bg-[#0F1230] overflow-x-auto">
          <table className="w-full text-sm table-auto">
            <thead>
              <tr className="border-b border-[#2C3168] bg-[#0B0D22] font-mono text-[11px] uppercase tracking-[0.15em] text-[#9CA3D9]">
                <th className="text-left  px-3 py-3 font-normal">Went-Off</th>
                <th className="text-left  px-3 py-3 font-normal">Restored</th>
                <th className="text-right px-3 py-3 font-normal">Duration</th>
                <th className="text-left  px-3 py-3 font-normal">Branch</th>
                <th className="text-left  px-3 py-3 font-normal">Area</th>
                <th className="text-left  px-3 py-3 font-normal">Cause</th>
                <th className="text-right px-3 py-3 font-normal">Consumers</th>
                <th className="text-right px-3 py-3 font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[#1F2450] hover:bg-[#141833] transition-colors">
                  <td className="px-3 py-2.5 font-mono text-[#F5F0FF] whitespace-nowrap">{formatDateTime(r.went_off)}</td>
                  <td className="px-3 py-2.5 font-mono text-[#F5F0FF] whitespace-nowrap">{formatDateTime(r.restored)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                    {formatDuration(r.duration_minutes)}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{r.branch_name}</td>
                  <td className="px-3 py-2.5 text-[#9CA3D9]">{r.area_affected || '—'}</td>
                  <td className="px-3 py-2.5 text-[#9CA3D9]">{r.cause || '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                    {r.consumers_affected.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap w-32">
                    {canWrite && <button onClick={() => startEdit(r)} className="font-mono text-xs text-[#9CA3D9] hover:text-[#F5F0FF] mr-3">Edit</button>}
                    {canDelete && (confirmingId === r.id ? (
                      <>
                        <button onClick={() => handleDelete(r.id)} className="font-mono text-xs text-[#FF4D6D] mr-2">Confirm</button>
                        <button onClick={() => setConfirmingId(null)} className="font-mono text-xs text-[#9CA3D9]">Cancel</button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmingId(r.id)} className="font-mono text-xs text-[#9CA3D9] hover:text-[#FF4D6D]">Delete</button>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================================================================
//  CSV schema — outages
// ==================================================================
type OutageNew = { branch_id: string; went_off: string; restored: string; cause: string; area_affected: string; consumers_affected: number };

function outagesCsvSchema(): CsvSchema<OutageRow, OutageNew> {
  return {
    filename: "outages.csv",
    headers: ["branch_id", "branch_name", "went_off", "restored", "duration_minutes", "cause", "area_affected", "consumers_affected"],
    serialize: (r) => [r.branch_id, r.branch_name, r.went_off, r.restored ?? "", r.duration_minutes, r.cause ?? "", r.area_affected ?? "", r.consumers_affected],
    templateRow: {
      branch_id: "<uuid from branches>",
      branch_name: "(export-only)",
      went_off: "2026-07-15T14:30",
      restored: "2026-07-15T16:30",
      duration_minutes: "(derived; leave blank)",
      cause: "Typhoon",
      area_affected: "Feeder 3",
      consumers_affected: "1500",
    },
    parseRow: (rec) => {
      const branch_id = (rec.branch_id || "").trim();
      // Accept `went_off`/`restored` (preferred), fall back to legacy `date`+`duration_minutes`.
      let wentOff = String(rec.went_off ?? "").trim();
      let restored = String(rec.restored ?? "").trim();
      if (!wentOff) {
        // Legacy path: derive from date + duration_minutes.
        const legacyDate = parseFlexibleDate(rec.date, "went_off/date");
        wentOff = `${legacyDate}T00:00:00`;
        const dm = Number(String(rec.duration_minutes || "0").replace(/,/g, ""));
        if (!isFinite(dm) || dm < 0) throw new Error("duration_minutes must be a non-negative number");
        restored = new Date(Date.parse(wentOff) + dm * 60000).toISOString();
      }
      const wentMs = Date.parse(wentOff);
      const resMs = Date.parse(restored);
      if (!isFinite(wentMs)) throw new Error(`went_off "${rec.went_off ?? ""}" is not a valid date/time`);
      if (!isFinite(resMs))  throw new Error(`restored "${rec.restored ?? ""}" is not a valid date/time`);
      if (resMs < wentMs)    throw new Error("restored is earlier than went_off");
      if (!branch_id) throw new Error("branch_id is required");
      const consumers_affected = Number(String(rec.consumers_affected || "0").replace(/,/g, ""));
      if (!isFinite(consumers_affected) || consumers_affected < 0) throw new Error("consumers_affected must be a non-negative integer");
      return {
        branch_id,
        went_off: new Date(wentMs).toISOString(),
        restored: new Date(resMs).toISOString(),
        cause: (rec.cause || "").trim(),
        area_affected: (rec.area_affected || "").trim(),
        consumers_affected: Math.round(consumers_affected),
      };
    },
    onImport: async (payload) => { await createOutage(payload); },
  };
}
