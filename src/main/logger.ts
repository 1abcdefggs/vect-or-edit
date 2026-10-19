import { BrowserWindow } from 'electron';

export const mainLogBuffer: any[] = [];

// Oldest entries are dropped beyond this, so a long session or many reloads cannot grow memory without bound
const MAX_MAIN_LOG_BUFFER = 1000;

let isRendererReady = false;
let boundWindow: BrowserWindow | null = null;
// Electron reports a failed send through console.error, which would re-enter captureLog and loop forever
let isSending = false;

function canSendToRenderer(window: BrowserWindow | null): window is BrowserWindow {
  return !!window && !window.isDestroyed() && !window.webContents.isDestroyed() && !window.webContents.isCrashed();
}

function sendToRenderer(window: BrowserWindow, entry: unknown) {
  if (isSending) return;
  isSending = true;
  try {
    window.webContents.send('app:systemLog', entry);
  } catch (e) {
    originalConsoleError('[Logger] send to renderer failed:', e);
  } finally {
    isSending = false;
  }
}

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
  if (mainLogBuffer.length > MAX_MAIN_LOG_BUFFER) {
    mainLogBuffer.splice(0, mainLogBuffer.length - MAX_MAIN_LOG_BUFFER);
  }
  if (isRendererReady && canSendToRenderer(boundWindow)) {
    sendToRenderer(boundWindow, entry);
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
  if (!canSendToRenderer(boundWindow)) return;
  const window = boundWindow;
  mainLogBuffer.forEach(log => sendToRenderer(window, log));
}
