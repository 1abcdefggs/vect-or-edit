import { showSelectionPopoverMenu, removeContextMenu } from '../editor/ui/contextMenuManager.js';
import { getQuickMatches } from './dictionary.js';
import { STORAGE_KEYS, TIMINGS, DEFAULTS } from '../core/constants.js';

import { 
  initSearchUi, 
  resetVectorSearchResultsUi, 
  setVectorIconActive, 
  getSearchLimit, 
  getMinScore,
  getResultsListEl,
  getSkeletonLoadingHtml,
  renderResults,
  getCurrentResults
} from './searchUi.js';

import { initLocalAiWorker, getVectorFromWorker } from './searchLocalAi.js';
import { fetchAiSuggestions } from './searchProviders.js';
import { showMonacoWidget } from './searchWidget.js';

let debounceTimer = null;
let backendTimer = null;

export { setVectorIconActive };

export function resetVectorSearchResults() {
  resetVectorSearchResultsUi(debounceTimer, backendTimer);
  debounceTimer = null;
  backendTimer = null;
}

export function initVectorSearch() {
  initSearchUi();
  initLocalAiWorker(getCurrentResults);
  
  document.addEventListener('click', () => removeContextMenu());
  document.addEventListener('contextmenu', (e) => {
    // context menu manager logic
    if (window.activeContextMenu && !window.activeContextMenu.contains(e.target)) {
      removeContextMenu();
    }
  });
}

export function initVectorSearchForBasicEditor(editorInput) {
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

  editorInput.addEventListener('contextmenu', (e) => {
    removeContextMenu();
    let start = editorInput.selectionStart;
    let end = editorInput.selectionEnd;

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

export function triggerSearchAndRender(query) {
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
      const isAiSetup = localStorage.getItem(STORAGE_KEYS.AI_SETUP_COMPLETED) === 'true';
      if (!isAiSetup) {
        renderResults(quickResults, false);
        return;
      }

      if (provider === 'gemini' || provider === 'openai' || provider === 'claude') {
        const suggestion = await fetchAiSuggestions(query, provider);
        if (suggestion) {
          renderResults([suggestion, ...quickResults], false);
          return;
        }
      }

      // 4. Local Embeddings + Rust HNSW Flow
      if (provider === 'local' && window.engineAPI && window.engineAPI.searchVector) {
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

export function triggerMonacoVectorSearch(query, selectionRange, targetEditor, monacoInstance) {
  triggerSearchAndRender(query);

  const quickResults = getQuickMatches(query, 5);
  if (quickResults && quickResults.length > 0) {
    showMonacoWidget(quickResults, selectionRange, targetEditor, monacoInstance);
  }

  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(async () => {
    try {
      const isAiSetup = localStorage.getItem(STORAGE_KEYS.AI_SETUP_COMPLETED) === 'true';
      if (!isAiSetup) return;

      const provider = localStorage.getItem(STORAGE_KEYS.AI_PROVIDER) || DEFAULTS.AI_PROVIDER;

      if (provider === 'local' && window.engineAPI && window.engineAPI.searchVector) {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1500));
        const vector = await Promise.race([getVectorFromWorker(query), timeoutPromise]);
        const response = await window.engineAPI.searchVector(vector);
        if (response.success && response.data.length > 0) {
          showMonacoWidget(response.data, selectionRange, targetEditor, monacoInstance);
        }
      }

      const invokeIpc = window.electronAPI?.invoke ?? window.ipcRenderer?.invoke;
      if (invokeIpc) {
        let context;
        if (targetEditor) {
          try {
            const sel = targetEditor.getSelection();
            const model = targetEditor.getModel();
            if (sel && model) {
              const ctxRange = {
                startLineNumber: Math.max(1, sel.startLineNumber - 3),
                startColumn: 1,
                endLineNumber: Math.min(model.getLineCount(), sel.endLineNumber + 3),
                endColumn: model.getLineMaxColumn(Math.min(model.getLineCount(), sel.endLineNumber + 3))
              };
              context = model.getValueInRange(ctxRange);
            }
          } catch { /* ignore */ }
        }

        const semRes = await invokeIpc('semantics:query', query, context);
        if (semRes?.success && semRes.data) {
          const { alerts = [], matches = [] } = semRes.data;

          if (alerts.length > 0) {
            const panel = document.getElementById('vectorResultsList');
            if (panel) {
              const alertHtml = alerts.map(a => `
                <div class="semantic-alert semantic-alert--${(a.severity || 'warning').toLowerCase()}" style="border-left:3px solid ${a.severity === 'Error' ? '#ef4444' : '#f59e0b'};padding:6px 10px;margin:4px 0;border-radius:4px;background:rgba(0,0,0,0.25);font-size:0.78rem;">
                  <strong>[${a.severity}]</strong> ${a.message}
                </div>`).join('');
              panel.insertAdjacentHTML('afterbegin', alertHtml);
            }
          }

          if (matches.length > 0) {
            const notInWidget = matches.filter(m => !quickResults.some(q => q.id === m.id));
            if (notInWidget.length > 0) {
              showMonacoWidget(notInWidget, selectionRange, targetEditor, monacoInstance);
            }
          }
        }
      }
    } catch (err) {
      console.warn('Vector computation skipped/timed out, using fast results:', err);
    }
  }, 300);
}

if (typeof window !== 'undefined') {
  window.addEventListener('app:directVectorSearch', (e) => {
    const query = e.detail?.query;
    if (query) {
      triggerSearchAndRender(query);
    }
  });
}
