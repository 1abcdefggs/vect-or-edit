import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({ BrowserWindow: class {} }));

const { captureLog, exportLogBacklog, mainLogBuffer } = await import('../logger');

describe('log backlog', () => {
  it('gives every entry a unique, increasing id', () => {
    captureLog('INFO', ['first']);
    captureLog('WARN', ['second']);
    const [a, b] = mainLogBuffer.slice(-2);
    expect(b.id).toBeGreaterThan(a.id);
  });

  it('returns a snapshot of everything logged so far', () => {
    captureLog('ERROR', ['boom'], 'Test:Source');
    const backlog = exportLogBacklog();
    const last = backlog[backlog.length - 1];
    expect(last).toMatchObject({ level: 'ERROR', source: 'Test:Source', message: 'boom' });
    // A snapshot: later entries do not mutate what was already handed over
    captureLog('INFO', ['later']);
    expect(backlog[backlog.length - 1]).toBe(last);
  });
});
