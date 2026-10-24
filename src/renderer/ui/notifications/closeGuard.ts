import { t } from '../../core/i18n.js';
import { STORAGE_KEYS, DEFAULTS } from '../../core/constants.js';
import { showConfirmModal } from './confirmModal.js';

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

/** Resolves to true when the target may be closed: the setting is off, or the user confirmed. */
export async function confirmClose(target: CloseTarget, params: Record<string, string> = {}): Promise<boolean> {
  if (!isCloseConfirmEnabled()) return true;
  return showConfirmModal({
    // The title is the question itself; a second line would only repeat it
    title: t(`close_confirm_${target}`, params),
    message: '',
    confirmText: t(target === 'app' ? 'btn_exit_confirm' : 'btn_close_confirm'),
    cancelText: t('btn_keep_open'),
    type: 'warning'
  });
}
