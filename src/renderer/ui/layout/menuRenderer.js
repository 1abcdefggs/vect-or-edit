/**
 * Writes the menu bar dropdown items from menuDefinitions.js into their containers.
 * menuItemMarkup and menuMarkup are pure string builders (no DOM), so they can be checked without a window.
 */
import { MENU_DROPDOWNS } from './menuDefinitions.js';
import { t } from '../../core/i18n.js';

const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

/** One item as the markup the menu bar controller expects (role, type, command and the tooltip key). */
export function menuItemMarkup(item, translate = t) {
  if (item.separator) return '<div class="menu-divider" role="separator"></div>';
  const hidden = item.hidden ? ' hidden' : '';
  const accelerator = item.accelerator ? `<span class="menu-accelerator">${escapeHtml(item.accelerator)}</span>` : '';
  return `<button class="menu-dropdown-item" id="${item.id}" role="menuitem" type="button"${hidden} data-command="${item.command}" data-i18n-title="${item.tip}">`
    + `<span class="menu-item-label" data-i18n="${item.label}">${escapeHtml(translate(item.label) || item.text)}</span>`
    + `${accelerator}</button>`;
}

/** All items of one menu, in order. */
export function menuMarkup(items, translate = t) {
  return items.map((item) => menuItemMarkup(item, translate)).join('');
}

/** Fills every dropdown container of the menu bar. Runs once at startup, after the locale is loaded. */
export function renderMenuDropdowns(root = document) {
  Object.entries(MENU_DROPDOWNS).forEach(([containerId, items]) => {
    const container = root.getElementById(containerId);
    if (container) container.innerHTML = menuMarkup(items);
  });
}
