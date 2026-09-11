import { tabs, activeTabId, switchTab, closeTab, createNewTab, duplicateTab } from './tabState.js';
import { editorEvents } from '../core/editorEvents.js';
import { saveTextToFile } from '../io/fileIO.js';

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

function updateSaveAllButtonState() {
  const btnSaveAll = document.getElementById('btnSaveAll');
  if (!btnSaveAll) return;
  if (tabs.length >= 2) {
    btnSaveAll.classList.remove('disabled');
  } else {
    btnSaveAll.classList.add('disabled');
  }
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

    // Left-aligned close button (larger, distinct) + status badge + title
    tabEl.innerHTML = `
      <button class="btn-tab-close" title="Close Tab">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
      ${statusBadgeHtml}
      <span class="tab-title">${tab.title}</span>
    `;

    tabEl.addEventListener('click', () => switchTab(tab.id));

    const titleSpan = tabEl.querySelector('.tab-title');
    if (titleSpan) {
      tabEl.addEventListener('dblclick', (e) => {
        // Prevent triggering if clicked on close button
        if (e.target.closest('.btn-tab-close')) return;
        e.stopPropagation();

        const input = document.createElement('input');
        input.type = 'text';
        input.value = tab.title;
        input.className = 'tab-rename-input';
        // Prominent, high-contrast overlay input that fits the tab and ensures text is fully visible
        input.style.cssText = `
          background: var(--bg-primary, #0f172a);
          color: #ffffff;
          border: 1.5px solid var(--accent-color, #38bdf8);
          border-radius: 3px;
          font-size: 0.76rem;
          font-weight: 600;
          font-family: inherit;
          padding: 2px 6px;
          min-width: 110px;
          max-width: 180px;
          outline: none;
          box-shadow: 0 0 8px rgba(56, 189, 248, 0.5);
          z-index: 10;
        `;

        let isHandled = false;
        const saveNewName = async () => {
          if (isHandled) return;
          isHandled = true;
          const newName = input.value.trim();
          if (newName && newName !== tab.title) {
            tab.title = newName;
            tab.isDirty = true;
            editorEvents.emit('onStatusBarUpdateNeeded', tab.title);

            // Auto-persist new name to local autosave cache
            try {
              const content = tab.model ? tab.model.getValue() : '';
              localStorage.setItem(`autosave_${tab.id}`, JSON.stringify({
                title: tab.title,
                content,
                timestamp: Date.now()
              }));
            } catch (err) {
              console.error('Failed to update autosave on rename:', err);
            }
          }
          renderTabs();
        };

        input.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') {
            saveNewName();
          } else if (ke.key === 'Escape') {
            isHandled = true;
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

  // Duplicate Tab Button directly next to tabs
  const btnInlineDuplicateTab = document.createElement('button');
  btnInlineDuplicateTab.className = 'toolbar-btn';
  btnInlineDuplicateTab.id = 'btnDuplicateTabInline';
  btnInlineDuplicateTab.title = 'Duplicate Tab (Copy Document)';
  btnInlineDuplicateTab.style.height = '28px';
  btnInlineDuplicateTab.style.width = '28px';
  btnInlineDuplicateTab.style.padding = '0';
  btnInlineDuplicateTab.style.display = 'flex';
  btnInlineDuplicateTab.style.alignItems = 'center';
  btnInlineDuplicateTab.style.justifyContent = 'center';
  btnInlineDuplicateTab.style.border = 'none';
  btnInlineDuplicateTab.style.background = 'transparent';
  btnInlineDuplicateTab.style.color = 'var(--text-muted)';
  btnInlineDuplicateTab.style.cursor = 'pointer';
  btnInlineDuplicateTab.style.flexShrink = '0';
  btnInlineDuplicateTab.style.marginLeft = '4px';
  btnInlineDuplicateTab.innerHTML = `<span class="material-symbols-outlined" style="font-size: 1.15rem;">&#xf744;</span>`;
  btnInlineDuplicateTab.addEventListener('click', () => duplicateTab());
  tabsContainer.appendChild(btnInlineDuplicateTab);

  // Inline New Tab Button directly next to Duplicate button
  const btnInlineNewTab = document.createElement('button');
  btnInlineNewTab.className = 'toolbar-btn';
  btnInlineNewTab.id = 'btnNewTabInline';
  btnInlineNewTab.title = 'New Tab (Ctrl+T)';
  btnInlineNewTab.style.height = '28px';
  btnInlineNewTab.style.width = '28px';
  btnInlineNewTab.style.padding = '0';
  btnInlineNewTab.style.display = 'flex';
  btnInlineNewTab.style.alignItems = 'center';
  btnInlineNewTab.style.justifyContent = 'center';
  btnInlineNewTab.style.border = 'none';
  btnInlineNewTab.style.background = 'transparent';
  btnInlineNewTab.style.color = 'var(--text-muted)';
  btnInlineNewTab.style.cursor = 'pointer';
  btnInlineNewTab.style.flexShrink = '0';
  btnInlineNewTab.style.marginLeft = '2px';
  btnInlineNewTab.innerHTML = `<span class="material-symbols-outlined" style="font-size: 1.2rem;">&#xf741;</span>`;
  btnInlineNewTab.addEventListener('click', () => createNewTab());
  tabsContainer.appendChild(btnInlineNewTab);

  updateSaveAllButtonState();
}

// Bind event bus listeners
editorEvents.on('onTabRenderNeeded', renderTabs);
editorEvents.on('triggerRpgSavedExpFloat', triggerRpgSavedExpFloat);
