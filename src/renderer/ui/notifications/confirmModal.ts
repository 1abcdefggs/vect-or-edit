import { applyI18n, t } from '../../core/i18n.js';

export interface ConfirmModalOptions {
  title?: string;
  message: string;
  detail?: string;
  confirmText?: string;
  cancelText?: string;
  icon?: string;
  type?: 'primary' | 'warning' | 'info';
}

/**
 * Displays a non-disruptive, highly visible modal dialog to confirm navigation or actions.
 * Returns a promise that resolves to true (confirmed) or false (cancelled).
 */
export function showConfirmModal(options: ConfirmModalOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const existing = document.getElementById('globalConfirmModal');
    if (existing) existing.remove();

    const title = options.title || t('confirm_title') || 'Confirmation';
    const message = options.message;
    const detail = options.detail || '';
    const confirmText = options.confirmText || t('btn_confirm') || 'Proceed';
    const cancelText = options.cancelText || t('btn_cancel') || 'Cancel';
    const icon = options.icon || (options.type === 'warning' ? 'warning' : 'info');
    const iconColor = options.type === 'warning' ? '#f59e0b' : 'var(--accent-color, #38bdf8)';
    const btnConfirmBg = options.type === 'warning' ? '#f59e0b' : 'var(--accent-color, #38bdf8)';
    const btnConfirmColor = '#000000';

    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'globalConfirmModal';
    modalOverlay.className = 'modal-overlay';
    modalOverlay.style.cssText = `
      position: fixed;
      inset: 0;
      top: 38px;
      background: rgba(2, 6, 23, 0.82);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
      animation: fadeInModal 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    modalOverlay.innerHTML = `
      <div class="settings-modal-dialog elevated-modal-card" style="width: 480px; max-width: 92vw; height: auto; padding: 0; border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 12px; background: #0f172a; box-shadow: 0 24px 60px -12px rgba(0,0,0,0.85), 0 0 24px rgba(56, 189, 248, 0.15);">
        <div class="modal-header" style="padding: 14px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.02);">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="material-symbols-outlined" style="font-size: 1.35rem; color: ${iconColor};">${icon}</span>
            <span style="font-size: 0.95rem; font-weight: 700; color: #ffffff;">${title}</span>
          </div>
          <button id="btnConfirmClose" class="toolbar-btn" style="background: transparent; border: none; color: #94a3b8; cursor: pointer; padding: 4px; display: flex; align-items: center;" title="Close">
            <span class="material-symbols-outlined" style="font-size: 1.2rem;">close</span>
          </button>
        </div>
        <div class="modal-body" style="padding: 20px 24px; display: flex; flex-direction: column; gap: 10px; color: #e2e8f0; font-size: 0.88rem; line-height: 1.55;">
          <div style="font-weight: 600; color: #f8fafc; font-size: 0.92rem;">${message}</div>
          ${detail ? `<div style="font-size: 0.8rem; color: #94a3b8; background: rgba(0, 0, 0, 0.25); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.06);">${detail}</div>` : ''}
        </div>
        <div class="modal-footer" style="padding: 12px 20px; border-top: 1px solid rgba(255, 255, 255, 0.08); display: flex; align-items: center; justify-content: flex-end; gap: 10px; background: rgba(255, 255, 255, 0.015);">
          <button id="btnConfirmCancel" class="toolbar-btn" style="padding: 7px 16px; font-size: 0.82rem; font-weight: 500; border-radius: 6px; background: rgba(255, 255, 255, 0.08); color: #e2e8f0; border: 1px solid rgba(255, 255, 255, 0.15); cursor: pointer;">${cancelText}</button>
          <button id="btnConfirmOk" class="toolbar-btn" style="padding: 7px 18px; font-size: 0.82rem; font-weight: 700; border-radius: 6px; background: ${btnConfirmBg}; color: ${btnConfirmColor}; border: none; cursor: pointer; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    const cleanup = (result: boolean) => {
      window.removeEventListener('keydown', handleKeyDown);
      modalOverlay.classList.add('toast-fadeout');
      setTimeout(() => modalOverlay.remove(), 150);
      resolve(result);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cleanup(false);
      } else if (e.key === 'Enter') {
        cleanup(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    modalOverlay.querySelector('#btnConfirmClose')?.addEventListener('click', () => cleanup(false));
    modalOverlay.querySelector('#btnConfirmCancel')?.addEventListener('click', () => cleanup(false));
    modalOverlay.querySelector('#btnConfirmOk')?.addEventListener('click', () => cleanup(true));

    // Focus confirm button for accessibility
    (modalOverlay.querySelector('#btnConfirmOk') as HTMLElement)?.focus();
  });
}
