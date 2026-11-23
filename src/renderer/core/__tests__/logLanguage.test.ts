import { describe, it, expect, vi, beforeEach } from 'vitest';

// Two dictionaries with one shared key, so the log language choice is visible in the returned text.
vi.mock('../../locales/ja.json', () => ({ default: { shared_key: 'JA shared', only_ja: 'JA only' } }));
vi.mock('../../locales/en.json', () => ({ default: { shared_key: 'English', only_en: 'EN {n}' } }));

function stubBrowser(lang: string) {
  const store = new Map<string, string>([['app_lang', lang]]);
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => store.set(k, v)
  };
  Object.defineProperty(globalThis, 'navigator', { value: { language: 'en-US' }, configurable: true });
  (globalThis as any).document = {
    documentElement: { lang: '' },
    querySelectorAll: () => [],
    getElementById: () => null
  };
  (globalThis as any).window = { dispatchEvent: () => true, addEventListener: () => {} };
  (globalThis as any).CustomEvent = class {
    constructor(public type: string, public init?: unknown) {}
  };
}

describe('log language helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    stubBrowser('ja');
  });

  it('tEn always returns English, whatever the UI language is', async () => {
    const { loadLocales, tEn } = await import('../i18n');
    await loadLocales();
    expect(tEn('shared_key')).toBe('English');
    expect(tEn('only_en', { n: 3 })).toBe('EN 3');
  });

  it('tLog returns English by default (no log language source registered)', async () => {
    const { loadLocales, tLog } = await import('../i18n');
    await loadLocales();
    expect(tLog('shared_key')).toBe('English');
  });

  it('tLog follows the UI language when the source is set to "ui"', async () => {
    const { loadLocales, tLog, setLogLanguageSource } = await import('../i18n');
    await loadLocales();
    setLogLanguageSource(() => 'ui');
    expect(tLog('shared_key')).toBe('JA shared');
  });

  it('tLog stays English when the source is set to "en"', async () => {
    const { loadLocales, tLog, setLogLanguageSource } = await import('../i18n');
    await loadLocales();
    setLogLanguageSource(() => 'en');
    expect(tLog('shared_key')).toBe('English');
  });

  it('led returns a keyed lamp text that setLedStatus can translate later', async () => {
    const { led } = await import('../statusManager');
    expect(led('led_i18n_loaded', { lang: 'ja' })).toEqual({ key: 'led_i18n_loaded', params: { lang: 'ja' } });
  });
});

describe('setLedStatus log writing', () => {
  beforeEach(() => {
    vi.resetModules();
    stubBrowser('en');
  });

  it('writes a log line by default and nothing when writeLog is false', async () => {
    const { setLedStatus, led } = await import('../statusManager');
    const appendSystemLog = vi.fn();
    (globalThis as any).window.appendSystemLog = appendSystemLog;
    // The pipeline strip is not under test; keep its DOM lookups inert
    (globalThis as any).window.addEventListener = () => {};

    setLedStatus('conf', true, 'Config ready');
    expect(appendSystemLog).toHaveBeenCalledTimes(1);

    setLedStatus('i18n', true, led('led_i18n_loaded', { lang: 'ja' }), false);
    expect(appendSystemLog).toHaveBeenCalledTimes(1);
  });
});
