import { getEditorInstance } from '../core/editorCore.js';
import { i18n, t } from '../../core/i18n.js';
import { showToast } from '../../ui/notifications/toastManager.js';

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

/**
 * Shows the encoding detected on open and the syntax implied by the file name.
 * Untitled documents keep the defaults (UTF-8, Markdown).
 */
export function setDocumentFormat({ encoding = 'UTF-8', fileName = /** @type {string | null} */ (null) } = {}) {
  const encodingEl = document.getElementById('statusEncoding');
  if (encodingEl) encodingEl.textContent = encoding;

  const syntaxEl = document.getElementById('statusSyntaxLabel');
  if (syntaxEl && fileName) {
    syntaxEl.textContent = /\.txt$/i.test(fileName) ? 'Plain Text' : 'Markdown';
  }
}

/**
 * Called after a successful save. Files are always written as UTF-8, so the display follows what was written.
 */
export function markSavedAsUtf8() {
  setDocumentFormat({ encoding: 'UTF-8' });
}

/**
 * Tells the user once on open when a non-UTF-8 file will be saved as UTF-8.
 */
export function announceOpenedEncoding(encoding) {
  if (encoding === 'Shift_JIS') {
    showToast(t('encoding_saved_as_utf8'), 'info');
  }
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
