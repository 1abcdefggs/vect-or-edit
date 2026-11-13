import { mainT } from './i18n';
import { dialog, app } from 'electron';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { getMainWindow } from './windowManager';
import { checkFolderName, type FolderNameProblem } from '../shared/folderName';
import { formatOfName } from '../shared/documentFormat';
import { createSavePathAllowlist } from './savePathAllowlist';

// Paths the user chose in a dialog during this run; only these may be overwritten without asking again (see savePathAllowlist.ts)
const savePaths = createSavePathAllowlist();

// The folder of the last successful save. Kept in config/ so it survives a restart.
function lastSaveDirFile(): string {
  return path.join(configDir(), 'last-save-dir.json');
}

async function getLastSaveDir(): Promise<string | null> {
  try {
    const data = JSON.parse(await fsPromises.readFile(lastSaveDirFile(), 'utf-8'));
    return typeof data?.dir === 'string' && fs.existsSync(data.dir) ? data.dir : null;
  } catch {
    return null;
  }
}

async function setLastSaveDir(dir: string): Promise<void> {
  try {
    await fsPromises.writeFile(lastSaveDirFile(), JSON.stringify({ dir }), 'utf-8');
  } catch (err) {
    console.warn('[Save] Could not remember the save folder:', err);
  }
}

/**
 * Writes to a temporary file in the same folder, then renames it over the target. A crash while writing
 * leaves the old file intact instead of a half-written one.
 */
async function writeFileAtomic(target: string, content: string) {
  const tmp = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.${Date.now()}.tmp`);
  try {
    await fsPromises.writeFile(tmp, content, 'utf-8');
    await fsPromises.rename(tmp, target);
  } catch (err) {
    await fsPromises.rm(tmp, { force: true }).catch(() => {});
    throw err;
  }
}

export async function saveFile(content: string, defaultName?: string, forceDialog = false) {
  const mainWindow = getMainWindow();
  if (!mainWindow) return { success: false, error: 'No main window' };
  try {
    // Overwrite directly only a path the user already chose in a dialog this run; any other absolute path goes through the dialog
    if (!forceDialog && defaultName && path.isAbsolute(defaultName) && savePaths.isApproved(defaultName)) {
      await writeFileAtomic(defaultName, content);
      return { success: true, filePath: defaultName };
    }

    const defaultPath = (defaultName && !path.isAbsolute(defaultName))
      ? defaultName
      : (defaultName ? path.basename(defaultName) : 'untitled.md');

    // The dialog offers the format the file name implies first: a Text document is saved as .txt, a Markdown one as .md
    const textFirst = formatOfName(defaultPath) === 'text';
    const markdownFilter = { name: 'Markdown', extensions: ['md', 'markdown'] };
    const textFilter = { name: 'Text', extensions: ['txt'] };
    // The dialog opens in the folder of the last save, else in the save folder (Settings > Save location)
    const startDir = await getLastSaveDir() ?? (await getDefaultWorkspace(false)).path;
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: mainT('main_dialog_save_file'),
      defaultPath: startDir ? path.join(startDir, defaultPath) : defaultPath,
      filters: [...(textFirst ? [textFilter, markdownFilter] : [markdownFilter, textFilter]), { name: 'All Files', extensions: ['*'] }]
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    savePaths.approveFile(filePath);
    await writeFileAtomic(filePath, content);
    await setLastSaveDir(path.dirname(filePath));
    return { success: true, filePath };
  } catch (err: any) {
    console.error('Failed to save file:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Decodes file bytes using BOM, then UTF-8, then Shift_JIS. Falls back to UTF-8 when none fits.
 */
function decodeText(buffer: Buffer): { encoding: string; text: string } {
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { encoding: 'UTF-8', text: buffer.subarray(3).toString('utf-8') };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return { encoding: 'UTF-16LE', text: buffer.subarray(2).toString('utf16le') };
  }
  try {
    return { encoding: 'UTF-8', text: new TextDecoder('utf-8', { fatal: true }).decode(buffer) };
  } catch { /* not valid UTF-8 */ }
  try {
    return { encoding: 'Shift_JIS', text: new TextDecoder('shift_jis', { fatal: true }).decode(buffer) };
  } catch { /* not valid Shift_JIS, or the decoder is unavailable */ }
  return { encoding: 'UTF-8', text: buffer.toString('utf-8') };
}

export async function openFile() {
  const mainWindow = getMainWindow();
  if (!mainWindow) return { success: false, error: 'No main window' };
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: mainT('main_dialog_open_file'),
      properties: ['openFile']
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const filePath = filePaths[0];
    savePaths.approveFile(filePath);
    const buffer = await fsPromises.readFile(filePath);
    const { encoding, text } = decodeText(buffer);
    const fileName = path.basename(filePath);
    return { success: true, filePath, fileName, content: text, encoding };
  } catch (err: any) {
    console.error('Failed to open file:', err);
    return { success: false, error: err.message };
  }
}

export async function openWorkspace() {
  const mainWindow = getMainWindow();
  if (!mainWindow) return { success: false, error: 'No main window' };
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: mainT('main_dialog_open_workspace'),
      properties: ['openDirectory']
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const folderPath = filePaths[0];
    savePaths.approveFolder(folderPath);
    const dirents = await fsPromises.readdir(folderPath, { withFileTypes: true });
    const mdFiles = dirents
      .filter(d => d.isFile() && (d.name.endsWith('.md') || d.name.endsWith('.txt')))
      .map(d => path.join(folderPath, d.name));

    return { success: true, folderPath, files: mdFiles };
  } catch (err: any) {
    console.error('Failed to open workspace:', err);
    return { success: false, error: err.message };
  }
}

/** What the save-folder functions answer (mirrors DefaultWorkspaceResponse in preload/types.ts) */
export interface WorkspaceResult {
  success: boolean;
  path?: string;
  exists?: boolean;
  isBuiltIn?: boolean;
  canceled?: boolean;
  problem?: FolderNameProblem;
  error?: string;
}

// AppData subdirectories for organized storage
function configDir(): string {
  return path.join(app.getPath('userData'), 'config');
}

function secretsDir(): string {
  return path.join(app.getPath('userData'), 'secrets');
}

function dataDir(): string {
  return path.join(app.getPath('userData'), 'data');
}

// Ensure AppData subdirectories exist
async function ensureAppDataDirs(): Promise<void> {
  await fsPromises.mkdir(configDir(), { recursive: true }).catch(err => {
    console.warn('[AppData] Could not create config dir:', err);
  });
  await fsPromises.mkdir(secretsDir(), { recursive: true }).catch(err => {
    console.warn('[AppData] Could not create secrets dir:', err);
  });
  await fsPromises.mkdir(dataDir(), { recursive: true }).catch(err => {
    console.warn('[AppData] Could not create data dir:', err);
  });
}

// The chosen save folder lives in userData, not in the folder itself: .settings.json is read from that folder.
const WORKSPACE_LOCATION_FILE = 'workspace-location.json';

// The built-in save folder under the OS Documents folder (control/specs/DEFAULT_WORKSPACE_SPEC.md).
const DEFAULT_WORKSPACE_DIRNAME = 'VectOrEdit';

function builtInWorkspacePath(): string {
  return path.join(app.getPath('documents'), DEFAULT_WORKSPACE_DIRNAME);
}

async function readChosenWorkspacePath(): Promise<string | null> {
  try {
    const raw = await fsPromises.readFile(path.join(configDir(), WORKSPACE_LOCATION_FILE), 'utf-8');
    const chosen = JSON.parse(raw)?.path;
    return typeof chosen === 'string' && path.isAbsolute(chosen) ? chosen : null;
  } catch {
    return null;
  }
}

/**
 * Migrate old files from userData root to new subdirectories on first run.
 * Old locations:
 *   - userData/workspace-location.json → config/workspace-location.json
 *   - userData/last-save-dir.json → config/last-save-dir.json
 *   - userData/startup-appearance.json → config/startup-appearance.json
 *   - userData/.settings.json → config/.settings.json (in workspace folder, stays)
 */
async function migrateOldAppDataLayout(): Promise<void> {
  const userDataPath = app.getPath('userData');
  const oldFiles = [
    { old: path.join(userDataPath, WORKSPACE_LOCATION_FILE), newDir: configDir() },
    { old: path.join(userDataPath, 'last-save-dir.json'), newDir: configDir() },
    { old: path.join(userDataPath, 'startup-appearance.json'), newDir: configDir() }
  ];

  for (const { old, newDir } of oldFiles) {
    try {
      if (fs.existsSync(old)) {
        await fsPromises.mkdir(newDir, { recursive: true });
        const fileName = path.basename(old);
        const newPath = path.join(newDir, fileName);
        if (!fs.existsSync(newPath)) {
          await fsPromises.rename(old, newPath);
          console.log(`[Migration] Moved ${fileName} to ${path.relative(userDataPath, newDir)}/`);
        }
      }
    } catch (err) {
      console.warn(`[Migration] Could not move ${path.basename(old)}:`, err);
    }
  }
}

// Run migration on startup
ensureAppDataDirs().then(() => migrateOldAppDataLayout()).catch(err => {
  console.warn('[AppData] Migration or directory creation failed:', err);
});

/** Save folder for new documents and .settings.json: the folder the user chose, else Documents/VectOrEdit. */
export async function getDefaultWorkspace(createIfMissing?: boolean): Promise<WorkspaceResult> {
  try {
    let chosen = await readChosenWorkspacePath();
    let workspacePath = chosen || builtInWorkspacePath();
    let exists = fs.existsSync(workspacePath);

    if (!exists && createIfMissing) {
      try {
        await fsPromises.mkdir(workspacePath, { recursive: true });
        exists = true;
      } catch (err) {
        // The chosen folder is gone or unwritable (unplugged drive): fall back so settings keep working
        if (!chosen) throw err;
        console.warn(`[Workspace] Chosen save folder is unavailable, using the built-in one: ${workspacePath}`, err);
        chosen = null;
        workspacePath = builtInWorkspacePath();
        await fsPromises.mkdir(workspacePath, { recursive: true });
        exists = true;
      }
    }

    // The save folder is either the built-in one or the one the user chose in a dialog, so the app may write into it
    savePaths.approveFolder(workspacePath);
    return { success: true, path: workspacePath, exists, isBuiltIn: !chosen };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Makes `dir` the save folder. It is created and checked for write access first, so a folder that cannot be used
 * never becomes the saved choice. The built-in folder is stored as "no choice", which keeps "Use default" meaningful.
 */
async function persistWorkspacePath(dir: string) {
  await fsPromises.mkdir(dir, { recursive: true });
  await fsPromises.access(dir, fs.constants.W_OK);

  const pointer = path.join(configDir(), WORKSPACE_LOCATION_FILE);
  if (path.resolve(dir).toLowerCase() === path.resolve(builtInWorkspacePath()).toLowerCase()) {
    await fsPromises.rm(pointer, { force: true });
  } else {
    await fsPromises.mkdir(configDir(), { recursive: true });
    await fsPromises.writeFile(pointer, JSON.stringify({ path: dir }, null, 2), 'utf-8');
  }
}

/**
 * Lets the user pick another location for the save folder. The folder keeps its current name,
 * so the choice is "where", and the name is changed on its own (renameDefaultWorkspace).
 * The renderer then writes its settings into the new folder.
 */
export async function chooseDefaultWorkspace(): Promise<WorkspaceResult> {
  const mainWindow = getMainWindow();
  if (!mainWindow) return { success: false, error: 'No main window' };
  try {
    const current = await getDefaultWorkspace(false);
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: mainT('main_dialog_save_folder'),
      defaultPath: path.dirname(current.path as string),
      properties: ['openDirectory', 'createDirectory']
    });
    if (canceled || !filePaths?.length) return { success: false, canceled: true };

    await persistWorkspacePath(path.join(filePaths[0], path.basename(current.path as string)));
    return getDefaultWorkspace(true);
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/** Renames the save folder in place: the location stays and the new name is used from now on. Files are not moved. */
export async function renameDefaultWorkspace(rawName: unknown): Promise<WorkspaceResult> {
  const check = checkFolderName(rawName);
  if (!check.ok) return { success: false, problem: check.problem };
  try {
    const current = await getDefaultWorkspace(false);
    await persistWorkspacePath(path.join(path.dirname(current.path as string), check.name));
    return getDefaultWorkspace(true);
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/** Returns to the built-in folder (Documents/VectOrEdit). */
export async function resetDefaultWorkspace(): Promise<WorkspaceResult> {
  try {
    await fsPromises.rm(path.join(configDir(), WORKSPACE_LOCATION_FILE), { force: true });
    return getDefaultWorkspace(true);
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * The saved choice (pointer file value, or null for the built-in folder) held when the first-run setup opened.
 * It is read here, in the main process, so the renderer never supplies a path that restore would write back.
 * `undefined` means no snapshot was taken.
 */
let openingWorkspaceChoice: string | null | undefined;

export async function snapshotOpeningWorkspace(): Promise<void> {
  openingWorkspaceChoice = await readChosenWorkspacePath();
}

/**
 * Puts the save folder back to the choice held when the first-run setup opened (cancel restores steps 1-2).
 * Only the pointer is written; no folder is moved or renamed on disk. A null choice (built-in folder) clears the pointer.
 */
export async function restoreDefaultWorkspace(): Promise<WorkspaceResult> {
  if (openingWorkspaceChoice === undefined) return { success: false, error: 'No opening choice was saved' };
  const choice = openingWorkspaceChoice;
  openingWorkspaceChoice = undefined;
  try {
    if (choice === null) return resetDefaultWorkspace();
    await persistWorkspacePath(choice);
    return getDefaultWorkspace(true);
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function loadSettings() {
  try {
    const ws = await getDefaultWorkspace(true);
    if (!ws.success) return { success: false, error: ws.error };
    const settingsPath = path.join(ws.path as string, '.settings.json');
    if (fs.existsSync(settingsPath)) {
      const data = await fsPromises.readFile(settingsPath, 'utf-8');
      return { success: true, settings: JSON.parse(data) };
    }
    return { success: true, settings: {} };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function saveSettings(settings: any) {
  try {
    const ws = await getDefaultWorkspace(true);
    if (!ws.success) return { success: false, error: ws.error };
    const settingsPath = path.join(ws.path as string, '.settings.json');
    await fsPromises.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

