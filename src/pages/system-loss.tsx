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
} from "recharts";
import Modal from "../components/Modal";
import { useSystemLoss } from "../hooks/useSystemLoss";
import { useRole } from "../hooks/useRole";
import {
  createSystemLoss,
  updateSystemLoss,
  deleteSystemLoss,
  SystemLossRow,
} from "../services/systemLossRepository";
import CsvIO, { CsvSchema } from "../components/CsvIO";
import { parseFlexibleDate } from "../lib/dates";
import { supabase } from "../services/supabaseClient";

function formatNumber(n: number): string {
  return n.toLocaleString("en-PH", { maximumFractionDigits: 0 });
}

function formatMonth(period: string): string {
  return new Date(period).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
  });
}


// Formats a raw digit string as "1,234,567" for display in numeric inputs.
function formatWithCommas(v: string | number): string {
  const digits = String(v).replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("en-US");
}

export default function SystemLossPage() {
  const { rows, trend, loading, error, refresh } = useSystemLoss();
  const { canWrite, canDelete } = useRole();

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState("");
  const [period, setPeriod] = useState(
    new Date().toISOString().slice(0, 8) + "01",
  );
  const [kwhPurchased, setKwhPurchased] = useState("");
  const [kwhSold, setKwhSold] = useState("");
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
    setKwhPurchased("");
    setKwhSold("");
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(row: SystemLossRow) {
    setEditingId(row.id);
    setBranchId(row.branch_id);
    setPeriod(row.period);
    setKwhPurchased(formatWithCommas(row.kwh_purchased));
    setKwhSold(formatWithCommas(row.kwh_sold));
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
        kwh_purchased: Number(String(kwhPurchased).replace(/,/g, "")) || 0,
        kwh_sold: Number(String(kwhSold).replace(/,/g, "")) || 0,
      };
      if (editingId) {
        await updateSystemLoss(editingId, entry);
      } else {
        await createSystemLoss(entry);
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
      await deleteSystemLoss(id);
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
          Loading system loss data…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#08091C] text-[#F5F0FF] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="font-mono text-sm text-[#FF4D6D] mb-4">
            Couldn&apos;t load system loss: {error}
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
              System Loss
            </h1>
          </div>
          <div className="flex flex-col items-end gap-2">
            {(canWrite || showForm) && (
            <button
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
            className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] hover:text-[#F5F0FF] border border-[#2C3168] rounded px-3 py-1.5"
          >
            {showForm ? "Cancel" : "+ Add Entry"}
          </button>
          )}
            <CsvIO rows={rows} schema={systemLossCsvSchema()} onAfterImport={refresh} canImport={canWrite} />
          </div>
        </header>

        <Modal
          open={showForm}
          onClose={resetForm}
          title={editingId ? "Edit Entry" : "Add Entry"}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  kWh Purchased
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={kwhPurchased}
                  onChange={(e) => setKwhPurchased(formatWithCommas(e.target.value))}
                  placeholder="0"
                  className="w-full bg-[#171A38] border border-[#2C3168] rounded px-3 py-2 text-sm font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] block mb-1">
                  kWh Sold
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={kwhSold}
                  onChange={(e) => setKwhSold(formatWithCommas(e.target.value))}
                  placeholder="0"
                  className="w-full bg-[#171A38] border border-[#2C3168] rounded px-3 py-2 text-sm font-mono tabular-nums"
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
        </Modal>

        {/* Trend chart */}
        <div className="border border-[#2C3168] rounded-lg p-6 mb-10">
          <p className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] mb-4">
            Monthly Trend (all branches combined) · Target ≤13%
          </p>
          <ResponsiveContainer width="100%" height={260}>
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
              />
              <Tooltip
                contentStyle={{
                  background: "#171A38",
                  border: "1px solid #2C3168",
                  borderRadius: 6,
                  fontFamily: "monospace",
                  fontSize: 12,
                }}
                labelFormatter={(label) => formatMonth(String(label))}
                formatter={(value) => [`${value ?? 0}%`, "System Loss"]}
              />
              <ReferenceLine y={13} stroke="#FF4D6D" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="systemLossPercent"
                stroke="#22F0B0"
                strokeWidth={2}
                dot={{ fill: "#22F0B0", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Per-branch breakdown table */}
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] mb-3">
            Detail by Branch and Month
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2C3168] font-mono text-xs uppercase tracking-wide text-[#9CA3D9]">
                <th className="text-left py-2 font-normal">Month</th>
                <th className="text-left py-2 font-normal">Branch</th>
                <th className="text-right py-2 font-normal">Purchased (kWh)</th>
                <th className="text-right py-2 font-normal">Sold (kWh)</th>
                <th className="text-right py-2 font-normal">Loss %</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[#1F2450]">
                  <td className="py-2.5 font-mono text-[#6C74A8]">
                    {formatMonth(r.period)}
                  </td>
                  <td className="py-2.5">{r.branch_name}</td>
                  <td className="py-2.5 text-right font-mono tabular-nums">
                    {formatNumber(r.kwh_purchased)}
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums">
                    {formatNumber(r.kwh_sold)}
                  </td>
                  <td
                    className={`py-2.5 text-right font-mono tabular-nums ${r.system_loss_percent <= 13 ? "text-[#22F0B0]" : "text-[#FF4D6D]"}`}
                  >
                    {r.system_loss_percent}%
                  </td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    {canWrite && <button
                      onClick={() => startEdit(r)}
                      className="font-mono text-xs text-[#9CA3D9] hover:text-[#F5F0FF] mr-3"
                    >
                      Edit
                    </button>}
                    {canDelete && (confirmingId === r.id ? (
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
                    ))}
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
//  CSV schema — system_loss
// ==================================================================
type SystemLossNew = { branch_id: string; period: string; kwh_purchased: number; kwh_sold: number };

function systemLossCsvSchema(): CsvSchema<SystemLossRow, SystemLossNew> {
  return {
    filename: "system_loss.csv",
    headers: ["branch_id", "period", "branch_name", "kwh_purchased", "kwh_sold", "system_loss_kwh", "system_loss_percent"],
    serialize: (r) => [r.branch_id, r.period, r.branch_name, r.kwh_purchased, r.kwh_sold, r.system_loss_kwh, r.system_loss_percent],
    templateRow: {
      branch_id: "<uuid from branches>",
      period: "2026-07-01",
      branch_name: "(export-only)",
      kwh_purchased: "1000000",
      kwh_sold: "870000",
      system_loss_kwh: "(derived; leave blank)",
      system_loss_percent: "(derived; leave blank)",
    },
    parseRow: (rec) => {
      const branch_id = (rec.branch_id || "").trim();
      const period = parseFlexibleDate(rec.period, "period");
      if (!branch_id) throw new Error("branch_id is required");
      const kwh_purchased = Number(String(rec.kwh_purchased || "").replace(/,/g, ""));
      const kwh_sold      = Number(String(rec.kwh_sold      || "").replace(/,/g, ""));
      if (!isFinite(kwh_purchased) || kwh_purchased < 0) throw new Error("kwh_purchased must be a non-negative number");
      if (!isFinite(kwh_sold)      || kwh_sold      < 0) throw new Error("kwh_sold must be a non-negative number");
      return { branch_id, period, kwh_purchased, kwh_sold };
    },
    onImport: async (payload) => { await createSystemLoss(payload); },
  };
}
