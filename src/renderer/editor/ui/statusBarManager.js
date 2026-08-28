import { getEditorInstance } from '../core/editorCore.js';
import { i18n } from '../../core/i18n.js';

const statusElements = {
  docName: null,
  charCount: null,
  lineCount: null,
  cursorPos: null,
  wordCount: null
};

function getStatusElements() {
  if (!statusElements.docName) statusElements.docName = document.getElementById('statusDocName');
  if (!statusElements.charCount) statusElements.charCount = document.getElementById('statusCharCount');
  if (!statusElements.lineCount) statusElements.lineCount = document.getElementById('statusLineCount');
  if (!statusElements.cursorPos) statusElements.cursorPos = document.getElementById('statusCursorPos');
  if (!statusElements.wordCount) statusElements.wordCount = document.getElementById('statusWordCount');
  return statusElements;
}

export function updateStatusBar(fileName = null) {
  const elements = getStatusElements();

  if (fileName && elements.docName) {
    elements.docName.textContent = fileName;
  }

  const monacoEditorInstance = getEditorInstance();
  if (!monacoEditorInstance) return;

  const val = monacoEditorInstance.getValue();

  if (elements.charCount) {
    elements.charCount.textContent = `${val.length.toLocaleString()} ${i18n.unit_chars || 'chars'}`;
  }

  if (elements.lineCount) {
    const lineCount = monacoEditorInstance.getModel() ? monacoEditorInstance.getModel().getLineCount() : 1;
    elements.lineCount.textContent = `${lineCount.toLocaleString()} ${i18n.unit_lines || 'lines'}`;
  }

  if (elements.cursorPos) {
    const pos = monacoEditorInstance.getPosition() || { lineNumber: 1, column: 1 };
    elements.cursorPos.textContent = `Ln ${pos.lineNumber}, Col ${pos.column}`;
  }

  if (elements.wordCount) {
    const words = val.trim() ? val.trim().split(/\s+/).length : 0;
    elements.wordCount.textContent = `${words.toLocaleString()} ${i18n.unit_words || 'words'}`;
  }
}
