import { getQuickMatches } from './dictionary.js';
import { i18n, t } from './i18n.js';
import { setLedStatus } from './renderer.js';
import { icons } from './icons.js';
import { insertTextIntoEditor, saveTextToFile } from './editorManager.js';
import { STORAGE_KEYS, TIMINGS, DEFAULTS } from './constants.js';

let debounceTimer = null;
let backendTimer = null;
let monacoContentWidget = null;
let lastRawResults = [];
let currentResults = [];

function getResultsListEl() {
  return typeof document !== 'undefined' ? document.getElementById('vectorResultsList') : null;
}

function getIconVectorEl() {
  return typeof document !== 'undefined' ? document.getElementById('iconNeuroContainer') : null;
}

export function setVectorIconActive(active) {
  const iconEl = getIconVectorEl();
  if (iconEl) {
    if (active) {
      iconEl.classList.add('active');
    } else {
      iconEl.classList.remove('active');
    }
  }
}

export function resetVectorSearchResults() {
  currentResults = [];
  lastRawResults = [];
  setVectorIconActive(false);
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (backendTimer) {
    clearTimeout(backendTimer);
    backendTimer = null;
  }
  const resultsList = getResultsListEl();
  if (resultsList) {
    resultsList.innerHTML = '';
  }
  const btnCopyAll = document.getElementById('btnCopyAllResults');
  if (btnCopyAll) {
    btnCopyAll.style.display = 'none';
  }
  removeContextMenu();
}

export function initVectorSearch() {
  if (typeof document === 'undefined') return;

  document.getElementById('btnCopyAllResults')?.addEventListener('click', () => {
    if (currentResults.length > 0) {
      const rawJsonStr = JSON.stringify(currentResults, null, 2);
      navigator.clipboard.writeText(rawJsonStr);

      // Visual feedback
      const btn = document.getElementById('btnCopyAllResults');
      if (btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = icons.checkGreen;
        setTimeout(() => { btn.innerHTML = originalText; }, 1500);
      }
    }
  });

  const numMinScoreInput = document.getElementById('numMinScore');
  const selSearchLimitInput = document.getElementById('selSearchLimit');
  if (numMinScoreInput) {
    numMinScoreInput.addEventListener('input', reRenderWithCurrentResults);
  }
  if (selSearchLimitInput) {
    selSearchLimitInput.addEventListener('change', reRenderWithCurrentResults);
  }

  const chkFullMeta = document.getElementById('chkShowFullMetadata');
  if (chkFullMeta) {
    chkFullMeta.checked = showFullMetadata;
    chkFullMeta.addEventListener('change', (e) => {
      showFullMetadata = e.target.checked;
      localStorage.setItem(STORAGE_KEYS.SHOW_FULL_METADATA, showFullMetadata ? 'true' : 'false');
      reRenderWithCurrentResults();
    });
  }

  document.addEventListener('click', () => removeContextMenu());
  document.addEventListener('contextmenu', (e) => {
    if (activeContextMenu && !activeContextMenu.contains(e.target)) {
      removeContextMenu();
    }
  });
}

let isLocalAiReady = false;
let isLocalAiDownloading = false;

window.addEventListener('app:requestLocalAiInit', () => {
  if (isLocalAiReady || isLocalAiDownloading) return;
  isLocalAiDownloading = true;
  if (embeddingWorker) {
    embeddingWorker.postMessage({ type: 'init' });
  }
});

// Initialize Transformers.js Worker
let embeddingWorker = null;
try {
  embeddingWorker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  embeddingWorker.addEventListener('message', (e) => {
    const resultsList = document.getElementById('vectorResultsList');
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

      // Mirror download progress directly into bottom system log panel
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
            <div style="display: flex; align-items: center; gap: 6px; font-weight: 600;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; animation: pulse 1.5s infinite;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>[AI Model Download] ${fileName}</span>
            </div>
            <span style="font-weight: 700; color: #fff; background: rgba(56,189,248,0.25); padding: 1px 8px; border-radius: 10px;">${pct}%</span>
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
      setLedStatus('ai', true, '7. AI Model (multilingual-e5-small): Ready');
      window.dispatchEvent(new CustomEvent('app:settingsChanged'));
      window.dispatchEvent(new CustomEvent('app:aiModelProgress', { detail: { pct: 100, status: 'ready' } }));
      
      if (modalDownloadProgress) modalDownloadProgress.style.display = 'none';
      const logProgressRow = document.getElementById('logDownloadProgressRow');
      if (logProgressRow) {
        logProgressRow.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; color: var(--success-color, #10b981); font-weight: 700;">
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
      if (currentResults && currentResults.length > 0) {
        renderResults(currentResults, false);
      }
    }
  });
} catch (e) {
  console.error("Worker initialization failed", e);
}

function getVectorFromWorker(text) {
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

let activeContextMenu = null;

export function removeContextMenu() {
  if (activeContextMenu) {
    activeContextMenu.remove();
    activeContextMenu = null;
  }
  const menus = document.querySelectorAll('.custom-context-menu, .floating-selection-menu');
  menus.forEach(m => m.remove());
}

export function showSelectionPopoverMenu(x, y, selectedText, onSelectCallback) {
  removeContextMenu();
  if (!selectedText || !selectedText.trim()) return;

  const mode = localStorage.getItem(STORAGE_KEYS.SUGGEST_TRIGGER_MODE) || DEFAULTS.SUGGEST_TRIGGER_MODE;
  if (mode === 'manual') return;

  const menu = document.createElement('div');
  menu.className = 'custom-context-menu floating-selection-menu';
  
  // Calculate position avoiding covering the selection
  const menuWidth = 190;
  const menuHeight = 72;
  const margin = 12;

  let left = x - Math.floor(menuWidth / 2);
  let top = y - menuHeight - margin; // Default: above selection

  // Screen boundary guards
  if (left < 10) left = 10;
  if (left + menuWidth > window.innerWidth - 10) {
    left = window.innerWidth - menuWidth - 10;
  }
  // If too close to top bar, flip to below selection
  if (top < 90) {
    top = y + margin + 18;
  }

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;

  // 1. AI Suggest Button (Vector Search)
  const btnSuggest = document.createElement('button');
  btnSuggest.className = 'custom-context-menu-item';
  btnSuggest.innerHTML = `
    ${icons.search}
    <span>${t('suggest_context_menu') || "AI Suggest (Vector Search)"}</span>
  `;
  btnSuggest.addEventListener('click', (e) => {
    e.stopPropagation();
    removeContextMenu();
    triggerSearchAndRender(selectedText);
    if (onSelectCallback) onSelectCallback('suggest');
  });
  menu.appendChild(btnSuggest);

  // 2. Search with Google (External Browser)
  const btnSearchGoogle = document.createElement('button');
  btnSearchGoogle.className = 'custom-context-menu-item';
  btnSearchGoogle.style.display = 'flex';
  btnSearchGoogle.style.alignItems = 'center';
  btnSearchGoogle.style.justifyContent = 'space-between';
  btnSearchGoogle.style.gap = '6px';
  btnSearchGoogle.innerHTML = `
    <div style="display: flex; align-items: center; gap: 6px;">
      ${icons.google}
      <span style="font-weight: 500;">${t('action_google_search') || "Search with Google"}</span>
    </div>
    ${icons.externalLink}
  `;
  btnSearchGoogle.addEventListener('click', (e) => {
    e.stopPropagation();
    removeContextMenu();
    const queryUrl = `https://www.google.com/search?q=${encodeURIComponent(selectedText.trim())}`;
    if (window.engineAPI && window.engineAPI.openExternal) {
      window.engineAPI.openExternal(queryUrl);
    } else {
      window.open(queryUrl, '_blank');
    }
  });
  menu.appendChild(btnSearchGoogle);

  document.body.appendChild(menu);
  activeContextMenu = menu;
}

export function initVectorSearchForBasicEditor(editorInput) {
  // Mouseup auto-selection trigger
  editorInput.addEventListener('mouseup', (e) => {
    const mode = localStorage.getItem(STORAGE_KEYS.SUGGEST_TRIGGER_MODE) || DEFAULTS.SUGGEST_TRIGGER_MODE;
    if (mode !== 'selection') return;

    setTimeout(() => {
      const start = editorInput.selectionStart;
      const end = editorInput.selectionEnd;
      if (start !== end) {
        const selectedText = editorInput.value.substring(start, end).trim();
        if (selectedText.length > 0) {
          showSelectionPopoverMenu(e.pageX, e.pageY - 40, selectedText);
        }
      }
    }, 50);
  });

  // Right-click context menu for Basic Editor
  editorInput.addEventListener('contextmenu', (e) => {
    removeContextMenu();

    let start = editorInput.selectionStart;
    let end = editorInput.selectionEnd;

    // If no text is selected, automatically expand selection to the word under cursor
    if (start === end) {
      const text = editorInput.value;
      while (start > 0 && /[^\\s]/.test(text[start - 1])) start--;
      while (end < text.length && /[^\\s]/.test(text[end])) end++;
      if (start !== end) {
        editorInput.setSelectionRange(start, end);
      }
    }

    if (start !== end || editorInput.selectionStart !== editorInput.selectionEnd) {
      start = editorInput.selectionStart;
      end = editorInput.selectionEnd;
      const selectedText = editorInput.value.substring(start, end).trim();
      if (selectedText.length > 0) {
        e.preventDefault();
        showSelectionPopoverMenu(e.pageX, e.pageY, selectedText);
      }
    }
  });

  // Shortcut key Alt+S or Ctrl+Shift+S
  editorInput.addEventListener('keydown', (e) => {
    if ((e.altKey && (e.key === 's' || e.key === 'S')) || (e.ctrlKey && e.shiftKey && (e.key === 's' || e.key === 'S'))) {
      const start = editorInput.selectionStart;
      const end = editorInput.selectionEnd;
      if (start !== end) {
        const selectedText = editorInput.value.substring(start, end).trim();
        if (selectedText.length > 0) {
          e.preventDefault();
          triggerSearchAndRender(selectedText);
        }
      }
    }
  });
}

export function triggerMonacoVectorSearch(query, selectionRange, targetEditor, monacoInstance) {
  triggerSearchAndRender(query);

  const quickResults = getQuickMatches(query, 5);
  if (quickResults && quickResults.length > 0) {
    showMonacoWidget(quickResults, selectionRange, targetEditor, monacoInstance);
  }

  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(async () => {
    try {
      if (window.engineAPI && window.engineAPI.searchVector) {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1500));
        const vector = await Promise.race([getVectorFromWorker(query), timeoutPromise]);
        const response = await window.engineAPI.searchVector(vector);
        if (response.success && response.data.length > 0) {
          showMonacoWidget(response.data, selectionRange, targetEditor, monacoInstance);
        }
      }
    } catch (err) {
      console.warn('Vector computation skipped/timed out, using fast results:', err);
    }
  }, 300);
}

function getSkeletonLoadingHtml(label) {
  return `
    <div class="loading-state">
      <div class="loading-header">
        <div class="spinner"></div>
        <span>${label || i18n.vector_computing || "Vectorizing..."}</span>
      </div>
      <div class="neural-glow-line"></div>
    </div>
  `;
}

function getSearchLimit() {
  const sel = document.getElementById('selSearchLimit');
  return sel ? (parseInt(sel.value, 10) || 5) : 5;
}

function getMinScore() {
  const num = document.getElementById('numMinScore');
  return num ? ((parseFloat(num.value) || DEFAULTS.MIN_SCORE_PCT) / 100.0) : (DEFAULTS.MIN_SCORE_PCT / 100.0);
}

function triggerSearchAndRender(query) {
  setVectorIconActive(true);
  const limit = getSearchLimit();
  const minScore = getMinScore();
  const provider = localStorage.getItem(STORAGE_KEYS.AI_PROVIDER) || DEFAULTS.AI_PROVIDER;

  const quickResults = getQuickMatches(query, limit).filter(r => (r.score || 0) >= minScore);
  const resultsList = getResultsListEl();
  if (quickResults.length > 0) {
    renderResults(quickResults, true);
  } else if (resultsList) {
    resultsList.innerHTML = getSkeletonLoadingHtml();
  }

  if (backendTimer) clearTimeout(backendTimer);
  backendTimer = setTimeout(async () => {
    try {
      // 1. Google Gemini AI Provider Flow
      if (provider === 'gemini') {
        const apiKey = localStorage.getItem(STORAGE_KEYS.GEMINI_API_KEY);
        const model = localStorage.getItem(STORAGE_KEYS.GEMINI_MODEL) || DEFAULTS.GEMINI_MODEL;
        if (window.engineAPI && window.engineAPI.geminiSemanticSuggest && apiKey) {
          const prompt = `Analyze this query/phrase and suggest the best matching domain definitions or structured draft:\nQuery: "${query}"`;
          const geminiRes = await window.engineAPI.geminiSemanticSuggest({ prompt, apiKey, model });
          if (geminiRes && geminiRes.success && geminiRes.text) {
            const geminiCardItem = {
              id: 'gemini-ai-suggestion',
              name: `Gemini (${model.replace('gemini-', '')}) Suggestion`,
              score: 0.99,
              description: geminiRes.text,
              provider: 'Google Gemini'
            };
            renderResults([geminiCardItem, ...quickResults], false);
            return;
          }
        }
      }

      // 2. OpenAI Provider Flow
      if (provider === 'openai') {
        const apiKey = localStorage.getItem(STORAGE_KEYS.OPENAI_API_KEY);
        const model = localStorage.getItem(STORAGE_KEYS.OPENAI_MODEL) || DEFAULTS.OPENAI_MODEL;
        if (window.engineAPI && window.engineAPI.openaiSemanticSuggest && apiKey) {
          const prompt = `Analyze this query/phrase and suggest the best matching domain definitions or structured draft:\nQuery: "${query}"`;
          const openaiRes = await window.engineAPI.openaiSemanticSuggest({ prompt, apiKey, model });
          if (openaiRes && openaiRes.success && openaiRes.text) {
            const openaiCardItem = {
              id: 'openai-ai-suggestion',
              name: `OpenAI (${model}) Suggestion`,
              score: 0.99,
              description: openaiRes.text,
              provider: 'OpenAI'
            };
            renderResults([openaiCardItem, ...quickResults], false);
            return;
          }
        }
      }

      // 3. Claude AI Provider Flow
      if (provider === 'claude') {
        const apiKey = localStorage.getItem(STORAGE_KEYS.CLAUDE_API_KEY);
        const model = localStorage.getItem(STORAGE_KEYS.CLAUDE_MODEL) || DEFAULTS.CLAUDE_MODEL;
        if (window.engineAPI && window.engineAPI.claudeSemanticSuggest && apiKey) {
          const prompt = `Analyze this query/phrase and suggest the best matching domain definitions or structured draft:\nQuery: "${query}"`;
          const claudeRes = await window.engineAPI.claudeSemanticSuggest({ prompt, apiKey, model });
          if (claudeRes && claudeRes.success && claudeRes.text) {
            const claudeCardItem = {
              id: 'claude-ai-suggestion',
              name: `Claude (${model.includes('haiku') ? 'Haiku' : 'Sonnet'}) Suggestion`,
              score: 0.99,
              description: claudeRes.text,
              provider: 'Anthropic Claude'
            };
            renderResults([claudeCardItem, ...quickResults], false);
            return;
          }
        }
      }

      // 4. Local Embeddings + Rust HNSW Flow
      if (window.engineAPI && window.engineAPI.searchVector) {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), TIMINGS.WORKER_TIMEOUT_MS));
        const vector = await Promise.race([getVectorFromWorker(query), timeoutPromise]);
        const queryLimit = Math.max(limit, 8);
        const response = await window.engineAPI.searchVector(vector, queryLimit);
        if (response && response.success && Array.isArray(response.data) && response.data.length > 0) {
          const filtered = response.data.filter(r => (r.score || 0) >= minScore);
          const finalResults = filtered.length >= 3 ? filtered : response.data.slice(0, Math.min(queryLimit, Math.max(3, filtered.length)));
          renderResults(finalResults, false);
          return;
        }
      }
      renderResults(quickResults, false);
    } catch (err) {
      console.warn('AI suggestion fallback used:', err);
      renderResults(quickResults, false);
    }
  }, TIMINGS.SEARCH_DEBOUNCE_MS);
}

// Schema-Agnostic Title & Description Resolvers (International Standard)
function resolveItemTitle(r) {
  return r.title || r.name || r.label || r.prefLabel || r.term || r.text || '';
}

function resolveItemCode(r) {
  return r.code || r.id || r.key || r['@id'] || '';
}

function resolveItemDescription(r) {
  let desc = r.description || r.comment || r.summary || r.definition || '';
  if (!desc || typeof desc !== 'string') return '';

  const code = resolveItemCode(r);
  const title = resolveItemTitle(r);

  // Schema-Agnostic Generic Prefix Trimmer (Handles "CODE: ...", "PREFIX: CODE ...", "TITLE - ...")
  let trimmed = desc;
  if (code) {
    const codeRegex = new RegExp(`^([^:]+:\\s*)?${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s:\\-–—]+`, 'i');
    trimmed = trimmed.replace(codeRegex, '').trim();
  }
  if (title && trimmed.toLowerCase().startsWith(title.toLowerCase())) {
    trimmed = trimmed.substring(title.length).replace(/^[\s:\\-–—]+/, '').trim();
  }

  return trimmed || desc;
}

// Persistent preference for full metadata display
let showFullMetadata = typeof localStorage !== 'undefined' ? (localStorage.getItem(STORAGE_KEYS.SHOW_FULL_METADATA) === 'true') : false;
function renderSingleCard(r, isPreliminary = false) {
  const title = resolveItemTitle(r);
  const code = resolveItemCode(r);
  const desc = resolveItemDescription(r);
  const score = typeof r.score === 'number' ? r.score : 0;
  const scorePct = Math.round(score * 100);
  const metaObj = r.metadata || {};
  const tooltipParts = [];
  let metadataHtml = '';

  for (const [k, v] of Object.entries(metaObj)) {
    if (v !== undefined && v !== null && v !== '') {
      const valStr = typeof v === 'object' ? JSON.stringify(v) : String(v);
      tooltipParts.push(`${k}: ${valStr}`);
    }
  }

  const reservedKeys = new Set(['id', 'code', 'key', '@id', 'name', 'title', 'label', 'prefLabel', 'term', 'text', 'score', 'vector', 'description', 'comment', 'summary', 'definition', 'metadata']);
  for (const [k, v] of Object.entries(r)) {
    if (!reservedKeys.has(k) && v !== undefined && v !== null && v !== '') {
      const valStr = typeof v === 'object' ? JSON.stringify(v) : String(v);
      tooltipParts.push(`${k}: ${valStr}`);
    }
  }

  if (showFullMetadata && tooltipParts.length > 0) {
    metadataHtml = `<div class="metadata-grid" style="margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 3px;">`;
    for (const part of tooltipParts) {
      metadataHtml += `<div class="item-subtitle" style="font-size: 0.75rem; line-height: 1.35; color: var(--text-muted);">${part}</div>`;
    }
    metadataHtml += `</div>`;
  }

  const tooltip = tooltipParts.join('\n').replace(/"/g, '&quot;');
  const isCodePresent = Boolean(code);
  const insertPayload = (isCodePresent && !title.includes(code)) ? `${title} (${code})` : title;
  const btnInsertText = t('btn_insert') || "Insert";

  // Register global helper if not already defined
  if (typeof window !== 'undefined' && !window.__copyVectorCardJson) {
    window.__copyVectorCardJson = (btn, encodedJson) => {
      try {
        const decoded = decodeURIComponent(encodedJson);
        navigator.clipboard.writeText(decoded);
        const originalHtml = btn.innerHTML;
        btn.innerHTML = icons.checkGreen;
        setTimeout(() => {
          btn.innerHTML = originalHtml;
        }, 1500);
      } catch (err) {
        console.warn('Copy failed:', err);
      }
    };
  }

  const encodedJson = encodeURIComponent(JSON.stringify(r, null, 2));

  return `
    <div class="result-card vector-widget-card" data-insert-text="${insertPayload.replace(/"/g, '&quot;')}" title="${tooltip}" style="padding: 6px 8px; margin-bottom: 6px; border-radius: 6px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); cursor: pointer; position: relative; overflow: hidden; transition: all 0.2s ease; ${isPreliminary ? 'opacity: 0.85; border-left: 3px solid #818cf8;' : ''}">
      <div class="score-progress-bar" style="width: ${scorePct}%;"></div>
      <!-- Line 1: Code + Score + Title (Left) and Action Buttons (Right) -->
      <div class="card-header" style="position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; min-width: 0; flex: 1;">
          ${code ? `<span class="item-code" style="flex-shrink: 0; font-family: monospace; font-size: 0.7rem; padding: 1px 5px; border-radius: 3px; background: rgba(56, 189, 248, 0.15); color: var(--accent-color, #38bdf8); font-weight: 700;">${code}</span>` : ''}
          <span class="similarity-score" style="flex-shrink: 0; font-size: 0.72rem; font-weight: 800; color: #10b981;">${isPreliminary ? (t('vector_computing') || "Computing...") : `${scorePct}%`}</span>
          ${title ? `<span class="item-title" style="font-size: 0.86rem; font-weight: 700; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${title}">${title}</span>` : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
          <button class="btn-item-insert" onclick="event.stopPropagation(); window.__insertVectorItem && window.__insertVectorItem('${insertPayload.replace(/'/g, "\\'")}');" style="background: rgba(129,140,248,0.15); border: 1px solid rgba(129,140,248,0.4); color: var(--accent-color); border-radius: 4px; padding: 1px 6px; font-size: 0.68rem; font-weight: bold; cursor: pointer;" title="${btnInsertText}">
            ${btnInsertText}
          </button>
          <button onclick="event.stopPropagation(); window.__copyVectorCardJson && window.__copyVectorCardJson(this, '${encodedJson}');" style="background: none; border: none; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; padding: 2px;" title="Copy JSON">
            ${icons.copy}
          </button>
        </div>
      </div>
      <!-- Line 2: Description & Extended Metadata -->
      <div style="position: relative; z-index: 1; margin-top: 3px;">
        ${desc ? `<div class="item-desc" style="font-size: 0.75rem; line-height: 1.35; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${desc}">${desc}</div>` : ''}
        ${metadataHtml}
      </div>
    </div>`;
}

function renderResults(results, isPreliminary = false) {
  currentResults = results || [];
  if (!isPreliminary) lastRawResults = currentResults;

  const resultsList = getResultsListEl();
  if (!resultsList) return;

  if (!results || results.length === 0) {
    setVectorIconActive(false);
    resultsList.innerHTML = `<div class="empty-state">${t('vector_no_match')}</div>`;
    return;
  }
  setVectorIconActive(true);

  // Dynamic Category Grouping - Schema & Category Driven (Domain-Agnostic)
  const categoryGroups = new Map();

  for (const r of results) {
    const rawCat = r.category || r.metadata?.category || r.type || r.metadata?.type || '';
    const catName = rawCat ? String(rawCat) : (t('sec_general') || 'Knowledge Items');

    if (!categoryGroups.has(catName)) {
      categoryGroups.set(catName, []);
    }
    categoryGroups.get(catName).push(r);
  }

  // Build Dynamic Sections HTML
  let html = '';

  for (const [groupName, items] of categoryGroups.entries()) {
    html += `
    <div class="inspector-collapsible-section open">
      <div class="inspector-section-header" onclick="this.parentElement.classList.toggle('open')">
        <span class="inspector-section-title">
          <span>${groupName}</span>
          <span class="inspector-section-badge">${items.length}</span>
        </span>
        <span class="inspector-arrow" style="display: flex; align-items: center;">
          ${icons.chevronDown}
        </span>
      </div>
      <div class="inspector-section-body">
        ${items.map(r => renderSingleCard(r, isPreliminary)).join('')}
      </div>
    </div>`;
  }

  resultsList.innerHTML = html;

  // Smart display for JSON Copy button
  const btnCopyAll = document.getElementById('btnCopyAllResults');
  if (btnCopyAll) {
    btnCopyAll.style.display = (results && results.length > 0) ? 'inline-flex' : 'none';
  }

  // Attach card click to insert into editor
  const cards = resultsList.querySelectorAll('.vector-widget-card');
  cards.forEach(c => {
    c.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
      const text = c.getAttribute('data-insert-text');
      if (text) {
        insertTextIntoEditor(text);
      }
    });
  });
}

// Global direct search event listener (for Console AI command)
if (typeof window !== 'undefined') {
  window.addEventListener('app:directVectorSearch', (e) => {
    const query = e.detail?.query;
    if (query) {
      triggerSearchAndRender(query);
    }
  });
}

// Global hook for inline insert button
if (typeof window !== 'undefined') {
  window.__insertVectorItem = (text) => {
    insertTextIntoEditor(text);
  };
}

function showMonacoWidget(results, range, targetEditor, monacoInstance) {
  if (monacoContentWidget) {
    targetEditor.removeContentWidget(monacoContentWidget);
  }

  const domNode = document.createElement('div');
  domNode.style.cssText = "background: var(--bg-secondary); border: 1px solid var(--accent-color); border-radius: 6px; box-shadow: 0 4px 12px var(--modal-shadow); z-index: 50; display: flex; flex-direction: column; color: var(--text-main); min-width: 350px; max-width: 500px;";

  let isExpanded = false;
  const topN = 3;

  function renderWidgetContent() {
    const visibleResults = isExpanded ? results : results.slice(0, topN);
    const hiddenCount = Math.max(0, results.length - topN);
    const countText = isExpanded ? results.length : Math.min(topN, results.length);
    const headerTitle = t('widget_suggest_header', { count: countText });

    let html = `
      <div style="padding: 8px 12px; background: var(--hover-bg); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 0.8rem; font-weight: bold; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
          ${icons.search}
          <span>${headerTitle}</span>
        </span>
      </div>
      <div style="max-height: 250px; overflow-y: auto; display: flex; flex-direction: column;">
    `;

    visibleResults.forEach((r, index) => {
      const scorePct = (r.score * 100).toFixed(1);
      const code = resolveItemCode(r);
      const title = resolveItemTitle(r);

      let tooltipParts = [];
      const reservedKeys = new Set(['id', 'code', 'key', '@id', 'name', 'title', 'label', 'prefLabel', 'term', 'text', 'score', 'vector']);
      for (let k in r) {
        if (!reservedKeys.has(k) && r[k]) {
          tooltipParts.push(`${k}: ${typeof r[k] === 'object' ? JSON.stringify(r[k]) : r[k]}`);
        }
      }
      const tooltip = tooltipParts.join('\n').replace(/"/g, '&quot;');

      html += `
        <div class="vector-widget-item" data-index="${index}" title="${tooltip}" style="position: relative; padding: 10px 12px; border-bottom: 1px solid var(--border-color); cursor: pointer; display: flex; flex-direction: column; gap: 4px; overflow: hidden; flex-shrink: 0; transition: background 0.2s;" onmouseover="this.style.background='var(--hover-bg)'" onmouseout="this.style.background='transparent'">
          <div style="position: absolute; left: 0; top: 0; bottom: 0; width: ${scorePct}%; background: var(--accent-color); opacity: 0.12; z-index: 0; pointer-events: none;"></div>
          <div style="position: relative; z-index: 1; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
              ${code ? `<span style="background: var(--item-code-bg); color: var(--item-code-text); padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; flex-shrink: 0;">${code}</span>` : ''}
              <span style="font-weight: bold; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</span>
              ${tooltipParts.length > 0 ? `<span style="color: var(--text-muted); font-size: 0.7rem; margin-left: 4px;">(i)</span>` : ''}
            </div>
            <span style="color: var(--success-color); font-size: 0.75rem; font-weight: bold; flex-shrink: 0;">${scorePct}%</span>
          </div>
        </div>
      `;
    });

    html += `</div>`;

    if (!isExpanded && hiddenCount > 0) {
      html += `
        <div id="btnWidgetLoadMore" style="padding: 8px; text-align: center; font-size: 0.8rem; font-weight: bold; color: var(--accent-color); cursor: pointer; background: var(--hover-bg);" onmouseover="this.style.background='var(--active-bg)'" onmouseout="this.style.background='var(--hover-bg)'">
          ${t('loadMoreLabel', { hiddenCount })}
        </div>
      `;
    }

    domNode.innerHTML = html;

    // click insert 
    const items = domNode.querySelectorAll('.vector-widget-item');
    items.forEach((item) => {
      item.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(item.getAttribute('data-index'), 10);
        const selectedResult = visibleResults[idx];
        targetEditor.executeEdits('vectorSearch', [{
          range: range,
          text: selectedResult.name,
          forceMoveMarkers: true
        }]);
        targetEditor.focus();
        if (monacoContentWidget) {
          targetEditor.removeContentWidget(monacoContentWidget);
          monacoContentWidget = null;
        }
      };
    });

    // Load More button
    const loadMoreBtn = domNode.querySelector('#btnWidgetLoadMore');
    if (loadMoreBtn) {
      loadMoreBtn.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        isExpanded = true;
        renderWidgetContent();
      };
    }
  }

  renderWidgetContent();

  monacoContentWidget = {
    getId: () => 'vector.suggestion.widget',
    getDomNode: () => domNode,
    getPosition: () => {
      return {
        position: {
          lineNumber: range.startLineNumber,
          column: range.startColumn
        },
        preference: [monacoInstance.editor.ContentWidgetPositionPreference.BELOW, monacoInstance.editor.ContentWidgetPositionPreference.ABOVE]
      };
    }
  };

  targetEditor.addContentWidget(monacoContentWidget);

  setTimeout(() => {
    const disposable = targetEditor.onMouseDown(() => {
      if (monacoContentWidget) {
        targetEditor.removeContentWidget(monacoContentWidget);
        monacoContentWidget = null;
      }
      disposable.dispose();
    });
  }, 100);
}

function reRenderWithCurrentResults() {
  if (lastRawResults && lastRawResults.length > 0) {
    const minScore = getMinScore();
    const filtered = lastRawResults.filter(r => (r.score || 0) >= minScore);
    renderResults(filtered.length > 0 ? filtered : lastRawResults.slice(0, 1), false);
  }
}
