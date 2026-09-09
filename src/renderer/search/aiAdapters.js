/**
 * aiAdapters.js – Cross-Capsule Adapter Layer
 *
 * Defines two abstract interfaces used throughout the vector-search pipeline:
 *
 *   Vectorizer  : encode(text: string) → Promise<number[]>
 *   Generator   : generate(prompt: string) → Promise<string>
 *
 * Any Processor (EmbeddingProcessor, LLMProcessor) accepts either interface,
 * allowing full cross-usage:
 *   - LocalEmbeddingAdapter   → Vectorizer  (default: Transformers.js worker)
 *   - LLMEmbeddingAdapter     → Vectorizer  (LLM used as embedding source)
 *   - GeminiLLMAdapter        → Generator   (Gemini API)
 *   - ClaudeLLMAdapter        → Generator   (Anthropic Claude API)
 *   - OpenAILLMAdapter        → Generator   (OpenAI ChatGPT API)
 *
 * Deep-module design: callers only see `encode()` or `generate()`.
 * Internal retry, timeout, and IPC details are hidden inside each adapter.
 */

import { STORAGE_KEYS, DEFAULTS, TIMINGS } from '../core/constants.js';
import { getVectorFromWorker, isLocalAiReadyState } from './searchLocalAi.js';

// ─────────────────────────────────────────────
// 1. LocalEmbeddingAdapter  (Vectorizer)
//    Uses the existing Transformers.js Web Worker.
// ─────────────────────────────────────────────
export class LocalEmbeddingAdapter {
  /** @type {'vectorizer'} */
  kind = 'vectorizer';
  id = 'local';
  displayName = 'Local Embedding (Transformers.js)';

  /**
   * @param {string} text
   * @returns {Promise<number[]>}
   */
  async encode(text) {
    if (!isLocalAiReadyState()) {
      throw new Error(
        'Local AI model is not ready. Please initialise it from settings first.'
      );
    }
    const timeoutMs = TIMINGS.WORKER_TIMEOUT_MS ?? 2000;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('LocalEmbeddingAdapter: timeout')), timeoutMs)
    );
    const vector = await Promise.race([getVectorFromWorker(text), timeoutPromise]);
    return Array.isArray(vector) ? vector : Array.from(vector);
  }
}

// ─────────────────────────────────────────────
// 2. LLMEmbeddingAdapter  (Vectorizer)
//    Uses a configured LLM (Gemini / Claude / OpenAI) as an embedding source.
//    The LLM is asked to return a JSON array of floats.
//    NOTE: This is intentionally exposed as an option so users can compare
//    the determinism difference between a proper embedding model and an LLM.
// ─────────────────────────────────────────────
export class LLMEmbeddingAdapter {
  /** @type {'vectorizer'} */
  kind = 'vectorizer';

  /**
   * @param {'gemini'|'claude'|'openai'} provider
   * @param {number} [dimensions=64] – dimensionality of the pseudo-embedding
   */
  constructor(provider = 'gemini', dimensions = 64) {
    this.provider = provider;
    this.dimensions = dimensions;
    this.id = `llm-embed-${provider}`;
    this.displayName = `LLM Embedding (${provider})`;
  }

  /**
   * Encodes text via LLM IPC channel.
   * The Main process converts the LLM response to a pseudo-vector.
   *
   * @param {string} text
   * @returns {Promise<number[]>}
   */
  async encode(text) {
    if (!window.engineAPI?.llmEmbedding) {
      throw new Error('IPC channel "llm-embedding" is not available.');
    }
    const model = this._getModel();
    const apiKey = this._getApiKey();
    const result = await window.engineAPI.llmEmbedding({
      text,
      provider: this.provider,
      model,
      apiKey,
      dimensions: this.dimensions,
    });
    if (!result?.success) {
      throw new Error(result?.error ?? 'LLMEmbeddingAdapter: unknown error');
    }
    return result.vector;
  }

  _getModel() {
    const map = {
      gemini: () => localStorage.getItem(STORAGE_KEYS.GEMINI_MODEL) || DEFAULTS.GEMINI_MODEL,
      claude: () => localStorage.getItem(STORAGE_KEYS.CLAUDE_MODEL) || DEFAULTS.CLAUDE_MODEL,
      openai: () => localStorage.getItem(STORAGE_KEYS.OPENAI_MODEL) || DEFAULTS.OPENAI_MODEL,
    };
    return (map[this.provider] ?? map.gemini)();
  }

  _getApiKey() {
    const map = {
      gemini: () => localStorage.getItem(STORAGE_KEYS.GEMINI_API_KEY) ?? '',
      claude: () => localStorage.getItem(STORAGE_KEYS.CLAUDE_API_KEY) ?? '',
      openai: () => localStorage.getItem(STORAGE_KEYS.OPENAI_API_KEY) ?? '',
    };
    return (map[this.provider] ?? map.gemini)();
  }
}

// ─────────────────────────────────────────────
// 3. GeminiLLMAdapter  (Generator)
//    Wraps the existing window.engineAPI.geminiSemanticSuggest IPC.
// ─────────────────────────────────────────────
export class GeminiLLMAdapter {
  /** @type {'generator'} */
  kind = 'generator';
  id = 'gemini';
  displayName = 'Gemini';

  /**
   * @param {string} prompt
   * @returns {Promise<string>}
   */
  async generate(prompt) {
    const model = localStorage.getItem(STORAGE_KEYS.GEMINI_MODEL) || DEFAULTS.GEMINI_MODEL;
    if (!window.engineAPI?.geminiSemanticSuggest) {
      throw new Error('IPC channel "geminiSemanticSuggest" is not available.');
    }
    const res = await window.engineAPI.geminiSemanticSuggest({ prompt, model });
    if (!res?.success) throw new Error(res?.error ?? 'Gemini: unknown error');
    return res.text ?? '';
  }
}

// ─────────────────────────────────────────────
// 4. ClaudeLLMAdapter  (Generator)
// ─────────────────────────────────────────────
export class ClaudeLLMAdapter {
  /** @type {'generator'} */
  kind = 'generator';
  id = 'claude';
  displayName = 'Claude';

  /**
   * @param {string} prompt
   * @returns {Promise<string>}
   */
  async generate(prompt) {
    const apiKey = localStorage.getItem(STORAGE_KEYS.CLAUDE_API_KEY) ?? '';
    const model = localStorage.getItem(STORAGE_KEYS.CLAUDE_MODEL) || DEFAULTS.CLAUDE_MODEL;
    if (!window.engineAPI?.claudeSemanticSuggest) {
      throw new Error('IPC channel "claudeSemanticSuggest" is not available.');
    }
    const res = await window.engineAPI.claudeSemanticSuggest({ prompt, apiKey, model });
    if (!res?.success) throw new Error(res?.error ?? 'Claude: unknown error');
    return res.text ?? '';
  }
}

// ─────────────────────────────────────────────
// 5. OpenAILLMAdapter  (Generator)
// ─────────────────────────────────────────────
export class OpenAILLMAdapter {
  /** @type {'generator'} */
  kind = 'generator';
  id = 'openai';
  displayName = 'OpenAI (ChatGPT)';

  /**
   * @param {string} prompt
   * @returns {Promise<string>}
   */
  async generate(prompt) {
    const apiKey = localStorage.getItem(STORAGE_KEYS.OPENAI_API_KEY) ?? '';
    const model = localStorage.getItem(STORAGE_KEYS.OPENAI_MODEL) || DEFAULTS.OPENAI_MODEL;
    if (!window.engineAPI?.openaiSemanticSuggest) {
      throw new Error('IPC channel "openaiSemanticSuggest" is not available.');
    }
    const res = await window.engineAPI.openaiSemanticSuggest({ prompt, apiKey, model });
    if (!res?.success) throw new Error(res?.error ?? 'OpenAI: unknown error');
    return res.text ?? '';
  }
}
