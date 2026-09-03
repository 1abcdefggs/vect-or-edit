import { app, BrowserWindow, shell, ipcMain } from 'electron';
import path from 'node:path';
import { bindLoggerToWindow, flushLogsToRenderer } from './logger';

let mainWindowInstance: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindowInstance;
}

export function createWindow(preloadPath: string, rendererUrl: string, indexPath: string): BrowserWindow {
  const iconPath = app.isPackaged
    ? path.join(__dirname, '../renderer/assets/icon.png')
    : path.join(__dirname, '../../public/icon.png');

  mainWindowInstance = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: iconPath,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    autoHideMenuBar: false,
    show: true
  });

  bindLoggerToWindow(mainWindowInstance);

  mainWindowInstance.once('ready-to-show', () => {
    mainWindowInstance?.show();
    flushLogsToRenderer();
  });

  // Fallback to guarantee window visibility in dev environments
  setTimeout(() => {
    if (mainWindowInstance && !mainWindowInstance.isVisible()) {
      mainWindowInstance.show();
      flushLogsToRenderer();
    }
  }, 1500);

  mainWindowInstance.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  const targetUrl = process.env.ELECTRON_RENDERER_URL || rendererUrl;
  if (!app.isPackaged && targetUrl) {
    console.log('[Window] Loading renderer URL:', targetUrl);
    mainWindowInstance.loadURL(targetUrl).catch(e => {
      console.error("[Window] Failed to load renderer URL, falling back to file:", e);
      mainWindowInstance?.loadFile(indexPath).catch(err => console.error("[Window] Failed to load index file:", err));
    });
  } else {
    console.log('[Window] Loading index file:', indexPath);
    mainWindowInstance.loadFile(indexPath).catch(e => console.error("[Window] Failed to load index file:", e));
  }

  mainWindowInstance.webContents.on('did-finish-load', () => {
    console.log('[Window] Renderer did-finish-load');
    mainWindowInstance?.show();
    mainWindowInstance?.focus();
    flushLogsToRenderer();
  });

  mainWindowInstance.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Window] did-fail-load: ${errorCode} ${errorDescription} (${validatedURL})`);
  });


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
