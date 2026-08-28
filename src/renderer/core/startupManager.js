import { isAiModelConfigured } from '../ui/settings.js';

import { initAiSetup, showAiSetupModal } from '../ui/ai/aiSetupController.js';
import { STORAGE_KEYS } from './constants.js';

let isStartupComplete = false;
let domCache = null;

function getDomElements() {
  if (domCache) return domCache;
  domCache = {
    choiceCard: document.getElementById('startupAiChoiceCard'),
    loaderStatus: document.getElementById('loaderStatusText'),
    btnDownload: document.getElementById('btnStartupDownloadAi'),
    btnSkip: document.getElementById('btnStartupSkipAi'),
    choiceActions: document.getElementById('startupChoiceActions'),
    progressBar: document.getElementById('startupAiProgressBar'),
    downloadStatus: document.getElementById('startupDownloadStatusText'),
    downloadPct: document.getElementById('startupDownloadPctText'),
    downloadFill: document.getElementById('startupDownloadFill'),
    appLoader: document.getElementById('appStartupLoader')
  };
  return domCache;
}

export function initStartupFlow() {
  if (isStartupComplete) return;

  const isAiSetup = localStorage.getItem(STORAGE_KEYS.AI_SETUP_COMPLETED) === 'true';
  
  if (!isAiSetup) {
    initAiSetup(() => {
      dismissStartupLoader();
    });
    showAiSetupModal();
    // Keep loader in background
  } else {
    dismissStartupLoader();
  }
}

export function dismissStartupLoader() {
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
