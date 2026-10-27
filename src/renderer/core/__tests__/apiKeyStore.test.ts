import { describe, it, expect, beforeEach, vi } from 'vitest';
import { migratePlaintextApiKeys, isApiKeyConfigured, refreshApiKeyStatus, SECRET_STORAGE_KEYS } from '../apiKeyStore.js';
import { syncSettingsToBackend } from '../../ui/settings/settingsState.js';

function mockLocalStorage(initial: Record<string, string>) {
  const store: Record<string, string> = { ...initial };
  (global as any).localStorage = {
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; }
  };
  return store;
}

describe('apiKeyStore (encrypted API keys)', () => {
  let saved: Record<string, string>;
  let engineAPI: any;

  beforeEach(() => {
    saved = {};
    engineAPI = {
      saveApiKey: vi.fn(async (provider: string, key: string) => { saved[provider] = key; return { success: true }; }),
      hasApiKey: vi.fn(async (provider: string) => provider in saved),
      saveSettings: vi.fn(async () => ({ success: true }))
    };
    (global as any).window = { engineAPI };
  });

  it('moves plain-text keys into the encrypted store and deletes them from localStorage', async () => {
    const store = mockLocalStorage({ openai_api_key: 'sk-openai', vect_claude_api_key: 'sk-old', claude_api_key: 'sk-new', app_lang: 'ja' });

    expect(await migratePlaintextApiKeys()).toBe(true);

    expect(saved).toEqual({ openai: 'sk-openai', claude: 'sk-new' });
    expect(Object.keys(store)).toEqual(['app_lang']);
  });

  it('does not overwrite an existing encrypted key with a stale plain-text copy', async () => {
    saved.openai = 'sk-rotated';
    const store = mockLocalStorage({ openai_api_key: 'sk-stale' });

    expect(await migratePlaintextApiKeys()).toBe(true);

    expect(saved.openai).toBe('sk-rotated');
    expect(engineAPI.saveApiKey).not.toHaveBeenCalled();
    expect(store.openai_api_key).toBeUndefined();
  });

  it('keeps a key in place when it cannot be encrypted', async () => {
    engineAPI.saveApiKey = vi.fn(async () => ({ success: false, error: 'OS secure storage is unavailable.' }));
    const store = mockLocalStorage({ openai_api_key: 'sk-openai' });

    expect(await migratePlaintextApiKeys()).toBe(false);
    expect(store.openai_api_key).toBe('sk-openai');
  });

  it('reports which providers have a stored key', async () => {
    mockLocalStorage({});
    saved.gemini = 'g';
    await refreshApiKeyStatus();
    expect(isApiKeyConfigured('gemini')).toBe(true);
    expect(isApiKeyConfigured('openai')).toBe(false);
  });

  it('never writes API keys to .settings.json', async () => {
    mockLocalStorage({ openai_api_key: 'sk-openai', gemini_api_key: 'g', app_lang: 'en' });
    await syncSettingsToBackend();
    const written = engineAPI.saveSettings.mock.calls[0][0];
    expect(written).toEqual({ app_lang: 'en' });
    SECRET_STORAGE_KEYS.forEach((name: string) => expect(written).not.toHaveProperty(name));
  });
});
