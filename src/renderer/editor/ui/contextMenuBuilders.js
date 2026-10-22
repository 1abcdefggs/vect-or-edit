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

  // LLM Chat & Rewrite button
  const btnLlmChat = createMenuButton({
    className: 'pill-action-btn secondary',
    title: "Start LLM Chat or rewrite with selected text",
    innerHTML: `<span class="material-symbols-outlined" style="font-size: var(--fs-16); color: var(--accent-color, #38bdf8);">chat</span> <span>LLM Chat & Rewrite</span>`,
    onClick: () => {
      onDismiss();
      window.dispatchEvent(new CustomEvent('app:openLlmChat', { detail: { prompt: selectedText } }));
    }
  });
  topRow.appendChild(btnLlmChat);


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
        title: t('tip_insert_candidate', { label: `${title} ${desc ? `(${desc})` : ''}`.trim() }),
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

    const btnLlm = createMenuButton({
      className: 'custom-context-menu-item',
      innerHTML: `<span class="material-symbols-outlined" style="font-size: var(--fs-17); color: var(--accent-color, #38bdf8);">chat</span> <span>LLM Chat & Rewrite</span>`,
      onClick: () => {
        onDismiss();
        window.dispatchEvent(new CustomEvent('app:openLlmChat', { detail: { prompt: selectedText } }));
      }
    });
    menu.appendChild(btnLlm);


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

  const btnResetLayout = createMenuButton({
    className: 'custom-context-menu-item',
    innerHTML: `<span class="material-symbols-outlined" style="font-size: var(--fs-17);">restart_alt</span> <span>Reset Layout (UI Display)</span>`,
    onClick: () => {
      onDismiss();
      window.dispatchEvent(new CustomEvent('app:resetUIVisibility'));
    }
  });
  menu.appendChild(btnResetLayout);

  const btnSettings = createMenuButton({
    className: 'custom-context-menu-item',
    innerHTML: `${icons.settings} <span>Settings (Ctrl+,)...</span>`,
    onClick: () => {
      onDismiss();
      window.dispatchEvent(new CustomEvent('app:openSettings', { detail: { tab: 'tabAppearance' } }));
    }
  });
  menu.appendChild(btnSettings);

  return menu;
}
