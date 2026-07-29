import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useSystemLoss } from '../hooks/useSystemLoss';
import { createSystemLoss } from '../services/systemLossRepository';
import { supabase } from '../services/supabaseClient';

function formatNumber(n: number): string {
  return n.toLocaleString('en-PH', { maximumFractionDigits: 0 });
}

function formatMonth(period: string): string {
  return new Date(period).toLocaleDateString('en-PH', { year: 'numeric', month: 'short' });
}

export default function SystemLossPage() {
  const { rows, trend, loading, error, refresh } = useSystemLoss();

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [branchId, setBranchId] = useState('');
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 8) + '01');
  const [kwhPurchased, setKwhPurchased] = useState('');
  const [kwhSold, setKwhSold] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('branches').select('id, name').then(({ data }) => setBranches(data ?? []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await createSystemLoss({
        branch_id: branchId,
        period,
        kwh_purchased: Number(kwhPurchased) || 0,
        kwh_sold: Number(kwhSold) || 0,
      });
      setBranchId('');
      setKwhPurchased('');
      setKwhSold('');
      setShowForm(false);
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add entry');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F1214] text-[#E8E6E1] flex items-center justify-center">
        <p className="font-mono text-sm tracking-wide text-[#8A8F94]">Loading system loss data…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0F1214] text-[#E8E6E1] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="font-mono text-sm text-[#D9705C] mb-4">Couldn't load system loss: {error}</p>
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
            <h1 className="text-3xl font-semibold tracking-tight">System Loss</h1>
          </div>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] hover:text-[#E8E6E1] border border-[#2A2E32] rounded px-3 py-1.5"
          >
            {showForm ? 'Cancel' : '+ Add Entry'}
          </button>
        </header>

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-10 border border-[#2A2E32] rounded-lg p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] block mb-1">Branch</label>
                <select required value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full bg-[#1A1D20] border border-[#2A2E32] rounded px-3 py-2 text-sm">
                  <option value="">Select branch…</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] block mb-1">Month</label>
                <input type="date" required value={period} onChange={(e) => setPeriod(e.target.value)} className="w-full bg-[#1A1D20] border border-[#2A2E32] rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] block mb-1">kWh Purchased</label>
                <input type="number" required min={0} value={kwhPurchased} onChange={(e) => setKwhPurchased(e.target.value)} className="w-full bg-[#1A1D20] border border-[#2A2E32] rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] block mb-1">kWh Sold</label>
                <input type="number" required min={0} value={kwhSold} onChange={(e) => setKwhSold(e.target.value)} className="w-full bg-[#1A1D20] border border-[#2A2E32] rounded px-3 py-2 text-sm" />
              </div>
            </div>
            {formError && <p className="font-mono text-xs text-[#D9705C]">{formError}</p>}
            <button type="submit" disabled={submitting} className="bg-[#E8E6E1] text-[#0F1214] font-medium text-sm px-4 py-2 rounded hover:bg-white transition-colors disabled:opacity-50">
              {submitting ? 'Adding…' : 'Add Entry'}
            </button>
          </form>
        )}

        {/* Trend chart */}
        <div className="border border-[#2A2E32] rounded-lg p-6 mb-10">
          <p className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] mb-4">
            Monthly Trend (all branches combined) · Target ≤13%
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2E32" />
              <XAxis
                dataKey="period"
                tickFormatter={formatMonth}
                stroke="#8A8F94"
                fontSize={12}
                fontFamily="monospace"
              />
              <YAxis stroke="#8A8F94" fontSize={12} fontFamily="monospace" unit="%" />
              <Tooltip
                contentStyle={{
                  background: '#1A1D20',
                  border: '1px solid #2A2E32',
                  borderRadius: 6,
                  fontFamily: 'monospace',
                  fontSize: 12,
                }}
                labelFormatter={formatMonth}
                formatter={(value: number) => [`${value}%`, 'System Loss']}
              />
              <ReferenceLine y={13} stroke="#D9705C" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="systemLossPercent"
                stroke="#7FB88A"
                strokeWidth={2}
                dot={{ fill: '#7FB88A', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Per-branch breakdown table */}
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
                <th className="text-right py-2 font-normal">Loss %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-[#1E2225]">
                  <td className="py-2.5 font-mono text-[#6B7075]">{formatMonth(r.period)}</td>
                  <td className="py-2.5">{r.branch_name}</td>
                  <td className="py-2.5 text-right font-mono tabular-nums">
                    {formatNumber(r.kwh_purchased)}
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums">
                    {formatNumber(r.kwh_sold)}
                  </td>
                  <td
                    className={`py-2.5 text-right font-mono tabular-nums ${
                      r.system_loss_percent <= 13 ? 'text-[#7FB88A]' : 'text-[#D9705C]'
                    }`}
                  >
                    {r.system_loss_percent}%
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
