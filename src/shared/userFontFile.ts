/**
 * Rules for a font file the user adds from the PC. Shared by the main process (which stores it) and tests.
 * A stored file is named "<id>__<name><ext>": the id keeps two files of the same name apart and gives the
 * font a family alias that cannot clash with an installed font; the name is what the user sees.
 */
export const FONT_EXTENSIONS = ['.ttf', '.otf', '.woff', '.woff2'] as const;
export const FONT_MAX_BYTES = 20 * 1024 * 1024;
export const FONT_MAX_COUNT = 20;

export type FontFileProblem = 'type' | 'empty' | 'size';

export function checkFontFile(fileName: string, bytes: number): { ok: true; ext: string } | { ok: false; problem: FontFileProblem } {
  const dot = fileName.lastIndexOf('.');
  const ext = dot >= 0 ? fileName.slice(dot).toLowerCase() : '';
  if (!(FONT_EXTENSIONS as readonly string[]).includes(ext)) return { ok: false, problem: 'type' };
  if (bytes <= 0) return { ok: false, problem: 'empty' };
  if (bytes > FONT_MAX_BYTES) return { ok: false, problem: 'size' };
  return { ok: true, ext };
}

/** The name the user sees: the file name without its extension, with characters that break a stored name removed. */
export function fontDisplayName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  // eslint-disable-next-line no-control-regex
  return base.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/__/g, '_').trim().slice(0, 60) || 'font';
}

export function storedFontName(id: string, fileName: string, ext: string): string {
  return `${id}__${fontDisplayName(fileName)}${ext}`;
}

const STORED = /^([0-9a-f]{12})__(.+)(\.(?:ttf|otf|woff2?))$/i;

/** Splits a stored file name; null when it is not one of ours (so a stray file or a path is never touched). */
export function parseStoredFont(stored: string): { id: string; name: string; alias: string } | null {
  if (stored !== stored.split(/[\\/]/).pop()) return null;
  const m = STORED.exec(stored);
  return m ? { id: m[1], name: m[2], alias: `UserFont-${m[1]}` } : null;
}
