// Right-click "open settings for this item" on any window part that has a row in the jump table.
// The table is generated from ui_blueprint/jump_targets.csv (see scripts/build-jump-targets.mjs).
// Editor (Monaco) and tab right-clicks keep their own menus and are never replaced here.
import jumpMap from '../../generated/jump_targets.json';
import { t } from '../../core/i18n.js';
import { icons } from '../../core/icons.js';
import { openChatIn } from '../ai/chatPlacement.js';

// Window parts that also offer to open the AI chat in one of its two places (the same remembered value as the settings row)
const CHAT_PART_KEYS = new Set(['edt:ai-toggle', 'edt:llm-dock', 'edt:llm-switch', 'edt:llm-move']);

let menuEl = null;

/**
 * Pure lookup: the jump row for the nearest data-ui part, or null when nothing should be offered.
 * @param {string | null | undefined} partKey
 * @param {Record<string, { tab: string, card: string, control: string }>} [map]
 * @returns {{ tab: string, card: string, control: string } | null}
 */
export function resolveJump(partKey, map = jumpMap) {
  if (!partKey || !Object.prototype.hasOwnProperty.call(map, partKey)) return null;
  return map[partKey];
}

function closeJumpMenu() {
  if (!menuEl) return;
  menuEl.remove();
  menuEl = null;
  document.removeEventListener('mousedown', onOutsidePress, true);
  document.removeEventListener('keydown', onMenuKey, true);
}

function onOutsidePress(e) {
  if (menuEl && !menuEl.contains(e.target)) closeJumpMenu();
}

function onMenuKey(e) {
  if (e.key === 'Escape') closeJumpMenu();
}

function showJumpMenu(x, y, jump, partKey) {
  closeJumpMenu();
  const menu = document.createElement('div');
  menu.className = 'jump-context-menu';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'tab-context-menu-item';
  item.innerHTML = `${icons.settings} <span>${t('ctx_open_settings_item')}</span>`;
  item.addEventListener('click', () => {
    closeJumpMenu();
    window.dispatchEvent(new CustomEvent('app:openSettings', {
      detail: { tab: jump.tab, card: jump.card || undefined }
    }));
  });
  menu.append(item);
  if (CHAT_PART_KEYS.has(partKey)) {
    for (const [placement, key] of [['sidebar', 'ctx_chat_open_sidebar'], ['below', 'ctx_chat_open_below']]) {
      const chatItem = document.createElement('button');
      chatItem.type = 'button';
      chatItem.className = 'tab-context-menu-item';
      chatItem.innerHTML = `<span>${t(key)}</span>`;
      chatItem.addEventListener('click', () => {
        closeJumpMenu();
        openChatIn(placement);
      });
      menu.append(chatItem);
    }
  }
  document.body.append(menu);
  menuEl = menu;
  document.addEventListener('mousedown', onOutsidePress, true);
  document.addEventListener('keydown', onMenuKey, true);
}

export function initJumpContextMenu() {
  document.addEventListener('contextmenu', (e) => {
    // Another handler already answered (tab menu, editor menu), so leave it alone
    if (e.defaultPrevented) return;
    // Inside the Monaco editor the editor's own menu applies
    if (e.target.closest?.('#monacoContainer')) return;
    const part = e.target.closest?.('[data-ui]');
    const jump = resolveJump(part?.getAttribute('data-ui'));
    if (!jump) return;
    e.preventDefault();
    showJumpMenu(e.clientX, e.clientY, jump, part?.getAttribute('data-ui'));
  });
}
