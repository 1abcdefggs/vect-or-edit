/**
 * editorStyleGroupFit.ts - the editor top bar's style group (BG/FG | font family | font size) gives way
 * as the bar narrows. The FONT and SIZE labels are gone: the font name and the px value are clear without
 * them. The BG/FG label stays, because its meaning is not clear without it. The font name is shortened
 * first; closing the group into an overflow menu comes later.
 *
 * The formula is the layout-core solve of the measured bar (layout-core/tools/examples:
 * editor-toolbar-meaning): the rest of the bar takes 456px, the name gets the remainder, 70px to 115px.
 */
export const FONT_NAME_MIN = 70;
export const FONT_NAME_MAX = 115;
const REST_OF_BAR = 456;

/** The width of the font name select at this bar width (in px). */
export function fontNameWidth(barWidth: number): number {
  return Math.max(FONT_NAME_MIN, Math.min(FONT_NAME_MAX, barWidth - REST_OF_BAR));
}

export function initEditorStyleGroupFit(): void {
  const group = document.getElementById('quickEditorToneSelect')?.closest<HTMLElement>('.font-control-integrated-group');
  const bar = group?.parentElement;
  if (!group || !bar) return;

  const apply = () => group.style.setProperty('--font-name-width', `${fontNameWidth(bar.clientWidth)}px`);

  new ResizeObserver(apply).observe(bar);
  apply();
}
