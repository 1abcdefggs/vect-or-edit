import { createDisclosure } from '../components/disclosureToggle.js';
import { saveTextToFile } from '../../editor/io/fileIO.js';
import { settingsStore } from '../../core/settingsStore.js';
import { formatLogTime } from '../../core/logTime.js';
import { showConfirmModal } from '../notifications/confirmModal.js';
import { t } from '../../core/i18n.js';
import { showToast } from '../notifications/toastManager.js';

// Saved-log helpers (module scope: also used by the saved-session view in Settings)
const LOG_SAVE_PATH = 'system.logSaveMode';
const SAVE_FLUSH_MS = 500;
const SAVE_BATCH = 500;
const SNAPSHOT_MAX = 5000;
// Rows kept in the visible views. The buffer keeps every entry, so Copy and Save still take the full log.
const MAX_VISIBLE_ROWS = 1000;

/** The fields that are stored; nothing else leaves the renderer. */
function toStored(entry) {
  const stored = { time: entry.time, source: entry.source, level: entry.level, message: entry.message };
  if (entry.tone === 'success') stored.tone = 'success';
  return stored;
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

/** Renders saved entries into a container (read-only view). Text is set with textContent, never as HTML. */
export function renderStoredLogs(container, entries) {
  container.replaceChildren(...entries.map(buildLogRow));
  container.scrollTop = container.scrollHeight;
}

export function initSystemConsole() {
  const logEntriesContainer = document.getElementById('logEntriesContainer');
  const btnToggleConsole = document.getElementById('btnToggleConsole');
  const systemLogPanel = document.getElementById('systemLogPanel');
  const logCountBadge = document.getElementById('logCountBadge');
  const btnClearLogs = document.getElementById('btnClearLogs');
  const btnCopyLogs = document.getElementById('btnCopyLogs');
  const btnDownloadLogs = document.getElementById('btnDownloadLogs');
  const logBuffer = [];
  // Entries before this index are already saved (only used when the mode is 'always')
  let persistedCount = 0;
  let flushTimer = null;
  let flushChain = Promise.resolve();
  // Entries logged since the last frame; their rows are added to the views in one batch
  let pendingRows = [];
  let rowFrame = 0;

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

  // Extra read-only views of the same buffer (the Settings > System tab). They are marked [data-log-mirror] and
  // can load after this init, so they are looked up on every append and filled from the buffer when first seen.
  const filledMirrors = new WeakSet();
  function liveMirrors() {
    const views = document.querySelectorAll('[data-log-mirror]');
    views.forEach((view) => {
      if (filledMirrors.has(view)) return;
      filledMirrors.add(view);
      // Entries still waiting for a frame are added by renderPendingRows, so only the rendered part is copied here
      const rendered = logBuffer.slice(0, logBuffer.length - pendingRows.length);
      view.replaceChildren(...rendered.slice(-MAX_VISIBLE_ROWS).map(buildLogRow));
      view.scrollTop = view.scrollHeight;
    });
    return views;
  }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushChain = flushChain.then(flushSaved).catch((err) => console.warn('[logs] could not save log entries', err));
    }, SAVE_FLUSH_MS);
  }

  // Sends the entries that are not saved yet, in order. A failed send leaves them for the next try.
  async function flushSaved() {
    if (settingsStore.getPreference(LOG_SAVE_PATH) !== 'always') return;
    while (persistedCount < logBuffer.length) {
      const batch = logBuffer.slice(persistedCount, persistedCount + SAVE_BATCH).map(toStored);
      const res = await window.engineAPI?.appendLogSession?.(batch);
      if (!res) return;
      persistedCount += batch.length;
    }
  }

  function appendLogEntry(entry) {
    logBuffer.push(entry);
    updateLogBadge();
    if (settingsStore.getPreference(LOG_SAVE_PATH) === 'always') scheduleFlush();
    pendingRows.push(entry);
    if (!rowFrame) rowFrame = requestAnimationFrame(renderPendingRows);
  }

  // One layout pass per frame however many entries arrived in it; each view keeps only its last MAX_VISIBLE_ROWS rows
  function renderPendingRows() {
    rowFrame = 0;
    if (pendingRows.length === 0) return;
    const views = [...(logEntriesContainer ? [logEntriesContainer] : []), ...liveMirrors()];
    const entries = pendingRows;
    pendingRows = [];
    for (const view of views) {
      const fragment = document.createDocumentFragment();
      fragment.append(...entries.map(buildLogRow));
      view.appendChild(fragment);
      const excess = view.childElementCount - MAX_VISIBLE_ROWS;
      for (let i = 0; i < excess; i++) view.firstElementChild.remove();
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
    message: t('log_core_online')
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
        animate: true,
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

  // Runs before the window closes (menuBarController dispatches app:beforeExit after the exit confirmation)
  async function prepareLogsForExit() {
    const mode = settingsStore.getPreference(LOG_SAVE_PATH);
    try {
      if (mode === 'always') {
        flushChain = flushChain.then(flushSaved);
        await flushChain;
      } else if (mode === 'ask' && logBuffer.length > 0) {
        const save = await showConfirmModal({
          title: t('log_save_exit_title'),
          message: t('log_save_exit_message'),
          type: 'info',
          confirmText: t('log_save_exit_btn'),
          cancelText: t('log_save_exit_skip')
        });
        if (save) await window.engineAPI?.saveLogSnapshot?.(logBuffer.slice(-SNAPSHOT_MAX).map(toStored));
      }
    } catch (err) {
      console.warn('[logs] could not save logs on exit', err);
    }
  }
  window.addEventListener('app:beforeExit', (event) => {
    event.detail?.tasks?.push(prepareLogsForExit());
  });

  // Clearing cannot be undone, so it asks first, but only when there is something to lose
  const clearLogs = async () => {
    if (logBuffer.length > 0) {
      const confirmed = await showConfirmModal({
        title: t('log_clear_title'),
        message: t('log_clear_confirm'),
        type: 'warning',
        confirmText: t('btn_clear_logs')
      });
      if (!confirmed) return;
    }
    logBuffer.length = 0;
    persistedCount = 0;
    pendingRows = [];
    if (rowFrame) { cancelAnimationFrame(rowFrame); rowFrame = 0; }
    if (logEntriesContainer) logEntriesContainer.innerHTML = '';
    liveMirrors().forEach((view) => view.replaceChildren());
    updateLogBadge();
  };

  const formatLogs = () => logBuffer.map(l => `[${l.time}] [${l.level}] [${l.source}] ${l.message}`).join('\n');

  // Pressing save turns on the exit question when saving is off, then writes the text file as before
  const downloadLogs = () => {
    if (settingsStore.getPreference(LOG_SAVE_PATH) === 'never') {
      settingsStore.updatePreference(LOG_SAVE_PATH, 'ask');
      showToast(t('log_save_enabled_toast'), 'info');
    }
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    saveTextToFile(formatLogs(), `vectoredit-logs-${stamp}.txt`, 'txt');
  };

  // Copy shows "Copied!" on the button that was pressed, then restores its content
  const copyLogs = (button) => {
    navigator.clipboard.writeText(formatLogs());
    if (!button) return;
    const original = [...button.childNodes];
    button.textContent = t('msg_copied');
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
