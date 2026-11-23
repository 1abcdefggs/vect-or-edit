import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, Buffer>();

const safeStorageMock = {
  isAsyncEncryptionAvailable: vi.fn(async () => true),
  encryptStringAsync: vi.fn(async (text: string) => Buffer.from(`enc:${text}`)),
  decryptStringAsync: vi.fn(async (buf: Buffer) => ({ result: buf.toString().replace(/^enc:/, ''), shouldReEncrypt: false }))
};

vi.mock('electron', () => ({
  app: { getPath: () => 'userData' },
  net: {},
  safeStorage: safeStorageMock
}));

vi.mock('node:fs/promises', () => {
  const api = {
    mkdir: vi.fn(async () => undefined),
    readFile: vi.fn(async (file: string) => {
      const value = store.get(file);
      if (!value) throw new Error('ENOENT');
      return value;
    }),
    writeFile: vi.fn(async (file: string, data: Buffer) => { store.set(file, data); }),
    rm: vi.fn(async (file: string) => { store.delete(file); })
  };
  return { default: api, ...api };
});

const { saveApiKey, hasStoredApiKey, clearApiKey } = await import('../ai/aiServices');

describe('API key storage uses the async safeStorage methods', () => {
  beforeEach(() => {
    store.clear();
    safeStorageMock.isAsyncEncryptionAvailable.mockResolvedValue(true);
    safeStorageMock.decryptStringAsync.mockImplementation(async (buf: Buffer) => ({
      result: buf.toString().replace(/^enc:/, ''),
      shouldReEncrypt: false
    }));
  });

  it('saves a trimmed key encrypted and reads it back', async () => {
    expect(await saveApiKey('gemini', '  secret  ')).toEqual({ success: true });
    expect(safeStorageMock.encryptStringAsync).toHaveBeenCalledWith('secret');
    expect(await hasStoredApiKey('gemini')).toBe(true);
  });

  it('refuses an empty key', async () => {
    const result = await saveApiKey('gemini', '   ');
    expect(result.success).toBe(false);
  });

  it('reports unavailable secure storage on save and treats the key as absent on read', async () => {
    await saveApiKey('openai', 'k');
    safeStorageMock.isAsyncEncryptionAvailable.mockResolvedValue(false);
    expect((await saveApiKey('openai', 'k2')).success).toBe(false);
    expect(await hasStoredApiKey('openai')).toBe(false);
  });

  it('returns false when no key file exists', async () => {
    expect(await hasStoredApiKey('claude')).toBe(false);
  });

  it('returns false when decryption fails', async () => {
    await saveApiKey('claude', 'k');
    safeStorageMock.decryptStringAsync.mockRejectedValue(new Error('bad data'));
    expect(await hasStoredApiKey('claude')).toBe(false);
  });

  it('stores the key again when the OS key was rotated', async () => {
    await saveApiKey('gemini', 'k');
    safeStorageMock.encryptStringAsync.mockClear();
    safeStorageMock.decryptStringAsync.mockResolvedValueOnce({ result: 'k', shouldReEncrypt: true });
    expect(await hasStoredApiKey('gemini')).toBe(true);
    expect(safeStorageMock.encryptStringAsync).toHaveBeenCalledWith('k');
  });

  it('clears a stored key', async () => {
    await saveApiKey('gemini', 'k');
    expect(await clearApiKey('gemini')).toEqual({ success: true });
    expect(await hasStoredApiKey('gemini')).toBe(false);
  });
});
