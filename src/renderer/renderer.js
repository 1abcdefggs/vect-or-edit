import { icons } from './icons.js';
import { loadLocales, i18n } from './i18n.js';
import { initSettings } from './settings.js';
import { initQuickDictionary, importDictionary, changeGoalProfile, addKnowledgeSlot, insertActiveTemplate } from './dictionary.js';
import { initEditor, toggleDiffMode, updateEditorOptions, getCurrentContent, setEditorContent, focusEditor } from './editorManager.js';
import { setLedStatus } from './statusManager.js';

export { setLedStatus };

window.__icons__ = icons;

document.addEventListener('DOMContentLoaded', async () => {
  // Inject SVG Icons
  const btnSaveEl = document.getElementById('btnSave');
  if (btnSaveEl) {
    btnSaveEl.insertAdjacentHTML('afterbegin', icons.save);
  }

  const iconNeuroEl = document.getElementById('iconNeuroContainer');
  if (iconNeuroEl) {
    iconNeuroEl.innerHTML = icons.neuro;
  }

  // 1 & 2. Listen for Rust Binary & Knowledge Base status from Main Process
  if (window.engineAPI?.onEngineStatus) {
    window.engineAPI.onEngineStatus((status) => {
      if (status.binReady) {
        setLedStatus('bin', true, '1. Rust Binary (DLL): Bound via N-API');
      }
      if (status.kbReady) {
        setLedStatus('kb', true, `2. Knowledge Base & HNSW: Indexed (${status.count.toLocaleString()} items)`);
      }
      if (status.profileName) {
        const activeProfileEl = document.getElementById('activeProfileName');
        if (activeProfileEl) activeProfileEl.textContent = status.profileName;
      }
    });
  }

  if (window.engineAPI?.getEngineStatus) {
    window.engineAPI.getEngineStatus().then((status) => {
      if (status?.binReady) {
        setLedStatus('bin', true, '1. Rust Binary (DLL): Bound via N-API');
      }
      if (status?.kbReady) {
        setLedStatus('kb', true, `2. Knowledge Base & HNSW: Indexed (${status.count.toLocaleString()} items)`);
      }
      if (status?.profileName) {
        const activeProfileEl = document.getElementById('activeProfileName');
        if (activeProfileEl) activeProfileEl.textContent = status.profileName;
      }
    }).catch(() => {});
  }

  // 6. Launch Editor initialization in parallel
  const editorPromise = initEditor();

  // 3, 4, 5. Initialize Locales & Settings concurrently
  const initModulesPromise = (async () => {
    await loadLocales();
    initSettings(updateEditorOptions);
  })();

  // Background load dictionary (non-blocking)
  initQuickDictionary();

  // Bind Top-level UI Events
  const btnSave = document.getElementById('btnSave');
  const btnOpen = document.getElementById('btnOpen');
  const btnImportDict = document.getElementById('btnImportDict');
  const btnDiff = document.getElementById('btnDiff');

  if (btnOpen) {
    btnOpen.addEventListener('click', async () => {
      if (window.engineAPI && window.engineAPI.openFile) {
        const res = await window.engineAPI.openFile();
        if (res && res.success && res.content !== undefined) {
          setEditorContent(res.content, res.fileName);
        }
      }
    });
  }

  // Window-level Drag & Drop support for text files
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const text = await file.text();
      setEditorContent(text, file.name);
    }
  });

  // Non-blocking toast notification helper
  function showToast(message, type = 'info') {
    const existing = document.getElementById('appToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'appToast';
    toast.className = `app-toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-fadeout');
      setTimeout(() => toast.remove(), 300);
    }, 2400);
  }

  const btnToggleSidebar = document.getElementById('btnToggleSidebar');
  const suggestionSidebar = document.getElementById('suggestionSidebar');
  const sidebarToggleIcon = document.getElementById('sidebarToggleIcon');

  if (btnToggleSidebar && suggestionSidebar) {
    btnToggleSidebar.addEventListener('click', () => {
      suggestionSidebar.classList.toggle('collapsed');
      const isCollapsed = suggestionSidebar.classList.contains('collapsed');
      if (sidebarToggleIcon) {
        sidebarToggleIcon.innerHTML = isCollapsed 
          ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>'
          : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
      }
      setTimeout(() => {
        const ed = window.__monacoEditorInstance || null;
        if (ed && ed.layout) ed.layout();
      }, 210);
    });
  }

  const btnChangeGoal = document.getElementById('btnChangeGoal');
  const btnInsertTemplate = document.getElementById('btnInsertTemplate');
  const btnAddSlot = document.getElementById('btnAddSlot');

  if (btnChangeGoal) {
    btnChangeGoal.addEventListener('click', async () => {
      const res = await changeGoalProfile();
      if (res && res.success) {
        showToast(`Goal set to: ${res.goal?.domain_name || res.goal?.profile_id || 'Custom'}`, 'success');
      }
    });
  }

  if (btnInsertTemplate) {
    btnInsertTemplate.addEventListener('click', async () => {
      await insertActiveTemplate((text) => {
        setEditorContent(text, 'template.md');
        showToast('Template inserted into editor', 'info');
      });
    });
  }

  if (btnAddSlot) {
    btnAddSlot.addEventListener('click', async () => {
      const res = await addKnowledgeSlot();
      if (res && res.success) {
        showToast(`Knowledge Base updated (${res.totalCount} items across ${res.slots?.length || 0} slots)`, 'success');
        setLedStatus('kb', true, `2. Knowledge Base & HNSW: Indexed (${res.totalCount?.toLocaleString()} items)`);
      }
    });
  }

  if (btnImportDict) {
    btnImportDict.addEventListener('click', async () => {
      const res = await importDictionary();
      if (res && res.success) {
        showToast(`Switched to: ${res.fileName} (${res.count} items)`, 'success');
        setLedStatus('kb', true, `2. Knowledge Base & HNSW: Indexed (${res.count.toLocaleString()} items)`);
      }
      setTimeout(() => {
        focusEditor();
      }, 50);
    });
  }

  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      const content = getCurrentContent();
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const defaultName = `vectoreditor_${yyyy}${mm}${dd}_${hh}${min}.txt`;

      if (window.engineAPI && window.engineAPI.saveFile) {
        const res = await window.engineAPI.saveFile(content, defaultName);
        if (res.success) {
          showToast((i18n.alert_file_saved || "Saved: {path}").replace("{path}", res.filePath), 'success');
        }
        setTimeout(() => {
          focusEditor();
        }, 50);
      }
    });
  }

  // System Logs Console Streaming & UI Control
  const btnToggleConsole = document.getElementById('btnToggleConsole');
  const systemLogPanel = document.getElementById('systemLogPanel');
  const logEntriesContainer = document.getElementById('logEntriesContainer');
  const logCountBadge = document.getElementById('logCountBadge');
  const btnClearLogs = document.getElementById('btnClearLogs');
  const btnCopyLogs = document.getElementById('btnCopyLogs');
  const btnCloseLogs = document.getElementById('btnCloseLogs');

  const liveLogTicker = document.getElementById('liveLogTicker');
  const liveLogTickerBody = document.getElementById('liveLogTickerBody');
  const btnToggleLiveTicker = document.getElementById('btnToggleLiveTicker');

  const logBuffer = [];
  const maxTickerLines = 3;

  // 3-State Ticker: 0: Full (3-lines), 1: Compact (1-line), 2: Collapsed (0-lines)
  let tickerState = 0;

  function updateTickerStateUI() {
    if (!liveLogTicker || !btnToggleLiveTicker) return;
    liveLogTicker.classList.remove('compact-1line', 'collapsed');

    if (tickerState === 0) {
      // Full 3-lines
      btnToggleLiveTicker.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
      btnToggleLiveTicker.title = 'Switch to 1-Line Compact View';
    } else if (tickerState === 1) {
      // Compact 1-line
      liveLogTicker.classList.add('compact-1line');
      btnToggleLiveTicker.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>';
      btnToggleLiveTicker.title = 'Switch to Full View / Hide';
    } else {
      // Fully Collapsed (0-lines)
      liveLogTicker.classList.add('collapsed');
      btnToggleLiveTicker.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
      btnToggleLiveTicker.title = 'Expand Log Stream';
    }
  }

  function updateTickerDisplay() {
    if (!liveLogTickerBody) return;
    const recent = logBuffer.slice(-maxTickerLines);
    liveLogTickerBody.innerHTML = recent.map(entry => {
      const colorMap = {
        ERROR: '#ef4444',
        WARN: '#f59e0b',
        INFO: '#38bdf8'
      };
      const tagColor = colorMap[entry.level] || '#38bdf8';
      return `
        <div class="live-log-item">
          <span class="live-log-time">${entry.time}</span>
          <span class="live-log-tag" style="color: ${tagColor}">[${entry.source}]</span>
          <span class="live-log-text">${entry.message}</span>
        </div>
      `;
    }).join('');
  }

  if (btnToggleLiveTicker && liveLogTicker) {
    btnToggleLiveTicker.addEventListener('click', () => {
      // Cycle: 0 (3-lines) -> 1 (1-line) -> 2 (0-lines) -> 0
      tickerState = (tickerState + 1) % 3;
      updateTickerStateUI();
    });
  }

  function appendLogEntry(entry) {
    logBuffer.push(entry);
    if (logCountBadge) {
      logCountBadge.textContent = String(logBuffer.length);
    }
    updateTickerDisplay();

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

  // Initial synthetic logs
  appendLogEntry({
    time: new Date().toLocaleTimeString(),
    source: 'App:Init',
    level: 'INFO',
    message: 'VectOrEditOr system initializing...'
  });

  if (window.engineAPI?.onSystemLog) {
    window.engineAPI.onSystemLog((log) => {
      appendLogEntry(log);
    });
  }

  if (btnToggleConsole && systemLogPanel) {
    btnToggleConsole.addEventListener('click', () => {
      const isHidden = systemLogPanel.style.display === 'none';
      systemLogPanel.style.display = isHidden ? 'flex' : 'none';
      btnToggleConsole.classList.toggle('toolbar-btn-active', isHidden);
      if (isHidden && logEntriesContainer) {
        logEntriesContainer.scrollTop = logEntriesContainer.scrollHeight;
      }
    });
  }

  if (btnCloseLogs && systemLogPanel) {
    btnCloseLogs.addEventListener('click', () => {
      systemLogPanel.style.display = 'none';
      if (btnToggleConsole) btnToggleConsole.classList.remove('toolbar-btn-active');
    });
  }

  if (btnClearLogs && logEntriesContainer) {
    btnClearLogs.addEventListener('click', () => {
      logBuffer.length = 0;
      logEntriesContainer.innerHTML = '';
      if (logCountBadge) logCountBadge.textContent = '0';
    });
  }

  if (btnCopyLogs) {
    btnCopyLogs.addEventListener('click', () => {
      const text = logBuffer.map(l => `[${l.time}] [${l.level}] [${l.source}] ${l.message}`).join('\n');
      navigator.clipboard.writeText(text);
      const og = btnCopyLogs.textContent;
      btnCopyLogs.textContent = 'Copied!';
      setTimeout(() => { btnCopyLogs.textContent = og; }, 1500);
    });
  }

  await Promise.all([editorPromise, initModulesPromise]);
});
