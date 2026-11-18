import { describe, expect, it } from 'vitest';
import {
  composeName,
  cleanNameText,
  formatNameDate,
  formatNameTime,
  nextFreeName,
  sanitizeNameTokens
} from '../documentName';

const noon = new Date(2026, 10, 18, 6, 37); // 2026-11-18 06:37 local time

describe('sanitizeNameTokens', () => {
  it('keeps known tokens in their order and drops repeats and unknown values', () => {
    expect(sanitizeNameTokens(['seq', 'name', 'seq', 'bogus'])).toEqual(['seq', 'name']);
  });

  it('falls back to the default for a non-array and to the name alone for an empty choice', () => {
    expect(sanitizeNameTokens(undefined)).toEqual(['name', 'seq']);
    expect(sanitizeNameTokens([])).toEqual(['name']);
  });
});

describe('date and time parts', () => {
  it('formats local date as YYYYMMDD and time as HHmm', () => {
    expect(formatNameDate(noon)).toBe('20261118');
    expect(formatNameTime(noon)).toBe('0637');
  });
});

describe('cleanNameText', () => {
  it('removes characters that cannot be in a file name and trims', () => {
    expect(cleanNameText('  a/b:c*?  ')).toBe('abc');
  });

  it('limits the length', () => {
    expect(cleanNameText('x'.repeat(100))).toHaveLength(40);
  });
});

describe('composeName', () => {
  const parts = { name: 'Doc', seq: 3, now: noon, text: 'memo' };

  it('joins the chosen parts in the chosen order', () => {
    expect(composeName(['name', 'seq'], parts)).toBe('Doc-3');
    expect(composeName(['seq', 'name'], parts)).toBe('3-Doc');
    expect(composeName(['name', 'date', 'time', 'seq'], parts)).toBe('Doc-20261118-0637-3');
    expect(composeName(['name', 'text'], parts)).toBe('Doc-memo');
  });

  it('leaves out empty parts', () => {
    expect(composeName(['name', 'text'], { ...parts, text: '' })).toBe('Doc');
  });
});

describe('nextFreeName', () => {
  it('uses the smallest free number when there is a sequence token', () => {
    const used = new Set(['Doc-1', 'Doc-2', 'Doc-4']);
    expect(nextFreeName(['name', 'seq'], { name: 'Doc', now: noon, text: '' }, used)).toBe('Doc-3');
  });

  it('adds -2, -3 on a clash when there is no sequence token', () => {
    const used = new Set(['Doc-20261118-0637']);
    expect(nextFreeName(['name', 'date', 'time'], { name: 'Doc', now: noon, text: '' }, used)).toBe('Doc-20261118-0637-2');
  });

  it('returns the base name when it is free and there is no sequence token', () => {
    expect(nextFreeName(['name', 'date'], { name: 'Doc', now: noon, text: '' }, new Set())).toBe('Doc-20261118');
  });
});
