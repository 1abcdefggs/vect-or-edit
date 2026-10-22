import { STORAGE_KEYS, DEFAULTS } from '../../core/constants.js';
import { isApiKeyConfigured, SECRET_STORAGE_KEYS } from '../../core/apiKeyStore.js';

export function isAiModelConfigured() {
  const provider = localStorage.getItem(STORAGE_KEYS.AI_PROVIDER) || DEFAULTS.AI_PROVIDER;
  if (provider === 'local') return Boolean(window.__isLocalAiModelReady);
  if (provider === 'claude' || provider === 'gemini' || provider === 'openai') return isApiKeyConfigured(provider);
  return false;
}

export function getEditorSettings() {
  return {
    fontFamily: localStorage.getItem('editor_fontFamily') || DEFAULTS.FONT_FAMILY,
    fontSize: parseInt(localStorage.getItem('editor_fontSize') || String(DEFAULTS.FONT_SIZE), 10),
    lineHeight: parseInt(localStorage.getItem('editor_lineHeight') || String(DEFAULTS.LINE_HEIGHT), 10),
    wordWrap: localStorage.getItem('editor_wordWrap') || 'on',
    lineNumbers: localStorage.getItem('editor_lineNumbers') || 'on',
    renderLineHighlight: localStorage.getItem('editor_renderLineHighlight') || 'line',
    stickyScroll: (localStorage.getItem('editor_stickyScroll') || 'on') === 'on',
    renderWhitespace: localStorage.getItem('editor_renderWhitespace') || 'none',
    editorBgTone: localStorage.getItem('editor_bg_tone') || 'default',
    customBg: localStorage.getItem('editor_custom_bg') || '#1e1e2e',
    customFg: localStorage.getItem('editor_custom_fg') || '#cdd6f4',
  };
}

export function saveEditorSettings(settings) {
  Object.keys(settings).forEach(key => {
    localStorage.setItem(`editor_${key}`, String(settings[key]));
  });
  syncSettingsToBackend();
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
