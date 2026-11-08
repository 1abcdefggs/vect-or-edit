/**
 * Saved logs (main process). The renderer sends log entries; this module validates them, removes secrets,
 * and writes them under userData/logs. Each app start writes one session file (JSON Lines).
 *
 * Security rules of this module:
 * - The renderer never gives a path or a file name. File names are created here and checked against SESSION_RE.
 * - Every entry is rebuilt from known fields with length limits; unknown fields are dropped.
 * - Secrets (API key shapes, bearer tokens, key=value pairs) are replaced before anything is written.
 * - Files are only read or deleted when they match SESSION_RE and are regular files (no symlinks).
 * - Batch sizes, session size and read size are capped.
 */
import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';

export type StoredLevel = 'INFO' | 'WARN' | 'ERROR';

export interface StoredLogEntry {
  time: string;
  source: string;
  level: StoredLevel;
  message: string;
  tone?: 'success';
}

export interface LogSessionInfo {
  id: string;
  modified: string;
  bytes: number;
}

const LOG_DIR_NAME = 'logs';
const SESSION_RE = /^session-\d{8}-\d{6}-[0-9a-f]{6}\.jsonl$/;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_APPEND_BATCH = 500;
const MAX_SNAPSHOT_ENTRIES = 5000;
const MAX_SESSION_BYTES = 20 * 1024 * 1024;
const MAX_READ_BYTES = 20 * 1024 * 1024;
const MAX_READ_LINES = 20000;
const MAX_SOURCE_CHARS = 80;
const MAX_MESSAGE_CHARS = 4000;
const LEVELS: ReadonlySet<string> = new Set(['INFO', 'WARN', 'ERROR']);

// Patterns that look like credentials. The key=value pattern keeps the key name and hides only the value.
const SECRET_SHAPES: RegExp[] = [
  /sk-[A-Za-z0-9_-]{16,}/g,
  /AIza[0-9A-Za-z_-]{20,}/g,
  /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi,
];
const SECRET_KEY_VALUE = /((?:api[_-]?key|apikey|access[_-]?token|token|secret|password)\s*[:=]\s*)[^\s,;'"]+/gi;

export function redact(text: string): string {
  let out = text;
  for (const re of SECRET_SHAPES) out = out.replace(re, '[REDACTED]');
  return out.replace(SECRET_KEY_VALUE, '$1[REDACTED]');
}

function limited(value: unknown, max: number): string {
  return redact(String(value ?? '')).slice(0, max);
}

/** Rebuilds each entry from known fields. Throws for input that is not a list of reasonable size. */
export function sanitizeEntries(input: unknown, maxCount = MAX_APPEND_BATCH): StoredLogEntry[] {
  if (!Array.isArray(input)) throw new Error('log entries must be a list');
  if (input.length > maxCount) throw new Error('too many log entries in one request');
  return input.map((raw: any) => {
    const time = typeof raw?.time === 'string' && !Number.isNaN(Date.parse(raw.time))
      ? raw.time
      : new Date().toISOString();
    const level = LEVELS.has(raw?.level) ? (raw.level as StoredLevel) : 'INFO';
    const entry: StoredLogEntry = {
      time,
      source: limited(raw?.source, MAX_SOURCE_CHARS),
      level,
      message: limited(raw?.message, MAX_MESSAGE_CHARS),
    };
    if (raw?.tone === 'success') entry.tone = 'success';
    return entry;
  });
}

function logDir(): string {
  return path.join(app.getPath('userData'), LOG_DIR_NAME);
}

function ensureLogDir(): string {
  const dir = logDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Resolves a session id to a path inside the log folder. Only ids made by newSessionId() pass. */
function sessionPath(id: string): string {
  if (typeof id !== 'string' || !SESSION_RE.test(id)) throw new Error('invalid log session id');
  const dir = path.resolve(logDir());
  const file = path.resolve(dir, id);
  if (path.dirname(file) !== dir) throw new Error('invalid log session path');
  return file;
}

function newSessionId(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `session-${stamp}-${randomBytes(3).toString('hex')}.jsonl`;
}

// One session per app start. The file is created on the first write.
const currentSessionId = newSessionId();
let currentSessionBytes = 0;
let sessionFull = false;

/** Appends renderer entries to this start's session file. */
export function appendToCurrentSession(input: unknown): { written: number } {
  const entries = sanitizeEntries(input);
  if (entries.length === 0 || sessionFull) return { written: 0 };
  const lines = entries.map((e) => JSON.stringify(e) + '\n').join('');
  const bytes = Buffer.byteLength(lines, 'utf8');
  if (currentSessionBytes + bytes > MAX_SESSION_BYTES) {
    sessionFull = true;
    return { written: 0 };
  }
  ensureLogDir();
  fs.appendFileSync(sessionPath(currentSessionId), lines, { encoding: 'utf8', mode: 0o600 });
  currentSessionBytes += bytes;
  return { written: entries.length };
}

/** Writes the given entries (the panel's current buffer) to a new session file, for the exit question. */
export function saveSnapshot(input: unknown): { id: string; written: number } {
  const entries = sanitizeEntries(input, MAX_SNAPSHOT_ENTRIES);
  const lines = entries.map((e) => JSON.stringify(e) + '\n').join('');
  if (Buffer.byteLength(lines, 'utf8') > MAX_SESSION_BYTES) throw new Error('snapshot is too large');
  ensureLogDir();
  const id = newSessionId();
  fs.writeFileSync(sessionPath(id), lines, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  return { id, written: entries.length };
}

/** Lists session files, newest first. Only regular files whose names match SESSION_RE. */
export function listSessions(): LogSessionInfo[] {
  const dir = logDir();
  if (!fs.existsSync(dir)) return [];
  const sessions: LogSessionInfo[] = [];
  for (const name of fs.readdirSync(dir)) {
    if (!SESSION_RE.test(name)) continue;
    const st = fs.lstatSync(path.join(dir, name));
    if (!st.isFile()) continue;
    sessions.push({ id: name, modified: st.mtime.toISOString(), bytes: st.size });
  }
  return sessions.sort((a, b) => b.id.localeCompare(a.id));
}

/** Reads one session. Each line is rebuilt again, so a damaged or edited file cannot inject extra fields. */
export function readSession(id: string): StoredLogEntry[] {
  const file = sessionPath(id);
  const st = fs.lstatSync(file);
  if (!st.isFile()) throw new Error('log session is not a regular file');
  if (st.size > MAX_READ_BYTES) throw new Error('log session is too large to open');
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).slice(0, MAX_READ_LINES);
  const entries: StoredLogEntry[] = [];
  for (const line of lines) {
    try {
      entries.push(...sanitizeEntries([JSON.parse(line)], 1));
    } catch {
      // A broken line is skipped; the rest of the session still shows
    }
  }
  return entries;
}

/** Deletes session files older than 30 days. Called once at start. Returns how many were removed. */
export function pruneOldSessions(now = Date.now()): number {
  const dir = logDir();
  if (!fs.existsSync(dir)) return 0;
  let removed = 0;
  for (const name of fs.readdirSync(dir)) {
    if (!SESSION_RE.test(name)) continue;
    const file = path.join(dir, name);
    const st = fs.lstatSync(file);
    if (st.isFile() && now - st.mtimeMs > RETENTION_MS) {
      fs.unlinkSync(file);
      removed++;
    }
  }
  return removed;
}
