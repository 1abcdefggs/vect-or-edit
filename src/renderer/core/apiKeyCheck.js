/**
 * Checks of a typed API key before it is stored. Key lengths and formats are the providers' to change, so there is no
 * length limit; only what is certainly a paste mistake stops the save (a space or line break inside the key), and an
 * unexpected start is only reported.
 */

// How each provider's keys start today (a hint, not a rule: a different start only produces a notice)
export const KEY_PREFIXES = { gemini: 'AIza', openai: 'sk-', claude: 'sk-ant-' };

/**
 * Returns { key, hasInnerWhitespace, prefixMismatch }.
 * key is the input without the spaces and line breaks at its two ends (those are harmless paste leftovers).
 */
export function checkApiKey(provider, raw) {
  const key = String(raw ?? '').trim();
  const prefix = KEY_PREFIXES[provider];
  return {
    key,
    hasInnerWhitespace: /\s/.test(key),
    prefixMismatch: Boolean(prefix) && key.length > 0 && !key.startsWith(prefix)
  };
}
