'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { usePowerSupplyCost } from '../../../hooks/usePowerSupplyCost';
import {
  computePeriodTotals,
  computeSupplierMix,
  computeSupplierBreakdown,
  deletePowerSupplyRecord,
  getSuppliersForBranch,
  deleteSupplier,
} from '../../../services/powerSupplyService';
import { formatCurrency } from '../../../lib/utils';
import PowerSupplyForm from './PowerSupplyForm';
import SupplierForm from './SupplierForm';
import FilterBar from '../../ui/FilterBar';
import RowActions from '../../ui/RowActions';
import { useDateRange } from '../../../hooks/useDateRange';
import { inRange } from '../../../utils/dateRange';
import type { PowerSupplyWithRefs, PowerSupplier } from '../../../models/powerSupply.types';

interface Props {
  branchId: string;
}

const axisStyle = { fontFamily: 'var(--font-mono)', fontSize: 11 };
const tooltipStyle = { background: 'var(--panel-raised)', border: '1px solid var(--line)', fontFamily: 'var(--font-mono)' };
const MIX_COLORS = ['#3E7CB1', '#4CAF7D', '#E2903F', '#8CA0B3', '#B96F2C', '#E2B33F', '#9C6ADE'];

const TYPE_LABEL: Record<string, string> = {
  bilateral: 'Bilateral / PSA',
  wesm: 'WESM',
  net_metering: 'Net Metering',
};

export default function PowerSupplyDashboard({ branchId }: Props) {
  const { data, loading, error, refetch } = usePowerSupplyCost(branchId);
  const [suppliers, setSuppliers] = useState<PowerSupplier[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PowerSupplyWithRefs | null>(null);
  const [supplierFormOpen, setSupplierFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<PowerSupplier | null>(null);
  const { preset, setPreset, custom, setCustom, range } = useDateRange('all');

  const loadSuppliers = useCallback(() => {
    getSuppliersForBranch(branchId).then(setSuppliers).catch(() => setSuppliers([]));
  }, [branchId]);

  useEffect(() => {
    if (branchId) loadSuppliers();
  }, [branchId, loadSuppliers]);

  if (loading) return <div>Loading power supply data...</div>;
  if (error) return <div style={{ color: 'var(--signal-bad)' }}>Error loading power supply data: {error.message}</div>;

  const all = data ?? [];
  const rows = all.filter((r) => inRange(r.period_start, range));
  const periodTotals = computePeriodTotals(rows);
  const supplierMix = computeSupplierMix(rows);
  const supplierBreakdown = computeSupplierBreakdown(rows);
  const breakdownTotalKwh = supplierBreakdown.reduce((sum, s) => sum + s.total_kwh, 0);
  const breakdownTotalCost = supplierBreakdown.reduce((sum, s) => sum + s.total_cost, 0);
  // Series for the stacked mix chart: supplier codes actually present in range.
  const mixCodes = supplierBreakdown.map((s) => s.code);
  const latest = periodTotals.length > 0 ? periodTotals[periodTotals.length - 1] : null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>Power Supply by Supplier</h1>
        <button onClick={() => { setEditing(null); setFormOpen(true); }}>+ Add Record</button>
      </div>
      <div className="sld-divider"><span className="sld-node" /></div>

      <PowerSupplyForm
        branchId={branchId}
        open={formOpen}
        editing={editing}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSaved={refetch}
      />
      <SupplierForm
        branchId={branchId}
        open={supplierFormOpen}
        editing={editingSupplier}
        onClose={() => { setSupplierFormOpen(false); setEditingSupplier(null); }}
        onSaved={() => { loadSuppliers(); refetch(); }}
      />

      <FilterBar
        preset={preset}
        onPresetChange={setPreset}
        custom={custom}
        onCustomChange={setCustom}
        range={range}
        resultNote={`${rows.length} records · ${periodTotals.length} periods`}
      />

      {/* ---- Supplier management ---- */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Suppliers ({suppliers.length})</h3>
          <button className="secondary" onClick={() => { setEditingSupplier(null); setSupplierFormOpen(true); }}>
            + Add Supplier
          </button>
        </div>
        {suppliers.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No suppliers yet. Add TLI, SPI, CAP1, WESM, Net Metering…</p>
        ) : (
          <table style={{ marginTop: 12 }}>
            <thead>
              <tr><th>Code</th><th>Name</th><th>Type</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td className="data">{s.code}</td>
                  <td>{s.name}</td>
                  <td>{TYPE_LABEL[s.supplier_type] ?? s.supplier_type}</td>
                  <td style={{ color: s.active ? 'var(--signal-good)' : 'var(--text-muted)' }}>
                    {s.active ? 'Active' : 'Inactive'}
                  </td>
                  <td>
                    <RowActions
                      onEdit={() => { setEditingSupplier(s); setSupplierFormOpen(true); }}
                      onDelete={async () => {
                        await deleteSupplier(s.id);
                        loadSuppliers();
                        refetch();
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {all.length === 0 && <div className="card">No power supply records for this branch yet.</div>}
      {all.length > 0 && rows.length === 0 && <div className="card">No records match the selected date range.</div>}

      {latest && (
        <div className="card">
          <h3>Latest Period &middot; {latest.period_start} to {latest.period_end}</h3>
          <div className="stat-row" style={{ marginTop: 12 }}>
            <div className="stat">
              <span className="stat-label">Total Purchased</span>
              <span className="stat-value data">{latest.total_kwh.toLocaleString()} kWh</span>
            </div>
            <div className="stat">
              <span className="stat-label">Total Power Cost</span>
              <span className="stat-value data">{formatCurrency(latest.total_cost)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Blended Cost / kWh</span>
              <span className="stat-value data">{formatCurrency(latest.cost_per_kwh)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Suppliers</span>
              <span className="stat-value data">{mixCodes.length}</span>
            </div>
          </div>
        </div>
      )}

      {rows.length > 0 && (<>
      <div className="card" style={{ height: 300 }}>
        <h3>Energy Mix by Supplier (kWh Purchased)</h3>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={supplierMix}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
            <XAxis dataKey="period_start" stroke="var(--text-muted)" style={axisStyle} />
            <YAxis stroke="var(--text-muted)" style={axisStyle} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            {mixCodes.map((code, i) => (
              <Bar key={code} dataKey={code} stackId="mix" fill={MIX_COLORS[i % MIX_COLORS.length]} name={code} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card" style={{ height: 300 }}>
        <h3>Total Purchased Power Cost &amp; Blended ₱/kWh</h3>
        <ResponsiveContainer width="100%" height="90%">
          <LineChart data={periodTotals}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
            <XAxis dataKey="period_start" stroke="var(--text-muted)" style={axisStyle} />
            <YAxis yAxisId="cost" stroke="var(--text-muted)" style={axisStyle} />
            <YAxis yAxisId="rate" orientation="right" stroke="var(--text-muted)" style={axisStyle} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatCurrency(value)} />
            <Legend />
            <Line yAxisId="cost" type="monotone" dataKey="total_cost" stroke="#E2903F" name="Total Cost (₱)" strokeWidth={2} />
            <Line yAxisId="rate" type="monotone" dataKey="cost_per_kwh" stroke="#8CA0B3" name="₱/kWh" strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h3>Supplier Breakdown (selected range)</h3>
        <table>
          <thead>
            <tr><th>Supplier</th><th>Type</th><th>Purchased (kWh)</th><th>Power Cost</th><th>₱/kWh</th></tr>
          </thead>
          <tbody>
            {supplierBreakdown.map((s) => (
              <tr key={s.code}>
                <td className="data">{s.code}</td>
                <td>{TYPE_LABEL[s.supplier_type] ?? s.supplier_type}</td>
                <td className="data">{s.total_kwh.toLocaleString()}</td>
                <td className="data">{formatCurrency(s.total_cost)}</td>
                <td className="data">{s.total_kwh > 0 ? formatCurrency(s.total_cost / s.total_kwh) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 600, borderTop: '2px solid var(--line)' }}>
              <td>Total</td>
              <td></td>
              <td className="data">{breakdownTotalKwh.toLocaleString()}</td>
              <td className="data">{formatCurrency(breakdownTotalCost)}</td>
              <td className="data">
                {breakdownTotalKwh > 0 ? formatCurrency(breakdownTotalCost / breakdownTotalKwh) : '—'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="card">
        <h3>Records</h3>
        <table>
          <thead>
            <tr>
              <th>Period</th>
              <th>Supplier</th>
              <th>Purchased (kWh)</th>
              <th>Power Cost</th>
              <th>₱/kWh</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="data">{r.period_start} – {r.period_end}</td>
                <td>{r.power_suppliers?.code ?? '—'}</td>
                <td className="data">{r.kwh_purchased.toLocaleString()}</td>
                <td className="data">{formatCurrency(r.purchased_power_cost)}</td>
                <td className="data">{r.kwh_purchased > 0 ? formatCurrency(r.purchased_power_cost / r.kwh_purchased) : '—'}</td>
                <td>
                  <RowActions
                    onEdit={() => { setEditing(r); setFormOpen(true); }}
                    onDelete={async () => { await deletePowerSupplyRecord(r.id); refetch(); }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>)}
    </div>
  );
}
