import { initAiSetup, showAiSetupModal, markSetupEditorReady } from '../ui/ai/aiSetupController.js';
import { STORAGE_KEYS } from './constants';
import { readStorage } from './storage.js';

let isSetupShown = false;
let isSetupDone = true;
let isEditorReady = false;
let readyAnnounced = false;

/**
 * app:ready marks the moment the window is in front of the user: first-run setup is finished (or not needed)
 * and the loader is going or gone. It fires once per start; the log panel's auto-close timer starts here.
 * While setup is still open, the window is not announced yet.
 */
function announceWhenVisible(): void {
  if (readyAnnounced || !isSetupDone) return;
  readyAnnounced = true;
  window.dispatchEvent(new Event('app:ready'));
}

/**
 * Shows first-run setup while the editor is still loading. Call after the backend settings and locale are loaded,
 * so the setup opens with the restored choices (language, theme). The "done" flag itself is per installation and is
 * never restored from .settings.json (see LOCAL_ONLY_KEYS in settingsState.js).
 */
export function initStartupFlow(): void {
  if (isSetupShown) return;
  isSetupShown = true;

  // The key keeps its historic name; it now marks the whole first-run setup as done.
  if (readStorage(STORAGE_KEYS.AI_SETUP_COMPLETED) === 'true') return;

  isSetupDone = false;
  initAiSetup(() => {
    isSetupDone = true;
    announceWhenVisible();
    if (isEditorReady) dismissStartupLoader();
  });
  showAiSetupModal();
}

/** Called once the editor and settings have loaded. The loader stays until first-run setup is finished. */
export function completeStartup(): void {
  isEditorReady = true;
  markSetupEditorReady();
  if (isSetupDone) dismissStartupLoader();
}

/** Fades the loader out and removes it. Safe to call more than once and as a fallback. */
export function hideStartupLoader(): void {
  announceWhenVisible();
  const appLoader = document.getElementById('appStartupLoader');
  if (!appLoader) return;
  appLoader.style.opacity = '0';
  appLoader.style.visibility = 'hidden';
  setTimeout(() => appLoader.remove(), 400);
}

export function dismissStartupLoader(): void {
  hideStartupLoader();
}
