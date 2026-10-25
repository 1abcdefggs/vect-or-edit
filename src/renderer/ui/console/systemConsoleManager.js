import { createDisclosure } from '../components/disclosureToggle.js';
import { saveTextToFile } from '../../editor/io/fileIO.js';
import { settingsStore } from '../../core/settingsStore.js';
import { formatLogTime } from '../../core/logTime.js';

export function initSystemConsole() {
  const logEntriesContainer = document.getElementById('logEntriesContainer');
  const btnToggleConsole = document.getElementById('btnToggleConsole');
  const systemLogPanel = document.getElementById('systemLogPanel');
  const logCountBadge = document.getElementById('logCountBadge');
  const btnClearLogs = document.getElementById('btnClearLogs');
  const btnCopyLogs = document.getElementById('btnCopyLogs');
  const btnDownloadLogs = document.getElementById('btnDownloadLogs');
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

  function buildLogRow(entry) {
    const row = document.createElement('div');
    row.className = entry.tone ? `log-row log-row--${entry.tone}` : 'log-row';
    const badgeClass = entry.level === 'ERROR' ? 'badge-error' : (entry.level === 'WARN' ? 'badge-warn' : 'badge-info');
    // Built with textContent: messages carry raw console text (renderer HTML, file paths) that must not be parsed as markup
    const cells = [
      ['log-time', `[${formatLogTime(entry.time, settingsStore.getPreference('system.logTimeFormat'), settingsStore.getPreference('system.logTimeZone'))}]`],
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
    return row;
  }

  // Extra read-only views of the same buffer (the Settings > System tab). They are marked [data-log-mirror] and
  // can load after this init, so they are looked up on every append and filled from the buffer when first seen.
  const filledMirrors = new WeakSet();
  function liveMirrors() {
    const views = document.querySelectorAll('[data-log-mirror]');
    views.forEach((view) => {
      if (filledMirrors.has(view)) return;
      filledMirrors.add(view);
      view.replaceChildren(...logBuffer.map(buildLogRow));
      view.scrollTop = view.scrollHeight;
    });
    return views;
  }

  function appendLogEntry(entry) {
    logBuffer.push(entry);
    updateLogBadge();

    const targets = [...(logEntriesContainer ? [logEntriesContainer] : [])];
    liveMirrors().forEach((view) => {
      // A view filled just now already holds this entry
      if (view.childElementCount < logBuffer.length) targets.push(view);
    });
    for (const view of targets) {
      view.appendChild(buildLogRow(entry));
      view.scrollTop = view.scrollHeight;
    }
  }

  // Renderer-side callers (pipeline status) share the one log buffer, so Copy, Save and the ERROR badge include them
  const SYSTEM_LOG_LEVELS = { success: 'INFO', info: 'INFO', warn: 'WARN', error: 'ERROR' };
  window.appendSystemLog = function appendSystemLog(msg, type = 'info') {
    appendLogEntry({
      time: new Date().toISOString(),
      source: 'Pipeline',
      level: SYSTEM_LOG_LEVELS[type] ?? 'INFO',
      message: String(msg),
      tone: type === 'success' ? 'success' : undefined
    });
  };

  appendLogEntry({
    time: new Date().toISOString(),
    source: 'App:Init',
    level: 'INFO',
    message: 'VectOrEdit core system online. Ready.'
  });

  // Main-process entries arrive as a backlog (everything logged before this point) plus live pushes.
  // Live entries wait until the backlog is shown so the order stays chronological; ids make overlaps harmless.
  const seenMainIds = new Set();
  const showMainEntry = (log) => {
    if (log.id != null) {
      if (seenMainIds.has(log.id)) return;
      seenMainIds.add(log.id);
    }
    appendLogEntry(log);
  };
  if (window.engineAPI?.onSystemLog) {
    let pendingLive = [];
    window.engineAPI.onSystemLog((log) => {
      if (pendingLive) pendingLive.push(log);
      else showMainEntry(log);
    });
    const backlogRequest = window.engineAPI.requestLogBacklog?.() ?? Promise.resolve([]);
    backlogRequest
      .catch(() => [])
      .then((backlog) => {
        backlog.forEach(showMainEntry);
        const queued = pendingLive;
        pendingLive = null;
        queued.forEach(showMainEntry);
      });
  }

  // LOGS panel uses the shared disclosure toggle. Whether it starts open is a setting (System tab, default open).
  const logsDisclosure = (btnToggleConsole && systemLogPanel)
    ? createDisclosure({
        button: btnToggleConsole,
        panel: systemLogPanel,
        onChange: (open) => {
          btnToggleConsole.classList.toggle('btn-logs-closed', !open);
          btnToggleConsole.classList.toggle('toolbar-btn-active', open);
          const closeLogs = document.getElementById('btnCloseLogs');
          if (closeLogs) { closeLogs.hidden = !open; closeLogs.style.display = open ? 'inline-flex' : 'none'; }
          if (open && logEntriesContainer) {
            logEntriesContainer.scrollTop = logEntriesContainer.scrollHeight;
          }
        }
      })
    : null;

  logsDisclosure?.set(!settingsStore.getPreference('system.collapseLogsOnStartup'));
  document.getElementById('btnCloseLogs')?.addEventListener('click', () => logsDisclosure?.set(false));

  const clearLogs = () => {
    logBuffer.length = 0;
    if (logEntriesContainer) logEntriesContainer.innerHTML = '';
    liveMirrors().forEach((view) => view.replaceChildren());
    updateLogBadge();
  };

  const formatLogs = () => logBuffer.map(l => `[${l.time}] [${l.level}] [${l.source}] ${l.message}`).join('\n');

  const downloadLogs = () => {
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    saveTextToFile(formatLogs(), `vectoredit-logs-${stamp}.txt`, 'txt');
  };

  // Copy shows "Copied!" on the button that was pressed, then restores its content
  const copyLogs = (button) => {
    navigator.clipboard.writeText(formatLogs());
    if (!button) return;
    const original = [...button.childNodes];
    button.textContent = 'Copied!';
    setTimeout(() => button.replaceChildren(...original), 2000);
  };

  btnClearLogs?.addEventListener('click', clearLogs);
  btnDownloadLogs?.addEventListener('click', downloadLogs);
  btnCopyLogs?.addEventListener('click', () => copyLogs(btnCopyLogs));

  // Buttons of the Settings > System log view (loaded later, so delegated)
  document.addEventListener('click', (e) => {
    const button = e.target.closest?.('[data-log-action]');
    if (!button) return;
    const action = button.dataset.logAction;
    if (action === 'clear') clearLogs();
    else if (action === 'download') downloadLogs();
    else if (action === 'copy') copyLogs(button);
  });
}
