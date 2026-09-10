import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useMembership } from "../hooks/useMembership";
import {
  createMembership,
  MembershipRow,
  updateMembership,
  deleteMembership,
} from "../services/membershipRepository";
import CsvIO, { CsvSchema } from "../components/CsvIO";
import { supabase } from "../services/supabaseClient";

function formatNumber(n: number): string {
  return n.toLocaleString("en-PH");
}

function formatMonth(period?: string): string {
  if (!period) return "";
  return new Date(period).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
  });
}

const TYPE_LABELS: Record<string, string> = {
  residential: "Residential",
  commercial: "Commercial",
  industrial: "Industrial",
  government: "Government",
  other: "Other",
};

const COLORS = ["#22F0B0", "#FFB84D", "#9CA3D9", "#4DA6FF", "#FF4D6D"];

const chartTooltipStyle = {
  background: "#171A38",
  border: "1px solid #2C3168",
  borderRadius: 6,
  fontFamily: "monospace",
  fontSize: 12,
};

export default function MembershipPage() {
  const {
    rows,
    byType,
    byBranch,
    totalConsumers,
    latestPeriod,
    loading,
    error,
    refresh,
  } = useMembership();

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState("");
  const [period, setPeriod] = useState(
    new Date().toISOString().slice(0, 8) + "01",
  );
  const [connectionType, setConnectionType] = useState("residential");
  const [consumerCount, setConsumerCount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("branches")
      .select("id, name")
      .then(({ data }) => setBranches(data ?? []));
  }, []);

  function resetForm() {
    setBranchId("");
    setConsumerCount("");
    setConnectionType("residential");
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(row: (typeof rows)[number]) {
    setEditingId(row.id);
    setBranchId(row.branch_id);
    setPeriod(row.period);
    setConnectionType(row.connection_type);
    setConsumerCount(String(row.consumer_count));
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const entry = {
        branch_id: branchId,
        period,
        connection_type: connectionType,
        consumer_count: Number(consumerCount) || 0,
      };
      if (editingId) {
        await updateMembership(editingId, entry);
      } else {
        await createMembership(entry);
      }
      resetForm();
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save entry");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMembership(id);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete entry");
    } finally {
      setConfirmingId(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08091C] text-[#F5F0FF] flex items-center justify-center">
        <p className="font-mono text-sm tracking-wide text-[#9CA3D9]">
          Loading membership data…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#08091C] text-[#F5F0FF] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="font-mono text-sm text-[#FF4D6D] mb-4">
            Couldn&apos;t load membership: {error}
          </p>
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
              Cooperative Report · {formatMonth(latestPeriod)}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Membership
            </h1>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
            className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] hover:text-[#F5F0FF] border border-[#2C3168] rounded px-3 py-1.5"
          >
            {showForm ? "Cancel" : "+ Add Entry"}
          </button>
            <CsvIO rows={rows} schema={membershipCsvSchema()} onAfterImport={refresh} />
          </div>
        </header>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-8 border border-[#2C3168] rounded-lg p-5 space-y-4"
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
                  Month
                </label>
                <input
                  type="date"
                  required
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="w-full bg-[#171A38] border border-[#2C3168] rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] block mb-1">
                  Connection Type
                </label>
                <select
                  value={connectionType}
                  onChange={(e) => setConnectionType(e.target.value)}
                  className="w-full bg-[#171A38] border border-[#2C3168] rounded px-3 py-2 text-sm"
                >
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                  <option value="industrial">Industrial</option>
                  <option value="government">Government</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] block mb-1">
                  Consumer Count
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  value={consumerCount}
                  onChange={(e) => setConsumerCount(e.target.value)}
                  className="w-full bg-[#171A38] border border-[#2C3168] rounded px-3 py-2 text-sm"
                />
              </div>
            </div>
            {formError && (
              <p className="font-mono text-xs text-[#FF4D6D]">{formError}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="bg-[#F5F0FF] text-[#08091C] font-medium text-sm px-4 py-2 rounded hover:bg-white transition-colors disabled:opacity-50"
            >
              {submitting
                ? "Saving…"
                : editingId
                  ? "Update Entry"
                  : "Add Entry"}
            </button>
          </form>
        )}

        <div className="border border-[#2C3168] rounded-lg p-4 mb-8 inline-block">
          <p className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] mb-1">
            Total Consumers
          </p>
          <p className="font-mono text-2xl tabular-nums">
            {formatNumber(totalConsumers)}
          </p>
        </div>

        <div className="border border-[#2C3168] rounded-lg p-6 mb-6">
          <p className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] mb-4">
            By Connection Type
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={byType}
              margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2C3168" />
              <XAxis
                dataKey="type"
                tickFormatter={(t) => TYPE_LABELS[String(t)] ?? String(t)}
                stroke="#9CA3D9"
                fontSize={12}
                fontFamily="monospace"
              />
              <YAxis stroke="#9CA3D9" fontSize={12} fontFamily="monospace" />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(value: unknown) => [
                  formatNumber(Number(value) || 0),
                  "Consumers",
                ]}
                labelFormatter={(t) => TYPE_LABELS[String(t)] ?? String(t)}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {byType.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="border border-[#2C3168] rounded-lg p-6 mb-10">
          <p className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] mb-4">
            By Branch
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={byBranch}
              margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2C3168" />
              <XAxis
                dataKey="branch"
                stroke="#9CA3D9"
                fontSize={12}
                fontFamily="monospace"
              />
              <YAxis stroke="#9CA3D9" fontSize={12} fontFamily="monospace" />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(value: unknown) => [
                  formatNumber(Number(value) || 0),
                  "Consumers",
                ]}
              />
              <Bar dataKey="count" fill="#22F0B0" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] mb-3">
            Detail by Branch and Connection Type
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2C3168] font-mono text-xs uppercase tracking-wide text-[#9CA3D9]">
                <th className="text-left py-2 font-normal">Branch</th>
                <th className="text-left py-2 font-normal">Connection Type</th>
                <th className="text-right py-2 font-normal">Consumers</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[#1F2450]">
                  <td className="py-2.5">{r.branch_name}</td>
                  <td className="py-2.5 text-[#9CA3D9]">
                    {TYPE_LABELS[r.connection_type] ?? r.connection_type}
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums">
                    {formatNumber(r.consumer_count)}
                  </td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => startEdit(r)}
                      className="font-mono text-xs text-[#9CA3D9] hover:text-[#F5F0FF] mr-3"
                    >
                      Edit
                    </button>
                    {confirmingId === r.id ? (
                      <>
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="font-mono text-xs text-[#FF4D6D] mr-2"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmingId(null)}
                          className="font-mono text-xs text-[#9CA3D9]"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmingId(r.id)}
                        className="font-mono text-xs text-[#9CA3D9] hover:text-[#FF4D6D]"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==================================================================
//  CSV schema — membership
// ==================================================================
type MembershipNew = { branch_id: string; period: string; connection_type: string; consumer_count: number };

function membershipCsvSchema(): CsvSchema<MembershipRow, MembershipNew> {
  return {
    filename: "membership.csv",
    headers: ["branch_id", "period", "branch_name", "connection_type", "consumer_count"],
    serialize: (r) => [r.branch_id, r.period, r.branch_name, r.connection_type, r.consumer_count],
    templateRow: {
      branch_id: "<uuid from branches>",
      period: "2026-07-01",
      branch_name: "(export-only)",
      connection_type: "all",
      consumer_count: "42310",
    },
    parseRow: (rec) => {
      const branch_id = (rec.branch_id || "").trim();
      const period = (rec.period || "").trim();
      if (!branch_id) throw new Error("branch_id is required");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(period)) throw new Error("period must be YYYY-MM-DD");
      const consumer_count = Number(String(rec.consumer_count || "").replace(/,/g, ""));
      if (!isFinite(consumer_count) || consumer_count < 0) throw new Error("consumer_count must be a non-negative integer");
      return {
        branch_id,
        period,
        connection_type: (rec.connection_type || "all").trim() || "all",
        consumer_count: Math.round(consumer_count),
      };
    },
    onImport: async (payload) => { await createMembership(payload); },
  };
}
