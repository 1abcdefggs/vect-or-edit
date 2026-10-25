import { describe, expect, it } from 'vitest';
import { FONT_NAME_MAX, FONT_NAME_MIN, fontNameWidth } from '../editorStyleGroupFit';

describe('editor style group fit', () => {
  it('keeps the font name at its full width while the bar is wide', () => {
    expect(fontNameWidth(683)).toBe(FONT_NAME_MAX);
    expect(fontNameWidth(571)).toBe(FONT_NAME_MAX);
  });

  it('shortens the font name in step with the bar', () => {
    expect(fontNameWidth(540)).toBe(84);
    expect(fontNameWidth(526)).toBe(70);
  });

  it('never goes below the minimum, even in a very narrow bar', () => {
    expect(fontNameWidth(348)).toBe(FONT_NAME_MIN);
    expect(fontNameWidth(0)).toBe(FONT_NAME_MIN);
  });
});
