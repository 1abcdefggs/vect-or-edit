import { getTheme, getFontFamily, getFontSize } from './settings.js';
import { triggerMonacoVectorSearch, showSelectionPopoverMenu } from './vectorSearch.js';
import { allDictEntries } from './dictionary.js';
import { i18n } from './i18n.js';
import { setLedStatus } from './statusManager.js';

let isDiffMode = false;
let monacoEditorInstance = null;
let monacoDiffEditorInstance = null;
let savedVersionText = '';
let linterTimeout = null;
let monaco = null;

// Configure Monaco WebWorker environment safely for Vite & Electron
if (typeof window !== 'undefined') {
  window.MonacoEnvironment = {
    getWorkerUrl: function (_moduleId, _label) {
      const workerCode = `
        self.MonacoEnvironment = {
          baseUrl: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/'
        };
        importScripts('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs/base/worker/workerMain.js');
      `;
      return `data:text/javascript;charset=utf-8,${encodeURIComponent(
        `self.onmessage = () => {};`
      )}`;
    }
  };
}

const monacoContainer = document.getElementById('monacoContainer');

export async function initEditor() {
  if (!monaco) monaco = await import('monaco-editor');

  monacoEditorInstance = monaco.editor.create(monacoContainer, {
    value: '',
    language: 'markdown',
    theme: getTheme(),
    fontSize: getFontSize(),
    fontFamily: getFontFamily(),
    wordWrap: 'on',
    minimap: { enabled: false },
    automaticLayout: true,
    lineNumbersMinChars: 3,
    renderLineHighlight: 'line'
  });

  registerMonacoSuggestAction(monacoEditorInstance, monaco);
  initializeKnowledgeExtensions(monacoEditorInstance, monaco);

  // Hook mouseup on Monaco Editor for auto-selection popover menu
  monacoEditorInstance.onMouseUp((e) => {
    const mode = localStorage.getItem('vect_suggest_trigger_mode') || 'selection';
    if (mode !== 'selection') return;

    setTimeout(() => {
      const selection = monacoEditorInstance.getSelection();
      if (selection && !selection.isEmpty()) {
        const text = monacoEditorInstance.getModel().getValueInRange(selection).trim();
        if (text.length > 0) {
          // Get the start position of selection to place menu cleanly above/below
          const startPos = monacoEditorInstance.getScrolledVisiblePosition({
            lineNumber: selection.startLineNumber,
            column: selection.startColumn
          });
          
          if (startPos) {
            const containerRect = monacoContainer.getBoundingClientRect();
            const posX = containerRect.left + startPos.left;
            const posY = containerRect.top + startPos.top;
            showSelectionPopoverMenu(posX, posY, text);
          } else if (e.event && e.event.posx && e.event.posy) {
            showSelectionPopoverMenu(e.event.posx, e.event.posy, text);
          }
        }
      }
    }, 60);
  });

  // Hook model change for status bar updates
  monacoEditorInstance.onDidChangeModelContent(() => {
    updateStatusBar();
  });
  updateStatusBar();

  setLedStatus('monaco', true, `6. Monaco Editor: Mounted & Ready`);
}

export function updateStatusBar(fileName = null) {
  if (fileName) {
    const docNameEl = document.getElementById('statusDocName');
    if (docNameEl) docNameEl.textContent = fileName;
  }
  if (!monacoEditorInstance) return;
  const val = monacoEditorInstance.getValue();
  const charCountEl = document.getElementById('statusCharCount');
  const lineCountEl = document.getElementById('statusLineCount');
  if (charCountEl) charCountEl.textContent = `${val.length.toLocaleString()} chars`;
  if (lineCountEl) {
    const lineCount = monacoEditorInstance.getModel() ? monacoEditorInstance.getModel().getLineCount() : 1;
    lineCountEl.textContent = `${lineCount.toLocaleString()} lines`;
  }
}

export function focusEditor() {
  if (monacoEditorInstance) {
    monacoEditorInstance.focus();
  } else if (monacoDiffEditorInstance) {
    const mod = monacoDiffEditorInstance.getModifiedEditor();
    if (mod) mod.focus();
  }
}

export function getEditorInstance() {
  return monacoEditorInstance || (monacoDiffEditorInstance ? monacoDiffEditorInstance.getModifiedEditor() : null);
}

export function insertTextIntoEditor(text) {
  const ed = getEditorInstance();
  if (!ed) return;

  const selection = ed.getSelection();
  if (selection) {
    ed.executeEdits('vectorInsert', [{
      range: selection,
      text: text,
      forceMoveMarkers: true
    }]);
  } else {
    const position = ed.getPosition();
    if (position) {
      ed.executeEdits('vectorInsert', [{
        range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
        text: text,
        forceMoveMarkers: true
      }]);
    }
  }
  ed.focus();
}

export function setEditorContent(text, fileName = null) {
  if (monacoEditorInstance) {
    monacoEditorInstance.setValue(text);
    updateStatusBar(fileName);
    monacoEditorInstance.focus();
  }
}

function registerMonacoSuggestAction(editor, monacoRef) {
  editor.addAction({
    id: 'action-vector-suggest',
    label: i18n.suggest_context_menu || 'AI Suggest (Vector Search)',
    keybindings: [
      monacoRef.KeyMod.Alt | monacoRef.KeyCode.KeyS,
      monacoRef.KeyMod.CtrlCmd | monacoRef.KeyMod.Shift | monacoRef.KeyCode.KeyS
    ],
    contextMenuGroupId: 'navigation',
    contextMenuOrder: 1.5,
    run: function (ed) {
      let selection = ed.getSelection();
      let text = '';
      
      if (!selection || selection.isEmpty()) {
        const position = ed.getPosition();
        const word = ed.getModel().getWordAtPosition(position);
        if (word) {
          text = word.word;
          selection = new monacoRef.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
          ed.setSelection(selection);
        } else {
          return;
        }
      } else {
        text = ed.getModel().getValueInRange(selection).trim();
      }
      
      if (text.length > 0) {
        triggerMonacoVectorSearch(text, selection, ed, monacoRef);
      }
    }
  });
}

export async function toggleDiffMode() {
  const btnDiff = document.getElementById('btnDiff');

  if (!isDiffMode) {
    savedVersionText = monacoEditorInstance ? monacoEditorInstance.getValue() : '';

    if (monacoEditorInstance) {
      monacoEditorInstance.dispose();
      monacoEditorInstance = null;
    }

    if (!monaco) monaco = await import('monaco-editor');

    monacoDiffEditorInstance = monaco.editor.createDiffEditor(monacoContainer, {
      theme: getTheme(),
      fontSize: getFontSize(),
      fontFamily: getFontFamily(),
      wordWrap: 'on',
      minimap: { enabled: false },
      automaticLayout: true,
      originalEditable: false
    });

    const originalModel = monaco.editor.createModel(savedVersionText, 'markdown');
    const modifiedModel = monaco.editor.createModel(savedVersionText, 'markdown');
    monacoDiffEditorInstance.setModel({ original: originalModel, modified: modifiedModel });

    const modifiedEditor = monacoDiffEditorInstance.getModifiedEditor();
    registerMonacoSuggestAction(modifiedEditor, monaco);

    isDiffMode = true;
    if (btnDiff) {
      btnDiff.style.background = 'rgba(99, 102, 241, 0.3)';
      btnDiff.style.borderColor = 'rgba(99, 102, 241, 0.8)';
    }
  } else {
    savedVersionText = monacoDiffEditorInstance.getModifiedEditor().getValue();
    monacoDiffEditorInstance.getModel().original.setValue(savedVersionText);
    alert(i18n.alert_version_saved || "Current state saved as a new version. Subsequent changes will be compared.");
    focusEditor();
  }
}

export function updateEditorOptions(options) {
  if (monacoEditorInstance) monacoEditorInstance.updateOptions(options);
  if (monacoDiffEditorInstance) monacoDiffEditorInstance.updateOptions(options);
}

export function getCurrentContent() {
  return isDiffMode ? monacoDiffEditorInstance.getModifiedEditor().getValue() : monacoEditorInstance.getValue();
}

function runEngineLinter(editor, monacoRef) {
  if (linterTimeout) clearTimeout(linterTimeout);

  linterTimeout = setTimeout(async () => {
    const text = editor.getValue();

    if (window.engineAPI && typeof window.engineAPI.validateDocument === 'function') {
      try {
        const response = await window.engineAPI.validateDocument(text);
        
        const markers = (response.markers || []).map(m => ({
          severity: m.severity === 'error' ? monacoRef.MarkerSeverity.Error : monacoRef.MarkerSeverity.Warning,
          message: m.message || 'Validation alert',
          startLineNumber: m.line || 1,
          startColumn: 1,
          endLineNumber: m.line || 1,
          endColumn: 50
        }));

        monacoRef.editor.setModelMarkers(editor.getModel(), "engine-linter", markers);
      } catch (error) {
        console.error(i18n.linter_error || "Linter execution error:", error);
      }
    }
  }, 800);
}

function registerEngineCompletionProvider(monacoRef) {
  // Prevent duplicate registration if toggling back and forth
  if (monacoRef.languages._isKnowledgeProviderRegistered) return;
  monacoRef.languages._isKnowledgeProviderRegistered = true;

  monacoRef.languages.registerCompletionItemProvider('markdown', {
    provideCompletionItems: function (model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      };

      const suggestions = allDictEntries.map(entry => {
        return {
          label: entry.item.title || '',
          kind: monacoRef.languages.CompletionItemKind.Keyword,
          detail: entry.note || entry.item.code || '',
          insertText: entry.item.title || '',
          filterText: (entry.item.subtitle || '') + (entry.item.title || ''),
          range: range
        };
      });

      return { suggestions: suggestions };
    }
  });
}

function initializeKnowledgeExtensions(editor, monacoRef) {
  registerEngineCompletionProvider(monacoRef);
  runEngineLinter(editor, monacoRef);
  editor.onDidChangeModelContent(() => {
    runEngineLinter(editor, monacoRef);
  });
}

export function refreshLinter() {
  if (monacoEditorInstance && monaco) {
    runEngineLinter(monacoEditorInstance, monaco);
  }
  if (monacoDiffEditorInstance && monaco) {
    const modifiedEditor = monacoDiffEditorInstance.getModifiedEditor();
    if (modifiedEditor) {
      runEngineLinter(modifiedEditor, monaco);
    }
  }
}
