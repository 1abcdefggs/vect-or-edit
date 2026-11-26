import { editorEvents } from '../core/editorEvents.js';
import { t } from '../../core/i18n.js';

/**
 * Undo and Redo buttons in the editor tab bar.
 * They run Monaco's own 'undo' and 'redo' commands on the active editor, the same ones the Edit menu uses.
 * Each is inactive while its history is empty, and says why in its tooltip.
 */
function runHistoryCommand(commandId) {
  const editor = window.monacoEditorInstance;
  if (!editor) return;
  editor.focus();
  editor.trigger('toolbar', commandId, null);
}

const BUTTONS = [
  { id: 'btnEditorUndo', command: 'undo', can: 'canUndo', emptyKey: 'ctx_undo_empty', tipKey: 'tip_menu_undo' },
  { id: 'btnEditorRedo', command: 'redo', can: 'canRedo', emptyKey: 'ctx_redo_empty', tipKey: 'tip_menu_redo' }
];

/** Sets each button's inactive state from the active tab's history (the history belongs to each tab's model). */
function refreshHistoryButtons() {
  const model = window.monacoEditorInstance?.getModel?.();
  for (const { id, can, emptyKey, tipKey } of BUTTONS) {
    const btn = document.getElementById(id);
    if (!btn) continue;
    const empty = model?.[can]?.() === false;
    btn.disabled = empty;
    btn.setAttribute('aria-disabled', String(empty));
    btn.title = t(empty ? emptyKey : tipKey);
  }
}

export function initEditorHistoryButtons() {
  for (const { id, command } of BUTTONS) {
    document.getElementById(id)?.addEventListener('click', () => runHistoryCommand(command));
  }
  // The status bar event fires on every edit and tab switch; the history is settled one tick later
  editorEvents.on('onStatusBarUpdateNeeded', () => setTimeout(refreshHistoryButtons, 0));
  refreshHistoryButtons();
}
