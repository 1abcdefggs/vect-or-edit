import { describe, expect, it } from 'vitest';
import {
  CUSTOM,
  DELAY_PRESETS_MS,
  formatClock,
  formatDelayAmount,
  parseClock,
  presetValueFor
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

  it('writes preset labels as the number only, the unit is the row heading', () => {
    expect(formatDelayAmount(1500)).toBe('1.5');
    expect(formatDelayAmount(30000)).toBe('30');
    expect(formatDelayAmount(300000)).toBe('5');
  });

  it('shows a stored pause as m:ss', () => {
    expect(formatClock(630000)).toBe('10:30');
    expect(formatClock(1500)).toBe('0:01.5');
    expect(formatClock(5000)).toBe('0:05');
    expect(formatClock(3600000)).toBe('60:00');
  });

  it('reads m:ss, plain seconds with a dot, and rejects a comma or bad values', () => {
    expect(parseClock('10:30')).toBe(630000);
    expect(parseClock('0:01.5')).toBe(1500);
    expect(parseClock('1.5')).toBe(1500);
    expect(parseClock('90')).toBe(90000);
    expect(Number.isNaN(parseClock('1,5'))).toBe(true);
    expect(Number.isNaN(parseClock('10:75'))).toBe(true);
    expect(Number.isNaN(parseClock(''))).toBe(true);
    expect(Number.isNaN(parseClock('abc'))).toBe(true);
  });
});
