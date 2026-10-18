import { dialog, app } from 'electron';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { getMainWindow } from './windowManager';

export async function saveFile(content: string, defaultName?: string, forceDialog = false) {
  const mainWindow = getMainWindow();
  if (!mainWindow) return { success: false, error: 'No main window' };
  try {
    // If not forcing dialog and defaultName is an absolute path, overwrite directly
    if (!forceDialog && defaultName && path.isAbsolute(defaultName)) {
      await fsPromises.writeFile(defaultName, content, 'utf-8');
      return { success: true, filePath: defaultName };
    }

    const defaultPath = (defaultName && !path.isAbsolute(defaultName))
      ? defaultName
      : (defaultName ? path.basename(defaultName) : 'untitled.md');

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save File',
      defaultPath,
      filters: [{ name: 'Markdown', extensions: ['md'] }, { name: 'All Files', extensions: ['*'] }]
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    await fsPromises.writeFile(filePath, content, 'utf-8');
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
      title: 'Open File',
      properties: ['openFile']
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const filePath = filePaths[0];
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
      title: 'Open Workspace Folder',
      properties: ['openDirectory']
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const folderPath = filePaths[0];
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

export async function getDefaultWorkspace(createIfMissing?: boolean) {
  try {
    const docsPath = app.getPath('documents');
    const defaultWorkspace = path.join(docsPath, 'VectOrFoldEr');
    let exists = fs.existsSync(defaultWorkspace);

    if (!exists && createIfMissing) {
      await fsPromises.mkdir(defaultWorkspace, { recursive: true });
      exists = true;
    }

    return { success: true, path: defaultWorkspace, exists };
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

