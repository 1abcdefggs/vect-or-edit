import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { EngineClient } from '@vect-or-engine/core';
import { spawn } from 'child_process';
import fsPromises from 'fs/promises';

// Disable GPU shader disk cache and HTTP disk cache to avoid Windows cache permission conflicts
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-http-cache');

// Set isolated temporary userData path in development mode to prevent file locks while keeping AI model cache persistent
try {
  const tempUserData = path.join(app.getPath('temp'), 'vectoreditor-dev-user-data');
  app.setPath('userData', tempUserData);
} catch (e) {
  // Ignore error if app is already initialized
}

let mainWindow: BrowserWindow | null = null;
const dictClient = new EngineClient();

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true
    }
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  // Load the knowledge base on startup
  try {
    const kbPath = path.resolve(__dirname, '../../../vect-or-data/postcard_knowledge_base.json');
    await dictClient.loadKnowledgeBase(kbPath);
    console.log('[App] Successfully loaded knowledge base into Rust Engine');
  } catch (err) {
    console.error('[App] Failed to load knowledge base:', err);
  }

  // Safe IPC Handler for Vector Search
  ipcMain.handle('engine:searchVector', async (_event, vector: number[]) => {
    try {
      const results = await dictClient.searchVector(vector, 5);
      return { success: true, data: results };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('app:saveFile', async (_event, content: string, defaultName: string) => {
    if (!mainWindow) return { success: false };
    try {
      const { canceled, filePath } = await import('electron').then(e => e.dialog.showSaveDialog(mainWindow!, {
        defaultPath: defaultName,
        filters: [{ name: 'Text/Markdown', extensions: ['txt', 'md'] }, { name: 'All Files', extensions: ['*'] }]
      }));
      if (!canceled && filePath) {
        await fsPromises.writeFile(filePath, content, 'utf-8');
        return { success: true, filePath };
      }
      return { success: false, canceled: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('app:validateDocument', async (_event, text: string) => {
    try {
      return await dictClient.validateDocument(text);
    } catch (err: any) {
      console.error('Validation error from Rust Engine:', err);
      return {
        is_valid: false,
        has_allergy_conflict: false,
        markers: [{ severity: 'Error', message: err.message, line: 1 }]
      };
    }
  });

  ipcMain.handle('app:loadImeDict', async () => {
    try {
      const fs = await import('fs');
      const candidatePaths = [
        path.join(__dirname, '../renderer/assets/custom-ime-dict.txt'),
        path.join(__dirname, '../../public/custom-ime-dict.txt'),
        path.join(__dirname, '../../src/renderer/assets/custom-ime-dict.txt'),
        path.join(__dirname, '../renderer/custom-ime-dict.txt')
      ];

      for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
          return await fsPromises.readFile(p, 'utf-8');
        }
      }
      return "";
    } catch (err: any) {
      console.error("Failed to load IME dict", err);
      return "";
    }
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
