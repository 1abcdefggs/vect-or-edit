import { describe, expect, it } from 'vitest';
import { contrastOf, markColourFor } from '../markColour.js';

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

describe('markColourFor', () => {
  it('keeps the plain inverse when it already meets 3:1 on every background', () => {
    expect(markColourFor('#FF3399', ['#1e1e1e'])).toBe('#00cc66');
  });

  it('lightens or darkens the mark until 3:1 holds on every background', () => {
    const backgrounds = ['#87abdb', '#e5e5e5', '#ffffff'];
    const mark = markColourFor('#2f5f9e', backgrounds);
    expect(mark).not.toBe('#d0a061');
    for (const bg of backgrounds) expect(contrastOf(rgb(mark), rgb(bg))).toBeGreaterThanOrEqual(3);
  });

  it('returns the inverse when there is no background to check', () => {
    expect(markColourFor('#000000', [])).toBe('#ffffff');
  });
});
