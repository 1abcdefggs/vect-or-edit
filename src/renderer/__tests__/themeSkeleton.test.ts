import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  THEME_COLOR_KEYS,
  SKELETON_ACCENT,
  buildThemeFromPalette,
  contrastRatio,
  mixColors,
} from '../editor/core/themeSkeleton.js';

const themesDir = path.resolve(__dirname, '..', 'themes');
const reference = (file: string) => JSON.parse(fs.readFileSync(path.join(themesDir, file), 'utf8'));
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

describe('theme skeleton', () => {
  it('has exactly the colour keys of the GitHub theme files, in both faces', () => {
    for (const file of ['GitHub.dark.json', 'GitHub.light.json']) {
      expect(Object.keys(reference(file).colors), file).toEqual(THEME_COLOR_KEYS);
    }
  });

  it('builds every key, each a valid colour, for both faces', () => {
    for (const [base, background, foreground] of [['vs-dark', '#24292e', '#f6f8fa'], ['vs', '#ffffff', '#24292e']] as const) {
      const theme = buildThemeFromPalette({ base, background, foreground });
      expect(Object.keys(theme.colors)).toEqual(THEME_COLOR_KEYS);
      for (const [key, value] of Object.entries(theme.colors)) {
        expect(value, key).toMatch(HEX);
      }
      expect(theme.base).toBe(base);
      expect(theme.inherit).toBe(true);
      expect(theme.rules).toEqual([]);
    }
  });

  it('keeps the given background and text exactly', () => {
    const theme = buildThemeFromPalette({ base: 'vs-dark', background: '#101a2a', foreground: '#edf5ff' });
    expect(theme.colors['editor.background']).toBe('#101a2a');
    expect(theme.colors['editor.foreground']).toBe('#edf5ff');
  });

  it('reads the text on the background (WCAG AA, 4.5:1) for both faces and the button text on the accent', () => {
    const light = buildThemeFromPalette({ base: 'vs', background: '#ffffff', foreground: '#24292e' });
    const dark = buildThemeFromPalette({ base: 'vs-dark', background: '#24292e', foreground: '#f6f8fa' });
    for (const theme of [light, dark]) {
      expect(contrastRatio(theme.colors['editor.foreground'], theme.colors['editor.background'])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.colors['button.foreground'], theme.colors['button.background'])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('puts the title bar darker than the editor on the dark face, and on the same step as the panel on the light face', () => {
    const dark = buildThemeFromPalette({ base: 'vs-dark', background: '#24292e', foreground: '#f6f8fa' });
    const light = buildThemeFromPalette({ base: 'vs', background: '#ffffff', foreground: '#24292e' });
    expect(contrastRatio(dark.colors['titleBar.activeBackground'], '#000000')).toBeLessThan(
      contrastRatio(dark.colors['editor.background'], '#000000'),
    );
    expect(light.colors['titleBar.activeBackground']).toBe(light.colors['sideBar.background']);
  });

  it('uses the app accent for the selection and the button unless another accent is given', () => {
    const theme = buildThemeFromPalette({ base: 'vs', background: '#ffffff', foreground: '#000000' });
    expect(theme.colors['button.background']).toBe(SKELETON_ACCENT);
    const other = buildThemeFromPalette({ base: 'vs', background: '#ffffff', foreground: '#000000', accent: '#ff0000' });
    expect(other.colors['button.background']).toBe('#ff0000');
  });

  it('mixes colours in sRGB, endpoints included', () => {
    expect(mixColors('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixColors('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mixColors('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('rejects a value that is not a hex colour', () => {
    expect(() => mixColors('red', '#ffffff', 0.5)).toThrow();
  });
});
