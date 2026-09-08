import { icons } from '../../core/icons.js';
import { t } from '../../core/i18n.js';
import { insertTextIntoEditor } from '../core/editorCore.js';
import { duplicateCurrentTab } from '../tabs/tabManager.js';
import { saveTextToFile } from '../io/fileIO.js';
import { triggerSearchAndRender } from '../../search/vectorSearch.js';
import { getQuickMatches } from '../../search/dictionary.js';
import { aiManager } from '../../core/aiStateManager.js';

export function createMenuButton({ className, title, innerHTML, onClick }) {
  const btn = document.createElement('button');
  if (className) btn.className = className;
  if (title) btn.title = title;
  if (innerHTML) btn.innerHTML = innerHTML;
  if (onClick) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick(e);
    });
  }
  return btn;
}

export function buildPillMenu({ selectedText, onSelectCallback, onDismiss }) {
  const menu = document.createElement('div');
  menu.className = 'custom-context-menu compact-suggest-pill';

  const topRow = document.createElement('div');
  topRow.className = 'pill-top-row';
  topRow.style.flexDirection = 'column';
  topRow.style.alignItems = 'stretch';

  const modelReady = Boolean(aiManager?.getState?.().modelConfigured);

  const btnSuggest = createMenuButton({
    className: 'pill-action-btn primary',
    title: modelReady ? (t('suggest_context_menu') || "AI Suggest") : (t('ai_suggest_model_unset_title') || "AI Suggest: Model not configured. Please select or download a model in Settings."),
    innerHTML: `${icons.search} <span>${modelReady ? 'AISUGGEST' : (t('ai_suggest_model_unset_badge') || 'AISUGGEST - No Model')}</span>`,
    onClick: () => {
      if (!modelReady) return;
      onDismiss();
      triggerSearchAndRender(selectedText);
      if (onSelectCallback) onSelectCallback('suggest');
    }
  });
  if (!modelReady) {
    btnSuggest.disabled = true;
    btnSuggest.classList.add('disabled');
  }
  topRow.appendChild(btnSuggest);

  const btnQuickGoogle = createMenuButton({
    className: 'pill-action-btn secondary',
    title: t('action_google_search') || "Search with Google",
    innerHTML: `${icons.google} <span>${t('action_google_search') || "Search with Google"}</span> <span class="external-action-icon">↗</span>`,
    onClick: () => {
      onDismiss();
      const queryUrl = `https://www.google.com/search?q=${encodeURIComponent(selectedText.trim())}`;
      if (window.engineAPI?.openExternal) {
        window.engineAPI.openExternal(queryUrl);
      } else {
        window.open(queryUrl, '_blank');
      }
    }
  });
  topRow.appendChild(btnQuickGoogle);
  menu.appendChild(topRow);

  // Quick dictionary matches
  const quickMatches = getQuickMatches(selectedText);
  if (quickMatches && quickMatches.length > 0) {
    const candidatesContainer = document.createElement('div');
    candidatesContainer.className = 'pill-quick-candidates';

    quickMatches.forEach(item => {
      const title = item.name || item.title || item.code || '';
      const desc = item.kana || item.description || item.subtitle || '';
      const chip = createMenuButton({
        className: 'pill-candidate-chip',
        title: `${title} ${desc ? `(${desc})` : ''} - Click to insert`,
        innerHTML: `
          <span class="chip-title">${title}</span>
          ${desc ? `<span class="chip-desc">${desc}</span>` : ''}
        `,
        onClick: () => {
          onDismiss();
          insertTextIntoEditor(title);
        }
      });
      candidatesContainer.appendChild(chip);
    });
    menu.appendChild(candidatesContainer);
  }

  triggerSearchAndRender(selectedText);
  return { menu, hasMatches: quickMatches && quickMatches.length > 0 };
}

export function buildPatternBMenu({ selectedText, onDismiss }) {
  const menu = document.createElement('div');
  menu.className = 'custom-context-menu context-menu-full pattern-b-grid';

  const topRow = document.createElement('div');
  topRow.className = 'ctx-grid-row top-row';

  const btnVector = createMenuButton({
    className: 'ctx-grid-btn primary-vector-btn',
    innerHTML: `${icons.vector} <span>AI Suggest</span>`,
    onClick: () => {
      onDismiss();
      triggerSearchAndRender(selectedText);
    }
  });
  topRow.appendChild(btnVector);

  const btnGoogle = createMenuButton({
    className: 'ctx-grid-btn secondary-btn',
    innerHTML: `${icons.google} <span>Google</span>`,
    onClick: () => {
      onDismiss();
      const url = `https://www.google.com/search?q=${encodeURIComponent(selectedText.trim())}`;
      if (window.engineAPI?.openExternal) window.engineAPI.openExternal(url);
      else window.open(url, '_blank');
    }
  });
  topRow.appendChild(btnGoogle);
  menu.appendChild(topRow);

  const gridRow = document.createElement('div');
  gridRow.className = 'ctx-grid-actions';

  const actions = [
    { id: 'copy', icon: icons.copy, label: 'Copy', action: () => navigator.clipboard.writeText(selectedText) },
    { id: 'cut', icon: icons.cut, label: 'Cut', action: () => {
      navigator.clipboard.writeText(selectedText);
      insertTextIntoEditor('');
    }},
    { id: 'paste', icon: icons.paste, label: 'Paste', action: async () => {
      const text = await navigator.clipboard.readText();
      if (text) insertTextIntoEditor(text);
    }},
    { id: 'duplicateTab', icon: icons.duplicate, label: 'Dup Tab', action: () => duplicateCurrentTab() },
    { id: 'saveTxt', icon: icons.fileText, label: '.txt', action: () => saveTextToFile(selectedText, 'txt') },
    { id: 'saveMd', icon: icons.markdown, label: '.md', action: () => saveTextToFile(selectedText, 'md') },
  ];

  actions.forEach(act => {
    const btn = createMenuButton({
      className: 'ctx-grid-action-btn',
      innerHTML: `${act.icon} <span>${act.label}</span>`,
      onClick: () => {
        onDismiss();
        act.action();
      }
    });
    gridRow.appendChild(btn);
  });
  menu.appendChild(gridRow);

  const bottomRow = document.createElement('div');
  bottomRow.className = 'ctx-grid-row bottom-row';
  const btnCmd = createMenuButton({
    className: 'ctx-grid-btn full-btn',
    innerHTML: `${icons.terminal} <span>Palette</span>`,
    onClick: () => {
      onDismiss();
      window.dispatchEvent(new CustomEvent('app:openCommandPalette'));
    }
  });
  btnCmd.style.flex = '1';
  bottomRow.appendChild(btnCmd);

  const btnSettings = createMenuButton({
    className: 'ctx-grid-btn secondary-btn',
    title: 'SUGGEST & AI Settings...',
    innerHTML: `${icons.settings}`,
    onClick: () => {
      onDismiss();
      const btnSettingsEl = document.getElementById('btnSettings');
      if (btnSettingsEl) btnSettingsEl.click();
      const tabBtn = document.querySelector('.settings-tab-btn[data-tab="tabAiSearch"]');
      if (tabBtn) tabBtn.click();
    }
  });
  bottomRow.appendChild(btnSettings);
  menu.appendChild(bottomRow);

  return menu;
}

export function buildPatternAMenu({ selectedText, onDismiss }) {
  const menu = document.createElement('div');
  menu.className = 'custom-context-menu context-menu-full pattern-a-vertical';

  const hasText = !!(selectedText && selectedText.trim());

  if (hasText) {
    const btnVector = createMenuButton({
      className: 'custom-context-menu-item custom-context-menu-item-primary',
      innerHTML: `${icons.search} <span>AI Suggest</span>`,
      onClick: () => {
        onDismiss();
        triggerSearchAndRender(selectedText);
      }
    });
    menu.appendChild(btnVector);

    const btnGoogle = createMenuButton({
      className: 'custom-context-menu-item',
      innerHTML: `${icons.google} <span>${t('action_google_search') || "Search with Google"}</span>`,
      onClick: () => {
        onDismiss();
        const url = `https://www.google.com/search?q=${encodeURIComponent(selectedText.trim())}`;
        if (window.engineAPI?.openExternal) window.engineAPI.openExternal(url);
        else window.open(url, '_blank');
      }
    });
    menu.appendChild(btnGoogle);

    const separator1 = document.createElement('div');
    separator1.className = 'custom-context-menu-separator';
    menu.appendChild(separator1);
  }

  const standardActions = [];
  if (hasText) {
    standardActions.push(
      { label: 'Copy', icon: icons.copy, action: () => navigator.clipboard.writeText(selectedText) },
      { label: 'Cut', icon: icons.cut, action: () => { navigator.clipboard.writeText(selectedText); insertTextIntoEditor(''); } }
    );
  } else {
    standardActions.push(
      { label: 'Copy All', icon: icons.copy, action: () => {
        const editor = window.monacoEditorInstance;
        const allText = editor?.getValue() || '';
        if (allText) navigator.clipboard.writeText(allText);
      }}
    );
  }

  standardActions.push(
    { label: 'Paste', icon: icons.paste, action: async () => { const text = await navigator.clipboard.readText(); if (text) insertTextIntoEditor(text); } }
  );

  standardActions.forEach(act => {
    const btn = createMenuButton({
      className: 'custom-context-menu-item',
      innerHTML: `${act.icon} <span>${act.label}</span>`,
      onClick: () => {
        onDismiss();
        act.action();
      }
    });
    menu.appendChild(btn);
  });

  const separator2 = document.createElement('div');
  separator2.className = 'custom-context-menu-separator';
  menu.appendChild(separator2);

  const btnSettings = createMenuButton({
    className: 'custom-context-menu-item',
    innerHTML: `${icons.settings} <span>Settings...</span>`,
    onClick: () => {
      onDismiss();
      const btnSettingsEl = document.getElementById('btnSettings');
      if (btnSettingsEl) btnSettingsEl.click();
      const tabBtn = document.querySelector('.settings-tab-btn[data-tab="tabAiSearch"]');
      if (tabBtn) tabBtn.click();
    }
  });
  menu.appendChild(btnSettings);

  return menu;
}
