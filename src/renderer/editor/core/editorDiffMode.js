import { registerMonacoSuggestAction } from './editorActions.js';
import { getTheme, getFontSize, getFontFamily } from '../../ui/settings.js';
import { i18n } from '../../core/i18n.js';

let isDiffMode = false;
let monacoDiffEditorInstance = null;
let savedVersionText = '';

export function getIsDiffMode() {
  return isDiffMode;
}

export function getDiffEditorInstance() {
  return monacoDiffEditorInstance;
}

export async function toggleDiffMode(monacoEditorInstance, monaco, focusEditorCallback) {
  const btnDiff = document.getElementById('btnDiff');

  if (!isDiffMode) {
    savedVersionText = monacoEditorInstance ? monacoEditorInstance.getValue() : '';

    if (monacoEditorInstance) {
      monacoEditorInstance.dispose();
    }

    if (!monaco) monaco = await import('monaco-editor');

    const monacoContainer = document.getElementById('monacoContainer');
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
    if (focusEditorCallback) focusEditorCallback();
  }
}
