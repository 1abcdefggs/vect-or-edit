// Left press on blank space (not a control, not text, not the editor) clears the keyboard focus.
// Standard: docs/pointer_rules.csv, rows "<region>,blank,left,clear_focus".
// The editor keeps its own caret rule (monaco/blank/left = place_caret); text and controls keep their own focus.
const KEEPS_FOCUS =
  'input, textarea, select, button, a[href], summary, [contenteditable], [tabindex], [role="button"], [role="menuitem"], ' +
  '#monacoContainer, .monaco-editor, .jump-context-menu, .text-context-menu, .tab-context-menu, [class*="resizer"]';

/**
 * Pure rule: should a left press on this element clear the focus?
 * @param {{ closest?: (selector: string) => unknown } | null | undefined} target
 * @param {number} button
 */
export function shouldClearFocus(target, button) {
  if (button !== 0 || !target || typeof target.closest !== 'function') return false;
  return !target.closest(KEEPS_FOCUS);
}

export function initBlankPressFocus() {
  document.addEventListener('mousedown', (e) => {
    if (!shouldClearFocus(e.target, e.button)) return;
    const active = document.activeElement;
    if (active && active !== document.body && typeof active.blur === 'function') active.blur();
  });
}
