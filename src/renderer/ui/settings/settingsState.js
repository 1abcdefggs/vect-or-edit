import { STORAGE_KEYS, DEFAULTS } from '../../core/constants.js';
import { isApiKeyConfigured, SECRET_STORAGE_KEYS } from '../../core/apiKeyStore.js';

/** The LLM is configured when a cloud provider is chosen and its key is stored (ADR-11). */
export function isLlmConfigured() {
  const provider = localStorage.getItem(STORAGE_KEYS.LLM_PROVIDER) || DEFAULTS.LLM_PROVIDER;
  if (provider === 'claude' || provider === 'gemini' || provider === 'openai') return isApiKeyConfigured(provider);
  return false;
}

/** The Embedding is configured when the local model is downloaded and ready. */
export function isEmbedConfigured() {
  return Boolean(window.__isLocalAiModelReady);
}

// Per-installation state that must not travel through .settings.json. That file lives in the save folder and
// outlives the app data, so a restored "setup completed" flag would skip first-run setup after a reset or reinstall.
const LOCAL_ONLY_KEYS = [STORAGE_KEYS.AI_SETUP_COMPLETED];

export async function syncSettingsToBackend() {
  if (typeof window === 'undefined' || !window.engineAPI || !window.engineAPI.saveSettings) return;

  // API keys never go to .settings.json (they are encrypted in the main process; see apiKeyStore.js)
  const settings = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (SECRET_STORAGE_KEYS.includes(key) || LOCAL_ONLY_KEYS.includes(key)) continue;
    settings[key] = localStorage.getItem(key);
  }
  
  await window.engineAPI.saveSettings(settings);
}

export async function loadSettingsFromBackend() {
  if (typeof window === 'undefined' || !window.engineAPI || !window.engineAPI.loadSettings) return false;
  
  const res = await window.engineAPI.loadSettings();
  if (res && res.success && res.settings && Object.keys(res.settings).length > 0) {
    const s = res.settings;
    for (const k of Object.keys(s)) {
      if (LOCAL_ONLY_KEYS.includes(k)) continue;
      localStorage.setItem(k, s[k]);
    }
    return true; // Indicates settings were loaded and applied
  }
  return false;
}
