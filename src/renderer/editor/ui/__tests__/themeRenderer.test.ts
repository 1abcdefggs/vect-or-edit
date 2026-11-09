import { describe, it, expect, beforeEach } from 'vitest';
import { applyThemeToDOM } from '../themeRenderer.js';

// Minimal document: records the inline custom properties the renderer sets on <html>
function fakeDocument() {
  const props = new Map<string, string>();
  const style = {
    setProperty: (k: string, v: string) => props.set(k, v),
    removeProperty: (k: string) => props.delete(k),
    get: (k: string) => props.get(k),
  };
  return { props, doc: { documentElement: { style, classList: { toggle: () => {} } } } };
}

const darkTheme = {
  base: 'vs-dark',
  colors: {
    'editor.background': '#1e1e1e',
    'editor.foreground': '#d4d4d4',
    'sideBar.background': '#252526',
    'button.background': '#2563eb',
    'editorGroup.border': '#444444',
    'titleBar.activeBackground': '#181818',
  },
};

describe('applyThemeToDOM derived colours', () => {
  let ctx: ReturnType<typeof fakeDocument>;
  beforeEach(() => {
    ctx = fakeDocument();
    (globalThis as any).document = ctx.doc;
  });

  it('takes the accent from the theme button colour', () => {
    applyThemeToDOM(darkTheme);
    expect(ctx.props.get('--accent-color')).toBe('#2563eb');
    expect(ctx.props.get('--log-bg')).toBe('#1e1e1e');
    expect(ctx.props.get('--log-fg')).toBe('#d4d4d4');
  });

  it('leaves status colours, overlays and backdrop to the mode stylesheet', () => {
    applyThemeToDOM(darkTheme);
    for (const name of ['--success-color', '--warn-color', '--error-color', '--overlay-bg', '--overlay-fg', '--app-backdrop', '--modal-shadow', '--modal-overlay-bg']) {
      expect(ctx.props.has(name), name).toBe(false);
    }
  });

  it('uses the theme text colour in the shared tints, at the dark face alpha', () => {
    applyThemeToDOM(darkTheme);
    expect(ctx.props.get('--hover-bg')).toBe('rgba(212, 212, 212, 0.08)');
    expect(ctx.props.get('--select-bg')).toBe('rgba(37, 37, 38, 0.9)');
  });

  it('clears the previous theme values when the next theme is applied', () => {
    applyThemeToDOM(darkTheme);
    applyThemeToDOM({ base: 'vs-dark', colors: {} });
    // A theme without the colour falls back to the defaults, not to the previous theme
    expect(ctx.props.get('--accent-color')).toBe('#2563eb');
    expect(ctx.props.get('--hover-bg')).toBe('rgba(255, 255, 255, 0.08)');
  });
});
