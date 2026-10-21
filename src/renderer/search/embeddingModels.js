/**
 * Local embedding model catalog (renderer side).
 * Mirrors the embedding facets in vect-or-generate/registry/facets.json
 * (modelId, dim, queryPrefix, passagePrefix). Keep the two in sync.
 */
import { STORAGE_KEYS, DEFAULTS } from '../core/constants.js';

export const EMBEDDING_MODELS = [
  {
    id: 'Xenova/multilingual-e5-small',
    dim: 384,
    sizeMB: 45,
    language: 'multilingual',
    queryPrefix: 'query: ',
    passagePrefix: 'passage: '
  },
  {
    id: 'Xenova/all-MiniLM-L6-v2',
    dim: 384,
    sizeMB: 23,
    language: 'en',
    queryPrefix: '',
    passagePrefix: ''
  },
  {
    id: 'Xenova/bge-small-en-v1.5',
    dim: 384,
    sizeMB: 33,
    language: 'en',
    queryPrefix: 'Represent this sentence for searching relevant passages: ',
    passagePrefix: ''
  }
];

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
