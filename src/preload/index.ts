import { contextBridge, ipcRenderer } from 'electron';

export interface EngineAPI {
  searchVector: (query: string) => Promise<any>;
  saveFile: (content: string, defaultName: string) => Promise<any>;
  validateDocument: (text: string) => Promise<any>;
  loadImeDict: () => Promise<string>;
}

const engineAPI: EngineAPI = {
  searchVector: (query: string) => ipcRenderer.invoke('engine:searchVector', query),
  saveFile: (content: string, defaultName: string) => ipcRenderer.invoke('app:saveFile', content, defaultName),
  validateDocument: (text: string) => ipcRenderer.invoke('app:validateDocument', text),
  loadImeDict: () => ipcRenderer.invoke('app:loadImeDict')
};

contextBridge.exposeInMainWorld('engineAPI', engineAPI);
