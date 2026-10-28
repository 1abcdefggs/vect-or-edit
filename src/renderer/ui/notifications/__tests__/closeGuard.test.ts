import { describe, it, expect, vi, beforeEach } from 'vitest';

const showConfirmModal = vi.fn();
const showChoiceModalWithCheckbox = vi.fn();
const syncSettingsToBackend = vi.fn();
vi.mock('../confirmModal', () => ({
  showConfirmModal: (...args: unknown[]) => showConfirmModal(...args),
  showChoiceModalWithCheckbox: (...args: unknown[]) => showChoiceModalWithCheckbox(...args)
}));
vi.mock('../../settings/settingsState', () => ({ syncSettingsToBackend: () => syncSettingsToBackend() }));
vi.mock('../../../core/i18n', () => ({ t: (key: string) => key }));

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v)
});

const { confirmClose, isCloseConfirmEnabled, shouldAskBeforeCleanTabClose } = await import('../closeGuard');
const { STORAGE_KEYS } = await import('../../../core/constants');

describe('closeGuard', () => {
  beforeEach(() => {
    store.clear();
    showConfirmModal.mockReset();
    showChoiceModalWithCheckbox.mockReset();
    syncSettingsToBackend.mockReset();
  });

  it('asks first by default, and closes only when confirmed', async () => {
    expect(isCloseConfirmEnabled()).toBe(true);

    showConfirmModal.mockResolvedValueOnce(false);
    expect(await confirmClose('chat')).toBe(false);

    showConfirmModal.mockResolvedValueOnce(true);
    expect(await confirmClose('chat')).toBe(true);
    expect(showConfirmModal).toHaveBeenCalledTimes(2);
  });

  it('closes at once, without a modal, when the setting is off', async () => {
    store.set(STORAGE_KEYS.CONFIRM_BEFORE_CLOSE, 'off');
    expect(isCloseConfirmEnabled()).toBe(false);
    expect(await confirmClose('settings')).toBe(true);
    expect(showConfirmModal).not.toHaveBeenCalled();
  });

  it('keeps asking for any value other than off', async () => {
    store.set(STORAGE_KEYS.CONFIRM_BEFORE_CLOSE, 'garbage');
    expect(isCloseConfirmEnabled()).toBe(true);
  });

  it('names what is being closed in the message', async () => {
    showChoiceModalWithCheckbox.mockResolvedValueOnce({ id: 'close', checked: false });
    await confirmClose('tab', { name: 'notes.md' });
    expect(showChoiceModalWithCheckbox.mock.calls[0][0]).toMatchObject({ type: 'warning', title: 'close_confirm_tab' });
  });

  it('remembers "Don\'t show again" only when the clean tab close is confirmed', async () => {
    showChoiceModalWithCheckbox.mockResolvedValueOnce({ id: 'close', checked: true });
    expect(await confirmClose('tab', { name: 'a.md' })).toBe(true);
    expect(store.get(STORAGE_KEYS.CONFIRM_TAB_CLOSE)).toBe('off');
    expect(syncSettingsToBackend).toHaveBeenCalledTimes(1);

    // Next clean tab: no question at all
    expect(await confirmClose('tab', { name: 'b.md' })).toBe(true);
    expect(showChoiceModalWithCheckbox).toHaveBeenCalledTimes(1);
  });

  it('does not remember the choice when the user keeps the tab open', async () => {
    showChoiceModalWithCheckbox.mockResolvedValueOnce({ id: null, checked: true });
    expect(await confirmClose('tab', { name: 'a.md' })).toBe(false);
    expect(store.has(STORAGE_KEYS.CONFIRM_TAB_CLOSE)).toBe(false);
    expect(syncSettingsToBackend).not.toHaveBeenCalled();
  });

  it('keeps the global switch in charge of every other target', async () => {
    showConfirmModal.mockResolvedValueOnce(true);
    await confirmClose('chat');
    expect(showConfirmModal).toHaveBeenCalledTimes(1);
  });

  it('applies the saved tab choice only to the value off', () => {
    expect(shouldAskBeforeCleanTabClose(null)).toBe(true);
    expect(shouldAskBeforeCleanTabClose('on')).toBe(true);
    expect(shouldAskBeforeCleanTabClose('off')).toBe(false);
  });
});
