import { showSelectionPopoverMenu, removeContextMenu } from '../ui/contextMenuManager.js';
import { STORAGE_KEYS, DEFAULTS } from '../../core/constants.js';

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
    const mode = localStorage.getItem(STORAGE_KEYS.SUGGEST_TRIGGER_MODE) || DEFAULTS.SUGGEST_TRIGGER_MODE;
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
            const containerRect = container.getBoundingClientRect();
            const posX = containerRect.left + endPos.left;
            const posY = containerRect.top + endPos.top + 28;
            showSelectionPopoverMenu(posX, posY, text, null, 'selection');
          }
        } else {
          removeContextMenu();
        }
      } else {
        removeContextMenu();
      }
    }, source === 'mouse' ? 60 : 350);
  };

  editor.onMouseUp(() => triggerSelectionPopover('mouse'));
  editor.onDidChangeCursorSelection((e) => {
    if (e.source !== 'mouse') {
      triggerSelectionPopover('keyboard');
    }
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

    if (text && text.length > 0) {
      const targetPos = selection && !selection.isEmpty()
        ? { lineNumber: selection.endLineNumber, column: selection.startColumn }
        : (e.target?.position || { lineNumber: 1, column: 1 });

      const scrolledPos = editor.getScrolledVisiblePosition(targetPos);
      let posX, posY;

      if (scrolledPos) {
        const containerRect = container.getBoundingClientRect();
        posX = containerRect.left + scrolledPos.left;
        posY = containerRect.top + scrolledPos.top + 32;
      } else {
        const mouseEvent = e.event?.browserEvent;
        posX = mouseEvent ? mouseEvent.pageX : (e.target?.element?.getBoundingClientRect()?.left || 100);
        posY = (mouseEvent ? mouseEvent.pageY : (e.target?.element?.getBoundingClientRect()?.top || 100)) + 20;
      }

      showSelectionPopoverMenu(posX, posY, text, null, 'context');
    }
  });
}
