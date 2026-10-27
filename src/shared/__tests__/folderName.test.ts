import { describe, it, expect } from 'vitest';
import { checkFolderName, FOLDER_NAME_MAX_LENGTH } from '../folderName';

describe('checkFolderName', () => {
  it('accepts an ordinary name and trims the spaces around it', () => {
    expect(checkFolderName('  MyNotes  ')).toEqual({ ok: true, name: 'MyNotes' });
    // Non-ASCII names are fine (built from code points because source files carry no Japanese text)
    const katakana = String.fromCodePoint(0x30ce, 0x30fc, 0x30c8);
    expect(checkFolderName(katakana)).toEqual({ ok: true, name: katakana });
    expect(checkFolderName('notes v2.1')).toEqual({ ok: true, name: 'notes v2.1' });
  });

  it('refuses an empty name or one that is not text', () => {
    expect(checkFolderName('')).toEqual({ ok: false, problem: 'empty' });
    expect(checkFolderName('   ')).toEqual({ ok: false, problem: 'empty' });
    expect(checkFolderName(undefined)).toEqual({ ok: false, problem: 'empty' });
    expect(checkFolderName(42)).toEqual({ ok: false, problem: 'empty' });
  });

  it('refuses the characters Windows does not allow, which also blocks path separators', () => {
    for (const bad of ['a/b', 'a\\b', 'a:b', 'a*b', 'a?b', 'a"b', 'a<b', 'a>b', 'a|b', 'a\u0007b', '../x']) {
      expect(checkFolderName(bad)).toEqual({ ok: false, problem: 'chars' });
    }
  });

  it('refuses dot names and names ending with a dot', () => {
    for (const bad of ['.', '..', 'notes.']) {
      expect(checkFolderName(bad)).toEqual({ ok: false, problem: 'dots' });
    }
  });

  it('refuses the device names Windows reserves, with or without an extension', () => {
    for (const bad of ['CON', 'nul', 'Com1', 'LPT9', 'aux.txt']) {
      expect(checkFolderName(bad)).toEqual({ ok: false, problem: 'reserved' });
    }
    expect(checkFolderName('console')).toEqual({ ok: true, name: 'console' });
  });

  it('refuses a name that is too long', () => {
    expect(checkFolderName('a'.repeat(FOLDER_NAME_MAX_LENGTH + 1))).toEqual({ ok: false, problem: 'long' });
    expect(checkFolderName('a'.repeat(FOLDER_NAME_MAX_LENGTH)).ok).toBe(true);
  });
});
