import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readStorage, writeStorage, removeStorage } from '../storage.js';

describe('readStorage', () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => { store.set(key, String(value)); },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the stored value', () => {
    store.set('k', 'v');
    expect(readStorage('k')).toBe('v');
  });

  it('returns null for a missing key, like getItem', () => {
    expect(readStorage('missing')).toBeNull();
  });

  it('returns null instead of throwing when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('denied'); },
    });
    expect(readStorage('k')).toBeNull();
  });
});

describe('writeStorage and removeStorage', () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => { store.set(key, String(value)); },
      removeItem: (key: string) => { store.delete(key); },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes the value as a string', () => {
    writeStorage('k', 1);
    expect(readStorage('k')).toBe('1');
  });

  it('removes a stored value', () => {
    store.set('k', 'v');
    removeStorage('k');
    expect(readStorage('k')).toBeNull();
  });

  it('throws when a write is refused, so a failed save is never reported as saved', () => {
    vi.stubGlobal('localStorage', {
      setItem: () => { throw new Error('QuotaExceededError'); },
    });
    expect(() => writeStorage('k', 'v')).toThrow('QuotaExceededError');
  });

  it('throws when a removal is refused, so a plain-text key is never reported as removed', () => {
    vi.stubGlobal('localStorage', {
      removeItem: () => { throw new Error('denied'); },
    });
    expect(() => removeStorage('k')).toThrow('denied');
  });
});
