import { app, ipcMain, BrowserWindow, shell, dialog } from 'electron';

import path from 'node:path';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';

import { initLogger } from './logger';
import { initRustEngine, getEngine, getVault, isRustBinaryLoaded } from './engine/rustEngine';
import {
  knowledgeSlots,
  slotItemsCache,
  getActiveProfile,
  isRustEngineReady,
  getRustEngineItemCount,
  loadProfileFile,
  resolveProfilePathForKb,
  readStrippedKnowledgeItems,
  reloadCombinedKnowledgeIndex,
  setActiveProfile,
  resetActiveProfile,
  clearKnowledgeSlots
} from './engine/knowledgeManager';
import { handleSearchVector, handleValidateDocument } from './ipcHandlers';
import { fetchClaudeSemanticSuggest, fetchGeminiSemanticSuggest, fetchOpenAISemanticSuggest } from './ai/aiServices';
import { createWindow, getMainWindow } from './windowManager';
import { saveFile, openFile, openWorkspace, getDefaultWorkspace, loadSettings, saveSettings } from './fileSystem';

let customEmbedderPath: string | null = null;
let currentKbPath: string = ""; // Default empty

initLogger();
app.commandLine.appendSwitch('disable-logging');

// 1. Single Instance Lock duplicate startup prevention
const gotTheLock = app.requestSingleInstanceLock({ appVersion: app.getVersion() });
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, _commandLine, _workingDirectory, _additionalData) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    if (app.isPackaged) {
      app.setAppUserModelId('com.vectoreditor.app');
    }

    await initRustEngine();

    createWindow(
      path.join(__dirname, '../preload/index.cjs'),
      process.env['ELECTRON_RENDERER_URL'] || '',
      path.join(__dirname, '../renderer/index.html')
    );

    const mainWindow = getMainWindow();
    if (mainWindow) {
      import('./autoUpdater').then(({ setupAutoUpdater }) => {
        setupAutoUpdater(mainWindow);
      }).catch(err => console.error("Failed to setup auto updater", err));
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow(
          path.join(__dirname, '../preload/index.cjs'),
          process.env['ELECTRON_RENDERER_URL'] || '',
          path.join(__dirname, '../renderer/index.html')
        );
      }
    });

    // --- File System IPC ---
    ipcMain.handle('app:saveFile', (_event, content, defaultName, forceDialog) => saveFile(content, defaultName, forceDialog));
    ipcMain.handle('app:openFile', () => openFile());
    ipcMain.handle('app:openWorkspace', () => openWorkspace());
    ipcMain.handle('app:getDefaultWorkspace', (_event, createIfMissing) => getDefaultWorkspace(createIfMissing));

    ipcMain.handle('app:loadSettings', () => loadSettings());
    ipcMain.handle('app:saveSettings', (_event, settings) => saveSettings(settings));

    // --- AI Suggest IPC ---
    ipcMain.handle('app:claudeSemanticSuggest', (_event, payload) => fetchClaudeSemanticSuggest(payload.prompt, payload.apiKey, payload.model));
    ipcMain.handle('app:geminiSemanticSuggest', (_event, payload) => fetchGeminiSemanticSuggest(payload.prompt, payload.apiKey, payload.model));
    ipcMain.handle('app:openaiSemanticSuggest', (_event, payload) => fetchOpenAISemanticSuggest(payload.prompt, payload.apiKey, payload.model));

    // --- Engine IPC ---
    ipcMain.handle('engine:searchVector', async (_event, vector: number[], limit = 5) => {
      if (!isRustEngineReady()) return { success: false, error: 'Knowledge base not ready' };
      return handleSearchVector({ vector, topK: limit });
    });

    ipcMain.handle('semantics:query', async (_event, queryText: string, contextText?: string) => {
      try {
        const activeProf = getActiveProfile();
        const rules = activeProf?.rules || [];
        const alerts: any[] = [];
        if (Array.isArray(rules)) {
          for (const r of rules) {
            if (r.pattern && typeof r.pattern === 'string' && queryText.includes(r.pattern)) {
              alerts.push({
                severity: r.severity || 'Warning',
                message: r.message || `Matched rule pattern: ${r.pattern}`
              });
            }
          }
        }
        const matches: any[] = [];
        const stripped: any[] = [];
        for (const items of slotItemsCache.values()) stripped.push(...items);
        for (const item of stripped) {
          const name = item.name || item.id || '';
          if (name && typeof name === 'string' && name.toLowerCase().includes(queryText.toLowerCase())) {
            matches.push(item);
            if (matches.length >= 10) break;
          }
        }
        return { success: true, data: { alerts, matches } };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });


    ipcMain.handle('embedder:getPath', () => {
      return customEmbedderPath || path.join(process.cwd(), 'node_modules/@vect-or-engine/core/models/onnx');
    });

    ipcMain.handle('embedder:setPath', async (_event, newPath: string) => {
      customEmbedderPath = newPath;
      return { success: true };
    });

    // --- Multi-Slot Knowledge & Goal Profile IPC Handlers ---
    ipcMain.handle('engine:getSemanticState', () => {
      return {
        activeGoal: getActiveProfile(),
        slots: knowledgeSlots,
        totalItems: getRustEngineItemCount()
      };
    });

    ipcMain.handle('engine:setGoalProfile', async (_event, customPath?: string) => {
      const mainWindow = getMainWindow();
      if (!mainWindow) return { success: false, error: 'No main window' };
      try {
        let targetPath = customPath;
        if (!targetPath) {
          const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Select Goal & Lint Profile JSON',
            filters: [{ name: 'Profile JSON Files', extensions: ['json'] }, { name: 'All Files', extensions: ['*'] }],
            properties: ['openFile']
          });
          if (canceled || !filePaths || filePaths.length === 0) return { success: false, canceled: true };
          targetPath = filePaths[0];
        }

        const loaded = await loadProfileFile(targetPath);
        if (!loaded) return { success: false, error: 'Failed to parse profile JSON' };

        setActiveProfile(loaded);

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('engine:status', {
            binReady: isRustBinaryLoaded(),
            kbReady: isRustEngineReady(),
            count: getRustEngineItemCount(),
            fileName: knowledgeSlots.map(s => s.name).join(', ') || 'No Knowledge Base',
            profileName: getActiveProfile()?.domain_name || getActiveProfile()?.profile_id || null
          });
        }

        return { success: true, goal: getActiveProfile(), filePath: targetPath };
      } catch (err: any) {
        console.error('[App] Failed to set goal profile:', err);
        return { success: false, error: err.message };
      }
    });

    ipcMain.handle('engine:addKnowledgeSlot', async (_event, customPath?: string, vencPassword?: string) => {
      const mainWindow = getMainWindow();
      if (!mainWindow) return { success: false, error: 'No main window' };
      try {
        let targetPath = customPath;
        const filePathsToProcess: string[] = [];

        if (!targetPath) {
          const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Add Knowledge Base (Slot)',
            filters: [
              { name: 'Knowledge Base Files', extensions: ['json', 'venc'] },
              { name: 'Encrypted Knowledge Base (.venc)', extensions: ['venc'] },
              { name: 'JSON Knowledge Base', extensions: ['json'] },
              { name: 'All Files', extensions: ['*'] }
            ],
            properties: ['openFile', 'multiSelections']
          });
          if (canceled || !filePaths || filePaths.length === 0) return { success: false, canceled: true };
          filePathsToProcess.push(...filePaths);
        } else {
          filePathsToProcess.push(targetPath);
        }

        const _vault = getVault();

        for (const fp of filePathsToProcess) {
          if (fp.includes('profile') && !fp.endsWith('.venc') && !getActiveProfile()) {
            const profile = await loadProfileFile(fp);
            setActiveProfile(profile);
            continue;
          }

          const base = path.basename(fp);
          const slotId = `slot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const isVenc = fp.endsWith('.venc');

          let resolvedPassword = vencPassword;
          if (isVenc && !resolvedPassword) {
            return { success: false, requiresPassword: true, filePath: fp, error: 'Password required for encrypted file' };
          }

          let count = 0;
          let arr: any[] = [];
          try {
            if (isVenc && _vault && resolvedPassword) {
              console.log(`[App] Decrypting ${fp} with password length: ${resolvedPassword.length}`);
              const rawBuf = await fsPromises.readFile(fp);
              arr = await _vault.decryptKnowledgeBase(rawBuf, resolvedPassword);
            } else if (!isVenc) {
              const raw = await fsPromises.readFile(fp, 'utf-8');
              arr = JSON.parse(raw);
            }
          } catch (e) {
            arr = [];
          }

          if (Array.isArray(arr) && arr.length > 0) {
            const firstItem = arr[0];
            if (!firstItem.vector || !Array.isArray(firstItem.vector)) {
              console.warn(`[App] File ${base} lacks vector embeddings.`);
              return {
                success: false,
                errorCode: 'error_slot_no_vector',
                errorParams: { file: base },
                error: `File "${base}" contains no vector embeddings.`
              };
            }
            count = arr.length;
          } else if (arr.length === 0) {
            return {
              success: false,
              errorCode: 'error_slot_empty',
              errorParams: { file: base },
              error: `File "${base}" is empty or could not be loaded.`
            };
          }

          knowledgeSlots.push({
            id: slotId,
            name: base,
            filePath: fp,
            itemCount: count,
            ...(isVenc && resolvedPassword ? { vencPassword: resolvedPassword } : {})
          });
        }

        const totalCount = await reloadCombinedKnowledgeIndex();

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('engine:status', {
            binReady: isRustBinaryLoaded(),
            kbReady: isRustEngineReady(),
            count: totalCount,
            fileName: knowledgeSlots.map(s => s.name).join(', '),
            profileName: getActiveProfile()?.domain_name || null
          });
        }

        const allStripped: any[] = [];
        for (const items of slotItemsCache.values()) allStripped.push(...items);

        return { success: true, slots: knowledgeSlots, totalCount, data: allStripped, activeGoal: getActiveProfile() };
      } catch (err: any) {
        console.error('[App] Failed to add knowledge slot:', err);
        return { success: false, error: err.message };
      }
    });

    ipcMain.handle('engine:removeKnowledgeSlot', async (_event, slotId: string) => {
      const idx = knowledgeSlots.findIndex(s => s.id === slotId);
      if (idx !== -1) {
        const removed = knowledgeSlots.splice(idx, 1)[0];
        slotItemsCache.delete(slotId);
        console.log(`[App] Removed knowledge slot: ${removed.name}`);
        const totalCount = await reloadCombinedKnowledgeIndex();
        const allStripped: any[] = [];
        for (const items of slotItemsCache.values()) allStripped.push(...items);
        return { success: true, slots: knowledgeSlots, totalCount, data: allStripped };
      }
      return { success: false, error: 'Slot not found' };
    });

    ipcMain.handle('engine:clearAllKnowledgeSlots', async () => {
      clearKnowledgeSlots();
      const totalCount = await reloadCombinedKnowledgeIndex();
      const mainWindow = getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('engine:status', {
          binReady: isRustBinaryLoaded(),
          kbReady: isRustEngineReady(),
          count: totalCount,
          fileName: 'No Knowledge Base',
          profileName: getActiveProfile()?.domain_name || null
        });
      }
      return { success: true, slots: [], totalCount: 0, data: [] };
    });

    ipcMain.handle('engine:resetGoalProfile', () => {
      resetActiveProfile();
      const mainWindow = getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('engine:status', {
          binReady: isRustBinaryLoaded(),
          kbReady: isRustEngineReady(),
          count: getRustEngineItemCount(),
          fileName: knowledgeSlots.map(s => s.name).join(', ') || 'No Knowledge Base',
          profileName: null
        });
      }
      return { success: true, goal: null };
    });

    ipcMain.handle('engine:getActiveDictName', () => {
      if (knowledgeSlots.length === 0) return path.basename(currentKbPath);
      return knowledgeSlots.map(s => s.name).join(', ');
    });

    ipcMain.handle('engine:getActiveProfile', () => getActiveProfile());

    ipcMain.handle('engine:getKnowledgeBase', async () => {
      const allStripped: any[] = [];
      for (const items of slotItemsCache.values()) allStripped.push(...items);
      if (allStripped.length > 0) return allStripped;
      try {
        return await readStrippedKnowledgeItems(currentKbPath);
      } catch (err: any) {
        console.error("Failed to load knowledge base for dictionary:", err);
        return [];
      }
    });

    ipcMain.handle('engine:importKnowledgeBase', async () => {
      const mainWindow = getMainWindow();
      if (!mainWindow) return { success: false, error: 'No main window' };
      const engine = getEngine();
      if (!engine) return { success: false, error: 'Engine not loaded' };
      try {
        const docsPath = app.getPath('documents');
        const defaultWorkspace = path.join(docsPath, 'VectOrFoldEr');
        await fsPromises.mkdir(defaultWorkspace, { recursive: true }).catch(() => { });

        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
          title: 'Import Knowledge Base / Dictionary JSON',
          defaultPath: defaultWorkspace,
          filters: [{ name: 'JSON Files', extensions: ['json'] }, { name: 'All Files', extensions: ['*'] }],
          properties: ['openFile', 'multiSelections']
        });

        if (canceled || !filePaths || filePaths.length === 0) return { success: false, canceled: true };

        clearKnowledgeSlots();

        for (const fp of filePaths) {
          if (fp.includes('profile')) {
            const profile = await loadProfileFile(fp);
            setActiveProfile(profile);
            continue;
          }
          const base = path.basename(fp);
          const slotId = `slot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          let count = 0;
          try {
            const raw = await fsPromises.readFile(fp, 'utf-8');
            const arr = JSON.parse(raw);
            count = Array.isArray(arr) ? arr.length : 0;
          } catch (e) { }

          knowledgeSlots.push({ id: slotId, name: base, filePath: fp, itemCount: count });

          if (!getActiveProfile()) {
            const companionProf = resolveProfilePathForKb(fp);
            if (companionProf) {
              const profile = await loadProfileFile(companionProf);
              setActiveProfile(profile);
            }
          }
        }

        const totalCount = await reloadCombinedKnowledgeIndex();
        const allStripped: any[] = [];
        for (const items of slotItemsCache.values()) allStripped.push(...items);

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('engine:status', {
            binReady: isRustBinaryLoaded(),
            kbReady: true,
            count: totalCount,
            fileName: knowledgeSlots.map(s => s.name).join(', '),
            profileName: getActiveProfile()?.domain_name || null
          });
        }

        return {
          success: true,
          fileName: knowledgeSlots.map(s => s.name).join(', '),
          profileName: getActiveProfile()?.domain_name || null,
          count: totalCount,
          data: allStripped,
          slots: knowledgeSlots
        };
      } catch (err: any) {
        console.error('[App] Failed to import knowledge base:', err);
        return { success: false, error: err.message };
      }
    });

    ipcMain.handle('app:loadImeDict', async () => {
      try {
        const dictPath = app.isPackaged
          ? path.join(process.resourcesPath, 'custom-ime-dict.txt')
          : path.join(__dirname, '../../public/custom-ime-dict.txt');
        if (fs.existsSync(dictPath)) return await fsPromises.readFile(dictPath, 'utf-8');
        return "";
      } catch (err: any) {
        console.warn("IME dict file not present:", err);
        return "";
      }
    });

    ipcMain.handle('app:setTitleBarOverlay', async (_event, options: { color: string; symbolColor: string; height?: number }) => {
      try {
        const mainWindow = getMainWindow();
        if (mainWindow && process.platform === 'win32') {
          mainWindow.setTitleBarOverlay({
            color: options.color,
            symbolColor: options.symbolColor,
            height: options.height ?? 38
          });
        }
        return { success: true };
      } catch (err: any) {
        console.warn('[App] Could not update titleBarOverlay:', err);
        return { success: false, error: err.message };
      }
    });

    ipcMain.handle('app:validateDocument', async (_event, text: string) => {
      return handleValidateDocument({ text });
    });

    ipcMain.handle('app:openExternal', async (_event, url) => {
      try {
        const parsed = new URL(url);
        if (!['https:', 'http:'].includes(parsed.protocol)) {
          console.warn('[Security] Rejected non-http(s) scheme in app:openExternal:', url);
          return { success: false, error: 'Only http and https protocols are allowed' };
        }
        await shell.openExternal(url);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });

    ipcMain.handle('engine:getEngineStatus', async () => {
      return {
        binReady: isRustBinaryLoaded(),
        kbReady: isRustEngineReady(),
        count: getRustEngineItemCount(),
        fileName: knowledgeSlots.map(s => s.name).join(', ') || 'No Knowledge Base',
        profileName: getActiveProfile()?.domain_name || null
      }
    });
  });
}


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
