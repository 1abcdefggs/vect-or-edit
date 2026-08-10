import { getQuickMatches } from './dictionary.js';
import { i18n } from './i18n.js';

let debounceTimer = null;
let backendTimer = null;
let monacoContentWidget = null;
const resultsList = document.getElementById('vectorResultsList');
let currentResults = [];

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
} catch(e) {
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

  const topResult = results[0];
  // Ensure robust rendering even if properties are missing
  const domNode = document.createElement('div');
  domNode.innerHTML = `
    <div style="background: var(--bg-card); border: 1px solid var(--accent-color); padding: 8px; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 50; display: flex; flex-direction: column; gap: 4px; color: white;">
      <div style="display: flex; justify-content: space-between; gap: 12px; align-items: center;">
        <span class="item-code" style="background: var(--item-code-bg); color: var(--item-code-text); padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">${topResult.id || ''}</span>
        <span style="color: var(--success-color); font-size: 0.75rem;">${(topResult.score * 100).toFixed(1)}%</span>
      </div>
      <div style="font-weight: bold; font-size: 0.9rem;">${topResult.name || ''}</div>
    </div>
  `;

  monacoContentWidget = {
    getId: () => 'vector.suggestion.widget',
    getDomNode: () => domNode,
    getPosition: () => {
      return {
        position: {
          lineNumber: range.startLineNumber,
          column: range.startColumn
        },
        preference: [monacoInstance.editor.ContentWidgetPositionPreference.ABOVE, monacoInstance.editor.ContentWidgetPositionPreference.BELOW]
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
