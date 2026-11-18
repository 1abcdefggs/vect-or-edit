/**
 * Names of new documents: an ordered choice of parts (name, sequence number, date, time, free text) joined by "-".
 * Pure logic, shared by the editor (new tabs) and the settings page (choice and example). No UI, storage or Electron code.
 */

export type NameToken = 'name' | 'seq' | 'date' | 'time' | 'text';

export const NAME_TOKENS: readonly NameToken[] = ['name', 'seq', 'date', 'time', 'text'];
export const DEFAULT_NAME_TOKENS: readonly NameToken[] = ['name', 'seq'];

const SEPARATOR = '-';
const MAX_TEXT_LENGTH = 40;
// Characters that cannot appear in a file name on Windows, plus control characters
const UNSAFE_CHARS = /[\\/:*?"<>|\u0000-\u001f]/g;

/** Keeps the known tokens in their order, without repeats. Anything else is dropped; an empty choice means the name alone. */
export function sanitizeNameTokens(raw: unknown): NameToken[] {
  if (!Array.isArray(raw)) return [...DEFAULT_NAME_TOKENS];
  const out: NameToken[] = [];
  for (const value of raw) {
    if (NAME_TOKENS.includes(value as NameToken) && !out.includes(value as NameToken)) {
      out.push(value as NameToken);
    }
  }
  return out.length > 0 ? out : ['name'];
}

/** Free text as it may appear in a file name: unsafe characters removed, trimmed, length limited. */
export function cleanNameText(text: string): string {
  return text.replace(UNSAFE_CHARS, '').trim().slice(0, MAX_TEXT_LENGTH);
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Local date as YYYYMMDD */
export function formatNameDate(now: Date): string {
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
}

/** Local time as HHmm */
export function formatNameTime(now: Date): string {
  return `${pad(now.getHours())}${pad(now.getMinutes())}`;
}

export interface NameParts {
  /** The base name, e.g. "Doc" in the UI language */
  name: string;
  /** The sequence number (used when the choice has a sequence token) */
  seq: number;
  now: Date;
  /** The free text (used when the choice has a text token) */
  text: string;
}

/** Joins the chosen parts, in the chosen order. Parts that are empty are left out. */
export function composeName(tokens: readonly NameToken[], parts: NameParts): string {
  const pieces = tokens.map((token): string => {
    switch (token) {
      case 'name': return parts.name;
      case 'seq': return String(parts.seq);
      case 'date': return formatNameDate(parts.now);
      case 'time': return formatNameTime(parts.now);
      case 'text': return cleanNameText(parts.text);
    }
  });
  return pieces.filter(piece => piece !== '').join(SEPARATOR);
}

/**
 * The first name that no open document uses (names without extension).
 * With a sequence token the number grows until it is free. Without one, a clash gets -2, -3 ... after the name.
 */
export function nextFreeName(tokens: readonly NameToken[], parts: Omit<NameParts, 'seq'>, used: ReadonlySet<string>): string {
  if (tokens.includes('seq')) {
    for (let seq = 1; ; seq++) {
      const candidate = composeName(tokens, { ...parts, seq });
      if (!used.has(candidate)) return candidate;
    }
  }
  const base = composeName(tokens, { ...parts, seq: 0 });
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}${SEPARATOR}${n}`;
    if (!used.has(candidate)) return candidate;
  }
}
