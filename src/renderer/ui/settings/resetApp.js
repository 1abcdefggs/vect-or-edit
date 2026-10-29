import { STORAGE_KEYS } from '../../core/constants.js';
import { clearAllApiKeys } from '../../core/apiKeyStore.js';
import { clearAllKnowledgeSlots, resetGoalProfile } from '../../search/dictionary.js';
import { syncSettingsToBackend } from './settingsState.js';

/**
 * Reset (ADR-11 section 2.9).
 *
 * full: everything goes back to the first-run state: preferences, the loaded KNOWLEDGE and guideline, the API keys,
 *       the downloaded model files. The first-run setup shows again.
 * dev:  the same, except what is slow to get back (the model files) or tedious to enter again: the API keys, the
 *       chosen provider and models, the loaded KNOWLEDGE and guideline, and the save folder (kept by the main
 *       process, not by these preferences). The first-run setup shows again.
 *
 * Drafts of unsaved documents (autosave_*) are never touched.
 */
const KEPT_BY_DEV_RESET = [
  STORAGE_KEYS.AI_PROVIDER,
  STORAGE_KEYS.LLM_PROVIDER,
  STORAGE_KEYS.GEMINI_MODEL,
  STORAGE_KEYS.CLAUDE_MODEL,
  STORAGE_KEYS.OPENAI_MODEL,
  'cached_gemini_models',
  STORAGE_KEYS.LOCAL_EMBEDDING_MODEL,
  STORAGE_KEYS.EMBEDDING_SOURCE,
  STORAGE_KEYS.EMBEDDING_MODELS_DOWNLOADED
];

/** Removes the downloaded embedding model files (the browser cache that transformers.js fills). */
async function deleteModelCaches() {
  if (typeof caches === 'undefined') return;
  const names = await caches.keys();
  await Promise.all(names.filter((name) => name.toLowerCase().includes('transformers')).map((name) => caches.delete(name)));
}

/**
 * @param {{ dev: boolean }} options
 * @returns {Promise<void>} resolves just before the window reloads
 */
export async function resetApp({ dev }) {
  if (!dev) {
    // The main process keeps the loaded slots and the guideline in memory, so a reload alone would bring them back
    await clearAllKnowledgeSlots();
    await resetGoalProfile();
    await clearAllApiKeys();
    // Back to the default save folder before .settings.json is written below, so it lands in the folder the next start reads
    await window.engineAPI?.resetDefaultWorkspace?.();
    await deleteModelCaches().catch((err) => console.warn('[Reset] Could not remove the model cache:', err));
  }

  const keep = new Set(dev ? KEPT_BY_DEV_RESET : []);
  Object.keys(localStorage)
    .filter((key) => !key.startsWith('autosave_') && !keep.has(key))
    .forEach((key) => localStorage.removeItem(key));

  // .settings.json would otherwise put the removed values back when the window reloads
  await syncSettingsToBackend();
  window.location.reload();
}
