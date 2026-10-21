/**
 * Rules for the name of the save folder, shared by the main process (which enforces them)
 * and the renderer (which shows the reason while the user types).
 * The reason is a code, not a sentence: each side turns it into text through the dictionary.
 */
export type FolderNameProblem = 'empty' | 'chars' | 'dots' | 'reserved' | 'long';

export type FolderNameCheck =
  | { ok: true; name: string }
  | { ok: false; problem: FolderNameProblem };

export const FOLDER_NAME_MAX_LENGTH = 100;

// Characters Windows does not allow in a name, plus control characters
const FORBIDDEN_CHARS = /[\\/:*?"<>|\u0000-\u001f]/;
// Device names Windows reserves, with or without an extension
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

export function checkFolderName(raw: unknown): FolderNameCheck {
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (name === '') return { ok: false, problem: 'empty' };
  if (name.length > FOLDER_NAME_MAX_LENGTH) return { ok: false, problem: 'long' };
  if (FORBIDDEN_CHARS.test(name)) return { ok: false, problem: 'chars' };
  if (name === '.' || name === '..' || name.endsWith('.')) return { ok: false, problem: 'dots' };
  if (RESERVED_NAMES.test(name)) return { ok: false, problem: 'reserved' };
  return { ok: true, name };
}
