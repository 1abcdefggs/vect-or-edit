import { describe, expect, it } from 'vitest';
import {
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_SIZE_PRESETS,
  clampFontSize,
  isPresetSize
} from '../fontSizeOptions.js';

describe('fontSizeOptions', () => {
  it('keeps presets inside the range and sorted', () => {
    expect([...FONT_SIZE_PRESETS].sort((a, b) => a - b)).toEqual(FONT_SIZE_PRESETS);
    expect(Math.min(...FONT_SIZE_PRESETS)).toBeGreaterThanOrEqual(FONT_SIZE_MIN);
    expect(Math.max(...FONT_SIZE_PRESETS)).toBeLessThanOrEqual(FONT_SIZE_MAX);
  });

  it('clamps an own value to 8..72 and rounds it', () => {
    expect(clampFontSize(3)).toBe(8);
    expect(clampFontSize(500)).toBe(72);
    expect(clampFontSize('17.6')).toBe(18);
    expect(clampFontSize('abc')).toBeNull();
  });

  it('tells presets from own values', () => {
    expect(isPresetSize(16)).toBe(true);
    expect(isPresetSize('24')).toBe(true);
    expect(isPresetSize(17)).toBe(false);
  });
});
