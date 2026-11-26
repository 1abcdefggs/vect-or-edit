/**
 * The document list button at the right end of the tab row. It opens a menu of every open document, so a
 * document stays reachable when the tab row is scrolled. Choosing one switches to it. Escape or a click
 * outside closes the menu. The tab row itself scrolls sideways (editor.css), so the list is an addition, not a fallback.
 */
import { tabs, activeTabId, switchTab } from './tabState.js';

export function setupTabListMenu() {
  const btn = document.getElementById('btnEditorTabList');
  const bar = document.getElementById('editorTabBar');
  if (!btn || !bar) return;
  let menu = null;

  const onOutside = (e) => {
    if (menu && !menu.contains(e.target) && !btn.contains(e.target)) close();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };

  function close() {
    menu?.remove();
    menu = null;
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onOutside, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', close);
  }

  function open() {
    menu = document.createElement('div');
    menu.className = 'editor-tab-list-menu';
    menu.setAttribute('role', 'menu');
    // The tab row clips its children (overflow: auto), so the menu sits on the body, fixed under the button
    const r = btn.getBoundingClientRect();
    menu.style.top = `${Math.round(r.bottom + 4)}px`;
    menu.style.right = `${Math.round(window.innerWidth - r.right)}px`;
    tabs.forEach((tab) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.setAttribute('role', 'menuitem');
      item.className = 'editor-tab-list-item' + (tab.id === activeTabId ? ' active' : '');
      item.textContent = (tab.isDirty ? '● ' : '') + tab.title;
      item.addEventListener('click', () => {
        close();
        switchTab(tab.id);
      });
      menu.appendChild(item);
    });
    document.body.appendChild(menu);
    btn.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', onOutside, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', close);
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menu) close();
    else open();
  });
}
