import { app, BrowserWindow, shell, dialog, session } from 'electron';
import { handleTrusted, installPermissionPolicy } from './ipcSecurity';

import path from 'node:path';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';

import { initLogger, exportLogBacklog } from './logger';
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
  normalizeKbPayload,
  reloadCombinedKnowledgeIndex,
  getQueryTruncateTo,
  setActiveEmbeddingModel,
  setActiveProfile,
  resetActiveProfile,
  clearKnowledgeSlots
} from './engine/knowledgeManager';
import { handleSearchVector, handleValidateDocument } from './ipcHandlers';
import { truncateAndNormalize } from '../shared/embeddingSpace';
import { fetchClaudeSemanticSuggest, fetchGeminiSemanticSuggest, fetchOpenAISemanticSuggest, fetchLLMEmbedding, listGeminiModels, isApiKeyProvider, saveApiKey, hasStoredApiKey, clearApiKey } from './ai/aiServices';
import { createWindow, getMainWindow } from './windowManager';
import { saveFile, openFile, openWorkspace, getDefaultWorkspace, chooseDefaultWorkspace, renameDefaultWorkspace, resetDefaultWorkspace, loadSettings, saveSettings } from './fileSystem';
import { getCursorBaseSize } from './cursorSize';

let currentKbPath: string = ""; // Default empty

initLogger();
if (app.isPackaged) {
  app.commandLine.appendSwitch('disable-logging');
}

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
      app.setAppUserModelId('com.vectoredit.app');
    }

    await initRustEngine();
    installPermissionPolicy();

    handleTrusted('app:getVersion', () => app.getVersion());
    handleTrusted('app:requestLogBacklog', () => exportLogBacklog());
    // Where the app keeps its own data (the embedding model is cached inside it); shown in first-run setup
    handleTrusted('app:getUserDataPath', () => app.getPath('userData'));
    // The app's own license plus the generated third-party notices (scripts/generate-notices.mjs); null when not bundled
    handleTrusted('app:getThirdPartyNotices', () => {
      const dirs = app.isPackaged
        ? [process.resourcesPath]
        : [app.getAppPath(), path.join(app.getAppPath(), 'build-dist')];
      const read = (name: string): string | null => {
        for (const dir of dirs) {
          try { return fs.readFileSync(path.join(dir, name), 'utf8'); } catch { /* try the next folder */ }
        }
        return null;
      };
      const license = read('LICENSE');
      const notices = read('THIRD_PARTY_NOTICES.txt');
      return license === null && notices === null ? null : [license, notices].filter(Boolean).join('\n\n');
    });

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
    handleTrusted('app:saveFile', (_event, content, defaultName, forceDialog) => saveFile(content, defaultName, forceDialog));
    handleTrusted('app:openFile', () => openFile());
    handleTrusted('app:openWorkspace', () => openWorkspace());
    handleTrusted('app:getDefaultWorkspace', (_event, createIfMissing) => getDefaultWorkspace(createIfMissing));
    handleTrusted('app:chooseDefaultWorkspace', () => chooseDefaultWorkspace());
    handleTrusted('app:renameDefaultWorkspace', (_event, name: unknown) => renameDefaultWorkspace(name));
    handleTrusted('app:resetDefaultWorkspace', () => resetDefaultWorkspace());

    handleTrusted('app:loadSettings', () => loadSettings());
    handleTrusted('app:saveSettings', (_event, settings) => saveSettings(settings));

    // --- AI Suggest IPC ---
    // Keys are never taken from the renderer: every request reads the encrypted key stored in the main process.
    handleTrusted('app:claudeSemanticSuggest', (_event, payload) => fetchClaudeSemanticSuggest(payload.prompt, undefined, payload.model));
    handleTrusted('app:geminiSemanticSuggest', (_event, payload) => fetchGeminiSemanticSuggest(payload.prompt, undefined, payload.model));
    handleTrusted('app:saveApiKey', (_event, provider: unknown, apiKey: string) =>
      isApiKeyProvider(provider) ? saveApiKey(provider, apiKey) : { success: false, error: 'Unknown provider.' });
    handleTrusted('app:hasApiKey', (_event, provider: unknown) => isApiKeyProvider(provider) ? hasStoredApiKey(provider) : false);
    handleTrusted('app:clearApiKey', (_event, provider: unknown) =>
      isApiKeyProvider(provider) ? clearApiKey(provider) : { success: false, error: 'Unknown provider.' });
    handleTrusted('app:getCursorBaseSize', () => getCursorBaseSize());
    handleTrusted('app:listGeminiModels', (_event, apiKey?: string) => listGeminiModels(apiKey));
    handleTrusted('app:openaiSemanticSuggest', (_event, payload) => fetchOpenAISemanticSuggest(payload.prompt, undefined, payload.model));
    // LLM-as-Embedding: converts text → pseudo-vector via LLM response
    handleTrusted('app:llmEmbedding', (_event, payload) =>
      fetchLLMEmbedding(payload.text, payload.provider, payload.model, undefined, payload.dimensions)
    );

    // --- Engine IPC ---
    handleTrusted('engine:searchVector', async (_event, vector: number[], limit = 5) => {
      if (!isRustEngineReady()) return { success: false, error: 'Knowledge base not ready' };
      // The index holds shorter vectors than the model makes (same space): cut the query the same way
      const cutTo = getQueryTruncateTo();
      const query = cutTo && vector.length > cutTo ? truncateAndNormalize(vector, cutTo) : vector;
      return handleSearchVector({ vector: query, topK: limit });
    });

    // The renderer announces the selected embedding model; the index is rebuilt when the choice changes what can be compared
    handleTrusted('engine:setEmbeddingModel', async (_event, modelId: string, allowTruncation?: boolean) => {
      if (typeof modelId !== 'string' || !modelId) return { success: false };
      if (setActiveEmbeddingModel(modelId, allowTruncation !== false) && knowledgeSlots.length > 0) await reloadCombinedKnowledgeIndex();
      return { success: true, slots: knowledgeSlots };
    });

    handleTrusted('semantics:query', async (_event, queryText: string, contextText?: string) => {
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


    // --- Multi-Slot Knowledge & Goal Profile IPC Handlers ---
    // Header only (domain, version, dimension, ...): the entries are never sent to the sidebar.
    // An encrypted (.venc) slot shows its header only while its password is held in memory.
    handleTrusted('engine:getSlotInfo', async (_event, slotId: string) => {
      const slot = knowledgeSlots.find((s) => s.id === slotId);
      if (!slot) return { success: false, error: 'Slot not found' };
      const isVenc = slot.filePath.endsWith('.venc');
      if (isVenc && !slot.vencPassword) {
        return { success: true, encrypted: true, itemCount: slot.itemCount };
      }
      try {
        const raw = await fsPromises.readFile(slot.filePath);
        const vault = getVault();
        const payload = isVenc && vault
          ? await vault.decryptKnowledgeBase(raw, slot.vencPassword as string)
          : JSON.parse(raw.toString('utf-8'));
        const pick = (key: string) => (payload && payload[key] !== undefined ? payload[key] : null);
        return {
          success: true,
          encrypted: isVenc,
          itemCount: slot.itemCount,
          header: {
            domain: pick('domain'),
            version: pick('version'),
            dimension: pick('dimension'),
            metric: pick('metric'),
            fidelity_score: pick('fidelity_score'),
            is_sanitized: pick('is_sanitized'),
            schemaVersion: pick('schemaVersion'),
          },
        };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Could not read the file' };
      }
    });

    handleTrusted('engine:getSemanticState', () => {
      return {
        activeGoal: getActiveProfile(),
        slots: knowledgeSlots,
        totalItems: getRustEngineItemCount()
      };
    });

    handleTrusted('engine:setGoalProfile', async (_event, customPath?: string) => {
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

    handleTrusted('engine:addKnowledgeSlot', async (_event, customPath?: string, vencPassword?: string) => {
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
          let skippedNoVector = 0;
          try {
            let normalized: { items: any[]; skipped: number } | null = null;
            if (isVenc && _vault && resolvedPassword) {
              console.log(`[App] Decrypting ${fp} with password length: ${resolvedPassword.length}`);
              const rawBuf = await fsPromises.readFile(fp);
              normalized = normalizeKbPayload(await _vault.decryptKnowledgeBase(rawBuf, resolvedPassword));
            } else if (!isVenc) {
              const raw = await fsPromises.readFile(fp, 'utf-8');
              normalized = normalizeKbPayload(JSON.parse(raw));
            }
            if (normalized) {
              arr = normalized.items;
              skippedNoVector = normalized.skipped;
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
            if (skippedNoVector > 0) {
              return {
                success: false,
                errorCode: 'error_slot_no_vector',
                errorParams: { file: base },
                error: `File "${base}" contains no vector embeddings.`
              };
            }
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

    handleTrusted('engine:removeKnowledgeSlot', async (_event, slotId: string) => {
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

    handleTrusted('engine:clearAllKnowledgeSlots', async () => {
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

    handleTrusted('engine:resetGoalProfile', () => {
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

    handleTrusted('engine:getActiveDictName', () => {
      if (knowledgeSlots.length === 0) return path.basename(currentKbPath);
      return knowledgeSlots.map(s => s.name).join(', ');
    });

    handleTrusted('engine:getActiveProfile', () => getActiveProfile());

    handleTrusted('engine:getKnowledgeBase', async () => {
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

    handleTrusted('engine:importKnowledgeBase', async () => {
      const mainWindow = getMainWindow();
      if (!mainWindow) return { success: false, error: 'No main window' };
      const engine = getEngine();
      if (!engine) return { success: false, error: 'Engine not loaded' };
      try {
        const ws = await getDefaultWorkspace(true);
        const defaultWorkspace = ws.path;

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
            count = normalizeKbPayload(JSON.parse(raw)).items.length;
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

    handleTrusted('app:loadImeDict', async () => {
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

    handleTrusted('app:setTitleBarOverlay', async (_event, options: { color: string; symbolColor: string; height?: number }) => {
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

    handleTrusted('app:clearCache', async () => {
      try {
        await session.defaultSession.clearCache();
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });

    handleTrusted('app:restart', () => {
      app.relaunch();
      app.exit(0);
    });

    handleTrusted('app:validateDocument', async (_event, text: string) => {
      return handleValidateDocument({ text });
    });

    handleTrusted('app:openExternal', async (_event, url) => {
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

    handleTrusted('engine:getEngineStatus', async () => {
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
