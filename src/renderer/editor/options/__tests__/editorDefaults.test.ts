import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { marked } from 'marked';
import { EDITOR_DEFAULTS, buildMonacoBaseOptions, previewTypography } from '../editorDefaults.js';
import { DEFAULTS } from '../../../core/constants.js';

const runtime = {
  value: '',
  language: 'markdown',
  theme: 'vs-dark',
  fontSize: 16,
  fontFamily: DEFAULTS.FONT_FAMILY
};

describe('EDITOR_DEFAULTS (first-run Monaco defaults)', () => {
  it('matches the agreed first-run table', () => {
    expect(EDITOR_DEFAULTS).toMatchObject({
      wordWrap: 'on',
      fontSize: 16,
      lineHeight: 30,
      minimap: { enabled: false },
      lineNumbers: 'on',
      folding: true,
      renderWhitespace: 'none',
      renderLineHighlight: 'line',
      scrollBeyondLastLine: false,
      quickSuggestions: false,
      wordBasedSuggestions: 'off',
      formatOnPaste: false,
      formatOnType: false,
      tabSize: 2,
      insertSpaces: true,
      unicodeHighlight: { ambiguousCharacters: false, invisibleCharacters: false, nonBasicASCII: false }
    });
  });

  it('takes the font stack from the shared constant, with Japanese fallbacks', () => {
    expect(EDITOR_DEFAULTS.fontFamily).toBe(DEFAULTS.FONT_FAMILY);
    expect(EDITOR_DEFAULTS.fontFamily).toContain('Source Serif 4');
    expect(EDITOR_DEFAULTS.fontFamily).toContain('Noto Serif JP');
  });

  it('leaves autoClosing options to the Monaco language default', () => {
    expect(EDITOR_DEFAULTS).not.toHaveProperty('autoClosingBrackets');
    expect(EDITOR_DEFAULTS).not.toHaveProperty('autoClosingQuotes');
  });
});

describe('buildMonacoBaseOptions', () => {
  it('applies every default to the options passed to monaco.editor.create', () => {
    const options = buildMonacoBaseOptions(runtime) as Record<string, unknown>;
    expect(options.wordWrap).toBe('on');
    expect(options.lineHeight).toBe(30);
    expect(options.renderLineHighlight).toBe('line');
    expect(options.folding).toBe(true);
    expect(options.unicodeHighlight).toEqual({ ambiguousCharacters: false, invisibleCharacters: false, nonBasicASCII: false });
  });

  it('prefers the saved font size and family over the defaults', () => {
    const options = buildMonacoBaseOptions({ ...runtime, fontSize: 18, fontFamily: 'Custom' }) as Record<string, unknown>;
    expect(options.fontSize).toBe(18);
    expect(options.fontFamily).toBe('Custom');
  });

  it('returns fresh nested objects so callers cannot change the defaults', () => {
    const a = buildMonacoBaseOptions(runtime) as any;
    a.minimap.enabled = true;
    a.unicodeHighlight.nonBasicASCII = true;
    const b = buildMonacoBaseOptions(runtime) as any;
    expect(b.minimap.enabled).toBe(false);
    expect(b.unicodeHighlight.nonBasicASCII).toBe(false);
    expect(EDITOR_DEFAULTS.minimap.enabled).toBe(false);
  });
});

describe('previewTypography', () => {
  it('copies the editor font, size and line height in px', () => {
    expect(previewTypography({ fontFamily: 'X', fontSize: 18, lineHeight: 30 })).toEqual({
      fontFamily: 'X', fontSize: 18, lineHeightPx: 30
    });
  });

  it('reads a line height below 8 as a multiplier of the font size', () => {
    expect(previewTypography({ fontSize: 16, lineHeight: 1.8 }).lineHeightPx).toBeCloseTo(28.8);
  });

  it('falls back to the defaults when the editor has not reported its options', () => {
    expect(previewTypography({})).toEqual({
      fontFamily: EDITOR_DEFAULTS.fontFamily,
      fontSize: EDITOR_DEFAULTS.fontSize,
      lineHeightPx: EDITOR_DEFAULTS.lineHeight
    });
  });
});

describe('preview line breaks', () => {
  it('turns a single newline into a line break (marked breaks: true)', () => {
    const html = marked.parse('一行目\n二行目', { gfm: true, breaks: true, async: false }) as string;
    expect(html).toContain('<br>');
    expect(html).not.toMatch(/一行目\s二行目/);
  });
});

describe('editorDefaults.js source', () => {
  it('contains no Japanese literals (text lives in the locale dictionaries)', () => {
    const source = readFileSync(resolve(__dirname, '..', 'editorDefaults.js'), 'utf8');
    expect(source).not.toMatch(/[぀-ヿ㐀-鿿＀-￯]/);
  });
});
