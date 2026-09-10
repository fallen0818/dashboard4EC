import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import CsvIO, { CsvSchema } from "../components/CsvIO";
import {
  KpiTrendPoint,
  SupplierMixRow,
  OutageMatrixRow,
  CollectionAgingRow,
  YearCompareRow,
  getKpiTrend,
  getSupplierMix,
  getOutageMatrix,
  getCollectionAging,
  getYearCompare,
} from "../services/analyticsRepository";
import {
  BarChart,
  Bar,
} from "recharts";

// ---------- formatters ----------
function formatNumber(n: number): string {
  return n.toLocaleString("en-PH", { maximumFractionDigits: 0 });
}
function formatMonth(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
  });
}
function formatYYYYMM(iso: string): string {
  return iso.slice(0, 7).replace("-", "");
}

const chartTooltipStyle = {
  background: "#0F1230",
  border: "1px solid #2C3168",
  borderRadius: 6,
  fontFamily: "monospace",
  fontSize: 12,
};

// Palette for supplier series (cycled).
const SERIES_COLORS = ["#8B5CF6", "#22F0B0", "#4DA6FF", "#FFB84D", "#FF4D6D", "#9CA3D9", "#F5F0FF"];

type WindowChoice = 12 | 24 | 36;

export default function AnalyticsPage() {
  const [months, setMonths] = useState<WindowChoice>(24);
  const [compareYoy, setCompareYoy] = useState(false);
  const [kpi, setKpi] = useState<KpiTrendPoint[]>([]);
  const [mix, setMix] = useState<SupplierMixRow[]>([]);
  const [outages, setOutages] = useState<OutageMatrixRow[]>([]);
  const [aging, setAging] = useState<CollectionAgingRow[]>([]);
  const nowYear = new Date().getFullYear();
  const [yearA, setYearA] = useState(nowYear - 1);
  const [yearB, setYearB] = useState(nowYear);
  const [compareKpi, setCompareKpi] = useState<CompareKpi>("systemLossPercent");
  const [compareRows, setCompareRows] = useState<YearCompareRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Year compare loads on its own so changing months doesn't touch it
  // and vice versa.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await getYearCompare(yearA, yearB);
        if (!cancelled) setCompareRows(rows);
      } catch {
        /* non-fatal — the section shows an empty-state on failure */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [yearA, yearB]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const trend = await getKpiTrend(months);
        if (cancelled) return;
        setKpi(trend);
        // Supplier mix over the same window as the KPI trend.
        const from = trend[0]?.month ?? new Date().toISOString().slice(0, 10);
        const to = addMonths(trend[trend.length - 1]?.month ?? from, 1);
        const [rows, matrix, agingRows] = await Promise.all([
          getSupplierMix(from, to),
          getOutageMatrix(from, to),
          getCollectionAging(from, to),
        ]);
        if (!cancelled) {
          setMix(rows);
          setOutages(matrix);
          setAging(agingRows);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [months]);

  // ---------- derive data-freshness label ----------
  const lastMonthWithData = useMemo(() => {
    const nonEmpty = kpi.filter(
      (p) => p.totalKwhPurchased || p.totalBilled || p.totalConsumers || p.outageCount || p.genMixRate,
    );
    return nonEmpty.length ? nonEmpty[nonEmpty.length - 1].month : null;
  }, [kpi]);

  // ---------- pivot supplier mix into { month, [name]: kwh } ----------
  const supplierNames = useMemo(() => {
    const seen = new Set<string>();
    for (const r of mix) seen.add(r.supplierName);
    return Array.from(seen);
  }, [mix]);

  const stacked = useMemo(() => {
    type Point = { month: string } & Record<string, number | string>;
    const byMonth = new Map<string, Point>();
    for (const r of mix) {
      const p = byMonth.get(r.month) ?? ({ month: r.month } as Point);
      p[r.supplierName] = ((p[r.supplierName] as number) ?? 0) + r.energy;
      byMonth.set(r.month, p);
    }
    // Fill any missing supplier keys with 0 so the area chart draws smoothly.
    return Array.from(byMonth.values())
      .map((p) => {
        for (const name of supplierNames) if (p[name] === undefined) p[name] = 0;
        return p;
      })
      .sort((a, b) => String(a.month).localeCompare(String(b.month)));
  }, [mix, supplierNames]);

  // ---------- totals for the mix section ----------
  const mixTotals = useMemo(() => {
    const energy = mix.reduce((s, r) => s + r.energy, 0);
    const cost = mix.reduce((s, r) => s + r.cost, 0);
    return {
      energy,
      cost,
      rate: energy > 0 ? cost / energy : 0,
      suppliers: supplierNames.length,
    };
  }, [mix, supplierNames]);

  if (loading && kpi.length === 0) {
    return (
      <div className="min-h-screen bg-[#08091C] text-[#F5F0FF] flex items-center justify-center">
        <p className="font-mono text-sm text-[#9CA3D9]">Loading analytics…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#08091C] text-[#F5F0FF] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="font-mono text-sm text-[#FF4D6D] mb-4">Couldn&apos;t load analytics: {error}</p>
          <Link
            href="/"
            className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] hover:text-[#F5F0FF] border border-[#2C3168] rounded px-3 py-1.5"
          >
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08091C] text-[#F5F0FF]">
      <div className="max-w-5xl mx-auto px-6 py-14">
        <header className="mb-8 border-b border-[#2C3168] pb-6 flex justify-between items-start">
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
            <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
            {lastMonthWithData && (
              <p className="font-mono text-xs text-[#6C74A8] mt-2">
                Data through {formatMonth(lastMonthWithData)}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2">
              {/* YoY compare toggle */}
              <button
                onClick={() => setCompareYoy((v) => !v)}
                title="Overlay values from the same month one year earlier"
                className={`font-mono text-xs uppercase tracking-wide border rounded px-3 py-1 transition-colors ${
                  compareYoy
                    ? "bg-[#F5F0FF] text-[#08091C] border-[#F5F0FF]"
                    : "text-[#9CA3D9] hover:text-[#F5F0FF] border-[#2C3168]"
                }`}
              >
                Compare YoY
              </button>

              {/* Time window picker */}
              <div className="flex bg-[#171A38] border border-[#2C3168] rounded-md p-0.5">
                {([12, 24, 36] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMonths(m)}
                    className={`px-3 py-1 font-mono text-xs uppercase tracking-wide rounded transition-colors ${
                      months === m ? "bg-[#F5F0FF] text-[#08091C]" : "text-[#9CA3D9] hover:text-[#F5F0FF]"
                    }`}
                  >
                    {m}M
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        {/* ---------------- KPI trend ---------------- */}
        <section className="mb-10">
          <div className="flex justify-between items-baseline mb-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#9CA3D9]">KPI Trend</p>
              <p className="font-mono text-xs text-[#6C74A8] mt-1">Last {months} months</p>
            </div>
            <CsvIO rows={kpi} schema={kpiCsvSchema()} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MiniChart
              title="System Loss %"
              data={kpi}
              dataKey="systemLossPercent"
              prevKey="prevSystemLossPercent"
              compareYoy={compareYoy}
              color="#FF4D6D"
              formatter={(v) => `${v.toFixed(2)}%`}
              targetLine={13}
              targetLabel="≤13% (NEA cap)"
            />
            <MiniChart
              title="Collection Efficiency %"
              data={kpi}
              dataKey="collectionEfficiencyPercent"
              prevKey="prevCollectionEfficiencyPercent"
              compareYoy={compareYoy}
              color="#22F0B0"
              formatter={(v) => `${v.toFixed(2)}%`}
              targetLine={95}
              targetLabel="≥95% target"
            />
            <MiniChart
              title="Gen Mix ₱ / kWh"
              data={kpi}
              dataKey="genMixRate"
              prevKey="prevGenMixRate"
              compareYoy={compareYoy}
              color="#8B5CF6"
              formatter={(v) => `₱${v.toFixed(4)}`}
            />
            <MiniChart
              title="Consumers"
              data={kpi}
              dataKey="totalConsumers"
              prevKey="prevTotalConsumers"
              compareYoy={compareYoy}
              color="#4DA6FF"
              formatter={(v) => formatNumber(v)}
            />
          </div>
        </section>

        {/* ---------------- Supplier mix ---------------- */}
        <section className="mb-10">
          <div className="flex justify-between items-baseline mb-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#9CA3D9]">Supplier Mix</p>
              <p className="font-mono text-xs text-[#6C74A8] mt-1">
                {mixTotals.suppliers} suppliers · Σ {formatNumber(mixTotals.energy)} kWh · avg ₱{mixTotals.rate.toFixed(4)}/kWh
              </p>
            </div>
            <CsvIO rows={mix} schema={supplierMixCsvSchema()} />
          </div>

          {stacked.length === 0 ? (
            <EmptyState message="No supplier data in this window yet." />
          ) : (
            <div className="border border-[#2C3168] rounded-lg p-6 bg-[#0F1230]">
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={stacked} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2C3168" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={formatMonth}
                    stroke="#9CA3D9"
                    fontSize={12}
                    fontFamily="monospace"
                  />
                  <YAxis
                    stroke="#9CA3D9"
                    fontSize={12}
                    fontFamily="monospace"
                    tickFormatter={(v) => formatNumber(Number(v))}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    labelFormatter={(label) => formatMonth(String(label))}
                    formatter={(value: unknown, name: unknown) => [
                      `${formatNumber(Number(value))} kWh`,
                      String(name),
                    ]}
                  />
                  <Legend wrapperStyle={{ fontFamily: "monospace", fontSize: 12 }} />
                  {supplierNames.map((name, i) => (
                    <Area
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stackId="mix"
                      stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                      fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                      fillOpacity={0.5}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* ---------------- Outage severity heatmap ---------------- */}
        <section className="mb-10">
          <div className="flex justify-between items-baseline mb-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#9CA3D9]">Outage Severity</p>
              <p className="font-mono text-xs text-[#6C74A8] mt-1">
                Heatmap · consumer-minutes affected per month × cause
              </p>
            </div>
            <CsvIO rows={outages} schema={outageMatrixCsvSchema()} />
          </div>
          {outages.length === 0 ? (
            <EmptyState message="No outages in this window yet." />
          ) : (
            <OutageHeatmap rows={outages} />
          )}
        </section>

        {/* ---------------- Collection aging ---------------- */}
        <section className="mb-10">
          <div className="flex justify-between items-baseline mb-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#9CA3D9]">Collection Aging</p>
              <p className="font-mono text-xs text-[#6C74A8] mt-1">
                Billed · collected · overdue by month, plus open disconnection notices
              </p>
            </div>
            <CsvIO rows={aging} schema={collectionAgingCsvSchema()} />
          </div>
          {aging.length === 0 ? (
            <EmptyState message="No billing activity in this window yet." />
          ) : (
            <div className="border border-[#2C3168] rounded-lg p-6 bg-[#0F1230]">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={aging} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2C3168" />
                  <XAxis dataKey="month" tickFormatter={formatMonth} stroke="#9CA3D9" fontSize={12} fontFamily="monospace" />
                  <YAxis stroke="#9CA3D9" fontSize={12} fontFamily="monospace" tickFormatter={(v) => `₱${formatNumber(Number(v))}`} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    labelFormatter={(label) => formatMonth(String(label))}
                    formatter={(value: unknown, name: unknown) => [
                      `₱${formatNumber(Number(value))}`,
                      String(name),
                    ]}
                  />
                  <Legend wrapperStyle={{ fontFamily: "monospace", fontSize: 12 }} />
                  <Bar dataKey="billed"    name="Billed"    fill="#4DA6FF" />
                  <Bar dataKey="collected" name="Collected" fill="#22F0B0" />
                  <Bar dataKey="overdue"   name="Overdue"   fill="#FF4D6D" />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3 font-mono text-xs">
                <AgingBadge label="Paid"     value={aging.reduce((s, r) => s + r.billsPaid, 0)}     color="#22F0B0" />
                <AgingBadge label="Partial"  value={aging.reduce((s, r) => s + r.billsPartial, 0)}  color="#FFB84D" />
                <AgingBadge label="Unpaid"   value={aging.reduce((s, r) => s + r.billsUnpaid, 0)}   color="#9CA3D9" />
                <AgingBadge label="Overdue"  value={aging.reduce((s, r) => s + r.billsOverdue, 0)}  color="#FF4D6D" />
                <AgingBadge label="Open Notices" value={aging.reduce((s, r) => s + r.openNotices, 0)} color="#8B5CF6" />
              </div>
            </div>
          )}
        </section>

        {/* ---------------- Year vs Year compare ---------------- */}
        <section className="mb-10">
          <div className="flex justify-between items-baseline mb-4 flex-wrap gap-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#9CA3D9]">
                Year-over-Year · Month by Month
              </p>
              <p className="font-mono text-xs text-[#6C74A8] mt-1">
                {yearA} vs {yearB} · pick a KPI to compare
              </p>
            </div>
            <div className="flex items-center gap-2">
              <YearPicker year={yearA} onChange={setYearA} label="A" />
              <span className="font-mono text-xs text-[#6C74A8]">vs</span>
              <YearPicker year={yearB} onChange={setYearB} label="B" />
              <select
                value={compareKpi}
                onChange={(e) => setCompareKpi(e.target.value as CompareKpi)}
                className="bg-[#171A38] border border-[#2C3168] rounded-md px-3 py-1 font-mono text-xs text-[#F5F0FF] focus:outline-none focus:border-[#4A4F9C]"
              >
                {(Object.keys(COMPARE_KPI_META) as CompareKpi[]).map((k) => (
                  <option key={k} value={k}>{COMPARE_KPI_META[k].label}</option>
                ))}
              </select>
              <CsvIO rows={compareRows} schema={yearCompareCsvSchema(yearA, yearB)} />
            </div>
          </div>
          <YearCompareView
            rows={compareRows}
            yearA={yearA}
            yearB={yearB}
            kpi={compareKpi}
          />
        </section>
      </div>
    </div>
  );
}

// ==================================================================
//  Year vs Year compare — helpers, chart, and table
// ==================================================================
type CompareKpi =
  | "systemLossPercent"
  | "collectionEfficiencyPercent"
  | "genMixRate"
  | "totalConsumers"
  | "totalKwhPurchased"
  | "totalKwhSold";

const COMPARE_KPI_META: Record<CompareKpi, { label: string; color: string; format: (v: number) => string; higherIsBetter: boolean }> = {
  systemLossPercent:            { label: "System Loss %",           color: "#FF4D6D", format: (v) => `${v.toFixed(2)}%`, higherIsBetter: false },
  collectionEfficiencyPercent:  { label: "Collection Efficiency %", color: "#22F0B0", format: (v) => `${v.toFixed(2)}%`, higherIsBetter: true },
  genMixRate:                   { label: "Gen Mix ₱/kWh",           color: "#8B5CF6", format: (v) => `₱${v.toFixed(4)}`, higherIsBetter: false },
  totalConsumers:               { label: "Consumers",               color: "#4DA6FF", format: (v) => formatNumber(v),     higherIsBetter: true },
  totalKwhPurchased:            { label: "kWh Purchased",           color: "#FFB84D", format: (v) => formatNumber(v),     higherIsBetter: true },
  totalKwhSold:                 { label: "kWh Sold",                color: "#22F0B0", format: (v) => formatNumber(v),     higherIsBetter: true },
};

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function YearPicker({ year, onChange, label }: { year: number; onChange: (y: number) => void; label: string }) {
  const nowYear = new Date().getFullYear();
  const options: number[] = [];
  for (let y = nowYear + 1; y >= nowYear - 5; y--) options.push(y);
  return (
    <div className="flex items-center bg-[#171A38] border border-[#2C3168] rounded-md">
      <span className="font-mono text-[10px] uppercase tracking-wide text-[#6C74A8] pl-2">{label}</span>
      <select
        value={year}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-transparent font-mono text-xs px-2 py-1 focus:outline-none"
        aria-label={`Year ${label}`}
      >
        {options.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );
}

interface YearComparePoint {
  monthLabel: string;
  monthNum: number;
  a: number | null;
  b: number | null;
  delta: number | null;      // b - a
  pct: number | null;        // (b - a) / a * 100
}

function YearCompareView({
  rows,
  yearA,
  yearB,
  kpi,
}: {
  rows: YearCompareRow[];
  yearA: number;
  yearB: number;
  kpi: CompareKpi;
}) {
  const meta = COMPARE_KPI_META[kpi];

  const points: YearComparePoint[] = MONTH_LABELS.map((label, i) => {
    const m = i + 1;
    const a = rows.find((r) => r.year === yearA && r.month === m)?.[kpi] ?? null;
    const b = rows.find((r) => r.year === yearB && r.month === m)?.[kpi] ?? null;
    const aNum = typeof a === "number" ? a : null;
    const bNum = typeof b === "number" ? b : null;
    const delta = aNum !== null && bNum !== null ? bNum - aNum : null;
    const pct = aNum !== null && bNum !== null && aNum !== 0 ? ((bNum - aNum) / aNum) * 100 : null;
    return { monthLabel: label, monthNum: m, a: aNum, b: bNum, delta, pct };
  });

  const nonEmpty = points.filter((p) => p.a !== null || p.b !== null);
  if (nonEmpty.length === 0) {
    return <EmptyState message={`No ${meta.label.toLowerCase()} for ${yearA} or ${yearB} yet.`} />;
  }

  const chartData = points.map((p) => ({
    month: p.monthLabel,
    [`${yearA}`]: p.a,
    [`${yearB}`]: p.b,
  }));

  return (
    <div className="border border-[#2C3168] rounded-lg p-6 bg-[#0F1230]">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2C3168" />
          <XAxis dataKey="month" stroke="#9CA3D9" fontSize={12} fontFamily="monospace" />
          <YAxis stroke="#9CA3D9" fontSize={12} fontFamily="monospace" />
          <Tooltip
            contentStyle={chartTooltipStyle}
            formatter={(value: unknown, name: unknown) => [
              value === null || value === undefined ? "—" : meta.format(Number(value)),
              String(name),
            ]}
          />
          <Legend wrapperStyle={{ fontFamily: "monospace", fontSize: 12 }} />
          <Bar dataKey={`${yearA}`} fill="#4A4F9C" name={String(yearA)} />
          <Bar dataKey={`${yearB}`} fill={meta.color} name={String(yearB)} />
        </BarChart>
      </ResponsiveContainer>

      {/* Delta table */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full font-mono text-xs">
          <thead>
            <tr className="border-b border-[#2C3168] text-[#9CA3D9]">
              <th className="text-left  py-2 font-normal">Month</th>
              <th className="text-right py-2 font-normal">{yearA}</th>
              <th className="text-right py-2 font-normal">{yearB}</th>
              <th className="text-right py-2 font-normal">Δ</th>
              <th className="text-right py-2 font-normal">Δ %</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => {
              const good = p.delta !== null && (meta.higherIsBetter ? p.delta >= 0 : p.delta <= 0);
              const bad  = p.delta !== null && (meta.higherIsBetter ? p.delta < 0 : p.delta > 0);
              const deltaColor = good ? "#22F0B0" : bad ? "#FF4D6D" : "#6C74A8";
              return (
                <tr key={p.monthNum} className="border-b border-[#1F2450]">
                  <td className="py-1.5 text-[#F5F0FF]">{p.monthLabel}</td>
                  <td className="py-1.5 text-right tabular-nums text-[#9CA3D9]">
                    {p.a === null ? "—" : meta.format(p.a)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-[#F5F0FF]">
                    {p.b === null ? "—" : meta.format(p.b)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums" style={{ color: deltaColor }}>
                    {p.delta === null ? "—" : `${p.delta >= 0 ? "+" : ""}${meta.format(p.delta)}`}
                  </td>
                  <td className="py-1.5 text-right tabular-nums" style={{ color: deltaColor }}>
                    {p.pct === null ? "—" : `${p.pct >= 0 ? "+" : ""}${p.pct.toFixed(1)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="font-mono text-[10px] text-[#6C74A8] mt-3">
        Δ = {yearB} − {yearA}. {meta.higherIsBetter ? "Green when higher (better)." : "Green when lower (better)."}
      </p>
    </div>
  );
}

function yearCompareCsvSchema(yearA: number, yearB: number): CsvSchema<YearCompareRow, never> {
  return {
    filename: `analytics_year_compare_${yearA}_vs_${yearB}.csv`,
    headers: ["year", "month", "system_loss_percent", "collection_efficiency_percent", "gen_mix_rate", "total_consumers", "total_kwh_purchased", "total_kwh_sold"],
    serialize: (r) => [r.year, r.month, r.systemLossPercent, r.collectionEfficiencyPercent, r.genMixRate, r.totalConsumers, r.totalKwhPurchased, r.totalKwhSold],
    templateRow: {},
    parseRow: () => { throw new Error("analytics import is disabled"); },
  };
}

// ==================================================================
//  Small line-chart tile used for each KPI in the trend section
// ==================================================================
interface MiniChartProps {
  title: string;
  data: KpiTrendPoint[];
  dataKey: keyof KpiTrendPoint;
  prevKey?: keyof KpiTrendPoint;
  compareYoy?: boolean;
  color: string;
  formatter: (v: number) => string;
  targetLine?: number;
  targetLabel?: string;
}

function MiniChart({
  title,
  data,
  dataKey,
  prevKey,
  compareYoy,
  color,
  formatter,
  targetLine,
  targetLabel,
}: MiniChartProps) {
  const points = data.filter((d) => d[dataKey] !== null);
  const latest = points[points.length - 1]?.[dataKey] as number | undefined;

  return (
    <div className="border border-[#2C3168] rounded-lg p-5 bg-[#0F1230]">
      <div className="flex justify-between items-baseline mb-3">
        <p className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9]">{title}</p>
        <p className="font-mono text-lg tabular-nums" style={{ color }}>
          {latest !== undefined && latest !== null ? formatter(Number(latest)) : "—"}
        </p>
      </div>
      {points.length === 0 ? (
        <EmptyState message="No data yet." small />
      ) : (
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1F2450" />
            <XAxis dataKey="month" tickFormatter={formatMonth} stroke="#6C74A8" fontSize={10} fontFamily="monospace" />
            <YAxis stroke="#6C74A8" fontSize={10} fontFamily="monospace" />
            <Tooltip
              contentStyle={chartTooltipStyle}
              labelFormatter={(label) => formatMonth(String(label))}
              formatter={(value: unknown) => [
                value === null ? "—" : formatter(Number(value)),
                title,
              ]}
            />
            {targetLine !== undefined && (
              <Line
                type="monotone"
                dataKey={() => targetLine}
                stroke="#4A4F9C"
                strokeDasharray="4 4"
                dot={false}
                name={targetLabel ?? "target"}
              />
            )}
            {compareYoy && prevKey && (
              <Line
                type="monotone"
                dataKey={prevKey as string}
                stroke={color}
                strokeOpacity={0.55}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                connectNulls
                name={`${title} (prev yr)`}
              />
            )}
            <Line
              type="monotone"
              dataKey={dataKey as string}
              stroke={color}
              strokeWidth={2}
              dot={{ fill: color, r: 3 }}
              connectNulls
              name={title}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ==================================================================
//  Empty-state placeholder
// ==================================================================
function EmptyState({ message, small = false }: { message: string; small?: boolean }) {
  return (
    <div
      className={`border border-dashed border-[#2C3168] rounded-lg flex items-center justify-center bg-[#0F1230] ${
        small ? "py-8" : "py-20"
      }`}
    >
      <p className="font-mono text-xs text-[#6C74A8]">{message}</p>
    </div>
  );
}

// ==================================================================
//  CSV schemas (export-only for analytics — read-only page)
// ==================================================================
function kpiCsvSchema(): CsvSchema<KpiTrendPoint, never> {
  return {
    filename: "analytics_kpi_trend.csv",
    headers: [
      "month", "yyyymm",
      "kwh_purchased", "kwh_sold", "system_loss_percent",
      "billed", "collected", "collection_efficiency_percent",
      "consumers", "outages", "outage_minutes",
      "gen_mix_rate",
      "prev_system_loss_percent", "prev_collection_efficiency_percent",
      "prev_gen_mix_rate", "prev_total_consumers",
    ],
    serialize: (p) => [
      p.month, formatYYYYMM(p.month),
      p.totalKwhPurchased, p.totalKwhSold, p.systemLossPercent,
      p.totalBilled, p.totalCollected, p.collectionEfficiencyPercent,
      p.totalConsumers, p.outageCount, p.totalOutageMinutes,
      p.genMixRate,
      p.prevSystemLossPercent, p.prevCollectionEfficiencyPercent,
      p.prevGenMixRate, p.prevTotalConsumers,
    ],
    templateRow: {},
    parseRow: () => { throw new Error("analytics import is disabled"); },
  };
}

function supplierMixCsvSchema(): CsvSchema<SupplierMixRow, never> {
  return {
    filename: "analytics_supplier_mix.csv",
    headers: ["month", "yyyymm", "supplier_id", "supplier_name", "energy_kwh", "power_cost_php", "rate_php_per_kwh"],
    serialize: (r) => [r.month, formatYYYYMM(r.month), r.supplierId, r.supplierName, r.energy, r.cost, r.rate],
    templateRow: {},
    parseRow: () => { throw new Error("analytics import is disabled"); },
  };
}

// ==================================================================
//  Pure helpers
// ==================================================================
function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, d)).toISOString().slice(0, 10);
}

// ==================================================================
//  Outage heatmap — CSS grid, color intensity = consumer-minutes
// ==================================================================
function OutageHeatmap({ rows }: { rows: OutageMatrixRow[] }) {
  const causes = Array.from(new Set(rows.map((r) => r.cause))).sort();
  const months = Array.from(new Set(rows.map((r) => r.month))).sort();

  const key = (m: string, c: string) => `${m}__${c}`;
  const byCell = new Map<string, OutageMatrixRow>();
  for (const r of rows) byCell.set(key(r.month, r.cause), r);

  const maxConsumerMinutes = Math.max(1, ...rows.map((r) => r.consumerMinutes));

  return (
    <div className="border border-[#2C3168] rounded-lg p-4 bg-[#0F1230] overflow-x-auto">
      <table className="w-full font-mono text-xs">
        <thead>
          <tr>
            <th className="text-left py-2 pr-3 text-[#9CA3D9] font-normal">Cause \ Month</th>
            {months.map((m) => (
              <th key={m} className="px-2 py-2 text-[#9CA3D9] font-normal whitespace-nowrap">
                {formatMonth(m)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {causes.map((c) => (
            <tr key={c} className="border-t border-[#1F2450]">
              <td className="py-1.5 pr-3 text-[#F5F0FF] whitespace-nowrap">{c}</td>
              {months.map((m) => {
                const cell = byCell.get(key(m, c));
                const intensity = cell ? cell.consumerMinutes / maxConsumerMinutes : 0;
                const bg = cell
                  ? `rgba(255, 77, 109, ${0.15 + intensity * 0.75})`
                  : "transparent";
                return (
                  <td key={m} className="p-1 text-center">
                    <div
                      className="rounded px-2 py-1"
                      style={{ background: bg, minWidth: 60 }}
                      title={
                        cell
                          ? `${c} · ${formatMonth(m)}\n${cell.outageCount} outage${cell.outageCount === 1 ? "" : "s"}\n${formatNumber(cell.totalMinutes)} min · ${formatNumber(cell.consumerMinutes)} consumer-min`
                          : "—"
                      }
                    >
                      {cell ? formatNumber(cell.consumerMinutes) : "—"}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="font-mono text-[10px] text-[#6C74A8] mt-3">
        Cell value = consumer-minutes affected (duration × affected consumers). Darker = worse.
      </p>
    </div>
  );
}

function AgingBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="border border-[#2C3168] rounded px-3 py-2">
      <p className="uppercase tracking-wide text-[#9CA3D9]">{label}</p>
      <p className="text-lg tabular-nums mt-0.5" style={{ color }}>
        {formatNumber(value)}
      </p>
    </div>
  );
}

// ==================================================================
//  CSV schemas — outages / aging (export only)
// ==================================================================
function outageMatrixCsvSchema(): CsvSchema<OutageMatrixRow, never> {
  return {
    filename: "analytics_outage_matrix.csv",
    headers: ["month", "yyyymm", "cause", "outage_count", "total_minutes", "consumer_minutes"],
    serialize: (r) => [r.month, formatYYYYMM(r.month), r.cause, r.outageCount, r.totalMinutes, r.consumerMinutes],
    templateRow: {},
    parseRow: () => { throw new Error("analytics import is disabled"); },
  };
}

function collectionAgingCsvSchema(): CsvSchema<CollectionAgingRow, never> {
  return {
    filename: "analytics_collection_aging.csv",
    headers: [
      "month", "yyyymm",
      "billed", "collected", "overdue",
      "bills_paid", "bills_partial", "bills_unpaid", "bills_overdue",
      "open_notices",
    ],
    serialize: (r) => [
      r.month, formatYYYYMM(r.month),
      r.billed, r.collected, r.overdue,
      r.billsPaid, r.billsPartial, r.billsUnpaid, r.billsOverdue,
      r.openNotices,
    ],
    templateRow: {},
    parseRow: () => { throw new Error("analytics import is disabled"); },
  };
}
