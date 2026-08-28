import { app, BrowserWindow, shell, ipcMain } from 'electron';
import path from 'node:path';
import { bindLoggerToWindow, flushLogsToRenderer } from './logger';

let mainWindowInstance: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindowInstance;
}

export function createWindow(preloadPath: string, rendererUrl: string, indexPath: string): BrowserWindow {
  mainWindowInstance = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: process.platform === 'win32' ? {
      color: '#0b0f19',
      symbolColor: '#f8fafc',
      height: 38
    } : false,
    autoHideMenuBar: true,
    show: false
  });

  bindLoggerToWindow(mainWindowInstance);

  mainWindowInstance.on('ready-to-show', () => {
    mainWindowInstance?.show();
    flushLogsToRenderer();
  });

  mainWindowInstance.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    mainWindowInstance.loadURL(process.env.ELECTRON_RENDERER_URL).catch(e => console.error("Failed to load renderer URL:", e));
  } else if (!app.isPackaged && rendererUrl) {
    mainWindowInstance.loadURL(rendererUrl).catch(e => console.error("Failed to load fallback renderer URL:", e));
  } else {
    mainWindowInstance.loadFile(indexPath).catch(e => console.error("Failed to load index file:", e));
  }


  // Register Window IPCs
  ipcMain.handle('window:minimize', () => {
    mainWindowInstance?.minimize();
    return true;
  });

  ipcMain.handle('window:toggleMaximize', () => {
    if (mainWindowInstance?.isMaximized()) {
      mainWindowInstance.unmaximize();
    } else {
      mainWindowInstance?.maximize();
    }
    return true;
  });

  ipcMain.handle('window:close', () => {
    mainWindowInstance?.close();
    return true;
  });

  ipcMain.handle('window:isMaximized', () => {
    return mainWindowInstance?.isMaximized() || false;
  });

  return mainWindowInstance;
}
