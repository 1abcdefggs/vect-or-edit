import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

type Listener = (details: { url: string; resourceType: string; webContentsId?: number }, cb: (r: { cancel: boolean }) => void) => void;
const listeners: Record<string, Listener> = {};
const fakeSession = (name: string) => ({ webRequest: { onBeforeRequest: (fn: Listener) => { listeners[name] = fn; } } });

vi.mock('electron', () => ({
  app: { isPackaged: true },
  session: { defaultSession: fakeSession('default'), fromPartition: (name: string) => fakeSession(name) }
}));

const { decideEgress, withAiEgress, installEgressPolicy, AI_HOSTS } = await import('../net/egressPolicy');

const packaged = { zone: 'app' as const, isDev: false, fromMain: true, openAiHosts: new Set<string>() };

describe('decideEgress (outbound allowlist)', () => {
  it('allows the embedding model and font hosts', () => {
    for (const url of [
      'https://huggingface.co/Xenova/multilingual-e5-small/resolve/main/config.json',
      'https://cdn-lfs.huggingface.co/repos/x',
      'https://cas-bridge.xethub.hf.co/x',
      'https://fonts.googleapis.com/css2?family=Noto+Sans+JP',
      'https://fonts.gstatic.com/s/x.woff2'
    ]) expect(decideEgress(url, packaged), url).toBe(true);
  });

  it('blocks unknown hosts, CDNs and look-alike hosts', () => {
    for (const url of [
      'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/ort-wasm-simd-threaded.jsep.wasm',
      'https://example.com/',
      'https://evilhuggingface.co/',
      'https://huggingface.co.evil.com/',
      'https://api.github.com/repos/x/y/releases/latest',
      'not a url'
    ]) expect(decideEgress(url, packaged), url).toBe(false);
  });

  it('lets non-network schemes through', () => {
    for (const url of ['file:///C:/app/index.html', 'devtools://devtools/bundled/x', 'data:text/plain,x', 'blob:file:///id']) {
      expect(decideEgress(url, packaged), url).toBe(true);
    }
  });

  it('allows the dev server on localhost only when not packaged', () => {
    expect(decideEgress('http://localhost:5173/src/index.html', packaged)).toBe(false);
    expect(decideEgress('ws://localhost:5173/', { ...packaged, isDev: true })).toBe(true);
    expect(decideEgress('http://127.0.0.1:5173/', { ...packaged, isDev: true })).toBe(true);
  });

  it('opens an AI host only while a send to that host is in flight, over https', () => {
    const open = { ...packaged, openAiHosts: new Set<string>([AI_HOSTS.gemini]) };
    expect(decideEgress('https://generativelanguage.googleapis.com/v1beta/models', packaged)).toBe(false);
    expect(decideEgress('https://generativelanguage.googleapis.com/v1beta/models', open)).toBe(true);
    expect(decideEgress('http://generativelanguage.googleapis.com/v1beta/models', open)).toBe(false);
    expect(decideEgress('https://api.anthropic.com/v1/messages', open)).toBe(false);
  });

  it('never lets a page or worker reach an AI host, even during a send', () => {
    const open = { ...packaged, fromMain: false, openAiHosts: new Set<string>([AI_HOSTS.gemini]) };
    expect(decideEgress('https://generativelanguage.googleapis.com/v1beta/models', open)).toBe(false);
    expect(decideEgress('https://huggingface.co/', open)).toBe(true);
  });

  it('limits the updater session to GitHub release hosts', () => {
    const updater = { ...packaged, zone: 'updater' as const };
    expect(decideEgress('https://github.com/o/r/releases/latest', updater)).toBe(true);
    expect(decideEgress('https://release-assets.githubusercontent.com/x', updater)).toBe(true);
    expect(decideEgress('https://huggingface.co/', updater)).toBe(false);
    expect(decideEgress('https://github.com/o/r/releases/latest', packaged)).toBe(false);
  });
});

describe('installEgressPolicy and withAiEgress', () => {
  installEgressPolicy();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  // webContentsId is undefined for main-process requests and set for pages and their workers (checked in Electron 45)
  const cancelled = (session: string, url: string, webContentsId?: number): boolean => {
    let result = false;
    listeners[session]({ url, resourceType: 'xhr', webContentsId }, (r) => { result = r.cancel; });
    return result;
  };

  it('registers on the default session and on the electron-updater session', () => {
    expect(Object.keys(listeners).sort()).toEqual(['default', 'electron-updater']);
    expect(cancelled('default', 'https://example.com/')).toBe(true);
    expect(cancelled('electron-updater', 'https://github.com/o/r/releases/latest')).toBe(false);
  });

  it('opens an AI host only for the duration of the send, also when the send throws', async () => {
    const url = 'https://api.anthropic.com/v1/messages';
    expect(cancelled('default', url)).toBe(true);
    let during = true;
    let duringFromPage = false;
    await withAiEgress(AI_HOSTS.claude, async () => {
      during = cancelled('default', url);
      duringFromPage = cancelled('default', url, 1);
    });
    expect(during).toBe(false);
    expect(duringFromPage).toBe(true);
    expect(cancelled('default', url)).toBe(true);
    await expect(withAiEgress(AI_HOSTS.claude, async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    expect(cancelled('default', url)).toBe(true);
  });

  it('keeps a host open until the last of two overlapping sends ends', async () => {
    const url = 'https://api.openai.com/v1/chat/completions';
    let release!: () => void;
    const first = withAiEgress(AI_HOSTS.openai, () => new Promise<void>((r) => { release = r; }));
    await withAiEgress(AI_HOSTS.openai, async () => {});
    expect(cancelled('default', url)).toBe(false);
    release();
    await first;
    expect(cancelled('default', url)).toBe(true);
  });
});

describe('main-process network code', () => {
  // Node's network stack bypasses Chromium and therefore the egress policy; main must use electron's net.
  // A second onBeforeRequest listener would replace the policy, and a Gemini client without net.fetch would bypass it.
  const RULES: Array<[string, RegExp]> = [
    ['global fetch', /(^|[^.\w])fetch\s*\(|globalThis\.fetch|global\.fetch/m],
    ['Node network module', /['"](node:)?(https?|http2|net|tls|undici)['"]/],
    ['onBeforeRequest outside egressPolicy.ts', /\.onBeforeRequest\s*\(/],
    ['GoogleGenAI outside geminiClient()', /new\s+GoogleGenAI\s*\(/]
  ];
  const ALLOWED: Record<string, string[]> = {
    'onBeforeRequest outside egressPolicy.ts': [path.join('net', 'egressPolicy.ts')],
    'GoogleGenAI outside geminiClient()': [path.join('ai', 'aiServices.ts')]
  };

  it('does not use Node network APIs or bypass the policy', () => {
    const root = path.resolve(__dirname, '..');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { if (entry.name !== '__tests__') walk(full); continue; }
        if (!/\.(ts|js|mjs|cjs)$/.test(entry.name)) continue;
        const rel = path.relative(root, full);
        const text = fs.readFileSync(full, 'utf8');
        for (const [name, re] of RULES) {
          if (re.test(text) && !(ALLOWED[name] || []).includes(rel)) offenders.push(`${rel}: ${name}`);
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });

  it('creates every Gemini client with net.fetch', () => {
    const text = fs.readFileSync(path.resolve(__dirname, '..', 'ai', 'aiServices.ts'), 'utf8');
    const calls = text.match(/new\s+GoogleGenAI\s*\([^)]*\)/g) || [];
    expect(calls.length).toBe(1);
    expect(calls[0]).toMatch(/httpOptions:\s*\{[^}]*\bfetch:\s*electronFetch\b/);
  });
});
