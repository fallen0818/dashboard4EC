import { useState } from 'react';
import { DateRange, PresetKey, rangeForPreset } from '../utils/dateRange';

// Manages a dashboard's active date range: a chosen preset plus any custom
// from/to the user typed.
export function useDateRange(initial: PresetKey = 'all') {
  const [preset, setPreset] = useState<PresetKey>(initial);
  const [custom, setCustom] = useState<DateRange>({ from: null, to: null });

  const range: DateRange = preset === 'custom' ? custom : (rangeForPreset(preset) as DateRange);

  return { preset, setPreset, custom, setCustom, range };
}
