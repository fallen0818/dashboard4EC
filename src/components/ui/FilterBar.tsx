'use client';

import { ReactNode } from 'react';
import { DateRange, PresetKey, PRESETS, describeRange } from '../../utils/dateRange';

// A labelled category dropdown for use as a FilterBar child.
export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="filter-control">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface Props {
  preset: PresetKey;
  onPresetChange: (key: PresetKey) => void;
  custom: DateRange;
  onCustomChange: (range: DateRange) => void;
  range: DateRange;
  /** Extra category controls (e.g. status / type dropdowns) rendered inline. */
  children?: ReactNode;
  /** Optional note appended to the summary (e.g. "12 of 30 shown"). */
  resultNote?: string;
}

export default function FilterBar({
  preset,
  onPresetChange,
  custom,
  onCustomChange,
  range,
  children,
  resultNote,
}: Props) {
  const showCustom = preset === 'custom';

  return (
    <div className="filter-bar">
      <div className="filter-chips">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onPresetChange(p.key)}
            className={`filter-chip${preset === p.key ? ' active' : ''}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {(showCustom || children) && (
        <div className="filter-controls">
          {showCustom && (
            <>
              <div className="filter-control">
                <label htmlFor="filter-from">From</label>
                <input
                  id="filter-from"
                  type="date"
                  value={custom.from ?? ''}
                  onChange={(e) => onCustomChange({ ...custom, from: e.target.value || null })}
                />
              </div>
              <div className="filter-control">
                <label htmlFor="filter-to">To</label>
                <input
                  id="filter-to"
                  type="date"
                  value={custom.to ?? ''}
                  onChange={(e) => onCustomChange({ ...custom, to: e.target.value || null })}
                />
              </div>
            </>
          )}
          {children}
        </div>
      )}

      <p className="filter-summary">
        {describeRange(range)}
        {resultNote ? ` · ${resultNote}` : ''}
      </p>
    </div>
  );
}
