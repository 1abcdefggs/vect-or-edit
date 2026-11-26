// Shared actions for opening external links and the LLM chat. Context menus and editor shortcuts both use these,
// so the URL format and the event name live in one place.

import { STORAGE_KEYS } from './constants.js';
import { readStorage, writeStorage } from './storage.js';

export function openExternalUrl(url) {
  if (window.engineAPI?.openExternal) window.engineAPI.openExternal(url);
  else window.open(url, '_blank');
}

/** Whether the Google search entries (right-click menu, Alt+G) are offered. On unless stored as 'off'. */
export function isGoogleSearchEnabled() {
  try {
    return readStorage(STORAGE_KEYS.GOOGLE_SEARCH_ENABLED) !== 'off';
  } catch {
    return true;
  }
}

export function setGoogleSearchEnabled(on) {
  writeStorage(STORAGE_KEYS.GOOGLE_SEARCH_ENABLED, on ? 'on' : 'off');
}

export function openGoogleSearch(query) {
  if (!isGoogleSearchEnabled()) return;
  openExternalUrl(`https://www.google.com/search?q=${encodeURIComponent(query.trim())}`);
}

export function openLlmChat(prompt) {
  window.dispatchEvent(new CustomEvent('app:openLlmChat', { detail: { prompt } }));
}
