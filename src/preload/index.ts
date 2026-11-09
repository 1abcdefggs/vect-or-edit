import { contextBridge, ipcRenderer, webFrame, webUtils } from 'electron';
import type { 
  EngineAPI, 
  EngineStatus, 
  SystemLogEntry, 
  TitleBarOverlayOptions 
} from './types';

const engineAPI: EngineAPI = {
  searchVector: (vector: number[], limit?: number) => ipcRenderer.invoke('engine:searchVector', vector, limit),
  setEmbeddingModel: (modelId: string, allowTruncation?: boolean) => ipcRenderer.invoke('engine:setEmbeddingModel', modelId, allowTruncation),
  saveFile: (content: string, defaultName?: string, forceDialog?: boolean) => ipcRenderer.invoke('app:saveFile', content, defaultName, forceDialog),
  openFile: () => ipcRenderer.invoke('app:openFile'),
  openWorkspace: () => ipcRenderer.invoke('app:openWorkspace'),
  getDefaultWorkspace: (createIfMissing?: boolean) => ipcRenderer.invoke('app:getDefaultWorkspace', createIfMissing),
  chooseDefaultWorkspace: () => ipcRenderer.invoke('app:chooseDefaultWorkspace'),
  renameDefaultWorkspace: (name: string) => ipcRenderer.invoke('app:renameDefaultWorkspace', name),
  resetDefaultWorkspace: () => ipcRenderer.invoke('app:resetDefaultWorkspace'),
  snapshotDefaultWorkspace: () => ipcRenderer.invoke('app:snapshotDefaultWorkspace'),
  restoreDefaultWorkspace: () => ipcRenderer.invoke('app:restoreDefaultWorkspace'),
  loadSettings: () => ipcRenderer.invoke('app:loadSettings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('app:saveSettings', settings),
  validateDocument: (text: string) => ipcRenderer.invoke('app:validateDocument', text),
  loadImeDict: () => ipcRenderer.invoke('app:loadImeDict'),
  getKnowledgeBase: () => ipcRenderer.invoke('engine:getKnowledgeBase'),
  getActiveDictName: () => ipcRenderer.invoke('engine:getActiveDictName'),
  getActiveProfile: () => ipcRenderer.invoke('engine:getActiveProfile'),
  getEngineStatus: () => ipcRenderer.invoke('engine:getEngineStatus'),
  onEngineStatus: (callback: (status: EngineStatus) => void) => {
    const handler = (_event: any, status: EngineStatus) => callback(status);
    ipcRenderer.on('engine:status', handler);
    return () => {
      ipcRenderer.removeListener('engine:status', handler);
    };
  },
  // The main process asks before the window closes (the × button); the renderer answers with closeWindow
  onCloseRequested: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('app:closeRequested', handler);
    return () => {
      ipcRenderer.removeListener('app:closeRequested', handler);
    };
  },
  onSystemLog: (callback: (log: SystemLogEntry) => void) => {
    const handler = (_event: any, log: SystemLogEntry) => callback(log);
    ipcRenderer.on('app:systemLog', handler);
    return () => {
      ipcRenderer.removeListener('app:systemLog', handler);
    };
  },
  requestLogBacklog: () => ipcRenderer.invoke('app:requestLogBacklog') as Promise<SystemLogEntry[]>,
  appendLogSession: (entries: SystemLogEntry[]) => ipcRenderer.invoke('logs:append', entries) as Promise<{ written: number }>,
  saveLogSnapshot: (entries: SystemLogEntry[]) => ipcRenderer.invoke('logs:saveSnapshot', entries) as Promise<{ id: string; written: number }>,
  listLogSessions: () => ipcRenderer.invoke('logs:list') as Promise<Array<{ id: string; modified: string; bytes: number }>>,
  readLogSession: (id: string) => ipcRenderer.invoke('logs:read', id) as Promise<SystemLogEntry[]>,
  claudeSemanticSuggest: (payload) => ipcRenderer.invoke('app:claudeSemanticSuggest', payload),
  geminiSemanticSuggest: (payload) => ipcRenderer.invoke('app:geminiSemanticSuggest', payload),
  saveApiKey: (provider: string, apiKey: string) => ipcRenderer.invoke('app:saveApiKey', provider, apiKey),
  hasApiKey: (provider: string) => ipcRenderer.invoke('app:hasApiKey', provider),
  clearApiKey: (provider: string) => ipcRenderer.invoke('app:clearApiKey', provider),
  getCursorBaseSize: () => ipcRenderer.invoke('app:getCursorBaseSize') as Promise<number>,
  listGeminiModels: (apiKey?: string) => ipcRenderer.invoke('app:listGeminiModels', apiKey),
  openaiSemanticSuggest: (payload) => ipcRenderer.invoke('app:openaiSemanticSuggest', payload),
  llmEmbedding: (payload) => ipcRenderer.invoke('app:llmEmbedding', payload),
  importKnowledgeBase: (customPaths?: string[]) => ipcRenderer.invoke('engine:importKnowledgeBase', customPaths),
  // Drag and drop: Electron no longer exposes File.path, so the real path comes from webUtils
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  setTitleBarOverlay: (options: TitleBarOverlayOptions) => ipcRenderer.invoke('app:setTitleBarOverlay', options),
  setColorMode: (mode: 'system' | 'light' | 'dark') => ipcRenderer.invoke('app:setColorMode', mode),
  clearCache: () => ipcRenderer.invoke('app:clearCache'),
  restartApp: () => ipcRenderer.invoke('app:restart'),
  getSemanticState: () => ipcRenderer.invoke('engine:getSemanticState'),
  openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
  setGoalProfile: (customPath?: string) => ipcRenderer.invoke('engine:setGoalProfile', customPath),
  resetGoalProfile: () => ipcRenderer.invoke('engine:resetGoalProfile'),
  addKnowledgeSlot: (customPath?: string, vencPassword?: string) => ipcRenderer.invoke('engine:addKnowledgeSlot', customPath, vencPassword),
  removeKnowledgeSlot: (slotId: string) => ipcRenderer.invoke('engine:removeKnowledgeSlot', slotId),
  clearAllKnowledgeSlots: () => ipcRenderer.invoke('engine:clearAllKnowledgeSlots'),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:toggleMaximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  getSlotInfo: (slotId: string) => ipcRenderer.invoke('engine:getSlotInfo', slotId),
  isWindowMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  setZoomFactor: (factor: number) => webFrame.setZoomFactor(factor),
  getZoomFactor: () => webFrame.getZoomFactor(),
  checkUpdate: async () => {
    try {
      const res = await ipcRenderer.invoke('updater:check');
      return res || { hasUpdate: false };
    } catch {
      return { hasUpdate: false };
    }
  },
  installUpdate: async () => {
    try {
      await ipcRenderer.invoke('updater:quitAndInstall');
    } catch (e) {
      console.warn('[Updater] installUpdate error:', e);
    }
  },
  querySemantics: (query: string, context?: string) => ipcRenderer.invoke('semantics:query', query, context),
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath'),
  getThirdPartyNotices: () => ipcRenderer.invoke('app:getThirdPartyNotices')
};

const updaterAPI = {
  check: () => ipcRenderer.invoke('updater:check'),
  download: () => ipcRenderer.invoke('updater:download'),
  quitAndInstall: () => ipcRenderer.invoke('updater:quitAndInstall'),
  onStatus: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('updater:status', handler);
    return () => {
      ipcRenderer.removeListener('updater:status', handler);
    };
  }
};

contextBridge.exposeInMainWorld('engineAPI', engineAPI);
contextBridge.exposeInMainWorld('updaterAPI', updaterAPI);


declare global {
  interface Window {
    engineAPI: EngineAPI;
    updaterAPI: typeof updaterAPI;
  }
}
