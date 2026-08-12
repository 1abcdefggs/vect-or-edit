import { getQuickMatches } from './dictionary.js';
import { i18n, t } from './i18n.js';

let debounceTimer = null;
let backendTimer = null;
let monacoContentWidget = null;
const resultsList = document.getElementById('vectorResultsList');
let currentResults = [];
let lastRawResults = [];

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

// Initialize Transformers.js Worker
let embeddingWorker = null;
try {
  embeddingWorker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  embeddingWorker.addEventListener('message', (e) => {
    const resultsList = document.getElementById('vectorResultsList');
    if (!resultsList) return;

    if (e.data.status === 'initiate' || e.data.status === 'download' || e.data.status === 'progress') {
      let loadingContainer = resultsList.querySelector('.loading-state');
      if (!loadingContainer) {
        resultsList.innerHTML = `<div class="loading-state">
          <div class="spinner"></div>
          <span class="progress-text">Downloading AI Model...</span>
        </div>`;
        loadingContainer = resultsList.querySelector('.loading-state');
      }

      const progressText = loadingContainer.querySelector('.progress-text');
      if (progressText) {
        if (e.data.status === 'progress' && e.data.progress !== undefined) {
          progressText.textContent = `Downloading AI Model: ${e.data.file} (${Math.round(e.data.progress)}%)`;
        } else {
          progressText.textContent = `Downloading AI Model: ${e.data.file || 'weights'}...`;
        }
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

export function initVectorSearchForBasicEditor(editorInput) {
  // Listen for text selection instead of typing
  editorInput.addEventListener('mouseup', handleBasicEditorSelection);
  editorInput.addEventListener('keyup', handleBasicEditorSelection);

  function handleBasicEditorSelection() {
    if (editorInput.selectionStart !== editorInput.selectionEnd) {
      const selectedText = editorInput.value.substring(editorInput.selectionStart, editorInput.selectionEnd).trim();
      if (selectedText.length > 2) {
        triggerSearchAndRender(selectedText);
      }
    }
  }
}

export function triggerMonacoVectorSearch(query, selectionRange, targetEditor, monacoInstance) {
  triggerSearchAndRender(query);

  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(async () => {
    try {
      if (window.engineAPI && window.engineAPI.searchVector) {
        const vector = await getVectorFromWorker(query);
        const response = await window.engineAPI.searchVector(vector);
        if (response.success && response.data.length > 0) {
          showMonacoWidget(response.data, selectionRange, targetEditor, monacoInstance);
        }
      }
    } catch (err) {
      console.error('Monaco search error:', err);
    }
  }, 500);
}

function triggerSearchAndRender(query) {
  const quickResults = getQuickMatches(query, 5);
  if (quickResults.length > 0) {
    renderResults(quickResults, true);
  } else {
    resultsList.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <span>${i18n.vector_computing || "Vectorizing..."}</span>
      </div>
    `;
  }

  if (backendTimer) clearTimeout(backendTimer);
  backendTimer = setTimeout(async () => {
    try {
      if (window.engineAPI && window.engineAPI.searchVector) {
        const vector = await getVectorFromWorker(query);
        const response = await window.engineAPI.searchVector(vector);
        if (response.success) {
          renderResults(response.data, false);
        }
      }
    } catch (err) {
      console.error('Error invoking vector search:', err);
      resultsList.innerHTML = `<div class="empty-state" style="color: red; font-size: 0.8rem; word-break: break-all;">Error: ${err.message || err.toString()}</div>`;
    }
  }, 250);
}

function renderResults(results, isPreliminary = false) {
  currentResults = results || [];
  if (!isPreliminary) lastRawResults = currentResults;

  if (!results || results.length === 0) {
    resultsList.innerHTML = `<div class="empty-state">${i18n.vector_no_match || "No matching knowledge found."}</div>`;
    return;
  }

  resultsList.innerHTML = results.map(r => {
    // Generate dynamic metadata HTML
    let metadataHtml = '';
    for (const [key, value] of Object.entries(r)) {
      if (key === 'id' || key === 'score' || key === 'name') continue;
      metadataHtml += `<div class="item-subtitle" style="margin-top: 4px; font-size: 0.8rem; line-height: 1.3;"><strong>${key}:</strong> ${value}</div>`;
    }

    const rawJsonStr = JSON.stringify(r, null, 2).replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/\n/g, "\\n");

    return `
    <div class="result-card" style="${isPreliminary ? 'opacity: 0.85; border-left: 3px solid #818cf8;' : ''}">
      <div class="card-header">
        <div>
          <span class="item-code">${r.id || ''}</span>
          <span class="similarity-score">${isPreliminary ? i18n.vector_computing || "⚡ Immediate Match (Computing...)" : (i18n.vector_similarity || "Similarity: {score}%").replace("{score}", (r.score * 100).toFixed(1))}</span>
        </div>
        <button onclick="navigator.clipboard.writeText('${rawJsonStr}'); const og=this.innerHTML; this.innerHTML='<svg width=\\'16\\' height=\\'16\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' style=\\'color: var(--success-color, #10b981)\\'><polyline points=\\'20 6 9 17 4 12\\'></polyline></svg>'; setTimeout(()=>{this.innerHTML=og},1500);" style="background: none; border: none; cursor: pointer; color: var(--text-muted); display: flex; align-items: center;" title="Copy raw JSON">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
          </svg>
        </button>
      </div>
      ${r.name ? `<div class="item-title">${r.name}</div>` : ''}
      ${metadataHtml}
    </div>
  `}).join('');
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

    let html = `
      <div style="padding: 8px 12px; background: var(--hover-bg); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 0.8rem; font-weight: bold; color: var(--text-muted);">
          🔍 Vector Suggest (${isExpanded ? results.length : Math.min(topN, results.length)} items)
        </span>
      </div>
      <div style="max-height: 250px; overflow-y: auto; display: flex; flex-direction: column;">
    `;

    visibleResults.forEach((r, index) => {
      const scorePct = (r.score * 100).toFixed(1);
      const code = r.icd10_code || r.id || 'N/A';

      let tooltipParts = [];
      for (let k in r) {
        if (k !== 'score' && k !== 'id' && k !== 'name' && r[k]) {
          tooltipParts.push(`${k}: ${r[k]}`);
        }
      }
      const tooltip = tooltipParts.join('\n').replace(/"/g, '&quot;');

      html += `
        <div class="vector-widget-item" data-index="${index}" title="${tooltip}" style="position: relative; padding: 10px 12px; border-bottom: 1px solid var(--border-color); cursor: pointer; display: flex; flex-direction: column; gap: 4px; overflow: hidden; transition: background 0.2s;" onmouseover="this.style.background='var(--hover-bg)'" onmouseout="this.style.background='transparent'">
          <div style="position: absolute; left: 0; top: 0; bottom: 0; width: ${scorePct}%; background: var(--accent-color); opacity: 0.12; z-index: 0; pointer-events: none;"></div>
          <div style="position: relative; z-index: 1; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
              <span style="background: var(--item-code-bg); color: var(--item-code-text); padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; flex-shrink: 0;">${code}</span>
              <span style="font-weight: bold; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${r.name || ''}</span>
              <span style="color: var(--text-muted); font-size: 0.7rem; margin-left: 4px;">(i)</span>
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

// se
const thresholdSlider = document.getElementById('vectorSearchThreshold');
const maxResultsSlider = document.getElementById('vectorSearchMaxResults');

function reRenderWithCurrentResults() {
  renderResults(lastRawResults, false);
}

if (thresholdSlider) {
  thresholdSlider.addEventListener('input', reRenderWithCurrentResults);
}
if (maxResultsSlider) {
  maxResultsSlider.addEventListener('input', reRenderWithCurrentResults);
}
