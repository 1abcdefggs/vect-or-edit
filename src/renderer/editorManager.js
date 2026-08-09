import { getTheme, getFontFamily, getFontSize } from './settings.js';
import { triggerMonacoVectorSearch } from './vectorSearch.js';
import { allDictEntries } from './dictionary.js';
import { i18n } from './i18n.js';

let isProMode = false;
let isDiffMode = false;
let monacoEditorInstance = null;
let monacoDiffEditorInstance = null;
let savedVersionText = '';
let linterTimeout = null;
let monaco = null;

const editorInput = document.getElementById('editorInput');
const monacoContainer = document.getElementById('monacoContainer');
const btnToggleEditor = document.getElementById('btnToggleEditor');
const btnDiff = document.getElementById('btnDiff');

export async function toggleEditor(iconsObj) {
  isProMode = !isProMode;

  if (isProMode) {
    editorInput.style.display = 'none';
    monacoContainer.style.display = 'block';
    btnToggleEditor.innerHTML = `${iconsObj.editor} <span data-i18n="btn_basic_editor">${i18n.btn_basic_editor || 'Basic Editor'}</span>`;

    if (!monacoEditorInstance && !isDiffMode) {
      if (!monaco) monaco = await import('monaco-editor');

      monacoEditorInstance = monaco.editor.create(monacoContainer, {
        value: editorInput.value,
        language: 'markdown',
        theme: getTheme(),
        fontSize: getFontSize(),
        fontFamily: getFontFamily(),
        wordWrap: 'on',
        minimap: { enabled: false },
        automaticLayout: true
      });

      monacoEditorInstance.onDidChangeCursorSelection(async (e) => {
        const selection = monacoEditorInstance.getModel().getValueInRange(e.selection).trim();
        if (selection.length > 2) {
          triggerMonacoVectorSearch(selection, e.selection, monacoEditorInstance, monaco);
        }
      });

      initializeKnowledgeExtensions(monacoEditorInstance, monaco);
    } else if (monacoEditorInstance) {
      monacoEditorInstance.setValue(editorInput.value);
    } else if (isDiffMode && monacoDiffEditorInstance) {
      monacoDiffEditorInstance.getModifiedEditor().setValue(editorInput.value);
    }
  } else {
    monacoContainer.style.display = 'none';
    editorInput.style.display = 'block';
    btnToggleEditor.innerHTML = `${iconsObj.editor} <span data-i18n="btn_pro_editor">${i18n.btn_pro_editor || 'Pro Editor'}</span>`;

    if (isDiffMode && monacoDiffEditorInstance) {
      editorInput.value = monacoDiffEditorInstance.getModifiedEditor().getValue();
    } else if (monacoEditorInstance) {
      editorInput.value = monacoEditorInstance.getValue();
    }
  }
}

export async function toggleDiffMode() {
  if (!isProMode) {
    btnToggleEditor.click();
  }

  if (!isDiffMode) {
    savedVersionText = monacoEditorInstance ? monacoEditorInstance.getValue() : editorInput.value;

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
    modifiedEditor.onDidChangeCursorSelection(async (e) => {
      const selection = modifiedEditor.getModel().getValueInRange(e.selection).trim();
      if (selection.length > 2) {
        triggerMonacoVectorSearch(selection, e.selection, modifiedEditor, monaco);
      }
    });

    isDiffMode = true;
    btnDiff.style.background = 'rgba(99, 102, 241, 0.3)';
    btnDiff.style.borderColor = 'rgba(99, 102, 241, 0.8)';
  } else {
    savedVersionText = monacoDiffEditorInstance.getModifiedEditor().getValue();
    monacoDiffEditorInstance.getModel().original.setValue(savedVersionText);
    alert(i18n.alert_version_saved || "Current state saved as a new version. Subsequent changes will be compared.");
  }
}

export function updateEditorOptions(options) {
  if (monacoEditorInstance) monacoEditorInstance.updateOptions(options);
  if (monacoDiffEditorInstance) monacoDiffEditorInstance.updateOptions(options);
}

export function getCurrentContent() {
  if (isProMode) {
    return isDiffMode ? monacoDiffEditorInstance.getModifiedEditor().getValue() : monacoEditorInstance.getValue();
  }
  return editorInput.value;
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
