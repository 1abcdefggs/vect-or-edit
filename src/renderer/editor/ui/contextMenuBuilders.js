import { icons } from '../../core/icons.js';
import { t } from '../../core/i18n.js';
import { insertTextIntoEditor } from '../core/editorCore.js';
import { triggerSearchAndRender } from '../../search/vectorSearch.js';
import { getQuickMatches } from '../../search/dictionary.js';
import { canUseEmbedding, canUseLlm } from '../../core/aiAccess.js';
import { openGoogleSearch, openLlmChat } from '../../core/externalActions.js';

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

// Chat icon and label of the "LLM Chat & Rewrite" entry, used by both menus
function llmChatInnerHtml() {
  return `<span class="material-symbols-outlined" style="font-size: var(--icon-text-size); color: var(--overlay-accent, #1d4ed8);">chat</span> <span>${t('ctx_llm_chat_rewrite')}</span>`;
}

export function buildPillMenu({ selectedText, onSelectCallback, onDismiss }) {
  const menu = document.createElement('div');
  menu.className = 'custom-context-menu compact-suggest-pill';

  const topRow = document.createElement('div');
  topRow.className = 'pill-top-row';
  topRow.style.flexDirection = 'column';
  topRow.style.alignItems = 'stretch';

  // AI Suggest has something to run with while either switch is on (the dictionary search itself always works)
  const modelReady = canUseEmbedding() || canUseLlm();

  const btnSuggest = createMenuButton({
    className: 'pill-action-btn primary',
    title: modelReady ? t('suggest_context_menu') : t('ai_suggest_model_unset_title'),
    // Disabled items are greyed, so the reason is a second line in normal text colour, not part of the grey label
    innerHTML: modelReady
      ? `${icons.search} <span>${t('ctx_ai_suggest_label')}</span>`
      : `${icons.search} <span>${t('ctx_ai_suggest_label')}</span><span style="display: block; font-size: var(--fs-11); color: var(--overlay-muted); white-space: normal;">${t('ai_suggest_reason_no_model')}</span>`,
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

  const btnLlmChat = createMenuButton({
    className: 'pill-action-btn secondary',
    title: t('tip_ctx_llm_chat_rewrite'),
    innerHTML: llmChatInnerHtml(),
    onClick: () => {
      onDismiss();
      openLlmChat(selectedText);
    }
  });
  topRow.appendChild(btnLlmChat);

  const btnQuickGoogle = createMenuButton({
    className: 'pill-action-btn secondary',
    title: t('action_google_search'),
    innerHTML: `${icons.google} <span>${t('action_google_search')}</span> <span class="external-action-icon">↗</span>`,
    onClick: () => {
      onDismiss();
      openGoogleSearch(selectedText);
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
      innerHTML: `${icons.search} <span>${t('suggest_context_menu')}</span>`,
      onClick: () => {
        onDismiss();
        triggerSearchAndRender(selectedText);
      }
    });
    menu.appendChild(btnVector);

    const btnLlm = createMenuButton({
      className: 'custom-context-menu-item',
      innerHTML: llmChatInnerHtml(),
      onClick: () => {
        onDismiss();
        openLlmChat(selectedText);
      }
    });
    menu.appendChild(btnLlm);

    const btnGoogle = createMenuButton({
      className: 'custom-context-menu-item',
      innerHTML: `${icons.google} <span>${t('action_google_search')}</span>`,
      onClick: () => {
        onDismiss();
        openGoogleSearch(selectedText);
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
      { label: t('menu_edit_copy'), icon: icons.copy, action: () => navigator.clipboard.writeText(selectedText) },
      { label: t('menu_edit_cut'), icon: icons.cut, action: () => { navigator.clipboard.writeText(selectedText); insertTextIntoEditor(''); } }
    );
  } else {
    standardActions.push(
      { label: t('ctx_copy_all'), icon: icons.copy, action: () => {
        const editor = window.monacoEditorInstance;
        const allText = editor?.getValue() || '';
        if (allText) navigator.clipboard.writeText(allText);
      }}
    );
  }

  standardActions.push(
    { label: t('menu_edit_paste'), icon: icons.paste, action: async () => { const text = await navigator.clipboard.readText(); if (text) insertTextIntoEditor(text); } }
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
    innerHTML: `<span class="material-symbols-outlined" style="font-size: var(--icon-text-size);">restart_alt</span> <span>${t('ctx_reset_layout')}</span>`,
    onClick: () => {
      onDismiss();
      window.dispatchEvent(new CustomEvent('app:resetUIVisibility'));
    }
  });
  menu.appendChild(btnResetLayout);

  const btnSettings = createMenuButton({
    className: 'custom-context-menu-item',
    innerHTML: `${icons.settings} <span>${t('ctx_open_settings')}</span>`,
    onClick: () => {
      onDismiss();
      window.dispatchEvent(new CustomEvent('app:openSettings', { detail: { tab: 'tabAppearance' } }));
    }
  });
  menu.appendChild(btnSettings);

  return menu;
}
