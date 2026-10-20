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

export function captureLog(level: string, args: any[], source = 'Main:System') {
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  const entry = {
    time: new Date().toLocaleTimeString(),
    source,
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
    captureLog('INFO', args);
  };
  console.warn = (...args) => {
    originalConsoleWarn(...args);
    captureLog('WARN', args);
  };
  console.error = (...args) => {
    originalConsoleError(...args);
    captureLog('ERROR', args);
  };
}

// Electron console-message levels: 0 verbose, 1 info, 2 warning, 3 error
const RENDERER_LEVELS = ['INFO', 'INFO', 'WARN', 'ERROR'];

// Renderer console output goes to the terminal and to the log panel under its own source and level.
// Verbose (console.debug) output is skipped, so chatty debug loops do not fill the buffer or cost an IPC each.
export function captureRendererConsole(level: number, message: string, sourceId: string, line: number) {
  if (level === 0) return;
  const logLevel = RENDERER_LEVELS[level] ?? 'INFO';
  originalConsoleLog(`[Renderer Console - ${logLevel}] ${message} (${sourceId}:${line})`);
  captureLog(logLevel, [message], 'Renderer');
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
