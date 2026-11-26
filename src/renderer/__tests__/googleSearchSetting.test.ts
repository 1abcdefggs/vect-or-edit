import { beforeEach, describe, expect, it, vi } from 'vitest';

// The Google search setting: stored as 'on' or 'off', On unless stored as 'off', and a gate at the single entry point.
const store = new Map<string, string>();
vi.mock('../core/storage', () => ({
  readStorage: (key: string) => (store.has(key) ? store.get(key)! : null),
  writeStorage: (key: string, value: string) => {
    store.set(key, value);
  }
}));

const openExternal = vi.fn();

beforeEach(() => {
  store.clear();
  openExternal.mockClear();
  vi.stubGlobal('window', { engineAPI: { openExternal }, open: vi.fn() });
});

describe('Google search setting', () => {
  it('is On when nothing is stored', async () => {
    const { isGoogleSearchEnabled } = await import('../core/externalActions.js');
    expect(isGoogleSearchEnabled()).toBe(true);
  });

  it('is Off only when stored as off, and a broken value counts as On', async () => {
    const { isGoogleSearchEnabled, setGoogleSearchEnabled } = await import('../core/externalActions.js');
    setGoogleSearchEnabled(false);
    expect(isGoogleSearchEnabled()).toBe(false);
    setGoogleSearchEnabled(true);
    expect(isGoogleSearchEnabled()).toBe(true);
    store.set('vect_google_search_enabled', 'maybe');
    expect(isGoogleSearchEnabled()).toBe(true);
  });

  it('opens the search URL while On', async () => {
    const { openGoogleSearch } = await import('../core/externalActions.js');
    openGoogleSearch('  abstract sentence ');
    expect(openExternal).toHaveBeenCalledWith('https://www.google.com/search?q=abstract%20sentence');
  });

  it('opens nothing while Off (this also turns Alt+G off)', async () => {
    const { openGoogleSearch, setGoogleSearchEnabled } = await import('../core/externalActions.js');
    setGoogleSearchEnabled(false);
    openGoogleSearch('abstract sentence');
    expect(openExternal).not.toHaveBeenCalled();
  });
});
