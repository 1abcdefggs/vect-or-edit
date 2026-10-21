import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// A real temporary Documents folder stands in for the OS one, so nothing outside the temp directory is touched.
let documents = '';
let userData = '';
vi.mock('electron', () => ({
  dialog: {},
  app: { getPath: (name: string) => (name === 'documents' ? documents : userData) }
}));
vi.mock('../windowManager', () => ({ getMainWindow: () => null }));

const { getDefaultWorkspace, renameDefaultWorkspace, resetDefaultWorkspace } = await import('../fileSystem');

describe('save folder (built-in name and rename)', () => {
  // Documents/VectOrFoldEr was the name before 0.3.25; nothing is carried over from it (no existing users to keep).
  beforeEach(() => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vect-ws-'));
    documents = path.join(root, 'Documents');
    userData = path.join(root, 'userData');
    fs.mkdirSync(documents);
    fs.mkdirSync(userData);
  });

  afterEach(() => {
    fs.rmSync(path.dirname(documents), { recursive: true, force: true });
  });

  it('uses Documents/VectOrEdit on a fresh install', async () => {
    const ws = await getDefaultWorkspace(true);
    expect(ws.success).toBe(true);
    expect(ws.path).toBe(path.join(documents, 'VectOrEdit'));
    expect(ws.isBuiltIn).toBe(true);
    expect(fs.existsSync(path.join(documents, 'VectOrEdit'))).toBe(true);
  });

  it('does not look at the old VectOrFoldEr folder', async () => {
    fs.mkdirSync(path.join(documents, 'VectOrFoldEr'));
    const ws = await getDefaultWorkspace(true);
    expect(ws.path).toBe(path.join(documents, 'VectOrEdit'));
  });

  it('renames in place: same location, new name, and a pointer is stored', async () => {
    const res = await renameDefaultWorkspace('MyNotes');
    expect(res.success).toBe(true);
    expect(res.path).toBe(path.join(documents, 'MyNotes'));
    expect(res.isBuiltIn).toBe(false);
    expect(fs.existsSync(path.join(documents, 'MyNotes'))).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(userData, 'workspace-location.json'), 'utf8')).path).toBe(path.join(documents, 'MyNotes'));
  });

  it('refuses a name with a problem and stores nothing', async () => {
    const res = await renameDefaultWorkspace('a/b');
    expect(res).toEqual({ success: false, problem: 'chars' });
    expect(fs.existsSync(path.join(userData, 'workspace-location.json'))).toBe(false);
  });

  it('renaming back to the built-in name clears the pointer; reset also returns to the built-in folder', async () => {
    await renameDefaultWorkspace('MyNotes');
    const back = await renameDefaultWorkspace('VectOrEdit');
    expect(back.isBuiltIn).toBe(true);
    expect(fs.existsSync(path.join(userData, 'workspace-location.json'))).toBe(false);

    await renameDefaultWorkspace('Other');
    const reset = await resetDefaultWorkspace();
    expect(reset.path).toBe(path.join(documents, 'VectOrEdit'));
    expect(reset.isBuiltIn).toBe(true);
  });
});
