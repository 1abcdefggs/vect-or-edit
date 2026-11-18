/**
 * Line height as a ratio of the font size (1.8 = 1.8 times the size). Monaco reads a lineHeight below 8 as such a ratio,
 * so the line stays in proportion at every font size. Older versions stored fixed pixels (22, 26, 30, 34);
 * normalizeLineHeight maps them to the ratios their labels always named.
 */

export const LINE_HEIGHT_PRESETS = [1.4, 1.6, 1.8, 2.0];
export const LINE_HEIGHT_MIN = 1.0;
export const LINE_HEIGHT_MAX = 3.0;

const LEGACY_PX = { 22: 1.4, 26: 1.6, 30: 1.8, 34: 2.0 };
// The pixel values were made for the old default size
const LEGACY_BASE_SIZE = 16;

/** A stored or typed line height as a ratio; null when it is not a number. */
export function normalizeLineHeight(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 8) return LEGACY_PX[n] ?? Math.round((n / LEGACY_BASE_SIZE) * 10) / 10;
  return Math.min(LINE_HEIGHT_MAX, Math.max(LINE_HEIGHT_MIN, Math.round(n * 10) / 10));
}
