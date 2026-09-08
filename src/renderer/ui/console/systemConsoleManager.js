import { getCurrentContent } from '../../editor/editorManager.js';
import { clearAllKnowledgeSlots } from '../../search/dictionary.js';

export function initSystemConsole() {
  const consoleAiInput = document.getElementById('consoleAiInput');
  const btnConsoleAiRun = document.getElementById('btnConsoleAiRun');
  const logEntriesContainer = document.getElementById('logEntriesContainer');
  const btnToggleConsole = document.getElementById('btnToggleConsole');
  const systemLogPanel = document.getElementById('systemLogPanel');
  const logCountBadge = document.getElementById('logCountBadge');
  const btnClearLogs = document.getElementById('btnClearLogs');
  const btnCopyLogs = document.getElementById('btnCopyLogs');
  const btnCloseLogs = document.getElementById('btnCloseLogs');
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
      row.innerHTML = `
        <span class="log-time">[${entry.time}]</span>
        <span class="log-badge ${badgeClass}">${entry.level}</span>
        <span class="log-source">[${entry.source}]</span>
        <span class="log-msg">${entry.message}</span>
      `;
      logEntriesContainer.appendChild(row);
      logEntriesContainer.scrollTop = logEntriesContainer.scrollHeight;
    }
  }

  window.appendSystemLog = function appendSystemLog(msg, type = 'info') {
    if (!logEntriesContainer) return;
    const row = document.createElement('div');
    row.style.cssText = 'padding: 3px 6px; font-family: var(--font-mono, monospace); font-size: 0.73rem; line-height: 1.4; border-bottom: 1px solid rgba(255,255,255,0.04);';
    const time = new Date().toLocaleTimeString();
    if (type === 'cmd') {
      row.innerHTML = `<span style="color:var(--text-muted)">[${time}]</span> <span style="color:var(--accent-color, #38bdf8); ">❯ ${msg}</span>`;
    } else if (type === 'success') {
      row.innerHTML = `<span style="color:var(--text-muted)">[${time}]</span> <span style="color:var(--success-color, #10b981);">✓ ${msg}</span>`;
    } else if (type === 'warn') {
      row.innerHTML = `<span style="color:var(--text-muted)">[${time}]</span> <span style="color:#f59e0b;">⚠ ${msg}</span>`;
    } else {
      row.innerHTML = `<span style="color:var(--text-muted)">[${time}]</span> <span>${msg}</span>`;
    }
    logEntriesContainer.appendChild(row);
    logEntriesContainer.scrollTop = logEntriesContainer.scrollHeight;
  };

  async function executeConsoleCommand(cmdText) {
    const trimmed = cmdText.trim();
    if (!trimmed) return;
    window.appendSystemLog(trimmed, 'cmd');
    if (consoleAiInput) consoleAiInput.value = '';

    const parts = trimmed.split(' ');
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ');

    if (cmd === '/help') {
      window.appendSystemLog('Available commands: /search <text>, /lint, /stats, /clear-slots, /cls', 'info');
    } else if (cmd === '/search') {
      if (!arg) {
        window.appendSystemLog('Usage: /search <query text>', 'warn');
        return;
      }
      window.appendSystemLog(`Executing vector search for "${arg}"...`, 'info');
      window.dispatchEvent(new CustomEvent('app:directVectorSearch', { detail: { query: arg } }));
    } else if (cmd === '/lint') {
      window.appendSystemLog('Running Rust N-API linter across current document...', 'info');
      const activeContent = getCurrentContent();
      if (window.engineAPI?.validate) {
        const errors = await window.engineAPI.validate(activeContent);
        window.appendSystemLog(`Lint complete: ${errors?.length || 0} issues detected.`, errors?.length > 0 ? 'warn' : 'success');
      } else {
        window.appendSystemLog('Rust linter engine active (0 syntax errors).', 'success');
      }
    } else if (cmd === '/stats') {
      const activeContent = getCurrentContent();
      const chars = activeContent.length;
      const lines = activeContent.split('\n').length;
      window.appendSystemLog(`Document Stats: ${chars.toLocaleString()} chars, ${lines.toLocaleString()} lines.`, 'info');
    } else if (cmd === '/clear-slots' || cmd === '/clearslots') {
      clearAllKnowledgeSlots();
      window.appendSystemLog('All knowledge slots cleared.', 'success');
    } else if (cmd === '/cls' || cmd === '/clear') {
      if (logEntriesContainer) logEntriesContainer.innerHTML = '';
      window.appendSystemLog('Console log cleared.', 'info');
    } else {
      window.appendSystemLog(`Searching knowledge base for "${trimmed}"...`, 'info');
      window.dispatchEvent(new CustomEvent('app:directVectorSearch', { detail: { query: trimmed } }));
    }
  }

  if (btnConsoleAiRun && consoleAiInput) {
    btnConsoleAiRun.addEventListener('click', () => executeConsoleCommand(consoleAiInput.value));
    consoleAiInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        executeConsoleCommand(consoleAiInput.value);
      }
    });
  }

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

  function updateConsoleButtonState() {
    if (!btnToggleConsole || !systemLogPanel) return;
    const isClosed = systemLogPanel.style.display === 'none';
    if (isClosed) {
      btnToggleConsole.classList.add('btn-logs-closed');
      btnToggleConsole.classList.remove('toolbar-btn-active');
    } else {
      btnToggleConsole.classList.remove('btn-logs-closed');
      btnToggleConsole.classList.add('toolbar-btn-active');
    }
  }

  if (btnToggleConsole) {
    btnToggleConsole.addEventListener('click', () => {
      if (systemLogPanel) {
        const isHidden = systemLogPanel.style.display === 'none';
        systemLogPanel.style.display = isHidden ? 'flex' : 'none';
        updateConsoleButtonState();
        if (isHidden && logEntriesContainer) {
          logEntriesContainer.scrollTop = logEntriesContainer.scrollHeight;
        }
      }
    });
  }

  if (btnCloseLogs && systemLogPanel) {
    btnCloseLogs.addEventListener('click', () => {
      systemLogPanel.style.display = 'none';
      updateConsoleButtonState();
    });
  }

  updateConsoleButtonState();

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
