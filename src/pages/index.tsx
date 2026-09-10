import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useDashboard } from '../hooks/useDashboard';
import { useAuth } from '../hooks/useAuth';
import { useRole } from '../hooks/useRole';
import {
  PeriodMode,
  PeriodRange,
  getAvailablePeriods,
} from '../services/dashboardRepository';

function formatNumber(n: number): string {
  return n.toLocaleString('en-PH', { maximumFractionDigits: 0 });
}

function formatCurrency(n: number): string {
  return n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });
}

function formatPeriod(period: string): string {
  return new Date(period).toLocaleDateString('en-PH', { year: 'numeric', month: 'long' });
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

export default function DashboardOverviewPage() {
  const { isAdmin } = useRole();
  const [mode, setMode] = useState<PeriodMode>('month');
  const [months, setMonths] = useState<string[]>([]);   // YYYY-MM-01, newest first
  const [years, setYears] = useState<number[]>([]);     // newest first
  const [monthIdx, setMonthIdx] = useState(0);
  const [yearIdx, setYearIdx] = useState(0);

  // Load the list of periods that actually exist in the DB.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { months: m, years: y } = await getAvailablePeriods();
        if (!cancelled) {
          setMonths(m);
          setYears(y);
        }
      } catch {
        /* non-fatal — the hook will still show something */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Build the range currently in view; null while the picker is still empty.
  const range: PeriodRange | null = React.useMemo(() => {
    if (mode === 'month') {
      const m = months[monthIdx];
      if (!m) return null;
      return { mode, from: m, to: addOneMonth(m), label: formatMonthLabel(m) };
    }
    const y = years[yearIdx];
    if (!y) return null;
    return {
      mode,
      from: `${y}-01-01`,
      to: `${y + 1}-01-01`,
      label: String(y),
    };
  }, [mode, months, monthIdx, years, yearIdx]);

  const { summary, loading, error, refresh } = useDashboard(range);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08091C] text-[#F5F0FF] flex items-center justify-center">
        <p className="font-mono text-sm tracking-wide text-[#9CA3D9]">Loading dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#08091C] text-[#F5F0FF] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="font-mono text-sm text-[#FF4D6D] mb-4">Couldn&apos;t load dashboard: {error}</p>
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

  if (!summary) {
    return (
      <div className="min-h-screen bg-[#08091C] text-[#F5F0FF] flex items-center justify-center">
        <p className="font-mono text-sm text-[#9CA3D9]">No data yet. Add some monthly records to get started.</p>
      </div>
    );
  }

  const systemLossHealthy = summary.systemLossPercent <= 13; // typical NEA cap for co-ops
  const collectionHealthy = summary.collectionEfficiencyPercent >= 95;

  return (
    <div className="min-h-screen bg-[#08091C] text-[#F5F0FF]">
      <div className="max-w-4xl mx-auto px-6 py-14">
        <header className="mb-6 border-b border-[#2C3168] pb-6 flex justify-between items-start">
          <div>
            <p className="font-mono text-xs tracking-[0.2em] text-[#9CA3D9] uppercase mb-2">
              Cooperative Report · {summary.branchCount} Branches
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard Overview</h1>
            <p className="font-mono text-xs text-[#9CA3D9] mt-2">
              {range ? range.label : formatPeriod(summary.period)}
            </p>
          </div>
          <SignOutButton />
        </header>

        <PeriodNavigator
          mode={mode}
          setMode={setMode}
          months={months}
          years={years}
          monthIdx={monthIdx}
          setMonthIdx={setMonthIdx}
          yearIdx={yearIdx}
          setYearIdx={setYearIdx}
        />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
          {/* System Loss */}
          <div className="border border-[#2C3168] rounded-lg p-4">
            <p className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] mb-1">
              System Loss
            </p>
            <p
              className={`font-mono text-2xl tabular-nums ${
                systemLossHealthy ? 'text-[#22F0B0]' : 'text-[#FF4D6D]'
              }`}
            >
              {summary.systemLossPercent}%
            </p>
            <p className="font-mono text-xs text-[#6C74A8] mt-1">
              {formatNumber(summary.totalKwhPurchased)} kWh purchased
            </p>
          </div>

          {/* kWh Sold */}
          <div className="border border-[#2C3168] rounded-lg p-4">
            <p className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] mb-1">
              kWh Sold
            </p>
            <p className="font-mono text-2xl tabular-nums">{formatNumber(summary.totalKwhSold)}</p>
            <p className="font-mono text-xs text-[#6C74A8] mt-1">this period</p>
          </div>

          {/* Gen Mix — weighted-average power cost / energy across all suppliers */}
          <div className="border border-[#2C3168] rounded-lg p-4">
            <p className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] mb-1">
              Gen Mix
            </p>
            <p className="font-mono text-2xl tabular-nums">
              {summary.genMixRate !== null ? `₱${summary.genMixRate.toFixed(4)}` : '—'}
            </p>
            <p className="font-mono text-xs text-[#6C74A8] mt-1">
              per kWh · {formatNumber(summary.genMixTotalEnergy)} kWh
            </p>
          </div>

          {/* Collection Efficiency */}
          <div className="border border-[#2C3168] rounded-lg p-4">
            <p className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] mb-1">
              Collection Efficiency
            </p>
            <p
              className={`font-mono text-2xl tabular-nums ${
                collectionHealthy ? 'text-[#22F0B0]' : 'text-[#FF4D6D]'
              }`}
            >
              {summary.collectionEfficiencyPercent}%
            </p>
            <p className="font-mono text-xs text-[#6C74A8] mt-1">
              {formatCurrency(summary.totalCollected)} / {formatCurrency(summary.totalBilled)}
            </p>
          </div>

          {/* Membership */}
          <div className="border border-[#2C3168] rounded-lg p-4">
            <p className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] mb-1">
              Total Consumers
            </p>
            <p className="font-mono text-2xl tabular-nums">{formatNumber(summary.totalConsumers)}</p>
            <p className="font-mono text-xs text-[#6C74A8] mt-1">across all branches</p>
          </div>

          {/* Outages */}
          <div className="border border-[#2C3168] rounded-lg p-4">
            <p className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] mb-1">
              Outages
            </p>
            <p className="font-mono text-2xl tabular-nums">{summary.outageCount}</p>
            <p className="font-mono text-xs text-[#6C74A8] mt-1">
              {formatDuration(summary.totalOutageMinutes)} total downtime
            </p>
          </div>
        </div>

        <p className="font-mono text-xs text-[#6C74A8] text-center mb-10">
          System loss target: ≤13% · Collection efficiency target: ≥95% (typical NEA benchmarks)
        </p>

        <div className="space-y-2">
          <Link
            href="/system-loss"
            className="flex justify-between items-center border border-[#2C3168] rounded-lg px-5 py-4 hover:bg-[#171A38] transition-colors group"
          >
            <div>
              <p className="text-sm font-medium">System Loss</p>
              <p className="font-mono text-xs text-[#9CA3D9] mt-0.5">Trend and per-branch detail</p>
            </div>
            <span className="text-[#6C74A8] group-hover:text-[#F5F0FF] transition-colors">→</span>
          </Link>
          <Link
            href="/power-supply"
            className="flex justify-between items-center border border-[#2C3168] rounded-lg px-5 py-4 hover:bg-[#171A38] transition-colors group"
          >
            <div>
              <p className="text-sm font-medium">Power Supply</p>
              <p className="font-mono text-xs text-[#9CA3D9] mt-0.5">Volume, cost, revenue, margin</p>
            </div>
            <span className="text-[#6C74A8] group-hover:text-[#F5F0FF] transition-colors">→</span>
          </Link>
          <Link
            href="/collections"
            className="flex justify-between items-center border border-[#2C3168] rounded-lg px-5 py-4 hover:bg-[#171A38] transition-colors group"
          >
            <div>
              <p className="text-sm font-medium">Collection Efficiency</p>
              <p className="font-mono text-xs text-[#9CA3D9] mt-0.5">Billed, collected, receivables</p>
            </div>
            <span className="text-[#6C74A8] group-hover:text-[#F5F0FF] transition-colors">→</span>
          </Link>
          <Link
            href="/outages"
            className="flex justify-between items-center border border-[#2C3168] rounded-lg px-5 py-4 hover:bg-[#171A38] transition-colors group"
          >
            <div>
              <p className="text-sm font-medium">Outages</p>
              <p className="font-mono text-xs text-[#9CA3D9] mt-0.5">Log and browse service interruptions</p>
            </div>
            <span className="text-[#6C74A8] group-hover:text-[#F5F0FF] transition-colors">→</span>
          </Link>
          <Link
            href="/membership"
            className="flex justify-between items-center border border-[#2C3168] rounded-lg px-5 py-4 hover:bg-[#171A38] transition-colors group"
          >
            <div>
              <p className="text-sm font-medium">Membership</p>
              <p className="font-mono text-xs text-[#9CA3D9] mt-0.5">Consumer counts by type and branch</p>
            </div>
            <span className="text-[#6C74A8] group-hover:text-[#F5F0FF] transition-colors">→</span>
          </Link>
          <Link
            href="/analytics"
            className="flex justify-between items-center border border-[#2C3168] rounded-lg px-5 py-4 hover:bg-[#171A38] transition-colors group"
          >
            <div>
              <p className="text-sm font-medium">Analytics</p>
              <p className="font-mono text-xs text-[#9CA3D9] mt-0.5">KPI trends, supplier mix, cross-cutting views</p>
            </div>
            <span className="text-[#6C74A8] group-hover:text-[#F5F0FF] transition-colors">→</span>
          </Link>
          {isAdmin && (
            <Link
              href="/users"
              className="flex justify-between items-center border border-[#2C3168] rounded-lg px-5 py-4 hover:bg-[#171A38] transition-colors group"
            >
              <div>
                <p className="text-sm font-medium">Users &amp; Roles</p>
                <p className="font-mono text-xs text-[#9CA3D9] mt-0.5">Admin · assign admin / editor / viewer</p>
              </div>
              <span className="text-[#6C74A8] group-hover:text-[#F5F0FF] transition-colors">→</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function SignOutButton() {
  const { user, signOut } = useAuth();
  const { role } = useRole();
  return (
    <div className="text-right">
      {user && (
        <p className="font-mono text-xs text-[#9CA3D9] mb-2">
          {user.email}
          {role && (
            <span
              className="ml-2 font-mono text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full border"
              style={{
                color: role === 'admin' ? '#8B5CF6' : role === 'editor' ? '#22F0B0' : '#9CA3D9',
                borderColor: (role === 'admin' ? '#8B5CF6' : role === 'editor' ? '#22F0B0' : '#9CA3D9') + '55',
              }}
            >
              {role}
            </span>
          )}
        </p>
      )}
      <button
        onClick={signOut}
        className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] hover:text-[#FF4D6D]"
      >
        Sign out
      </button>
    </div>
  );
}

// ==================================================================
//  Period navigator — month/year toggle + prev/next scroll
// ==================================================================
interface PeriodNavigatorProps {
  mode: PeriodMode;
  setMode: React.Dispatch<React.SetStateAction<PeriodMode>>;
  months: string[];    // newest first, "YYYY-MM-01"
  years: number[];     // newest first
  monthIdx: number;
  setMonthIdx: React.Dispatch<React.SetStateAction<number>>;
  yearIdx: number;
  setYearIdx: React.Dispatch<React.SetStateAction<number>>;
}

function PeriodNavigator({
  mode,
  setMode,
  months,
  years,
  monthIdx,
  setMonthIdx,
  yearIdx,
  setYearIdx,
}: PeriodNavigatorProps) {
  const list = mode === 'month' ? months : years;
  const idx = mode === 'month' ? monthIdx : yearIdx;
  const setIdx = mode === 'month' ? setMonthIdx : setYearIdx;

  // Newest is at index 0; "next" (a newer period) DECREASES the index.
  const canOlder = idx < list.length - 1;
  const canNewer = idx > 0;

  const label =
    list.length === 0
      ? 'No data yet'
      : mode === 'month'
        ? formatMonthLabel(months[monthIdx])
        : String(years[yearIdx]);

  return (
    <section className="mb-8 flex flex-wrap items-center gap-3">
      {/* Mode toggle */}
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

      {/* Period scroller */}
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
        <span className="px-4 py-1 font-mono text-sm min-w-[110px] text-center">
          {label}
        </span>
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

      {/* Jump to latest */}
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

// ==================================================================
//  Pure helpers
// ==================================================================
function formatMonthLabel(yyyymmdd: string): string {
  const [y, m] = yyyymmdd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
  });
}

function addOneMonth(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(Date.UTC(y, m, d));
  return next.toISOString().slice(0, 10);
}
