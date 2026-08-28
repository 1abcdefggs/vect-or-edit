import { contextBridge, ipcRenderer } from 'electron';
import type { 
  EngineAPI, 
  EngineStatus, 
  SystemLogEntry, 
  TitleBarOverlayOptions 
} from './types';

const engineAPI: EngineAPI = {
  getEmbedderPath: () => ipcRenderer.invoke('embedder:getPath'),
  setEmbedderPath: (path) => ipcRenderer.invoke('embedder:setPath', path),
  searchVector: (vector: number[], limit?: number) => ipcRenderer.invoke('engine:searchVector', vector, limit),
  saveFile: (content: string, defaultName: string) => ipcRenderer.invoke('app:saveFile', content, defaultName),
  openFile: () => ipcRenderer.invoke('app:openFile'),
  openWorkspace: () => ipcRenderer.invoke('app:openWorkspace'),
  getDefaultWorkspace: (createIfMissing?: boolean) => ipcRenderer.invoke('app:getDefaultWorkspace', createIfMissing),
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
  onSystemLog: (callback: (log: SystemLogEntry) => void) => {
    const handler = (_event: any, log: SystemLogEntry) => callback(log);
    ipcRenderer.on('app:systemLog', handler);
    return () => {
      ipcRenderer.removeListener('app:systemLog', handler);
    };
  },
  claudeSemanticSuggest: (payload) => ipcRenderer.invoke('app:claudeSemanticSuggest', payload),
  geminiSemanticSuggest: (payload) => ipcRenderer.invoke('app:geminiSemanticSuggest', payload),
  openaiSemanticSuggest: (payload) => ipcRenderer.invoke('app:openaiSemanticSuggest', payload),
  importKnowledgeBase: () => ipcRenderer.invoke('engine:importKnowledgeBase'),
  setTitleBarOverlay: (options: TitleBarOverlayOptions) => ipcRenderer.invoke('app:setTitleBarOverlay', options),
  getSemanticState: () => ipcRenderer.invoke('engine:getSemanticState'),
  openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
  setGoalProfile: (customPath?: string) => ipcRenderer.invoke('engine:setGoalProfile', customPath),
  resetGoalProfile: () => ipcRenderer.invoke('engine:resetGoalProfile'),
  addKnowledgeSlot: (customPath?: string) => ipcRenderer.invoke('engine:addKnowledgeSlot', customPath),
  removeKnowledgeSlot: (slotId: string) => ipcRenderer.invoke('engine:removeKnowledgeSlot', slotId),
  clearAllKnowledgeSlots: () => ipcRenderer.invoke('engine:clearAllKnowledgeSlots'),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:toggleMaximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isWindowMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  checkUpdate: function (): Promise<{ hasUpdate: boolean; version?: string; releaseDate?: string; }> {
    throw new Error('Function not implemented.');
  },
  installUpdate: function (): Promise<void> {
    throw new Error('Function not implemented.');
  }
};

contextBridge.exposeInMainWorld('engineAPI', engineAPI);
contextBridge.exposeInMainWorld('electronAPI', { invoke: ipcRenderer.invoke });

declare global {
  interface Window {
    engineAPI: EngineAPI;
  }
}
