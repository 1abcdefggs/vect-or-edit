import { setLedStatus } from '../core/statusManager.js';
import { i18n } from '../core/i18n.js';
import { renderResults } from './searchUi.js';

let isLocalAiReady = false;
let isLocalAiDownloading = false;
let embeddingWorker = null;

export function initLocalAiWorker(getCurrentResults) {
  if (typeof window === 'undefined') return;

  window.addEventListener('app:requestLocalAiInit', () => {
    if (isLocalAiReady || isLocalAiDownloading) return;
    isLocalAiDownloading = true;
    if (embeddingWorker) {
      embeddingWorker.postMessage({ type: 'init' });
    }
  });

  try {
    embeddingWorker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    embeddingWorker.addEventListener('message', (e) => {
      const modalDownloadProgress = document.getElementById('modalAiDownloadProgress');
      const modalDownloadFile = document.getElementById('modalAiDownloadFile');
      const modalDownloadPct = document.getElementById('modalAiDownloadPct');
      const modalDownloadBar = document.getElementById('modalAiDownloadBar');
      const localAiStatusBadge = document.getElementById('localAiStatusBadge');
      const btnInitLocalAi = document.getElementById('btnInitLocalAi');

      if (e.data.status === 'initiate' || e.data.status === 'download' || e.data.status === 'progress') {
        const pct = e.data.progress !== undefined ? Math.round(e.data.progress) : 0;
        const fileName = e.data.file || 'AI Model Weights';
        setLedStatus('ai', false, `AI Model: Downloading ${pct}%`);
        window.dispatchEvent(new CustomEvent('app:aiModelProgress', { detail: { pct, fileName, status: e.data.status } }));
        
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
      } else if (e.data.status === 'done' || e.data.status === 'ready') {
        isLocalAiReady = true;
        window.__isLocalAiModelReady = true;
        isLocalAiDownloading = false;
        setLedStatus('ai', true, '6. AI-MODEL: Ready');
        window.dispatchEvent(new CustomEvent('app:settingsChanged'));
        window.dispatchEvent(new CustomEvent('app:aiModelProgress', { detail: { pct: 100, status: 'ready' } }));
        
        if (modalDownloadProgress) modalDownloadProgress.style.display = 'none';
        const logProgressRow = document.getElementById('logDownloadProgressRow');
        if (logProgressRow) {
          logProgressRow.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; color: var(--success-color, #10b981); ">
              <span>[AI Model Download] Complete ✓ (multilingual-e5-small initialized offline)</span>
              <span style="background: rgba(16,185,129,0.2); padding: 1px 8px; border-radius: 10px; font-size: 0.7rem;">100% READY</span>
            </div>
          `;
        }
        if (localAiStatusBadge) {
          localAiStatusBadge.textContent = i18n.local_ai_ready || 'Local AI: Ready (100% Offline)';
          localAiStatusBadge.style.color = 'var(--success-color, #10b981)';
        }
        if (btnInitLocalAi) {
          btnInitLocalAi.style.display = 'none';
        }

        const currentResults = getCurrentResults();
        if (currentResults && currentResults.length > 0) {
          renderResults(currentResults, false);
        }
      } else if (e.data.status === 'error') {
        isLocalAiDownloading = false;
        console.warn("Embedding worker reported error:", e.data.error);
        setLedStatus('ai', false, `AI Model Error: ${e.data.error}`);
        if (btnInitLocalAi) {
          btnInitLocalAi.disabled = false;
          btnInitLocalAi.style.opacity = '1';
        }
        const currentResults = getCurrentResults();
        if (currentResults && currentResults.length > 0) {
          renderResults(currentResults, false);
        }
      }
    });
  } catch (e) {
    console.error("Worker initialization failed", e);
  }
}

export function getVectorFromWorker(text) {
  return new Promise((resolve, reject) => {
    if (!embeddingWorker) return reject(new Error("Worker not initialized"));

    const messageHandler = (e) => {
      if (e.data.status === 'complete') {
        embeddingWorker.removeEventListener('message', messageHandler);
        resolve(e.data.vector);
      } else if (e.data.status === 'error') {
        embeddingWorker.removeEventListener('message', messageHandler);
        reject(new Error(e.data.error));
      }
    };

    embeddingWorker.addEventListener('message', messageHandler);
    embeddingWorker.postMessage({ text });
  });
}
