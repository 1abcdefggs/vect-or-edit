import { dialog, app } from 'electron';
import crypto from 'node:crypto';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { getMainWindow } from './windowManager';
import { mainT } from './i18n';
import {
  FONT_EXTENSIONS, FONT_MAX_COUNT, checkFontFile, parseStoredFont, storedFontName, type FontFileProblem
} from '../shared/userFontFile';

/**
 * Fonts the user added from the PC (.ttf, .otf, .woff, .woff2), kept in userData/fonts.
 * The renderer loads them with the FontFace API from the bytes read here, so the page's font-src rule stays closed.
 * Nothing leaves the PC and nothing is downloaded.
 */
export interface UserFont { file: string; name: string; alias: string }
export interface AddFontsResult {
  success: boolean;
  canceled?: boolean;
  added: UserFont[];
  rejected: Array<{ name: string; problem: FontFileProblem | 'limit' | 'error' }>;
}

const fontsDir = () => path.join(app.getPath('userData'), 'fonts');

export async function listUserFonts(): Promise<UserFont[]> {
  let names: string[] = [];
  try {
    names = await fsPromises.readdir(fontsDir());
  } catch {
    return [];
  }
  return names.flatMap((file) => {
    const parsed = parseStoredFont(file);
    return parsed ? [{ file, name: parsed.name, alias: parsed.alias }] : [];
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export async function addUserFonts(): Promise<AddFontsResult> {
  const mainWindow = getMainWindow();
  if (!mainWindow) return { success: false, added: [], rejected: [] };
  const picked = await dialog.showOpenDialog(mainWindow, {
    title: mainT('main_dialog_add_font'),
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: mainT('main_dialog_font_files'), extensions: FONT_EXTENSIONS.map((e) => e.slice(1)) }]
  });
  if (picked.canceled || !picked.filePaths.length) return { success: false, canceled: true, added: [], rejected: [] };

  const result: AddFontsResult = { success: true, added: [], rejected: [] };
  await fsPromises.mkdir(fontsDir(), { recursive: true });
  let count = (await listUserFonts()).length;
  for (const source of picked.filePaths) {
    const name = path.basename(source);
    try {
      const stat = await fsPromises.stat(source);
      const check = checkFontFile(name, stat.size);
      if (!check.ok) {
        result.rejected.push({ name, problem: check.problem });
        continue;
      }
      if (count >= FONT_MAX_COUNT) {
        result.rejected.push({ name, problem: 'limit' });
        continue;
      }
      const bytes = await fsPromises.readFile(source);
      const id = crypto.createHash('sha1').update(bytes).digest('hex').slice(0, 12);
      const stored = storedFontName(id, name, check.ext);
      const parsed = parseStoredFont(stored);
      if (!parsed) {
        result.rejected.push({ name, problem: 'error' });
        continue;
      }
      await fsPromises.writeFile(path.join(fontsDir(), stored), bytes);
      result.added.push({ file: stored, name: parsed.name, alias: parsed.alias });
      count += 1;
    } catch {
      result.rejected.push({ name, problem: 'error' });
    }
  }
  return result;
}

/** The bytes of one added font. Only a file of our own naming inside the fonts folder is read. */
export async function readUserFont(file: unknown): Promise<Uint8Array | null> {
  if (typeof file !== 'string' || !parseStoredFont(file)) return null;
  try {
    return await fsPromises.readFile(path.join(fontsDir(), file));
  } catch {
    return null;
  }
}

export async function removeUserFont(file: unknown): Promise<{ success: boolean }> {
  if (typeof file !== 'string' || !parseStoredFont(file)) return { success: false };
  try {
    await fsPromises.rm(path.join(fontsDir(), file), { force: true });
    return { success: true };
  } catch {
    return { success: false };
  }
}
