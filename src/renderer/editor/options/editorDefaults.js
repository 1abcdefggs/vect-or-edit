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
  minimap: Object.freeze({ enabled: false }),
  lineNumbers: 'on',
  folding: true,
  renderWhitespace: 'none',
  renderLineHighlight: 'line',
  scrollBeyondLastLine: false,
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
 */
export function buildMonacoBaseOptions(runtime) {
  return {
    ...EDITOR_DEFAULTS,
    minimap: { ...EDITOR_DEFAULTS.minimap },
    unicodeHighlight: { ...EDITOR_DEFAULTS.unicodeHighlight },
    ...appOwnedOptions(),
    value: runtime.value,
    language: runtime.language,
    theme: runtime.theme,
    fontSize: runtime.fontSize ?? EDITOR_DEFAULTS.fontSize,
    fontFamily: runtime.fontFamily ?? EDITOR_DEFAULTS.fontFamily
  };
}
