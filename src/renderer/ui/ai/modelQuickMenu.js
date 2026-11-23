/**
 * The quick model menu of the chat header: press the model button, pick a model, keep chatting.
 *
 * It writes the same stored model, with the same sync and change event, as the settings page and the Models tab of the
 * log panel, so all three always show the same choice. The long list (search, sorting, descriptions) stays in the Models
 * tab, which the last item opens. Without a list the Gemini menu offers to fetch it.
 *
 * Public surface: openModelQuickMenu(anchor, { canOpen, onSetup }), closeModelQuickMenu.
 */
import { readStorage, writeStorage } from '../../core/storage.js';
import { CHAT_MODELS_CHECKED_ON, formatEnglishDate } from '../../../shared/chatModels';
import { STORAGE_KEYS, DEFAULTS } from '../../core/constants.js';
import { readGeminiModel } from '../../core/geminiModel.js';
import { icons } from '../../core/icons.js';
import { t } from '../../core/i18n.js';
import { syncSettingsToBackend } from '../settings/settingsState.js';
import { rememberGeminiModels } from '../settings/geminiModelPicker.js';
import { isValidGeminiModelId } from '../../../shared/geminiModels';
import { quickModels } from './modelQuickList.js';

const PROVIDERS = ['gemini', 'openai', 'claude'];

let menuEl = null;
let anchorEl = null;

function readCachedGeminiList() {
  try {
    const list = JSON.parse(readStorage('cached_gemini_models') || 'null');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function currentModel(provider) {
  if (provider === 'gemini') return readGeminiModel();
  if (provider === 'openai') return readStorage(STORAGE_KEYS.OPENAI_MODEL) || DEFAULTS.OPENAI_MODEL;
  return readStorage(STORAGE_KEYS.CLAUDE_MODEL) || DEFAULTS.CLAUDE_MODEL;
}

function storeModel(provider, id) {
  if (provider === 'gemini' && !isValidGeminiModelId(id)) return;
  const key = provider === 'gemini' ? STORAGE_KEYS.GEMINI_MODEL : provider === 'openai' ? STORAGE_KEYS.OPENAI_MODEL : STORAGE_KEYS.CLAUDE_MODEL;
  writeStorage(key, id);
  void syncSettingsToBackend();
  window.dispatchEvent(new Event('app:settingsChanged'));
}

export function closeModelQuickMenu() {
  if (!menuEl) return;
  menuEl.remove();
  menuEl = null;
  document.removeEventListener('mousedown', onOutsidePress, true);
  document.removeEventListener('keydown', onMenuKey, true);
  window.removeEventListener('resize', closeModelQuickMenu);
  anchorEl?.setAttribute('aria-expanded', 'false');
}

function onOutsidePress(e) {
  if (menuEl && !menuEl.contains(e.target) && !anchorEl?.contains(e.target)) closeModelQuickMenu();
}

function onMenuKey(e) {
  if (!menuEl) return;
  const items = [...menuEl.querySelectorAll('button')];
  const at = items.indexOf(document.activeElement);
  if (e.key === 'Escape') {
    e.preventDefault();
    closeModelQuickMenu();
    anchorEl?.focus();
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    items[(at + 1) % items.length]?.focus();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    items[(at - 1 + items.length) % items.length]?.focus();
  } else if (e.key === 'Tab') {
    closeModelQuickMenu();
  }
}

function addButton(menu, { label, checked, role = 'menuitemradio', onPick, className = '' }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `tab-context-menu-item model-quick-item ${className}`.trim();
  button.setAttribute('role', role);
  if (role === 'menuitemradio') button.setAttribute('aria-checked', String(Boolean(checked)));
  const mark = document.createElement('span');
  mark.className = 'model-quick-check';
  mark.setAttribute('aria-hidden', 'true');
  if (checked) mark.innerHTML = icons.check;
  const text = document.createElement('span');
  text.textContent = label;
  button.append(mark, text);
  button.addEventListener('click', onPick);
  menu.append(button);
  return button;
}

function place(menu, anchor) {
  const a = anchor.getBoundingClientRect();
  const m = menu.getBoundingClientRect();
  const gap = 4;
  // Under the button when there is room; the chat dock sits at the bottom of the window, so it usually opens upward
  let top = a.bottom + gap;
  if (top + m.height > window.innerHeight - gap) top = Math.max(gap, a.top - m.height - gap);
  const left = Math.max(gap, Math.min(a.left, window.innerWidth - m.width - gap));
  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;
}

function build(provider, status = '') {
  const menu = document.createElement('div');
  menu.className = 'jump-context-menu model-quick-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', t('model_menu_label'));

  const models = quickModels(provider, currentModel(provider), readCachedGeminiList());
  for (const model of models) {
    addButton(menu, {
      label: model.label,
      checked: model.current,
      onPick: () => {
        closeModelQuickMenu();
        storeModel(provider, model.id);
        anchorEl?.focus();
      }
    });
  }
  // OpenAI and Claude: the fixed list says when it was last checked, so an old list is visible
  if (provider === 'openai' || provider === 'claude') {
    const checked = document.createElement('div');
    checked.className = 'model-quick-status';
    checked.textContent = t('model_menu_checked', { date: formatEnglishDate(CHAT_MODELS_CHECKED_ON) });
    menu.append(checked);
  }
  // Gemini has no fixed list: with none fetched yet the menu offers to fetch it
  if (provider === 'gemini' && readCachedGeminiList().length === 0) {
    addButton(menu, { label: t('model_menu_fetch'), role: 'menuitem', onPick: () => fetchGeminiList() });
  }
  const rule = document.createElement('div');
  rule.className = 'model-quick-rule';
  rule.setAttribute('role', 'separator');
  menu.append(rule);
  addButton(menu, {
    label: t('model_menu_all'),
    role: 'menuitem',
    onPick: () => {
      closeModelQuickMenu();
      window.dispatchEvent(new CustomEvent('app:openLogModels'));
    }
  });
  if (status) {
    const note = document.createElement('div');
    note.className = 'model-quick-status';
    note.setAttribute('role', 'status');
    note.textContent = status;
    menu.append(note);
  }
  return menu;
}

function show(provider, status = '') {
  const next = build(provider, status);
  next.style.visibility = 'hidden';
  document.body.append(next);
  menuEl?.remove();
  menuEl = next;
  place(menuEl, anchorEl);
  menuEl.style.visibility = '';
  menuEl.querySelector('[aria-checked="true"]')?.focus();
  if (!document.activeElement || !menuEl.contains(document.activeElement)) menuEl.querySelector('button')?.focus();
}

async function fetchGeminiList() {
  show('gemini', t('gemini_keys_loading'));
  try {
    // No key is passed: the main process uses the saved key
    const models = await window.engineAPI.listGeminiModels(undefined);
    if (!Array.isArray(models) || models.length === 0) throw new Error('No models returned');
    rememberGeminiModels(models);
    window.dispatchEvent(new Event('app:settingsChanged'));
    if (menuEl) show('gemini');
  } catch (err) {
    console.warn('[Gemini] Model list fetch error (model menu):', err);
    if (menuEl) show('gemini', t('gemini_keys_error'));
  }
}

/**
 * Opens (or, when open, closes) the menu under the anchor. With no provider chosen there is nothing to pick from:
 * onSetup is called, which opens the AI chat card of the settings page.
 */
export function openModelQuickMenu(anchor, { canOpen = () => true, onSetup } = {}) {
  if (menuEl) {
    closeModelQuickMenu();
    return;
  }
  if (!canOpen()) return;
  const provider = readStorage(STORAGE_KEYS.LLM_PROVIDER) || DEFAULTS.LLM_PROVIDER;
  if (!PROVIDERS.includes(provider)) {
    onSetup?.();
    return;
  }
  anchorEl = anchor;
  anchor.setAttribute('aria-haspopup', 'menu');
  anchor.setAttribute('aria-expanded', 'true');
  document.addEventListener('mousedown', onOutsidePress, true);
  document.addEventListener('keydown', onMenuKey, true);
  window.addEventListener('resize', closeModelQuickMenu);
  show(provider);
}
