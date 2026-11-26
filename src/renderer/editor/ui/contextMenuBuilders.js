import { icons } from '../../core/icons.js';
import { t } from '../../core/i18n.js';
import { insertTextIntoEditor } from '../core/editorCore.js';
import { triggerSearchAndRender } from '../../search/vectorSearch.js';
import { getQuickMatches, hasKnowledgeDictionary } from '../../search/dictionary.js';
import { knowledgeSearchBlocker, llmChatBlocker } from '../../core/aiAccess.js';
import { SIDEBAR_PANE } from '../../ui/layout/paneLimits.js';
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
// While the AI chat is not usable the entry is inactive and the reason is a second line of text
const LLM_REASON_KEYS = {
  llm_off: 'ai_chat_reason_off',
  no_provider: 'ai_chat_reason_no_provider'
};

function llmChatInnerHtml(blocker) {
  const reason = blocker
    ? `<span style="display: block; font-size: var(--fs-11); color: var(--overlay-muted); white-space: normal;">${t(LLM_REASON_KEYS[blocker])}</span>`
    : '';
  return `<span class="material-symbols-outlined" style="font-size: var(--icon-text-size); color: var(--overlay-accent, #1d4ed8);">chat</span> <span style="display: flex; flex-direction: column; align-items: flex-start;"><span>${t('ctx_llm_chat_rewrite')}</span>${reason}</span>`;
}

// "Search Knowledge" needs the Embedding switch ON, a ready model and a dictionary in Knowledge; otherwise the reason is shown in text
const BLOCKER_REASON_KEYS = {
  embed_off: 'ai_suggest_reason_embed_off',
  no_model: 'ai_suggest_reason_no_model',
  no_dictionary: 'ai_suggest_reason_no_dictionary'
};

/** The reason line shown under a disabled "Search Knowledge" entry, or '' when it can run. */
function blockerReasonHtml(blocker) {
  if (!blocker) return '';
  return `<span style="display: block; font-size: var(--fs-11); color: var(--overlay-muted); white-space: normal;">${t(BLOCKER_REASON_KEYS[blocker])}</span>`;
}

export function buildPillMenu({ selectedText, onSelectCallback, onDismiss }) {
  const menu = document.createElement('div');
  menu.className = 'custom-context-menu compact-suggest-pill';

  const topRow = document.createElement('div');
  topRow.className = 'pill-top-row';
  topRow.style.flexDirection = 'column';
  topRow.style.alignItems = 'stretch';

  const blocker = knowledgeSearchBlocker(hasKnowledgeDictionary());
  const modelReady = blocker === null;

  const btnSuggest = createMenuButton({
    className: 'pill-action-btn primary',
    title: modelReady ? t('suggest_context_menu') : t('ai_suggest_model_unset_title'),
    // Disabled items are greyed, so the reason is a second line in normal text colour, not part of the grey label
    innerHTML: `${icons.search} <span>${t('ctx_ai_suggest_label')}</span>${blockerReasonHtml(blocker)}`,
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

  const llmBlocker = llmChatBlocker();
  const btnLlmChat = createMenuButton({
    className: 'pill-action-btn secondary',
    title: t('tip_ctx_llm_chat_rewrite'),
    innerHTML: llmChatInnerHtml(llmBlocker),
    onClick: () => {
      onDismiss();
      openLlmChat(selectedText);
    }
  });
  if (llmBlocker) btnLlmChat.disabled = true;
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

  // Undo | Redo share the first row, with or without a selection
  const historyRow = document.createElement('div');
  historyRow.className = 'custom-context-menu-row';
  [{ label: t('menu_edit_undo'), icon: 'undo', command: 'undo' }, { label: t('menu_edit_redo'), icon: 'redo', command: 'redo' }]
    .forEach(({ label, icon, command }) => {
      historyRow.appendChild(createMenuButton({
        className: 'custom-context-menu-item',
        innerHTML: `<span class="material-symbols-outlined" style="font-size: var(--icon-text-size);">${icon}</span> <span>${label}</span>`,
        onClick: () => {
          onDismiss();
          const editor = window.monacoEditorInstance;
          if (!editor) return;
          editor.focus();
          editor.trigger('contextmenu', command, null);
        }
      }));
    });
  menu.appendChild(historyRow);
  const historySeparator = document.createElement('div');
  historySeparator.className = 'custom-context-menu-separator';
  menu.appendChild(historySeparator);

  if (hasText) {
    const blocker = knowledgeSearchBlocker(hasKnowledgeDictionary());
    const btnVector = createMenuButton({
      className: 'custom-context-menu-item custom-context-menu-item-primary',
      innerHTML: `${icons.search} <span style="display: flex; flex-direction: column; align-items: flex-start;"><span>${t('suggest_context_menu')}</span>${blockerReasonHtml(blocker)}</span>`,
      onClick: () => {
        onDismiss();
        triggerSearchAndRender(selectedText);
      }
    });
    if (blocker) btnVector.disabled = true;
    menu.appendChild(btnVector);

    const llmBlocker = llmChatBlocker();
    const btnLlm = createMenuButton({
      className: 'custom-context-menu-item',
      innerHTML: llmChatInnerHtml(llmBlocker),
      onClick: () => {
        onDismiss();
        openLlmChat(selectedText);
      }
    });
    if (llmBlocker) btnLlm.disabled = true;
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
    { label: t('menu_edit_paste'), icon: icons.paste, action: async () => { const text = await navigator.clipboard.readText(); if (text) insertTextIntoEditor(text); } },
    {
      label: t('menu_edit_select_all'),
      icon: '<span class="material-symbols-outlined" style="font-size: var(--icon-text-size);">select_all</span>',
      action: () => {
        const editor = window.monacoEditorInstance;
        editor?.focus();
        editor?.trigger('contextmenu', 'selectAll', null);
      }
    }
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
    // Paste is active only while the clipboard holds text
    if (act.icon === icons.paste) {
      btn.disabled = true;
      navigator.clipboard.readText().then((text) => { btn.disabled = !text; }).catch(() => { btn.disabled = false; });
    }
  });

  const separator2 = document.createElement('div');
  separator2.className = 'custom-context-menu-separator';
  menu.appendChild(separator2);

  // Editor width: maximize it (the right panel folds to its compact rail) or go back to the default width with the panel open
  const sidebar = document.getElementById('suggestionSidebar');
  const panelFolded = !!sidebar?.classList.contains('collapsed');
  const atDefaultWidth = !panelFolded && Math.abs((sidebar?.getBoundingClientRect().width ?? 0) - SIDEBAR_PANE.defaultWidth) < 2;
  [{
      mode: 'maximize',
      icon: 'width_full',
      label: t('ctx_editor_width_max'),
      off: panelFolded
    }, {
      mode: 'default',
      icon: 'width_normal',
      label: t('ctx_editor_width_default'),
      off: atDefaultWidth
    }]
    .forEach(({ mode, icon, label, off }) => {
      const btn = createMenuButton({
        className: 'custom-context-menu-item',
        innerHTML: `<span class="material-symbols-outlined" style="font-size: var(--icon-text-size);">${icon}</span> <span>${label}</span>`,
        onClick: () => {
          onDismiss();
          window.dispatchEvent(new CustomEvent('app:editorWidth', { detail: { mode } }));
        }
      });
      btn.disabled = off;
      menu.appendChild(btn);
    });

  const btnSettings = createMenuButton({
    className: 'custom-context-menu-item',
    innerHTML: `${icons.settings} <span>${t('ctx_open_settings')}</span>`,
    onClick: () => {
      onDismiss();
      window.dispatchEvent(new CustomEvent('app:openSettings', { detail: { tab: 'tabEditor' } }));
    }
  });
  menu.appendChild(btnSettings);

  return menu;
}
