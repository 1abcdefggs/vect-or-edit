import electronUpdater from 'electron-updater';
const { autoUpdater } = electronUpdater;
import { ipcMain, BrowserWindow } from 'electron';

export function setupAutoUpdater(mainWindow: BrowserWindow) {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('checking-for-update', () => {
    mainWindow.webContents.send('updater:status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('updater:status', { status: 'available', version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    mainWindow.webContents.send('updater:status', { status: 'not-available' });
  });

  autoUpdater.on('error', (err) => {
    mainWindow.webContents.send('updater:status', { status: 'error', error: err.message });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    mainWindow.webContents.send('updater:status', { 
      status: 'downloading', 
      percent: progressObj.percent,
      transferred: progressObj.transferred,
      total: progressObj.total
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow.webContents.send('updater:status', { status: 'downloaded', version: info.version });
  });

  ipcMain.handle('updater:check', () => {
    autoUpdater.checkForUpdates();
  });

  ipcMain.handle('updater:download', async () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Updater] Dev mode: Simulating download on user request...');
      mainWindow.webContents.send('updater:status', { status: 'downloading', percent: 25 });
      setTimeout(() => mainWindow.webContents.send('updater:status', { status: 'downloading', percent: 70 }), 1500);
      setTimeout(() => mainWindow.webContents.send('updater:status', { status: 'downloaded', version: 'v9.9.9' }), 3000);
      return { success: true };
    }
    return await autoUpdater.downloadUpdate();
  });

  ipcMain.handle('updater:quitAndInstall', () => {
    autoUpdater.quitAndInstall();
  });

  // --- Development UI Test ---
  // In development mode (npm run dev), autoUpdater doesn't actually check GitHub by default.
  // We simulate checking and available events so you can test the manual update button.
  if (process.env.NODE_ENV === 'development') {
    console.log('[Updater] Development mode detected. Simulating update-available in 5 seconds...');
    setTimeout(() => mainWindow.webContents.send('updater:status', { status: 'checking' }), 3000);
    setTimeout(() => mainWindow.webContents.send('updater:status', { status: 'available', version: 'v9.9.9' }), 5000);
    return;
  }

  // Start checking right away (only in production / packaged mode)
  try {
    autoUpdater.checkForUpdates().catch((e) => {
      console.warn('[Updater] Auto-update check failed:', e?.message || e);
    });
  } catch (e) {
    console.warn('[Updater] Could not initiate update check:', e);
  }
}
