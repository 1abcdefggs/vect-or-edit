import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import * as fs from 'node:fs';
import fsPromises from 'node:fs/promises';

// Import N-API engine bindings
// eslint-disable-next-line @typescript-eslint/no-var-requires
let engine: any = null;
let rustBinaryLoaded = false;

try {
  engine = require('../../../vect-or-engine/index.js');
  rustBinaryLoaded = true;
} catch (e) {
  console.error('[App] Failed to bind Rust N-API engine binary:', e);
}

// Disable GPU shader disk cache and HTTP disk cache to avoid Windows cache permission conflicts
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-http-cache');

// Set isolated temporary userData path in development mode to prevent file locks while keeping AI model cache persistent
if (!app.isPackaged) {
  try {
    const tempUserData = path.join(app.getPath('temp'), 'vectoreditor-dev-user-data');
    app.setPath('userData', tempUserData);
  } catch (e) {
    // Ignore error if app is already initialized
  }
}

let mainWindow: BrowserWindow | null = null;
let rustEngineReady = false;
let rustEngineItemCount = 0;
let activeProfile: any = null;

function resolveProfilePathForKb(kbPath: string): string | null {
  const dir = path.dirname(kbPath);
  const baseName = path.basename(kbPath);
  
  // Strip prefixes & suffixes to get core domain identifier
  const core = baseName
    .replace(/^kb_/, '')
    .replace(/_knowledge_base\.json$/i, '')
    .replace(/\.json$/i, '');

  const candidateNames = [
    `guideline_${core}.json`,
    `preset_${core}.json`,
    `${core}_guideline.json`,
    `${core}_preset.json`,
    `${core}_profile.json`,
    'guideline.json',
    'preset.json',
    'profile.json'
  ];

  for (const name of candidateNames) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function loadProfileFile(profilePath: string): Promise<any> {
  try {
    if (fs.existsSync(profilePath)) {
      const text = await fsPromises.readFile(profilePath, 'utf-8');
      const data = JSON.parse(text);
      console.log(`[App] Loaded Lint Profile from ${path.basename(profilePath)}: ${data.domain_name || data.profile_id || 'OK'}`);
      return data;
    }
  } catch (err) {
    console.warn(`[App] Failed to read profile at ${profilePath}:`, err);
  }
  return null;
}
async function readStrippedKnowledgeItems(targetPath: string): Promise<any[]> {
  if (!targetPath || !fs.existsSync(targetPath)) return [];
  try {
    const content = await fsPromises.readFile(targetPath, 'utf-8');
    const list = JSON.parse(content);
    if (!Array.isArray(list)) return [];
    return list.map((item: any) => {
      const { vector, ...rest } = item;
      return rest;
    });
  } catch {
    return [];
  }
}

function resolveAppIconPath(): string {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '../../public/icon.png');
  return fs.existsSync(iconPath) ? iconPath : path.join(process.cwd(), 'public/icon.png');
}

function createWindow(): void {
  const iconPath = resolveAppIconPath();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#87abdb',
      symbolColor: '#111111',
      height: 48
    },
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true
    }
  });

  // Explicitly set window icon for Windows taskbar
  if (iconPath && fs.existsSync(iconPath)) {
    try {
      mainWindow.setIcon(iconPath);
    } catch (err) {
      console.warn('[App] Failed to set window icon:', err);
    }
  }

  // Forward renderer & AI worker console logs directly to the IDE terminal and renderer log panel
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levelLabel = level === 3 ? 'ERROR' : (level === 2 ? 'WARN' : 'INFO');
    const source = path.basename(sourceId || 'renderer');
    console.log(`[Renderer:${levelLabel}:${source}:${line}] ${message}`);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app:systemLog', {
        time: new Date().toLocaleTimeString(),
        source: `Renderer:${source}:${line}`,
        level: levelLabel,
        message: message
      });
    }
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  // Set App User Model ID for Windows Taskbar icon grouping and branding
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.vectoreditor.app');
  }

  createWindow();

  // For clean Open Source standalone editor: start with empty knowledge slots (no hardcoded domain files)
  let currentKbPath = '';
  activeProfile = null;
  rustEngineReady = rustBinaryLoaded;
  rustEngineItemCount = 0;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('engine:status', {
      binReady: rustBinaryLoaded,
      kbReady: true,
      count: 0,
      fileName: '',
      profileName: null
    });
  }

  // Safe IPC Handler for Vector Search via N-API with dynamic limit
  ipcMain.handle('engine:searchVector', async (_event, vector: number[], limit = 5) => {
    if (!engine) return { success: false, error: 'Engine not loaded' };
    try {
      const floatArray = new Float32Array(vector);
      const searchLimit = typeof limit === 'number' && limit > 0 ? limit : 5;
      const rawResults = await engine.search(floatArray, searchLimit);
      // Flatten metadata into result items for renderer
      const results = rawResults.map((r: any) => ({
        id: r.id,
        score: r.score,
        ...(typeof r.metadata === 'object' && r.metadata !== null ? r.metadata : { metadata: r.metadata })
      }));
      return { success: true, data: results };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('engine:getEngineStatus', () => {
    return {
      binReady: rustBinaryLoaded,
      kbReady: rustEngineReady,
      count: rustEngineItemCount,
      fileName: path.basename(currentKbPath),
      profileName: activeProfile?.domain_name || null
    };
  });

  ipcMain.handle('app:saveFile', async (_event, content: string, defaultName: string) => {
    if (!mainWindow) return { success: false, error: 'No main window' };
    try {
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        defaultPath: defaultName,
        filters: [{ name: 'Text/Markdown', extensions: ['txt', 'md'] }, { name: 'All Files', extensions: ['*'] }]
      });
      if (!canceled && filePath) {
        await fsPromises.writeFile(filePath, content, 'utf-8');
        return { success: true, filePath };
      }
      return { success: false, canceled: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('app:openFile', async () => {
    if (!mainWindow) return { success: false, error: 'No main window' };
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Open Document',
        filters: [{ name: 'Text/Markdown', extensions: ['txt', 'md', 'json', 'csv'] }, { name: 'All Files', extensions: ['*'] }],
        properties: ['openFile']
      });
      if (!canceled && filePaths && filePaths.length > 0) {
        const filePath = filePaths[0];
        const content = await fsPromises.readFile(filePath, 'utf-8');
        return { success: true, filePath, content, fileName: path.basename(filePath) };
      }
      return { success: false, canceled: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('app:validateDocument', async (_event, text: string) => {
    const markers: any[] = [];
    let is_valid = true;

    // 1. Dynamic Lint Profile validation if loaded
    if (activeProfile && Array.isArray(activeProfile.rules)) {
      const lines = text.split('\n');
      for (const rule of activeProfile.rules) {
        if (Array.isArray(rule.trigger_keywords)) {
          for (const kw of rule.trigger_keywords) {
            lines.forEach((lineText, lineIdx) => {
              if (lineText.includes(kw)) {
                markers.push({
                  severity: rule.severity || 'Warning',
                  message: rule.message || `Triggered rule: ${rule.id}`,
                  line: lineIdx + 1
                });
                if (rule.severity === 'Error') is_valid = false;
              }
            });
          }
        }
      }
    }

    // 2. Rust Engine validation (fallback / core rules)
    if (engine) {
      try {
        let rustResult: any = null;
        if (engine.validate) {
          rustResult = await engine.validate(text);
        } else if (engine.validateSync) {
          rustResult = engine.validateSync(text);
        }
        if (rustResult && Array.isArray(rustResult.markers)) {
          markers.push(...rustResult.markers);
          if (!rustResult.is_valid) is_valid = false;
        }
      } catch (err: any) {
        console.error('Validation error from Rust Engine:', err);
      }
    }

    return { is_valid, markers };
  });

// Multi-Slot Knowledge & Goal Profile State Management
interface KnowledgeSlot {
  id: string;
  name: string;
  filePath: string;
  itemCount: number;
}

const knowledgeSlots: KnowledgeSlot[] = [];
let slotItemsCache: Map<string, any[]> = new Map();

async function reloadCombinedKnowledgeIndex(): Promise<number> {
  if (!engine) return 0;
  
  if (knowledgeSlots.length === 0) {
    rustEngineReady = false;
    rustEngineItemCount = 0;
    return 0;
  }

  // Combine items from all slots into a temporary combined file or load the primary one
  const allItems: any[] = [];
  for (const slot of knowledgeSlots) {
    try {
      if (fs.existsSync(slot.filePath)) {
        const raw = await fsPromises.readFile(slot.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          allItems.push(...parsed);
          slotItemsCache.set(slot.id, parsed.map((it: any) => {
            const { vector, ...rest } = it;
            return rest;
          }));
        }
      }
    } catch (e) {
      console.warn(`[App] Error reading slot ${slot.id} (${slot.name}):`, e);
    }
  }

  // Save temporary merged knowledge base for Rust HNSW indexer
  const tempCombinedPath = path.join(app.getPath('userData'), 'combined_knowledge_base.json');
  await fsPromises.writeFile(tempCombinedPath, JSON.stringify(allItems), 'utf-8');

  try {
    const count = await engine.loadKnowledgeBase(tempCombinedPath);
    await engine.buildIndex();
    rustEngineReady = true;
    rustEngineItemCount = count;
    console.log(`[App] Successfully rebuilt combined HNSW index across ${knowledgeSlots.length} slot(s) with ${count} total items`);
    return count;
  } catch (err) {
    console.error("[App] Failed to rebuild combined HNSW index:", err);
    return 0;
  }
}

  // --- Multi-Slot Knowledge & Goal Profile IPC Handlers ---

  ipcMain.handle('engine:getSemanticState', () => {
    return {
      activeGoal: activeProfile,
      slots: knowledgeSlots,
      totalItems: rustEngineItemCount
    };
  });

  ipcMain.handle('engine:setGoalProfile', async (_event, customPath?: string) => {
    if (!mainWindow) return { success: false, error: 'No main window' };
    try {
      let targetPath = customPath;
      if (!targetPath) {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
          title: 'Select Goal & Lint Profile JSON',
          filters: [
            { name: 'Profile JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] }
          ],
          properties: ['openFile']
        });
        if (canceled || !filePaths || filePaths.length === 0) {
          return { success: false, canceled: true };
        }
        targetPath = filePaths[0];
      }

      const loaded = await loadProfileFile(targetPath);
      if (!loaded) {
        return { success: false, error: 'Failed to parse profile JSON' };
      }

      activeProfile = loaded;
      console.log(`[App] Active Goal Profile set to: ${activeProfile.domain_name || activeProfile.profile_id}`);

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('engine:status', {
          binReady: rustBinaryLoaded,
          kbReady: rustEngineReady,
          count: rustEngineItemCount,
          fileName: knowledgeSlots.map(s => s.name).join(', ') || 'No Knowledge Base',
          profileName: activeProfile?.domain_name || activeProfile?.profile_id || null
        });
      }

      return {
        success: true,
        goal: activeProfile,
        filePath: targetPath
      };
    } catch (err: any) {
      console.error('[App] Failed to set goal profile:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('engine:addKnowledgeSlot', async (_event, customPath?: string) => {
    if (!mainWindow) return { success: false, error: 'No main window' };
    try {
      let targetPath = customPath;
      if (!targetPath) {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
          title: 'Add Knowledge Base JSON (Slot)',
          filters: [
            { name: 'Knowledge JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] }
          ],
          properties: ['openFile', 'multiSelections']
        });
        if (canceled || !filePaths || filePaths.length === 0) {
          return { success: false, canceled: true };
        }
        
        for (const fp of filePaths) {
          if (fp.includes('profile') && !activeProfile) {
            activeProfile = await loadProfileFile(fp);
            continue;
          }
          const base = path.basename(fp);
          const slotId = `slot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          
          let count = 0;
          try {
            const raw = await fsPromises.readFile(fp, 'utf-8');
            const arr = JSON.parse(raw);
            count = Array.isArray(arr) ? arr.length : 0;
          } catch (e) {
            count = 0;
          }

          knowledgeSlots.push({
            id: slotId,
            name: base,
            filePath: fp,
            itemCount: count
          });
        }
      } else {
        const base = path.basename(targetPath);
        const slotId = `slot_${Date.now()}`;
        knowledgeSlots.push({
          id: slotId,
          name: base,
          filePath: targetPath,
          itemCount: 0
        });
      }

      const totalCount = await reloadCombinedKnowledgeIndex();

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('engine:status', {
          binReady: rustBinaryLoaded,
          kbReady: rustEngineReady,
          count: totalCount,
          fileName: knowledgeSlots.map(s => s.name).join(', '),
          profileName: activeProfile?.domain_name || null
        });
      }

      // Return all stripped items across all slots
      const allStripped: any[] = [];
      for (const items of slotItemsCache.values()) {
        allStripped.push(...items);
      }

      return {
        success: true,
        slots: knowledgeSlots,
        totalCount,
        data: allStripped,
        activeGoal: activeProfile
      };
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
      for (const items of slotItemsCache.values()) {
        allStripped.push(...items);
      }

      return {
        success: true,
        slots: knowledgeSlots,
        totalCount,
        data: allStripped
      };
    }
    return { success: false, error: 'Slot not found' };
  });

  ipcMain.handle('engine:getActiveDictName', () => {
    if (knowledgeSlots.length === 0) return path.basename(currentKbPath);
    return knowledgeSlots.map(s => s.name).join(', ');
  });

  ipcMain.handle('engine:getActiveProfile', () => {
    return activeProfile;
  });

  ipcMain.handle('engine:getKnowledgeBase', async () => {
    const allStripped: any[] = [];
    for (const items of slotItemsCache.values()) {
      allStripped.push(...items);
    }
    if (allStripped.length > 0) return allStripped;
    try {
      return await readStrippedKnowledgeItems(currentKbPath);
    } catch (err: any) {
      console.error("Failed to load knowledge base for dictionary:", err);
      return [];
    }
  });

  ipcMain.handle('engine:importKnowledgeBase', async () => {
    if (!mainWindow) return { success: false, error: 'No main window' };
    if (!engine) return { success: false, error: 'Engine not loaded' };
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Import Knowledge Base / Dictionary JSON',
        filters: [{ name: 'JSON Files', extensions: ['json'] }, { name: 'All Files', extensions: ['*'] }],
        properties: ['openFile', 'multiSelections']
      });

      if (canceled || !filePaths || filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      // Reset existing slots and import new selected files as slots
      knowledgeSlots.length = 0;
      slotItemsCache.clear();

      for (const fp of filePaths) {
        if (fp.includes('profile')) {
          activeProfile = await loadProfileFile(fp);
          continue;
        }
        const base = path.basename(fp);
        const slotId = `slot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        let count = 0;
        try {
          const raw = await fsPromises.readFile(fp, 'utf-8');
          const arr = JSON.parse(raw);
          count = Array.isArray(arr) ? arr.length : 0;
        } catch (e) {}

        knowledgeSlots.push({
          id: slotId,
          name: base,
          filePath: fp,
          itemCount: count
        });

        // Auto-discover companion profile if not yet loaded
        if (!activeProfile) {
          const companionProf = resolveProfilePathForKb(fp);
          if (companionProf) {
            activeProfile = await loadProfileFile(companionProf);
          }
        }
      }

      const totalCount = await reloadCombinedKnowledgeIndex();
      const allStripped: any[] = [];
      for (const items of slotItemsCache.values()) {
        allStripped.push(...items);
      }

      console.log(`[App] Multi-import completed with ${knowledgeSlots.length} slots (${totalCount} items), Profile: ${activeProfile?.domain_name || 'Default'}`);
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('engine:status', {
          binReady: rustBinaryLoaded,
          kbReady: true,
          count: totalCount,
          fileName: knowledgeSlots.map(s => s.name).join(', '),
          profileName: activeProfile?.domain_name || null
        });
      }

      return {
        success: true,
        fileName: knowledgeSlots.map(s => s.name).join(', '),
        profileName: activeProfile?.domain_name || null,
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
      if (fs.existsSync(dictPath)) {
        return await fsPromises.readFile(dictPath, 'utf-8');
      }
      return "";
    } catch (err: any) {
      console.warn("IME dict file not present:", err);
      return "";
    }
  });

  // Dynamic TitleBarOverlay Handler for theme changes (Windows only)
  ipcMain.handle('app:setTitleBarOverlay', async (_event, options: { color: string; symbolColor: string; height?: number }) => {
    try {
      if (mainWindow && process.platform === 'win32') {
        mainWindow.setTitleBarOverlay({
          color: options.color,
          symbolColor: options.symbolColor,
          height: options.height ?? 48
        });
      }
      return { success: true };
    } catch (err: any) {
      console.warn('[App] Could not update titleBarOverlay:', err);
      return { success: false, error: err.message };
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
})


