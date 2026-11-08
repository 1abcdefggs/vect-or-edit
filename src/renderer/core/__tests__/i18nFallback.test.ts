import { describe, it, expect, vi, beforeEach } from 'vitest';

// The Japanese dictionary is replaced with one that lacks a key, to prove the English text is used.
vi.mock('../../locales/ja.json', () => ({ default: { some_japanese_key: 'x' } }));
vi.mock('../../locales/en.json', () => ({
  default: { only_in_english: 'English text', shared_key: 'English shared' }
}));
vi.mock('../statusManager', () => ({ setLedStatus: () => {} }));

function stubBrowser(lang: string) {
  const store = new Map<string, string>([['app_lang', lang]]);
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => store.set(k, v)
  };
  Object.defineProperty(globalThis, 'navigator', { value: { language: 'ja-JP' }, configurable: true });
  (globalThis as any).document = {
    documentElement: { lang: '' },
    querySelectorAll: () => []
  };
  (globalThis as any).window = { dispatchEvent: () => true };
  (globalThis as any).CustomEvent = class {
    constructor(public type: string, public init?: unknown) {}
  };
}

describe('t() English fallback', () => {
  beforeEach(() => {
    vi.resetModules();
    stubBrowser('ja');
  });

  it('returns the English text when the chosen language lacks the key', async () => {
    const { loadLocales, t } = await import('../i18n');
    await loadLocales();
    expect(t('only_in_english')).toBe('English text');
  });

  it('returns the raw key when neither language has it', async () => {
    const { loadLocales, t } = await import('../i18n');
    await loadLocales();
    expect(t('no_such_key_anywhere')).toBe('no_such_key_anywhere');
  });
});
