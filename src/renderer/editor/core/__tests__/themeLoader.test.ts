import { describe, it, expect } from 'vitest';
import { normalizeTheme, availableThemes, getThemeData } from '../themeLoader.js';

describe('normalizeTheme', () => {
  it('converts a VS Code light theme to a Monaco theme', () => {
    const t = normalizeTheme({
      type: 'light',
      colors: { 'editor.background': '#ffffff' },
      tokenColors: [
        { scope: 'comment', settings: { foreground: '#008000', fontStyle: 'italic' } },
        { scope: ['keyword.control', 'storage.type'], settings: { foreground: '#0000ff' } },
        { scope: 'string, constant.character', settings: { foreground: '#a31515' } },
        { settings: { foreground: '#000000' } },
        { scope: 'meta.nothing', settings: {} }
      ]
    });
    expect(t.base).toBe('vs');
    expect(t.inherit).toBe(true);
    expect(t.rules).toEqual([
      { token: 'comment', foreground: '008000', fontStyle: 'italic' },
      { token: 'keyword.control', foreground: '0000ff' },
      { token: 'storage.type', foreground: '0000ff' },
      { token: 'string', foreground: 'a31515' },
      { token: 'constant.character', foreground: 'a31515' },
      { token: '', foreground: '000000' }
    ]);
  });

  it('treats a VS Code theme without a light type as dark', () => {
    expect(normalizeTheme({ type: 'dark', colors: {} }).base).toBe('vs-dark');
    expect(normalizeTheme({ colors: {} }).base).toBe('vs-dark');
  });

  it('keeps a Monaco theme as it is', () => {
    const monacoTheme = { base: 'vs', inherit: true, rules: [{ token: 'keyword', foreground: 'ff0000' }], colors: { 'editor.background': '#fff' } };
    expect(normalizeTheme(monacoTheme)).toEqual(monacoTheme);
  });

  it('leaves every bundled theme with the same base and rules', () => {
    for (const name of availableThemes) {
      const t = getThemeData(name);
      expect(['vs', 'vs-dark']).toContain(t.base);
      expect(Array.isArray(t.rules)).toBe(true);
    }
  });
});
