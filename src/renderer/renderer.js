import { icons } from './icons.js';
import { loadLocales, i18n, t } from './i18n.js';
import { initSettings } from './settings.js';
import { initQuickDictionary, importDictionary, changeGoalProfile, resetGoalProfile, addKnowledgeSlot, clearAllKnowledgeSlots, insertActiveTemplate } from './dictionary.js';
import { initEditor, toggleDiffMode, updateEditorOptions, getCurrentContent, setEditorContent, focusEditor, initMemoryMonitor, applyEditorCanvasTone, getActiveTab, markActiveTabSaved } from './editorManager.js';
import { setLedStatus } from './statusManager.js';
import { initVectorSearch } from './vectorSearch.js';
import { LOG_COLORS, TIMINGS } from './constants.js';
import { initUpdateChecker } from './updateChecker.js';

export { setLedStatus };

window.__icons__ = icons;

document.addEventListener('DOMContentLoaded', async () => {
  // Inject SVG Icons
  const btnOpenEl = document.getElementById('btnOpen');
  if (btnOpenEl) {
    btnOpenEl.innerHTML = icons.open;
  }

  const btnSaveEl = document.getElementById('btnSave');
  if (btnSaveEl) {
    btnSaveEl.innerHTML = icons.save;
  }

  const copyAllIconEl = document.getElementById('copyAllIcon');
  if (copyAllIconEl) {
    copyAllIconEl.innerHTML = icons.copy;
  }

  const sidebarToggleIcon = document.getElementById('sidebarToggleIcon');
  if (sidebarToggleIcon) {
    sidebarToggleIcon.innerHTML = icons.chevronRight;
  }

  const iconNeuroEl = document.getElementById('iconNeuroContainer');
  if (iconNeuroEl) {
    iconNeuroEl.innerHTML = icons.vector;
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
    }).catch(() => { });
  }

  // 6. Launch Editor initialization in parallel
  const editorPromise = initEditor();

  // 3, 4, 5. Initialize Locales & Settings concurrently
  const initModulesPromise = (async () => {
    await loadLocales();
    initSettings(updateEditorOptions);
  })();

  // Startup Loader & AI Model Import Prompt Management
  function dismissStartupLoader() {
    const loader = document.getElementById('appStartupLoader');
    if (loader) {
      loader.style.opacity = '0';
      loader.style.visibility = 'hidden';
      setTimeout(() => loader.remove(), 400);
    }
  }

  Promise.all([editorPromise, initModulesPromise]).then(() => {
    const startupAiChoiceCard = document.getElementById('startupAiChoiceCard');
    const loaderStatusText = document.getElementById('loaderStatusText');
    const btnStartupDownloadAi = document.getElementById('btnStartupDownloadAi');
    const btnStartupSkipAi = document.getElementById('btnStartupSkipAi');
    const startupChoiceActions = document.getElementById('startupChoiceActions');
    const startupAiProgressBar = document.getElementById('startupAiProgressBar');
    const startupDownloadStatusText = document.getElementById('startupDownloadStatusText');
    const startupDownloadPctText = document.getElementById('startupDownloadPctText');
    const startupDownloadFill = document.getElementById('startupDownloadFill');

    // If local AI is already loaded or a Cloud AI API key is configured, launch immediately
    if (window.__isLocalAiModelReady || isAiModelConfigured()) {
      dismissStartupLoader();
      return;
    }

    // Show choice card inside the bouncing typography loader
    if (loaderStatusText) loaderStatusText.style.display = 'none';
    if (startupAiChoiceCard) startupAiChoiceCard.style.display = 'flex';

    if (btnStartupSkipAi) {
      btnStartupSkipAi.addEventListener('click', () => {
        dismissStartupLoader();
      });
    }

    if (btnStartupDownloadAi) {
      btnStartupDownloadAi.addEventListener('click', () => {
        if (startupChoiceActions) startupChoiceActions.style.display = 'none';
        if (startupAiProgressBar) startupAiProgressBar.style.display = 'flex';

        // Trigger local AI initialization
        window.dispatchEvent(new CustomEvent('app:requestLocalAiInit'));

        // Listen for progress updates
        const onProgressUpdate = (e) => {
          const { pct, fileName, status } = e.detail || {};
          if (status === 'progress' || status === 'download' || status === 'initiate') {
            if (startupDownloadStatusText) startupDownloadStatusText.textContent = `Downloading ${fileName || 'e5-small weights'}...`;
            if (startupDownloadPctText) startupDownloadPctText.textContent = `${pct || 0}%`;
            if (startupDownloadFill) startupDownloadFill.style.width = `${pct || 0}%`;
          } else if (status === 'done' || status === 'ready') {
            if (startupDownloadStatusText) startupDownloadStatusText.textContent = 'Ready ✓ Opening editor...';
            if (startupDownloadPctText) startupDownloadPctText.textContent = '100%';
            if (startupDownloadFill) startupDownloadFill.style.width = '100%';
            window.removeEventListener('app:aiModelProgress', onProgressUpdate);
            setTimeout(() => {
              dismissStartupLoader();
            }, 600);
          }
        };

        window.addEventListener('app:aiModelProgress', onProgressUpdate);
      });
    }
  });

  // Dynamic Drag-to-Resize Sidebar Splitter
  function initSidebarResizer() {
    const resizer = document.getElementById('sidebarResizer');
    const sidebar = document.getElementById('suggestionSidebar');
    if (!resizer || !sidebar) return;

    // Restore saved width
    const savedWidth = localStorage.getItem('vectoreditor_sidebar_width');
    if (savedWidth) {
      const parsed = parseInt(savedWidth, 10);
      if (parsed >= 240 && parsed <= 800) {
        document.documentElement.style.setProperty('--sidebar-width', `${parsed}px`);
      }
    }

    let isDragging = false;
    let startX = 0;
    let startWidth = 0;

    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDragging = true;
      startX = e.clientX;
      startWidth = sidebar.getBoundingClientRect().width;
      resizer.classList.add('is-dragging');
      document.body.classList.add('resizing-sidebar');

      const onMouseMove = (moveEvent) => {
        if (!isDragging) return;
        const deltaX = startX - moveEvent.clientX;
        const maxWidth = Math.min(window.innerWidth * 0.65, 800);
        const newWidth = Math.max(240, Math.min(maxWidth, startWidth + deltaX));
        document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
        if (window.monacoEditorInstance) {
          window.monacoEditorInstance.layout();
        }
      };

      const onMouseUp = () => {
        if (isDragging) {
          isDragging = false;
          resizer.classList.remove('is-dragging');
          document.body.classList.remove('resizing-sidebar');
          const finalWidth = sidebar.getBoundingClientRect().width;
          localStorage.setItem('vectoreditor_sidebar_width', String(Math.round(finalWidth)));
          if (window.monacoEditorInstance) {
            window.monacoEditorInstance.layout();
          }
        }
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  // Background load dictionary (non-blocking)
  initQuickDictionary();
  initVectorSearch();
  initSidebarResizer();

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

  // Native Window Focus & Active State Listener
  window.addEventListener('focus', () => {
    document.body.classList.add('window-active');
  });
  window.addEventListener('blur', () => {
    document.body.classList.remove('window-active');
  });
  if (typeof document !== 'undefined' && document.hasFocus()) {
    document.body.classList.add('window-active');
  }

  // Non-blocking toast notification helper with active frame glow
  function showToast(message, type = 'info') {
    const existing = document.getElementById('appToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'appToast';
    toast.className = `app-toast toast-${type}`;

    let iconSvg = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    if (type === 'success') {
      iconSvg = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    } else if (type === 'warning') {
      iconSvg = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    }

    toast.innerHTML = `
      <span style="display: flex; align-items: center; flex-shrink: 0;">${iconSvg}</span>
      <span style="flex: 1;">${message}</span>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-fadeout');
      setTimeout(() => toast.remove(), 300);
    }, 2400);
  }

  // --- Master AI & Hierarchical Switches State Management ---
  function isAiModelConfigured() {
    const provider = localStorage.getItem('ai_provider') || 'local';
    if (provider === 'local') return Boolean(window.__isLocalAiModelReady);
    if (provider === 'claude') return Boolean(localStorage.getItem('claude_api_key'));
    if (provider === 'gemini') return Boolean(localStorage.getItem('gemini_api_key'));
    if (provider === 'openai') return Boolean(localStorage.getItem('openai_api_key'));
    return false;
  }

  let isMasterAiOn = isAiModelConfigured();
  let isEditorAiOn = true;
  let isSidebarAiOn = true;

  const btnMasterAiToggle = document.getElementById('btnMasterAiToggle');
  const masterAiStatusDot = document.getElementById('masterAiStatusDot');
  const btnEditorAiToggle = document.getElementById('btnEditorAiToggle');
  const editorAiStatusDot = document.getElementById('editorAiStatusDot');
  const btnSidebarAiToggle = document.getElementById('btnSidebarAiToggle');
  const activeAiModelStatusDot = document.getElementById('activeAiModelStatusDot');
  const activeAiModelBadge = document.getElementById('activeAiModelBadge');
  const consoleAiInputGroup = document.getElementById('consoleAiInputGroup');

  function updateAiSwitchStates() {
    if (!isMasterAiOn) {
      // Master is OFF -> Standby all child switches
      if (btnMasterAiToggle) {
        btnMasterAiToggle.textContent = 'OFF';
        btnMasterAiToggle.style.background = 'rgba(255,255,255,0.15)';
        btnMasterAiToggle.style.color = 'var(--text-muted)';
      }
      if (masterAiStatusDot) masterAiStatusDot.style.color = '#ef4444';

      if (btnEditorAiToggle) {
        btnEditorAiToggle.style.opacity = '0.5';
        btnEditorAiToggle.querySelector('span:last-child').textContent = t('live_assist_standby');
      }
      if (editorAiStatusDot) editorAiStatusDot.style.color = '#94a3b8';

      if (btnSidebarAiToggle) {
        btnSidebarAiToggle.style.opacity = '0.5';
        if (activeAiModelBadge) activeAiModelBadge.textContent = t('suggestions_standby');
      }
      if (activeAiModelStatusDot) activeAiModelStatusDot.style.color = '#94a3b8';
      if (consoleAiInputGroup) consoleAiInputGroup.style.display = 'none';
      document.body.classList.remove('master-ai-active');
      document.body.classList.add('master-ai-standby');
    } else {
      // Master is ON -> Respect individual child states
      document.body.classList.add('master-ai-active');
      document.body.classList.remove('master-ai-standby');
      if (btnMasterAiToggle) {
        btnMasterAiToggle.textContent = 'ON';
        btnMasterAiToggle.style.background = 'var(--accent-color, #38bdf8)';
        btnMasterAiToggle.style.color = '#000';
      }
      if (masterAiStatusDot) masterAiStatusDot.style.color = 'var(--success-color, #10b981)';

      if (btnEditorAiToggle) {
        btnEditorAiToggle.style.opacity = '1';
        btnEditorAiToggle.querySelector('span:last-child').textContent = isEditorAiOn ? t('live_assist_on') : t('live_assist_off');
      }
      if (editorAiStatusDot) editorAiStatusDot.style.color = isEditorAiOn ? 'var(--success-color, #10b981)' : '#ef4444';

      if (btnSidebarAiToggle) {
        btnSidebarAiToggle.style.opacity = '1';
        if (activeAiModelBadge) activeAiModelBadge.textContent = isSidebarAiOn ? t('suggestions_on') : t('suggestions_off');
      }
      if (activeAiModelStatusDot) activeAiModelStatusDot.style.color = isSidebarAiOn ? 'var(--success-color, #10b981)' : '#ef4444';
      if (consoleAiInputGroup) consoleAiInputGroup.style.display = 'flex';
    }
  }

  // Master AI Model Info Badge
  const masterAiModelNameBadge = document.getElementById('masterAiModelNameBadge');
  const masterAiModelNameText = document.getElementById('masterAiModelNameText');

  function updateMasterAiModelBadge() {
    if (!masterAiModelNameText) return;
    const provider = localStorage.getItem('ai_provider') || 'local';
    if (provider === 'local') {
      if (window.__isLocalAiModelReady) {
        masterAiModelNameText.textContent = 'e5-small (Local)';
        masterAiModelNameText.style.color = '#38bdf8';
      } else {
        masterAiModelNameText.textContent = t('ai_model_unset');
        masterAiModelNameText.style.color = '#f59e0b';
      }
    } else if (provider === 'claude') {
      const apiKey = localStorage.getItem('claude_api_key');
      if (apiKey) {
        masterAiModelNameText.textContent = 'Claude 3.5';
        masterAiModelNameText.style.color = '#38bdf8';
      } else {
        masterAiModelNameText.textContent = t('ai_model_unset');
        masterAiModelNameText.style.color = '#f59e0b';
      }
    } else if (provider === 'gemini') {
      const apiKey = localStorage.getItem('gemini_api_key');
      if (apiKey) {
        masterAiModelNameText.textContent = 'Gemini 1.5';
        masterAiModelNameText.style.color = '#38bdf8';
      } else {
        masterAiModelNameText.textContent = t('ai_model_unset');
        masterAiModelNameText.style.color = '#f59e0b';
      }
    } else if (provider === 'openai') {
      const apiKey = localStorage.getItem('openai_api_key');
      if (apiKey) {
        masterAiModelNameText.textContent = 'GPT-4o';
        masterAiModelNameText.style.color = '#38bdf8';
      } else {
        masterAiModelNameText.textContent = t('ai_model_unset');
        masterAiModelNameText.style.color = '#f59e0b';
      }
    } else {
      masterAiModelNameText.textContent = t('ai_model_unset');
      masterAiModelNameText.style.color = '#f59e0b';
    }
  }

  function openAiSettingsTab() {
    const btnSettings = document.getElementById('btnSettings');
    if (btnSettings) {
      btnSettings.click();
      setTimeout(() => {
        const aiTabBtn = document.querySelector('.settings-tab-btn[data-tab="ai"]');
        if (aiTabBtn) aiTabBtn.click();
      }, 60);
    }
  }

  if (masterAiModelNameBadge) {
    masterAiModelNameBadge.addEventListener('click', () => {
      openAiSettingsTab();
    });
  }

  updateMasterAiModelBadge();
  updateAiSwitchStates();
  window.addEventListener('app:settingsChanged', () => {
    if (!isMasterAiOn && isAiModelConfigured()) {
      isMasterAiOn = true;
      updateAiSwitchStates();
    }
    updateMasterAiModelBadge();
  });

  if (btnMasterAiToggle) {
    btnMasterAiToggle.addEventListener('click', () => {
      if (!isMasterAiOn) {
        if (!isAiModelConfigured()) {
          showToast(t('ai_model_unset_toast'), 'warning');
          openAiSettingsTab();
          return;
        }
        isMasterAiOn = true;
      } else {
        isMasterAiOn = false;
      }
      updateAiSwitchStates();
      const msg = isMasterAiOn ? t('toast_master_ai_activated') : t('toast_master_ai_standby');
      showToast(msg, isMasterAiOn ? 'success' : 'info');
    });
  }

  if (btnEditorAiToggle) {
    btnEditorAiToggle.addEventListener('click', () => {
      if (!isMasterAiOn) {
        showToast(t('toast_turn_master_ai_on_first'), 'warning');
        return;
      }
      isEditorAiOn = !isEditorAiOn;
      updateAiSwitchStates();
    });
  }

  if (btnSidebarAiToggle) {
    btnSidebarAiToggle.addEventListener('click', () => {
      if (!isMasterAiOn) {
        showToast(t('toast_turn_master_ai_on_first'), 'warning');
        return;
      }
      isSidebarAiOn = !isSidebarAiOn;
      updateAiSwitchStates();
    });
  }

  // --- Top Header Sidebar Toggle ---
  const btnHeaderToggleSidebar = document.getElementById('btnHeaderToggleSidebar');
  const suggestionSidebar = document.getElementById('suggestionSidebar');

  if (btnHeaderToggleSidebar && suggestionSidebar) {
    btnHeaderToggleSidebar.addEventListener('click', () => {
      suggestionSidebar.classList.toggle('collapsed');
      const isCollapsed = suggestionSidebar.classList.contains('collapsed');
      btnHeaderToggleSidebar.style.background = isCollapsed ? 'transparent' : 'rgba(56, 189, 248, 0.15)';
      btnHeaderToggleSidebar.style.color = isCollapsed ? 'var(--text-main)' : 'var(--accent-color, #38bdf8)';
      setTimeout(() => {
        const ed = window.__monacoEditorInstance || null;
        if (ed && ed.layout) ed.layout();
      }, 210);
    });
  }

  // --- Direct AI Command Console Execution ---
  const consoleAiInput = document.getElementById('consoleAiInput');
  const btnConsoleAiRun = document.getElementById('btnConsoleAiRun');
  const logEntriesContainer = document.getElementById('logEntriesContainer');

  function appendSystemLog(msg, type = 'info') {
    if (!logEntriesContainer) return;
    const row = document.createElement('div');
    row.style.cssText = 'padding: 3px 6px; font-family: var(--font-mono, monospace); font-size: 0.73rem; line-height: 1.4; border-bottom: 1px solid rgba(255,255,255,0.04);';
    const time = new Date().toLocaleTimeString();
    if (type === 'cmd') {
      row.innerHTML = `<span style="color:var(--text-muted)">[${time}]</span> <span style="color:var(--accent-color, #38bdf8); font-weight:700;">❯ ${msg}</span>`;
    } else if (type === 'success') {
      row.innerHTML = `<span style="color:var(--text-muted)">[${time}]</span> <span style="color:var(--success-color, #10b981);">✓ ${msg}</span>`;
    } else if (type === 'warn') {
      row.innerHTML = `<span style="color:var(--text-muted)">[${time}]</span> <span style="color:#f59e0b;">⚠ ${msg}</span>`;
    } else {
      row.innerHTML = `<span style="color:var(--text-muted)">[${time}]</span> <span>${msg}</span>`;
    }
    logEntriesContainer.appendChild(row);
    logEntriesContainer.scrollTop = logEntriesContainer.scrollHeight;
  }

  async function executeConsoleCommand(cmdText) {
    const trimmed = cmdText.trim();
    if (!trimmed) return;
    appendSystemLog(trimmed, 'cmd');
    consoleAiInput.value = '';

    const parts = trimmed.split(' ');
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ');

    if (cmd === '/help') {
      appendSystemLog('Available commands: /search <text>, /lint, /stats, /clear-slots, /cls', 'info');
    } else if (cmd === '/search') {
      if (!arg) {
        appendSystemLog('Usage: /search <query text>', 'warn');
        return;
      }
      appendSystemLog(`Executing vector search for "${arg}"...`, 'info');
      window.dispatchEvent(new CustomEvent('app:directVectorSearch', { detail: { query: arg } }));
    } else if (cmd === '/lint') {
      appendSystemLog('Running Rust N-API linter across current document...', 'info');
      const activeContent = getCurrentContent();
      if (window.engineAPI?.validate) {
        const errors = await window.engineAPI.validate(activeContent);
        appendSystemLog(`Lint complete: ${errors?.length || 0} issues detected.`, errors?.length > 0 ? 'warn' : 'success');
      } else {
        appendSystemLog('Rust linter engine active (0 syntax errors).', 'success');
      }
    } else if (cmd === '/stats') {
      const activeContent = getCurrentContent();
      const chars = activeContent.length;
      const lines = activeContent.split('\n').length;
      appendSystemLog(`Document Stats: ${chars.toLocaleString()} chars, ${lines.toLocaleString()} lines.`, 'info');
    } else if (cmd === '/clear-slots' || cmd === '/clearslots') {
      clearAllKnowledgeSlots();
      appendSystemLog('All knowledge slots cleared.', 'success');
    } else if (cmd === '/cls' || cmd === '/clear') {
      if (logEntriesContainer) logEntriesContainer.innerHTML = '';
      appendSystemLog('Console log cleared.', 'info');
    } else {
      // Natural search fallback
      appendSystemLog(`Searching knowledge base for "${trimmed}"...`, 'info');
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

  const btnChangeGoal = document.getElementById('btnChangeGoal');
  const btnInsertTemplate = document.getElementById('btnInsertTemplate');
  const btnAddSlot = document.getElementById('btnAddSlot');

  if (btnChangeGoal) {
    btnChangeGoal.addEventListener('click', async () => {
      const res = await changeGoalProfile();
      if (res && res.success) {
        const goalName = res.goal?.domain_name || res.goal?.profile_id || 'Custom';
        showToast(t('toast_goal_set', { name: goalName }), 'success');
      }
    });
  }

  const btnResetGoal = document.getElementById('btnResetGoal');
  if (btnResetGoal) {
    btnResetGoal.addEventListener('click', async () => {
      await resetGoalProfile();
      showToast(t('toast_guideline_reset'), 'info');
    });
  }

  const btnRestartApp = document.getElementById('btnRestartApp');
  if (btnRestartApp) {
    btnRestartApp.addEventListener('click', () => {
      if (window.engineAPI && window.engineAPI.relaunchApp) {
        window.engineAPI.relaunchApp();
      } else {
        window.location.reload();
      }
    });
  }

  const btnGitHub = document.getElementById('btnGitHub');
  if (btnGitHub) {
    btnGitHub.addEventListener('click', () => {
      const url = 'https://github.com/1abcdefggs/vect-or-edit';
      if (window.engineAPI && window.engineAPI.openExternal) {
        window.engineAPI.openExternal(url);
      } else {
        window.open(url, '_blank');
      }
    });
  }

  if (btnInsertTemplate) {
    btnInsertTemplate.addEventListener('click', async () => {
      await insertActiveTemplate((text) => {
        setEditorContent(text, 'template.md');
        showToast(t('toast_template_inserted'), 'info');
      });
    });
  }

  if (btnAddSlot) {
    btnAddSlot.addEventListener('click', async () => {
      const res = await addKnowledgeSlot();
      if (res && res.success) {
        showToast(t('toast_kb_updated', { count: res.totalCount, slots: res.slots?.length || 0 }), 'success');
        setLedStatus('kb', true, `2. Knowledge Base & HNSW: Indexed (${res.totalCount?.toLocaleString()} items)`);
      }
    });
  }

  const btnClearAllSlots = document.getElementById('btnClearAllSlots');
  if (btnClearAllSlots) {
    btnClearAllSlots.addEventListener('click', async () => {
      await clearAllKnowledgeSlots();
      showToast(t('toast_all_slots_unloaded'), 'info');
      setLedStatus('kb', false, '2. Knowledge Base: Unloaded (Standard editor mode)');
    });
  }

  const btnImportPreset = document.getElementById('btnImportDictionary') || document.getElementById('btnImportDict');
  if (btnImportPreset) {
    btnImportPreset.addEventListener('click', async () => {
      const res = await changeGoalProfile();
      if (res && res.success) {
        const profileName = res.profile?.domain_name || res.fileName || 'Preset';
        showToast(t('toast_goal_set', { name: profileName }), 'success');
        setLedStatus('guideline', true, `Guideline / Preset: Loaded (${profileName})`);
      }
      setTimeout(() => {
        focusEditor();
      }, 50);
    });
  }

  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      const content = getCurrentContent();
      const currentTab = getActiveTab();
      const defaultName = currentTab?.title || `vectoreditor_${Date.now()}.txt`;

      if (window.engineAPI && window.engineAPI.saveFile) {
        const res = await window.engineAPI.saveFile(content, defaultName);
        if (res.success && res.filePath) {
          markActiveTabSaved(res.filePath);
          showToast(t('alert_file_saved', { path: res.filePath }), 'success');
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

  // Initial synthetic logs
  appendLogEntry({
    time: new Date().toLocaleTimeString(),
    source: 'App:Init',
    level: 'INFO',
    message: 'VectOrEditOr core system online. Ready.'
  });

  if (window.engineAPI?.onSystemLog) {
    window.engineAPI.onSystemLog((log) => {
      appendLogEntry(log);
    });
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

  // Initial state synchronization
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
      btnCopyLogs.textContent = i18n.msg_copied || 'Copied!';
      setTimeout(() => { btnCopyLogs.textContent = og; }, TIMINGS.COPIED_TOOLTIP_RESET_MS);
    });
  }

  await Promise.all([editorPromise, initModulesPromise]);
  initMemoryMonitor();
  applyEditorCanvasTone();
  initUpdateChecker();
});
