import { describe, expect, it } from 'vitest';
import { LINE_HEIGHT_PRESETS, normalizeLineHeight } from '../lineHeightOptions.js';

describe('lineHeightOptions', () => {
  it('maps the old pixel values to the ratios of their labels', () => {
    expect(normalizeLineHeight('22')).toBe(1.4);
    expect(normalizeLineHeight('26')).toBe(1.6);
    expect(normalizeLineHeight('30')).toBe(1.8);
    expect(normalizeLineHeight(34)).toBe(2.0);
  });

  it('keeps a ratio and rounds it to one decimal', () => {
    expect(normalizeLineHeight('1.8')).toBe(1.8);
    expect(normalizeLineHeight(1.64)).toBe(1.6);
  });

  it('converts another pixel value by the old base size and clamps ratios', () => {
    expect(normalizeLineHeight(24)).toBe(1.5);
    expect(normalizeLineHeight(0.5)).toBe(1.0);
    expect(normalizeLineHeight(7.9)).toBe(3.0);
  });

  it('rejects what is not a number', () => {
    expect(normalizeLineHeight('abc')).toBeNull();
    expect(normalizeLineHeight(0)).toBeNull();
  });

  it('has presets that survive normalizing', () => {
    LINE_HEIGHT_PRESETS.forEach((ratio) => expect(normalizeLineHeight(ratio)).toBe(ratio));
  });
});
