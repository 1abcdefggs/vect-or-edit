import { STORAGE_KEYS, DEFAULTS } from '../../core/constants.js';
import { buildPillMenu, buildPatternAMenu, buildPatternBMenu } from './contextMenuBuilders.js';

let activeContextMenu = null;

export function removeContextMenu() {
  if (activeContextMenu) {
    activeContextMenu.remove();
    activeContextMenu = null;
  }
}

function calculateMenuPosition(x, y, width, height) {
  let left = x;
  let top = y;

  if (left < 10) left = 10;
  if (left + width > window.innerWidth - 15) {
    left = window.innerWidth - width - 15;
  }
  if (top + height > window.innerHeight - 30) {
    top = Math.max(40, y - height - 10);
  }
  if (top < 40) top = 40;

  return { left, top };
}

export function showSelectionPopoverMenu(x, y, selectedText, onSelectCallback, triggerType = 'selection') {
  removeContextMenu();
  if (triggerType === 'selection' && (!selectedText || !selectedText.trim())) return;

  const mode = localStorage.getItem(STORAGE_KEYS.SUGGEST_TRIGGER_MODE) || DEFAULTS.SUGGEST_TRIGGER_MODE;
  if (triggerType === 'selection' && mode === 'manual') return;

  let menu;
  let estWidth = 260;
  let estHeight = 36;

  if (triggerType === 'selection') {
    const { menu: pillMenu, hasMatches } = buildPillMenu({
      selectedText,
      onSelectCallback,
      onDismiss: removeContextMenu
    });
    menu = pillMenu;
    estHeight = hasMatches ? 70 : 36;
  } else {
    const pattern = localStorage.getItem(STORAGE_KEYS.CONTEXT_MENU_PATTERN) || DEFAULTS.CONTEXT_MENU_PATTERN || 'patternA';
    if (pattern === 'patternB') {
      menu = buildPatternBMenu({ selectedText, onDismiss: removeContextMenu });
      estWidth = 240;
      estHeight = 180;
    } else {
      menu = buildPatternAMenu({ selectedText, onDismiss: removeContextMenu });
      estWidth = 200;
      estHeight = 250;
    }
  }

  const { left, top } = calculateMenuPosition(x, y, estWidth, estHeight);
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;

  document.body.appendChild(menu);
  activeContextMenu = menu;
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    if (activeContextMenu && !activeContextMenu.contains(e.target)) {
      removeContextMenu();
    }
  });
}
