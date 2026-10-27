import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ipcMain, session, type IpcMainEvent, type IpcMainInvokeEvent, type WebFrameMain } from 'electron';

/**
 * Trust boundary for IPC and permissions.
 * Only the app's own renderer may call the main process: the dev server origin (ELECTRON_RENDERER_URL)
 * or the bundled index.html. Every handler is registered through handleTrusted / onTrusted, so the check
 * lives in one place (Electron security checklist: validate the sender of all IPC messages).
 */
let trustedDevOrigin: string | null = null;
let trustedIndexFile: string | null = null;

const normalizeFile = (p: string) => {
  const resolved = path.resolve(p);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
};

export function setTrustedRenderer(rendererUrl: string, indexPath: string): void {
  try {
    trustedDevOrigin = rendererUrl ? new URL(rendererUrl).origin : null;
  } catch {
    trustedDevOrigin = null;
  }
  trustedIndexFile = normalizeFile(indexPath);
}

export function isTrustedUrl(rawUrl: string | undefined | null): boolean {
  if (!rawUrl) return false;
  try {
    const url = new URL(rawUrl);
    if (trustedDevOrigin && url.origin === trustedDevOrigin) return true;
    if (url.protocol === 'file:' && trustedIndexFile) {
      return normalizeFile(fileURLToPath(url)) === trustedIndexFile;
    }
  } catch {
    // Malformed URL: not trusted
  }
  return false;
}

function isTrustedFrame(frame: WebFrameMain | null | undefined): boolean {
  return Boolean(frame) && isTrustedUrl(frame!.url);
}

/** ipcMain.handle that rejects calls from any page other than the app's renderer. */
export function handleTrusted(
  channel: string,
  listener: (event: IpcMainInvokeEvent, ...args: any[]) => any
): void {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedFrame(event.senderFrame)) {
      console.warn(`[Security] Rejected IPC "${channel}" from untrusted sender: ${event.senderFrame?.url ?? 'unknown'}`);
      throw new Error('Untrusted IPC sender');
    }
    return listener(event, ...args);
  });
}

/** ipcMain.on that ignores messages from any page other than the app's renderer. */
export function onTrusted(
  channel: string,
  listener: (event: IpcMainEvent, ...args: any[]) => void
): void {
  ipcMain.on(channel, (event, ...args) => {
    if (!isTrustedFrame(event.senderFrame)) {
      console.warn(`[Security] Ignored IPC "${channel}" from untrusted sender: ${event.senderFrame?.url ?? 'unknown'}`);
      return;
    }
    listener(event, ...args);
  });
}

// The renderer reads and writes the clipboard (Paste in the context and Edit menus); nothing else is granted.
const ALLOWED_PERMISSIONS = new Set(['clipboard-read', 'clipboard-sanitized-write']);

/** Denies every permission request except clipboard access from the app's renderer. */
export function installPermissionPolicy(): void {
  const ses = session.defaultSession;
  // The page URL is used rather than the origin: a file:// origin carries no path to compare with index.html.
  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const allowed = ALLOWED_PERMISSIONS.has(permission) && isTrustedUrl(webContents?.getURL() || details?.requestingUrl);
    if (!allowed) console.warn(`[Security] Denied permission request: ${permission}`);
    callback(allowed);
  });
  ses.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    return ALLOWED_PERMISSIONS.has(permission) && isTrustedUrl(webContents?.getURL() || requestingOrigin);
  });
}
