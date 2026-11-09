import { allDictEntries } from '../../search/dictionary.js';
import { i18n } from '../../core/i18n.js';
import { STORAGE_KEYS } from '../../core/constants.js';
import { readStorage } from '../../core/storage.js';

let linterTimeout = null;

/** Real-time validation is on unless Settings switched it off */
function isLinterEnabled() {
  try {
    return readStorage(STORAGE_KEYS.LINTER_ENABLED) !== 'off';
  } catch {
    return true;
  }
}

export function runEngineLinter(editor, monacoRef) {
  if (!editor || !monacoRef) return;
  if (linterTimeout) clearTimeout(linterTimeout);
  if (!isLinterEnabled()) {
    // Switched off: drop the markers left from the last run
    monacoRef.editor.setModelMarkers(editor.getModel(), "engine-linter", []);
    return;
  }

  linterTimeout = setTimeout(async () => {
    const model = editor.getModel();
    if (!model) return;
    const text = model.getValue();
    if (window.engineAPI && typeof window.engineAPI.validateDocument === 'function') {
      try {
        const response = await window.engineAPI.validateDocument(text);
        // The user may have switched tabs while the engine ran: drop the result for the old model
        if (model.isDisposed() || editor.getModel() !== model) return;
        const lineCount = model.getLineCount();
        const markers = (response.markers || []).map(m => {
          const line = Math.min(Math.max(m.line || 1, 1), lineCount);
          // The engine's severity is "Error" / "Warning" (capitalised); compare case-insensitively
          const isError = String(m.severity || '').toLowerCase() === 'error';
          return {
            severity: isError ? monacoRef.MarkerSeverity.Error : monacoRef.MarkerSeverity.Warning,
            message: m.message || 'Validation alert',
            startLineNumber: line,
            startColumn: 1,
            endLineNumber: line,
            endColumn: model.getLineMaxColumn(line)
          };
        });
        monacoRef.editor.setModelMarkers(model, "engine-linter", markers);
      } catch (error) {
        console.error(i18n.linter_error || "Linter execution error:", error);
      }
    }
  }, 800);
}

export function initializeKnowledgeExtensions(editor, monacoRef) {
  runEngineLinter(editor, monacoRef);
  editor.onDidChangeModelContent(() => {
    runEngineLinter(editor, monacoRef);
  });
}

export function refreshLinter(editor, monacoRef) {
  if (editor && monacoRef) {
    runEngineLinter(editor, monacoRef);
  }
}
