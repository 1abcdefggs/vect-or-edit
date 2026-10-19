import { initAiSetup, showAiSetupModal } from '../ui/ai/aiSetupController.js';
import { STORAGE_KEYS } from './constants';

let isStartupComplete = false;

export function initStartupFlow(): void {
  if (isStartupComplete) return;
  isStartupComplete = true;

  const isAiSetup = localStorage.getItem(STORAGE_KEYS.AI_SETUP_COMPLETED) === 'true';
  
  if (!isAiSetup) {
    initAiSetup(() => {
      dismissStartupLoader();
    });
    showAiSetupModal();
  } else {
    dismissStartupLoader();
  }
}

/** Fades the loader out and removes it. Does not mark the startup flow complete, so it is safe as a fallback. */
export function hideStartupLoader(): void {
  const appLoader = document.getElementById('appStartupLoader');
  if (!appLoader) return;
  appLoader.style.opacity = '0';
  appLoader.style.visibility = 'hidden';
  setTimeout(() => appLoader.remove(), 400);
}

export function dismissStartupLoader(): void {
  hideStartupLoader();
  isStartupComplete = true;
}
