import { describe, it, expect } from 'vitest';
import * as mod from '../documentLanguage.js';

const lang: any = mod;
// kana and kanji written as escapes (the English-only guard forbids Japanese text here)
const JA = '\u3042\u3044\u3046\u3048\u304A\u6F22\u5B57\u3002'.repeat(30);
const EN = 'This is an English sentence about writing tools and editors. '.repeat(8);

describe('normalizeLanguage', () => {
  it('reduces tags to the primary subtag', () => {
    expect(lang.normalizeLanguage('ja-JP')).toBe('ja');
    expect(lang.normalizeLanguage('EN_us')).toBe('en');
    expect(lang.normalizeLanguage(' "ja" ')).toBe('ja');
  });
  it('rejects unusable values', () => {
    for (const v of ['', 'x', 'japanese', '123', null, undefined, 5]) expect(lang.normalizeLanguage(v)).toBe('');
  });
});

describe('readFrontMatterLanguage', () => {
  it('reads lang and language from a leading block', () => {
    expect(lang.readFrontMatterLanguage('---\ntitle: a\nlang: ja\n---\nbody')).toBe('ja');
    expect(lang.readFrontMatterLanguage('---\r\nlanguage: "en-GB"\r\n---\r\nbody')).toBe('en');
    expect(lang.readFrontMatterLanguage('\uFEFF---\nlang: ja\n---\n')).toBe('ja');
  });
  it('ignores a block that is not at the start or has no lang', () => {
    expect(lang.readFrontMatterLanguage('text\n---\nlang: ja\n---\n')).toBe('');
    expect(lang.readFrontMatterLanguage('---\ntitle: a\n---\nlang: ja')).toBe('');
    expect(lang.readFrontMatterLanguage('---\nlang: ja\nno closing line')).toBe('');
    expect(lang.readFrontMatterLanguage(undefined)).toBe('');
  });
});

describe('detectAutoLanguage', () => {
  it('detects Japanese by the kana share', () => {
    expect(lang.detectAutoLanguage(JA)).toBe('ja');
  });
  it('reports other text as "other"', () => {
    expect(lang.detectAutoLanguage(EN)).toBe('other');
  });
  it('does not judge text shorter than the minimum', () => {
    expect(lang.detectAutoLanguage('\u3053\u308C\u306F')).toBe('');
    expect(lang.detectAutoLanguage('')).toBe('');
  });
  it('applies the 5% threshold on the first 2000 characters only', () => {
    const kana = '\u3042'.repeat(Math.ceil(lang.AUTO_MIN_LETTERS * lang.AUTO_KANA_RATIO));
    const filler = 'a'.repeat(lang.AUTO_MIN_LETTERS - kana.length);
    expect(lang.detectAutoLanguage(kana + filler)).toBe('ja');
    expect(lang.detectAutoLanguage(kana.slice(1) + filler + 'a')).toBe('other');
    expect(lang.detectAutoLanguage('a'.repeat(lang.AUTO_SAMPLE_LENGTH) + '\u3042'.repeat(500))).toBe('other');
  });
});

describe('detectDocumentLanguage', () => {
  it('manual wins over everything', () => {
    expect(lang.detectDocumentLanguage('---\nlang: ja\n---\n' + JA, { manual: 'en', uiLanguage: 'ja' })).toEqual({ language: 'en', source: 'manual' });
  });
  it('front matter wins over auto and UI', () => {
    expect(lang.detectDocumentLanguage('---\nlang: en\n---\n' + JA, { uiLanguage: 'ja' })).toEqual({ language: 'en', source: 'frontMatter' });
  });
  it('auto wins over the UI language, and never when switched off', () => {
    expect(lang.detectDocumentLanguage(JA, { uiLanguage: 'en' })).toEqual({ language: 'ja', source: 'auto' });
    expect(lang.detectDocumentLanguage(JA, { autoOn: false, uiLanguage: 'en' })).toEqual({ language: 'en', source: 'ui' });
  });
  it('falls back to the UI language for short or non-Japanese text', () => {
    expect(lang.detectDocumentLanguage('\u3053\u3093\u306B\u3061\u306F', { uiLanguage: 'en' })).toEqual({ language: 'en', source: 'ui' });
    expect(lang.detectDocumentLanguage(EN, { uiLanguage: 'ja' })).toEqual({ language: 'ja', source: 'ui' });
  });
  it('always chooses exactly one source, even with no input', () => {
    const r = lang.detectDocumentLanguage(undefined);
    expect(lang.LANGUAGE_SOURCES).toContain(r.source);
    expect(r.language).toBe('en');
  });
});
