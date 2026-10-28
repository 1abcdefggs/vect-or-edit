import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const handlers = new Map<string, (...args: any[]) => any>();
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: any[]) => any) => handlers.set(channel, fn),
    on: (channel: string, fn: (...args: any[]) => any) => handlers.set(channel, fn)
  },
  session: { defaultSession: {} }
}));

const { setTrustedRenderer, isTrustedUrl, handleTrusted } = await import('../ipcSecurity');

const indexPath = path.resolve('out/renderer/index.html');

describe('ipcSecurity (IPC sender check)', () => {
  beforeEach(() => handlers.clear());

  it('trusts the bundled index.html and the dev server origin only', () => {
    setTrustedRenderer('http://localhost:5173/', indexPath);
    expect(isTrustedUrl(pathToFileURL(indexPath).href + '#tab')).toBe(true);
    expect(isTrustedUrl('http://localhost:5173/src/index.html')).toBe(true);
    expect(isTrustedUrl(pathToFileURL(path.resolve('other.html')).href)).toBe(false);
    expect(isTrustedUrl('http://localhost:5174/')).toBe(false);
    expect(isTrustedUrl('https://example.com/')).toBe(false);
    expect(isTrustedUrl('not a url')).toBe(false);
  });

  it('trusts no dev origin when none is given (packaged app)', () => {
    setTrustedRenderer('', indexPath);
    expect(isTrustedUrl('http://localhost:5173/')).toBe(false);
    expect(isTrustedUrl(pathToFileURL(indexPath).href)).toBe(true);
  });

  it('rejects invoke calls from an untrusted frame and runs trusted ones', async () => {
    setTrustedRenderer('', indexPath);
    handleTrusted('app:test', () => 'ok');
    const handler = handlers.get('app:test')!;
    expect(handler({ senderFrame: { url: pathToFileURL(indexPath).href } })).toBe('ok');
    expect(() => handler({ senderFrame: { url: 'https://evil.example/' } })).toThrow('Untrusted IPC sender');
    expect(() => handler({ senderFrame: null })).toThrow('Untrusted IPC sender');
  });
});
