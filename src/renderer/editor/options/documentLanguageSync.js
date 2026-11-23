/**
 * Keeps the language-dependent Monaco options in step with the language of the document in the editor.
 * Runs when a tab is switched (the model changes) and, after a short pause, when the text changes (a file is opened,
 * text is pasted, or the auto detection turns over). Design: docs/monaco_document_language_design_2026_11_23.md.
 * A value the user set in the Editor Options panel is never touched.
 */
import { detectDocumentLanguage, normalizeLanguage } from './documentLanguage.js';
import { languagePathValues } from './editorDefaults.js';
import { toEditorOptions } from './monacoOptionsModel.js';
import { getOverriddenPaths, setBaselinePaths } from './monacoOptionsStore.js';
import { editorEvents } from '../core/editorEvents.js';

/** The manual choice of the active document ('' = Auto). The tab layer sets it, so this module needs no tab import. */
let manualProvider = () => '';
export function setManualLanguageProvider(fn) { manualProvider = typeof fn === 'function' ? fn : () => ''; }

let activeCheck = null;
/** Runs the check now (after a manual choice). Does nothing before the editor is bound. */
export function requestLanguageCheck() { activeCheck?.(); }

const TEXT_PAUSE_MS = 600;
/** Larger than the auto sample (2000) so a front matter block of normal length is still read in full. */
const SAMPLE_CHARS = 8000;

/**
 * Applies the options of `language` to the editor, except the overridden ones. Returns the paths it applied.
 * The baseline follows, so "reset" on an option returns to the value of the current document language.
 */
export function applyLanguageOptions(editor, language) {
  const skip = getOverriddenPaths();
  const values = languagePathValues(language);
  const apply = {};
  for (const [path, value] of Object.entries(values)) {
    if (!skip.has(path)) apply[path] = value;
  }
  if (!Object.keys(apply).length) return [];
  editor.updateOptions(toEditorOptions(apply));
  setBaselinePaths(apply);
  return Object.keys(apply);
}

/**
 * Starts following the editor. `getUiLanguage` and `getManualLanguage` are read at each check, so a changed UI language
 * or a manual choice takes effect at the next one. Returns a function that stops it.
 */
export function bindDocumentLanguage(editor, { getUiLanguage, getManualLanguage = () => manualProvider(), isAutoOn = () => true }) {
  let current = null;
  let timer = null;

  const check = () => {
    const model = editor.getModel();
    if (!model) return;
    const manual = getManualLanguage();
    // Detection reads the front matter and the first AUTO_SAMPLE_LENGTH characters only, so a long file is not copied whole at each pause
    const end = model.getPositionAt(SAMPLE_CHARS);
    const sample = model.getValueInRange({ startLineNumber: 1, startColumn: 1, endLineNumber: end.lineNumber, endColumn: end.column });
    const { language, source } = detectDocumentLanguage(sample, {
      manual,
      autoOn: isAutoOn(),
      uiLanguage: getUiLanguage()
    });
    if (language !== current) {
      current = language;
      applyLanguageOptions(editor, language);
    }
    // Always announced, so the status bar also follows a tab switch or a change of source with the same language
    editorEvents.emit('onDocumentLanguageChanged', { language, source, manual: normalizeLanguage(manual) });
  };
  activeCheck = check;

  const subscriptions = [
    editor.onDidChangeModel(check),
    editor.onDidChangeModelContent(() => {
      clearTimeout(timer);
      timer = setTimeout(check, TEXT_PAUSE_MS);
    })
  ];
  check();

  return () => {
    if (activeCheck === check) activeCheck = null;
    clearTimeout(timer);
    subscriptions.forEach((s) => s.dispose());
  };
}
