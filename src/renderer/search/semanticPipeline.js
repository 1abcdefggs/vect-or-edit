/**
 * semanticPipeline.js — Renderer-side SemanticPipeline (Phase C, MODULE 4)
 *
 * Unified L1-L10 entry point for the Editor.
 * Called by selection handler in vectorSearch.js.
 *
 * Layers handled here:
 *   L1  - text normalization (NFKC + space collapse)
 *   L2  - keyword match  (via semantics:query IPC -> slotItemsCache)
 *   L5  - vector search  (embedding in worker -> semantics:vectorQuery IPC)
 *   L7/L8 - guideline alerts (via semantics:query IPC -> activeProfile rules)
 *   L9  - inference scoring (cosine rank + ICD category tagging)
 *
 * Returns: InferenceResult
 *   { matches, alerts, vectorHits, normalized }
 */

// ------- L1: normalize -------
function normalizeText(text) {
  return text
    .normalize('NFKC')            // full-width -> half-width, katakana normalize
    .replace(/\s+/g, ' ')
    .trim();
}

// ------- embedding worker (lazy) -------
let _worker = null;
let _workerReady = false;
let _pendingEmbedResolvers = new Map();
let _embedSeq = 0;

function getWorker() {
  if (_worker) return _worker;
  // worker.js is the existing Web Worker path
  _worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  _worker.addEventListener('message', (e) => {
    const { seq, vector, error } = e.data;
    const resolve = _pendingEmbedResolvers.get(seq);
    if (resolve) {
      _pendingEmbedResolvers.delete(seq);
      resolve(error ? null : vector);
    }
    if (e.data.type === 'ready') _workerReady = true;
  });
  return _worker;
}

/**
 * Request embedding from worker.
 * Returns Float32Array or null if worker unavailable.
 */
async function embedText(text) {
  return new Promise((resolve) => {
    try {
      const worker = getWorker();
      const seq = ++_embedSeq;
      _pendingEmbedResolvers.set(seq, resolve);
      worker.postMessage({ type: 'embed', seq, text: `query: ${text}` });
      // Timeout fallback: if worker doesn't respond in 5s, skip vector search
      setTimeout(() => {
        if (_pendingEmbedResolvers.has(seq)) {
          _pendingEmbedResolvers.delete(seq);
          resolve(null);
        }
      }, 5000);
    } catch {
      resolve(null);
    }
  });
}

// ------- IPC helper -------
function invoke(channel, ...args) {
  if (channel === 'semantics:query' && window.engineAPI?.querySemantics) {
    return window.engineAPI.querySemantics(args[0], args[1]);
  }
  const api = window.engineAPI;
  if (api?.[channel]) return api[channel](...args);
  return Promise.resolve({ success: false, error: 'IPC channel not mapped' });
}


// ------- main pipeline -------

/**
 * @param {string} text  Selected or typed text
 * @param {string} [context]  Surrounding text (wider selection)
 * @returns {Promise<{
 *   normalized: string,
 *   matches: {id,name,score,metadata}[],
 *   alerts: {id,severity,message,line?}[],
 *   vectorHits: {id,name,score}[]
 * }>}
 */
export async function semanticQuery(text, context) {
  const normalized = normalizeText(text);
  if (!normalized) return { normalized: '', matches: [], alerts: [], vectorHits: [] };

  // L2 + L7/L8 via IPC (keyword match + guideline alerts)
  const queryRes = await invoke('semantics:query', normalized, context ? normalizeText(context) : undefined);
  const { matches = [], alerts = [], vectorHits: baseHits = [] } = queryRes?.data ?? {};

  // L5 — vector search (async, non-blocking if worker unavailable)
  let vectorHits = baseHits;
  const queryVec = await embedText(normalized);
  if (queryVec) {
    const vecRes = await invoke('semantics:vectorQuery', Array.from(queryVec), 10);
    if (vecRes?.success && Array.isArray(vecRes.data)) {
      vectorHits = vecRes.data;
    }
  }

  // L9 — merge & rank: prefer vector hits, fill with keyword matches
  const seen = new Set();
  const ranked = [];
  for (const h of [...vectorHits, ...matches]) {
    if (!seen.has(h.id)) { seen.add(h.id); ranked.push(h); }
    if (ranked.length >= 15) break;
  }

  return { normalized, matches: ranked, alerts, vectorHits };
}

// ------- debounced selection handler -------
let _debounce = null;

/**
 * Attach to Monaco editor selection change.
 * @param {Function} onResult  callback(InferenceResult)
 * @param {number} delay  ms debounce (default 400)
 */
export function attachSelectionHandler(editor, onResult, delay = 400) {
  editor.onDidChangeCursorSelection((e) => {
    const selection = editor.getSelection();
    if (!selection || selection.isEmpty()) return;
    const selectedText = editor.getModel()?.getValueInRange(selection) ?? '';
    if (!selectedText.trim()) return;

    // Wider context: ±3 lines around selection
    const model = editor.getModel();
    const contextRange = {
      startLineNumber: Math.max(1, selection.startLineNumber - 3),
      startColumn: 1,
      endLineNumber: Math.min(model.getLineCount(), selection.endLineNumber + 3),
      endColumn: model.getLineMaxColumn(Math.min(model.getLineCount(), selection.endLineNumber + 3))
    };
    const context = model.getValueInRange(contextRange);

    clearTimeout(_debounce);
    _debounce = setTimeout(async () => {
      const result = await semanticQuery(selectedText, context);
      onResult(result);
    }, delay);
  });
}
