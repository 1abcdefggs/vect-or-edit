/**
 * Whether the instant tooltip is shown. Off returns hovered buttons to the standard tooltip of the system
 * (the title attribute), so the text is still available. Read by ui/tooltips/instantTooltip.ts on each move.
 */
import { STORAGE_KEYS } from '../../core/constants.js';
import { readStorage, writeStorage } from '../../core/storage.js';

export function isTooltipEnabled() {
  try {
    return readStorage(STORAGE_KEYS.TOOLTIP_ENABLED) !== 'off';
  } catch {
    return true;
  }
}

export function setTooltipEnabled(on) {
  writeStorage(STORAGE_KEYS.TOOLTIP_ENABLED, on ? 'on' : 'off');
}
