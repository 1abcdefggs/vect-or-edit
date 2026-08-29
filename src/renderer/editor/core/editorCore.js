import { getTheme, getFontFamily, getFontSize } from '../../ui/settings.js';
import { loadTheme, registerAllMonacoThemes } from './themeLoader.js';
import { applyEditorCanvasTone, updateEditorOptions, TONE_COLORS } from './editorTheme.js';
import { registerMonacoSuggestAction, registerTabManagementActions } from './editorActions.js';
import { initializeKnowledgeExtensions, refreshLinter } from './editorExtensions.js';
import { setLedStatus } from '../../core/statusManager.js';
import { editorEvents } from './editorEvents.js';
import { bindPlaceholderEvents } from './editorPlaceholder.js';
import { setupEditorContextMenu } from './editorSelectionEvents.js';
import { toggleDiffMode as toggleDiffController, getIsDiffMode, getDiffEditorInstance } from './editorDiffMode.js';

let monacoEditorInstance = null;
let monaco = null;
let isEditorInitializing = false;

// Configure Monaco WebWorker environment safely for Vite & Electron
if (typeof window !== 'undefined') {
  window.MonacoEnvironment = {
    getWorkerUrl: function (_moduleId, _label) {
      return `data:text/javascript;charset=utf-8,${encodeURIComponent(`self.onmessage = () => {};`)}`;
    }
  };
}

export function getEditorInstance() {
  const diffInstance = getDiffEditorInstance();
  return monacoEditorInstance || (diffInstance ? diffInstance.getModifiedEditor() : null);
}

export function getMonaco() {
  return monaco;
}

export function getCurrentContent() {
  const diffInstance = getDiffEditorInstance();
  return getIsDiffMode()
    ? (diffInstance ? diffInstance.getModifiedEditor().getValue() : '')
    : (monacoEditorInstance ? monacoEditorInstance.getValue() : '');
}

export function focusEditor() {
  const diffInstance = getDiffEditorInstance();
  if (monacoEditorInstance) {
    monacoEditorInstance.focus();
  } else if (diffInstance) {
    const mod = diffInstance.getModifiedEditor();
    if (mod) mod.focus();
  }
}

export function updateOptions(options) {
  updateEditorOptions(options, [monacoEditorInstance, getDiffEditorInstance()]);
  if (monaco && monaco.editor && typeof monaco.editor.remeasureFonts === 'function') {
    setTimeout(() => {
      monaco.editor.remeasureFonts();
    }, 50);
  }
}

export function applyCanvasTone(tone, customBg = null, customFg = null) {
  applyEditorCanvasTone(tone, customBg, customFg, monaco);
}

export { TONE_COLORS };

export function triggerRefreshLinter() {
  refreshLinter(monacoEditorInstance, getDiffEditorInstance(), monaco);
}

export async function initEditor() {
  if (isEditorInitializing) return monacoEditorInstance;
  isEditorInitializing = true;

  const monacoContainer = document.getElementById('monacoContainer');
  if (!monacoContainer) {
    console.error('monacoContainer DOM element not found');
    isEditorInitializing = false;
    return null;
  }

  if (monacoEditorInstance) {
    try { monacoEditorInstance.dispose(); } catch (_) {}
    monacoEditorInstance = null;
  }
  
  const diffInstance = getDiffEditorInstance();
  if (diffInstance) {
    try { diffInstance.dispose(); } catch (_) {}
  }
  monacoContainer.innerHTML = '';

  if (!monaco) monaco = await import('monaco-editor');
  await registerAllMonacoThemes();
  const currentTheme = getTheme();
  try {
    await loadTheme(currentTheme);
  } catch (_) {}

  monacoEditorInstance = monaco.editor.create(monacoContainer, {
    value: '',
    language: 'markdown',
    theme: currentTheme || 'vs-dark',
    fontSize: getFontSize(),
    fontFamily: getFontFamily(),
    lineHeight: 24,
    letterSpacing: 0.3,
    wordWrap: 'on',
    minimap: { enabled: false },
    automaticLayout: true,
    scrollBeyondLastLine: false,
    glyphMargin: false,
    folding: false,
    lineNumbersMinChars: 3,
    lineDecorationsWidth: 12,
    renderLineHighlight: 'line',
    renderLineHighlightOnlyWhenFocus: true,
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    fixedOverflowWidgets: true,
    padding: { top: 12, bottom: 12 },
    scrollbar: {
      vertical: 'visible',
      horizontal: 'auto',
      verticalScrollbarSize: 6,
      horizontalScrollbarSize: 6,
      arrowSize: 0,
      useShadows: false,
      verticalHasArrows: false,
      horizontalHasArrows: false,
      verticalSliderSize: 6,
      horizontalSliderSize: 6,
      handleMouseWheel: true
    },
    overviewRulerLanes: 0,
    overviewRulerBorder: false,
    hideCursorInOverviewRuler: true,
    contextmenu: false
  });

  bindPlaceholderEvents(monacoEditorInstance);
  registerMonacoSuggestAction(monacoEditorInstance, monaco);
  registerTabManagementActions(monacoEditorInstance);
  initializeKnowledgeExtensions(monacoEditorInstance, monaco);

  monacoEditorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
    const btnSave = document.getElementById('btnSave');
    if (btnSave) btnSave.click();
  });

  isEditorInitializing = false;
  editorEvents.emit('onEditorInitialized');

  const btnNewTab = document.getElementById('btnNewTab');
  if (btnNewTab) {
    btnNewTab.addEventListener('click', () => {
      editorEvents.emit('createNewTab');
    });
  }

  setupEditorContextMenu(monacoEditorInstance, monacoContainer);

  monacoEditorInstance.onDidChangeModelContent(() => {
    editorEvents.emit('onStatusBarUpdateNeeded');
  });
  editorEvents.emit('onStatusBarUpdateNeeded');

  setLedStatus('monaco', true, `4. EDITOR: Mounted & Ready`);

  window.__monacoEditorInstance = monacoEditorInstance;

  // Ensure initial tab is created if none exists
  editorEvents.emit('createNewTab');

  return monacoEditorInstance;
}

export async function toggleDiffMode() {
  await toggleDiffController(monacoEditorInstance, monaco, focusEditor);
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
  editorEvents.emit('setEditorContentRequest', { text, fileName });
}
