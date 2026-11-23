/**
 * Line length of the instant tooltip. 'short' wraps long text onto two lines (22em);
 * 'long' lets a line run to 75 half-width characters. Sets --wrap-width, read by .instant-tooltip (header.css).
 */
import { STORAGE_KEYS } from '../../core/constants.js';
import { readStorage, writeStorage } from '../../core/storage.js';

export const TOOLTIP_WIDTHS = { short: '22em', long: '75ch' };
const DEFAULT_WIDTH = 'short';

export function getTooltipWidth() {
  try {
    const stored = readStorage(STORAGE_KEYS.TOOLTIP_WIDTH);
    if (Object.hasOwn(TOOLTIP_WIDTHS, stored)) return stored;
  } catch {
    // Storage unavailable: keep the default
  }
  return DEFAULT_WIDTH;
}

export function applyTooltipWidth(value = getTooltipWidth()) {
  const key = Object.hasOwn(TOOLTIP_WIDTHS, value) ? value : DEFAULT_WIDTH;
  document.documentElement.style.setProperty('--wrap-width', TOOLTIP_WIDTHS[key]);
  return key;
}

export function setTooltipWidth(value) {
  if (!Object.hasOwn(TOOLTIP_WIDTHS, value)) return;
  writeStorage(STORAGE_KEYS.TOOLTIP_WIDTH, value);
  applyTooltipWidth(value);
}
