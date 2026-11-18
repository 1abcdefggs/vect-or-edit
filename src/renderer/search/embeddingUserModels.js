/**
 * Embedding models the user adds by ID (Settings > Embedding models, "Add a model by ID").
 * Only the ID is accepted (owner decision 2026-11-17): owner/model-name, never a link.
 * The model's facts come from huggingface.co, the one host already allowed for model downloads
 * (src/main/net/egressPolicy.ts APP_HOSTS, and the renderer CSP connect-src). No host is added.
 * An added model is listed for comparison only. It has no verified query/passage prefixes,
 * so it is never offered for use (src/renderer/search/embeddingModels.js keeps only models with prefixes).
 */
import { STORAGE_KEYS } from '../core/constants.js';
import { readStorage, writeStorage } from '../core/storage.js';
import { REGISTRY } from '../../shared/embeddingCatalog';

const HUB = 'https://huggingface.co';
const TIMEOUT_MS = 10000;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}\/[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/;
const WEIGHT_FILE = /\.(safetensors|bin)$/;

/** Error with a code; the UI maps the code to a message (ep_add_err_<code>) */
export class ImportError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

/** Accepts owner/model-name only. Links and anything else are refused with the reason. */
export function parseModelId(input) {
  const id = String(input ?? '').trim();
  if (/^https?:\/\//i.test(id) || id.includes('huggingface.co')) throw new ImportError('url');
  if (!ID_PATTERN.test(id)) throw new ImportError('invalid');
  return id;
}

function builtInIds() {
  return new Set(REGISTRY.models.map((m) => m.id));
}

/** Stored user models; a damaged value is ignored, never thrown */
export function loadUserModels() {
  try {
    const parsed = JSON.parse(readStorage(STORAGE_KEYS.EMBEDDING_USER_MODELS) || '[]');
    return Array.isArray(parsed) ? parsed.filter((m) => m && typeof m.id === 'string') : [];
  } catch {
    return [];
  }
}

function saveUserModels(list) {
  try {
    writeStorage(STORAGE_KEYS.EMBEDDING_USER_MODELS, JSON.stringify(list));
  } catch {
    // Storage unavailable: the entry lasts until the window closes; it is not an error for the user
  }
}

export function isUserModel(id) {
  return loadUserModels().some((m) => m.id === id);
}

/** Adds an entry from fetchModelInfo. Refuses a duplicate or a built-in model. */
export function addUserModel(entry) {
  if (builtInIds().has(entry.id)) throw new ImportError('inCatalogue');
  const list = loadUserModels();
  if (list.some((m) => m.id === entry.id)) throw new ImportError('duplicate');
  saveUserModels([...list, entry]);
}

export function removeUserModel(id) {
  saveUserModels(loadUserModels().filter((m) => m.id !== id));
}

async function getJson(url, signal) {
  const res = await fetch(url, { signal, credentials: 'omit' });
  if (res.status === 404) throw new ImportError('notFound');
  if (!res.ok) throw new ImportError('failed');
  return res.json();
}

/**
 * Reads the model's facts from Hugging Face: the embedding task, license, downloads, weight size,
 * and the vector size (hidden_size of config.json). Unknown facts stay null, shown as "—".
 * @returns {Promise<object>} a user-model entry for addUserModel
 */
export async function fetchModelInfo(id) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let info;
    try {
      info = await getJson(`${HUB}/api/models/${id}?blobs=true`, controller.signal);
    } catch (err) {
      if (err instanceof ImportError) throw err;
      throw new ImportError('failed');
    }
    if (info.pipeline_tag !== 'feature-extraction') throw new ImportError('notEmbedding');

    let dimensions = null;
    try {
      const cfg = await getJson(`${HUB}/${id}/resolve/main/config.json`, controller.signal);
      if (Number.isInteger(cfg.hidden_size) && cfg.hidden_size > 0) dimensions = cfg.hidden_size;
    } catch (err) {
      // No config.json: the vector size stays unknown. Any other failure stops the add.
      if (!(err instanceof ImportError && err.code === 'notFound')) throw new ImportError('failed');
    }

    const weights = (info.siblings || []).filter((f) => WEIGHT_FILE.test(f.rfilename) && Number.isFinite(f.size));
    const bytes = weights.reduce((sum, f) => sum + f.size, 0);
    const license = (info.tags || []).find((tag) => tag.startsWith('license:'))?.slice('license:'.length) ?? null;

    return {
      id,
      dimensions,
      sizeMB: bytes > 0 ? Math.round(bytes / 1e6) : null,
      downloadsMonthly: Number.isFinite(info.downloads) ? info.downloads : null,
      license,
      addedAt: new Date().toISOString()
    };
  } finally {
    clearTimeout(timer);
  }
}

/** The picker's catalogue: the built-in registry, then the models the user added */
export function catalogueModels() {
  const extra = loadUserModels()
    .filter((m) => !builtInIds().has(m.id))
    .map((m) => ({
      id: m.id,
      dimensions: m.dimensions ?? null,
      sizeMB: m.sizeMB ?? null,
      languages: [],
      languageNote: null,
      blurb: '',
      tasks: { list: [], evidence: 'unverified' },
      license: { repo: m.license ?? null, original: null },
      downloadsMonthly: m.downloadsMonthly ?? null,
      prefixes: null,
      maxTokens: null,
      crossLingual: null,
      sourceUrls: { model: `${HUB}/${m.id}` },
      checkedAt: m.addedAt ?? ''
    }));
  return [...REGISTRY.models, ...extra];
}
