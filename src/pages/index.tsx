import React from 'react';
import Link from 'next/link';
import { useDashboard } from '../hooks/useDashboard';
import { useAuth } from '../hooks/useAuth';

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
  const { summary, loading, error, refresh } = useDashboard();

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
        <header className="mb-10 border-b border-[#2C3168] pb-6 flex justify-between items-start">
          <div>
            <p className="font-mono text-xs tracking-[0.2em] text-[#9CA3D9] uppercase mb-2">
              Cooperative Report · {summary.branchCount} Branches
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard Overview</h1>
            <p className="font-mono text-xs text-[#9CA3D9] mt-2">{formatPeriod(summary.period)}</p>
          </div>
          <SignOutButton />
        </header>

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

          {/* WESM Price */}
          <div className="border border-[#2C3168] rounded-lg p-4">
            <p className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] mb-1">
              WESM Price {summary.wesmGrid ? `(${summary.wesmGrid})` : ''}
            </p>
            <p className="font-mono text-2xl tabular-nums">
              {summary.latestWesmPrice !== null ? `₱${summary.latestWesmPrice.toFixed(2)}` : '—'}
            </p>
            <p className="font-mono text-xs text-[#6C74A8] mt-1">per kWh</p>
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
        </div>
      </div>
    </div>
  );
}

function SignOutButton() {
  const { user, signOut } = useAuth();
  return (
    <div className="text-right">
      {user && <p className="font-mono text-xs text-[#9CA3D9] mb-2">{user.email}</p>}
      <button
        onClick={signOut}
        className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] hover:text-[#FF4D6D]"
      >
        Sign out
      </button>
    </div>
  );
}
