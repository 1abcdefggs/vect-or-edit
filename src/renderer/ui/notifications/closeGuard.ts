import { t } from '../../core/i18n.js';
import { STORAGE_KEYS, DEFAULTS } from '../../core/constants.js';
import { showConfirmModal, showChoiceModalWithCheckbox } from './confirmModal.js';
import { syncSettingsToBackend } from '../settings/settingsState.js';

/**
 * One place for "are you sure?" on every × that closes something, so a stray click cannot close it.
 * The user can turn it off in Settings (System tab): the × then closes at once.
 */
export type CloseTarget = 'app' | 'tab' | 'chat' | 'settings' | 'update' | 'about' | 'toast' | 'slot';

export function isCloseConfirmEnabled(): boolean {
  try {
    return (localStorage.getItem(STORAGE_KEYS.CONFIRM_BEFORE_CLOSE) ?? DEFAULTS.CONFIRM_BEFORE_CLOSE) !== 'off';
  } catch {
    return true;
  }
}

/**
 * Pure rule for the clean-tab question: only an explicit 'off' (set by the "Don't show again" checkbox) skips it.
 * Unsaved tabs never reach this rule; they keep their own question.
 */
export function shouldAskBeforeCleanTabClose(storedValue: string | null): boolean {
  return storedValue !== 'off';
}

function readCleanTabCloseSetting(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.CONFIRM_TAB_CLOSE);
  } catch {
    return null;
  }
}

async function confirmCleanTabClose(params: Record<string, string>): Promise<boolean> {
  if (!shouldAskBeforeCleanTabClose(readCleanTabCloseSetting())) return true;
  const { id, checked } = await showChoiceModalWithCheckbox({
    title: t('close_confirm_tab', params),
    message: '',
    choices: [{ id: 'close', text: t('btn_close_confirm'), primary: true }],
    cancelText: t('btn_keep_open'),
    type: 'warning',
    checkboxLabel: t('confirm_dont_show_again'),
  });
  if (id !== 'close') return false;
  // Only a confirmed close saves the choice; "Keep open" never does
  if (checked) {
    localStorage.setItem(STORAGE_KEYS.CONFIRM_TAB_CLOSE, 'off');
    void syncSettingsToBackend();
  }
  return true;
}

/** Resolves to true when the target may be closed: the setting is off, or the user confirmed. */
export async function confirmClose(target: CloseTarget, params: Record<string, string> = {}): Promise<boolean> {
  if (!isCloseConfirmEnabled()) return true;
  if (target === 'tab') return confirmCleanTabClose(params);
  return showConfirmModal({
    // The title is the question itself; a second line would only repeat it
    title: t(`close_confirm_${target}`, params),
    message: '',
    confirmText: t(target === 'app' ? 'btn_exit_confirm' : 'btn_close_confirm'),
    cancelText: t('btn_keep_open'),
    type: 'warning'
  });
}
