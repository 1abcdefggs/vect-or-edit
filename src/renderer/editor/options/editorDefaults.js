/**
 * Monaco defaults for a first-time user: a Japanese Markdown writing environment with no setting changed.
 * Pure module (no Monaco import), so the defaults can be tested without starting the editor.
 * Font, size and line height come from DEFAULTS (core/constants.ts), the single source for those values.
 */
import { DEFAULTS } from '../../core/constants.js';

/** Settings-page-owned options (wordWrap, lineNumbers, renderLineHighlight, renderWhitespace, font, size, line height) get these values too. */
export const EDITOR_DEFAULTS = Object.freeze({
  fontFamily: DEFAULTS.FONT_FAMILY,
  fontSize: DEFAULTS.FONT_SIZE,
  lineHeight: DEFAULTS.LINE_HEIGHT,
  wordWrap: 'on',
  minimap: Object.freeze({ enabled: true }),
  lineNumbers: 'on',
  folding: true,
  renderWhitespace: 'none',
  renderLineHighlight: 'gutter',
  scrollBeyondLastLine: false,
  // The word at the caret is underlined by sameWordUnderline.js instead of Monaco's background tint
  occurrencesHighlight: 'off',
  quickSuggestions: false,
  wordBasedSuggestions: 'off',
  formatOnPaste: false,
  formatOnType: false,
  tabSize: 2,
  insertSpaces: true,
  // Full-width spaces and CJK punctuation are normal in Japanese prose; they must not be flagged.
  unicodeHighlight: Object.freeze({ ambiguousCharacters: false, invisibleCharacters: false, nonBasicASCII: false })
  // autoClosingBrackets / autoClosingQuotes are not set here: Monaco's language default applies, and the settings UI exposes them.
});

/** Monaco's own word separators, kept here so a language can add to them. */
const USUAL_WORD_SEPARATORS = '`~!@#$%^&*()-=+[{]}\\|;:\'",.<>/?';

/**
 * Options that follow the document language (the 12 options marked language-dependent in the review sheet).
 * Only the ones whose value differs from the base are listed; the rest stay as they are. Other languages use the base.
 * Design and decisions: docs/monaco_document_language_design_2026_11_23.md. A value the user set always wins (see monacoOptionsStore).
 */
export const LANGUAGE_DEFAULTS = Object.freeze({
  ja: Object.freeze({
    wordSegmenterLocales: Object.freeze(['ja']),
    // Japanese punctuation and brackets, written as escapes so this file holds no Japanese text
    wordSeparators: USUAL_WORD_SEPARATORS + '\u3001\u3002\uFF0C\uFF0E\u30FB\u300C\u300D\u300E\u300F\uFF08\uFF09\u3010\u3011',
    wrappingStrategy: 'advanced',
    wrappingIndent: 'none',
    unicodeHighlight: Object.freeze({ allowedLocales: Object.freeze({ _os: true, _vscode: true, ja: true }) })
  })
});

/** A fresh copy of the options for a document language ({} when the language has none), safe to mutate. */
export function languageOptions(language) {
  const own = LANGUAGE_DEFAULTS[language];
  if (!own) return {};
  const copy = { ...own };
  if (own.wordSegmenterLocales) copy.wordSegmenterLocales = [...own.wordSegmenterLocales];
  if (own.unicodeHighlight) {
    copy.unicodeHighlight = { ...own.unicodeHighlight, allowedLocales: { ...own.unicodeHighlight.allowedLocales } };
  }
  return copy;
}

/** Monaco's own values for the language-dependent options: what a document without a language entry gets. */
const MONACO_LANGUAGE_VALUES = Object.freeze({
  wordSegmenterLocales: Object.freeze([]),
  wordSeparators: USUAL_WORD_SEPARATORS,
  wrappingStrategy: 'simple',
  wrappingIndent: 'same',
  'unicodeHighlight.allowedLocales': Object.freeze({ _os: true, _vscode: true })
});

/** The panel paths of every language-dependent option, in the form the overrides use. */
export const LANGUAGE_PATHS = Object.freeze(Object.keys(MONACO_LANGUAGE_VALUES));

/**
 * The value of every language-dependent option for a document language, as {path: value}.
 * Unlike `languageOptions`, nothing is left out: an option the language does not set gets Monaco's own value,
 * so switching from one document language to another puts the previous language's values back.
 */
export function languagePathValues(language) {
  const own = languageOptions(language);
  const out = {};
  for (const path of LANGUAGE_PATHS) {
    const [top, member] = path.split('.');
    const v = member === undefined ? own[top] : own[top]?.[member];
    const value = v !== undefined ? v : MONACO_LANGUAGE_VALUES[path];
    out[path] = Array.isArray(value) ? [...value] : value && typeof value === 'object' ? { ...value } : value;
  }
  return out;
}

/**
 * Options the app owns (layout, scrolling, cursor, scrollbar), not user-facing defaults.
 * Returns fresh objects on every call so a caller can mutate its copy safely.
 */
function appOwnedOptions() {
  return {
    letterSpacing: 0.3,
    automaticLayout: true,
    glyphMargin: false,
    lineNumbersMinChars: 3,
    lineDecorationsWidth: 12,
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
  };
}

/**
 * Typography the Markdown preview copies from the editor, so the preview reads like the source.
 * `raw` is the editor's raw options (getRawOptions). Monaco reads a lineHeight below 8 as a multiplier of fontSize.
 */
export function previewTypography(raw = {}) {
  const fontSize = raw.fontSize || EDITOR_DEFAULTS.fontSize;
  const lineHeight = raw.lineHeight || EDITOR_DEFAULTS.lineHeight;
  return {
    fontFamily: raw.fontFamily || EDITOR_DEFAULTS.fontFamily,
    fontSize,
    lineHeightPx: lineHeight < 8 ? lineHeight * fontSize : lineHeight
  };
}

/**
 * Builds the options passed to monaco.editor.create().
 * `runtime` carries what only the running app knows: the document text, language, theme,
 * and the font size and family the user saved (they win over the defaults).
 * `runtime.documentLanguage` (optional) adds the language-dependent options on top of the defaults.
 */
export function buildMonacoBaseOptions(runtime) {
  const lang = languageOptions(runtime.documentLanguage);
  return {
    ...EDITOR_DEFAULTS,
    minimap: { ...EDITOR_DEFAULTS.minimap },
    ...lang,
    unicodeHighlight: { ...EDITOR_DEFAULTS.unicodeHighlight, ...lang.unicodeHighlight },
    ...appOwnedOptions(),
    value: runtime.value,
    language: runtime.language,
    theme: runtime.theme,
    fontSize: runtime.fontSize ?? EDITOR_DEFAULTS.fontSize,
    fontFamily: runtime.fontFamily ?? EDITOR_DEFAULTS.fontFamily
  };
}
