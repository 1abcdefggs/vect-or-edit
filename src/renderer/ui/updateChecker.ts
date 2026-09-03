import { t } from '../core/i18n';

export function initUpdateChecker(): void {
  if (window.updaterAPI && (window.updaterAPI as any).onStatus) {
    const container = document.getElementById('updateLedContainer');
    const textEl = document.getElementById('updateLedText');
    const iconEl = document.getElementById('updateLedIcon');

    if (!container || !textEl || !iconEl) return;

    (window.updaterAPI as any).onStatus((data: any) => {
      container.style.display = 'flex';
      
      switch (data.status) {
        case 'checking':
          textEl.textContent = t('update_checking');
          iconEl.style.color = 'var(--text-muted)';
          iconEl.innerHTML = '&#xe86a;'; // sync
          container.onclick = null;
          container.style.background = 'rgba(0, 0, 0, 0.2)';
          break;
        case 'available':
          textEl.textContent = t('update_available', { version: data.version });
          iconEl.style.color = '#e67e22'; // orange alert
          iconEl.innerHTML = '&#xe8d3;'; // notification/update icon
          container.style.background = 'rgba(230, 126, 34, 0.25)';
          container.onclick = async () => {
            if (confirm(t('update_confirm', { version: data.version }))) {
              textEl.textContent = t('update_preparing');
              container.onclick = null;
              try {
                await (window.updaterAPI as any).download?.();
              } catch (e: any) {
                alert(t('update_download_failed', { message: e?.message || e }));
              }
            }
          };
          break;
        case 'downloading': {
          const pct = data.percent ? Math.round(data.percent) : 0;
          textEl.textContent = t('update_downloading', { pct });
          iconEl.style.color = '#3498db'; // blue
          iconEl.innerHTML = '&#xf090;'; // download
          container.style.background = 'rgba(52, 152, 219, 0.2)';
          container.onclick = null;
          break;
        }
        case 'downloaded':
          textEl.textContent = t('update_restart', { version: data.version });
          iconEl.style.color = '#2ecc71'; // green
          iconEl.innerHTML = '&#xe8d3;'; // system_update
          container.style.background = 'rgba(46, 204, 113, 0.2)';
          container.onclick = () => {
            if (confirm(t('update_restart_confirm'))) {
              (window.updaterAPI as any).quitAndInstall?.();
            }
          };
          break;
        case 'not-available':
        case 'error':
          container.style.display = 'none';
          container.onclick = null;
          break;
      }
    });
  }
}
