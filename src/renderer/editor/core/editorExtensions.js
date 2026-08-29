import { allDictEntries } from '../../search/dictionary.js';
import { i18n } from '../../core/i18n.js';

let linterTimeout = null;

export function runEngineLinter(editor, monacoRef) {
  if (!editor || !monacoRef) return;
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

export function registerEngineCompletionProvider(monacoRef) {
  // Removed IntelliSense / CompletionProvider per user request.
  // The sidebar search will be the primary dictionary interface.
}

export function initializeKnowledgeExtensions(editor, monacoRef) {
  registerEngineCompletionProvider(monacoRef);
  runEngineLinter(editor, monacoRef);
  editor.onDidChangeModelContent(() => {
    runEngineLinter(editor, monacoRef);
  });
}

export function refreshLinter(editor, diffEditor, monacoRef) {
  if (editor && monacoRef) {
    runEngineLinter(editor, monacoRef);
  }
  if (diffEditor && monacoRef) {
    const modifiedEditor = diffEditor.getModifiedEditor();
    if (modifiedEditor) {
      runEngineLinter(modifiedEditor, monacoRef);
    }
  }
}
