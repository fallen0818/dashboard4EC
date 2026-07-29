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
  Legend,
} from 'recharts';
import { useCollections } from '../hooks/useCollections';
import { createCollection } from '../services/collectionsRepository';
import { supabase } from '../services/supabaseClient';

function formatCurrency(n: number): string {
  return n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });
}

function formatMonth(period: string): string {
  return new Date(period).toLocaleDateString('en-PH', { year: 'numeric', month: 'short' });
}

const chartTooltipStyle = {
  background: '#1A1D20',
  border: '1px solid #2A2E32',
  borderRadius: 6,
  fontFamily: 'monospace',
  fontSize: 12,
};

export default function CollectionsPage() {
  const { rows, trend, loading, error, refresh } = useCollections();

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [branchId, setBranchId] = useState('');
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 8) + '01');
  const [billed, setBilled] = useState('');
  const [collected, setCollected] = useState('');
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
      await createCollection({
        branch_id: branchId,
        period,
        amount_billed: Number(billed) || 0,
        amount_collected: Number(collected) || 0,
      });
      setBranchId('');
      setBilled('');
      setCollected('');
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
        <p className="font-mono text-sm tracking-wide text-[#8A8F94]">Loading collections data…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0F1214] text-[#E8E6E1] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="font-mono text-sm text-[#D9705C] mb-4">Couldn't load collections: {error}</p>
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
            <h1 className="text-3xl font-semibold tracking-tight">Collection Efficiency</h1>
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
                <label className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] block mb-1">Amount Billed</label>
                <input type="number" required min={0} value={billed} onChange={(e) => setBilled(e.target.value)} className="w-full bg-[#1A1D20] border border-[#2A2E32] rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] block mb-1">Amount Collected</label>
                <input type="number" required min={0} value={collected} onChange={(e) => setCollected(e.target.value)} className="w-full bg-[#1A1D20] border border-[#2A2E32] rounded px-3 py-2 text-sm" />
              </div>
            </div>
            {formError && <p className="font-mono text-xs text-[#D9705C]">{formError}</p>}
            <button type="submit" disabled={submitting} className="bg-[#E8E6E1] text-[#0F1214] font-medium text-sm px-4 py-2 rounded hover:bg-white transition-colors disabled:opacity-50">
              {submitting ? 'Adding…' : 'Add Entry'}
            </button>
          </form>
        )}

        {/* Efficiency % trend */}
        <div className="border border-[#2A2E32] rounded-lg p-6 mb-6">
          <p className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] mb-4">
            Collection Efficiency % · Target ≥95%
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2E32" />
              <XAxis
                dataKey="period"
                tickFormatter={formatMonth}
                stroke="#8A8F94"
                fontSize={12}
                fontFamily="monospace"
              />
              <YAxis stroke="#8A8F94" fontSize={12} fontFamily="monospace" unit="%" domain={[80, 100]} />
              <Tooltip
                contentStyle={chartTooltipStyle}
                labelFormatter={(label) => (typeof label === 'string' ? formatMonth(label) : '')}
                formatter={(value) => [typeof value === 'number' ? `${value}%` : '', 'Collection Efficiency']}
              />
              <ReferenceLine y={95} stroke="#7FB88A" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="collectionEfficiencyPercent"
                stroke="#D9A15C"
                strokeWidth={2}
                dot={{ fill: '#D9A15C', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Billed vs Collected */}
        <div className="border border-[#2A2E32] rounded-lg p-6 mb-10">
          <p className="font-mono text-xs uppercase tracking-wide text-[#8A8F94] mb-4">
            Billed vs. Collected (₱) · All Branches Combined
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
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
                labelFormatter={(label) => (typeof label === 'string' ? formatMonth(label) : '')}
                formatter={(value, name) => [typeof value === 'number' ? formatCurrency(value) : '', name ?? '']}
              />
              <Legend wrapperStyle={{ fontFamily: 'monospace', fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="totalBilled"
                name="Billed"
                stroke="#8A8F94"
                strokeWidth={2}
                dot={{ fill: '#8A8F94', r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="totalCollected"
                name="Collected"
                stroke="#7FB88A"
                strokeWidth={2}
                dot={{ fill: '#7FB88A', r: 4 }}
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
                <th className="text-right py-2 font-normal">Billed</th>
                <th className="text-right py-2 font-normal">Collected</th>
                <th className="text-right py-2 font-normal">Receivable</th>
                <th className="text-right py-2 font-normal">Efficiency</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const receivable = r.amount_billed - r.amount_collected;
                return (
                  <tr key={i} className="border-b border-[#1E2225]">
                    <td className="py-2.5 font-mono text-[#6B7075]">{formatMonth(r.period)}</td>
                    <td className="py-2.5">{r.branch_name}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums">
                      {formatCurrency(r.amount_billed)}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums">
                      {formatCurrency(r.amount_collected)}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-[#8A8F94]">
                      {formatCurrency(receivable)}
                    </td>
                    <td
                      className={`py-2.5 text-right font-mono tabular-nums ${
                        r.collection_efficiency_percent >= 95 ? 'text-[#7FB88A]' : 'text-[#D9705C]'
                      }`}
                    >
                      {r.collection_efficiency_percent}%
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
