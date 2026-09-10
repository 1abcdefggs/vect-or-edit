/**
 * Menu Bar Controller (VS Code Style Inline Menu Bar)
 * Handles dropdown open/close, hover switching, click-outside dismissal,
 * and mapping menu actions to the central CommandManager.
 */

import {
  createNewTab,
  closeTab,
  getActiveTab,
  getCurrentContent,
  markActiveTabSaved,
  focusEditor,
  tabs,
  getEditorInstance,
  setEditorContent,
  insertTextIntoEditor
} from '../../editor/editorManager.js';
import { showWorkspaceModal } from './topBarRenderer.js';
import { showAiSetupModal } from '../ai/aiSetupController.js';
import { showToast } from '../notifications/toastManager.js';
import { t } from '../../core/i18n.js';
import { commandManager } from '../../core/commandManager';

let isMenuOpen = false;
let activeMenuItem: HTMLElement | null = null;

/**
 * Register all application commands to CommandManager (Deep Interface Seam).
 */
export function registerAppCommands(): void {
  // --- CORE FILE OPERATIONS ---
  const executeSaveTab = async (forceDialog = false) => {
    const currentTab = getActiveTab();
    if (!currentTab) return;
    const content = getCurrentContent();
    const defaultName = currentTab.filePath || currentTab.title || 'untitled.md';

    const doSave = async (force: boolean) => {
      if (window.engineAPI?.saveFile) {
        const res = await window.engineAPI.saveFile(content, defaultName, force);
        const savedPath = res?.filePath || res?.path;
        if (res?.success && savedPath) {
          markActiveTabSaved(savedPath);
          showToast(t('alert_file_saved', { path: savedPath }) || `Saved: ${savedPath}`, 'success');
        }
      }
    };

    if (!currentTab.filePath && !forceDialog) {
      let hasWorkspace = false;
      if (window.engineAPI?.getDefaultWorkspace) {
        const wsRes = await window.engineAPI.getDefaultWorkspace(false);
        hasWorkspace = Boolean(wsRes?.success && wsRes?.exists);
      }
      if (!hasWorkspace) {
        (showWorkspaceModal as any)('save', () => doSave(true));
        return;
      }
      await doSave(true);
    } else {
      await doSave(forceDialog);
    }
  };

  const executeOpenFile = async () => {
    if (window.engineAPI?.getDefaultWorkspace) {
      const wsRes = await window.engineAPI.getDefaultWorkspace(false);
      if (wsRes && wsRes.success && !wsRes.exists) {
        showWorkspaceModal('open');
        return;
      }
    }
    if (window.engineAPI?.openFile) {
      const res = await window.engineAPI.openFile();
      if (res && res.success && res.content !== undefined) {
        (setEditorContent as any)(res.content, res.fileName || res.filePath || res.path || 'untitled.md');
      }
    }
  };

  const executeSaveAll = async () => {
    const currentTabs = tabs || [];
    let savedCount = 0;
    for (const tab of currentTabs) {
      if (tab.model) {
        const tabContent = tab.model.getValue();
        const targetPath = tab.filePath || tab.title || 'untitled.md';
        if (window.engineAPI?.saveFile) {
          const res = await window.engineAPI.saveFile(tabContent, targetPath, !tab.filePath);
          const savedPath = res?.filePath || res?.path;
          if (res?.success && savedPath) {
            tab.isDirty = false;
            tab.filePath = savedPath;
            savedCount++;
          }
        }
      }
    }
    showToast(`Saved ${savedCount} document(s)`, 'success');
  };

  // Register commands centrally
  commandManager.registerCommands([
    // File Commands
    {
      id: 'file.new',
      title: 'New File',
      category: 'File',
      shortcut: 'Ctrl+N',
      handler: () => createNewTab()
    },
    {
      id: 'file.open',
      title: 'Open File',
      category: 'File',
      shortcut: 'Ctrl+O',
      handler: () => executeOpenFile()
    },
    {
      id: 'file.openWorkspace',
      title: 'Open Workspace',
      category: 'File',
      shortcut: 'Ctrl+K Ctrl+O',
      handler: () => showWorkspaceModal('open')
    },
    {
      id: 'file.save',
      title: 'Save File',
      category: 'File',
      shortcut: 'Ctrl+S',
      handler: () => executeSaveTab(false)
    },
    {
      id: 'file.saveAs',
      title: 'Save As',
      category: 'File',
      shortcut: 'Ctrl+Shift+S',
      handler: () => executeSaveTab(true)
    },
    {
      id: 'file.saveAll',
      title: 'Save All',
      category: 'File',
      shortcut: 'Ctrl+K S',
      handler: () => executeSaveAll()
    },
    {
      id: 'file.closeTab',
      title: 'Close Tab',
      category: 'File',
      shortcut: 'Ctrl+W',
      handler: () => {
        const tab = getActiveTab();
        if (tab) closeTab(tab.id);
      }
    },
    {
      id: 'file.exit',
      title: 'Exit Application',
      category: 'File',
      shortcut: 'Alt+F4',
      handler: () => {
        if (window.engineAPI?.closeWindow) {
          window.engineAPI.closeWindow();
        }
      }
    },

    // Edit Commands
    {
      id: 'edit.undo',
      title: 'Undo',
      category: 'Edit',
      shortcut: 'Ctrl+Z',
      handler: () => {
        const ed = getEditorInstance();
        if (ed) {
          ed.focus();
          ed.trigger('menu', 'undo', null);
        }
      }
    },
    {
      id: 'edit.redo',
      title: 'Redo',
      category: 'Edit',
      shortcut: 'Ctrl+Y',
      handler: () => {
        const ed = getEditorInstance();
        if (ed) {
          ed.focus();
          ed.trigger('menu', 'redo', null);
        }
      }
    },
    {
      id: 'edit.cut',
      title: 'Cut',
      category: 'Edit',
      shortcut: 'Ctrl+X',
      handler: async () => {
        const ed = getEditorInstance();
        if (!ed) return;
        ed.focus();
        const selection = ed.getSelection();
        if (selection && !selection.isEmpty()) {
          const textToCut = ed.getModel()?.getValueInRange(selection) || '';
          if (textToCut) {
            try {
              await navigator.clipboard.writeText(textToCut);
              ed.executeEdits('menu-cut', [{ range: selection, text: '', forceMoveMarkers: true }]);
              showToast('Cut to clipboard', 'info');
            } catch (err) {
              console.warn('Cut failed:', err);
            }
          }
        }
      }
    },
    {
      id: 'edit.copy',
      title: 'Copy',
      category: 'Edit',
      shortcut: 'Ctrl+C',
      handler: async () => {
        const ed = getEditorInstance();
        let textToCopy = '';
        if (ed) {
          const selection = ed.getSelection();
          if (selection && !selection.isEmpty()) {
            textToCopy = ed.getModel()?.getValueInRange(selection) || '';
          } else {
            textToCopy = getCurrentContent();
          }
        } else {
          textToCopy = getCurrentContent();
        }

        if (textToCopy) {
          try {
            await navigator.clipboard.writeText(textToCopy);
            showToast('Copied to clipboard', 'info');
          } catch (err) {
            console.warn('Clipboard copy failed:', err);
          }
        }
      }
    },
    {
      id: 'edit.paste',
      title: 'Paste',
      category: 'Edit',
      shortcut: 'Ctrl+V',
      handler: async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            insertTextIntoEditor(text);
            showToast('Pasted from clipboard', 'info');
          }
        } catch (err) {
          console.warn('Clipboard paste failed:', err);
        }
      }
    },
    {
      id: 'edit.selectAll',
      title: 'Select All',
      category: 'Edit',
      shortcut: 'Ctrl+A',
      handler: () => {
        const ed = getEditorInstance();
        if (ed) {
          ed.focus();
          const model = ed.getModel();
          if (model) {
            ed.setSelection(model.getFullModelRange());
          }
        }
      }
    },

    // View Commands
    {
      id: 'view.toggleSidebar',
      title: 'Toggle Suggest Sidebar',
      category: 'View',
      shortcut: 'Ctrl+B',
      handler: () => {
        const btnToggle = document.getElementById('btnHeaderToggleSidebar');
        if (btnToggle) {
          btnToggle.click();
        }
      }
    },
    {
      id: 'view.toggleLogs',
      title: 'Toggle System Logs',
      category: 'View',
      shortcut: 'Ctrl+J',
      handler: () => {
        const btnLogs = document.getElementById('btnToggleConsole');
        btnLogs?.click();
      }
    },
    {
      id: 'view.zoomIn',
      title: 'Zoom In',
      category: 'View',
      shortcut: 'Ctrl+=',
      handler: () => {
        if (window.engineAPI?.getZoomFactor && window.engineAPI?.setZoomFactor) {
          const current = window.engineAPI.getZoomFactor();
          const next = Math.min(3.0, Math.round((current + 0.1) * 10) / 10);
          window.engineAPI.setZoomFactor(next);
          localStorage.setItem('app_zoom_factor', next.toString());
          showToast(`Zoom: ${Math.round(next * 100)}%`, 'info');
        }
      }
    },
    {
      id: 'view.zoomOut',
      title: 'Zoom Out',
      category: 'View',
      shortcut: 'Ctrl+-',
      handler: () => {
        if (window.engineAPI?.getZoomFactor && window.engineAPI?.setZoomFactor) {
          const current = window.engineAPI.getZoomFactor();
          const next = Math.max(0.5, Math.round((current - 0.1) * 10) / 10);
          window.engineAPI.setZoomFactor(next);
          localStorage.setItem('app_zoom_factor', next.toString());
          showToast(`Zoom: ${Math.round(next * 100)}%`, 'info');
        }
      }
    },
    {
      id: 'view.resetZoom',
      title: 'Reset Zoom',
      category: 'View',
      shortcut: 'Ctrl+0',
      handler: () => {
        if (window.engineAPI?.setZoomFactor) {
          window.engineAPI.setZoomFactor(1.0);
          localStorage.setItem('app_zoom_factor', '1.0');
          showToast('Zoom: 100%', 'info');
        }
      }
    },
    {
      id: 'view.toggleLang',
      title: 'Toggle Language',
      category: 'View',
      handler: () => {
        const btnLang = document.getElementById('btnLangToggle');
        if (btnLang) btnLang.click();
      }
    },
    {
      id: 'view.toggleTheme',
      title: 'Toggle Theme',
      category: 'View',
      handler: () => {
        const btnTheme = document.getElementById('btnThemeToggle');
        if (btnTheme) btnTheme.click();
      }
    },

    // Window Commands
    {
      id: 'window.minimize',
      title: 'Minimize Window',
      category: 'Window',
      shortcut: 'Win+Down',
      handler: () => {
        if (window.engineAPI?.minimizeWindow) window.engineAPI.minimizeWindow();
      }
    },
    {
      id: 'window.maximize',
      title: 'Maximize Window',
      category: 'Window',
      shortcut: 'Win+Up',
      handler: () => {
        if (window.engineAPI?.maximizeWindow) window.engineAPI.maximizeWindow();
      }
    },
    {
      id: 'window.close',
      title: 'Close Window',
      category: 'Window',
      shortcut: 'Alt+F4',
      handler: () => {
        if (window.engineAPI?.closeWindow) window.engineAPI.closeWindow();
      }
    },

    // Help Commands
    {
      id: 'help.aiSetup',
      title: 'AI Engine Setup',
      category: 'Help',
      handler: () => showAiSetupModal()
    },
    {
      id: 'help.settings',
      title: 'Preferences & Settings',
      category: 'Help',
      shortcut: 'Ctrl+,',
      handler: () => {
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal) {
          settingsModal.style.display = 'flex';
        }
      }
    },
    {
      id: 'help.docs',
      title: 'Documentation',
      category: 'Help',
      handler: () => {
        const url = 'https://github.com/1abcdefggs/vect-or-edit';
        if (window.engineAPI?.openExternal) {
          window.engineAPI.openExternal(url);
        } else {
          window.open(url, '_blank');
        }
      }
    },
    {
      id: 'help.about',
      title: 'About VectOrEdit',
      category: 'Help',
      handler: () => {
        showToast('VectOrEditOr v0.3.8 - Vector-Native Knowledge Base Editor', 'info');
      }
    }
  ]);
}

/**
 * Initialize Menu Bar UI interactions and bind to CommandManager.
 */
export function initMenuBar(): void {
  // Ensure commands are registered
  registerAppCommands();

  const menuBar = document.getElementById('appMenuBar');
  if (!menuBar) return;

  const menuItems = Array.from(menuBar.querySelectorAll<HTMLElement>('.menu-bar-item'));

  function closeAllMenus(): void {
    menuItems.forEach((item) => {
      item.classList.remove('open', 'active');
      const btn = item.querySelector('.menu-bar-btn');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
    isMenuOpen = false;
    activeMenuItem = null;
  }

  function openMenu(item: HTMLElement): void {
    closeAllMenus();
    item.classList.add('open', 'active');
    const btn = item.querySelector('.menu-bar-btn');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    isMenuOpen = true;
    activeMenuItem = item;
  }

  // Handle Menu Header Button click & hover
  menuItems.forEach((item) => {
    const btn = item.querySelector<HTMLButtonElement>('.menu-bar-btn');
    if (!btn) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (item.classList.contains('open')) {
        closeAllMenus();
      } else {
        openMenu(item);
      }
    });

    // Hover-switch when another menu is already open (VS Code style)
    item.addEventListener('mouseenter', () => {
      if (isMenuOpen && activeMenuItem !== item) {
        openMenu(item);
      }
    });
  });

  // Close menus when clicking outside
  document.addEventListener('click', (e) => {
    if (isMenuOpen && !menuBar.contains(e.target as Node)) {
      closeAllMenus();
    }
  });

  // Close menus when pressing Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isMenuOpen) {
      closeAllMenus();
      if (activeMenuItem) {
        const btn = activeMenuItem.querySelector<HTMLButtonElement>('.menu-bar-btn');
        btn?.focus();
      }
    }
  });

  // Wire all menu dropdown items and declarative [data-command] triggers
  const commandElements = Array.from(menuBar.querySelectorAll<HTMLElement>('[data-command]'));
  commandElements.forEach((el) => {
    const commandId = el.getAttribute('data-command');
    if (!commandId) return;

    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      closeAllMenus();
      await commandManager.executeCommand(commandId);
      setTimeout(() => focusEditor(), 50);
    });
  });
}

