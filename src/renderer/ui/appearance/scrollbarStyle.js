/**
 * Scrollbar size and colour. The size is the base width (6px) times a scale; the default scale is 3 (18px).
 * The active colour uses the accent colour (default); turned off, the thumb stays neutral.
 * Sets --scrollbar-size and --scrollbar-thumb on the root; read by utilities.css and layout.css.
 */
import { STORAGE_KEYS } from '../../core/constants.js';
import { readStorage, writeStorage } from '../../core/storage.js';

export const SCROLLBAR_BASE_PX = 6;
export const SCROLLBAR_SCALES = { '0.5': 0.5, '1': 1, '2': 2, '3': 3 };
const DEFAULT_SCALE = '3';
const NEUTRAL_THUMB = 'rgba(255, 255, 255, 0.3)';

export function getScrollbarScale() {
  try {
    const stored = readStorage(STORAGE_KEYS.SCROLLBAR_SCALE);
    if (Object.hasOwn(SCROLLBAR_SCALES, stored)) return stored;
  } catch {
    // Storage unavailable: keep the default
  }
  return DEFAULT_SCALE;
}

export function isScrollbarActive() {
  try {
    return readStorage(STORAGE_KEYS.SCROLLBAR_ACTIVE) !== 'off';
  } catch {
    return true;
  }
}

export function applyScrollbarStyle() {
  const root = document.documentElement;
  const scale = SCROLLBAR_SCALES[getScrollbarScale()];
  root.style.setProperty('--scrollbar-size', `${SCROLLBAR_BASE_PX * scale}px`);
  root.style.setProperty('--scrollbar-thumb', isScrollbarActive() ? 'var(--accent-color, #38bdf8)' : NEUTRAL_THUMB);
}

export function setScrollbarScale(value) {
  if (!Object.hasOwn(SCROLLBAR_SCALES, value)) return;
  writeStorage(STORAGE_KEYS.SCROLLBAR_SCALE, value);
  applyScrollbarStyle();
}

export function setScrollbarActive(on) {
  writeStorage(STORAGE_KEYS.SCROLLBAR_ACTIVE, on ? 'on' : 'off');
  applyScrollbarStyle();
}
