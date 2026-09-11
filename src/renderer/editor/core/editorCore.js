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
import { t } from '../../core/i18n.js';

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
  if (typeof window !== 'undefined') window.monaco = monaco;
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

  // Inline AI Command & Prompt Trigger (Ctrl+K or Alt+Enter)
  monacoEditorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
    const selection = monacoEditorInstance.getSelection();
    let promptText = '';
    if (selection && !selection.isEmpty()) {
      promptText = monacoEditorInstance.getModel().getValueInRange(selection);
    } else {
      const pos = monacoEditorInstance.getPosition();
      if (pos) {
        promptText = monacoEditorInstance.getModel().getLineContent(pos.lineNumber).trim();
      }
    }
    window.dispatchEvent(new CustomEvent('app:openLlmChat', { detail: { prompt: promptText } }));
  });

  // Inline Quick Trigger on Enter: Check for /ai or >> prompt commands
  monacoEditorInstance.onKeyDown((e) => {
    if (e.keyCode === monaco.KeyCode.Enter && !e.shiftKey && !e.ctrlKey && !e.altKey) {
      const pos = monacoEditorInstance.getPosition();
      if (!pos) return;
      const currentLine = monacoEditorInstance.getModel().getLineContent(pos.lineNumber).trim();
      if (currentLine.startsWith('/ai ') || currentLine.startsWith('>> ')) {
        e.preventDefault();
        const prompt = currentLine.replace(/^(\/ai|>>)\s*/, '').trim();
        if (prompt) {
          window.dispatchEvent(new CustomEvent('app:openLlmChat', { detail: { prompt } }));
        }
      }
    }
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
  if (typeof window !== 'undefined') window.monacoEditorInstance = monacoEditorInstance;
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

let activeAiDecorations = [];

/**
 * Inserts or replaces text in Monaco Editor with distinct visual decorations for AI output vs user text.
 * @param {string} text The generated or rewritten text
 * @param {'insert'|'replace'} mode Whether to insert at cursor or replace current selection
 * @param {'generate'|'rewrite'} type Distinguishes generated text from rewritten text
 */
export function applyAiOutputToEditor(text, mode = 'insert', type = 'generate') {
  const ed = getEditorInstance();
  if (!ed || !monaco) return;

  const model = ed.getModel();
  if (!model) return;

  let targetRange;
  const selection = ed.getSelection();

  if (mode === 'replace' && selection && !selection.isEmpty()) {
    targetRange = selection;
  } else {
    const pos = ed.getPosition() || { lineNumber: 1, column: 1 };
    targetRange = new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column);
  }

  // Calculate new text end position
  const startLineNumber = targetRange.startLineNumber;
  const startColumn = targetRange.startColumn;
  const lines = text.split('\n');
  const endLineNumber = startLineNumber + lines.length - 1;
  const endColumn = lines.length === 1 ? startColumn + text.length : lines[lines.length - 1].length + 1;

  // Execute edit
  ed.executeEdits('aiOutput', [{
    range: targetRange,
    text: text,
    forceMoveMarkers: true
  }]);

  // Apply decorative style to distinguish AI text from user's manual typing
  const decorationRange = new monaco.Range(startLineNumber, startColumn, endLineNumber, endColumn);
  const inlineClassName = type === 'rewrite' ? 'monaco-ai-rewritten-inline' : 'monaco-ai-generated-inline';
  const hoverMessage = type === 'rewrite'
    ? { value: t('ai_hover_rewritten') || '**AI Rewritten Text**' }
    : { value: t('ai_hover_generated') || '**AI Generated Text (LLM)**' };

  activeAiDecorations = ed.deltaDecorations(activeAiDecorations, [
    {
      range: decorationRange,
      options: {
        isWholeLine: false,
        className: inlineClassName,
        hoverMessage,
        glyphMarginClassName: 'monaco-ai-glyph-margin'
      }
    }
  ]);

  ed.focus();
}

export function setEditorContent(text, fileName = null) {
  editorEvents.emit('setEditorContentRequest', { text, fileName });
}
