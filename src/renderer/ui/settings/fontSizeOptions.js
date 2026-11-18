/**
 * Font size choices: presets plus any own value in a range.
 * The toolbar select holds the value (a preset or one extra option for an own value); the settings page shows the
 * presets as segments and the exact value in a number input. One place for the numbers, so both screens agree.
 */

export const FONT_SIZE_PRESETS = [10, 12, 14, 16, 18, 20, 24, 32];
export const FONT_SIZE_MIN = 8;
export const FONT_SIZE_MAX = 72;

/** An own value kept inside the range and rounded to a whole pixel; null when it is not a number. */
export function clampFontSize(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return null;
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, n));
}

export function isPresetSize(px) {
  return FONT_SIZE_PRESETS.includes(Number(px));
}

/** Fills a select with the presets, plus the current own value when it is not a preset. Keeps the chosen value. */
export function fillFontSizeSelect(select, current) {
  if (!select) return;
  const px = clampFontSize(current ?? select.value);
  const sizes = [...FONT_SIZE_PRESETS];
  if (px !== null && !isPresetSize(px)) sizes.push(px);
  sizes.sort((a, b) => a - b);
  select.replaceChildren(...sizes.map((size) => new Option(`${size}px`, String(size))));
  if (px !== null) select.value = String(px);
}

/**
 * Shows px everywhere it is shown: the toolbar select (extra option for an own value), the settings segments
 * (no segment pressed for an own value) and the number input. Returns the value used.
 */
export function showFontSize(px, { toolbarSelect, modalSelect, input }) {
  const size = clampFontSize(px);
  if (size === null) return null;
  if (toolbarSelect) fillFontSizeSelect(toolbarSelect, size);
  if (modalSelect) modalSelect.value = isPresetSize(size) ? String(size) : '';
  if (input) input.value = String(size);
  return size;
}
