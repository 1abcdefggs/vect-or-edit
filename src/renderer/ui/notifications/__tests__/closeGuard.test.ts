import { describe, it, expect, vi, beforeEach } from 'vitest';

const showConfirmModal = vi.fn();
vi.mock('../confirmModal', () => ({ showConfirmModal: (...args: unknown[]) => showConfirmModal(...args) }));
vi.mock('../../../core/i18n', () => ({ t: (key: string) => key }));

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v)
});

const { confirmClose, isCloseConfirmEnabled } = await import('../closeGuard');
const { STORAGE_KEYS } = await import('../../../core/constants');

describe('closeGuard', () => {
  beforeEach(() => {
    store.clear();
    showConfirmModal.mockReset();
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
    showConfirmModal.mockResolvedValueOnce(true);
    await confirmClose('tab', { name: 'notes.md' });
    expect(showConfirmModal.mock.calls[0][0]).toMatchObject({ type: 'warning' });
  });
});
