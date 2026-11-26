// Right-click menus for text. The selection is decided with the left button; a right click never changes it.
// The menus follow Windows and Chrome (docs/pointer_rules.csv):
//  - in a text field (input, textarea): Cut, Copy, Paste, Select All
//  - on read-only text (chat history, log, any selected text): Copy, Select All
// Monaco and the editor tabs keep their own menus; window parts without text keep the "open settings" menu (jumpContextMenu.js).
// Register before initJumpContextMenu so that a text field never gets the settings menu instead of its edit menu.
import { t } from '../../core/i18n.js';
import { resolveJump } from '../settings/jumpContextMenu.js';

// Read-only areas where a right click anywhere offers Copy and Select All
const READONLY_TEXT_AREAS = '#llmChatMessages, .log-entries-container';
// input types that hold text; the others (checkbox, range, color, button...) are controls
const TEXT_INPUT = 'input:not([type]), input[type="text"], input[type="search"], input[type="password"], input[type="number"], input[type="url"], input[type="email"], input[type="tel"], textarea';

let menuEl = null;

/**
 * Pure decision: which menu a right click gets.
 * @param {{ inTextField: boolean, inSelection: boolean, inReadonlyArea: boolean }} hit
 * @returns {'edit' | 'copy' | null}
 */
export function textMenuKind(hit) {
  if (hit.inTextField) return 'edit';
  if (hit.inSelection || hit.inReadonlyArea) return 'copy';
  return null;
}

function closeMenu() {
  if (!menuEl) return;
  menuEl.remove();
  menuEl = null;
  document.removeEventListener('mousedown', onOutsidePress, true);
  document.removeEventListener('keydown', onMenuKey, true);
  window.removeEventListener('blur', closeMenu);
  window.removeEventListener('resize', closeMenu);
}

function onOutsidePress(e) {
  if (menuEl && !menuEl.contains(e.target)) closeMenu();
}

function onMenuKey(e) {
  if (e.key === 'Escape') closeMenu();
}

function fieldSelection(field) {
  return field.value.slice(field.selectionStart ?? 0, field.selectionEnd ?? 0);
}

function replaceSelection(field, text) {
  field.focus();
  field.setRangeText(text, field.selectionStart ?? 0, field.selectionEnd ?? 0, 'end');
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

function editItems(field) {
  const selected = fieldSelection(field);
  const editable = !field.readOnly && !field.disabled;
  return [
    { label: t('menu_edit_cut'), enabled: editable && selected !== '', run: () => { void navigator.clipboard.writeText(selected); replaceSelection(field, ''); } },
    { label: t('menu_edit_copy'), enabled: selected !== '', run: () => { void navigator.clipboard.writeText(selected); } },
    { label: t('menu_edit_paste'), enabled: editable, run: async () => { const text = await navigator.clipboard.readText(); if (text) replaceSelection(field, text); } },
    { label: t('menu_edit_select_all'), enabled: field.value !== '', run: () => { field.focus(); field.select(); } }
  ];
}

function copyItems(scope, jump) {
  const selected = window.getSelection()?.toString() ?? '';
  const items = [
    { label: t('menu_edit_copy'), enabled: selected !== '', run: () => { void navigator.clipboard.writeText(selected); } },
    { label: t('menu_edit_select_all'), enabled: true, run: () => {
      const range = document.createRange();
      range.selectNodeContents(scope);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } }
  ];
  // A part that has a settings row keeps its "open settings" entry beside the copy entries
  if (jump) {
    items.push({ label: t('ctx_open_settings_item'), enabled: true, run: () => {
      window.dispatchEvent(new CustomEvent('app:openSettings', { detail: { tab: jump.tab, card: jump.card || undefined } }));
    } });
  }
  return items;
}

function showMenu(x, y, items) {
  closeMenu();
  const menu = document.createElement('div');
  menu.className = 'jump-context-menu';
  menu.setAttribute('role', 'menu');
  for (const item of items) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tab-context-menu-item';
    button.setAttribute('role', 'menuitem');
    button.disabled = !item.enabled;
    button.textContent = item.label;
    button.addEventListener('click', () => { closeMenu(); void item.run(); });
    menu.append(button);
  }
  document.body.append(menu);
  const box = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(4, Math.min(x, window.innerWidth - box.width - 4))}px`;
  menu.style.top = `${Math.max(4, Math.min(y, window.innerHeight - box.height - 4))}px`;
  menuEl = menu;
  document.addEventListener('mousedown', onOutsidePress, true);
  document.addEventListener('keydown', onMenuKey, true);
  window.addEventListener('blur', closeMenu);
  window.addEventListener('resize', closeMenu);
}

export function initTextContextMenu() {
  document.addEventListener('contextmenu', (e) => {
    if (e.defaultPrevented) return;
    const target = e.target;
    if (!(target instanceof Element) || target.closest('#monacoContainer')) return;
    const field = target.closest(TEXT_INPUT);
    const sel = window.getSelection();
    const readonlyArea = target.closest(READONLY_TEXT_AREAS);
    const inSelection = !!sel && !sel.isCollapsed && sel.containsNode(target, true);
    const kind = textMenuKind({
      inTextField: !!field,
      inSelection,
      inReadonlyArea: !!readonlyArea
    });
    if (!kind) return;
    e.preventDefault();
    const part = target.closest('[data-ui]');
    const scope = readonlyArea || part || document.body;
    showMenu(e.clientX, e.clientY, kind === 'edit' ? editItems(field) : copyItems(scope, resolveJump(part?.getAttribute('data-ui'))));
  });
}
