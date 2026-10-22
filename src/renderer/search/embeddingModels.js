/**
 * Local embedding models the app can run now (renderer side).
 * The model data lives in src/shared/embeddingRegistry.json (one source). A model is runnable only when its
 * query/passage prefixes are verified: the worker prepends the query prefix, and a wrong or missing prefix silently
 * degrades search for the prefix-trained families (e5, bge). Models without verified prefixes stay in the picker
 * catalog (src/shared/embeddingCatalog.ts) and are not offered here yet.
 * vect-or-generate/registry/facets.json still lists the generator-side embedding facets; keep modelId, dim and prefixes in sync.
 */
import { STORAGE_KEYS, DEFAULTS } from '../core/constants.js';
import { REGISTRY } from '../../shared/embeddingCatalog';

const MULTILINGUAL_FROM = 10;

export const EMBEDDING_MODELS = REGISTRY.models
  .filter(m => m.prefixes && m.dimensions)
  .map(m => ({
    id: m.id,
    dim: m.dimensions,
    sizeMB: m.sizeMB,
    language: m.languages.length >= MULTILINGUAL_FROM ? 'multilingual' : m.languages.join(', '),
    queryPrefix: m.prefixes.query,
    passagePrefix: m.prefixes.passage
  }));

export function getEmbeddingModel(modelId) {
  return EMBEDDING_MODELS.find(m => m.id === modelId) || null;
}

export function getActiveModelId() {
  try {
    return localStorage.getItem(STORAGE_KEYS.LOCAL_EMBEDDING_MODEL) || DEFAULTS.LOCAL_EMBEDDING_MODEL;
  } catch {
    return DEFAULTS.LOCAL_EMBEDDING_MODEL;
  }
}

/** Set of model ids whose files were fetched successfully on this device. */
export function getDownloadedModelIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.EMBEDDING_MODELS_DOWNLOADED);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function markModelDownloaded(modelId) {
  try {
    const ids = getDownloadedModelIds();
    ids.add(modelId);
    localStorage.setItem(STORAGE_KEYS.EMBEDDING_MODELS_DOWNLOADED, JSON.stringify([...ids]));
  } catch {
    // Storage unavailable: the model still works, only the "downloaded" badge is lost.
  }
}
