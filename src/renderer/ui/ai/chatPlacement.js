/**
 * Moves the AI chat area between its two places: below the editor, or as a tab of the right sidebar.
 *
 * There is one chat element (#editorLlmChatDock). Placing it means moving that element to the other parent, so the
 * conversation, the draft in the input box and every id stay (owner decision 2026-11-22, planned.csv S06, P41-P43).
 * The place is one remembered value; the settings row, the right-click items of the AI button and the move button in
 * the chat header all go through setChatPlacement, so they cannot disagree.
 *
 * Two body classes carry the state for CSS:
 *   chat-in-sidebar      the chat belongs to the sidebar (the tab row is shown, the minimize button is not)
 *   sidebar-chat-mode    the chat tab is the one shown (the Collection side steps back)
 */
import { readStorage, writeStorage } from '../../core/storage.js';
import { STORAGE_KEYS } from '../../core/constants.js';
import { aiManager } from '../../core/aiStateManager.js';
import { icons } from '../../core/icons.js';
import { t } from '../../core/i18n.js';
import { syncSettingsToBackend } from '../settings/settingsState.js';
import { normalizeChatPlacement, otherChatPlacement } from './chatPlacementRule.js';

const BODY_IN_SIDEBAR = 'chat-in-sidebar';
const BODY_CHAT_TAB = 'sidebar-chat-mode';

let els = null;
// Where the dock sits in the editor column, so it can go back to the same place
let home = null;
let lastLlmOn = false;

export function getChatPlacement() {
  return normalizeChatPlacement(readStorage(STORAGE_KEYS.LLM_CHAT_PLACEMENT));
}

/** Remembers the place and moves the chat there. The one entry point for every control that changes the place. */
export function setChatPlacement(placement) {
  const next = normalizeChatPlacement(placement);
  if (next === getChatPlacement()) return;
  writeStorage(STORAGE_KEYS.LLM_CHAT_PLACEMENT, next);
  void syncSettingsToBackend();
  applyPlacement();
  window.dispatchEvent(new CustomEvent('app:chatPlacementChanged', { detail: { placement: next } }));
}

/**
 * Puts the chat in a place and makes it visible when the chat is on. Used by the right-click items:
 * a chat that is off is switched on through the title-bar button, which also asks for the setup when it is missing.
 */
export function openChatIn(placement) {
  setChatPlacement(placement);
  if (aiManager.getState().llm) {
    selectSidebarTab(getChatPlacement() === 'sidebar' ? 'chat' : 'collection');
    return;
  }
  document.getElementById('btnEditorAiToggle')?.click();
}

function layoutEditor() {
  window.monacoEditorInstance?.layout?.();
  window.__monacoEditorInstance?.layout?.();
}

function expandSidebar() {
  const sidebar = document.getElementById('suggestionSidebar');
  if (sidebar?.classList.contains('collapsed')) document.getElementById('btnRailExpand')?.click();
}

/** Shows the chat tab or the Collection tab. Only the sidebar placement has tabs; below the editor the Collection side is always shown. */
export function selectSidebarTab(tab) {
  if (!els) return;
  const chat = tab === 'chat' && getChatPlacement() === 'sidebar';
  document.body.classList.toggle(BODY_CHAT_TAB, chat);
  els.tabChat.setAttribute('aria-selected', String(chat));
  els.tabChat.classList.toggle('active', chat);
  els.tabCollection.setAttribute('aria-selected', String(!chat));
  els.tabCollection.classList.toggle('active', !chat);
  if (chat) els.tabChat.classList.remove('has-unread');
  paintOffNotice();
}

/** With the chat off, its tab shows a short note and a way to switch it on, instead of an empty pane. */
function paintOffNotice() {
  if (!els) return;
  els.off.hidden = aiManager.getState().llm;
}

function paintMoveButton() {
  if (!els?.move) return;
  const toSidebar = getChatPlacement() === 'below';
  els.move.innerHTML = toSidebar ? icons.panelRight : icons.panelBottom;
  const key = toSidebar ? 'tip_llm_move_to_sidebar' : 'tip_llm_move_below';
  els.move.title = t(key);
  els.move.dataset.i18nTitle = key;
}

function applyPlacement() {
  if (!els) return;
  const inSidebar = getChatPlacement() === 'sidebar';
  document.body.classList.toggle(BODY_IN_SIDEBAR, inSidebar);
  els.tabs.hidden = !inSidebar;
  els.pane.hidden = !inSidebar;
  if (inSidebar) {
    // The sidebar pane has no minimize: a collapsed dock would leave only its header there
    els.dock.classList.remove('collapsed');
    const collapseIcon = document.getElementById('llmCollapseIcon');
    if (collapseIcon) collapseIcon.innerHTML = icons.minus;
    els.pane.append(els.dock);
  } else {
    home.parent.insertBefore(els.dock, home.next && home.next.parentNode === home.parent ? home.next : null);
  }
  paintMoveButton();
  const on = aiManager.getState().llm;
  selectSidebarTab(inSidebar && on ? 'chat' : 'collection');
  if (inSidebar && on) expandSidebar();
  layoutEditor();
}

function paintTabState(state) {
  els.tabChat.classList.toggle('is-on', state.llm);
}

export function initChatPlacement() {
  const dock = document.getElementById('editorLlmChatDock');
  const pane = document.getElementById('sidebarChatPane');
  const tabs = document.getElementById('sidebarTabs');
  const tabCollection = document.getElementById('btnSidebarTabCollection');
  const tabChat = document.getElementById('btnSidebarTabChat');
  const off = document.getElementById('sidebarChatOff');
  const btnOn = document.getElementById('btnSidebarChatOn');
  const move = document.getElementById('btnLlmMove');
  if (!dock || !pane || !tabs || !tabCollection || !tabChat || !off) return;

  els = { dock, pane, tabs, tabCollection, tabChat, off, move };
  home = { parent: dock.parentElement, next: dock.nextSibling };
  lastLlmOn = aiManager.getState().llm;

  tabCollection.addEventListener('click', () => selectSidebarTab('collection'));
  tabChat.addEventListener('click', () => selectSidebarTab('chat'));
  btnOn?.addEventListener('click', () => document.getElementById('btnEditorAiToggle')?.click());
  move?.addEventListener('click', () => setChatPlacement(otherChatPlacement(getChatPlacement())));

  // The chat is asked for (title-bar switch, Ctrl+K, the editor's right-click menu): show it where it lives
  window.addEventListener('app:openLlmChat', () => {
    if (getChatPlacement() !== 'sidebar') return;
    expandSidebar();
    selectSidebarTab('chat');
  });
  // A reply that arrives while the Collection tab is shown puts a dot on the chat tab
  window.addEventListener('app:llmReply', () => {
    if (getChatPlacement() === 'sidebar' && !document.body.classList.contains(BODY_CHAT_TAB)) tabChat.classList.add('has-unread');
  });
  window.addEventListener('app:aiStateChanged', (e) => {
    const state = e.detail.state;
    paintTabState(state);
    // Switching the chat off while its tab is shown goes back to the Collection tab, so the pane is not left empty
    if (lastLlmOn && !state.llm && document.body.classList.contains(BODY_CHAT_TAB)) selectSidebarTab('collection');
    lastLlmOn = state.llm;
    paintOffNotice();
  });
  window.addEventListener('app:languageChanged', paintMoveButton);

  paintTabState(aiManager.getState());
  applyPlacement();
}
