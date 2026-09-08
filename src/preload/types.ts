export interface ValidationMarker {
  line: number;
  message: string;
  severity?: 'Error' | 'Warning' | string;
}

export interface ValidationResponse {
  is_valid: boolean;
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

export interface OpenWorkspaceResponse {
  success: boolean;
  folderPath?: string;
  files?: string[];
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
  slots?: KnowledgeSlot[];
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
  vencPassword?: string;
}

export interface SemanticState {
  activeGoal: any | null;
  slots: KnowledgeSlot[];
  totalItems: number;
}

export interface EngineAPI {
  getEmbedderPath: () => Promise<string>;
  setEmbedderPath: (path: string) => Promise<{ success: boolean; error?: string }>;
  searchVector: (vector: number[], limit?: number) => Promise<SearchVectorResponse>;
  saveFile: (content: string, defaultName?: string, forceDialog?: boolean) => Promise<{ success: boolean, path?: string, filePath?: string, error?: string }>;
  openFile: () => Promise<{ success: boolean, path?: string, filePath?: string, fileName?: string, content?: string, error?: string }>;
  openWorkspace: () => Promise<{ success: boolean, path?: string, error?: string }>;
  getDefaultWorkspace: (createIfMissing?: boolean) => Promise<{ success: boolean, path?: string, exists?: boolean, error?: string }>;
  loadSettings: () => Promise<{ success: boolean, settings?: any, error?: string }>;
  saveSettings: (settings: any) => Promise<{ success: boolean, error?: string }>;
  validateDocument: (text: string) => Promise<ValidationResponse>;
  loadImeDict: () => Promise<string>;
  getKnowledgeBase: () => Promise<any[]>;
  getActiveDictName: () => Promise<string>;
  getActiveProfile: () => Promise<any>;
  getEngineStatus: () => Promise<EngineStatus>;
  onEngineStatus: (callback: (status: EngineStatus) => void) => () => void;
  onSystemLog: (callback: (log: SystemLogEntry) => void) => () => void;
  claudeSemanticSuggest: (payload: { prompt: string; apiKey?: string; model?: string }) => Promise<{ success: boolean; text?: string; error?: string }>;
  geminiSemanticSuggest: (payload: { prompt: string; apiKey?: string; model?: string }) => Promise<{ success: boolean; text?: string; error?: string }>;
  saveGeminiApiKey: (apiKey: string) => Promise<{ success: boolean; error?: string }>;
  hasGeminiApiKey: () => Promise<boolean>;
  listGeminiModels: () => Promise<Array<{ name: string; displayName?: string; description?: string; inputTokenLimit?: number; outputTokenLimit?: number }>>;
  openaiSemanticSuggest: (payload: { prompt: string; apiKey?: string; model?: string }) => Promise<{ success: boolean; text?: string; error?: string }>;
  importKnowledgeBase: () => Promise<ImportKnowledgeBaseResponse>;
  setTitleBarOverlay: (options: TitleBarOverlayOptions) => Promise<{ success: boolean; error?: string }>;
  clearCache: () => Promise<{ success: boolean; error?: string }>;
  restartApp: () => Promise<void>;
  getSemanticState: () => Promise<SemanticState>;
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
  setGoalProfile: (customPath?: string) => Promise<{ success: boolean; goal?: any; filePath?: string; error?: string }>;
  resetGoalProfile: () => Promise<{ success: boolean; goal?: null; error?: string }>;
  addKnowledgeSlot: (customPath?: string, vencPassword?: string) => Promise<{ success: boolean; slots?: KnowledgeSlot[]; totalCount?: number; data?: any[]; activeGoal?: any; error?: string; requiresPassword?: boolean; filePath?: string }>;
  removeKnowledgeSlot: (slotId: string) => Promise<{ success: boolean; slots?: KnowledgeSlot[]; totalCount?: number; data?: any[]; error?: string }>;
  clearAllKnowledgeSlots: () => Promise<{ success: boolean; slots?: KnowledgeSlot[]; totalCount?: number; data?: any[]; error?: string }>;
  minimizeWindow: () => Promise<boolean>;
  maximizeWindow: () => Promise<boolean>;
  closeWindow: () => Promise<boolean>;
  isWindowMaximized: () => Promise<boolean>;
  setZoomFactor: (factor: number) => void;
  getZoomFactor: () => number;
  checkUpdate: () => Promise<{ hasUpdate: boolean; version?: string; releaseDate?: string }>;
  installUpdate: () => Promise<void>;
  querySemantics?: (query: string, context?: string) => Promise<any>;
}
