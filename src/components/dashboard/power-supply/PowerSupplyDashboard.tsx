'use client';

import { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { usePowerSupplyCost } from '../../../hooks/usePowerSupplyCost';
import { computeCostPerKwhSold, deletePowerSupplyRecord } from '../../../services/powerSupplyService';
import { formatCurrency } from '../../../lib/utils';
import PowerSupplyForm from './PowerSupplyForm';
import FilterBar from '../../ui/FilterBar';
import RowActions from '../../ui/RowActions';
import { useDateRange } from '../../../hooks/useDateRange';
import { inRange } from '../../../utils/dateRange';
import type { PowerSupplyWithPrice } from '../../../models/powerSupply.types';

interface Props {
  branchId: string;
}

const axisStyle = { fontFamily: 'var(--font-mono)', fontSize: 11 };
const tooltipStyle = { background: 'var(--panel-raised)', border: '1px solid var(--line)', fontFamily: 'var(--font-mono)' };

export default function PowerSupplyDashboard({ branchId }: Props) {
  const { data, loading, error, refetch } = usePowerSupplyCost(branchId);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PowerSupplyWithPrice | null>(null);
  const { preset, setPreset, custom, setCustom, range } = useDateRange('all');

  if (loading) return <div>Loading power supply data...</div>;
  if (error) return <div style={{ color: 'var(--signal-bad)' }}>Error loading power supply data: {error.message}</div>;

  const all = data ?? [];
  const rows = all.filter((r) => inRange(r.period_start, range));
  const costTrend = computeCostPerKwhSold(rows);
  const kwhChartData = rows.map((r) => ({ period: r.period_start, purchased: r.kwh_purchased, sold: r.kwh_sold }));
  const costChartData = rows.map((r) => ({ period: r.period_start, purchased_power_cost: r.purchased_power_cost }));
  const latest = rows.length > 0 ? rows[rows.length - 1] : null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>Power Supply &amp; WESM Pricing</h1>
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

      <FilterBar
        preset={preset}
        onPresetChange={setPreset}
        custom={custom}
        onCustomChange={setCustom}
        range={range}
        resultNote={`${rows.length} of ${all.length} periods`}
      />

      {all.length === 0 && <div className="card">No power supply records for this branch yet.</div>}
      {all.length > 0 && rows.length === 0 && <div className="card">No periods match the selected date range.</div>}

      {latest && (
      <div className="card">
        <h3>Latest Period &middot; {latest.period_start} to {latest.period_end}</h3>
        <div className="stat-row" style={{ marginTop: 12 }}>
          <div className="stat">
            <span className="stat-label">Purchased</span>
            <span className="stat-value data">{latest.kwh_purchased.toLocaleString()} kWh</span>
          </div>
          <div className="stat">
            <span className="stat-label">Sold</span>
            <span className="stat-value data">{latest.kwh_sold.toLocaleString()} kWh</span>
          </div>
          <div className="stat">
            <span className="stat-label">Purchased Power Cost</span>
            <span className="stat-value data">{formatCurrency(latest.purchased_power_cost)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">WESM Price ({latest.wesm_prices?.grid_region ?? 'N/A'})</span>
            <span className="stat-value data">
              {latest.wesm_prices ? formatCurrency(latest.wesm_prices.price_per_kwh) + '/kWh' : 'N/A'}
            </span>
          </div>
        </div>
      </div>
      )}

      {rows.length > 0 && (<>
      <div className="card" style={{ height: 300 }}>
        <h3>kWh Purchased vs Sold</h3>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={kwhChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
            <XAxis dataKey="period" stroke="var(--text-muted)" style={axisStyle} />
            <YAxis stroke="var(--text-muted)" style={axisStyle} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Bar dataKey="purchased" fill="#3E7CB1" name="Purchased (kWh)" />
            <Bar dataKey="sold" fill="#4CAF7D" name="Sold (kWh)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card" style={{ height: 300 }}>
        <h3>Purchased Power Cost Trend</h3>
        <ResponsiveContainer width="100%" height="90%">
          <LineChart data={costChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
            <XAxis dataKey="period" stroke="var(--text-muted)" style={axisStyle} />
            <YAxis stroke="var(--text-muted)" style={axisStyle} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatCurrency(value)} />
            <Line type="monotone" dataKey="purchased_power_cost" stroke="#E2903F" name="Cost (PHP)" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card" style={{ height: 300 }}>
        <h3>Cost per kWh Sold vs WESM Price</h3>
        <ResponsiveContainer width="100%" height="90%">
          <LineChart data={costTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
            <XAxis dataKey="period_start" stroke="var(--text-muted)" style={axisStyle} />
            <YAxis stroke="var(--text-muted)" style={axisStyle} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatCurrency(value)} />
            <Legend />
            <Line type="monotone" dataKey="cost_per_kwh_sold" stroke="#E2903F" name="Cost / kWh Sold" strokeWidth={2} />
            <Line type="monotone" dataKey="wesm_price_per_kwh" stroke="#8CA0B3" name="WESM Price / kWh" strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h3>Records</h3>
        <table>
          <thead>
            <tr>
              <th>Period</th>
              <th>Purchased (kWh)</th>
              <th>Sold (kWh)</th>
              <th>Power Cost</th>
              <th>WESM Price</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="data">{r.period_start} – {r.period_end}</td>
                <td className="data">{r.kwh_purchased.toLocaleString()}</td>
                <td className="data">{r.kwh_sold.toLocaleString()}</td>
                <td className="data">{formatCurrency(r.purchased_power_cost)}</td>
                <td className="data">{r.wesm_prices ? `${formatCurrency(r.wesm_prices.price_per_kwh)}/kWh` : '—'}</td>
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
