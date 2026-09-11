import { setLedStatus } from '../core/statusManager.js';
import { i18n } from '../core/i18n.js';
import { renderResults } from './searchUi.js';
import { STORAGE_KEYS, DEFAULTS } from '../core/constants.js';

let isLocalAiReady = false;
let isLocalAiDownloading = false;
let embeddingWorker = null;
let isWorkerInitialized = false;

let nextRequestId = 1;
const pendingRequests = new Map();

export function updateActiveModelBadgeInTable(activeModel) {
  const table = document.querySelector('#tabAiSearch table');
  if (!table) return;
  const targetId = activeModel || localStorage.getItem(STORAGE_KEYS.LOCAL_EMBEDDING_MODEL) || DEFAULTS.LOCAL_EMBEDDING_MODEL;
  
  // Clear existing Active badges
  table.querySelectorAll('.model-active-badge').forEach(el => el.remove());

  // Find matching row and attach badge
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach(tr => {
    const textCell = tr.querySelector('td:first-child');
    if (textCell && textCell.textContent.includes(targetId)) {
      tr.style.background = 'rgba(56, 189, 248, 0.08)';
      const badge = document.createElement('span');
      badge.className = 'model-active-badge';
      badge.style.cssText = 'background: rgba(16,185,129,0.2); color: #10b981; padding: 1px 4px; border-radius: 3px; font-size: 0.6rem; margin-left: 6px;';
      badge.textContent = 'Active';
      textCell.appendChild(badge);
    } else {
      tr.style.background = '';
    }
  });
}

export function initLocalAiWorker(getCurrentResults) {
  if (typeof window === 'undefined') return;
  if (isWorkerInitialized && embeddingWorker) return;
  isWorkerInitialized = true;

  window.addEventListener('app:requestLocalAiInit', (ev) => {
    const modelToLoad = ev?.detail?.model || localStorage.getItem(STORAGE_KEYS.LOCAL_EMBEDDING_MODEL) || DEFAULTS.LOCAL_EMBEDDING_MODEL;
    if (isLocalAiDownloading) return;
    isLocalAiDownloading = true;
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

      // 2. Global model download / lifecycle handling
      const modalDownloadProgress = document.getElementById('modalAiDownloadProgress');
      const modalDownloadFile = document.getElementById('modalAiDownloadFile');
      const modalDownloadPct = document.getElementById('modalAiDownloadPct');
      const modalDownloadBar = document.getElementById('modalAiDownloadBar');
      const localAiStatusBadge = document.getElementById('localAiStatusBadge');
      const btnInitLocalAi = document.getElementById('btnInitLocalAi');

      if (status === 'initiate' || status === 'download' || status === 'progress') {
        const pct = data.progress !== undefined ? Math.round(data.progress) : 0;
        const fileName = data.file || 'AI Model Weights';
        setLedStatus('ai', 'loading', `AI Model: Downloading ${pct}%`);
        window.dispatchEvent(new CustomEvent('app:aiModelProgress', { detail: { pct, fileName, status } }));
        
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

        const logContainer = document.getElementById('logEntriesContainer');
        if (logContainer) {
          let logProgressRow = document.getElementById('logDownloadProgressRow');
          if (!logProgressRow) {
            logProgressRow = document.createElement('div');
            logProgressRow.id = 'logDownloadProgressRow';
            logProgressRow.style.cssText = 'background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.35); border-radius: 6px; padding: 8px 12px; margin: 6px 0; font-family: var(--font-mono, monospace); font-size: 0.75rem; box-shadow: 0 2px 8px rgba(0,0,0,0.2);';
            logContainer.appendChild(logProgressRow);
          }
          logProgressRow.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; color: var(--accent-color, #38bdf8);">
              <div style="display: flex; align-items: center; gap: 6px; ">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; animation: pulse 1.5s infinite;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span>[AI Model Download] ${fileName}</span>
              </div>
              <span style=" color: #fff; background: rgba(56,189,248,0.25); padding: 1px 8px; border-radius: 10px;">${pct}%</span>
            </div>
            <div style="height: 6px; background: rgba(255,255,255,0.12); border-radius: 3px; overflow: hidden;">
              <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, var(--accent-color, #38bdf8), #818cf8); transition: width 0.2s ease;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.68rem; color: var(--text-muted, #94a3b8); margin-top: 4px;">
              <span>Transformers.js (Xenova/multilingual-e5-small)</span>
              <span>${pct === 100 ? 'Finalizing...' : 'Streaming weights & tokenizer...'}</span>
            </div>
          `;
          logContainer.scrollTop = logContainer.scrollHeight;
        }
      } else if (status === 'done' || status === 'ready') {
        isLocalAiReady = true;
        window.__isLocalAiModelReady = true;
        isLocalAiDownloading = false;
        const loadedModel = data.model || localStorage.getItem(STORAGE_KEYS.LOCAL_EMBEDDING_MODEL) || DEFAULTS.LOCAL_EMBEDDING_MODEL;
        const modelShortName = loadedModel.split('/').pop();
        setLedStatus('ai', true, `6. AI-MODEL: Ready (${modelShortName})`);
        window.dispatchEvent(new CustomEvent('app:settingsChanged'));
        window.dispatchEvent(new CustomEvent('app:aiModelProgress', { detail: { pct: 100, status: 'ready', model: loadedModel } }));
        updateActiveModelBadgeInTable(loadedModel);
        
        if (modalDownloadProgress) modalDownloadProgress.style.display = 'none';
        const logProgressRow = document.getElementById('logDownloadProgressRow');
        if (logProgressRow) {
          logProgressRow.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; color: var(--success-color, #10b981); ">
              <span>[AI Model Download] Complete ✓ (${modelShortName} initialized offline)</span>
              <span style="background: rgba(16,185,129,0.2); padding: 1px 8px; border-radius: 10px; font-size: 0.7rem;">100% READY</span>
            </div>
          `;
        }
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
        setLedStatus('ai', 'error', `AI Model Error: ${error}`);
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
