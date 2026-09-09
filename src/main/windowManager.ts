import path from 'node:path';
import { app, BrowserWindow, shell, ipcMain } from 'electron';
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
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#080c16',
      symbolColor: '#94a3b8',
      height: 38
    },
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#080c16'
  });

  bindLoggerToWindow(mainWindowInstance);

  mainWindowInstance.once('ready-to-show', () => {
    if (mainWindowInstance && !mainWindowInstance.isVisible()) {
      mainWindowInstance.show();
      flushLogsToRenderer();
    }
  });

  // Fallback to guarantee window visibility in dev environments
  setTimeout(() => {
    if (mainWindowInstance && !mainWindowInstance.isVisible()) {
      mainWindowInstance.show();
      flushLogsToRenderer();
    }
  }, 1500);

  // Security: Prevent arbitrary window opens & restrict to https/http external browser only
  mainWindowInstance.webContents.setWindowOpenHandler((details) => {
    try {
      const parsedUrl = new URL(details.url);
      if (['https:', 'http:'].includes(parsedUrl.protocol)) {
        shell.openExternal(details.url);
      } else {
        console.warn('[Security] Blocked untrusted external URL scheme:', details.url);
      }
    } catch (e) {
      console.warn('[Security] Malformed URL rejected:', details.url);
    }
    return { action: 'deny' };
  });

  // Security: Prevent in-app navigation to unauthorized URLs
  mainWindowInstance.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    const targetUrl = process.env.ELECTRON_RENDERER_URL || rendererUrl;
    if (targetUrl) {
      try {
        const allowedOrigin = new URL(targetUrl).origin;
        if (parsedUrl.origin === allowedOrigin) return;
      } catch { }
    }
    if (parsedUrl.protocol === 'file:') return;

    // Block unknown navigation and open safely in external browser if http(s)
    event.preventDefault();
    if (['https:', 'http:'].includes(parsedUrl.protocol)) {
      shell.openExternal(navigationUrl);
    }
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
    if (!app.isPackaged) {
      mainWindowInstance?.webContents.openDevTools({ mode: 'detach' });
    }
  });

  mainWindowInstance.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[Renderer Console - Lvl ${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindowInstance.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Window] did-fail-load: ${errorCode} ${errorDescription} (${validatedURL})`);
  });

  mainWindowInstance.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[Window] render-process-gone:`, details);
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
