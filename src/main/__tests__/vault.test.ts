import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import { argon2id } from 'hash-wasm';

// Set before the vault module is loaded: the module reads the secret at call time.
const TEST_SECRET = 'test-secret';
process.env.VECTOR_SHARED_APP_SECRET = TEST_SECRET;

const ARGON_TIMEOUT = 30000;

let encryptKnowledgeBase: (data: unknown, password: string) => Promise<Buffer>;
let decryptKnowledgeBase: (file: Buffer, password: string) => Promise<unknown>;

// Builds a file in the earlier VENC format: Argon2id over the HMAC of the password, as earlier builds wrote it.
async function buildEarlierFile(data: unknown, password: string, secret: string): Promise<Buffer> {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const blended = crypto.createHmac('sha256', secret).update(password).digest('hex');
  const key = Buffer.from(
    await argon2id({ password: blended, salt, parallelism: 1, iterations: 3, memorySize: 65536, hashLength: 32, outputType: 'hex' }),
    'hex',
  );
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  return Buffer.concat([Buffer.from('VENC'), salt, iv, cipher.getAuthTag(), body]);
}

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

  it('still opens a file of the earlier VENC format', async () => {
    const data = { domain: 'earlier-format' };
    const file = await buildEarlierFile(data, 'earlierPassword', TEST_SECRET);
    expect(await decryptKnowledgeBase(file, 'earlierPassword')).toEqual(data);
  }, ARGON_TIMEOUT);

  it('rejects encryption when VECTOR_SHARED_APP_SECRET is missing, and names it', async () => {
    const saved = process.env.VECTOR_SHARED_APP_SECRET;
    delete process.env.VECTOR_SHARED_APP_SECRET;
    try {
      await expect(encryptKnowledgeBase({ a: 1 }, 'pw')).rejects.toThrow('VECTOR_SHARED_APP_SECRET');
    } finally {
      process.env.VECTOR_SHARED_APP_SECRET = saved;
    }
  });

  it('rejects a buffer with neither header as "Invalid file format"', async () => {
    const bogus = Buffer.concat([Buffer.from('XXXX'), crypto.randomBytes(64)]);
    await expect(decryptKnowledgeBase(bogus, 'pw')).rejects.toThrow('Invalid file format');
  });
});
