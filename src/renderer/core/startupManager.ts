import { initAiSetup, showAiSetupModal, markSetupEditorReady } from '../ui/ai/aiSetupController.js';
import { STORAGE_KEYS } from './constants';

let isSetupShown = false;
let isSetupDone = true;
let isEditorReady = false;

/**
 * Shows first-run setup while the editor is still loading. Call after the backend settings and locale are loaded,
 * so the setup opens with the restored choices (language, theme). The "done" flag itself is per installation and is
 * never restored from .settings.json (see LOCAL_ONLY_KEYS in settingsState.js).
 */
export function initStartupFlow(): void {
  if (isSetupShown) return;
  isSetupShown = true;

  // The key keeps its historic name; it now marks the whole first-run setup as done.
  if (localStorage.getItem(STORAGE_KEYS.AI_SETUP_COMPLETED) === 'true') return;

  isSetupDone = false;
  initAiSetup(() => {
    isSetupDone = true;
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
  const appLoader = document.getElementById('appStartupLoader');
  if (!appLoader) return;
  appLoader.style.opacity = '0';
  appLoader.style.visibility = 'hidden';
  setTimeout(() => appLoader.remove(), 400);
}

export function dismissStartupLoader(): void {
  hideStartupLoader();
}
