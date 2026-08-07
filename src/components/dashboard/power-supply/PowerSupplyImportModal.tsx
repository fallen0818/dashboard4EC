'use client';

import { useState, ChangeEvent } from 'react';
import {
  parsePowerSupplyImportCsv,
  bulkInsertPowerSupplyRecords,
  powerSupplyCsvTemplate,
  type ParsedPowerSupplyImport,
} from '../../../services/powerSupplyService';
import { downloadCsv } from '../../../lib/csv';
import type { PowerSupplier } from '../../../models/powerSupply.types';

interface Props {
  branchId: string;
  suppliers: PowerSupplier[];
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export default function PowerSupplyImportModal({ branchId, suppliers, open, onClose, onImported }: Props) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedPowerSupplyImport | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!open) return null;

  function reset() {
    setFileName(null);
    setParsed(null);
    setSubmitError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file after fixing it
    if (!file) return;
    setSubmitError(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      setParsed(parsePowerSupplyImportCsv(text, branchId, suppliers));
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!parsed || parsed.valid.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await bulkInsertPowerSupplyRecords(parsed.valid);
      onImported();
      handleClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setSubmitting(false);
    }
  }

  const rowsWithErrors = parsed?.results.filter((r) => r.errors.length > 0) ?? [];
  const canImport = !!parsed && parsed.errorCount === 0 && parsed.valid.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Import Power Supply Records"
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16,
      }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 640, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', marginTop: 0 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Import Power Supply Records</h3>
          <button type="button" className="secondary" onClick={handleClose} aria-label="Close" style={{ padding: '4px 10px' }}>
            ✕
          </button>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 8 }}>
          CSV columns: <code>period_start, period_end, supplier_code, kwh_purchased,
          purchased_power_cost, generation_charge, transmission_charge, system_loss_charge</code>{' '}
          (dates as YYYY-MM-DD; charge columns optional; supplier_code must match an existing supplier).
        </p>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="secondary"
            onClick={() => downloadCsv('power_supply_import_template.csv', powerSupplyCsvTemplate())}
          >
            Download template
          </button>
          <label className="secondary" style={{ cursor: 'pointer', display: 'inline-block' }}>
            Choose CSV file…
            <input type="file" accept=".csv,text/csv" onChange={handleFile} style={{ display: 'none' }} />
          </label>
          {fileName && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{fileName}</span>}
        </div>

        {parsed && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: '0.9rem' }}>
              {parsed.results.length} row{parsed.results.length === 1 ? '' : 's'} parsed ·{' '}
              <span style={{ color: 'var(--signal-good)' }}>{parsed.valid.length} valid</span>
              {parsed.errorCount > 0 && (
                <> · <span style={{ color: 'var(--signal-bad)' }}>{parsed.errorCount} with errors</span></>
              )}
            </p>

            {rowsWithErrors.length > 0 && (
              <table style={{ marginTop: 8 }}>
                <thead>
                  <tr><th>Row</th><th>Errors</th></tr>
                </thead>
                <tbody>
                  {rowsWithErrors.map((r) => (
                    <tr key={r.row}>
                      <td className="data">{r.row}</td>
                      <td style={{ color: 'var(--signal-bad)' }}>{r.errors.join('; ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {parsed.errorCount > 0 && parsed.valid.length > 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 8 }}>
                Fix the rows above and re-upload — the whole file is imported together, so rows with
                errors block the valid ones too.
              </p>
            )}
          </div>
        )}

        {submitError && (
          <p style={{ color: 'var(--signal-bad)', fontSize: '0.85rem', marginTop: 12 }}>{submitError}</p>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button type="button" onClick={handleImport} disabled={!canImport || submitting}>
            {submitting ? 'Importing…' : parsed ? `Import ${parsed.valid.length} record${parsed.valid.length === 1 ? '' : 's'}` : 'Import'}
          </button>
          <button type="button" className="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
