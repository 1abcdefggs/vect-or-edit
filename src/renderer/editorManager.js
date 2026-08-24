import { getTheme, getFontFamily, getFontSize } from './settings.js';
import { loadTheme, registerAllMonacoThemes, safeSetMonacoTheme } from './themeLoader.js';
import { triggerMonacoVectorSearch, showSelectionPopoverMenu, removeContextMenu } from './vectorSearch.js';
import { allDictEntries } from './dictionary.js';
import { i18n, t } from './i18n.js';
import { setLedStatus } from './statusManager.js';
import { STORAGE_KEYS, DEFAULTS, TIMINGS } from './constants.js';

let isDiffMode = false;
let monacoEditorInstance = null;
let monacoDiffEditorInstance = null;
let savedVersionText = '';
let linterTimeout = null;
let monaco = null;

// Multi-document Tab State
export let tabs = [];
export let activeTabId = null;
let tabCounter = 1;
const autoSaveTimers = new Map();

// Stroke history tracking for workload analysis
let recentEditCount = 0;
let editCounterResetTimer = null;

export function updateAutoSaveUI() {
  const isAutoSaveEnabled = localStorage.getItem(STORAGE_KEYS.AUTO_SAVE) !== 'false';
  const btnToggle = document.getElementById('btnToggleAutoSave');
  const labelEl = document.getElementById('autoSaveLabel');
  const iconEl = document.getElementById('autoSaveIcon');

  if (btnToggle && labelEl && iconEl) {
    if (isAutoSaveEnabled) {
      btnToggle.style.background = 'rgba(16, 185, 129, 0.12)';
      btnToggle.style.borderColor = 'rgba(16, 185, 129, 0.35)';
      btnToggle.style.color = 'var(--success-color, #10b981)';
      labelEl.textContent = i18n.autosave_on || 'Auto-Save: ON';
      iconEl.style.color = 'var(--success-color, #10b981)';
      btnToggle.title = i18n.tooltip_autosave_on || 'Adaptive Auto-Save: Enabled (Intelligently extends interval during heavy load)';
    } else {
      btnToggle.style.background = 'rgba(148, 163, 184, 0.1)';
      btnToggle.style.borderColor = 'rgba(148, 163, 184, 0.3)';
      btnToggle.style.color = 'var(--text-muted, #94a3b8)';
      labelEl.textContent = i18n.autosave_off || 'Auto-Save: OFF';
      iconEl.style.color = 'var(--text-muted, #94a3b8)';
      btnToggle.title = i18n.tooltip_autosave_off || 'Auto-Save: Disabled (Manual Save Ctrl+S required)';
    }
  }
}

export function initAutoSaveControls() {
  const btnToggle = document.getElementById('btnToggleAutoSave');
  if (btnToggle) {
    btnToggle.addEventListener('click', () => {
      const current = localStorage.getItem(STORAGE_KEYS.AUTO_SAVE) !== 'false';
      const next = !current;
      localStorage.setItem(STORAGE_KEYS.AUTO_SAVE, String(next));
      updateAutoSaveUI();
    });
  }
  updateAutoSaveUI();
}

// Dynamic Adaptive Auto-Save function with continuous load analysis
export function triggerAdaptiveAutoSave(tab, immediate = false) {
  const isAutoSaveEnabled = localStorage.getItem(STORAGE_KEYS.AUTO_SAVE) !== 'false';
  if (!isAutoSaveEnabled || !tab || !tab.model) return;

  if (autoSaveTimers.has(tab.id)) {
    clearTimeout(autoSaveTimers.get(tab.id));
  }

  const executeSave = () => {
    try {
      const content = tab.model.getValue();
      // Snapshot save into local session cache
      localStorage.setItem(`autosave_${tab.id}`, JSON.stringify({
        title: tab.title,
        content,
        timestamp: Date.now()
      }));

      tab.isDirty = false;
      renderTabs();

      const saveInd = document.getElementById('statusSaveIndicator');
      if (saveInd) {
        saveInd.textContent = t('status_saved');
        saveInd.style.opacity = '1';
        setTimeout(() => {
          saveInd.style.opacity = '0.5';
          saveInd.textContent = 'Auto-Save';
        }, 1500);
      }

      const autoSaveLabel = document.getElementById('autoSaveLabel');
      if (autoSaveLabel && isAutoSaveEnabled) {
        autoSaveLabel.textContent = `Auto-Save: ${t('status_saved')}`;
        setTimeout(() => {
          if (autoSaveLabel) autoSaveLabel.textContent = t('autosave_on');
        }, 1500);
      }
    } catch (err) {
      console.warn('Auto-save failed:', err);
    }
  };

  // Immediate save on line break (Enter key / paragraph boundary)
  if (immediate) {
    executeSave();
    return;
  }

  recentEditCount++;
  if (editCounterResetTimer) clearTimeout(editCounterResetTimer);
  editCounterResetTimer = setTimeout(() => {
    recentEditCount = 0;
  }, 3000);

  // Pre-analyze memory & continuous workload load
  let delay = TIMINGS.AUTO_SAVE_BASE_MS || 1500;
  try {
    const memory = performance?.memory;
    const currentMemoryMB = memory ? memory.usedJSHeapSize / (1024 * 1024) : 40;
    const contentLength = tab.model.getValueLength();

    if (currentMemoryMB > 160 || contentLength > 120000 || recentEditCount > 20) {
      delay = 4500;
    } else if (currentMemoryMB > 100 || contentLength > 40000 || recentEditCount > 8) {
      delay = 3000;
    } else {
      delay = 1500;
    }
  } catch (_) {}

  const timer = setTimeout(executeSave, delay);
  autoSaveTimers.set(tab.id, timer);
}

// Configure Monaco WebWorker environment safely for Vite & Electron
if (typeof window !== 'undefined') {
  window.MonacoEnvironment = {
    getWorkerUrl: function (_moduleId, _label) {
      const workerCode = `
        self.MonacoEnvironment = {
          baseUrl: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/'
        };
        importScripts('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs/base/worker/workerMain.js');
      `;
      return `data:text/javascript;charset=utf-8,${encodeURIComponent(
        `self.onmessage = () => {};`
      )}`;
    }
  };
}

function generateDefaultDocumentTitle() {
  const num = tabCounter++;
  return `Doc-${num}.md`;
}

export function createNewTab(title = null, initialContent = '', filePath = null) {
  if (!monaco) return null;
  const id = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const tabTitle = title || generateDefaultDocumentTitle();
  const model = monaco.editor.createModel(initialContent, 'markdown');

  model.onDidChangeContent((e) => {
    const tab = tabs.find(t => t.id === id);
    if (tab && !tab.isDirty) {
      tab.isDirty = true;
      renderTabs();
    }
    const hasLineBreak = e?.changes ? e.changes.some(c => c.text && c.text.includes('\n')) : false;
    if (tab) {
      triggerAdaptiveAutoSave(tab, hasLineBreak);
    }
    if (activeTabId === id) {
      updateStatusBar(tab ? tab.title : null);
    }
  });

  const tabObj = {
    id,
    title: tabTitle,
    model,
    filePath,
    isDirty: false
  };

  tabs.push(tabObj);
  renderTabs();
  switchTab(id);
  return tabObj;
}

export function switchTab(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab || !monacoEditorInstance) return;

  activeTabId = tabId;
  monacoEditorInstance.setModel(tab.model);
  updateStatusBar(tab.title);
  renderTabs();
  monacoEditorInstance.focus();
}

export function closeTab(tabId, e) {
  if (e) e.stopPropagation();
  const index = tabs.findIndex(t => t.id === tabId);
  if (index === -1) return;

  const [closingTab] = tabs.splice(index, 1);
  if (closingTab && closingTab.model) {
    closingTab.model.dispose();
  }

  if (tabs.length === 0) {
    createNewTab();
  } else if (activeTabId === tabId) {
    const nextIndex = Math.max(0, index - 1);
    switchTab(tabs[nextIndex].id);
  } else {
    renderTabs();
  }
}

export function triggerRpgSavedExpFloat(tabId = activeTabId) {
  const tabsContainer = document.getElementById('editorTabsList');
  if (!tabsContainer) return;

  const targetTab = tabId ? tabsContainer.querySelector(`[data-tab-id="${tabId}"]`) : tabsContainer.querySelector('.editor-tab-item.active');
  if (!targetTab) return;

  // Remove any existing float badge
  const existing = targetTab.querySelector('.rpg-saved-float');
  if (existing) existing.remove();

  const floatBadge = document.createElement('span');
  floatBadge.className = 'rpg-saved-float';
  floatBadge.textContent = '+Saved ✓';
  targetTab.appendChild(floatBadge);

  setTimeout(() => {
    floatBadge.remove();
  }, 950);
}

export function renderTabs() {
  const tabsContainer = document.getElementById('editorTabsList');
  if (!tabsContainer) return;
  tabsContainer.innerHTML = '';

  tabs.forEach(tab => {
    const tabEl = document.createElement('div');
    tabEl.setAttribute('data-tab-id', tab.id);
    tabEl.className = `editor-tab-item ${tab.id === activeTabId ? 'active' : ''} ${tab.isDirty ? 'is-dirty' : 'is-saved'}`;
    tabEl.title = `${tab.filePath || tab.title} (Double-click to rename)`;

    const statusBadgeHtml = tab.isDirty
      ? `<span class="tab-dirty-dot" title="Unsaved changes"></span>`
      : ``;

    tabEl.innerHTML = `
      <span class="tab-title">${tab.title}</span>
      ${statusBadgeHtml}
      <button class="btn-tab-close" title="Close Tab">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    `;

    tabEl.addEventListener('click', () => switchTab(tab.id));

    // Double click to rename tab title
    const titleSpan = tabEl.querySelector('.tab-title');
    if (titleSpan) {
      tabEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const input = document.createElement('input');
        input.type = 'text';
        input.value = tab.title;
        input.className = 'tab-rename-input';
        input.style.cssText = 'background: var(--bg-primary); color: var(--text-main); border: 1px solid var(--accent-color); border-radius: 3px; font-size: 0.75rem; padding: 1px 4px; width: 110px; outline: none;';

        const saveNewName = () => {
          const newName = input.value.trim();
          if (newName && newName !== tab.title) {
            tab.title = newName;
            tab.isDirty = true; // Mark dirty since filename changed without saving
            updateStatusBar(tab.title);
          }
          renderTabs();
        };

        input.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') {
            saveNewName();
          } else if (ke.key === 'Escape') {
            renderTabs();
          }
        });
        input.addEventListener('blur', saveNewName);

        titleSpan.replaceWith(input);
        input.focus();
        input.select();
      });
    }

    const btnClose = tabEl.querySelector('.btn-tab-close');
    if (btnClose) {
      btnClose.addEventListener('click', (ev) => closeTab(tab.id, ev));
    }

    tabsContainer.appendChild(tabEl);
  });

  // Inline '+' New Tab Button placed directly adjacent to the last tab
  const btnInlineNewTab = document.createElement('button');
  btnInlineNewTab.className = 'btn-new-tab';
  btnInlineNewTab.id = 'btnNewTabInline';
  btnInlineNewTab.title = 'New Document (Ctrl+T)';
  btnInlineNewTab.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
  btnInlineNewTab.addEventListener('click', () => createNewTab());
  tabsContainer.appendChild(btnInlineNewTab);
}

export function getActiveTab() {
  return tabs.find(t => t.id === activeTabId) || null;
}

export function markActiveTabSaved(savedFilePath) {
  const tab = getActiveTab();
  if (tab) {
    tab.isDirty = false;
    if (savedFilePath) {
      tab.filePath = savedFilePath;
      // Extract filename from saved file path
      const baseName = savedFilePath.split(/[/\\]/).pop();
      if (baseName) tab.title = baseName;
    }
    renderTabs();
    triggerRpgSavedExpFloat(tab.id);
    updateStatusBar(tab.title);
  }
}

export function extractSelectionToNewTab(mode = 'copy') {
  if (!monacoEditorInstance) return;
  const selection = monacoEditorInstance.getSelection();
  if (!selection || selection.isEmpty()) return;

  const model = monacoEditorInstance.getModel();
  if (!model) return;

  const text = model.getValueInRange(selection);
  if (!text) return;

  if (mode === 'cut') {
    monacoEditorInstance.executeEdits('extract-cut', [{
      range: selection,
      text: '',
      forceMoveMarkers: true
    }]);
  }

  const activeTab = getActiveTab();
  const sourceTitle = activeTab ? activeTab.title.replace(/\.[^/.]+$/, '') : 'Doc';
  const newTitle = `${sourceTitle}_extracted.md`;
  createNewTab(newTitle, text);
}

export function duplicateCurrentTab() {
  const activeTab = getActiveTab();
  if (!activeTab || !activeTab.model) return;

  const content = activeTab.model.getValue();
  const baseTitle = activeTab.title.replace(/\.[^/.]+$/, '');
  const ext = activeTab.title.includes('.') ? `.${activeTab.title.split('.').pop()}` : '.md';
  const newTitle = `${baseTitle}_copy${ext}`;

  createNewTab(newTitle, content);
}

let isEditorInitializing = false;

export async function initEditor() {
  if (isEditorInitializing) return monacoEditorInstance;
  isEditorInitializing = true;

  const monacoContainer = document.getElementById('monacoContainer');
  if (!monacoContainer) {
    console.error('monacoContainer DOM element not found');
    isEditorInitializing = false;
    return null;
  }

  // Dispose previous editor instances and clean DOM container completely
  if (monacoEditorInstance) {
    try {
      monacoEditorInstance.dispose();
    } catch (_) {}
    monacoEditorInstance = null;
  }
  if (monacoDiffEditorInstance) {
    try {
      monacoDiffEditorInstance.dispose();
    } catch (_) {}
    monacoDiffEditorInstance = null;
  }
  monacoContainer.innerHTML = '';

  if (!monaco) monaco = await import('monaco-editor');
  await registerAllMonacoThemes();

  monacoEditorInstance = monaco.editor.create(monacoContainer, {
    value: '',
    language: 'markdown',
    theme: 'vs-dark',
    fontSize: getFontSize(),
    fontFamily: getFontFamily(),
    lineHeight: 24,
    letterSpacing: 0.3,
    wordWrap: 'on',
    minimap: { enabled: false },
    automaticLayout: true,
    scrollBeyondLastLine: false,
    glyphMargin: false,
    folding: false,
    lineNumbersMinChars: 3,
    lineDecorationsWidth: 12,
    renderLineHighlight: 'line',
    renderLineHighlightOnlyWhenFocus: true,
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    fixedOverflowWidgets: true,
    padding: { top: 12, bottom: 12 },
    scrollbar: {
      vertical: 'visible',
      horizontal: 'auto',
      verticalScrollbarSize: 6,
      horizontalScrollbarSize: 6,
      arrowSize: 0,
      useShadows: false,
      verticalHasArrows: false,
      horizontalHasArrows: false,
      verticalSliderSize: 6,
      horizontalSliderSize: 6,
      handleMouseWheel: true
    },
    overviewRulerLanes: 0,
    overviewRulerBorder: false,
    hideCursorInOverviewRuler: true
  });

  // Attach Empty Document Placeholder (First Line Hint)
  // Attach Empty Document Placeholder (3-Line Contextual Guides)
  const updatePlaceholder = () => {
    const model = monacoEditorInstance?.getModel();
    const domNode = monacoEditorInstance?.getDomNode();
    if (!domNode) return;
    let placeholderEl = domNode.querySelector('.monaco-custom-placeholder');
    if (!placeholderEl) {
      placeholderEl = document.createElement('div');
      placeholderEl.className = 'monaco-custom-placeholder';
      placeholderEl.style.cssText = 'position: absolute; top: 12px; left: 54px; color: var(--text-muted, #94a3b8); opacity: 0.55; font-size: 0.82rem; font-family: inherit; line-height: 1.6; pointer-events: none; user-select: none; z-index: 1; transition: opacity 0.2s ease; display: flex; flex-direction: column; gap: 4px;';
      domNode.appendChild(placeholderEl);
    }

    const val = model?.getValue() || '';
    if (val.length > 0) {
      placeholderEl.style.display = 'none';
      return;
    }

    placeholderEl.style.display = 'flex';
    const slotsCountEl = document.getElementById('knowledgeSlotsCountBadge');
    const slotCount = slotsCountEl ? parseInt(slotsCountEl.textContent, 10) || 0 : 0;

    const line1 = slotCount > 0
      ? (t('editor_placeholder_ready'))
      : (t('editor_placeholder_no_slots'));

    const line2 = t('editor_placeholder_intellisense');
    const line3 = t('editor_placeholder_selection');
    const line4 = t('editor_placeholder_contextmenu');
    const line5 = t('editor_placeholder_aimodel');

    placeholderEl.innerHTML = `
      <div style="color: var(--accent-color, #38bdf8); font-weight: 700; margin-bottom: 2px;">${line1}</div>
      <div style="opacity: 0.85;">${line2}</div>
      <div style="opacity: 0.85;">${line3}</div>
      <div style="opacity: 0.85;">${line4}</div>
      <div style="opacity: 0.75;">${line5}</div>
    `;
  };

  monacoEditorInstance.onDidChangeModelContent(updatePlaceholder);
  monacoEditorInstance.onDidChangeModel(updatePlaceholder);
  window.addEventListener('app:knowledgeSlotChanged', updatePlaceholder);
  window.addEventListener('app:languageChanged', updatePlaceholder);
  setTimeout(updatePlaceholder, 100);

  registerMonacoSuggestAction(monacoEditorInstance, monaco);
  initializeKnowledgeExtensions(monacoEditorInstance, monaco);
  initAutoSaveControls();

  // Context Menu Actions for Tab Extraction & Duplication
  monacoEditorInstance.addAction({
    id: 'action-copy-to-new-tab',
    label: i18n.action_copy_to_new_tab || 'Copy Selection to New Tab',
    contextMenuGroupId: '9_cutcopypaste',
    contextMenuOrder: 1.5,
    run: () => extractSelectionToNewTab('copy')
  });

  monacoEditorInstance.addAction({
    id: 'action-cut-to-new-tab',
    label: i18n.action_cut_to_new_tab || 'Cut Selection to New Tab',
    contextMenuGroupId: '9_cutcopypaste',
    contextMenuOrder: 1.6,
    run: () => extractSelectionToNewTab('cut')
  });

  monacoEditorInstance.addAction({
    id: 'action-duplicate-tab',
    label: i18n.action_duplicate_tab || 'Duplicate Current Tab',
    contextMenuGroupId: '9_cutcopypaste',
    contextMenuOrder: 1.7,
    run: () => duplicateCurrentTab()
  });

  // Handle Ctrl+S / Cmd+S to save current tab
  monacoEditorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
    const btnSave = document.getElementById('btnSave');
    if (btnSave) btnSave.click();
  });

  // If no tabs exist yet, create initial document tab
  if (tabs.length === 0) {
    createNewTab();
  } else {
    renderTabs();
    if (activeTabId) switchTab(activeTabId);
  }

  isEditorInitializing = false;

  const btnNewTab = document.getElementById('btnNewTab');
  if (btnNewTab) {
    btnNewTab.addEventListener('click', () => {
      createNewTab();
    });
  }

  // 1. Strict Mutual Exclusion: Right-click immediately purges all selection popovers and cancels pending popover timers
  const dismissSelectionMenus = () => {
    if (selectionPopoverTimer) {
      clearTimeout(selectionPopoverTimer);
      selectionPopoverTimer = null;
    }
    removeContextMenu();
  };

  monacoEditorInstance.onContextMenu(dismissSelectionMenus);
  monacoContainer.addEventListener('contextmenu', dismissSelectionMenus, { capture: true });
  monacoContainer.addEventListener('mousedown', (e) => {
    if (e.button === 2) dismissSelectionMenus();
  }, { capture: true });
  document.addEventListener('contextmenu', dismissSelectionMenus, { capture: true });

  // 2. Keyboard & Mouse Selection Handler with Debounce & Auto-Dismissal
  let selectionPopoverTimer = null;
  const triggerSelectionPopover = (source = 'generic') => {
    const mode = localStorage.getItem(STORAGE_KEYS.SUGGEST_TRIGGER_MODE) || DEFAULTS.SUGGEST_TRIGGER_MODE;
    if (mode !== 'selection') return;

    if (selectionPopoverTimer) clearTimeout(selectionPopoverTimer);
    selectionPopoverTimer = setTimeout(() => {
      if (!monacoEditorInstance) return;
      const selection = monacoEditorInstance.getSelection();
      if (selection && !selection.isEmpty()) {
        const text = monacoEditorInstance.getModel()?.getValueInRange(selection)?.trim() || '';
        if (text.length > 0) {
          const startPos = monacoEditorInstance.getScrolledVisiblePosition({
            lineNumber: selection.startLineNumber,
            column: selection.startColumn
          });
          
          if (startPos) {
            const containerRect = monacoContainer.getBoundingClientRect();
            const posX = containerRect.left + startPos.left;
            const posY = containerRect.top + startPos.top;
            showSelectionPopoverMenu(posX, posY, text);
          }
        } else {
          removeContextMenu();
        }
      } else {
        removeContextMenu();
      }
    }, source === 'mouse' ? 60 : 350);
  };

  monacoEditorInstance.onMouseUp(() => triggerSelectionPopover('mouse'));
  monacoEditorInstance.onDidChangeCursorSelection((e) => {
    if (e.source !== 'mouse') {
      triggerSelectionPopover('keyboard');
    }
  });

  // Hook model change for status bar updates
  monacoEditorInstance.onDidChangeModelContent(() => {
    updateStatusBar();
  });
  updateStatusBar();

  setLedStatus('monaco', true, `6. Monaco Editor: Mounted & Ready`);
}

export function updateStatusBar(fileName = null) {
  if (fileName) {
    const docNameEl = document.getElementById('statusDocName');
    if (docNameEl) docNameEl.textContent = fileName;
  }
  if (!monacoEditorInstance) return;
  const val = monacoEditorInstance.getValue();
  const charCountEl = document.getElementById('statusCharCount');
  const lineCountEl = document.getElementById('statusLineCount');
  if (charCountEl) {
    charCountEl.textContent = `${val.length.toLocaleString()} ${i18n.unit_chars || 'chars'}`;
  }
  if (lineCountEl) {
    const lineCount = monacoEditorInstance.getModel() ? monacoEditorInstance.getModel().getLineCount() : 1;
    lineCountEl.textContent = `${lineCount.toLocaleString()} ${i18n.unit_lines || 'lines'}`;
  }
}

export function focusEditor() {
  if (monacoEditorInstance) {
    monacoEditorInstance.focus();
  } else if (monacoDiffEditorInstance) {
    const mod = monacoDiffEditorInstance.getModifiedEditor();
    if (mod) mod.focus();
  }
}

export function getEditorInstance() {
  return monacoEditorInstance || (monacoDiffEditorInstance ? monacoDiffEditorInstance.getModifiedEditor() : null);
}

export function insertTextIntoEditor(text) {
  const ed = getEditorInstance();
  if (!ed) return;

  const selection = ed.getSelection();
  if (selection) {
    ed.executeEdits('vectorInsert', [{
      range: selection,
      text: text,
      forceMoveMarkers: true
    }]);
  } else {
    const position = ed.getPosition();
    if (position) {
      ed.executeEdits('vectorInsert', [{
        range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
        text: text,
        forceMoveMarkers: true
      }]);
    }
  }
  ed.focus();
}

export function setEditorContent(text, fileName = null) {
  if (!monacoEditorInstance) return;

  const currentTab = tabs.find(t => t.id === activeTabId);
  if (currentTab && currentTab.model.getValue().trim().length === 0) {
    currentTab.model.setValue(text);
    if (fileName) currentTab.title = fileName;
    currentTab.isDirty = false;
    renderTabs();
    updateStatusBar(currentTab.title);
  } else {
    createNewTab(fileName, text);
  }
  monacoEditorInstance.focus();
}

export async function saveTextToFile(content, defaultFilename = 'Document.txt', extension = 'txt') {
  if (window.engineAPI && window.engineAPI.saveFile) {
    try {
      const res = await window.engineAPI.saveFile({
        defaultPath: defaultFilename,
        content: content,
        filters: extension === 'md'
          ? [{ name: 'Markdown Document', extensions: ['md', 'markdown'] }, { name: 'All Files', extensions: ['*'] }]
          : [{ name: 'Text Document', extensions: ['txt', 'text'] }, { name: 'All Files', extensions: ['*'] }]
      });
      if (res && res.success && res.filePath) {
        const baseName = res.filePath.split(/[\\/]/).pop();
        updateStatusBar(baseName);
      }
      return res;
    } catch (err) {
      console.warn('Native save dialog error, falling back to browser download:', err);
    }
  }

  // Web / Fallback blob download
  const blob = new Blob([content], { type: extension === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = defaultFilename;
  a.click();
  URL.revokeObjectURL(url);
}

function registerMonacoSuggestAction(editor, monacoRef) {
  // 1. AI Vector Suggest Action
  editor.addAction({
    id: 'action-vector-suggest',
    label: i18n.suggest_context_menu || 'AI Suggest (Vector Search)',
    keybindings: [
      monacoRef.KeyMod.Alt | monacoRef.KeyCode.KeyS,
      monacoRef.KeyMod.CtrlCmd | monacoRef.KeyMod.Shift | monacoRef.KeyCode.KeyS
    ],
    contextMenuGroupId: '1_modification',
    contextMenuOrder: 1.1,
    run: function (ed) {
      let selection = ed.getSelection();
      let text = '';
      
      if (!selection || selection.isEmpty()) {
        const position = ed.getPosition();
        const word = ed.getModel().getWordAtPosition(position);
        if (word) {
          text = word.word;
          selection = new monacoRef.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
          ed.setSelection(selection);
        } else {
          return;
        }
      } else {
        text = ed.getModel().getValueInRange(selection).trim();
      }
      
      if (text.length > 0) {
        triggerMonacoVectorSearch(text, selection, ed, monacoRef);
      }
    }
  });

  // 2. Copy as Plain Text (.txt)
  editor.addAction({
    id: 'action-copy-plain-text',
    label: i18n.action_copy_txt || 'Copy as Plain Text (.txt)',
    contextMenuGroupId: '9_cutcopypaste',
    contextMenuOrder: 2.1,
    run: function (ed) {
      const selection = ed.getSelection();
      const text = (selection && !selection.isEmpty())
        ? ed.getModel().getValueInRange(selection)
        : ed.getValue();
      navigator.clipboard.writeText(text);
    }
  });

  // 3. Copy as Markdown (.md)
  editor.addAction({
    id: 'action-copy-markdown',
    label: i18n.action_copy_md || 'Copy as Markdown (.md)',
    contextMenuGroupId: '9_cutcopypaste',
    contextMenuOrder: 2.2,
    run: function (ed) {
      const selection = ed.getSelection();
      const text = (selection && !selection.isEmpty())
        ? ed.getModel().getValueInRange(selection)
        : ed.getValue();
      navigator.clipboard.writeText(text);
    }
  });

  // 4. Save as Text File (.txt)
  editor.addAction({
    id: 'action-save-as-txt',
    label: i18n.action_save_txt || 'Save as Text File (.txt)',
    keybindings: [
      monacoRef.KeyMod.CtrlCmd | monacoRef.KeyCode.KeyS
    ],
    contextMenuGroupId: 'save_group',
    contextMenuOrder: 3.1,
    run: function (ed) {
      const text = ed.getValue();
      saveTextToFile(text, 'Document.txt', 'txt');
    }
  });

  // 5. Save as Markdown File (.md)
  editor.addAction({
    id: 'action-save-as-md',
    label: i18n.action_save_md || 'Save as Markdown File (.md)',
    keybindings: [
      monacoRef.KeyMod.CtrlCmd | monacoRef.KeyMod.Shift | monacoRef.KeyCode.KeyM
    ],
    contextMenuGroupId: 'save_group',
    contextMenuOrder: 3.2,
    run: function (ed) {
      const text = ed.getValue();
      saveTextToFile(text, 'Document.md', 'md');
    }
  });

  // 6. Search with Google
  editor.addAction({
    id: 'action-search-google',
    label: i18n.action_google_search || 'Search with Google',
    keybindings: [
      monacoRef.KeyMod.Alt | monacoRef.KeyCode.KeyG
    ],
    contextMenuGroupId: 'search_group',
    contextMenuOrder: 1.2,
    run: function (ed) {
      const selection = ed.getSelection();
      let query = '';
      if (selection && !selection.isEmpty()) {
        query = ed.getModel().getValueInRange(selection);
      } else {
        const word = ed.getModel().getWordAtPosition(ed.getPosition());
        query = word ? word.word : '';
      }
      if (query.trim()) {
        const queryUrl = `https://www.google.com/search?q=${encodeURIComponent(query.trim())}`;
        if (window.engineAPI && window.engineAPI.openExternal) {
          window.engineAPI.openExternal(queryUrl);
        } else {
          window.open(queryUrl, '_blank');
        }
      }
    }
  });
}

export async function toggleDiffMode() {
  const btnDiff = document.getElementById('btnDiff');

  if (!isDiffMode) {
    savedVersionText = monacoEditorInstance ? monacoEditorInstance.getValue() : '';

    if (monacoEditorInstance) {
      monacoEditorInstance.dispose();
      monacoEditorInstance = null;
    }

    if (!monaco) monaco = await import('monaco-editor');

    monacoDiffEditorInstance = monaco.editor.createDiffEditor(monacoContainer, {
      theme: getTheme(),
      fontSize: getFontSize(),
      fontFamily: getFontFamily(),
      wordWrap: 'on',
      minimap: { enabled: false },
      automaticLayout: true,
      originalEditable: false
    });

    const originalModel = monaco.editor.createModel(savedVersionText, 'markdown');
    const modifiedModel = monaco.editor.createModel(savedVersionText, 'markdown');
    monacoDiffEditorInstance.setModel({ original: originalModel, modified: modifiedModel });

    const modifiedEditor = monacoDiffEditorInstance.getModifiedEditor();
    registerMonacoSuggestAction(modifiedEditor, monaco);

    isDiffMode = true;
    if (btnDiff) {
      btnDiff.style.background = 'rgba(99, 102, 241, 0.3)';
      btnDiff.style.borderColor = 'rgba(99, 102, 241, 0.8)';
    }
  } else {
    savedVersionText = monacoDiffEditorInstance.getModifiedEditor().getValue();
    monacoDiffEditorInstance.getModel().original.setValue(savedVersionText);
    alert(i18n.alert_version_saved || "Current state saved as a new version. Subsequent changes will be compared.");
    focusEditor();
  }
}

export function updateEditorOptions(options) {
  if (monacoEditorInstance) monacoEditorInstance.updateOptions(options);
  if (monacoDiffEditorInstance) monacoDiffEditorInstance.updateOptions(options);
}

export const TONE_COLORS = {
  default: null,
  oled: { bg: '#000000', fg: '#f8fafc', gutter: '#000000', lineNo: '#64748b', isDark: true },
  dark_oled: { bg: '#000000', fg: '#f8fafc', gutter: '#000000', lineNo: '#64748b', isDark: true },
  obsidian: { bg: '#090d16', fg: '#e2e8f0', gutter: '#090d16', lineNo: '#64748b', isDark: true },
  dark_obsidian: { bg: '#090d16', fg: '#e2e8f0', gutter: '#090d16', lineNo: '#64748b', isDark: true },
  charcoal: { bg: '#111827', fg: '#f1f5f9', gutter: '#111827', lineNo: '#64748b', isDark: true },
  dark_charcoal: { bg: '#111827', fg: '#f1f5f9', gutter: '#111827', lineNo: '#64748b', isDark: true },
  slate: { bg: '#0f172a', fg: '#f8fafc', gutter: '#0f172a', lineNo: '#64748b', isDark: true },
  dark_slate: { bg: '#0f172a', fg: '#f8fafc', gutter: '#0f172a', lineNo: '#64748b', isDark: true },
  ivory: { bg: '#FFFFF0', fg: '#1c1917', gutter: '#fbfbf0', lineNo: '#78716c', isDark: false },
  light_ivory: { bg: '#FFFFF0', fg: '#1c1917', gutter: '#fbfbf0', lineNo: '#78716c', isDark: false },
  warmWhite: { bg: '#FAFAF9', fg: '#292524', gutter: '#f5f5f4', lineNo: '#78716c', isDark: false },
  light_warm: { bg: '#FAFAF9', fg: '#292524', gutter: '#f5f5f4', lineNo: '#78716c', isDark: false },
  snow: { bg: '#FFFFFF', fg: '#0f172a', gutter: '#f8fafc', lineNo: '#94a3b8', isDark: false },
  light_snow: { bg: '#FFFFFF', fg: '#0f172a', gutter: '#f8fafc', lineNo: '#94a3b8', isDark: false },
  paper: { bg: '#FDFBF7', fg: '#332f2c', gutter: '#f7f4ee', lineNo: '#78716c', isDark: false },
  light_paper: { bg: '#FDFBF7', fg: '#332f2c', gutter: '#f7f4ee', lineNo: '#78716c', isDark: false }
};

export function applyEditorCanvasTone(tone, customBg = null, customFg = null) {
  if (!monaco || !monaco.editor) return;
  const currentTone = tone || localStorage.getItem(STORAGE_KEYS.EDITOR_BG_TONE) || 'default';
  
  if (currentTone === 'custom') {
    const bg = customBg || localStorage.getItem(STORAGE_KEYS.CUSTOM_EDITOR_BG) || '#1e1e2e';
    const fg = customFg || localStorage.getItem(STORAGE_KEYS.CUSTOM_EDITOR_FG) || '#cdd6f4';

    // Simple brightness calculation for dark/light base
    const hex = bg.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) || 0;
    const g = parseInt(hex.substr(2, 2), 16) || 0;
    const b = parseInt(hex.substr(4, 2), 16) || 0;
    const isDark = (r * 299 + g * 587 + b * 114) / 1000 < 128;

    try {
      monaco.editor.defineTheme('custom-user-colors', {
        base: isDark ? 'vs-dark' : 'vs',
        inherit: true,
        rules: [
          { token: '', foreground: fg.replace('#', '') }
        ],
        colors: {
          'editor.background': bg,
          'editor.foreground': fg,
          'editorGutter.background': bg,
          'editorLineNumber.foreground': isDark ? '#64748b' : '#94a3b8',
          'editorLineNumber.activeForeground': '#38bdf8'
        }
      });
      monaco.editor.setTheme('custom-user-colors');
    } catch (_) {
      safeSetMonacoTheme('vs-dark', isDark ? 'vs-dark' : 'vs');
    }
    return;
  }

  if (currentTone === 'default' || !TONE_COLORS[currentTone]) {
    const activeTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'auto';
    loadTheme(activeTheme).catch(() => {});
    return;
  }

  const toneConfig = TONE_COLORS[currentTone];
  const customThemeName = `custom-tone-${currentTone}`;
  
  try {
    monaco.editor.defineTheme(customThemeName, {
      base: toneConfig.isDark ? 'vs-dark' : 'vs',
      inherit: true,
      rules: [
        { token: '', foreground: toneConfig.fg.replace('#', '') }
      ],
      colors: {
        'editor.background': toneConfig.bg,
        'editor.foreground': toneConfig.fg,
        'editorGutter.background': toneConfig.gutter,
        'editorLineNumber.foreground': toneConfig.lineNo,
        'editorLineNumber.activeForeground': '#38bdf8'
      }
    });
    monaco.editor.setTheme(customThemeName);
  } catch (_) {
    safeSetMonacoTheme('vs-dark', toneConfig.isDark ? 'vs-dark' : 'vs');
  }
}

export function initMemoryMonitor() {
  const statusMemoryUsage = document.getElementById('statusMemoryUsage');
  if (!statusMemoryUsage) return;

  const updateMem = () => {
    if (performance && performance.memory) {
      const usedMB = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
      statusMemoryUsage.textContent = `RAM: ${usedMB} MB`;
    } else {
      statusMemoryUsage.textContent = `RAM: Active`;
    }
  };

  updateMem();
  setInterval(updateMem, 3000);
}

export function getCurrentContent() {
  return isDiffMode ? monacoDiffEditorInstance.getModifiedEditor().getValue() : monacoEditorInstance.getValue();
}

function runEngineLinter(editor, monacoRef) {
  if (linterTimeout) clearTimeout(linterTimeout);

  linterTimeout = setTimeout(async () => {
    const text = editor.getValue();

    if (window.engineAPI && typeof window.engineAPI.validateDocument === 'function') {
      try {
        const response = await window.engineAPI.validateDocument(text);
        
        const markers = (response.markers || []).map(m => ({
          severity: m.severity === 'error' ? monacoRef.MarkerSeverity.Error : monacoRef.MarkerSeverity.Warning,
          message: m.message || 'Validation alert',
          startLineNumber: m.line || 1,
          startColumn: 1,
          endLineNumber: m.line || 1,
          endColumn: 50
        }));

        monacoRef.editor.setModelMarkers(editor.getModel(), "engine-linter", markers);
      } catch (error) {
        console.error(i18n.linter_error || "Linter execution error:", error);
      }
    }
  }, 800);
}

function registerEngineCompletionProvider(monacoRef) {
  // Prevent duplicate registration if toggling back and forth
  if (monacoRef.languages._isKnowledgeProviderRegistered) return;
  monacoRef.languages._isKnowledgeProviderRegistered = true;

  monacoRef.languages.registerCompletionItemProvider('markdown', {
    triggerCharacters: [' ', ':', '、', '。'],
    provideCompletionItems: function (model, position) {
      const word = model.getWordUntilPosition(position);
      const lineContent = model.getLineContent(position.lineNumber);
      const textUntilPos = lineContent.substring(0, position.column - 1);
      
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn || Math.max(1, position.column - 5),
        endColumn: word.endColumn || position.column
      };

      const suggestions = allDictEntries.map(entry => {
        const title = entry.item.title || '';
        const code = entry.item.code || '';
        const note = entry.note || entry.item.subtitle || '';
        const hira = entry.item.hira || '';
        const kata = entry.item.kata || '';
        const kana = entry.item.kana || '';

        // Build comprehensive searchable filter text
        const filterStr = [title, hira, kata, kana, code, note].filter(Boolean).join(' ');

        return {
          label: title,
          kind: monacoRef.languages.CompletionItemKind.Keyword,
          detail: code ? `[${code}] ${note}` : note,
          documentation: {
            value: `### ${title} ${code ? `\`${code}\`` : ''}\n\n${note}`
          },
          insertText: title,
          filterText: filterStr,
          range: range
        };
      });

      return { suggestions: suggestions };
    }
  });
}

function initializeKnowledgeExtensions(editor, monacoRef) {
  registerEngineCompletionProvider(monacoRef);
  runEngineLinter(editor, monacoRef);
  editor.onDidChangeModelContent(() => {
    runEngineLinter(editor, monacoRef);
  });
}

export function refreshLinter() {
  if (monacoEditorInstance && monaco) {
    runEngineLinter(monacoEditorInstance, monaco);
  }
  if (monacoDiffEditorInstance && monaco) {
    const modifiedEditor = monacoDiffEditorInstance.getModifiedEditor();
    if (modifiedEditor) {
      runEngineLinter(modifiedEditor, monaco);
    }
  }
}

/**
 * Exports all active tabs, contents, and editor states into a .vectorspace bundle.
 */
export async function exportWorkspaceBundle() {
  const bundle = {
    format: 'vectorspace_bundle',
    version: '1.0',
    timestamp: new Date().toISOString(),
    activeTabId,
    tabs: tabs.map(t => ({
      id: t.id,
      title: t.title,
      content: t.model ? t.model.getValue() : '',
      filePath: t.filePath,
      isDirty: t.isDirty
    }))
  };

  const jsonStr = JSON.stringify(bundle, null, 2);
  const defaultName = `Workspace_${new Date().toISOString().slice(0, 10)}.vectorspace`;
  
  if (window.engineAPI?.saveFile) {
    const res = await window.engineAPI.saveFile(jsonStr, defaultName);
    return res;
  } else {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultName;
    a.click();
    URL.revokeObjectURL(url);
    return { success: true };
  }
}

/**
 * Imports and restores all tabs from a .vectorspace bundle file.
 */
export async function importWorkspaceBundle(rawJson) {
  try {
    const data = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
    if (data.format !== 'vectorspace_bundle' || !Array.isArray(data.tabs)) {
      throw new Error('Invalid .vectorspace bundle format');
    }

    // Dispose existing tab models
    tabs.forEach(t => {
      if (t.model) t.model.dispose();
    });
    tabs.length = 0;

    // Restore tabs from bundle
    for (const item of data.tabs) {
      const model = monaco.editor.createModel(item.content || '', 'markdown');
      const tabObj = {
        id: item.id || `tab_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        title: item.title || 'Untitled.md',
        model,
        filePath: item.filePath || null,
        isDirty: Boolean(item.isDirty)
      };

      model.onDidChangeContent(() => {
        if (!tabObj.isDirty) {
          tabObj.isDirty = true;
          renderTabs();
        }
        triggerAdaptiveAutoSave(tabObj);
        if (activeTabId === tabObj.id) {
          updateStatusBar(tabObj.title);
        }
      });

      tabs.push(tabObj);
    }

    if (tabs.length > 0) {
      const targetId = data.activeTabId && tabs.some(t => t.id === data.activeTabId)
        ? data.activeTabId
        : tabs[0].id;
      renderTabs();
      switchTab(targetId);
    } else {
      createNewTab();
    }
    return { success: true, count: tabs.length };
  } catch (err) {
    console.error('Failed to import workspace bundle:', err);
    return { success: false, error: err.message };
  }
}
