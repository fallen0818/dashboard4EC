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
  updateMembership,
  deleteMembership,
} from "../services/membershipRepository";
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

const COLORS = ["#7FB88A", "#D9A15C", "#8A8F94", "#6B9FD9", "#D9705C"];

const chartTooltipStyle = {
  background: "#1A1D20",
  border: "1px solid #2A2E32",
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
      <div className="min-h-screen bg-[#0F1214] text-[#E8E6E1] flex items-center justify-center">
        <p className="font-mono text-sm tracking-wide text-[#8A8F94]">
          Loading membership data…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0F1214] text-[#E8E6E1] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="font-mono text-sm text-[#D9705C] mb-4">
            Couldn't load membership: {error}
          </p>
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
              Cooperative Report · {formatMonth(latestPeriod)}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Membership
            </h1>
          </div>
          <button
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
            className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] hover:text-[#E8E6E1] border border-[#2A2E32] rounded px-3 py-1.5"
          >
            {showForm ? "Cancel" : "+ Add Entry"}
          </button>
        </header>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-8 border border-[#2A2E32] rounded-lg p-5 space-y-4"
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
                  Month
                </label>
                <input
                  type="date"
                  required
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="w-full bg-[#1A1D20] border border-[#2A2E32] rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] block mb-1">
                  Connection Type
                </label>
                <select
                  value={connectionType}
                  onChange={(e) => setConnectionType(e.target.value)}
                  className="w-full bg-[#1A1D20] border border-[#2A2E32] rounded px-3 py-2 text-sm"
                >
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                  <option value="industrial">Industrial</option>
                  <option value="government">Government</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] block mb-1">
                  Consumer Count
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  value={consumerCount}
                  onChange={(e) => setConsumerCount(e.target.value)}
                  className="w-full bg-[#1A1D20] border border-[#2A2E32] rounded px-3 py-2 text-sm"
                />
              </div>
            </div>
            {formError && (
              <p className="font-mono text-xs text-[#D9705C]">{formError}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="bg-[#E8E6E1] text-[#0F1214] font-medium text-sm px-4 py-2 rounded hover:bg-white transition-colors disabled:opacity-50"
            >
              {submitting
                ? "Saving…"
                : editingId
                  ? "Update Entry"
                  : "Add Entry"}
            </button>
          </form>
        )}

        <div className="border border-[#2A2E32] rounded-lg p-4 mb-8 inline-block">
          <p className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] mb-1">
            Total Consumers
          </p>
          <p className="font-mono text-2xl tabular-nums">
            {formatNumber(totalConsumers)}
          </p>
        </div>

        <div className="border border-[#2A2E32] rounded-lg p-6 mb-6">
          <p className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] mb-4">
            By Connection Type
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={byType}
              margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2E32" />
              <XAxis
                dataKey="type"
                tickFormatter={(t) => TYPE_LABELS[String(t)] ?? String(t)}
                stroke="#8A8F94"
                fontSize={12}
                fontFamily="monospace"
              />
              <YAxis stroke="#8A8F94" fontSize={12} fontFamily="monospace" />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(value: any) => [
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

        <div className="border border-[#2A2E32] rounded-lg p-6 mb-10">
          <p className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] mb-4">
            By Branch
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={byBranch}
              margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2E32" />
              <XAxis
                dataKey="branch"
                stroke="#8A8F94"
                fontSize={12}
                fontFamily="monospace"
              />
              <YAxis stroke="#8A8F94" fontSize={12} fontFamily="monospace" />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(value: any) => [
                  formatNumber(Number(value) || 0),
                  "Consumers",
                ]}
              />
              <Bar dataKey="count" fill="#7FB88A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] mb-3">
            Detail by Branch and Connection Type
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2A2E32] font-mono text-xs uppercase tracking-wide text-[#8A8F94]">
                <th className="text-left py-2 font-normal">Branch</th>
                <th className="text-left py-2 font-normal">Connection Type</th>
                <th className="text-right py-2 font-normal">Consumers</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[#1E2225]">
                  <td className="py-2.5">{r.branch_name}</td>
                  <td className="py-2.5 text-[#8A8F94]">
                    {TYPE_LABELS[r.connection_type] ?? r.connection_type}
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums">
                    {formatNumber(r.consumer_count)}
                  </td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => startEdit(r)}
                      className="font-mono text-xs text-[#8A8F94] hover:text-[#E8E6E1] mr-3"
                    >
                      Edit
                    </button>
                    {confirmingId === r.id ? (
                      <>
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="font-mono text-xs text-[#D9705C] mr-2"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmingId(null)}
                          className="font-mono text-xs text-[#8A8F94]"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmingId(r.id)}
                        className="font-mono text-xs text-[#8A8F94] hover:text-[#D9705C]"
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
