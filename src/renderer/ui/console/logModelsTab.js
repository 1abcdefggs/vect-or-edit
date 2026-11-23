/**
 * The Models tab of the log panel: the Gemini model list with the same picker as the settings page.
 * A choice made here is the same choice (same stored model, same sync, same change event) as on the settings page.
 */
import { createGeminiModelPicker, usableGeminiModels, rememberGeminiModels } from '../settings/geminiModelPicker.js';
import { readGeminiModel } from '../../core/geminiModel.js';
import { STORAGE_KEYS } from '../../core/constants.js';
import { writeStorage } from '../../core/storage.js';
import { syncSettingsToBackend } from '../settings/settingsState.js';
import { t } from '../../core/i18n.js';

let picker = null;
let statusEl = null;

function setStatus(text, color) {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.style.color = color || '';
}

/** Draws the list and marks the chosen model. With no choice, no row is in use. Returns the usable count. */
function showModels(models) {
  const usable = usableGeminiModels(models);
  const saved = readGeminiModel();
  picker.setModels(models);
  if (usable.some((m) => m.name === saved)) picker.setValue(saved);
  return usable.length;
}

async function fetchModels() {
  setStatus(t('gemini_keys_loading'), 'var(--accent-color, #38bdf8)');
  try {
    // No key is passed: the main process uses the saved key
    const models = await window.engineAPI.listGeminiModels(undefined);
    if (!Array.isArray(models) || models.length === 0) throw new Error('No models returned');
    const visible = showModels(models);
    rememberGeminiModels(models);
    setStatus(t(readGeminiModel() ? 'gemini_keys_loaded' : 'gemini_keys_loaded_choose', { count: visible }), 'var(--success-color, #10b981)');
  } catch (err) {
    console.warn('[Gemini] Model list fetch error (log panel):', err);
    setStatus(t('gemini_keys_error'), '#ef4444');
  }
}

/** Mounts the picker once. Safe to call again: a second call does nothing. */
export function initLogModelsTab() {
  const container = document.getElementById('logModelsPicker');
  if (!container || picker) return;
  statusEl = document.getElementById('logModelsStatus');
  picker = createGeminiModelPicker(container, {
    onChange: (name) => {
      writeStorage(STORAGE_KEYS.GEMINI_MODEL, name);
      syncSettingsToBackend();
      window.dispatchEvent(new Event('app:settingsChanged'));
    }
  });
  const saved = readGeminiModel();
  if (saved) {
    picker.setModels([{ name: saved, canGenerate: true }]);
    picker.setValue(saved);
  }
  document.getElementById('btnLogFetchModels')?.addEventListener('click', fetchModels);
}
