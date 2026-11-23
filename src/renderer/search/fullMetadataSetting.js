/**
 * Show Full Metadata: whether suggestion cards show every key-value attribute.
 * One stored key, two switches (settings page and right sidebar); both read and write through this file.
 * Stored as 'on' or 'off'. Builds before 2026-11-20 stored 'true' or 'false', which are still read.
 */
import { STORAGE_KEYS } from '../core/constants.js';
import { readStorage, writeStorage } from '../core/storage.js';

/** Fired on window after a change, so the other switch and the result list follow at once. detail: { on } */
export const FULL_METADATA_EVENT = 'app:fullMetadataChanged';

/** The stored text as on (true) or off (false). Anything unknown is off, the default. */
export function parseFullMetadata(raw) {
  return raw === 'on' || raw === 'true';
}

export function isFullMetadataOn() {
  try {
    return parseFullMetadata(readStorage(STORAGE_KEYS.SHOW_FULL_METADATA));
  } catch {
    return false;
  }
}

export function setFullMetadata(on) {
  writeStorage(STORAGE_KEYS.SHOW_FULL_METADATA, on ? 'on' : 'off');
  window.dispatchEvent(new CustomEvent(FULL_METADATA_EVENT, { detail: { on } }));
}
