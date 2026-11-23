/**
 * Distance between the pointer and the instant tooltip, as a share of the pointer size.
 * 'standard' (default) leaves the box about one-fifth of the pointer's width from the tip; 'near' and 'far' move it closer or further.
 * Read by ui/tooltips/instantTooltip.ts on every placement, so a change applies at the next hover.
 */
import { STORAGE_KEYS } from '../../core/constants.js';
import { readStorage, writeStorage } from '../../core/storage.js';

export const TOOLTIP_GAPS = { near: 0.4, standard: 0.6, far: 0.9 };
const DEFAULT_GAP = 'standard';

export function getTooltipGapRatio() {
  try {
    const stored = readStorage(STORAGE_KEYS.TOOLTIP_GAP);
    if (Object.hasOwn(TOOLTIP_GAPS, stored)) return TOOLTIP_GAPS[stored];
  } catch {
    // Storage unavailable: keep the default
  }
  return TOOLTIP_GAPS[DEFAULT_GAP];
}

export function getTooltipGap() {
  try {
    const stored = readStorage(STORAGE_KEYS.TOOLTIP_GAP);
    if (Object.hasOwn(TOOLTIP_GAPS, stored)) return stored;
  } catch {
    // Storage unavailable: keep the default
  }
  return DEFAULT_GAP;
}

export function setTooltipGap(value) {
  if (!Object.hasOwn(TOOLTIP_GAPS, value)) return;
  writeStorage(STORAGE_KEYS.TOOLTIP_GAP, value);
}
