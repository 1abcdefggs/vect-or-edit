import { t } from '../../core/i18n.js';

export interface ConfirmModalOptions {
  title?: string;
  message: string;
  detail?: string;
  confirmText?: string;
  cancelText?: string;
  icon?: string;
  type?: 'primary' | 'warning' | 'info';
}

export interface ModalChoice {
  id: string;
  text: string;
  /** The choice Enter picks, drawn in the accent color. Without one, Enter does nothing. */
  primary?: boolean;
  /** A choice that throws something away, drawn in red */
  danger?: boolean;
}

export interface ChoiceModalOptions extends Omit<ConfirmModalOptions, 'confirmText'> {
  choices: ModalChoice[];
}

/**
 * A modal with a Cancel button and any number of action buttons. Resolves to the id of the chosen action,
 * or null when it is cancelled (Cancel, the close button, or Esc). Text is inserted as text, never as markup,
 * so file names and other user data are safe to pass.
 */
export function showChoiceModal(options: ChoiceModalOptions): Promise<string | null> {
  return new Promise((resolve) => {
    const existing = document.getElementById('globalConfirmModal');
    if (existing) existing.remove();

    const title = options.title || t('confirm_title') || 'Confirmation';
    const cancelText = options.cancelText || t('btn_cancel') || 'Cancel';
    const icon = options.icon || (options.type === 'warning' ? 'warning' : 'info');
    const iconColor = options.type === 'warning' ? '#f59e0b' : 'var(--accent-color, #38bdf8)';
    const accentBg = options.type === 'warning' ? '#f59e0b' : 'var(--accent-color, #38bdf8)';
    // Text on the primary button: dark on the orange warning colour, the on-accent token on the blue one (4.5:1 in both modes)
    const onAccent = options.type === 'warning' ? '#000000' : 'var(--text-on-accent, #ffffff)';

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
      <div class="settings-modal-dialog elevated-modal-card" style="width: 480px; max-width: 92vw; height: auto; padding: 0; border: 1px solid var(--border-color); border-radius: 12px; background: var(--bg-secondary, #0f172a); box-shadow: 0 24px 60px -12px rgba(0,0,0,0.85), 0 0 24px rgba(56, 189, 248, 0.15);">
        <div class="modal-header" style="padding: 14px 20px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; background: var(--hover-bg);">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span id="confirmIcon" class="material-symbols-outlined" style="font-size: var(--fs-22); color: ${iconColor};"></span>
            <span id="confirmTitle" style="font-size: var(--fs-15); font-weight: 700; color: var(--text-main);"></span>
          </div>
          <button id="btnConfirmClose" class="toolbar-btn" style="background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; display: flex; align-items: center;">
            <span class="material-symbols-outlined" style="font-size: var(--fs-19);">close</span>
          </button>
        </div>
        <div class="modal-body" style="padding: 20px 24px; display: flex; flex-direction: column; gap: 10px; color: var(--text-main); font-size: var(--fs-14); line-height: 1.55;">
          <div id="confirmMessage" style="font-weight: 600; color: var(--text-main); font-size: var(--fs-15); word-break: break-word;"></div>
          <div id="confirmDetail" style="display: none; font-size: var(--fs-13); color: var(--text-muted); background: var(--result-bg, rgba(0, 0, 0, 0.25)); padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); word-break: break-word; white-space: pre-line;"></div>
        </div>
        <div id="confirmFooter" class="modal-footer" style="padding: 12px 20px; border-top: 1px solid var(--border-color); display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 10px; background: var(--hover-bg);"></div>
      </div>
    `;

    const setText = (id: string, text: string) => {
      const el = modalOverlay.querySelector<HTMLElement>(`#${id}`);
      if (el) el.textContent = text;
    };
    setText('confirmIcon', icon);
    setText('confirmTitle', title);
    setText('confirmMessage', options.message);
    // A question that already fits in the title needs no body
    if (!options.message && !options.detail) {
      modalOverlay.querySelector<HTMLElement>('.modal-body')!.style.display = 'none';
    }
    if (options.detail) {
      setText('confirmDetail', options.detail);
      modalOverlay.querySelector<HTMLElement>('#confirmDetail')!.style.display = 'block';
    }
    modalOverlay.querySelector('#btnConfirmClose')?.setAttribute('title', t('tip_close'));

    const footer = modalOverlay.querySelector<HTMLElement>('#confirmFooter')!;
    const baseStyle = 'padding: 7px 16px; font-size: var(--fs-13); border-radius: 6px; cursor: pointer;';
    const makeButton = (id: string, text: string, style: string) => {
      const btn = document.createElement('button');
      btn.id = id;
      btn.type = 'button';
      btn.className = 'toolbar-btn';
      btn.style.cssText = baseStyle + style;
      btn.textContent = text;
      footer.appendChild(btn);
      return btn;
    };

    const cleanup = (result: string | null) => {
      window.removeEventListener('keydown', handleKeyDown);
      modalOverlay.classList.add('toast-fadeout');
      setTimeout(() => modalOverlay.remove(), 150);
      resolve(result);
    };

    makeButton('btnConfirmCancel', cancelText, 'font-weight: 500; background: var(--hover-bg); color: var(--text-main); border: 1px solid var(--border-color);')
      .addEventListener('click', () => cleanup(null));

    const primary = options.choices.find((c) => c.primary);
    let primaryButton: HTMLElement | null = null;
    options.choices.forEach((choice) => {
      const style = choice.danger
        ? 'font-weight: 600; background: rgba(239, 68, 68, 0.15); color: var(--error-color); border: 1px solid rgba(239, 68, 68, 0.45);'
        : choice.primary
          ? `padding: 7px 18px; font-weight: 700; background: ${accentBg}; color: ${onAccent}; border: none; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);`
          : 'font-weight: 500; background: var(--hover-bg); color: var(--text-main); border: 1px solid var(--border-color);';
      const btn = makeButton(choice.primary ? 'btnConfirmOk' : `btnConfirmChoice_${choice.id}`, choice.text, style);
      btn.addEventListener('click', () => cleanup(choice.id));
      if (choice.primary) primaryButton = btn;
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cleanup(null);
      } else if (e.key === 'Enter' && primary) {
        cleanup(primary.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    modalOverlay.querySelector('#btnConfirmClose')?.addEventListener('click', () => cleanup(null));

    document.body.appendChild(modalOverlay);

    // Focus the safe default: the primary action, or Cancel when no action is primary
    (primaryButton ?? modalOverlay.querySelector<HTMLElement>('#btnConfirmCancel'))?.focus();
  });
}

/**
 * Displays a non-disruptive, highly visible modal dialog to confirm navigation or actions.
 * Returns a promise that resolves to true (confirmed) or false (cancelled).
 */
export async function showConfirmModal(options: ConfirmModalOptions): Promise<boolean> {
  const { confirmText, ...rest } = options;
  const result = await showChoiceModal({
    ...rest,
    choices: [{ id: 'confirm', text: confirmText || t('btn_confirm') || 'Proceed', primary: true }]
  });
  return result === 'confirm';
}
