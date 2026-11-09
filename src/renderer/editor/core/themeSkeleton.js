/**
 * Theme skeleton: the colour keys every theme file carries (GitHub is the reference), and a builder that fills
 * all of them from a few colours. A theme built here has the same shape as a theme file, so it can go through
 * the same loader (applyThemeToDOM and the Monaco registration) as the files in src/renderer/themes.
 *
 * The syntax colours (`rules`) are not generated: the theme inherits them from its base face.
 * Pure functions only (no DOM), so the boundary values can be tested directly.
 */

/** The 22 colour keys of a theme file, in the order the GitHub theme uses. */
export const THEME_COLOR_KEYS = [
  'editor.foreground',
  'editor.background',
  'editor.selectionBackground',
  'editor.inactiveSelectionBackground',
  'editor.selectionHighlightBackground',
  'editor.findMatchHighlightBackground',
  'editor.lineHighlightBackground',
  'editor.lineHighlightBorder',
  'editorCursor.foreground',
  'editorLineNumber.foreground',
  'editorWhitespace.foreground',
  'editorIndentGuide.background',
  'editorIndentGuide.activeBackground',
  'editor.selectionHighlightBorder',
  'sideBar.background',
  'titleBar.activeBackground',
  'editorWidget.background',
  'editorGroup.border',
  'button.background',
  'button.foreground',
  'dropdown.background',
  'dropdown.foreground',
];

/** The app accent (variables.css --accent-color). Selection and the button use it, so every built theme shares it. */
export const SKELETON_ACCENT = '#2563eb';

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function toRgb(hex) {
  if (!HEX.test(hex)) throw new Error(`Not a hex colour: ${hex}`);
  const h = hex.slice(1);
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

function toHex(rgb) {
  return '#' + rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('');
}

/** Mixes two colours in sRGB: amount 0 is a, amount 1 is b. */
export function mixColors(a, b, amount) {
  const A = toRgb(a);
  const B = toRgb(b);
  return toHex(A.map((c, i) => c + (B[i] - c) * amount));
}

function relativeLuminance(hex) {
  const [r, g, b] = toRgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours (1 to 21). */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** White or black, whichever reads better on the given colour. */
export function readableOn(hex) {
  return contrastRatio(hex, '#ffffff') >= contrastRatio(hex, '#000000') ? '#ffffff' : '#000000';
}

/**
 * Builds a complete theme from a background and a text colour.
 *
 *   base:       'vs' for the light face, 'vs-dark' for the dark face (the same values a theme file uses)
 *   background: the editor background
 *   foreground: the editor text
 *   accent:     selection and button colour (defaults to the app accent)
 *
 * Every other colour is a mix of these, so a theme built from two colours is complete and readable.
 */
export function buildThemeFromPalette({ base = 'vs-dark', background, foreground, accent = SKELETON_ACCENT }) {
  const bg = background;
  const fg = foreground;
  const isLight = base === 'vs';
  // Side panels and widgets sit a step off the editor; the title bar is a step further (darker on the dark face)
  const panel = mixColors(bg, fg, 0.04);
  const header = isLight ? panel : mixColors(bg, '#000000', 0.3);

  const colors = {
    'editor.foreground': fg,
    'editor.background': bg,
    'editor.selectionBackground': mixColors(bg, accent, 0.35),
    'editor.inactiveSelectionBackground': mixColors(bg, fg, 0.12),
    'editor.selectionHighlightBackground': mixColors(bg, accent, 0.2),
    'editor.findMatchHighlightBackground': mixColors(bg, '#ffd33d', 0.35),
    'editor.lineHighlightBackground': mixColors(bg, fg, 0.05),
    'editor.lineHighlightBorder': '#00000000',
    'editorCursor.foreground': fg,
    'editorLineNumber.foreground': mixColors(bg, fg, 0.4),
    'editorWhitespace.foreground': mixColors(bg, fg, 0.25),
    'editorIndentGuide.background': mixColors(bg, fg, 0.12),
    'editorIndentGuide.activeBackground': mixColors(bg, accent, 0.5),
    'editor.selectionHighlightBorder': mixColors(bg, accent, 0.3),
    'sideBar.background': panel,
    'titleBar.activeBackground': header,
    'editorWidget.background': panel,
    'editorGroup.border': mixColors(bg, fg, 0.15),
    'button.background': accent,
    'button.foreground': readableOn(accent),
    'dropdown.background': panel,
    'dropdown.foreground': fg,
  };

  return { base, inherit: true, rules: [], colors };
}
