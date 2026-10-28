/**
 * layoutMemory.ts - remembers the size of resizable areas (ADR-11 section 2.8).
 *
 * One switch ("Remember layout", System tab, default ON) decides whether sizes are stored and restored.
 * Sizes live in localStorage, which the settings dual-sync already copies to .settings.json.
 */
const REMEMBER_KEY = 'layout_remember';

export const LAYOUT_KEYS = {
  logHeight: 'layout_log_height',
  chatHeight: 'layout_chat_height',
  sidebarWidth: 'vectoreditor_sidebar_width',
  guideWidth: 'layout_guide_width',
  guideOpen: 'layout_guide_open'
} as const;

export function isLayoutRemembered(): boolean {
  try {
    return localStorage.getItem(REMEMBER_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setLayoutRemembered(on: boolean): void {
  try {
    localStorage.setItem(REMEMBER_KEY, on ? 'on' : 'off');
    // Turning it off forgets what was stored, so the next start uses the default sizes
    if (!on) clearLayoutMemory();
  } catch { /* storage unavailable */ }
}

/** The stored size in pixels, or null when nothing is stored or remembering is off. */
export function loadLayoutSize(key: string): number | null {
  if (!isLayoutRemembered()) return null;
  try {
    const value = parseInt(localStorage.getItem(key) ?? '', 10);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveLayoutSize(key: string, value: number): void {
  if (!isLayoutRemembered()) return;
  try {
    localStorage.setItem(key, String(Math.round(value)));
  } catch { /* storage unavailable */ }
}

export function clearLayoutMemory(): void {
  try {
    Object.values(LAYOUT_KEYS).forEach((key) => localStorage.removeItem(key));
  } catch { /* storage unavailable */ }
}
