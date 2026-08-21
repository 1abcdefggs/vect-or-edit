import { getQuickMatches } from './dictionary.js';
import { i18n, t } from './i18n.js';
import { setLedStatus } from './renderer.js';

let debounceTimer = null;
let backendTimer = null;
let monacoContentWidget = null;
const resultsList = document.getElementById('vectorResultsList');
let lastRawResults = [];
let currentResults = [];

export function resetVectorSearchResults() {
  currentResults = [];
  lastRawResults = [];
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (backendTimer) {
    clearTimeout(backendTimer);
    backendTimer = null;
  }
  if (resultsList) {
    resultsList.innerHTML = `<div class="empty-state">${i18n.vector_no_match || "No matching knowledge found."}</div>`;
  }
  removeContextMenu();
}

document.getElementById('btnCopyAllResults')?.addEventListener('click', () => {
  if (currentResults.length > 0) {
    const rawJsonStr = JSON.stringify(currentResults, null, 2);
    navigator.clipboard.writeText(rawJsonStr);

    // Visual feedback
    const btn = document.getElementById('btnCopyAllResults');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--success-color, #10b981)"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    setTimeout(() => { btn.innerHTML = originalText; }, 1500);
  }
});

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
      
      if (modalDownloadProgress) modalDownloadProgress.style.display = 'block';
      if (modalDownloadFile) modalDownloadFile.textContent = `Downloading ${fileName}`;
      if (modalDownloadPct) modalDownloadPct.textContent = `${pct}%`;
      if (modalDownloadBar) modalDownloadBar.style.width = `${pct}%`;
      if (btnInitLocalAi) {
        btnInitLocalAi.disabled = true;
        btnInitLocalAi.style.opacity = '0.6';
      }

      if (resultsList) {
        let progressCard = resultsList.querySelector('.model-progress-card');
        if (!progressCard) {
          resultsList.innerHTML = `
            <div class="model-progress-card">
              <div class="model-progress-header">
                <span class="progress-file">Downloading AI Model...</span>
                <span class="model-progress-pct">${pct}%</span>
              </div>
              <div class="model-progress-track">
                <div class="model-progress-fill" style="width: ${pct}%"></div>
              </div>
            </div>
            <div class="skeleton-card">
              <div class="skeleton-header">
                <div class="skeleton-pill"></div>
                <div class="skeleton-pill-sm"></div>
              </div>
              <div class="skeleton-title"></div>
              <div class="skeleton-subtitle"></div>
            </div>
          `;
          progressCard = resultsList.querySelector('.model-progress-card');
        }

        if (progressCard) {
          const fileEl = progressCard.querySelector('.progress-file');
          const pctEl = progressCard.querySelector('.model-progress-pct');
          const fillEl = progressCard.querySelector('.model-progress-fill');
          if (fileEl) fileEl.textContent = `Downloading ${fileName}`;
          if (pctEl) pctEl.textContent = `${pct}%`;
          if (fillEl) fillEl.style.width = `${pct}%`;
        }
      }
    } else if (e.data.status === 'done' || e.data.status === 'ready') {
      isLocalAiReady = true;
      isLocalAiDownloading = false;
      setLedStatus('ai', true, '7. AI Model (multilingual-e5-small): Ready');
      
      if (modalDownloadProgress) modalDownloadProgress.style.display = 'none';
      if (localAiStatusBadge) {
        localAiStatusBadge.textContent = 'Local AI: Ready (100% Offline)';
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

function removeContextMenu() {
  if (activeContextMenu) {
    activeContextMenu.remove();
    activeContextMenu = null;
  }
}

document.addEventListener('click', () => removeContextMenu());
document.addEventListener('contextmenu', (e) => {
  if (activeContextMenu && !activeContextMenu.contains(e.target)) {
    removeContextMenu();
  }
});

export function showSelectionPopoverMenu(x, y, selectedText, onSelectCallback) {
  removeContextMenu();
  if (!selectedText || !selectedText.trim()) return;

  const mode = localStorage.getItem('vect_suggest_trigger_mode') || 'selection';
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

  // 1. AI Suggest Button
  const btnSuggest = document.createElement('button');
  btnSuggest.className = 'custom-context-menu-item';
  btnSuggest.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
    <span>${i18n.suggest_context_menu || "AI Suggest (Vector Search)"}</span>
  `;
  btnSuggest.addEventListener('click', (e) => {
    e.stopPropagation();
    removeContextMenu();
    triggerSearchAndRender(selectedText);
    if (onSelectCallback) onSelectCallback('suggest');
  });
  menu.appendChild(btnSuggest);

  // 2. Quick Copy Button
  const btnCopy = document.createElement('button');
  btnCopy.className = 'custom-context-menu-item';
  btnCopy.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
    </svg>
    <span>Copy Text</span>
  `;
  btnCopy.addEventListener('click', (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(selectedText);
    removeContextMenu();
  });
  menu.appendChild(btnCopy);

  document.body.appendChild(menu);
  activeContextMenu = menu;
}

export function initVectorSearchForBasicEditor(editorInput) {
  // Mouseup auto-selection trigger
  editorInput.addEventListener('mouseup', (e) => {
    const mode = localStorage.getItem('vect_suggest_trigger_mode') || 'selection';
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
      <div class="skeleton-card">
        <div class="skeleton-header">
          <div class="skeleton-pill"></div>
          <div class="skeleton-pill-sm"></div>
        </div>
        <div class="skeleton-title"></div>
        <div class="skeleton-subtitle"></div>
        <div class="skeleton-subtitle short"></div>
      </div>
      <div class="skeleton-card">
        <div class="skeleton-header">
          <div class="skeleton-pill"></div>
          <div class="skeleton-pill-sm"></div>
        </div>
        <div class="skeleton-title"></div>
        <div class="skeleton-subtitle"></div>
      </div>
    </div>
  `;
}

function getSearchLimit() {
  const sel = document.getElementById('selSearchLimit');
  return sel ? (parseInt(sel.value, 10) || 5) : 5;
}

function getMinScore() {
  const num = document.getElementById('numMinScore');
  return num ? ((parseFloat(num.value) || 70) / 100.0) : 0.70;
}

function triggerSearchAndRender(query) {
  const limit = getSearchLimit();
  const minScore = getMinScore();
  const provider = localStorage.getItem('ai_provider') || 'local';

  const quickResults = getQuickMatches(query, limit).filter(r => (r.score || 0) >= minScore);
  if (quickResults.length > 0) {
    renderResults(quickResults, true);
  } else {
    resultsList.innerHTML = getSkeletonLoadingHtml();
  }

  if (backendTimer) clearTimeout(backendTimer);
  backendTimer = setTimeout(async () => {
    try {
      // 1. Claude AI Provider Flow
      if (provider === 'claude') {
        const apiKey = localStorage.getItem('claude_api_key');
        const model = localStorage.getItem('claude_model') || 'claude-3-5-sonnet-20241022';
        if (window.engineAPI && window.engineAPI.claudeSemanticSuggest && apiKey) {
          const prompt = `Analyze this query/phrase and suggest the best matching domain definitions or structured draft:\nQuery: "${query}"`;
          const claudeRes = await window.engineAPI.claudeSemanticSuggest({ prompt, apiKey, model });
          if (claudeRes && claudeRes.success && claudeRes.text) {
            // Render Claude intelligent suggestion as top card
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

      // 2. Local Embeddings + Rust HNSW Flow
      if (window.engineAPI && window.engineAPI.searchVector) {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000));
        const vector = await Promise.race([getVectorFromWorker(query), timeoutPromise]);
        const response = await window.engineAPI.searchVector(vector, limit);
        if (response && response.success && Array.isArray(response.data) && response.data.length > 0) {
          const filtered = response.data.filter(r => (r.score || 0) >= minScore);
          renderResults(filtered.length > 0 ? filtered : response.data.slice(0, 1), false);
          return;
        }
      }
      renderResults(quickResults, false);
    } catch (err) {
      console.warn('AI suggestion fallback used:', err);
      renderResults(quickResults, false);
    }
  }, 200);
}

// Schema-Agnostic Title & Description Resolvers (International Standard + Medical ICD-10)
function resolveItemTitle(r) {
  return r.name || r.name_ja || r.title || r.label || r.prefLabel || r.term || r.text || '';
}

function resolveItemCode(r) {
  const code = r.icd10_code || r.metadata?.icd10_code || r.code || r.id || r.key || r['@id'] || '';
  if (typeof code === 'string' && code.startsWith('F') && code.length === 4 && !code.includes('.')) {
    return code.substring(0, 3) + '.' + code.substring(3);
  }
  return code;
}

function resolveItemDescription(r) {
  return r.description || r.name_kana || r.comment || r.summary || r.definition || (r.department ? `${r.department} ${r.title || ''}` : '');
}

// Persistent preference for full metadata display
let showFullMetadata = localStorage.getItem('vect_show_full_metadata') === 'true';

const chkFullMeta = document.getElementById('chkShowFullMetadata');
if (chkFullMeta) {
  chkFullMeta.checked = showFullMetadata;
  chkFullMeta.addEventListener('change', (e) => {
    showFullMetadata = e.target.checked;
    localStorage.setItem('vect_show_full_metadata', String(showFullMetadata));
    if (currentResults && currentResults.length > 0) {
      renderResults(currentResults, false);
    }
  });
}

import { insertTextIntoEditor } from './editorManager.js';

function renderSingleCard(r, isPreliminary = false) {
  const title = resolveItemTitle(r);
  const code = resolveItemCode(r);
  const desc = resolveItemDescription(r);
  const scorePct = (r.score * 100).toFixed(1);

  let metadataHtml = '';
  let tooltipParts = [];

  const metaObj = (typeof r.metadata === 'object' && r.metadata !== null) ? r.metadata : {};
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
  const rawJsonStr = JSON.stringify(r, null, 2).replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/\n/g, "\\n");

  const isCodePresent = Boolean(code);
  const insertPayload = (isCodePresent && !title.includes(code)) ? `${title} (${code})` : title;

  const btnInsertText = i18n.btn_insert || "Insert";

    return `
    <div class="result-card vector-widget-card" data-insert-text="${insertPayload.replace(/"/g, '&quot;')}" title="${tooltip}" style="${isPreliminary ? 'opacity: 0.85; border-left: 3px solid #818cf8;' : ''}">
      <div class="score-progress-bar" style="width: ${scorePct}%;"></div>
      <div class="card-header" style="position: relative; z-index: 1;">
        <div style="display: flex; align-items: center; gap: 6px; overflow: hidden;">
          ${code ? `<span class="item-code">${code}</span>` : ''}
          <span class="similarity-score">${isPreliminary ? (i18n.vector_computing || "Computing...") : `${scorePct}%`}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <button class="btn-item-insert" onclick="event.stopPropagation(); window.__insertVectorItem && window.__insertVectorItem('${insertPayload.replace(/'/g, "\\'")}');" style="background: rgba(129,140,248,0.15); border: 1px solid rgba(129,140,248,0.4); color: var(--accent-color); border-radius: 4px; padding: 1px 6px; font-size: 0.68rem; font-weight: bold; cursor: pointer;" title="${btnInsertText}">
            ${btnInsertText}
          </button>
          <button onclick="event.stopPropagation(); navigator.clipboard.writeText('${rawJsonStr}'); const og=this.innerHTML; this.innerHTML='<svg width=\\'14\\' height=\\'14\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' style=\\'color: var(--success-color, #10b981)\\'><polyline points=\\'20 6 9 17 4 12\\'></polyline></svg>'; setTimeout(()=>{this.innerHTML=og},1500);" style="background: none; border: none; cursor: pointer; color: var(--text-muted); display: flex; align-items: center;" title="Copy JSON">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            </svg>
          </button>
        </div>
      </div>
      <div style="position: relative; z-index: 1;">
        ${title ? `<div class="item-title" style="font-size: 0.92rem; font-weight: 700;">${title}</div>` : ''}
        ${desc ? `<div class="item-desc" style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">${desc}</div>` : ''}
        ${metadataHtml}
      </div>
    </div>`;
}

function renderResults(results, isPreliminary = false) {
  currentResults = results || [];
  if (!isPreliminary) lastRawResults = currentResults;

  if (!results || results.length === 0) {
    resultsList.innerHTML = `<div class="empty-state">${i18n.vector_no_match || "No matching knowledge found."}</div>`;
    return;
  }

  // Dynamic Category Grouping - Schema & Category Driven (Domain-Agnostic)
  const categoryGroups = new Map();

  for (const r of results) {
    const rawCat = r.category || r.metadata?.category || r.type || r.metadata?.type || '';
    const catName = rawCat ? String(rawCat) : (i18n.sec_general || 'Knowledge Items');

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
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </span>
      </div>
      <div class="inspector-section-body">
        ${items.map(r => renderSingleCard(r, isPreliminary)).join('')}
      </div>
    </div>`;
  }

  resultsList.innerHTML = html;

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
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
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

const numMinScoreInput = document.getElementById('numMinScore');
const selSearchLimitInput = document.getElementById('selSearchLimit');

function reRenderWithCurrentResults() {
  if (lastRawResults && lastRawResults.length > 0) {
    const minScore = getMinScore();
    const filtered = lastRawResults.filter(r => (r.score || 0) >= minScore);
    renderResults(filtered.length > 0 ? filtered : lastRawResults.slice(0, 1), false);
  }
}

if (numMinScoreInput) {
  numMinScoreInput.addEventListener('input', reRenderWithCurrentResults);
}
if (selSearchLimitInput) {
  selSearchLimitInput.addEventListener('change', reRenderWithCurrentResults);
}
