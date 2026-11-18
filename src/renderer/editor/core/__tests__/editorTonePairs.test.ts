import { describe, expect, it } from 'vitest';
import {
  TONE_PAIRS,
  contrastRatio,
  isLightTone,
  normalizeTone,
  pairFor,
  wcagLevel
} from '../editorTonePairs.js';

describe('editorTonePairs', () => {
  it('has eight pairs with unique keys, dark family first', () => {
    expect(TONE_PAIRS).toHaveLength(8);
    expect(new Set(TONE_PAIRS.map((p) => p.key)).size).toBe(8);
    expect(TONE_PAIRS.slice(0, 4).every((p) => p.family === 'dark')).toBe(true);
    expect(TONE_PAIRS.slice(4).every((p) => p.family === 'light')).toBe(true);
  });

  it('keeps every pair readable (contrast 7 or more, the WCAG AAA level for normal text)', () => {
    for (const pair of TONE_PAIRS) {
      expect(contrastRatio(pair.bg, pair.fg), pair.key).toBeGreaterThanOrEqual(7);
    }
  });

  it('marks the family by the background: dark pairs have a dark background, light pairs a light one', () => {
    for (const pair of TONE_PAIRS) {
      expect(contrastRatio(pair.bg, '#000000') < contrastRatio(pair.bg, '#ffffff'), pair.key).toBe(pair.isDark);
    }
  });

  it('keeps the soft level softer than the crisp level (lower contrast with the other colour)', () => {
    const find = (key: string) => TONE_PAIRS.find((p) => p.key === key)!;
    for (const family of ['dark', 'light']) {
      const crispText = contrastRatio(find(`${family}_crisp_crisp`).bg, find(`${family}_crisp_crisp`).fg);
      const softText = contrastRatio(find(`${family}_crisp_soft`).bg, find(`${family}_crisp_soft`).fg);
      expect(softText, family).toBeLessThan(crispText);
    }
  });

  it('turns the old stored values into their crisp / crisp pair', () => {
    expect(normalizeTone('oled')).toBe('dark_crisp_crisp');
    expect(normalizeTone('snow')).toBe('light_crisp_crisp');
    expect(normalizeTone('dark_oled')).toBe('dark_crisp_crisp');
    expect(normalizeTone('light_snow')).toBe('light_crisp_crisp');
    expect(normalizeTone('default')).toBe('default');
    expect(normalizeTone('custom')).toBe('custom');
  });

  it('keeps the colours of the old OLED and Snow tones', () => {
    expect(pairFor('oled')).toMatchObject({ bg: '#000000', fg: '#f8fafc', gutter: '#000000', lineNo: '#475569' });
    expect(pairFor('snow')).toMatchObject({ bg: '#ffffff', fg: '#0f172a', gutter: '#f8fafc', lineNo: '#94a3b8' });
  });

  it('finds no pair for default, custom and unknown values', () => {
    expect(pairFor('default')).toBeNull();
    expect(pairFor('custom')).toBeNull();
    expect(pairFor('nope')).toBeNull();
  });

  it('tells a light tone from the stored value', () => {
    expect(isLightTone('snow')).toBe(true);
    expect(isLightTone('light_soft_soft')).toBe(true);
    expect(isLightTone('dark_soft_soft')).toBe(false);
    expect(isLightTone('default')).toBe(false);
  });

  it('names the WCAG level of a ratio: AAA from 7, AA from 4.5, otherwise below', () => {
    expect(wcagLevel(21)).toBe('AAA');
    expect(wcagLevel(7)).toBe('AAA');
    expect(wcagLevel(6.99)).toBe('AA');
    expect(wcagLevel(4.5)).toBe('AA');
    expect(wcagLevel(4.49)).toBe('below');
  });
});
