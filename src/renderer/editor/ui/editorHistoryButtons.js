/**
 * Undo and Redo buttons in the editor tab bar.
 * They run Monaco's own 'undo' and 'redo' commands on the active editor, the same ones the Edit menu uses.
 */
function runHistoryCommand(commandId) {
  const editor = window.monacoEditorInstance;
  if (!editor) return;
  editor.focus();
  editor.trigger('toolbar', commandId, null);
}

export function initEditorHistoryButtons() {
  document.getElementById('btnEditorUndo')?.addEventListener('click', () => runHistoryCommand('undo'));
  document.getElementById('btnEditorRedo')?.addEventListener('click', () => runHistoryCommand('redo'));
}
