import electronUpdater from 'electron-updater';
const { autoUpdater } = electronUpdater;
import { ipcMain, BrowserWindow } from 'electron';

// Fake update events for UI testing. Enabled only when explicitly requested.
const SIMULATE_UPDATER = process.env.VECTOR_UPDATER_SIMULATE === '1';

// The portable build cannot replace itself. It only notifies, and the user downloads from the release page.
// electron-builder's portable launcher sets PORTABLE_EXECUTABLE_FILE.
const IS_PORTABLE = Boolean(process.env.PORTABLE_EXECUTABLE_FILE);
export const RELEASES_URL = 'https://github.com/vect-organization/vect-or-edit/releases/latest';

export function setupAutoUpdater(mainWindow: BrowserWindow) {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('checking-for-update', () => {
    mainWindow.webContents.send('updater:status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('updater:status', { status: 'available', version: info.version, portable: IS_PORTABLE, url: RELEASES_URL });
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
    if (IS_PORTABLE && !SIMULATE_UPDATER) {
      throw new Error('Portable build cannot self-update. Download the new version from the release page.');
    }
    if (SIMULATE_UPDATER) {
      console.log('[Updater] Simulation mode: faking download on user request...');
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

  // --- UI Test ---
  // With VECTOR_UPDATER_SIMULATE=1, emit checking and available events so the manual update button can be tested.
  if (SIMULATE_UPDATER) {
    console.log('[Updater] VECTOR_UPDATER_SIMULATE=1: simulating update-available in 5 seconds...');
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
