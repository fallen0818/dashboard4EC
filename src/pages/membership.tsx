import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useMembership, membershipAggregates } from "../hooks/useMembership";
import { PeriodMode } from "../services/dashboardRepository";
import { useRole } from "../hooks/useRole";
import Modal from "../components/Modal";
import {
  listMembers,
  createMember,
  updateMemberRow,
  deleteMember,
  Member,
  MemberStatus,
  NewMember,
} from "../services/membersRepository";
import { listBranches, BranchOption } from "../services/powerSupplyRepository";
import {
  createMembership,
  MembershipRow,
  ConnectionType,
  CONNECTION_TYPES,
  updateMembership,
  deleteMembership,
} from "../services/membershipRepository";
import CsvIO, { CsvSchema } from "../components/CsvIO";
import { parseFlexibleDate } from "../lib/dates";
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

const _COLORS = ["#22F0B0", "#FFB84D", "#9CA3D9", "#4DA6FF", "#FF4D6D"];

const chartTooltipStyle = {
  background: "#171A38",
  border: "1px solid #2C3168",
  borderRadius: 6,
  fontFamily: "monospace",
  fontSize: 12,
};


// Formats a raw digit string as "1,234,567" for numeric inputs.
function formatWithCommas(v: string | number): string {
  const digits = String(v).replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("en-US");
}

export default function MembershipPage() {
  const { rows: allRows, months, years, loading, error, refresh } = useMembership();

  // Period picker state — starts on the newest month with any data.
  const [mode, setMode] = useState<PeriodMode>('month');
  const [monthIdx, setMonthIdx] = useState(0);
  const [yearIdx, setYearIdx] = useState(0);
  // Clamp the picker index inline instead of via setState-in-effect —
  // handles arrays that shrink after data changes without triggering
  // the react-hooks/set-state-in-effect rule.
  const safeMonthIdx = Math.min(Math.max(0, monthIdx), Math.max(0, months.length - 1));
  const safeYearIdx  = Math.min(Math.max(0, yearIdx),  Math.max(0, years.length  - 1));
  const currentMonth = months[safeMonthIdx];      // YYYY-MM-01
  const currentYear  = years[safeYearIdx];        // e.g. 2026

  const rows = React.useMemo(() => {
    if (allRows.length === 0) return [];
    if (mode === 'month') {
      if (!currentMonth) return [];
      return allRows.filter((r) => r.period.slice(0, 7) === currentMonth.slice(0, 7));
    }
    if (!currentYear) return [];
    return allRows.filter((r) => r.period.slice(0, 4) === String(currentYear));
  }, [allRows, mode, currentMonth, currentYear]);

  const { byType, byBranch, totalConsumers, totalEnergy } = React.useMemo(
    () => membershipAggregates(rows),
    [rows],
  );

  const periodLabel = mode === 'month'
    ? (currentMonth ? formatMonth(currentMonth) : 'No data yet')
    : (currentYear ? String(currentYear) : 'No data yet');
  const { canWrite, canDelete } = useRole();
  const [showMembers, setShowMembers] = useState(false);

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState("");
  const [period, setPeriod] = useState(
    new Date().toISOString().slice(0, 8) + "01",
  );
  const [connectionType, setConnectionType] = useState<ConnectionType>("residential");
  const [consumerCount, setConsumerCount] = useState("");
  const [energy, setEnergy] = useState("");
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
    setEnergy("");
    setConnectionType("residential");
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(row: (typeof rows)[number]) {
    setEditingId(row.id);
    setBranchId(row.branch_id);
    setPeriod(row.period);
    setConnectionType(row.connection_type as ConnectionType);
    setConsumerCount(formatWithCommas(row.consumer_count));
    setEnergy(formatWithCommas(row.energy_kwh));
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
        consumer_count: Number(String(consumerCount).replace(/,/g, "")) || 0,
        energy_kwh: Number(String(energy).replace(/,/g, "")) || 0,
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
              Cooperative Report · {periodLabel}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Membership
            </h1>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2">
            {canWrite && (
              <button
                onClick={() => setShowMembers((v) => !v)}
                className={`font-mono text-xs uppercase tracking-wide border rounded px-3 py-1.5 transition-colors ${
                  showMembers
                    ? "bg-[#F5F0FF] text-[#08091C] border-[#F5F0FF]"
                    : "text-[#9CA3D9] hover:text-[#F5F0FF] border-[#2C3168]"
                }`}
              >
                Manage Membership
              </button>
            )}
            {(canWrite || showForm) && (
            <button
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
            className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] hover:text-[#F5F0FF] border border-[#2C3168] rounded px-3 py-1.5"
          >
            {showForm ? "Cancel" : "+ Add Entry"}
          </button>
          )}
          </div>
            <CsvIO rows={rows} schema={membershipCsvSchema()} onAfterImport={refresh} canImport={canWrite} />
          </div>
        </header>

        <MembershipPeriodNavigator
          mode={mode}
          setMode={setMode}
          months={months}
          years={years}
          monthIdx={safeMonthIdx}
          setMonthIdx={setMonthIdx}
          yearIdx={safeYearIdx}
          setYearIdx={setYearIdx}
        />

        {showMembers && (
          <MembersManager onClose={() => setShowMembers(false)} canDelete={canDelete} />
        )}

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
                  Connection Type
                </label>
                <select
                  value={connectionType}
                  onChange={(e) => setConnectionType(e.target.value as ConnectionType)}
                  className="w-full bg-[#171A38] border border-[#2C3168] rounded px-3 py-2 text-sm"
                >
                  {CONNECTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] block mb-1">
                  Total (consumers)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={consumerCount}
                  onChange={(e) => setConsumerCount(formatWithCommas(e.target.value))}
                  placeholder="0"
                  className="w-full bg-[#171A38] border border-[#2C3168] rounded px-3 py-2 text-sm font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] block mb-1">
                  Energy (kWh)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={energy}
                  onChange={(e) => setEnergy(formatWithCommas(e.target.value))}
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

        <div className="flex gap-4 mb-8 flex-wrap">
          <div className="border border-[#2C3168] rounded-lg p-4">
            <p className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] mb-1">
              Total Consumers
            </p>
            <p className="font-mono text-2xl tabular-nums">
              {formatNumber(totalConsumers)}
            </p>
          </div>
          <div className="border border-[#2C3168] rounded-lg p-4">
            <p className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] mb-1">
              Total Energy (kWh)
            </p>
            <p className="font-mono text-2xl tabular-nums" style={{ color: "#22F0B0" }}>
              {formatNumber(totalEnergy)}
            </p>
          </div>
        </div>

        <div className="border border-[#2C3168] rounded-lg p-6 mb-6">
          <p className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] mb-4">
            By Connection Type
          </p>
          <ResponsiveContainer width="100%" height={280}>
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
              <YAxis
                yAxisId="left"
                stroke="#9CA3D9"
                fontSize={12}
                fontFamily="monospace"
                tickFormatter={(v) => formatNumber(Number(v))}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#22F0B0"
                fontSize={12}
                fontFamily="monospace"
                tickFormatter={(v) => formatNumber(Number(v))}
              />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(value: unknown, name: unknown) => [
                  formatNumber(Number(value) || 0),
                  String(name),
                ]}
                labelFormatter={(t) => TYPE_LABELS[String(t)] ?? String(t)}
              />
              <Legend wrapperStyle={{ fontFamily: "monospace", fontSize: 12 }} />
              <Bar yAxisId="left"  dataKey="count"  name="Total (consumers)" fill="#4DA6FF" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="energy" name="Energy (kWh)"      fill="#22F0B0" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="border border-[#2C3168] rounded-lg p-6 mb-10">
          <p className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] mb-4">
            By Branch
          </p>
          <ResponsiveContainer width="100%" height={240}>
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
              <YAxis
                yAxisId="left"
                stroke="#9CA3D9"
                fontSize={12}
                fontFamily="monospace"
                tickFormatter={(v) => formatNumber(Number(v))}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#22F0B0"
                fontSize={12}
                fontFamily="monospace"
                tickFormatter={(v) => formatNumber(Number(v))}
              />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(value: unknown, name: unknown) => [
                  formatNumber(Number(value) || 0),
                  String(name),
                ]}
              />
              <Legend wrapperStyle={{ fontFamily: "monospace", fontSize: 12 }} />
              <Bar yAxisId="left"  dataKey="count"  name="Total (consumers)" fill="#4DA6FF" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="energy" name="Energy (kWh)"      fill="#22F0B0" radius={[4, 4, 0, 0]} />
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
                <th className="text-left  py-2 font-normal">YYYYMM</th>
                <th className="text-left  py-2 font-normal">Branch</th>
                <th className="text-left  py-2 font-normal">Customer Type</th>
                <th className="text-right py-2 font-normal">Total</th>
                <th className="text-right py-2 font-normal">Energy (kWh)</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[#1F2450]">
                  <td className="py-2.5 font-mono text-[#6C74A8]">
                    {r.period.slice(0, 7).replace("-", "")}
                  </td>
                  <td className="py-2.5">{r.branch_name}</td>
                  <td className="py-2.5">
                    {TYPE_LABELS[r.connection_type] ?? r.connection_type}
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums">
                    {formatNumber(r.consumer_count)}
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums">
                    {formatNumber(r.energy_kwh)}
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
//  CSV schema — membership
// ==================================================================
type MembershipNew = { branch_id: string; period: string; connection_type: ConnectionType; consumer_count: number; energy_kwh: number };

function membershipCsvSchema(): CsvSchema<MembershipRow, MembershipNew> {
  return {
    filename: "membership.csv",
    headers: ["yyyymm", "branch_id", "branch_name", "connection_type", "consumer_count", "energy_kwh"],
    serialize: (r) => [r.period.slice(0, 7).replace("-", ""), r.branch_id, r.branch_name, r.connection_type, r.consumer_count, r.energy_kwh],
    templateRow: {
      branch_id: "<uuid from branches>",
      yyyymm: "202607",
      branch_name: "(export-only)",
      connection_type: "all",
      consumer_count: "42310",
      energy_kwh: "30000",
    },
    parseRow: (rec) => {
      const branch_id = (rec.branch_id || "").trim();
      const period = parseFlexibleDate(rec.yyyymm ?? rec.period, "yyyymm");
      if (!branch_id) throw new Error("branch_id is required");
      const consumer_count = Number(String(rec.consumer_count || "").replace(/,/g, ""));
      if (!isFinite(consumer_count) || consumer_count < 0) throw new Error("consumer_count must be a non-negative integer");
      const energy_kwh = Number(String(rec.energy_kwh || "0").replace(/,/g, ""));
      if (!isFinite(energy_kwh) || energy_kwh < 0) throw new Error("energy_kwh must be a non-negative number");
      return {
        branch_id,
        period,
        connection_type: normalizeConnectionType(rec.connection_type),
        consumer_count: Math.round(consumer_count),
        energy_kwh,
      };
    },
    onImport: async (payload) => { await createMembership(payload); },
  };
}

// ==================================================================
//  Members Manager — CRUD over public.members, opened from the
//  membership page header. All writes go through RLS: editor+ can
//  add/edit, admin only can delete.
// ==================================================================
const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  active:       "Active",
  disconnected: "Disconnected",
  closed:       "Closed",
};

const MEMBER_STATUS_COLORS: Record<MemberStatus, string> = {
  active:       "#22F0B0",
  disconnected: "#FFB84D",
  closed:       "#FF4D6D",
};

interface MembersManagerProps {
  onClose: () => void;
  canDelete: boolean;
}

function MembersManager({ onClose, canDelete }: MembersManagerProps) {
  const [rows, setRows] = useState<Member[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const [branchId, setBranchId] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<MemberStatus>("active");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<MemberStatus | "all">("all");

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [ms, bs] = await Promise.all([listMembers(), listBranches()]);
      setRows(ms);
      setBranches(bs);
      if (!branchId && bs.length > 0) setBranchId(bs[0].id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load members");
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ms, bs] = await Promise.all([listMembers(), listBranches()]);
        if (!cancelled) {
          setRows(ms);
          setBranches(bs);
          if (bs.length > 0) setBranchId(bs[0].id);
          setErr(null);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load members");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function resetForm() {
    setEditingId(null);
    setAccountNumber("");
    setFullName("");
    setAddress("");
    setStatus("active");
    if (branches.length > 0) setBranchId(branches[0].id);
    setShowForm(false);
  }

  function startEdit(m: Member) {
    setEditingId(m.id);
    setBranchId(m.branch_id);
    setAccountNumber(m.account_number);
    setFullName(m.full_name);
    setAddress(m.address ?? "");
    setStatus(m.status);
    setShowForm(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const payload: NewMember = {
        branch_id: branchId,
        account_number: accountNumber.trim(),
        full_name: fullName.trim(),
        address: address.trim() || null,
        status,
      };
      if (!payload.account_number) throw new Error("Account number is required");
      if (!payload.full_name)      throw new Error("Full name is required");
      if (editingId) await updateMemberRow(editingId, payload);
      else await createMember(payload);
      resetForm();
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save member");
    }
  }

  async function remove(id: string) {
    try {
      await deleteMember(id);
      await load();
    } catch (e) {
      setErr(
        (e instanceof Error ? e.message : "Failed to delete member") +
          " · Tip: change status to 'closed' instead to keep billing history.",
      );
    } finally {
      setConfirmingId(null);
    }
  }

  const filtered = rows.filter((m) => {
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    if (!query) return true;
    const q = query.trim().toLowerCase();
    return (
      m.account_number.toLowerCase().includes(q) ||
      m.full_name.toLowerCase().includes(q) ||
      (m.address ?? "").toLowerCase().includes(q)
    );
  });

  const counts = {
    all:          rows.length,
    active:       rows.filter((m) => m.status === "active").length,
    disconnected: rows.filter((m) => m.status === "disconnected").length,
    closed:       rows.filter((m) => m.status === "closed").length,
  };

  return (
    <section className="mb-8 border border-[#2C3168] rounded-lg bg-[#0F1230]">
      <div className="flex justify-between items-center px-5 py-3 border-b border-[#2C3168] flex-wrap gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#9CA3D9]">
          Manage Membership · {rows.length} total
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
            className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] hover:text-[#F5F0FF] border border-[#2C3168] rounded px-3 py-1"
          >
            {showForm ? "Cancel" : editingId ? "Cancel edit" : "+ New Member"}
          </button>
          <button
            onClick={onClose}
            className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] hover:text-[#F5F0FF] px-2"
          >
            ✕ Close
          </button>
        </div>
      </div>

      {err && (
        <div className="px-5 py-2 bg-[#3A0F1E] border-b border-[#2C3168]">
          <p className="font-mono text-xs text-[#FF4D6D]">{err}</p>
        </div>
      )}

      <Modal
        open={showForm}
        onClose={resetForm}
        title={editingId ? "Edit Member" : "New Member"}
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] block mb-1">Account Number</label>
              <input
                required
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="e.g. 100000123"
                className="w-full bg-[#171A38] border border-[#2C3168] rounded px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] block mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MemberStatus)}
                className="w-full bg-[#171A38] border border-[#2C3168] rounded px-3 py-2 text-sm"
              >
                {(Object.keys(MEMBER_STATUS_LABELS) as MemberStatus[]).map((v) => (
                  <option key={v} value={v}>{MEMBER_STATUS_LABELS[v]}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] block mb-1">Full Name</label>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-[#171A38] border border-[#2C3168] rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] block mb-1">Address</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-[#171A38] border border-[#2C3168] rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] block mb-1">Branch</label>
              <select
                required
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full bg-[#171A38] border border-[#2C3168] rounded px-3 py-2 text-sm"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            className="bg-[#F5F0FF] text-[#08091C] font-medium text-sm px-4 py-2 rounded hover:bg-white transition-colors"
          >
            {editingId ? "Update Member" : "Add Member"}
          </button>
        </form>
      </Modal>

      <div className="p-5">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[220px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6C74A8] text-xs">⌕</span>
            <input
              type="text"
              placeholder="Search account, name, or address…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-[#171A38] border border-[#2C3168] rounded-md pl-8 pr-3 py-2 text-sm placeholder-[#454A80] focus:outline-none focus:border-[#4A4F9C]"
            />
          </div>
          <div className="flex bg-[#171A38] border border-[#2C3168] rounded-md p-0.5">
            {(["all","active","disconnected","closed"] as const).map((v) => {
              const active = statusFilter === v;
              const label = v === "all" ? `All (${counts.all})` : `${MEMBER_STATUS_LABELS[v]} (${counts[v]})`;
              return (
                <button
                  key={v}
                  onClick={() => setStatusFilter(v)}
                  className={`px-3 py-1 font-mono text-xs uppercase tracking-wide rounded transition-colors ${
                    active ? "bg-[#F5F0FF] text-[#08091C]" : "text-[#9CA3D9] hover:text-[#F5F0FF]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <p className="font-mono text-xs text-[#6C74A8]">Loading members…</p>
        ) : filtered.length === 0 ? (
          <p className="font-mono text-xs text-[#6C74A8]">No members match.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2C3168] font-mono text-xs uppercase tracking-wide text-[#9CA3D9]">
                <th className="text-left  py-2 font-normal">Account #</th>
                <th className="text-left  py-2 font-normal">Full Name</th>
                <th className="text-left  py-2 font-normal">Address</th>
                <th className="text-left  py-2 font-normal">Branch</th>
                <th className="text-center py-2 font-normal">Status</th>
                <th className="w-32"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className={`border-b border-[#1F2450] ${m.status === "closed" ? "opacity-60" : ""}`}>
                  <td className="py-2 font-mono text-[#F5F0FF]">{m.account_number}</td>
                  <td className="py-2">{m.full_name}</td>
                  <td className="py-2 text-[#9CA3D9]">{m.address ?? <span className="text-[#6C74A8]">—</span>}</td>
                  <td className="py-2 font-mono text-xs text-[#9CA3D9]">{m.branch_name}</td>
                  <td className="py-2 text-center">
                    <span
                      className="font-mono text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border"
                      style={{ color: MEMBER_STATUS_COLORS[m.status], borderColor: MEMBER_STATUS_COLORS[m.status] + '55' }}
                    >
                      {MEMBER_STATUS_LABELS[m.status]}
                    </span>
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => startEdit(m)}
                      className="font-mono text-xs text-[#9CA3D9] hover:text-[#F5F0FF] mr-3"
                    >
                      Edit
                    </button>
                    {canDelete && (
                      confirmingId === m.id ? (
                        <>
                          <button onClick={() => remove(m.id)} className="font-mono text-xs text-[#FF4D6D] mr-2">Confirm</button>
                          <button onClick={() => setConfirmingId(null)} className="font-mono text-xs text-[#9CA3D9]">Cancel</button>
                        </>
                      ) : (
                        <button
                          onClick={() => setConfirmingId(m.id)}
                          className="font-mono text-xs text-[#9CA3D9] hover:text-[#FF4D6D]"
                        >
                          Delete
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}


function normalizeConnectionType(v: string | undefined): ConnectionType {
  const raw = (v ?? "").trim().toLowerCase();
  if (!raw) return "all";
  // Accept a few common spellings.
  const map: Record<string, ConnectionType> = {
    all: "all",
    residential: "residential", res: "residential",
    commercial: "commercial", com: "commercial",
    industrial: "industrial", ind: "industrial",
    government: "government", gov: "government",
    streetlights: "streetlights", streetlight: "streetlights", sl: "streetlights",
    others: "others", other: "others",
  };
  const v2 = map[raw];
  if (!v2) throw new Error(
    `connection_type "${v}" is not one of: ${CONNECTION_TYPES.join(", ")}`,
  );
  return v2;
}

// ==================================================================
//  MembershipPeriodNavigator — month / year toggle + prev/next scroll
// ==================================================================
interface MembershipPeriodNavigatorProps {
  mode: PeriodMode;
  setMode: React.Dispatch<React.SetStateAction<PeriodMode>>;
  months: string[];    // newest first, "YYYY-MM-01"
  years: number[];     // newest first
  monthIdx: number;
  setMonthIdx: React.Dispatch<React.SetStateAction<number>>;
  yearIdx: number;
  setYearIdx: React.Dispatch<React.SetStateAction<number>>;
}

function MembershipPeriodNavigator({
  mode,
  setMode,
  months,
  years,
  monthIdx,
  setMonthIdx,
  yearIdx,
  setYearIdx,
}: MembershipPeriodNavigatorProps) {
  const list = mode === 'month' ? months : years;
  const idx = mode === 'month' ? monthIdx : yearIdx;
  const setIdx = mode === 'month' ? setMonthIdx : setYearIdx;

  const canOlder = idx < list.length - 1;
  const canNewer = idx > 0;

  const label =
    list.length === 0
      ? 'No data yet'
      : mode === 'month'
        ? formatMonth(months[monthIdx])
        : String(years[yearIdx]);

  return (
    <section className="mb-6 flex flex-wrap items-center gap-3">
      <div className="flex bg-[#171A38] border border-[#2C3168] rounded-md p-0.5">
        {(['month', 'year'] as const).map((m) => {
          const active = mode === m;
          return (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 font-mono text-xs uppercase tracking-wide rounded transition-colors ${
                active ? 'bg-[#F5F0FF] text-[#08091C]' : 'text-[#9CA3D9] hover:text-[#F5F0FF]'
              }`}
            >
              {m}
            </button>
          );
        })}
      </div>

      <div className="flex items-center bg-[#171A38] border border-[#2C3168] rounded-md">
        <button
          onClick={() => canOlder && setIdx((i) => i + 1)}
          disabled={!canOlder}
          className="px-3 py-1 font-mono text-sm text-[#9CA3D9] hover:text-[#F5F0FF] disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label={`Previous ${mode}`}
          title={`Previous ${mode}`}
        >
          ‹
        </button>
        <span className="px-4 py-1 font-mono text-sm min-w-[110px] text-center">{label}</span>
        <button
          onClick={() => canNewer && setIdx((i) => i - 1)}
          disabled={!canNewer}
          className="px-3 py-1 font-mono text-sm text-[#9CA3D9] hover:text-[#F5F0FF] disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label={`Next ${mode}`}
          title={`Next ${mode}`}
        >
          ›
        </button>
      </div>

      {idx > 0 && (
        <button
          onClick={() => setIdx(0)}
          className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] hover:text-[#F5F0FF] border border-[#2C3168] rounded px-3 py-1.5"
        >
          Latest
        </button>
      )}
    </section>
  );
}
