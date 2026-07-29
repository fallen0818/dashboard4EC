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
  Legend,
} from "recharts";
import { usePowerSupply } from "../hooks/usePowerSupply";
import {
  createPowerSupply,
  updatePowerSupply,
  deletePowerSupply,
  PowerSupplyRow,
} from "../services/powerSupplyRepository";
import { supabase } from "../services/supabaseClient";

function formatNumber(n: number): string {
  return n.toLocaleString("en-PH", { maximumFractionDigits: 0 });
}

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
  background: "#1A1D20",
  border: "1px solid #2A2E32",
  borderRadius: 6,
  fontFamily: "monospace",
  fontSize: 12,
};

export default function PowerSupplyPage() {
  const { rows, trend, loading, error, refresh } = usePowerSupply();

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState("");
  const [period, setPeriod] = useState(
    new Date().toISOString().slice(0, 8) + "01",
  );
  const [kwhPurchased, setKwhPurchased] = useState("");
  const [cost, setCost] = useState("");
  const [kwhSold, setKwhSold] = useState("");
  const [revenue, setRevenue] = useState("");
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
    setCost("");
    setKwhSold("");
    setRevenue("");
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(row: PowerSupplyRow) {
    setEditingId(row.id);
    setBranchId(row.branch_id);
    setPeriod(row.period);
    setKwhPurchased(String(row.kwh_purchased));
    setCost(String(row.purchased_power_cost));
    setKwhSold(String(row.kwh_sold));
    setRevenue(String(row.sales_revenue));
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
        kwh_purchased: Number(kwhPurchased) || 0,
        purchased_power_cost: Number(cost) || 0,
        kwh_sold: Number(kwhSold) || 0,
        sales_revenue: Number(revenue) || 0,
      };
      if (editingId) {
        await updatePowerSupply(editingId, entry);
      } else {
        await createPowerSupply(entry);
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
      await deletePowerSupply(id);
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
          Loading power supply data…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0F1214] text-[#E8E6E1] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="font-mono text-sm text-[#D9705C] mb-4">
            Couldn't load power supply: {error}
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
              Cooperative Report
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              kWh Sales / Purchased Power
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
                  kWh Purchased
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  value={kwhPurchased}
                  onChange={(e) => setKwhPurchased(e.target.value)}
                  className="w-full bg-[#1A1D20] border border-[#2A2E32] rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] block mb-1">
                  Purchased Power Cost
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  className="w-full bg-[#1A1D20] border border-[#2A2E32] rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] block mb-1">
                  kWh Sold
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  value={kwhSold}
                  onChange={(e) => setKwhSold(e.target.value)}
                  className="w-full bg-[#1A1D20] border border-[#2A2E32] rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] block mb-1">
                  Sales Revenue
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  value={revenue}
                  onChange={(e) => setRevenue(e.target.value)}
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

        {/* Volume chart */}
        <div className="border border-[#2A2E32] rounded-lg p-6 mb-6">
          <p className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] mb-4">
            Energy Volume (kWh) · All Branches Combined
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={trend}
              margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2E32" />
              <XAxis
                dataKey="period"
                tickFormatter={formatMonth}
                stroke="#8A8F94"
                fontSize={12}
                fontFamily="monospace"
              />
              <YAxis
                stroke="#8A8F94"
                fontSize={12}
                fontFamily="monospace"
                tickFormatter={(v) => formatNumber(v)}
              />
              <Tooltip
                contentStyle={chartTooltipStyle}
                labelFormatter={(label) => formatMonth(String(label))}
                formatter={(value: any, name: string | number | undefined) => [
                  formatNumber(Number(value)),
                  name ?? "",
                ]}
              />
              <Legend
                wrapperStyle={{ fontFamily: "monospace", fontSize: 12 }}
              />
              <Line
                type="monotone"
                dataKey="totalKwhPurchased"
                name="Purchased"
                stroke="#8A8F94"
                strokeWidth={2}
                dot={{ fill: "#8A8F94", r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="totalKwhSold"
                name="Sold"
                stroke="#7FB88A"
                strokeWidth={2}
                dot={{ fill: "#7FB88A", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Financial chart */}
        <div className="border border-[#2A2E32] rounded-lg p-6 mb-10">
          <p className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] mb-4">
            Cost vs. Revenue (₱) · All Branches Combined
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={trend}
              margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2E32" />
              <XAxis
                dataKey="period"
                tickFormatter={formatMonth}
                stroke="#8A8F94"
                fontSize={12}
                fontFamily="monospace"
              />
              <YAxis
                stroke="#8A8F94"
                fontSize={12}
                fontFamily="monospace"
                tickFormatter={(v) => formatCurrency(v)}
              />
              <Tooltip
                contentStyle={chartTooltipStyle}
                labelFormatter={(label) => formatMonth(String(label))}
                formatter={(value) => formatCurrency(Number(value))}
              />
              <Legend
                wrapperStyle={{ fontFamily: "monospace", fontSize: 12 }}
              />
              <Line
                type="monotone"
                dataKey="totalCost"
                name="Purchased Power Cost"
                stroke="#D9705C"
                strokeWidth={2}
                dot={{ fill: "#D9705C", r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="totalRevenue"
                name="Sales Revenue"
                stroke="#7FB88A"
                strokeWidth={2}
                dot={{ fill: "#7FB88A", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Detail table */}
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] mb-3">
            Detail by Branch and Month
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2A2E32] font-mono text-xs uppercase tracking-wide text-[#8A8F94]">
                <th className="text-left py-2 font-normal">Month</th>
                <th className="text-left py-2 font-normal">Branch</th>
                <th className="text-right py-2 font-normal">Purchased (kWh)</th>
                <th className="text-right py-2 font-normal">Sold (kWh)</th>
                <th className="text-right py-2 font-normal">Cost</th>
                <th className="text-right py-2 font-normal">Revenue</th>
                <th className="text-right py-2 font-normal">Margin</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const margin = r.sales_revenue - r.purchased_power_cost;
                return (
                  <tr key={r.id} className="border-b border-[#1E2225]">
                    <td className="py-2.5 font-mono text-[#6B7075]">
                      {formatMonth(r.period)}
                    </td>
                    <td className="py-2.5">{r.branch_name}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums">
                      {formatNumber(r.kwh_purchased)}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums">
                      {formatNumber(r.kwh_sold)}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums">
                      {formatCurrency(r.purchased_power_cost)}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums">
                      {formatCurrency(r.sales_revenue)}
                    </td>
                    <td
                      className={`py-2.5 text-right font-mono tabular-nums ${margin >= 0 ? "text-[#7FB88A]" : "text-[#D9705C]"}`}
                    >
                      {formatCurrency(margin)}
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
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
