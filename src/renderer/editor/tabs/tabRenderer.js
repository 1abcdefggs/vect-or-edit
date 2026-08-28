import { tabs, activeTabId, switchTab, closeTab, createNewTab } from './tabState.js';
import { editorEvents } from '../core/editorEvents.js';

export function triggerRpgSavedExpFloat(tabId = activeTabId) {
  const tabsContainer = document.getElementById('editorTabsList');
  if (!tabsContainer) return;

  const targetTab = tabId ? tabsContainer.querySelector(`[data-tab-id="${tabId}"]`) : tabsContainer.querySelector('.editor-tab-item.active');
  if (!targetTab) return;

  const existing = targetTab.querySelector('.rpg-saved-float');
  if (existing) existing.remove();

  const floatBadge = document.createElement('span');
  floatBadge.className = 'rpg-saved-float';
  floatBadge.textContent = '+Saved ✓';
  targetTab.appendChild(floatBadge);

  setTimeout(() => {
    floatBadge.remove();
  }, 950);
}

export function renderTabs() {
  const tabsContainer = document.getElementById('editorTabsList');
  if (!tabsContainer) return;
  tabsContainer.innerHTML = '';

  tabs.forEach(tab => {
    const tabEl = document.createElement('div');
    tabEl.setAttribute('data-tab-id', tab.id);
    tabEl.className = `editor-tab-item ${tab.id === activeTabId ? 'active' : ''} ${tab.isDirty ? 'is-dirty' : 'is-saved'}`;
    tabEl.title = `${tab.filePath || tab.title} (Double-click to rename)`;

    const statusBadgeHtml = tab.isDirty
      ? `<span class="tab-dirty-dot" title="Unsaved changes"></span>`
      : ``;

    tabEl.innerHTML = `
      <span class="tab-title">${tab.title}</span>
      ${statusBadgeHtml}
      <button class="btn-tab-close" title="Close Tab">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    `;

    tabEl.addEventListener('click', () => switchTab(tab.id));

    const titleSpan = tabEl.querySelector('.tab-title');
    if (titleSpan) {
      tabEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const input = document.createElement('input');
        input.type = 'text';
        input.value = tab.title;
        input.className = 'tab-rename-input';
        input.style.cssText = 'background: var(--bg-primary); color: var(--text-main); border: 1px solid var(--accent-color); border-radius: 3px; font-size: 0.75rem; padding: 1px 4px; width: 110px; outline: none;';

        const saveNewName = () => {
          const newName = input.value.trim();
          if (newName && newName !== tab.title) {
            tab.title = newName;
            tab.isDirty = true;
            editorEvents.emit('onStatusBarUpdateNeeded', tab.title);
          }
          renderTabs();
        };

        input.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') {
            saveNewName();
          } else if (ke.key === 'Escape') {
            renderTabs();
          }
        });
        input.addEventListener('blur', saveNewName);

        titleSpan.replaceWith(input);
        input.focus();
        input.select();
      });
    }

    const btnClose = tabEl.querySelector('.btn-tab-close');
    if (btnClose) {
      btnClose.addEventListener('click', (ev) => closeTab(tab.id, ev));
    }

    tabsContainer.appendChild(tabEl);
  });

  const btnInlineNewTab = document.createElement('button');
  btnInlineNewTab.className = 'btn-new-tab';
  btnInlineNewTab.id = 'btnNewTabInline';
  btnInlineNewTab.title = 'New Document (Ctrl+T)';
  btnInlineNewTab.style.display = 'inline-flex';
  btnInlineNewTab.style.alignItems = 'center';
  btnInlineNewTab.style.gap = '3px';
  btnInlineNewTab.style.padding = '2px 8px';
  btnInlineNewTab.style.fontSize = '0.72rem';
  btnInlineNewTab.style.fontWeight = '600';
  btnInlineNewTab.innerHTML = `<span style="font-size:0.85rem;line-height:1;margin-top:-1px;">＋</span><span>add</span>`;
  btnInlineNewTab.addEventListener('click', () => createNewTab());
  tabsContainer.appendChild(btnInlineNewTab);
}

// Bind event bus listeners
editorEvents.on('onTabRenderNeeded', renderTabs);
editorEvents.on('triggerRpgSavedExpFloat', triggerRpgSavedExpFloat);
