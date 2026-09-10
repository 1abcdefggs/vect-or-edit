/**
 * adapterRegistry.js – Adapter Registry (singleton)
 *
 * Single source of truth for which Vectorizer/Generator adapter is active.
 * Processors (EmbeddingProcessor, LLMProcessor) call this registry to obtain
 * the currently configured adapter without knowing the concrete type.
 *
 * Persisted in localStorage so the selection survives page reloads:
 *   STORAGE_KEYS.EMBEDDING_SOURCE  → active Vectorizer id
 *   STORAGE_KEYS.AI_PROVIDER       → active Generator id  (already exists)
 *
 * Deep-module principle: callers see only:
 *   registry.getActiveVectorizer()  → Vectorizer
 *   registry.getActiveGenerator()   → Generator
 * Adapter construction details are hidden.
 */

import { STORAGE_KEYS, DEFAULTS } from '../core/constants.js';
import {
  LocalEmbeddingAdapter,
  LLMEmbeddingAdapter,
  GeminiLLMAdapter,
  ClaudeLLMAdapter,
  OpenAILLMAdapter,
} from './aiAdapters.js';

// ─────────────────────────────────────────────
// Internal factory maps
// ─────────────────────────────────────────────
/** @returns {import('./aiAdapters.js').LocalEmbeddingAdapter | import('./aiAdapters.js').LLMEmbeddingAdapter} */
function buildVectorizer(id) {
  if (id === 'local') return new LocalEmbeddingAdapter();
  if (id.startsWith('llm-embed-')) {
    const provider = id.replace('llm-embed-', '');
    return new LLMEmbeddingAdapter(provider);
  }
  // Fallback to local
  return new LocalEmbeddingAdapter();
}

/** @returns {import('./aiAdapters.js').GeminiLLMAdapter | import('./aiAdapters.js').ClaudeLLMAdapter | import('./aiAdapters.js').OpenAILLMAdapter} */
function buildGenerator(id) {
  if (id === 'gemini') return new GeminiLLMAdapter();
  if (id === 'claude') return new ClaudeLLMAdapter();
  if (id === 'openai') return new OpenAILLMAdapter();
  // Fallback: Gemini
  return new GeminiLLMAdapter();
}

// ─────────────────────────────────────────────
// Registry singleton
// ─────────────────────────────────────────────
class AdapterRegistry {
  constructor() {
    /** @type {Map<string, object>} */
    this._adapters = new Map();
    this._initDefaults();
  }

  _initDefaults() {
    // Register all built-in adapters
    for (const a of [
      new LocalEmbeddingAdapter(),
      new LLMEmbeddingAdapter('gemini'),
      new LLMEmbeddingAdapter('claude'),
      new LLMEmbeddingAdapter('openai'),
      new GeminiLLMAdapter(),
      new ClaudeLLMAdapter(),
      new OpenAILLMAdapter(),
    ]) {
      this._adapters.set(a.id, a);
    }
  }

  /**
   * Register a custom adapter (e.g., a future LocalLLMAdapter).
   * @param {object} adapter – must have `id`, `kind`, and either `encode()` or `generate()`
   */
  register(adapter) {
    if (!adapter?.id) throw new Error('AdapterRegistry.register: adapter must have an id');
    this._adapters.set(adapter.id, adapter);
  }

  /** @returns {object[]} all Vectorizer adapters */
  listVectorizers() {
    return [...this._adapters.values()].filter(a => a.kind === 'vectorizer');
  }

  /** @returns {object[]} all Generator adapters */
  listGenerators() {
    return [...this._adapters.values()].filter(a => a.kind === 'generator');
  }

  /**
   * Active Vectorizer id, persisted in localStorage.
   * Default: 'local'
   */
  getActiveVectorizerId() {
    return localStorage.getItem(STORAGE_KEYS.EMBEDDING_SOURCE) || DEFAULTS.EMBEDDING_SOURCE;
  }

  /**
   * Set the active Vectorizer and persist.
   * @param {string} id
   */
  setActiveVectorizerId(id) {
    localStorage.setItem(STORAGE_KEYS.EMBEDDING_SOURCE, id);
    window.dispatchEvent(new CustomEvent('app:embeddingSourceChanged', { detail: { id } }));
  }

  /**
   * Returns a ready-to-use Vectorizer adapter for the current configuration.
   * @returns {LocalEmbeddingAdapter|LLMEmbeddingAdapter}
   */
  getActiveVectorizer() {
    const id = this.getActiveVectorizerId();
    return this._adapters.get(id) ?? buildVectorizer(id);
  }

  /**
   * Active Generator id, aligned with existing AI_PROVIDER storage key.
   * Default: DEFAULTS.AI_PROVIDER
   */
  getActiveGeneratorId() {
    return localStorage.getItem(STORAGE_KEYS.AI_PROVIDER) || DEFAULTS.AI_PROVIDER;
  }

  /**
   * Set the active Generator and persist.
   * @param {string} id
   */
  setActiveGeneratorId(id) {
    localStorage.setItem(STORAGE_KEYS.AI_PROVIDER, id);
    window.dispatchEvent(new CustomEvent('app:settingsChanged'));
  }

  /**
   * Returns a ready-to-use Generator adapter for the current configuration.
   * @returns {GeminiLLMAdapter|ClaudeLLMAdapter|OpenAILLMAdapter}
   */
  getActiveGenerator() {
    const id = this.getActiveGeneratorId();
    return this._adapters.get(id) ?? buildGenerator(id);
  }
}

/** Singleton export */
export const adapterRegistry = new AdapterRegistry();
