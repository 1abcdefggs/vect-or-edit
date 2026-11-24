import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';

// Set before the vault module is loaded: the module reads the secret at call time.
const TEST_SECRET = 'test-secret';
process.env.VECTOR_SHARED_APP_SECRET = TEST_SECRET;

const ARGON_TIMEOUT = 30000;

let encryptKnowledgeBase: (data: unknown, password: string) => Promise<Buffer>;
let decryptKnowledgeBase: (file: Buffer, password: string) => Promise<unknown>;

describe('vault: encrypted knowledge base format', () => {
  beforeAll(async () => {
    const vault = await import('../../../core/vault/index.js');
    encryptKnowledgeBase = vault.encryptKnowledgeBase;
    decryptKnowledgeBase = vault.decryptKnowledgeBase;
  });

  afterAll(() => {
    delete process.env.VECTOR_SHARED_APP_SECRET;
  });

  it('round-trips an object through encrypt and decrypt', async () => {
    const data = { domain: 'medical', entities: [{ id: '#01', name: 'Test' }] };
    const enc = await encryptKnowledgeBase(data, 'mySecretPassword123');
    expect(await decryptKnowledgeBase(enc, 'mySecretPassword123')).toEqual(data);
  }, ARGON_TIMEOUT);

  it('starts a new file with the VEN2 header', async () => {
    const enc = await encryptKnowledgeBase({ a: 1 }, 'pw-header');
    expect(enc.subarray(0, 4).toString('utf8')).toBe('VEN2');
  }, ARGON_TIMEOUT);

  it('rejects a wrong password', async () => {
    const enc = await encryptKnowledgeBase({ a: 1 }, 'right');
    await expect(decryptKnowledgeBase(enc, 'wrong')).rejects.toBeDefined();
  }, ARGON_TIMEOUT);

  it('rejects a buffer with neither header as "Invalid file format"', async () => {
    const bogus = Buffer.concat([Buffer.from('XXXX'), crypto.randomBytes(64)]);
    await expect(decryptKnowledgeBase(bogus, 'pw')).rejects.toThrow('Invalid file format');
  });
});
