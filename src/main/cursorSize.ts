import { execFile } from 'node:child_process';

// Windows default cursor base size (px). Used when the registry value is missing or not Windows.
const DEFAULT_CURSOR_SIZE = 32;
const MIN_CURSOR_SIZE = 16;
const MAX_CURSOR_SIZE = 256;

/**
 * Reads the Windows cursor size (Control Panel > Mouse > Pointer size) from the registry.
 * The value is REG_DWORD printed as hex by `reg query`, e.g. "0x50" for 80.
 */
export function getCursorBaseSize(): Promise<number> {
  if (process.platform !== 'win32') return Promise.resolve(DEFAULT_CURSOR_SIZE);

  return new Promise((resolve) => {
    execFile(
      'reg',
      ['query', 'HKCU\\Control Panel\\Cursors', '/v', 'CursorBaseSize'],
      { windowsHide: true, timeout: 3000 },
      (error, stdout) => {
        if (error) return resolve(DEFAULT_CURSOR_SIZE);
        const match = /0x([0-9a-f]+)/i.exec(stdout);
        const size = match ? parseInt(match[1], 16) : NaN;
        if (!Number.isFinite(size)) return resolve(DEFAULT_CURSOR_SIZE);
        resolve(Math.min(MAX_CURSOR_SIZE, Math.max(MIN_CURSOR_SIZE, size)));
      }
    );
  });
}
