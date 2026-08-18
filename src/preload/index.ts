import { contextBridge, ipcRenderer } from 'electron';

export interface ValidationMarker {
  line: number;
  message: string;
  severity?: 'Error' | 'Warning' | string;
}

export interface ValidationResponse {
  is_valid: boolean;
  has_allergy_conflict?: boolean;
  markers: ValidationMarker[];
}

export interface SearchResultItem {
  id?: string;
  score: number;
  name?: string;
  [key: string]: any;
}

export interface SearchVectorResponse {
  success: boolean;
  data: SearchResultItem[];
  error?: string;
}

export interface SaveFileResponse {
  success: boolean;
  filePath?: string;
  canceled?: boolean;
  error?: string;
}

export interface OpenFileResponse {
  success: boolean;
  filePath?: string;
  fileName?: string;
  content?: string;
  canceled?: boolean;
  error?: string;
}

export interface ImportKnowledgeBaseResponse {
  success: boolean;
  fileName?: string;
  profileName?: string;
  count?: number;
  data?: any[];
  canceled?: boolean;
  error?: string;
}

export interface TitleBarOverlayOptions {
  color: string;
  symbolColor: string;
  height?: number;
}

export interface EngineStatus {
  binReady: boolean;
  kbReady: boolean;
  count: number;
  fileName?: string;
  profileName?: string;
}

export interface SystemLogEntry {
  time: string;
  source: string;
  level: 'INFO' | 'WARN' | 'ERROR' | string;
  message: string;
}

export interface KnowledgeSlot {
  id: string;
  name: string;
  filePath: string;
  itemCount: number;
}

export interface SemanticState {
  activeGoal: any | null;
  slots: KnowledgeSlot[];
  totalItems: number;
}

export interface EngineAPI {
  searchVector: (vector: number[], limit?: number) => Promise<SearchVectorResponse>;
  saveFile: (content: string, defaultName: string) => Promise<SaveFileResponse>;
  openFile: () => Promise<OpenFileResponse>;
  validateDocument: (text: string) => Promise<ValidationResponse>;
  loadImeDict: () => Promise<string>;
  getKnowledgeBase: () => Promise<any[]>;
  getActiveDictName: () => Promise<string>;
  getActiveProfile: () => Promise<any>;
  getEngineStatus: () => Promise<EngineStatus>;
  onEngineStatus: (callback: (status: EngineStatus) => void) => () => void;
  onSystemLog: (callback: (log: SystemLogEntry) => void) => () => void;
  claudeSemanticSuggest: (payload: { prompt: string; apiKey?: string; model?: string }) => Promise<{ success: boolean; text?: string; error?: string }>;
  importKnowledgeBase: () => Promise<ImportKnowledgeBaseResponse>;
  setTitleBarOverlay: (options: TitleBarOverlayOptions) => Promise<{ success: boolean; error?: string }>;
  getSemanticState: () => Promise<SemanticState>;
  setGoalProfile: (customPath?: string) => Promise<{ success: boolean; goal?: any; filePath?: string; error?: string }>;
  addKnowledgeSlot: (customPath?: string) => Promise<{ success: boolean; slots?: KnowledgeSlot[]; totalCount?: number; data?: any[]; activeGoal?: any; error?: string }>;
  removeKnowledgeSlot: (slotId: string) => Promise<{ success: boolean; slots?: KnowledgeSlot[]; totalCount?: number; data?: any[]; error?: string }>;
}

const engineAPI: EngineAPI = {
  searchVector: (vector: number[], limit?: number) => ipcRenderer.invoke('engine:searchVector', vector, limit),
  saveFile: (content: string, defaultName: string) => ipcRenderer.invoke('app:saveFile', content, defaultName),
  openFile: () => ipcRenderer.invoke('app:openFile'),
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
  importKnowledgeBase: () => ipcRenderer.invoke('engine:importKnowledgeBase'),
  setTitleBarOverlay: (options: TitleBarOverlayOptions) => ipcRenderer.invoke('app:setTitleBarOverlay', options),
  getSemanticState: () => ipcRenderer.invoke('engine:getSemanticState'),
  setGoalProfile: (customPath?: string) => ipcRenderer.invoke('engine:setGoalProfile', customPath),
  addKnowledgeSlot: (customPath?: string) => ipcRenderer.invoke('engine:addKnowledgeSlot', customPath),
  removeKnowledgeSlot: (slotId: string) => ipcRenderer.invoke('engine:removeKnowledgeSlot', slotId)
};

contextBridge.exposeInMainWorld('engineAPI', engineAPI);

declare global {
  interface Window {
    engineAPI: EngineAPI;
  }
}
