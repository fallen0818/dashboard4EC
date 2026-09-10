import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import { useCollections } from "../hooks/useCollections";
import {
  createCollection,
  updateCollection,
  deleteCollection,
  CollectionRow,
} from "../services/collectionsRepository";
import { supabase } from "../services/supabaseClient";

function formatCurrency(n: number): string {
  return n.toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  });
}

function formatMonth(period: string): string {
  return new Date(period).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
  });
}

const chartTooltipStyle = {
  background: "#171A38",
  border: "1px solid #2C3168",
  borderRadius: 6,
  fontFamily: "monospace",
  fontSize: 12,
};

export default function CollectionsPage() {
  const { rows, trend, loading, error, refresh } = useCollections();

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState("");
  const [period, setPeriod] = useState(
    new Date().toISOString().slice(0, 8) + "01",
  );
  const [billed, setBilled] = useState("");
  const [collected, setCollected] = useState("");
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
    setBilled("");
    setCollected("");
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(row: CollectionRow) {
    setEditingId(row.id);
    setBranchId(row.branch_id);
    setPeriod(row.period);
    setBilled(String(row.amount_billed));
    setCollected(String(row.amount_collected));
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
        amount_billed: Number(billed) || 0,
        amount_collected: Number(collected) || 0,
      };
      if (editingId) {
        await updateCollection(editingId, entry);
      } else {
        await createCollection(entry);
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
      await deleteCollection(id);
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
          Loading collections data…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#08091C] text-[#F5F0FF] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="font-mono text-sm text-[#FF4D6D] mb-4">
            Couldn&apos;t load collections: {error}
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
              Cooperative Report
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Collection Efficiency
            </h1>
          </div>
          <button
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
            className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] hover:text-[#F5F0FF] border border-[#2C3168] rounded px-3 py-1.5"
          >
            {showForm ? "Cancel" : "+ Add Entry"}
          </button>
        </header>

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
                  Amount Billed
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  value={billed}
                  onChange={(e) => setBilled(e.target.value)}
                  className="w-full bg-[#171A38] border border-[#2C3168] rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] block mb-1">
                  Amount Collected
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  value={collected}
                  onChange={(e) => setCollected(e.target.value)}
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

        {/* Efficiency % trend */}
        <div className="border border-[#2C3168] rounded-lg p-6 mb-6">
          <p className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] mb-4">
            Collection Efficiency % · Target ≥95%
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={trend}
              margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2C3168" />
              <XAxis
                dataKey="period"
                tickFormatter={formatMonth}
                stroke="#9CA3D9"
                fontSize={12}
                fontFamily="monospace"
              />
              <YAxis
                stroke="#9CA3D9"
                fontSize={12}
                fontFamily="monospace"
                unit="%"
                domain={[80, 100]}
              />
              <Tooltip
                contentStyle={chartTooltipStyle}
                labelFormatter={(label) => formatMonth(String(label))}
                formatter={(value) => [
                  typeof value === "number" ? `${value}%` : (value ?? ""),
                  "Collection Efficiency",
                ]}
              />
              <ReferenceLine y={95} stroke="#22F0B0" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="collectionEfficiencyPercent"
                stroke="#FFB84D"
                strokeWidth={2}
                dot={{ fill: "#FFB84D", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Billed vs Collected */}
        <div className="border border-[#2C3168] rounded-lg p-6 mb-10">
          <p className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] mb-4">
            Billed vs. Collected (₱) · All Branches Combined
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={trend}
              margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2C3168" />
              <XAxis
                dataKey="period"
                tickFormatter={formatMonth}
                stroke="#9CA3D9"
                fontSize={12}
                fontFamily="monospace"
              />
              <YAxis
                stroke="#9CA3D9"
                fontSize={12}
                fontFamily="monospace"
                tickFormatter={(v) => formatCurrency(v)}
              />
              <Tooltip
                contentStyle={chartTooltipStyle}
                labelFormatter={(label) => formatMonth(String(label))}
                formatter={(value: unknown, name: unknown) => [
                  formatCurrency(Number(value || 0)),
                  String(name),
                ]}
              />
              <Legend
                wrapperStyle={{ fontFamily: "monospace", fontSize: 12 }}
              />
              <Line
                type="monotone"
                dataKey="totalBilled"
                name="Billed"
                stroke="#9CA3D9"
                strokeWidth={2}
                dot={{ fill: "#9CA3D9", r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="totalCollected"
                name="Collected"
                stroke="#22F0B0"
                strokeWidth={2}
                dot={{ fill: "#22F0B0", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Detail table */}
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] mb-3">
            Detail by Branch and Month
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2C3168] font-mono text-xs uppercase tracking-wide text-[#9CA3D9]">
                <th className="text-left py-2 font-normal">Month</th>
                <th className="text-left py-2 font-normal">Branch</th>
                <th className="text-right py-2 font-normal">Billed</th>
                <th className="text-right py-2 font-normal">Collected</th>
                <th className="text-right py-2 font-normal">Receivable</th>
                <th className="text-right py-2 font-normal">Efficiency</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const receivable = r.amount_billed - r.amount_collected;
                return (
                  <tr key={r.id} className="border-b border-[#1F2450]">
                    <td className="py-2.5 font-mono text-[#6C74A8]">
                      {formatMonth(r.period)}
                    </td>
                    <td className="py-2.5">{r.branch_name}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums">
                      {formatCurrency(r.amount_billed)}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums">
                      {formatCurrency(r.amount_collected)}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-[#9CA3D9]">
                      {formatCurrency(receivable)}
                    </td>
                    <td
                      className={`py-2.5 text-right font-mono tabular-nums ${r.collection_efficiency_percent >= 95 ? "text-[#22F0B0]" : "text-[#FF4D6D]"}`}
                    >
                      {r.collection_efficiency_percent}%
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
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
