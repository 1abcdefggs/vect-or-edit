/**
 * Menu Bar Controller (VS Code Style Inline Menu Bar)
 * Handles dropdown open/close, hover switching, click-outside dismissal,
 * and mapping menu actions to editor and Electron features.
 */

import { createNewTab, closeTab, getActiveTab, getCurrentContent, markActiveTabSaved, focusEditor, tabs, getEditorInstance, setEditorContent, insertTextIntoEditor } from '../../editor/editorManager.js';
import { showWorkspaceModal } from './topBarRenderer.js';
import { showAiSetupModal } from '../ai/aiSetupController.js';
import { showToast } from '../notifications/toastManager.js';
import { t } from '../../core/i18n.js';

let isMenuOpen = false;
let activeMenuItem: HTMLElement | null = null;

export function initMenuBar(): void {
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

  // Wire menu actions
  bindMenuActions(closeAllMenus);
}

function bindMenuActions(closeMenus: () => void): void {
  // Helper to wrap action with closing menu and keeping editor focus
  const runAction = (fn: () => void | Promise<void>) => {
    return async (e: Event) => {
      e.stopPropagation();
      closeMenus();
      await fn();
      setTimeout(() => focusEditor(), 50);
    };
  };

  // --- CORE FILE OPERATIONS (Deep Actions) ---
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

  // --- FILE MENU ---
  const itemNewFile = document.getElementById('menuItemNewFile');
  itemNewFile?.addEventListener('click', runAction(() => {
    createNewTab();
  }));

  const itemOpenFile = document.getElementById('menuItemOpenFile');
  itemOpenFile?.addEventListener('click', runAction(async () => {
    await executeOpenFile();
  }));

  const itemOpenWorkspace = document.getElementById('menuItemOpenWorkspace');
  itemOpenWorkspace?.addEventListener('click', runAction(() => {
    showWorkspaceModal('open');
  }));

  const itemSaveFile = document.getElementById('menuItemSaveFile');
  itemSaveFile?.addEventListener('click', runAction(async () => {
    await executeSaveTab(false);
  }));

  const itemSaveAs = document.getElementById('menuItemSaveAs');
  itemSaveAs?.addEventListener('click', runAction(async () => {
    await executeSaveTab(true);
  }));

  const itemSaveAll = document.getElementById('menuItemSaveAll');
  itemSaveAll?.addEventListener('click', runAction(async () => {
    await executeSaveAll();
  }));

  const itemCloseTab = document.getElementById('menuItemCloseTab');
  itemCloseTab?.addEventListener('click', runAction(() => {
    const tab = getActiveTab();
    if (tab) closeTab(tab.id);
  }));

  const itemExit = document.getElementById('menuItemExit');
  itemExit?.addEventListener('click', runAction(() => {
    if (window.engineAPI?.closeWindow) {
      window.engineAPI.closeWindow();
    }
  }));

  // --- EDIT MENU (Integrated with Monaco & Clipboard) ---
  const itemUndo = document.getElementById('menuItemUndo');
  itemUndo?.addEventListener('click', runAction(() => {
    const ed = getEditorInstance();
    if (ed) {
      ed.focus();
      ed.trigger('menu', 'undo', null);
    }
  }));

  const itemRedo = document.getElementById('menuItemRedo');
  itemRedo?.addEventListener('click', runAction(() => {
    const ed = getEditorInstance();
    if (ed) {
      ed.focus();
      ed.trigger('menu', 'redo', null);
    }
  }));

  const itemCut = document.getElementById('menuItemCut');
  itemCut?.addEventListener('click', runAction(async () => {
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
  }));

  const itemCopy = document.getElementById('menuItemCopy');
  itemCopy?.addEventListener('click', runAction(async () => {
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
  }));

  const itemPaste = document.getElementById('menuItemPaste');
  itemPaste?.addEventListener('click', runAction(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        insertTextIntoEditor(text);
        showToast('Pasted from clipboard', 'info');
      }
    } catch (err) {
      console.warn('Clipboard paste failed:', err);
    }
  }));

  const itemSelectAll = document.getElementById('menuItemSelectAll');
  itemSelectAll?.addEventListener('click', runAction(() => {
    const ed = getEditorInstance();
    if (ed) {
      ed.focus();
      const model = ed.getModel();
      if (model) {
        ed.setSelection(model.getFullModelRange());
      }
    }
  }));

  // --- VIEW MENU ---
  const itemToggleSidebar = document.getElementById('menuItemToggleSidebar');
  itemToggleSidebar?.addEventListener('click', runAction(() => {
    const sidebar = document.getElementById('suggestionSidebar');
    const btnToggle = document.getElementById('btnHeaderToggleSidebar');
    if (sidebar && btnToggle) {
      btnToggle.click();
    }
  }));

  const itemToggleLogs = document.getElementById('menuItemToggleLogs');
  itemToggleLogs?.addEventListener('click', runAction(() => {
    const btnLogs = document.getElementById('btnToggleConsole');
    btnLogs?.click();
  }));

  const itemZoomIn = document.getElementById('menuItemZoomIn');
  itemZoomIn?.addEventListener('click', runAction(() => {
    if (window.engineAPI?.getZoomFactor && window.engineAPI?.setZoomFactor) {
      const current = window.engineAPI.getZoomFactor();
      const next = Math.min(3.0, Math.round((current + 0.1) * 10) / 10);
      window.engineAPI.setZoomFactor(next);
      localStorage.setItem('app_zoom_factor', next.toString());
      showToast(`Zoom: ${Math.round(next * 100)}%`, 'info');
    }
  }));

  const itemZoomOut = document.getElementById('menuItemZoomOut');
  itemZoomOut?.addEventListener('click', runAction(() => {
    if (window.engineAPI?.getZoomFactor && window.engineAPI?.setZoomFactor) {
      const current = window.engineAPI.getZoomFactor();
      const next = Math.max(0.5, Math.round((current - 0.1) * 10) / 10);
      window.engineAPI.setZoomFactor(next);
      localStorage.setItem('app_zoom_factor', next.toString());
      showToast(`Zoom: ${Math.round(next * 100)}%`, 'info');
    }
  }));

  const itemResetZoom = document.getElementById('menuItemResetZoom');
  itemResetZoom?.addEventListener('click', runAction(() => {
    if (window.engineAPI?.setZoomFactor) {
      window.engineAPI.setZoomFactor(1.0);
      localStorage.setItem('app_zoom_factor', '1.0');
      showToast('Zoom: 100%', 'info');
    }
  }));

  // --- WINDOW MENU ---
  const itemMinimize = document.getElementById('menuItemMinimize');
  itemMinimize?.addEventListener('click', runAction(() => {
    if (window.engineAPI?.minimizeWindow) window.engineAPI.minimizeWindow();
  }));

  const itemMaximize = document.getElementById('menuItemMaximize');
  itemMaximize?.addEventListener('click', runAction(() => {
    if (window.engineAPI?.maximizeWindow) window.engineAPI.maximizeWindow();
  }));

  const itemCloseWindow = document.getElementById('menuItemCloseWindow');
  itemCloseWindow?.addEventListener('click', runAction(() => {
    if (window.engineAPI?.closeWindow) window.engineAPI.closeWindow();
  }));

  // --- HELP MENU ---
  const itemAiSetup = document.getElementById('menuItemAiSetup');
  itemAiSetup?.addEventListener('click', runAction(() => {
    showAiSetupModal();
  }));

  const itemOpenSettings = document.getElementById('menuItemOpenSettings');
  itemOpenSettings?.addEventListener('click', runAction(() => {
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal) {
      settingsModal.style.display = 'flex';
    }
  }));

  const itemDocs = document.getElementById('menuItemDocs');
  itemDocs?.addEventListener('click', runAction(() => {
    const url = 'https://github.com/1abcdefggs/vect-or-edit';
    if (window.engineAPI?.openExternal) {
      window.engineAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  }));

  const itemAbout = document.getElementById('menuItemAbout');
  itemAbout?.addEventListener('click', runAction(() => {
    showToast('VectOrEdit v0.3.5 - Vector-Native Knowledge Base Editor', 'info');
  }));
}
