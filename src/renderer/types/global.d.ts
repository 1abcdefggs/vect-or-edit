import type { EngineAPI } from '../../preload/types';

declare module '*?raw' {
  const content: string;
  export default content;
}

declare module '*.html' {
  const content: string;
  export default content;
}

declare module '*.html?raw' {
  const content: string;
  export default content;
}

declare module '*.json' {
  const content: any;
  export default content;
}

export interface ElectronAPI {
  invoke: (channel: string, ...args: any[]) => Promise<any>;
}

export interface UpdaterAPI {
  checkForUpdates?: () => Promise<any>;
  downloadUpdate?: () => Promise<any>;
  installUpdate?: () => Promise<void>;
  onStatus?: (callback: (status: any) => void) => () => void;
  onStatusChange?: (callback: (status: any) => void) => () => void;
  quitAndInstall?: () => void;
}

declare global {
  interface Window {
    engineAPI: EngineAPI;
    updaterAPI: UpdaterAPI;
    electronAPI?: ElectronAPI;
    electron?: {
      ipcRenderer?: {
        invoke: (channel: string, ...args: any[]) => Promise<any>;
        on: (channel: string, listener: (...args: any[]) => void) => void;
      };
    };
    __icons__?: Record<string, string>;
  }

  interface WindowEventMap {
    'uiComponentsLoaded': Event;
    'app:languageChanged': CustomEvent<{ lang: string }>;
    'app:aiStateChanged': CustomEvent<{ state: any }>;
    'app:settingsChanged': CustomEvent<void>;
    'app:requestLocalAiInit': CustomEvent<void>;
    'app:aiModelProgress': CustomEvent<{ pct: number; fileName?: string; status?: string }>;
    'app:directVectorSearch': CustomEvent<{ query: string }>;
    'app:knowledgeSlotChanged': CustomEvent<any>;
  }
}
