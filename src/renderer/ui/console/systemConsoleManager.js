import { createDisclosure } from '../components/disclosureToggle.js';

export function initSystemConsole() {
  const logEntriesContainer = document.getElementById('logEntriesContainer');
  const btnToggleConsole = document.getElementById('btnToggleConsole');
  const systemLogPanel = document.getElementById('systemLogPanel');
  const logCountBadge = document.getElementById('logCountBadge');
  const btnClearLogs = document.getElementById('btnClearLogs');
  const btnCopyLogs = document.getElementById('btnCopyLogs');
  const logBuffer = [];

  function updateLogBadge() {
    if (!logCountBadge) return;
    const errorCount = logBuffer.filter(e => e.level === 'ERROR').length;
    logCountBadge.textContent = String(errorCount);
    if (errorCount > 0) {
      logCountBadge.style.background = '#ef4444';
      logCountBadge.style.color = '#ffffff';
      logCountBadge.style.fontWeight = '800';
      logCountBadge.style.boxShadow = '0 0 6px rgba(239, 68, 68, 0.6)';
    } else {
      logCountBadge.style.background = 'rgba(255, 255, 255, 0.15)';
      logCountBadge.style.color = 'var(--text-muted, #94a3b8)';
      logCountBadge.style.fontWeight = '600';
      logCountBadge.style.boxShadow = 'none';
    }
  }

  function appendLogEntry(entry) {
    logBuffer.push(entry);
    updateLogBadge();

    if (logEntriesContainer) {
      const row = document.createElement('div');
      row.className = 'log-row';
      const badgeClass = entry.level === 'ERROR' ? 'badge-error' : (entry.level === 'WARN' ? 'badge-warn' : 'badge-info');
      // Built with textContent: messages carry raw console text (renderer HTML, file paths) that must not be parsed as markup
      const cells = [
        ['log-time', `[${entry.time}]`],
        [`log-badge ${badgeClass}`, entry.level],
        ['log-source', `[${entry.source}]`],
        ['log-msg', entry.message]
      ];
      for (const [className, text] of cells) {
        const span = document.createElement('span');
        span.className = className;
        span.textContent = String(text ?? '');
        row.append(span, ' ');
      }
      logEntriesContainer.appendChild(row);
      logEntriesContainer.scrollTop = logEntriesContainer.scrollHeight;
    }
  }

  window.appendSystemLog = function appendSystemLog(msg, type = 'info') {
    if (!logEntriesContainer) return;
    const row = document.createElement('div');
    row.style.cssText = 'padding: 3px 6px; font-family: var(--font-mono, monospace); font-size: var(--fs-12); line-height: 1.4; border-bottom: 1px solid rgba(255,255,255,0.04);';
    const time = document.createElement('span');
    time.style.color = 'var(--text-muted)';
    time.textContent = `[${new Date().toLocaleTimeString()}]`;
    const body = document.createElement('span');
    if (type === 'success') {
      body.style.color = 'var(--success-color, #10b981)';
      body.textContent = `✓ ${msg}`;
    } else if (type === 'warn') {
      body.style.color = '#f59e0b';
      body.textContent = `⚠ ${msg}`;
    } else {
      body.textContent = String(msg);
    }
    row.append(time, ' ', body);
    logEntriesContainer.appendChild(row);
    logEntriesContainer.scrollTop = logEntriesContainer.scrollHeight;
  };

  // Initial synthetic logs & listener
  appendLogEntry({
    time: new Date().toLocaleTimeString(),
    source: 'App:Init',
    level: 'INFO',
    message: 'VectOrEdit core system online. Ready.'
  });

  if (window.engineAPI?.onSystemLog) {
    window.engineAPI.onSystemLog((log) => appendLogEntry(log));
  }

  // LOGS panel uses the shared disclosure toggle. It opens on every launch (not persisted).
  const logsDisclosure = (btnToggleConsole && systemLogPanel)
    ? createDisclosure({
        button: btnToggleConsole,
        panel: systemLogPanel,
        onChange: (open) => {
          btnToggleConsole.classList.toggle('btn-logs-closed', !open);
          btnToggleConsole.classList.toggle('toolbar-btn-active', open);
          if (open && logEntriesContainer) {
            logEntriesContainer.scrollTop = logEntriesContainer.scrollHeight;
          }
        }
      })
    : null;

  logsDisclosure?.set(true);

  if (btnClearLogs && logEntriesContainer) {
    btnClearLogs.addEventListener('click', () => {
      logBuffer.length = 0;
      logEntriesContainer.innerHTML = '';
      updateLogBadge();
    });
  }

  if (btnCopyLogs) {
    btnCopyLogs.addEventListener('click', () => {
      const text = logBuffer.map(l => `[${l.time}] [${l.level}] [${l.source}] ${l.message}`).join('\n');
      navigator.clipboard.writeText(text);
      const og = btnCopyLogs.textContent;
      btnCopyLogs.textContent = 'Copied!';
      setTimeout(() => { btnCopyLogs.textContent = og; }, 2000);
    });
  }
}
