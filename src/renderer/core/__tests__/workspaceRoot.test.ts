import { describe, it, expect, afterEach, vi } from 'vitest';
import { getWorkspaceRoot } from '../workspaceRoot';

// P16: every caller asks for the workspace root through this one function
describe('getWorkspaceRoot', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null where there is no desktop shell', async () => {
    vi.stubGlobal('window', {});
    expect(await getWorkspaceRoot()).toBeNull();
  });

  it('passes the create flag to the main process and maps the answer', async () => {
    const getDefaultWorkspace = vi.fn().mockResolvedValue({ success: true, path: 'C:\\Docs\\VectOrEdit', exists: true, isBuiltIn: false });
    vi.stubGlobal('window', { engineAPI: { getDefaultWorkspace } });
    expect(await getWorkspaceRoot({ create: true })).toEqual({ path: 'C:\\Docs\\VectOrEdit', exists: true, isBuiltIn: false });
    expect(getDefaultWorkspace).toHaveBeenCalledWith(true);
  });

  it('does not create the folder unless asked, and treats a missing flag as built-in', async () => {
    const getDefaultWorkspace = vi.fn().mockResolvedValue({ success: true, path: '/home/u/VectOrEdit', exists: false });
    vi.stubGlobal('window', { engineAPI: { getDefaultWorkspace } });
    expect(await getWorkspaceRoot()).toEqual({ path: '/home/u/VectOrEdit', exists: false, isBuiltIn: true });
    expect(getDefaultWorkspace).toHaveBeenCalledWith(false);
  });

  it('returns null when the main process refuses', async () => {
    vi.stubGlobal('window', { engineAPI: { getDefaultWorkspace: vi.fn().mockResolvedValue({ success: false, error: 'x' }) } });
    expect(await getWorkspaceRoot()).toBeNull();
  });
});
