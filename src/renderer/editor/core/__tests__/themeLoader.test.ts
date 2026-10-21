import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeTheme, availableThemes, getThemeData, getColorMode, getResolvedThemeName, getStoredThemeSetting, hasBothFaces } from '../themeLoader.js';
import { STORAGE_KEYS } from '../../../core/constants';

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
      for (const face of ['light', 'dark'] as const) {
        const t = getThemeData(name, face);
        expect(['vs', 'vs-dark']).toContain(t.base);
        expect(Array.isArray(t.rules)).toBe(true);
      }
    }
  });
});

describe('themes with light and dark faces', () => {
  const store: Record<string, string> = {};
  const setOsDark = (dark: boolean) => {
    (globalThis as any).window = { matchMedia: () => ({ matches: dark, addEventListener() {} }) };
  };

  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    (globalThis as any).localStorage = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v; }
    };
    setOsDark(true);
  });

  it('lists each theme once, every bundled one with both faces', () => {
    expect(availableThemes).toEqual(['Dracula', 'GitHub', 'Monokai', 'Night Owl', 'Tukune']);
    for (const name of availableThemes) expect(hasBothFaces(name)).toBe(true);
    for (const name of availableThemes) {
      expect(getThemeData(name, 'light').base).toBe('vs');
      expect(getThemeData(name, 'dark').base).toBe('vs-dark');
    }
  });

  it('keeps the theme and switches its face with the mode', () => {
    store[STORAGE_KEYS.THEME] = 'Dracula';
    store[STORAGE_KEYS.COLOR_MODE] = 'light';
    expect(getResolvedThemeName(getStoredThemeSetting())).toBe('Dracula Light');
    store[STORAGE_KEYS.COLOR_MODE] = 'dark';
    setOsDark(false);
    expect(getResolvedThemeName(getStoredThemeSetting())).toBe('Dracula Dark');
  });

  it('follows the OS in system mode', () => {
    store[STORAGE_KEYS.THEME] = 'Tukune';
    store[STORAGE_KEYS.COLOR_MODE] = 'system';
    expect(getResolvedThemeName('Tukune')).toBe('Tukune Dark');
    setOsDark(false);
    expect(getResolvedThemeName('Tukune')).toBe('Tukune Light');
  });

  it('reads settings stored before faces existed', () => {
    expect(getStoredThemeSetting()).toBe('GitHub');
    expect(getColorMode()).toBe('system');
    store[STORAGE_KEYS.THEME] = 'auto';
    expect(getStoredThemeSetting()).toBe('GitHub');
    expect(getColorMode()).toBe('system');
    store[STORAGE_KEYS.THEME] = 'GitHub Light';
    expect(getStoredThemeSetting()).toBe('GitHub');
    expect(getColorMode()).toBe('light');
    store[STORAGE_KEYS.THEME] = 'Tukune';
    expect(getColorMode()).toBe('light');
    store[STORAGE_KEYS.THEME] = 'Night Owl';
    expect(getColorMode()).toBe('dark');
  });
});
