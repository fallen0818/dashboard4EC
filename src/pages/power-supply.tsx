import React, { useEffect, useMemo, useState } from "react";
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
import Modal from "../components/Modal";
import CsvIO, { CsvSchema } from "../components/CsvIO";
import { usePowerSupply } from "../hooks/usePowerSupply";
import {
  createPowerSupply,
  updatePowerSupply,
  deletePowerSupply,
  listActiveSuppliers,
  listAllSuppliers,
  listBranches,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  PowerSupplyRow,
  SupplierOption,
  Supplier,
  SupplierType,
  BranchOption,
} from "../services/powerSupplyRepository";

// ---------- formatters ----------
function formatNumber(n: number): string {
  return n.toLocaleString("en-PH", { maximumFractionDigits: 0 });
}
function formatCurrency(n: number): string {
  return n.toLocaleString("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
}
function formatRate(n: number): string {
  return `₱${n.toFixed(4)}`;
}
function formatYYYYMM(yyyymm: string): string {
  const y = Number(yyyymm.slice(0, 4));
  const m = Number(yyyymm.slice(4, 6)) - 1;
  return new Date(Date.UTC(y, m, 1)).toLocaleDateString("en-PH", { year: "numeric", month: "short" });
}

const chartTooltipStyle = {
  background: "#171A38",
  border: "1px solid #2C3168",
  borderRadius: 6,
  fontFamily: "monospace",
  fontSize: 12,
};

// ---------- filter / sort types ----------
type SortField = "yyyymm" | "supplier_name" | "energy" | "power_cost" | "rate";
type SortDir = "asc" | "desc";
type QuickRange = "3m" | "6m" | "12m" | "all";

interface Filters {
  query: string;
  supplierIds: Set<string>;
  monthFrom: string; // "" or YYYYMM
  monthTo: string;   // "" or YYYYMM
  quick: QuickRange;
}

const EMPTY_FILTERS: Filters = {
  query: "",
  supplierIds: new Set(),
  monthFrom: "",
  monthTo: "",
  quick: "all",
};

export default function PowerSupplyPage() {
  const { rows, loading, error, refresh } = usePowerSupply();

  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showSuppliers, setShowSuppliers] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const [supplierId, setSupplierId] = useState("");
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 8) + "01");
  const [energy, setEnergy] = useState("");
  const [powerCost, setPowerCost] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ---------- filter state ----------
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sortField, setSortField] = useState<SortField>("yyyymm");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const refreshSuppliers = React.useCallback(async () => {
    try {
      const list = await listActiveSuppliers();
      setSuppliers(list);
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listActiveSuppliers();
        if (!cancelled) setSuppliers(list);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const derivedRate = Number(energy) > 0 ? Number(powerCost) / Number(energy) : 0;

  function resetForm() {
    setSupplierId("");
    setEnergy("");
    setPowerCost("");
    setEditingId(null);
    setShowForm(false);
    setFormError(null);
  }

  function startEdit(row: PowerSupplyRow) {
    setEditingId(row.id);
    setSupplierId(row.supplier_id);
    setPeriod(row.period);
    setEnergy(String(row.energy));
    setPowerCost(String(row.power_cost));
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const entry = {
        supplier_id: supplierId,
        period,
        energy: Number(energy) || 0,
        power_cost: Number(powerCost) || 0,
      };
      if (editingId) await updatePowerSupply(editingId, entry);
      else await createPowerSupply(entry);
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

  // ---------- derived data ----------
  const filteredRows = useMemo(
    () => applyFilters(rows, filters),
    [rows, filters],
  );

  const sortedRows = useMemo(
    () => sortRows(filteredRows, sortField, sortDir),
    [filteredRows, sortField, sortDir],
  );

  const trend = useMemo(() => buildTrend(filteredRows), [filteredRows]);

  const availableYears = useMemo(() => {
    const set = new Set<number>();
    for (const r of rows) set.add(Number(r.yyyymm.slice(0, 4)));
    if (set.size === 0) set.add(new Date().getFullYear());
    return Array.from(set).sort((a, b) => b - a); // newest first
  }, [rows]);

  const totals = useMemo(() => {
    const energyTotal = filteredRows.reduce((s, r) => s + r.energy, 0);
    const costTotal = filteredRows.reduce((s, r) => s + r.power_cost, 0);
    return {
      energy: energyTotal,
      cost: costTotal,
      rate: energyTotal > 0 ? costTotal / energyTotal : 0,
      count: filteredRows.length,
    };
  }, [filteredRows]);

  const filtersActive =
    filters.query !== "" ||
    filters.supplierIds.size > 0 ||
    filters.monthFrom !== "" ||
    filters.monthTo !== "" ||
    filters.quick !== "all";

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "supplier_name" ? "asc" : "desc");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08091C] text-[#F5F0FF] flex items-center justify-center">
        <p className="font-mono text-sm tracking-wide text-[#9CA3D9]">Loading power supply data…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#08091C] text-[#F5F0FF] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="font-mono text-sm text-[#FF4D6D] mb-4">Couldn&apos;t load power supply: {error}</p>
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
        <header className="mb-8 border-b border-[#2C3168] pb-6 flex justify-between items-start">
          <div>
            <Link
              href="/"
              className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] hover:text-[#F5F0FF] inline-block mb-4"
            >
              ← Dashboard
            </Link>
            <p className="font-mono text-xs tracking-[0.2em] text-[#9CA3D9] uppercase mb-2">Cooperative Report</p>
            <h1 className="text-3xl font-semibold tracking-tight">Power Supply</h1>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2">
              <button
                onClick={() => setShowSuppliers((v) => !v)}
                className={`font-mono text-xs uppercase tracking-wide border rounded px-3 py-1.5 transition-colors ${
                  showSuppliers
                    ? "bg-[#F5F0FF] text-[#08091C] border-[#F5F0FF]"
                    : "text-[#9CA3D9] hover:text-[#F5F0FF] border-[#2C3168]"
                }`}
              >
                Manage Suppliers
              </button>
              <button
                onClick={() => (showForm ? resetForm() : setShowForm(true))}
                className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] hover:text-[#F5F0FF] border border-[#2C3168] rounded px-3 py-1.5"
              >
                {showForm ? "Cancel" : "+ Add Entry"}
              </button>
            </div>
            <CsvIO rows={rows} schema={powerSupplyCsvSchema(refresh)} onAfterImport={refresh} />
          </div>
        </header>

        {showSuppliers && (
          <SupplierManager
            onChanged={refreshSuppliers}
            onClose={() => setShowSuppliers(false)}
          />
        )}

        {/* ---------- FILTER BAR ---------- */}
        <FilterBar
          filters={filters}
          setFilters={setFilters}
          suppliers={suppliers}
          totals={totals}
          filtersActive={filtersActive}
          availableYears={availableYears}
        />

        <Modal
          open={showForm}
          onClose={resetForm}
          title={editingId ? "Edit Entry" : "Add Entry"}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] block mb-1">Month (YYYYMM)</label>
                <input
                  type="date"
                  required
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="w-full bg-[#171A38] border border-[#2C3168] rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] block mb-1">Supplier Name</label>
                <select
                  required
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full bg-[#171A38] border border-[#2C3168] rounded px-3 py-2 text-sm"
                >
                  <option value="">Select supplier…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.code ? ` (${s.code})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] block mb-1">Energy (kWh)</label>
                <input
                  type="number"
                  required
                  min={0}
                  step="any"
                  value={energy}
                  onChange={(e) => setEnergy(e.target.value)}
                  className="w-full bg-[#171A38] border border-[#2C3168] rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] block mb-1">Power Cost (₱)</label>
                <input
                  type="number"
                  required
                  min={0}
                  step="any"
                  value={powerCost}
                  onChange={(e) => setPowerCost(e.target.value)}
                  className="w-full bg-[#171A38] border border-[#2C3168] rounded px-3 py-2 text-sm"
                />
              </div>
            </div>
            <p className="font-mono text-xs text-[#6C74A8]">
              Rate (derived): <span className="text-[#F5F0FF]">{Number(energy) > 0 ? formatRate(derivedRate) : "—"}</span> / kWh
            </p>
            {formError && <p className="font-mono text-xs text-[#FF4D6D]">{formError}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="bg-[#F5F0FF] text-[#08091C] font-medium text-sm px-4 py-2 rounded hover:bg-white transition-colors disabled:opacity-50"
            >
              {submitting ? "Saving…" : editingId ? "Update Entry" : "Add Entry"}
            </button>
          </form>
        </Modal>

        {/* Energy chart */}
        <div className="border border-[#2C3168] rounded-lg p-6 mb-6">
          <p className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] mb-4">Energy (kWh) · Filtered</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2C3168" />
              <XAxis dataKey="yyyymm" stroke="#9CA3D9" fontSize={12} fontFamily="monospace" />
              <YAxis stroke="#9CA3D9" fontSize={12} fontFamily="monospace" tickFormatter={(v) => formatNumber(v)} />
              <Tooltip
                contentStyle={chartTooltipStyle}
                labelFormatter={(label) => formatYYYYMM(String(label))}
                formatter={(value: unknown) => [formatNumber(Number(value)), "Energy"]}
              />
              <Legend wrapperStyle={{ fontFamily: "monospace", fontSize: 12 }} />
              <Line type="monotone" dataKey="totalEnergy" name="Energy (kWh)" stroke="#9CA3D9" strokeWidth={2} dot={{ fill: "#9CA3D9", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Rate chart */}
        <div className="border border-[#2C3168] rounded-lg p-6 mb-10">
          <p className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] mb-4">Weighted Rate (₱ / kWh) · Filtered</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2C3168" />
              <XAxis dataKey="yyyymm" stroke="#9CA3D9" fontSize={12} fontFamily="monospace" />
              <YAxis stroke="#9CA3D9" fontSize={12} fontFamily="monospace" tickFormatter={(v) => `₱${Number(v).toFixed(2)}`} />
              <Tooltip
                contentStyle={chartTooltipStyle}
                labelFormatter={(label) => formatYYYYMM(String(label))}
                formatter={(value: unknown) => [formatRate(Number(value)), "Rate"]}
              />
              <Legend wrapperStyle={{ fontFamily: "monospace", fontSize: 12 }} />
              <Line type="monotone" dataKey="weightedRate" name="Rate (₱/kWh)" stroke="#22F0B0" strokeWidth={2} dot={{ fill: "#22F0B0", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Detail table — exactly the five fields */}
        <div>
          <div className="flex justify-between items-baseline mb-3">
            <p className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9]">
              Detail · {totals.count} {totals.count === 1 ? "row" : "rows"}
            </p>
            <p className="font-mono text-xs text-[#6C74A8]">
              Σ {formatNumber(totals.energy)} kWh · {formatCurrency(totals.cost)} · avg {formatRate(totals.rate)}
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2C3168] font-mono text-xs uppercase tracking-wide text-[#9CA3D9]">
                <SortableTh label="YYYYMM"        field="yyyymm"        sortField={sortField} sortDir={sortDir} onClick={toggleSort} align="left" />
                <SortableTh label="Supplier Name" field="supplier_name" sortField={sortField} sortDir={sortDir} onClick={toggleSort} align="left" />
                <SortableTh label="Energy (kWh)"  field="energy"        sortField={sortField} sortDir={sortDir} onClick={toggleSort} align="right" />
                <SortableTh label="Power Cost"    field="power_cost"    sortField={sortField} sortDir={sortDir} onClick={toggleSort} align="right" />
                <SortableTh label="Rate (₱/kWh)"  field="rate"          sortField={sortField} sortDir={sortDir} onClick={toggleSort} align="right" />
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center font-mono text-xs text-[#6C74A8]">
                    No entries match the current filters.
                  </td>
                </tr>
              ) : (
                sortedRows.map((r) => (
                  <tr key={r.id} className="border-b border-[#1F2450] hover:bg-[#0F1230] transition-colors">
                    <td className="py-2.5 font-mono text-[#6C74A8]">{r.yyyymm}</td>
                    <td className="py-2.5">{r.supplier_name}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums">{formatNumber(r.energy)}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums">{formatCurrency(r.power_cost)}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums">{formatRate(r.rate)}</td>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==================================================================
//  Filter bar
// ==================================================================
interface FilterBarProps {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  suppliers: SupplierOption[];
  totals: { energy: number; cost: number; rate: number; count: number };
  filtersActive: boolean;
  availableYears: number[];
}

function FilterBar({
  filters,
  setFilters,
  suppliers,
  totals,
  filtersActive,
  availableYears,
}: FilterBarProps) {
  const quickRanges: Array<{ id: QuickRange; label: string }> = [
    { id: "3m",  label: "3M" },
    { id: "6m",  label: "6M" },
    { id: "12m", label: "12M" },
    { id: "all", label: "All" },
  ];

  function toggleSupplier(id: string) {
    setFilters((f) => {
      const next = new Set(f.supplierIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...f, supplierIds: next };
    });
  }

  return (
    <section className="mb-8 border border-[#2C3168] rounded-lg bg-[#0F1230]">
      <div className="p-4 space-y-4">
        {/* Row 1: search + quick range + reset */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6C74A8] text-xs">⌕</span>
            <input
              type="text"
              placeholder="Search supplier or YYYYMM…"
              value={filters.query}
              onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
              className="w-full bg-[#171A38] border border-[#2C3168] rounded-md pl-8 pr-3 py-2 text-sm placeholder-[#454A80] focus:outline-none focus:border-[#4A4F9C]"
            />
          </div>

          <div className="flex bg-[#171A38] border border-[#2C3168] rounded-md p-0.5">
            {quickRanges.map((r) => {
              const active = filters.quick === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setFilters((f) => ({ ...f, quick: r.id, monthFrom: "", monthTo: "" }))}
                  className={`px-3 py-1 font-mono text-xs uppercase tracking-wide rounded transition-colors ${
                    active
                      ? "bg-[#F5F0FF] text-[#08091C]"
                      : "text-[#9CA3D9] hover:text-[#F5F0FF]"
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>

          {filtersActive && (
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="font-mono text-xs uppercase tracking-wide text-[#FF4D6D] hover:text-[#F5F0FF] px-2"
            >
              Clear
            </button>
          )}
        </div>

        {/* Row 2: month range (overrides quick range) */}
        <div className="flex flex-wrap gap-3 items-center">
          <span className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9]">Month range</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            placeholder="From YYYYMM"
            value={filters.monthFrom}
            onChange={(e) => setFilters((f) => ({ ...f, monthFrom: e.target.value.replace(/\D/g, "").slice(0, 6), quick: "all" }))}
            className="w-28 bg-[#171A38] border border-[#2C3168] rounded-md px-3 py-1.5 text-sm font-mono placeholder-[#454A80] focus:outline-none focus:border-[#4A4F9C]"
          />
          <span className="font-mono text-xs text-[#6C74A8]">→</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            placeholder="To YYYYMM"
            value={filters.monthTo}
            onChange={(e) => setFilters((f) => ({ ...f, monthTo: e.target.value.replace(/\D/g, "").slice(0, 6), quick: "all" }))}
            className="w-28 bg-[#171A38] border border-[#2C3168] rounded-md px-3 py-1.5 text-sm font-mono placeholder-[#454A80] focus:outline-none focus:border-[#4A4F9C]"
          />
          <span className="ml-auto font-mono text-xs text-[#6C74A8]">
            {totals.count} rows · Σ {formatNumber(totals.energy)} kWh
          </span>
        </div>

        {/* Row 2.5: Year + quarterly quick-select */}
        <QuarterRow
          years={availableYears}
          filters={filters}
          setFilters={setFilters}
        />

        {/* Row 3: supplier chips — scales gracefully past a handful of suppliers */}
        {suppliers.length > 0 && (
          <SupplierChipRow
            suppliers={suppliers}
            selected={filters.supplierIds}
            onToggle={toggleSupplier}
            onSelectAll={() =>
              setFilters((f) => ({ ...f, supplierIds: new Set(suppliers.map((s) => s.id)) }))
            }
            onClear={() =>
              setFilters((f) => ({ ...f, supplierIds: new Set() }))
            }
          />
        )}
      </div>
    </section>
  );
}

// ==================================================================
//  Sortable column header
// ==================================================================
interface SortableThProps {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
  onClick: (f: SortField) => void;
  align: "left" | "right";
}

function SortableTh({ label, field, sortField, sortDir, onClick, align }: SortableThProps) {
  const active = sortField === field;
  return (
    <th className={`py-2 font-normal ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        onClick={() => onClick(field)}
        className={`inline-flex items-center gap-1 hover:text-[#F5F0FF] transition-colors ${
          active ? "text-[#F5F0FF]" : ""
        }`}
      >
        <span>{label}</span>
        <span className="text-[10px]">{active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}

// ==================================================================
//  Pure filter/sort helpers
// ==================================================================
function applyFilters(rows: PowerSupplyRow[], f: Filters): PowerSupplyRow[] {
  let out = rows;

  // Text search: supplier name (case-insensitive) or YYYYMM prefix
  const q = f.query.trim().toLowerCase();
  if (q) {
    out = out.filter(
      (r) =>
        r.supplier_name.toLowerCase().includes(q) ||
        r.yyyymm.startsWith(q.replace(/\D/g, "")),
    );
  }

  // Supplier multi-select
  if (f.supplierIds.size > 0) {
    out = out.filter((r) => f.supplierIds.has(r.supplier_id));
  }

  // Explicit month range wins over quick range
  if (f.monthFrom || f.monthTo) {
    if (f.monthFrom) out = out.filter((r) => r.yyyymm >= f.monthFrom);
    if (f.monthTo)   out = out.filter((r) => r.yyyymm <= f.monthTo);
  } else if (f.quick !== "all" && rows.length > 0) {
    // Quick range: N months ending at the newest row's month
    const monthsBack = f.quick === "3m" ? 3 : f.quick === "6m" ? 6 : 12;
    const newest = rows.reduce((max, r) => (r.yyyymm > max ? r.yyyymm : max), rows[0].yyyymm);
    const cutoff = subtractMonths(newest, monthsBack - 1);
    out = out.filter((r) => r.yyyymm >= cutoff);
  }

  return out;
}

function sortRows(rows: PowerSupplyRow[], field: SortField, dir: SortDir): PowerSupplyRow[] {
  const mul = dir === "asc" ? 1 : -1;
  const copy = [...rows];
  copy.sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * mul;
    return String(av).localeCompare(String(bv)) * mul;
  });
  return copy;
}

interface TrendPoint {
  yyyymm: string;
  totalEnergy: number;
  totalCost: number;
  weightedRate: number;
}
function buildTrend(rows: PowerSupplyRow[]): TrendPoint[] {
  const buckets = new Map<string, TrendPoint>();
  for (const r of rows) {
    const b = buckets.get(r.yyyymm) ?? { yyyymm: r.yyyymm, totalEnergy: 0, totalCost: 0, weightedRate: 0 };
    b.totalEnergy += r.energy;
    b.totalCost += r.power_cost;
    buckets.set(r.yyyymm, b);
  }
  return Array.from(buckets.values())
    .map((b) => ({
      ...b,
      weightedRate: b.totalEnergy > 0 ? Number((b.totalCost / b.totalEnergy).toFixed(4)) : 0,
    }))
    .sort((a, b) => a.yyyymm.localeCompare(b.yyyymm));
}

function subtractMonths(yyyymm: string, months: number): string {
  const y = Number(yyyymm.slice(0, 4));
  const m = Number(yyyymm.slice(4, 6));
  const d = new Date(Date.UTC(y, m - 1 - months, 1));
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// ==================================================================
//  Supplier manager (drawer under the header)
// ==================================================================
interface SupplierManagerProps {
  onChanged: () => void | Promise<void>;
  onClose: () => void;
}

const SUPPLIER_TYPES: Array<{ value: SupplierType; label: string }> = [
  { value: "bilateral",    label: "Bilateral (PSA)" },
  { value: "wesm",         label: "WESM" },
  { value: "net_metering", label: "Net Metering" },
];

function SupplierManager({ onChanged, onClose }: SupplierManagerProps) {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [branchId, setBranchId] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<SupplierType>("bilateral");
  const [active, setActive] = useState(true);
  const [sortOrder, setSortOrder] = useState<string>("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [s, b] = await Promise.all([listAllSuppliers(), listBranches()]);
      setRows(s);
      setBranches(b);
      if (!branchId && b.length > 0) setBranchId(b[0].id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, b] = await Promise.all([listAllSuppliers(), listBranches()]);
        if (!cancelled) {
          setRows(s);
          setBranches(b);
          if (b.length > 0) setBranchId(b[0].id);
          setErr(null);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load suppliers");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function resetForm() {
    setEditingId(null);
    setName("");
    setCode("");
    setType("bilateral");
    setActive(true);
    setSortOrder("");
    if (branches.length > 0) setBranchId(branches[0].id);
    setShowForm(false);
  }

  function startEdit(s: Supplier) {
    setEditingId(s.id);
    setBranchId(s.branch_id);
    setName(s.name);
    setCode(s.code ?? "");
    setType(s.supplier_type);
    setActive(s.active);
    setSortOrder(s.sort_order == null ? "" : String(s.sort_order));
    setShowForm(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const payload = {
        branch_id: branchId,
        name: name.trim(),
        code: code.trim() ? code.trim() : null,
        supplier_type: type,
        active,
        sort_order: sortOrder.trim() ? Number(sortOrder) : null,
      };
      if (editingId) await updateSupplier(editingId, payload);
      else await createSupplier(payload);
      resetForm();
      await load();
      await onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save supplier");
    }
  }

  async function toggleActive(s: Supplier) {
    try {
      await updateSupplier(s.id, { active: !s.active });
      await load();
      await onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to update supplier");
    }
  }

  async function remove(id: string) {
    try {
      await deleteSupplier(id);
      await load();
      await onChanged();
    } catch (e) {
      // Most likely a FK violation — recommend deactivating instead.
      setErr(
        (e instanceof Error ? e.message : "Failed to delete supplier") +
          " · Tip: deactivate it instead so historical entries stay linked.",
      );
    } finally {
      setConfirmingId(null);
    }
  }

  return (
    <section className="mb-8 border border-[#2C3168] rounded-lg bg-[#0F1230]">
      <div className="flex justify-between items-center px-5 py-3 border-b border-[#2C3168]">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#9CA3D9]">
          Manage Suppliers · {rows.length} total
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
            className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] hover:text-[#F5F0FF] border border-[#2C3168] rounded px-3 py-1"
          >
            {showForm ? "Cancel" : editingId ? "Cancel edit" : "+ New Supplier"}
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
        title={editingId ? "Edit Supplier" : "New Supplier"}
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] block mb-1">Supplier Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#171A38] border border-[#2C3168] rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] block mb-1">Code (optional)</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. IPP-3"
                className="w-full bg-[#171A38] border border-[#2C3168] rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] block mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as SupplierType)}
                className="w-full bg-[#171A38] border border-[#2C3168] rounded px-3 py-2 text-sm"
              >
                {SUPPLIER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
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
            <div>
              <label className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] block mb-1">Sort Order</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                placeholder="e.g. 40"
                className="w-full bg-[#171A38] border border-[#2C3168] rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wide text-[#9CA3D9]">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="accent-[#F5F0FF]"
                />
                Active
              </label>
            </div>
          </div>
          <button
            type="submit"
            className="bg-[#F5F0FF] text-[#08091C] font-medium text-sm px-4 py-2 rounded hover:bg-white transition-colors"
          >
            {editingId ? "Update Supplier" : "Add Supplier"}
          </button>
        </form>
      </Modal>

      <div className="p-5">
        {loading ? (
          <p className="font-mono text-xs text-[#6C74A8]">Loading suppliers…</p>
        ) : rows.length === 0 ? (
          <p className="font-mono text-xs text-[#6C74A8]">No suppliers yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2C3168] font-mono text-xs uppercase tracking-wide text-[#9CA3D9]">
                <th className="text-left  py-2 font-normal">Name</th>
                <th className="text-left  py-2 font-normal">Code</th>
                <th className="text-left  py-2 font-normal">Type</th>
                <th className="text-right py-2 font-normal">Sort</th>
                <th className="text-center py-2 font-normal">Active</th>
                <th className="w-32"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className={`border-b border-[#1F2450] ${s.active ? "" : "opacity-60"}`}>
                  <td className="py-2.5">{s.name}</td>
                  <td className="py-2.5 font-mono text-[#6C74A8]">{s.code ?? "—"}</td>
                  <td className="py-2.5 font-mono text-xs text-[#9CA3D9]">{s.supplier_type}</td>
                  <td className="py-2.5 text-right font-mono tabular-nums">{s.sort_order ?? "—"}</td>
                  <td className="py-2.5 text-center">
                    <button
                      onClick={() => toggleActive(s)}
                      className={`inline-flex items-center gap-1 font-mono text-xs px-2 py-0.5 rounded-full border transition-colors ${
                        s.active
                          ? "bg-[#22F0B022] text-[#22F0B0] border-[#22F0B055]"
                          : "bg-[#2C3168] text-[#9CA3D9] border-[#4A4F9C] hover:text-[#F5F0FF]"
                      }`}
                    >
                      {s.active ? "● Active" : "○ Inactive"}
                    </button>
                  </td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => startEdit(s)}
                      className="font-mono text-xs text-[#9CA3D9] hover:text-[#F5F0FF] mr-3"
                    >
                      Edit
                    </button>
                    {confirmingId === s.id ? (
                      <>
                        <button onClick={() => remove(s.id)} className="font-mono text-xs text-[#FF4D6D] mr-2">Confirm</button>
                        <button onClick={() => setConfirmingId(null)} className="font-mono text-xs text-[#9CA3D9]">Cancel</button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmingId(s.id)}
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
        )}
      </div>
    </section>
  );
}

//  Supplier chip row — handles small AND large supplier lists gracefully.
//  * ≤ 6 suppliers: show them all inline (same as before).
//  * > 6 suppliers: show a search box, and cap the visible chips with
//    a "+N more" toggle. Selected chips always appear first so the
//    active filter stays visible when the list is collapsed.
// ==================================================================
interface SupplierChipRowProps {
  suppliers: SupplierOption[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}

function SupplierChipRow({ suppliers, selected, onToggle, onSelectAll, onClear }: SupplierChipRowProps) {
  const INLINE_LIMIT = 6;
  const isLarge = suppliers.length > INLINE_LIMIT;

  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  // Selected suppliers first, then the rest — so the active filter is
  // always visible even when the list is collapsed or filtered.
  const ordered = useMemo(() => {
    const sel: SupplierOption[] = [];
    const rest: SupplierOption[] = [];
    for (const s of suppliers) (selected.has(s.id) ? sel : rest).push(s);
    return [...sel, ...rest];
  }, [suppliers, selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter((s) => s.name.toLowerCase().includes(q));
  }, [ordered, query]);

  const visible = isLarge && !expanded ? filtered.slice(0, INLINE_LIMIT) : filtered;
  const hiddenCount = filtered.length - visible.length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3 items-center">
        <span className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] mr-1">
          Suppliers · {selected.size}/{suppliers.length}
        </span>

        <div className="flex gap-2">
          <button
            onClick={onSelectAll}
            className="font-mono text-[10px] uppercase tracking-wide text-[#9CA3D9] hover:text-[#F5F0FF] border border-[#2C3168] rounded px-2 py-0.5"
          >
            All
          </button>
          <button
            onClick={onClear}
            className="font-mono text-[10px] uppercase tracking-wide text-[#9CA3D9] hover:text-[#F5F0FF] border border-[#2C3168] rounded px-2 py-0.5"
          >
            None
          </button>
        </div>

        {isLarge && (
          <div className="relative ml-auto w-56">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6C74A8] text-xs">⌕</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter suppliers…"
              className="w-full bg-[#171A38] border border-[#2C3168] rounded-md pl-7 pr-2 py-1 text-xs font-mono placeholder-[#454A80] focus:outline-none focus:border-[#4A4F9C]"
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {visible.length === 0 ? (
          <span className="font-mono text-xs text-[#6C74A8]">No suppliers match.</span>
        ) : (
          visible.map((s) => {
            const active = selected.has(s.id);
            return (
              <button
                key={s.id}
                onClick={() => onToggle(s.id)}
                title={s.name}
                className={`max-w-[220px] truncate px-2.5 py-1 rounded-full text-xs font-mono border transition-colors ${
                  active
                    ? "bg-[#F5F0FF] text-[#08091C] border-[#F5F0FF]"
                    : "bg-transparent text-[#9CA3D9] border-[#2C3168] hover:border-[#4A4F9C] hover:text-[#F5F0FF]"
                }`}
              >
                {s.name}
              </button>
            );
          })
        )}

        {isLarge && hiddenCount > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="px-2.5 py-1 rounded-full text-xs font-mono border border-dashed border-[#4A4F9C] text-[#9CA3D9] hover:text-[#F5F0FF] hover:border-[#F5F0FF] transition-colors"
          >
            +{hiddenCount} more
          </button>
        )}
        {isLarge && expanded && (
          <button
            onClick={() => setExpanded(false)}
            className="px-2.5 py-1 rounded-full text-xs font-mono border border-dashed border-[#4A4F9C] text-[#9CA3D9] hover:text-[#F5F0FF] hover:border-[#F5F0FF] transition-colors"
          >
            Show less
          </button>
        )}
      </div>
    </div>
  );
}

// ==================================================================
//  Quarter row — Year picker + Q1..Q4 chips
//  Clicking a quarter chip sets monthFrom / monthTo to that quarter's
//  YYYYMM window (and resets the quick-range to "all", since explicit
//  ranges take precedence).
// ==================================================================
interface QuarterRowProps {
  years: number[];
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
}

const QUARTERS: Array<{ id: 1 | 2 | 3 | 4; label: string; start: string; end: string }> = [
  { id: 1, label: "Q1", start: "01", end: "03" },
  { id: 2, label: "Q2", start: "04", end: "06" },
  { id: 3, label: "Q3", start: "07", end: "09" },
  { id: 4, label: "Q4", start: "10", end: "12" },
];

function QuarterRow({ years, filters, setFilters }: QuarterRowProps) {
  // Default the year picker to the most recent year (years[] is newest first).
  const defaultYear = years[0] ?? new Date().getFullYear();
  const [year, setYear] = useState<number>(defaultYear);

  // Which quarter is currently reflected by monthFrom/monthTo?
  const activeQuarter: 1 | 2 | 3 | 4 | null = useMemo(() => {
    const from = filters.monthFrom;
    const to = filters.monthTo;
    if (!from || !to || from.length !== 6 || to.length !== 6) return null;
    if (from.slice(0, 4) !== to.slice(0, 4)) return null;
    for (const q of QUARTERS) {
      if (from.slice(0, 4) === String(year) && from.slice(4) === q.start && to.slice(4) === q.end) {
        return q.id;
      }
    }
    return null;
  }, [filters.monthFrom, filters.monthTo, year]);

  function applyQuarter(q: (typeof QUARTERS)[number]) {
    if (activeQuarter === q.id) {
      // Click again to clear this quarter selection.
      setFilters((f) => ({ ...f, monthFrom: "", monthTo: "", quick: "all" }));
      return;
    }
    const from = `${year}${q.start}`;
    const to = `${year}${q.end}`;
    setFilters((f) => ({ ...f, monthFrom: from, monthTo: to, quick: "all" }));
  }

  const yearIdx = years.indexOf(year);
  const canPrev = yearIdx >= 0 && yearIdx < years.length - 1;
  const canNext = yearIdx > 0;

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <span className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9]">Quarter</span>

      <div className="flex items-center bg-[#171A38] border border-[#2C3168] rounded-md">
        <button
          onClick={() => canPrev && setYear(years[yearIdx + 1])}
          disabled={!canPrev}
          className="px-2 py-1 font-mono text-xs text-[#9CA3D9] hover:text-[#F5F0FF] disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Previous year"
        >
          ‹
        </button>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="bg-transparent font-mono text-xs px-2 py-1 focus:outline-none"
          aria-label="Year"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <button
          onClick={() => canNext && setYear(years[yearIdx - 1])}
          disabled={!canNext}
          className="px-2 py-1 font-mono text-xs text-[#9CA3D9] hover:text-[#F5F0FF] disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next year"
        >
          ›
        </button>
      </div>

      <div className="flex bg-[#171A38] border border-[#2C3168] rounded-md p-0.5">
        {QUARTERS.map((q) => {
          const active = activeQuarter === q.id;
          return (
            <button
              key={q.id}
              onClick={() => applyQuarter(q)}
              title={`${q.label} ${year} — ${q.start}/${year} → ${q.end}/${year}`}
              className={`px-3 py-1 font-mono text-xs uppercase tracking-wide rounded transition-colors ${
                active
                  ? "bg-[#F5F0FF] text-[#08091C]"
                  : "text-[#9CA3D9] hover:text-[#F5F0FF]"
              }`}
            >
              {q.label}
            </button>
          );
        })}
      </div>

      {activeQuarter !== null && (
        <span className="font-mono text-xs text-[#6C74A8]">
          Q{activeQuarter} {year} · {`${year}${QUARTERS[activeQuarter - 1].start}`} → {`${year}${QUARTERS[activeQuarter - 1].end}`}
        </span>
      )}
    </div>
  );
}

// ==================================================================
//  CSV schema — power_supply
// ==================================================================
type PowerSupplyNew = {
  period: string;
  supplier_id: string;
  energy: number;
  power_cost: number;
};

function powerSupplyCsvSchema(_refresh: () => Promise<void>): CsvSchema<PowerSupplyRow, PowerSupplyNew> {
  return {
    filename: "power_supply.csv",
    headers: ["period", "supplier_id", "supplier_name", "energy_kwh", "power_cost_php", "rate_php_per_kwh"],
    serialize: (r) => [r.period, r.supplier_id, r.supplier_name, r.energy, r.power_cost, r.rate],
    templateRow: {
      period: "2026-07-01",
      supplier_id: "<uuid from power_suppliers>",
      supplier_name: "(ignored on import)",
      energy_kwh: "1000000",
      power_cost_php: "5850000",
      rate_php_per_kwh: "(derived; leave blank)",
    },
    parseRow: (rec) => {
      const period = (rec.period || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(period)) throw new Error("period must be YYYY-MM-DD");
      const supplier_id = (rec.supplier_id || "").trim();
      if (!supplier_id) throw new Error("supplier_id is required");
      const energy = Number(String(rec.energy_kwh || "").replace(/,/g, ""));
      const power_cost = Number(String(rec.power_cost_php || "").replace(/,/g, ""));
      if (!isFinite(energy) || energy < 0) throw new Error("energy_kwh must be a non-negative number");
      if (!isFinite(power_cost) || power_cost < 0) throw new Error("power_cost_php must be a non-negative number");
      return { period, supplier_id, energy, power_cost };
    },
    onImport: async (payload) => { await createPowerSupply(payload); },
  };
}
