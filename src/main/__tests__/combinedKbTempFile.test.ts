import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// The decrypted items reach the engine in memory; the old plaintext hand-off file is never written and is cleaned up.
let userData = '';
const engine = { loadKnowledgeBase: vi.fn(), loadKnowledgeBaseFromString: vi.fn(), buildIndex: vi.fn() };
vi.mock('electron', () => ({ app: { getPath: () => userData } }));
vi.mock('../engine/rustEngine', () => ({ getEngine: () => engine, getVault: () => null }));

const km = await import('../engine/knowledgeManager');
const tempFile = () => path.join(userData, 'combined_knowledge_base.json');

describe('combined_knowledge_base.json hand-off file', () => {
  beforeEach(() => {
    userData = fs.mkdtempSync(path.join(os.tmpdir(), 'vect-kb-'));
    const kb = path.join(userData, 'kb.json');
    fs.writeFileSync(kb, JSON.stringify([{ id: 'a', vector: [1, 0] }]));
    km.knowledgeSlots.length = 0;
    km.knowledgeSlots.push({ id: 's1', name: 'kb', filePath: kb, itemCount: 1 });
    engine.loadKnowledgeBase.mockReset();
    engine.loadKnowledgeBaseFromString.mockReset();
    engine.buildIndex.mockReset();
  });
  afterEach(() => {
    km.clearKnowledgeSlots();
    fs.rmSync(userData, { recursive: true, force: true });
  });

  it('hands the items to the engine as text and never writes the file', async () => {
    let received = '';
    engine.loadKnowledgeBaseFromString.mockImplementation(async (json: string) => { received = json; return 1; });
    expect(await km.reloadCombinedKnowledgeIndex()).toBe(1);
    expect(JSON.parse(received)).toEqual([{ id: 'a', vector: [1, 0] }]);
    expect(engine.loadKnowledgeBase).not.toHaveBeenCalled();
    expect(fs.existsSync(tempFile())).toBe(false);
  });

  it('writes no file when the engine fails', async () => {
    engine.loadKnowledgeBaseFromString.mockRejectedValue(new Error('boom'));
    expect(await km.reloadCombinedKnowledgeIndex()).toBe(0);
    expect(fs.existsSync(tempFile())).toBe(false);
  });

  it('reports not-ready after a load that worked once and then fails', async () => {
    engine.loadKnowledgeBaseFromString.mockResolvedValueOnce(1);
    expect(await km.reloadCombinedKnowledgeIndex()).toBe(1);
    expect(km.isRustEngineReady()).toBe(true);
    engine.loadKnowledgeBaseFromString.mockRejectedValueOnce(new Error('boom'));
    expect(await km.reloadCombinedKnowledgeIndex()).toBe(0);
    expect(km.isRustEngineReady()).toBe(false);
    expect(km.isRustEngineLoadFailed()).toBe(true);
    engine.loadKnowledgeBaseFromString.mockResolvedValueOnce(1);
    await km.reloadCombinedKnowledgeIndex();
    expect(km.isRustEngineLoadFailed()).toBe(false);
  });

  it('marks a slot whose file is gone as unreadable and drops its old state', async () => {
    engine.loadKnowledgeBaseFromString.mockResolvedValue(1);
    await km.reloadCombinedKnowledgeIndex();
    const slot = km.knowledgeSlots[0] as any;
    slot.compat = { state: 'ok' };
    fs.rmSync(slot.filePath);
    await km.reloadCombinedKnowledgeIndex();
    expect(slot.compat).toEqual({ state: 'unreadable', reason: 'missing' });
    expect(km.slotItemsCache.has(slot.id)).toBe(false);
  });

  it('marks a file that is not valid JSON as unreadable (format)', async () => {
    engine.loadKnowledgeBaseFromString.mockResolvedValue(1);
    const slot = km.knowledgeSlots[0] as any;
    fs.writeFileSync(slot.filePath, '{ not json');
    await km.reloadCombinedKnowledgeIndex();
    expect(slot.compat).toEqual({ state: 'unreadable', reason: 'format' });
  });

  const addSlot = (id: string, items: unknown[]) => {
    const file = path.join(userData, id + '.json');
    fs.writeFileSync(file, JSON.stringify(items));
    const slot = { id, name: id, filePath: file, itemCount: items.length };
    km.knowledgeSlots.push(slot);
    return slot as any;
  };

  it('leaves out only the slot whose own entries differ in vector length', async () => {
    let received = '';
    engine.loadKnowledgeBaseFromString.mockImplementation(async (json: string) => { received = json; return JSON.parse(json).length; });
    const bad = addSlot('bad', [{ id: 'x', vector: [1, 0] }, { id: 'y', vector: [1, 0, 0] }]);
    expect(await km.reloadCombinedKnowledgeIndex()).toBe(1);
    expect(JSON.parse(received).map((it: any) => it.id)).toEqual(['a']);
    expect(bad.compat).toMatchObject({ state: 'excluded', reason: 'dim-inconsistent' });
    expect(km.isRustEngineReady()).toBe(true);
  });

  it('keeps one vector length when the model is not announced: the later slot of another length is left out', async () => {
    let received = '';
    engine.loadKnowledgeBaseFromString.mockImplementation(async (json: string) => { received = json; return JSON.parse(json).length; });
    const longer = addSlot('longer', [{ id: 'z', vector: [1, 0, 0] }]);
    expect(await km.reloadCombinedKnowledgeIndex()).toBe(1);
    expect(JSON.parse(received).map((it: any) => it.id)).toEqual(['a']);
    expect(longer.compat).toMatchObject({ state: 'excluded', reason: 'dim-mismatch-mixed' });
    expect((km.knowledgeSlots[0] as any).compat).toMatchObject({ state: 'unchecked' });
  });

  it('removeCombinedKbTempFile clears a leftover and tolerates a missing file', async () => {
    fs.writeFileSync(tempFile(), '[]');
    await km.removeCombinedKbTempFile();
    expect(fs.existsSync(tempFile())).toBe(false);
    await expect(km.removeCombinedKbTempFile()).resolves.toBeUndefined();
  });
});
