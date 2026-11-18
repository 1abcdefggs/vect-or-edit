import { describe, expect, it } from 'vitest';
import { FONT_MAX_BYTES, checkFontFile, fontDisplayName, parseStoredFont, storedFontName } from '../userFontFile';

describe('userFontFile', () => {
  it('accepts the four font extensions in any case and rejects others', () => {
    for (const name of ['a.ttf', 'a.OTF', 'a.woff', 'a.WOFF2']) expect(checkFontFile(name, 1000).ok).toBe(true);
    expect(checkFontFile('a.exe', 1000)).toEqual({ ok: false, problem: 'type' });
    expect(checkFontFile('noext', 1000)).toEqual({ ok: false, problem: 'type' });
  });

  it('rejects an empty or too large file', () => {
    expect(checkFontFile('a.ttf', 0)).toEqual({ ok: false, problem: 'empty' });
    expect(checkFontFile('a.ttf', FONT_MAX_BYTES + 1)).toEqual({ ok: false, problem: 'size' });
    expect(checkFontFile('a.ttf', FONT_MAX_BYTES).ok).toBe(true);
  });

  it('builds a stored name that parses back to the display name and an alias', () => {
    const stored = storedFontName('0123456789ab', 'My Font: Bold.ttf', '.ttf');
    expect(stored).toBe('0123456789ab__My Font Bold.ttf');
    expect(parseStoredFont(stored)).toEqual({ id: '0123456789ab', name: 'My Font Bold', alias: 'UserFont-0123456789ab' });
    expect(fontDisplayName('a__b.ttf')).toBe('a_b');
  });

  it('does not parse a path or a stray file', () => {
    expect(parseStoredFont('../0123456789ab__x.ttf')).toBeNull();
    expect(parseStoredFont('0123456789ab__x.ttf/..')).toBeNull();
    expect(parseStoredFont('readme.txt')).toBeNull();
    expect(parseStoredFont('0123456789ab__x.exe')).toBeNull();
  });
});
