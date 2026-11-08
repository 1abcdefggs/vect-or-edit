import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

let userData = '';
vi.mock('electron', () => ({
  app: { getPath: () => userData }
}));

import {
  redact,
  sanitizeEntries,
  saveSnapshot,
  listSessions,
  readSession,
  pruneOldSessions
} from '../logStore';

describe('saved logs: redaction', () => {
  it('hides API key shapes and bearer tokens', () => {
    const text = redact('key sk-abcdefghijklmnopqrstuvwx and AIzaSyD-abcdefghijklmnopqrstu and Bearer abc.def-123');
    expect(text).not.toContain('sk-abcdefghijklmnop');
    expect(text).not.toContain('AIzaSyD-abcdefghijklmnopqrstu');
    expect(text).not.toContain('abc.def-123');
    expect(text).toContain('[REDACTED]');
  });

  it('keeps the key name and hides only the value of key=value pairs', () => {
    expect(redact('api_key=supersecret123 done')).toBe('api_key=[REDACTED] done');
    expect(redact('password: hunter2')).toBe('password: [REDACTED]');
  });
});

describe('saved logs: entry rebuild', () => {
  it('drops unknown fields and limits lengths', () => {
    const [entry] = sanitizeEntries([{
      time: '2026-11-08T10:00:00.000Z',
      source: 'x'.repeat(500),
      level: 'DEBUG',
      message: 'm'.repeat(10000),
      extra: '<img src=x onerror=alert(1)>',
      tone: 'evil'
    }]);
    expect(Object.keys(entry).sort()).toEqual(['level', 'message', 'source', 'time']);
    expect(entry.level).toBe('INFO');
    expect(entry.source.length).toBe(80);
    expect(entry.message.length).toBe(4000);
  });

  it('rejects input that is not a list or is too long', () => {
    expect(() => sanitizeEntries('nope')).toThrow();
    expect(() => sanitizeEntries(new Array(501).fill({}))).toThrow();
  });
});

describe('saved logs: files', () => {
  beforeEach(() => {
    userData = fs.mkdtempSync(path.join(os.tmpdir(), 'vect-logs-test-'));
  });
  afterEach(() => {
    fs.rmSync(userData, { recursive: true, force: true });
  });

  it('saves a snapshot and reads it back with secrets removed', () => {
    const { id, written } = saveSnapshot([
      { time: '2026-11-08T10:00:00.000Z', source: 'App', level: 'INFO', message: 'token=abc123456 ok' }
    ]);
    expect(written).toBe(1);
    expect(listSessions().map((s) => s.id)).toContain(id);
    const [entry] = readSession(id);
    expect(entry.message).toBe('token=[REDACTED] ok');
  });

  it('refuses ids that are not generated session names (path traversal)', () => {
    expect(() => readSession('../secret.txt')).toThrow('invalid log session id');
    expect(() => readSession('session-20260101-000000-000000.jsonl/../../x')).toThrow('invalid log session id');
    expect(() => readSession('C:\\Windows\\win.ini')).toThrow('invalid log session id');
  });

  it('ignores files that do not match the session pattern when listing', () => {
    const dir = path.join(userData, 'logs');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'x');
    expect(listSessions()).toEqual([]);
  });

  it('removes sessions older than 30 days and keeps newer ones', () => {
    const { id: oldId } = saveSnapshot([]);
    const { id: newId } = saveSnapshot([]);
    const dir = path.join(userData, 'logs');
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    fs.utimesSync(path.join(dir, oldId), old, old);
    expect(pruneOldSessions()).toBe(1);
    const left = fs.readdirSync(dir);
    expect(left).not.toContain(oldId);
    expect(left).toContain(newId);
  });
});
