import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../../../core/constants.js';
import { getTooltipGap, getTooltipGapRatio, setTooltipGap, TOOLTIP_GAPS } from '../tooltipGap.js';
import { isTooltipEnabled, setTooltipEnabled } from '../tooltipEnabled.js';
import { applyTooltipWidth, getTooltipWidth, setTooltipWidth, TOOLTIP_WIDTHS } from '../tooltipWidth.js';

let store: Map<string, string>;
let cssVars: Map<string, string>;

beforeEach(() => {
  store = new Map();
  cssVars = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k) : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal('document', {
    documentElement: { style: { setProperty: (k: string, v: string) => void cssVars.set(k, v) } },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('tooltipEnabled', () => {
  it('is on by default and for unknown stored values', () => {
    expect(isTooltipEnabled()).toBe(true);
    store.set(STORAGE_KEYS.TOOLTIP_ENABLED, 'garbage');
    expect(isTooltipEnabled()).toBe(true);
  });

  it('round-trips off and on', () => {
    setTooltipEnabled(false);
    expect(store.get(STORAGE_KEYS.TOOLTIP_ENABLED)).toBe('off');
    expect(isTooltipEnabled()).toBe(false);
    setTooltipEnabled(true);
    expect(isTooltipEnabled()).toBe(true);
  });

  it('stays on when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
    });
    expect(isTooltipEnabled()).toBe(true);
  });
});

describe('tooltipGap', () => {
  it('defaults to standard', () => {
    expect(getTooltipGap()).toBe('standard');
    expect(getTooltipGapRatio()).toBe(TOOLTIP_GAPS.standard);
  });

  it('orders near < standard < far', () => {
    expect(TOOLTIP_GAPS.near).toBeLessThan(TOOLTIP_GAPS.standard);
    expect(TOOLTIP_GAPS.standard).toBeLessThan(TOOLTIP_GAPS.far);
  });

  it('stores a valid value and returns its ratio', () => {
    setTooltipGap('far');
    expect(getTooltipGap()).toBe('far');
    expect(getTooltipGapRatio()).toBe(TOOLTIP_GAPS.far);
  });

  it('ignores an invalid value on write and falls back on read', () => {
    setTooltipGap('huge');
    expect(store.has(STORAGE_KEYS.TOOLTIP_GAP)).toBe(false);
    store.set(STORAGE_KEYS.TOOLTIP_GAP, 'toString');
    expect(getTooltipGap()).toBe('standard');
    expect(getTooltipGapRatio()).toBe(TOOLTIP_GAPS.standard);
  });
});

describe('tooltipWidth', () => {
  it('defaults to short', () => {
    expect(getTooltipWidth()).toBe('short');
  });

  it('applies the CSS variable and returns the key used', () => {
    expect(applyTooltipWidth('long')).toBe('long');
    expect(cssVars.get('--wrap-width')).toBe(TOOLTIP_WIDTHS.long);
  });

  it('falls back to short for an unknown value', () => {
    expect(applyTooltipWidth('wide')).toBe('short');
    expect(cssVars.get('--wrap-width')).toBe(TOOLTIP_WIDTHS.short);
  });

  it('setTooltipWidth stores and applies; an invalid value changes nothing', () => {
    setTooltipWidth('long');
    expect(getTooltipWidth()).toBe('long');
    expect(cssVars.get('--wrap-width')).toBe('75ch');
    setTooltipWidth('nope');
    expect(getTooltipWidth()).toBe('long');
  });
});
