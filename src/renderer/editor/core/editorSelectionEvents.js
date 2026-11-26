import { showSelectionPopoverMenu, removeContextMenu, removeSelectionPopover } from '../ui/contextMenuManager.js';
import { STORAGE_KEYS, DEFAULTS } from '../../core/constants.js';
import { readStorage } from '../../core/storage.js';

/**
 * Opens a closed right panel when text is selected, if the "Open on selection" setting is on (default off).
 * It only opens; it never closes the panel, and it uses the same toggle button as a click, so the layout updates alike.
 */
function openSidebarOnSelection(selection) {
  if (!selection || selection.isEmpty()) return;
  if (readStorage(STORAGE_KEYS.SIDEBAR_OPEN_ON_SELECTION) !== 'on') return;
  const sidebar = document.getElementById('suggestionSidebar');
  if (sidebar?.classList.contains('collapsed')) {
    document.getElementById('btnHeaderToggleSidebar')?.click();
  }
}

export function setupEditorContextMenu(editor, container) {
  let selectionPopoverTimer = null;
  const dismissSelectionMenus = () => {
    if (selectionPopoverTimer) {
      clearTimeout(selectionPopoverTimer);
      selectionPopoverTimer = null;
    }
    removeContextMenu();
  };

  editor.onContextMenu(dismissSelectionMenus);
  container.addEventListener('contextmenu', dismissSelectionMenus, { capture: true });
  container.addEventListener('mousedown', (e) => {
    if (e.button === 2) dismissSelectionMenus();
  }, { capture: true });
  document.addEventListener('contextmenu', dismissSelectionMenus, { capture: true });

  const triggerSelectionPopover = (source = 'generic') => {
    const mode = readStorage(STORAGE_KEYS.SUGGEST_TRIGGER_MODE) || DEFAULTS.SUGGEST_TRIGGER_MODE;
    if (mode !== 'selection') return;

    if (selectionPopoverTimer) clearTimeout(selectionPopoverTimer);
    selectionPopoverTimer = setTimeout(() => {
      if (!editor) return;
      const selection = editor.getSelection();
      if (selection && !selection.isEmpty()) {
        const text = editor.getModel()?.getValueInRange(selection)?.trim() || '';
        if (text.length > 0) {
          const endPos = editor.getScrolledVisiblePosition({
            lineNumber: selection.endLineNumber,
            column: selection.startColumn
          });

          if (endPos) {
            // Anchor below the bottom edge of the selection's last line, so the menu never covers the selected text
            const containerRect = container.getBoundingClientRect();
            const posX = containerRect.left + endPos.left;
            const posY = containerRect.top + endPos.top + endPos.height + 4;
            showSelectionPopoverMenu(posX, posY, text, null, 'selection');
          }
        } else {
          removeSelectionPopover();
        }
      } else {
        removeSelectionPopover();
      }
    }, source === 'mouse' ? 60 : 350);
  };

  editor.onMouseUp(() => triggerSelectionPopover('mouse'));
  editor.onDidChangeCursorSelection((e) => {
    if (e.source !== 'mouse') {
      triggerSelectionPopover('keyboard');
    }
    openSidebarOnSelection(e.selection);
  });

  editor.onContextMenu((e) => {
    if (e.event) {
      e.event.preventDefault();
      e.event.stopPropagation();
    }
    dismissSelectionMenus();
    const selection = editor.getSelection();
    let text = '';
    if (selection && !selection.isEmpty()) {
      text = editor.getModel()?.getValueInRange(selection)?.trim() || '';
    } else {
      const position = e.target?.position;
      if (position) {
        const word = editor.getModel()?.getWordAtPosition(position);
        if (word?.word) {
          text = word.word;
        }
      }
    }

    const mouseEvent = e.event?.browserEvent;
    let posX = mouseEvent ? mouseEvent.pageX : 100;
    let posY = mouseEvent ? mouseEvent.pageY : 100;

    const targetPos = selection && !selection.isEmpty()
      ? { lineNumber: selection.endLineNumber, column: selection.startColumn }
      : (e.target?.position || { lineNumber: 1, column: 1 });

    const scrolledPos = editor.getScrolledVisiblePosition(targetPos);
    if (scrolledPos && !mouseEvent) {
      const containerRect = container.getBoundingClientRect();
      posX = containerRect.left + scrolledPos.left;
      posY = containerRect.top + scrolledPos.top + 32;
    }

    // The menu opens just below the line that was clicked (below the last line of a selection or word), never over the text
    let avoidTopY;
    if (text || e.target?.position) {
      const containerRect = container.getBoundingClientRect();
      // Wrapped lines have several rows, so the rows are read from the exact start and end positions
      const hasSelection = selection && !selection.isEmpty();
      const word = hasSelection ? null : editor.getModel()?.getWordAtPosition(targetPos);
      const startPos = hasSelection ? selection.getStartPosition() : { lineNumber: targetPos.lineNumber, column: word?.startColumn ?? targetPos.column };
      const endPos = hasSelection ? selection.getEndPosition() : { lineNumber: targetPos.lineNumber, column: word?.endColumn ?? targetPos.column };
      const top = editor.getScrolledVisiblePosition(startPos);
      const bottom = editor.getScrolledVisiblePosition(endPos);
      if (top && bottom) {
        avoidTopY = containerRect.top + top.top;
        posY = containerRect.top + bottom.top + bottom.height + 4;
        // Over a selection or word the menu starts at the lower right of that text
        if (text) posX = containerRect.left + bottom.left;
      }
    }

    showSelectionPopoverMenu(posX, posY, text || '', null, 'context', avoidTopY);
  });
}
