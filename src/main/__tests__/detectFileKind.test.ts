import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

vi.mock('electron', () => ({ app: { getPath: () => os.tmpdir() } }));
vi.mock('../engine/rustEngine', () => ({ getEngine: () => null, getVault: () => null }));

const { detectFileKind } = await import('../engine/knowledgeManager');

describe('detectFileKind', () => {
  let dir = '';
  const write = (name: string, body: unknown) => {
    const p = path.join(dir, name);
    fs.writeFileSync(p, typeof body === 'string' ? body : JSON.stringify(body));
    return p;
  };
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vect-kind-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('takes an object with a rules list for a profile, whatever its name', async () => {
    expect(await detectFileKind(write('guideline_x.json', { rules: [{ id: 'r1' }] }))).toBe('profile');
    expect(await detectFileKind(write('anything.json', { rules: [] }))).toBe('profile');
  });

  it('does not take a knowledge file for a profile because of its path', async () => {
    const sub = path.join(dir, 'profile_notes');
    fs.mkdirSync(sub);
    const p = path.join(sub, 'kb_a.json');
    fs.writeFileSync(p, JSON.stringify([{ id: 'a', vector: [1, 0] }]));
    expect(await detectFileKind(p)).toBe('knowledge');
  });

  it('keeps a file with both rules and vector entries as a knowledge file', async () => {
    const p = write('both.json', { rules: [{ id: 'r' }], concepts: [{ id: 'c', embeddings: [{ facet: 'f', vector: [1, 0] }] }] });
    expect(await detectFileKind(p)).toBe('knowledge');
  });

  it('lets an explicit kind decide before the shape', async () => {
    expect(await detectFileKind(write('a.json', { kind: 'guideline', sections: { rules: [] } }))).toBe('profile');
    expect(await detectFileKind(write('b.json', { kind: 'knowledge', rules: [{ id: 'r' }] }))).toBe('knowledge');
    expect(await detectFileKind(write('c.json', { kind: 'other', rules: [] }))).toBe('profile');
  });

  it('treats encrypted, broken and array files as knowledge files', async () => {
    expect(await detectFileKind(write('x.venc', 'bytes'))).toBe('knowledge');
    expect(await detectFileKind(write('broken.json', '{ nope'))).toBe('knowledge');
    expect(await detectFileKind(write('list.json', [{ id: 'a' }]))).toBe('knowledge');
    expect(await detectFileKind(path.join(dir, 'missing.json'))).toBe('knowledge');
  });
});
