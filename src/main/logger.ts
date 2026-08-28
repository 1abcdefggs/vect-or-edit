import { BrowserWindow } from 'electron';

export const mainLogBuffer: any[] = [];

let isRendererReady = false;
let boundWindow: BrowserWindow | null = null;

// Intercept console to capture initialization logs
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

export function captureLog(level: string, args: any[]) {
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  const entry = {
    time: new Date().toLocaleTimeString(),
    source: 'Main:System',
    level,
    message
  };
  mainLogBuffer.push(entry);
  if (isRendererReady && boundWindow && !boundWindow.isDestroyed() && boundWindow.webContents) {
    boundWindow.webContents.send('app:systemLog', entry);
  }
}

export function initLogger() {
  console.log = (...args) => {
    originalConsoleLog(...args);
    if (!args[0] || (typeof args[0] !== 'string' || !args[0].startsWith('[Renderer:'))) {
      captureLog('INFO', args);
    }
  };
  console.warn = (...args) => {
    originalConsoleWarn(...args);
    if (!args[0] || (typeof args[0] !== 'string' || !args[0].startsWith('[Renderer:'))) {
      captureLog('WARN', args);
    }
  };
  console.error = (...args) => {
    originalConsoleError(...args);
    if (!args[0] || (typeof args[0] !== 'string' || !args[0].startsWith('[Renderer:'))) {
      captureLog('ERROR', args);
    }
  };
}

export function bindLoggerToWindow(window: BrowserWindow) {
  boundWindow = window;
}

export function flushLogsToRenderer() {
  isRendererReady = true;
  if (!boundWindow || boundWindow.isDestroyed()) return;
  mainLogBuffer.forEach(log => {
    boundWindow!.webContents.send('app:systemLog', log);
  });
}
