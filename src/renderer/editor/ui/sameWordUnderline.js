/**
 * Underlines the other places where the word at the caret appears.
 * It replaces Monaco's word highlight (a background tint, off by default: occurrencesHighlight 'off'), which confused users.
 * Rules (owner 2026-11-26):
 *  - Nothing is drawn while text is selected: a selection looks like an ordinary selection.
 *  - Nothing is drawn when the word appears only once.
 *  - The underline colour is the token --same-word-underline-color (css/editor.css).
 */
const CLASS_NAME = 'same-word-underline';
const MAX_MATCHES = 500;
const DELAY_MS = 120;
const DEFAULT_SEPARATORS = '`~!@#$%^&*()-=+[{]}\|;:\'",.<>/?';
// A word made of ASCII letters, digits and underscores matches as a whole word; other scripts match as plain text
const LATIN_WORD = /^[A-Za-z0-9_]+$/;

/** Returns the ranges of the word at the caret when it appears at least twice, otherwise []. */
export function findSameWordRanges(editor) {
  const model = editor.getModel();
  const selection = editor.getSelection();
  if (!model || !selection || !selection.isEmpty()) return [];
  const word = model.getWordAtPosition(selection.getStartPosition());
  if (!word || !word.word.trim()) return [];
  const separators = LATIN_WORD.test(word.word) ? (editor.getRawOptions().wordSeparators || DEFAULT_SEPARATORS) : null;
  const matches = model.findMatches(word.word, false, false, true, separators, false, MAX_MATCHES);
  return matches.length >= 2 ? matches.map((m) => m.range) : [];
}

export function initSameWordUnderline(editor) {
  const decorations = editor.createDecorationsCollection();
  let timer = null;
  const refresh = () => {
    timer = null;
    decorations.set(findSameWordRanges(editor).map((range) => ({
      range,
      options: { inlineClassName: CLASS_NAME }
    })));
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(refresh, DELAY_MS);
  };
  editor.onDidChangeCursorSelection(schedule);
  editor.onDidChangeModelContent(schedule);
  editor.onDidChangeModel(schedule);
}
