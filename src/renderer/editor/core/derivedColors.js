/**
 * Text colours derived from a theme, shared by the app (themeRenderer.js) and the theme contrast check.
 * A text colour is moved toward its target only as far as it needs to reach the contrast limit.
 */
import { mixColors, contrastRatio, readableOn, SKELETON_ACCENT } from './themeSkeleton.js';

export const TEXT_CONTRAST = 4.5;

// Alpha values of the shared tints, per face (the same values as variables.css).
export const TINT_ALPHA = {
  dark: { hover: 0.08, active: 0.14, result: 0.06, resultHover: 0.14, itemCode: 0.18, select: 0.9, selectBorder: 0.3 },
  light: { hover: 0.06, active: 0.09, result: 0.04, resultHover: 0.12, itemCode: 0.12, select: 0.96, selectBorder: 0.5 }
};

function rgbOf(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function hexOf(rgb) {
  return '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

/** The colour `hex` at `alpha` painted over `under` (both 6-digit hex). */
export function blendOver(hex, alpha, under) {
  const top = rgbOf(hex);
  const bottom = rgbOf(under);
  return hexOf(top.map((v, i) => v * alpha + bottom[i] * (1 - alpha)));
}

/** The first candidate that reaches the contrast limit on the surface, or the fallback. */
function firstPassing(candidates, surface, fallback) {
  for (const c of candidates) {
    if (contrastRatio(c, surface) >= TEXT_CONTRAST) return c;
  }
  return fallback;
}

/**
 * Derived text colours. Inputs are resolved 6-digit hex values (the caller applies its own fallbacks).
 *  - itemCodeText: from the accent toward the text colour, on the item-code tint over the sidebar
 *  - itemCodeSurface: the item-code tint as it is painted (used for the check)
 *  - logHeader: the log panel header; the text colour is kept only on it, otherwise the header is the editor background
 *  - logMuted: the log source and time colour, on the log panel body (the editor background)
 */
export function deriveTextColours({ bg, fg, panel, accent, isLight }) {
  const itemCodeSurface = blendOver(accent, (isLight ? TINT_ALPHA.light : TINT_ALPHA.dark).itemCode, panel);
  const itemCodeCandidates = [];
  for (let t = 0.35; t <= 1.0001; t += 0.05) itemCodeCandidates.push(mixColors(accent, fg, Math.min(1, t)));
  const itemCodeText = firstPassing(itemCodeCandidates, itemCodeSurface, readableOn(itemCodeSurface));

  let logHeader = mixColors(bg, fg, 0.06);
  if (contrastRatio(fg, logHeader) < TEXT_CONTRAST) logHeader = bg;

  // Muted colour starts at the design value (25% toward the background) and moves toward the text colour only if needed
  const mutedCandidates = [0.25, 0.2, 0.15, 0.1, 0.05, 0].map((t) => mixColors(fg, bg, t));
  const logMuted = firstPassing(mutedCandidates, bg, fg);

  return { itemCodeText, itemCodeSurface, logHeader, logMuted };
}
