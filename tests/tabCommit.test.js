import { describe, it, expect } from 'vitest';
import { commitTabToFile } from '../src/renderer/editor/io/tabCommit.js';

function makeTab(text, extra = {}) {
  let value = text;
  return {
    id: 'tab-1',
    title: 'note.md',
    filePath: null,
    isDirty: true,
    model: { getValue: () => value, setValue: (v) => { value = v; } },
    ...extra
  };
}

function makeApi(handler) {
  const calls = [];
  return {
    calls,
    saveFile: async (content, target, forceDialog) => {
      calls.push({ content, target, forceDialog });
      return handler(content, target, forceDialog);
    }
  };
}

describe('commitTabToFile', () => {
  it('marks the tab clean and records the path after a confirmed write', async () => {
    const tab = makeTab('hello', { filePath: 'C:\\docs\\note.md' });
    const api = makeApi(() => ({ success: true, filePath: 'C:\\docs\\note.md' }));

    const result = await commitTabToFile(tab, api);

    expect(result).toEqual({ ok: true, filePath: 'C:\\docs\\note.md' });
    expect(tab.isDirty).toBe(false);
    expect(api.calls[0]).toEqual({ content: 'hello', target: 'C:\\docs\\note.md', forceDialog: false });
  });

  it('keeps the tab dirty when the write fails', async () => {
    const tab = makeTab('hello', { filePath: 'C:\\docs\\note.md' });
    const api = makeApi(() => ({ success: false, error: 'EBUSY: resource busy' }));

    const result = await commitTabToFile(tab, api);

    expect(result).toEqual({ ok: false, error: 'EBUSY: resource busy' });
    expect(tab.isDirty).toBe(true);
  });

  it('keeps the tab dirty when the API throws', async () => {
    const tab = makeTab('hello', { filePath: 'C:\\docs\\note.md' });
    const api = makeApi(() => { throw new Error('IPC closed'); });

    const result = await commitTabToFile(tab, api);

    expect(result.ok).toBe(false);
    expect(result.error).toBe('IPC closed');
    expect(tab.isDirty).toBe(true);
  });

  it('reports a cancelled save dialog without marking the tab clean', async () => {
    const tab = makeTab('hello');
    const api = makeApi(() => ({ success: false, canceled: true }));

    const result = await commitTabToFile(tab, api);

    expect(result).toEqual({ ok: false, canceled: true });
    expect(tab.isDirty).toBe(true);
    expect(api.calls[0].forceDialog).toBe(true);
  });

  it('stays dirty when the text changed while the write was in flight', async () => {
    const tab = makeTab('first');
    const api = makeApi(async () => {
      tab.model.setValue('first, then more');
      return { success: true, filePath: 'C:\\docs\\note.md' };
    });

    const result = await commitTabToFile(tab, api);

    expect(result.ok).toBe(true);
    expect(tab.filePath).toBe('C:\\docs\\note.md');
    expect(tab.isDirty).toBe(true);
  });

  it('never runs two writes for the same tab at the same time', async () => {
    const tab = makeTab('v1', { filePath: 'C:\\docs\\note.md' });
    let inFlight = 0;
    let maxInFlight = 0;
    const api = makeApi(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 20));
      inFlight--;
      return { success: true, filePath: 'C:\\docs\\note.md' };
    });

    const first = commitTabToFile(tab, api);
    tab.model.setValue('v2');
    const second = commitTabToFile(tab, api);
    const results = await Promise.all([first, second]);

    expect(maxInFlight).toBe(1);
    expect(results.every((r) => r.ok)).toBe(true);
    // The queued write reads the text when it runs, so the last write carries the newest content.
    expect(api.calls.at(-1).content).toBe('v2');
  });

  it('returns an error when there is no editor model', async () => {
    const result = await commitTabToFile({ id: 'x', model: null }, makeApi(() => ({ success: true })));
    expect(result.ok).toBe(false);
  });

  it('returns an error when the save API is unavailable', async () => {
    const tab = makeTab('hello');
    const result = await commitTabToFile(tab, undefined);
    expect(result.ok).toBe(false);
    expect(tab.isDirty).toBe(true);
  });
});
