import { icons } from '../../core/icons.js';
import { t } from '../../core/i18n.js';
import { insertTextIntoEditor } from '../core/editorCore.js';
import { triggerSearchAndRender } from '../../search/vectorSearch.js';
import { getQuickMatches, hasKnowledgeDictionary } from '../../search/dictionary.js';
import { knowledgeSearchBlocker, llmChatBlocker } from '../../core/aiAccess.js';
import { isGoogleSearchEnabled, openGoogleSearch, openLlmChat } from '../../core/externalActions.js';

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

function llmChatInnerHtml(blocker, withReason = true) {
  const reason = blocker && withReason
    ? `<span style="display: block; font-size: var(--fs-11); color: var(--overlay-muted); white-space: normal;">${t(LLM_REASON_KEYS[blocker])}</span>`
    : '';
  return `<span class="material-symbols-outlined" style="font-size: var(--menu-icon-glyph, var(--icon-text-size)); color: var(--overlay-accent, #1d4ed8);">chat</span> <span style="display: flex; flex-direction: column; align-items: flex-start;"><span>${t('ctx_llm_chat_rewrite')}</span>${reason}</span>`;
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

const symbol = (name) => `<span class="material-symbols-outlined" style="font-size: var(--menu-icon-glyph, var(--icon-text-size));">${name}</span>`;

function appendSeparator(menu) {
  const separator = document.createElement('div');
  separator.className = 'custom-context-menu-separator';
  menu.appendChild(separator);
}

/** Entries that share one line (Copy | Cut | Paste, Undo | Redo, ...). */
function appendRow(menu, buttons) {
  const row = document.createElement('div');
  row.className = 'custom-context-menu-row';
  buttons.forEach((btn) => row.appendChild(btn));
  menu.appendChild(row);
}

/**
 * Right-click menu of the editor. One component for both cases; the selection only decides what is shown.
 * Order (provisional, owner 20261127): Copy | Cut | Paste first, then the search entries (selection only),
 * then Undo | Redo, then the editor width entries and Settings.
 */
export function buildPatternAMenu({ selectedText, onDismiss }) {
  const menu = document.createElement('div');
  menu.className = 'custom-context-menu context-menu-full pattern-a-vertical';

  const hasText = !!(selectedText && selectedText.trim());
  const model = window.monacoEditorInstance?.getModel?.();

  // One entry: dismisses the menu, then runs its action. An inactive entry says why in its tooltip.
  const entry = ({ label, icon, action, disabledReason, primary = false }) => {
    const btn = createMenuButton({
      className: primary ? 'custom-context-menu-item custom-context-menu-item-primary' : 'custom-context-menu-item',
      title: disabledReason || '',
      innerHTML: `${icon} <span>${label}</span>`,
      onClick: () => {
        onDismiss();
        action();
      }
    });
    if (disabledReason) btn.disabled = true;
    return btn;
  };
  const runEditorCommand = (command) => () => {
    const editor = window.monacoEditorInstance;
    if (!editor) return;
    editor.focus();
    editor.trigger('contextmenu', command, null);
  };
  const runEditorAction = (actionId) => () => {
    const editor = window.monacoEditorInstance;
    if (!editor) return;
    editor.focus();
    editor.getAction(actionId)?.run();
  };

  const copyEntry = hasText
    ? entry({ label: t('menu_edit_copy'), icon: icons.copy, action: () => navigator.clipboard.writeText(selectedText) })
    : entry({ label: t('ctx_copy_all'), icon: icons.copy, action: () => {
      const allText = window.monacoEditorInstance?.getValue() || '';
      if (allText) navigator.clipboard.writeText(allText);
    } });
  const cutEntry = entry({ label: t('menu_edit_cut'), icon: icons.cut, action: () => { navigator.clipboard.writeText(selectedText); insertTextIntoEditor(''); } });
  const pasteEntry = entry({ label: t('menu_edit_paste'), icon: icons.paste, action: async () => { const text = await navigator.clipboard.readText(); if (text) insertTextIntoEditor(text); } });
  // Paste is active only while the clipboard holds text
  pasteEntry.disabled = true;
  navigator.clipboard.readText().then((text) => { pasteEntry.disabled = !text; }).catch(() => { pasteEntry.disabled = false; });
  const selectAllEntry = entry({ label: t('menu_edit_select_all'), icon: symbol('select_all'), action: runEditorAction('editor.action.selectAll') });

  // 0. Dictionary candidates for the selected word, first in the menu (only when the dictionary has a match).
  // Plain string matching on the loaded dictionary, so it works whether Embedding is on or off.
  if (hasText && hasKnowledgeDictionary()) {
    const candidates = getQuickMatches(selectedText) || [];
    if (candidates.length > 0) {
      const list = document.createElement('div');
      list.className = 'pill-quick-candidates pill-quick-candidates--top';
      candidates.forEach((item) => {
        const title = item.name || item.title || item.code || '';
        const desc = item.kana || item.description || item.subtitle || '';
        list.appendChild(createMenuButton({
          className: 'pill-candidate-chip',
          title: t('tip_insert_candidate', { label: `${title} ${desc ? `(${desc})` : ''}`.trim() }),
          innerHTML: `<span class="chip-title">${title}</span>${desc ? `<span class="chip-desc">${desc}</span>` : ''}`,
          onClick: () => {
            onDismiss();
            insertTextIntoEditor(title);
          }
        }));
      });
      menu.appendChild(list);
      appendSeparator(menu);
    }
  }

  // 1. Copy | Cut | Paste with a selection; Copy All | Paste | Select All without one
  appendRow(menu, hasText ? [copyEntry, cutEntry, pasteEntry] : [copyEntry, pasteEntry, selectAllEntry]);
  appendSeparator(menu);

  // 2. Search entries, only with a selection
  if (hasText) {
    // AI Chat | Search Knowledge on one line: the chat sits left and the knowledge search right, as the editor and the panel do in the window
    const llmBlocker = llmChatBlocker();
    const btnLlm = createMenuButton({
      className: 'custom-context-menu-item',
      title: t('ctx_llm_chat_rewrite'),
      innerHTML: `<span class="material-symbols-outlined" style="font-size: var(--menu-icon-glyph, var(--icon-text-size)); color: var(--overlay-accent, #1d4ed8);">chat</span> <span>${t('ctx_chat_short')}</span>`,
      onClick: () => {
        onDismiss();
        openLlmChat(selectedText);
      }
    });
    // The two entries are short on purpose (AI Chat | Vector): the full name is the tooltip, and when one is inactive the reason replaces it
    if (llmBlocker) {
      btnLlm.disabled = true;
      btnLlm.title = t(LLM_REASON_KEYS[llmBlocker]);
    }

    const blocker = knowledgeSearchBlocker(hasKnowledgeDictionary());
    const btnVector = createMenuButton({
      className: 'custom-context-menu-item custom-context-menu-item-primary',
      title: t('suggest_context_menu'),
      innerHTML: `${icons.search} <span>${t('ctx_vector_short')}</span>`,
      onClick: () => {
        onDismiss();
        triggerSearchAndRender(selectedText);
      }
    });
    if (blocker) {
      btnVector.disabled = true;
      btnVector.title = t(BLOCKER_REASON_KEYS[blocker]);
    }
    appendRow(menu, [btnLlm, btnVector]);

    // Offered only while Google search is on in the settings; the arrow tells that it opens the web browser
    if (isGoogleSearchEnabled()) {
      const googleEntry = entry({
        label: t('action_google_search'),
        icon: icons.google,
        action: () => openGoogleSearch(selectedText)
      });
      googleEntry.title = t('tip_external_link');
      const where = 'beforeend';
      const arrow = `<span class="external-action-icon" aria-hidden="true">${icons.externalLink}</span>`;
      googleEntry.insertAdjacentHTML(where, arrow);
      menu.appendChild(googleEntry);
    }
    menu.appendChild(selectAllEntry);
    appendSeparator(menu);
  }

  // 3. Undo | Redo, inactive while there is nothing to undo or redo
  appendRow(menu, [
    entry({
      label: t('menu_edit_undo'),
      icon: symbol('undo'),
      action: runEditorCommand('undo'),
      disabledReason: model?.canUndo?.() === false ? t('ctx_undo_empty') : ''
    }),
    entry({
      label: t('menu_edit_redo'),
      icon: symbol('redo'),
      action: runEditorCommand('redo'),
      disabledReason: model?.canRedo?.() === false ? t('ctx_redo_empty') : ''
    })
  ]);
  appendSeparator(menu);

  // 4. Right panel: Hide folds it to its compact rail (the editor gets the width); Show opens it at the default width
  const sidebar = document.getElementById('suggestionSidebar');
  const panelFolded = !!sidebar?.classList.contains('collapsed');
  // One toggle: it names the action that applies now (Hide while the panel is open, Show while it is folded)
  const panelName = document.createElement('span');
  panelName.className = 'custom-context-menu-row-label';
  panelName.textContent = t('ctx_right_panel_label');
  const panelToggle = entry({
    label: panelFolded ? t('ctx_panel_show') : t('ctx_panel_hide'),
    icon: symbol(panelFolded ? 'chevron_left' : 'chevron_right'),
    action: () => window.dispatchEvent(new CustomEvent('app:editorWidth', {
      detail: { mode: panelFolded ? 'default' : 'maximize' }
    }))
  });
  const panelFullName = panelFolded ? t('ctx_right_panel_show') : t('ctx_right_panel_hide');
  panelToggle.title = panelFullName;
  panelToggle.setAttribute('aria-label', panelFullName);
  appendRow(menu, [panelName, panelToggle]);

  // Settings: the gear alone at the bottom right; its name is the tooltip and the accessible name
  const settingsLabel = t('ctx_open_settings');
  const settingsBtn = createMenuButton({
    className: 'custom-context-menu-item custom-context-menu-icon-only',
    title: settingsLabel,
    innerHTML: icons.settings,
    onClick: () => {
      onDismiss();
      window.dispatchEvent(new CustomEvent('app:openSettings', { detail: { tab: 'tabEditor' } }));
    }
  });
  settingsBtn.setAttribute('aria-label', settingsLabel);
  const settingsRow = document.createElement('div');
  settingsRow.className = 'custom-context-menu-row custom-context-menu-row--end';
  settingsRow.appendChild(settingsBtn);
  menu.appendChild(settingsRow);

  return menu;
}
