import { t, tLog } from '../core/i18n.js';
import { readStorage } from '../core/storage.js';
import { setLedStatus, led } from '../core/statusManager.js';
import { i18n } from '../core/i18n.js';
import { renderResults } from './searchUi.js';
import { STORAGE_KEYS, DEFAULTS } from '../core/constants.js';
import { markModelDownloaded, getActiveModelId, getDownloadedModelIds } from './embeddingModels.js';

let isLocalAiReady = false;
let isLocalAiDownloading = false;
// The model that last reported ready. transformers.js sends "done" once per downloaded file and "ready" more than once,
// so the ready line (and the pipeline log) is written once per model, not once per message (ADR-11 section 2.10)
let lastReadyModel = null;
// The model asked for in the last init request, and the files already written to the log for it.
// The log keeps milestones only (start, each file, then ready or error from setLedStatus); the percentage stays on the LED and the settings bar
let loadingModel = null;
const loggedModelFiles = new Set();
let embeddingWorker = null;
let isWorkerInitialized = false;

let nextRequestId = 1;
const pendingRequests = new Map();

/** Tell the model list (settings) to re-render its Download / Use / Active states. */
export function notifyEmbeddingModelsChanged() {
  window.dispatchEvent(new CustomEvent('app:embeddingModelsChanged'));
}

/** Ask the worker to fetch a model's files without switching the active model. */
export function requestEmbeddingModelDownload(modelId) {
  if (!embeddingWorker) return;
  embeddingWorker.postMessage({ type: 'download', model: modelId, requestId: `download_${Date.now()}` });
}

export function initLocalAiWorker(getCurrentResults) {
  if (typeof window === 'undefined') return;
  if (isWorkerInitialized && embeddingWorker) return;
  isWorkerInitialized = true;

  // The main process decides which dictionaries fit the selected model, so it must know the model (at start and on every switch)
  // The truncation switch (settings page) goes along: 'off' stops the main process from cutting vectors to a shorter length
  const announceModel = (modelId) => window.engineAPI?.setEmbeddingModel?.(modelId, readStorage(STORAGE_KEYS.EMBEDDING_TRUNCATION) !== 'off')
    .then(() => window.dispatchEvent(new CustomEvent('app:slotCompatChanged')))
    .catch(() => {});
  announceModel(getActiveModelId());
  window.addEventListener('app:embeddingTruncationChanged', () => announceModel(getActiveModelId()));

  window.addEventListener('app:requestLocalAiInit', (ev) => {
    const modelToLoad = ev?.detail?.model || readStorage(STORAGE_KEYS.LOCAL_EMBEDDING_MODEL) || DEFAULTS.LOCAL_EMBEDDING_MODEL;
    announceModel(modelToLoad);
    if (isLocalAiDownloading) return;
    isLocalAiDownloading = true;
    loadingModel = modelToLoad;
    loggedModelFiles.clear();
    if (embeddingWorker) {
      embeddingWorker.postMessage({ type: 'init', model: modelToLoad });
    }
  });

  try {
    embeddingWorker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    embeddingWorker.addEventListener('message', (e) => {
      const data = e.data || {};
      const { requestId, status, error, vector } = data;

      // 1. Route request-specific results
      if (requestId && pendingRequests.has(requestId)) {
        const { resolve, reject, timer } = pendingRequests.get(requestId);
        if (timer) clearTimeout(timer);
        pendingRequests.delete(requestId);

        if (status === 'complete') {
          resolve(vector);
          return;
        } else if (status === 'error') {
          reject(new Error(error || 'Worker error'));
          return;
        }
      }

      // 2a. Background download (does not change the active model)
      if (status && status.startsWith('download-') && data.model) {
        if (status === 'download-complete') {
          markModelDownloaded(data.model);
          notifyEmbeddingModelsChanged();
        }
        window.dispatchEvent(new CustomEvent('app:embeddingModelDownload', {
          detail: {
            model: data.model,
            status: status.replace('download-', ''),
            pct: data.progress !== undefined ? Math.round(data.progress) : (status === 'download-complete' ? 100 : 0)
          }
        }));
        return;
      }

      // 2b. Global model download / lifecycle handling
      const modalDownloadProgress = document.getElementById('modalAiDownloadProgress');
      const modalDownloadFile = document.getElementById('modalAiDownloadFile');
      const modalDownloadPct = document.getElementById('modalAiDownloadPct');
      const modalDownloadBar = document.getElementById('modalAiDownloadProgressBar');
      const localAiStatusBadge = document.getElementById('localAiStatusBadge');
      const btnInitLocalAi = document.getElementById('btnInitLocalAi');

      if (status === 'initiate' || status === 'download' || status === 'progress') {
        const pct = data.progress !== undefined ? Math.round(data.progress) : 0;
        const fileName = data.file || t('model_files_fallback');
        const modelId = data.name || data.model || loadingModel || getActiveModelId();
        setLedStatus('ai', 'loading', led('led_ai_downloading', { pct }));
        window.dispatchEvent(new CustomEvent('app:aiModelProgress', { detail: { pct, fileName, status } }));

        // Milestones go through the shared log (time stamp, Copy and Save); a cached model sends no progress, so nothing is logged
        if (loggedModelFiles.size === 0) {
          window.appendSystemLog?.(tLog('log_model_download_start', { model: modelId }), 'info');
        }
        const fileKey = `${modelId}|${fileName}`;
        if (!loggedModelFiles.has(fileKey)) {
          loggedModelFiles.add(fileKey);
          window.appendSystemLog?.(tLog('log_model_file_fetch', { model: modelId, file: fileName }), 'info');
        }

        if (modalDownloadProgress) modalDownloadProgress.style.display = 'block';
        if (modalDownloadFile) modalDownloadFile.textContent = `${i18n.downloading_progress || 'Downloading...'} (${fileName})`;
        if (modalDownloadPct) modalDownloadPct.textContent = `${pct}%`;
        if (modalDownloadBar) modalDownloadBar.style.width = `${pct}%`;
        if (btnInitLocalAi) {
          btnInitLocalAi.disabled = true;
          btnInitLocalAi.style.opacity = '0.6';
        }

        const systemLogPanel = document.getElementById('systemLogPanel');
        if (systemLogPanel && systemLogPanel.style.display === 'none') {
          systemLogPanel.style.display = 'flex';
        }
      } else if (status === 'done') {
        // One file finished downloading. The model is not ready until the worker reports "ready", so say nothing here
        return;
      } else if (status === 'ready') {
        const loadedModel = data.model || readStorage(STORAGE_KEYS.LOCAL_EMBEDDING_MODEL) || DEFAULTS.LOCAL_EMBEDDING_MODEL;
        if (isLocalAiReady && lastReadyModel === loadedModel) return;
        lastReadyModel = loadedModel;
        isLocalAiReady = true;
        window.__isLocalAiModelReady = true;
        isLocalAiDownloading = false;
        const modelShortName = loadedModel.split('/').pop();
        setLedStatus('ai', true, led('led_ai_ready', { model: modelShortName }));
        window.dispatchEvent(new CustomEvent('app:settingsChanged'));
        window.dispatchEvent(new CustomEvent('app:aiModelProgress', { detail: { pct: 100, status: 'ready', model: loadedModel } }));
        markModelDownloaded(loadedModel);
        notifyEmbeddingModelsChanged();
        
        if (modalDownloadProgress) modalDownloadProgress.style.display = 'none';
        if (localAiStatusBadge) {
          localAiStatusBadge.textContent = `${i18n.local_ai_ready || 'Local AI: Ready'} (${modelShortName})`;
          localAiStatusBadge.style.color = 'var(--success-color, #10b981)';
        }
        if (btnInitLocalAi) {
          btnInitLocalAi.style.display = 'none';
        }

        if (typeof getCurrentResults === 'function') {
          const currentResults = getCurrentResults();
          if (currentResults && currentResults.length > 0) {
            renderResults(currentResults, false);
          }
        }
      } else if (status === 'error') {
        isLocalAiDownloading = false;
        console.warn("Embedding worker reported error:", error);
        setLedStatus('ai', 'error', led('led_ai_error', { error }));
        // The sidebar switch and the first-run setup wait for this event to leave "preparing"
        window.dispatchEvent(new CustomEvent('app:aiModelProgress', { detail: { pct: 0, status: 'error', model: loadingModel } }));
        if (btnInitLocalAi) {
          btnInitLocalAi.disabled = false;
          btnInitLocalAi.style.opacity = '1';
        }
        if (typeof getCurrentResults === 'function') {
          const currentResults = getCurrentResults();
          if (currentResults && currentResults.length > 0) {
            renderResults(currentResults, false);
          }
        }
      }
    });
    // A model already on this device loads at startup. Until the worker reports ready, the Embedding counts as not configured
    const activeModel = getActiveModelId();
    if (getDownloadedModelIds().has(activeModel)) {
      window.dispatchEvent(new CustomEvent('app:requestLocalAiInit', { detail: { model: activeModel } }));
    }
  } catch (e) {
    console.error("Worker initialization failed", e);
  }
}

export function isLocalAiReadyState() {
  return Boolean(isLocalAiReady || window.__isLocalAiModelReady);
}

export function getVectorFromWorker(text, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    if (!embeddingWorker) {
      return reject(new Error("Worker not initialized"));
    }
    if (!isLocalAiReadyState()) {
      return reject(new Error("Local AI model is not ready. Please initialize from settings."));
    }

    const requestId = `req_${nextRequestId++}_${Date.now()}`;
    
    const timer = setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        reject(new Error("Vector computation timeout"));
      }
    }, timeoutMs);

    pendingRequests.set(requestId, { resolve, reject, timer });

    try {
      embeddingWorker.postMessage({ text, requestId });
    } catch (err) {
      clearTimeout(timer);
      pendingRequests.delete(requestId);
      reject(err);
    }
  });
}
