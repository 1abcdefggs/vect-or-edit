export function showToast(message, type = 'info', action = null) {
  const existing = document.getElementById('appToast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'appToast';
  toast.className = `app-toast toast-${type}`;

  let iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
  if (type === 'success') {
    iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  } else if (type === 'warning') {
    iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  } else if (type === 'error') {
    iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  }

  const actionsList = Array.isArray(action) ? action : (action && action.label ? [action] : []);
  const actionHtml = actionsList.map((act, idx) => {
    const isSecondary = act.secondary || act.type === 'secondary';
    const btnClass = isSecondary ? 'toast-action-btn secondary' : 'toast-action-btn';
    const extraStyle = isSecondary ? 'background: rgba(255, 255, 255, 0.12); color: var(--text-main); border: 1px solid var(--border-color);' : '';
    return `<button class="${btnClass}" type="button" data-toast-action-idx="${idx}" style="${extraStyle}">${act.label}</button>`;
  }).join('');

  toast.innerHTML = `
    <span class="toast-icon" style="display: flex; align-items: center; flex-shrink: 0;">${iconSvg}</span>
    <span class="toast-message" style="line-height: 1.45; word-break: break-word; white-space: pre-line;">${message}</span>
    <div class="toast-actions" style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
      ${actionHtml}
    </div>
    <button class="toast-close-btn" title="Close" aria-label="Close">&times;</button>
  `;
  document.body.appendChild(toast);

  actionsList.forEach((act, idx) => {
    const actionBtn = toast.querySelector(`[data-toast-action-idx="${idx}"]`);
    if (actionBtn && typeof act.onClick === 'function') {
      actionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dismiss();
        act.onClick();
      });
    }
  });

  // Auto-dismiss: 10s for info/success, 16s for warning/error (plenty of time to read)
  const duration = (type === 'warning' || type === 'error') ? 16000 : 10000;
  let timer = null;

  const dismiss = () => {
    if (timer) clearTimeout(timer);
    toast.classList.add('toast-fadeout');
    setTimeout(() => toast.remove(), 250);
  };

  const startTimer = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(dismiss, duration);
  };

  // Pause on hover so user can read comfortably
  toast.addEventListener('mouseenter', () => {
    if (timer) clearTimeout(timer);
  });
  toast.addEventListener('mouseleave', () => {
    startTimer();
  });

  const closeBtn = toast.querySelector('.toast-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismiss();
    });
  }

  startTimer();
}
