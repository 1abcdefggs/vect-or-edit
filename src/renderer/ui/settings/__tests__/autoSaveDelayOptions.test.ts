import { describe, expect, it } from 'vitest';
import {
  CUSTOM,
  DELAY_PRESETS_MS,
  formatDelayLabel,
  presetValueFor,
  splitForCustom,
  toMs
} from '../autoSaveDelayOptions.js';
import { AUTO_SAVE_DELAY_RANGE_MS } from '../../../editor/ui/autoSaveManager.js';

describe('autoSaveDelayOptions', () => {
  it('keeps every preset inside the allowed range', () => {
    for (const ms of DELAY_PRESETS_MS) {
      expect(ms).toBeGreaterThanOrEqual(AUTO_SAVE_DELAY_RANGE_MS.min);
      expect(ms).toBeLessThanOrEqual(AUTO_SAVE_DELAY_RANGE_MS.max);
    }
  });

  it('allows up to 60 minutes', () => {
    expect(AUTO_SAVE_DELAY_RANGE_MS.max).toBe(60 * 60 * 1000);
  });

  it('selects the preset a stored value equals, and the custom entry otherwise', () => {
    expect(presetValueFor(1500)).toBe('1500');
    expect(presetValueFor(300000)).toBe('300000');
    expect(presetValueFor(90000)).toBe(CUSTOM);
    expect(presetValueFor(2500)).toBe(CUSTOM);
  });

  it('shows whole minutes in minutes and everything else in seconds', () => {
    expect(splitForCustom(420000)).toEqual({ unit: 'min', amount: 7 });
    expect(splitForCustom(90000)).toEqual({ unit: 'sec', amount: 90 });
    expect(splitForCustom(2500)).toEqual({ unit: 'sec', amount: 2.5 });
    expect(splitForCustom(60000)).toEqual({ unit: 'min', amount: 1 });
  });

  it('converts a typed amount and unit to milliseconds', () => {
    expect(toMs('90', 'sec')).toBe(90000);
    expect(toMs('7', 'min')).toBe(420000);
    expect(toMs('0.5', 'sec')).toBe(500);
    expect(Number.isNaN(toMs('', 'sec'))).toBe(true);
    expect(Number.isNaN(toMs('abc', 'min'))).toBe(true);
  });

  it('writes preset labels from the unit names', () => {
    const names = { sec: 's', min: 'min' };
    expect(formatDelayLabel(1500, names)).toBe('1.5 s');
    expect(formatDelayLabel(30000, names)).toBe('30 s');
    expect(formatDelayLabel(300000, names)).toBe('5 min');
  });
});
