/**
 * Cloud LLM API keys (Gemini, OpenAI, Claude).
 * The main process keeps each key encrypted with the OS key store; the renderer only knows whether a key is set.
 * Keys are never kept in localStorage or written to .settings.json. Plain-text keys left by older versions
 * are moved into the encrypted store once at startup.
 */
import { STORAGE_KEYS } from './constants.js';
import { readStorage, removeStorage } from './storage.js';

export const API_KEY_PROVIDERS = ['gemini', 'openai', 'claude'];

// Plain-text names used by older versions, oldest first (the last non-empty value wins)
const PLAINTEXT_NAMES = {
  gemini: [STORAGE_KEYS.GEMINI_API_KEY],
  openai: ['vect_openai_api_key', STORAGE_KEYS.OPENAI_API_KEY],
  claude: ['vect_claude_api_key', STORAGE_KEYS.CLAUDE_API_KEY]
};

/** localStorage names that must never reach .settings.json */
export const SECRET_STORAGE_KEYS = Object.values(PLAINTEXT_NAMES).flat();

const configured = { gemini: false, openai: false, claude: false };

function setConfigured(provider, value) {
  configured[provider] = Boolean(value);
}

export function isApiKeyConfigured(provider) {
  return Boolean(configured[provider]);
}

export async function refreshApiKeyStatus() {
  const api = window.engineAPI;
  await Promise.all(API_KEY_PROVIDERS.map(async (provider) => {
    try {
      setConfigured(provider, api?.hasApiKey ? await api.hasApiKey(provider) : false);
    } catch {
      setConfigured(provider, false);
    }
  }));
}

/** Stores a key encrypted in the main process. */
export async function saveApiKey(provider, apiKey) {
  const api = window.engineAPI;
  if (!api?.saveApiKey) return { success: false, error: 'Secure key storage needs the desktop app.' };
  const res = await api.saveApiKey(provider, apiKey);
  if (res?.success) setConfigured(provider, true);
  return res || { success: false, error: 'No response from the key store.' };
}

/** Removes every stored key. Returns the first error, if any. */
export async function clearAllApiKeys() {
  const api = window.engineAPI;
  let error = null;
  for (const provider of API_KEY_PROVIDERS) {
    const res = await api?.clearApiKey?.(provider);
    if (res && !res.success) {
      if (!error) error = res.error || `Could not remove the ${provider} key.`;
    } else {
      setConfigured(provider, false);
    }
  }
  if (!error) {
    try {
      SECRET_STORAGE_KEYS.forEach((name) => removeStorage(name));
    } catch {
      error = 'Could not remove the plain-text key copies from local storage.';
    }
  }
  return { success: !error, error };
}

/**
 * Moves plain-text keys (localStorage, restored from .settings.json) into the encrypted store and deletes the
 * plain-text copies. A provider that already has an encrypted key keeps it: the plain-text copy may be stale
 * (an old .settings.json backup), so it is only deleted. A key that cannot be encrypted (no OS key store) is left
 * in local storage, but nothing reads it: the main process only uses the encrypted store, so the key must be
 * entered again once encryption is available.
 * @returns {Promise<{removed: boolean, failedProviders: string[]}>} removed: plain-text keys were removed, so
 *   .settings.json should be rewritten. failedProviders: providers whose plain-text copy stays in local storage
 */
export async function migratePlaintextApiKeys() {
  const api = window.engineAPI;
  if (!api?.saveApiKey) return { removed: false, failedProviders: [] };
  let removed = false;
  const failedProviders = [];
  for (const provider of API_KEY_PROVIDERS) {
    const names = PLAINTEXT_NAMES[provider].filter((name) => readStorage(name) !== null);
    if (names.length === 0) continue;
    const value = names.map((name) => (readStorage(name) ?? '').trim()).filter(Boolean).pop();
    if (value) {
      let alreadyStored = false;
      try {
        alreadyStored = Boolean(await api.hasApiKey?.(provider));
      } catch {
        alreadyStored = false;
      }
      if (!alreadyStored) {
        const res = await api.saveApiKey(provider, value);
        if (!res?.success) {
          console.warn(`[apiKeyStore] Could not encrypt the ${provider} key; it stays in local storage but is not used until encryption is available:`, res?.error);
          failedProviders.push(provider);
          continue;
        }
      }
    }
    try {
      names.forEach((name) => removeStorage(name));
    } catch (err) {
      // The plain-text copy stays. It is not used (see above), but it must be removed; reported so it is not silent
      console.warn(`[apiKeyStore] Could not remove the plain-text ${provider} key from local storage:`, err);
      failedProviders.push(provider);
      continue;
    }
    removed = true;
  }
  return { removed, failedProviders };
}
