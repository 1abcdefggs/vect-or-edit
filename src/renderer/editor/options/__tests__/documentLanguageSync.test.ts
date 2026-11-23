import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = vi.hoisted(() => ({ overridden: new Set<string>(), baseline: {} as Record<string, unknown> }));
vi.mock('../monacoOptionsStore.js', () => ({
  getOverriddenPaths: () => store.overridden,
  setBaselinePaths: (v: Record<string, unknown>) => Object.assign(store.baseline, v)
}));

import { editorEvents } from '../../core/editorEvents.js';
import { applyLanguageOptions, bindDocumentLanguage, setManualLanguageProvider, requestLanguageCheck } from '../documentLanguageSync.js';

// kana and kanji written as escapes (the English-only guard forbids Japanese text here)
const JA = '\u3042\u3044\u3046\u3048\u304A\u6F22\u5B57\u3002'.repeat(30);
const EN = 'This is an English sentence about writing tools and editors. '.repeat(8);

function fakeEditor(text: string) {
  let value = text;
  const handlers: Record<string, Array<() => void>> = { model: [], content: [] };
  const on = (k: string) => (fn: () => void) => { handlers[k].push(fn); return { dispose: () => { handlers[k] = handlers[k].filter((h) => h !== fn); } }; };
  return {
    updates: [] as any[],
    updateOptions(o: any) { this.updates.push(o); },
    // Single-line stand-in: the offset is the column, so the range read is the first `column - 1` characters
    getModel: () => ({
      getValue: () => value,
      getPositionAt: (offset: number) => ({ lineNumber: 1, column: Math.min(offset, value.length) + 1 }),
      getValueInRange: (r: { endColumn: number }) => value.slice(0, r.endColumn - 1)
    }),
    onDidChangeModel: on('model'),
    onDidChangeModelContent: on('content'),
    switchTo(t: string) { value = t; handlers.model.forEach((h) => h()); },
    type(t: string) { value = t; handlers.content.forEach((h) => h()); }
  };
}

beforeEach(() => { store.overridden = new Set(); store.baseline = {}; vi.useFakeTimers(); });

describe('applyLanguageOptions', () => {
  it('applies the Japanese values and records them in the baseline', () => {
    const ed: any = fakeEditor('');
    applyLanguageOptions(ed, 'ja');
    expect(ed.updates[0].wrappingStrategy).toBe('advanced');
    expect(ed.updates[0].unicodeHighlight.allowedLocales.ja).toBe(true);
    expect(store.baseline.wrappingIndent).toBe('none');
  });
  it('never touches a path the user overrode', () => {
    store.overridden = new Set(['wrappingIndent', 'unicodeHighlight.allowedLocales']);
    const ed: any = fakeEditor('');
    const applied = applyLanguageOptions(ed, 'ja');
    expect(applied).not.toContain('wrappingIndent');
    expect(applied).not.toContain('unicodeHighlight.allowedLocales');
    expect(ed.updates[0].wrappingIndent).toBeUndefined();
    expect(ed.updates[0].wrappingStrategy).toBe('advanced');
  });
  it('puts Monaco values back for a language without its own', () => {
    const ed: any = fakeEditor('');
    applyLanguageOptions(ed, 'en');
    expect(ed.updates[0]).toMatchObject({ wrappingStrategy: 'simple', wrappingIndent: 'same', wordSegmenterLocales: [] });
  });
});

describe('bindDocumentLanguage', () => {
  const opts = { getUiLanguage: () => 'en' };
  it('applies at start, then again only when the language changes', () => {
    const ed: any = fakeEditor(JA);
    bindDocumentLanguage(ed, opts);
    expect(ed.updates).toHaveLength(1);
    ed.switchTo(JA + 'x');
    expect(ed.updates).toHaveLength(1);
    ed.switchTo(EN);
    expect(ed.updates).toHaveLength(2);
    expect(ed.updates[1].wrappingStrategy).toBe('simple');
  });
  it('waits for a pause in typing before checking the text', () => {
    const ed: any = fakeEditor(EN);
    bindDocumentLanguage(ed, opts);
    ed.type(JA);
    expect(ed.updates).toHaveLength(1);
    vi.advanceTimersByTime(700);
    expect(ed.updates).toHaveLength(2);
    expect(ed.updates[1].wrappingStrategy).toBe('advanced');
  });
  it('follows a manual language and stops after dispose', () => {
    let manual = '';
    const ed: any = fakeEditor(EN);
    const stop = bindDocumentLanguage(ed, { ...opts, getManualLanguage: () => manual });
    manual = 'ja';
    ed.switchTo(EN);
    expect(ed.updates).toHaveLength(2);
    stop();
    ed.switchTo(JA);
    expect(ed.updates).toHaveLength(2);
  });
  it('announces the language and its source on every check, and honours the manual provider and a forced check', () => {
    const seen: any[] = [];
    const off = editorEvents.on('onDocumentLanguageChanged', (e: any) => seen.push(e));
    let manual = '';
    setManualLanguageProvider(() => manual);
    const ed: any = fakeEditor(EN);
    const stop = bindDocumentLanguage(ed, opts);
    expect(seen[0]).toEqual({ language: 'en', source: 'ui', manual: '' });
    manual = 'ja';
    requestLanguageCheck();
    expect(seen[1]).toEqual({ language: 'ja', source: 'manual', manual: 'ja' });
    expect(ed.updates).toHaveLength(2);
    stop();
    requestLanguageCheck();
    expect(seen).toHaveLength(2);
    off();
    setManualLanguageProvider(null as any);
  });
});
