import { initAiSetup, showAiSetupModal } from '../ui/ai/aiSetupController.js';
import { STORAGE_KEYS } from './constants';

let isStartupComplete = false;

export function initStartupFlow(): void {
  if (isStartupComplete) return;

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

export function dismissStartupLoader(): void {
  const appLoader = document.getElementById('appStartupLoader');
  if (appLoader) {
    appLoader.style.opacity = '0';
    appLoader.style.visibility = 'hidden';
    setTimeout(() => {
      if (appLoader && appLoader.parentNode) {
        appLoader.remove();
      }
    }, 200);
  }
  isStartupComplete = true;
}
