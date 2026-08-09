import { getQuickMatches } from './dictionary.js';
import { i18n } from './i18n.js';

let debounceTimer = null;
let backendTimer = null;
let monacoContentWidget = null;
const resultsList = document.getElementById('vectorResultsList');

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
        const response = await window.engineAPI.searchVector(query);
        if (response.success && response.data.length > 0) {
          showMonacoWidget(response.data, selectionRange, targetEditor, monacoInstance);
        }
      }
    } catch (err) {
      console.error(err);
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
        const response = await window.engineAPI.searchVector(query);
        if (response.success) {
          renderResults(response.data, false);
        }
      }
    } catch (err) {
      console.error('Error invoking vector search:', err);
    }
  }, 250);
}

function renderResults(results, isPreliminary = false) {
  if (!results || results.length === 0) {
    resultsList.innerHTML = `<div class="empty-state">${i18n.vector_no_match || "No matching knowledge found."}</div>`;
    return;
  }

  resultsList.innerHTML = results.map(r => `
    <div class="result-card" style="${isPreliminary ? 'opacity: 0.85; border-left: 3px solid #818cf8;' : ''}">
      <div class="card-header">
        <span class="item-code">${r.item.code || ''}</span>
        <span class="similarity-score">${isPreliminary ? i18n.vector_computing || "⚡ Immediate Match (Computing...)" : (i18n.vector_similarity || "Similarity: {score}%").replace("{score}", (r.score * 100).toFixed(1))}</span>
      </div>
      <div class="item-title">${r.item.title || ''}</div>
      <div class="item-subtitle">${r.item.subtitle || ''}</div>
    </div>
  `).join('');
}

function showMonacoWidget(results, range, targetEditor, monacoInstance) {
  if (monacoContentWidget) {
    targetEditor.removeContentWidget(monacoContentWidget);
  }

  const topResult = results[0];
  const domNode = document.createElement('div');
  domNode.innerHTML = `
    <div style="background: var(--bg-card); border: 1px solid var(--accent-color); padding: 8px; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 50; display: flex; flex-direction: column; gap: 4px; color: white;">
      <div style="display: flex; justify-content: space-between; gap: 12px; align-items: center;">
        <span class="item-code" style="background: var(--item-code-bg); color: var(--item-code-text); padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">${topResult.item.code || ''}</span>
        <span style="color: var(--success-color); font-size: 0.75rem;">${(topResult.score * 100).toFixed(1)}%</span>
      </div>
      <div style="font-weight: bold; font-size: 0.9rem;">${topResult.item.title || ''}</div>
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
