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

  it('removeCombinedKbTempFile clears a leftover and tolerates a missing file', async () => {
    fs.writeFileSync(tempFile(), '[]');
    await km.removeCombinedKbTempFile();
    expect(fs.existsSync(tempFile())).toBe(false);
    await expect(km.removeCombinedKbTempFile()).resolves.toBeUndefined();
  });
});
