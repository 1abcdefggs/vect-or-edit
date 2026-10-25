import { showAboutModal } from '../modals/aboutModalController.js';
import { showHelpPage } from '../help/helpPage.js';
/**
 * Menu Bar Controller (VS Code Style Inline Menu Bar)
 * Handles dropdown open/close, hover switching, click-outside dismissal,
 * and mapping menu actions to the central CommandManager.
 */

import {
  createBlankTab,
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
import { setDocumentFormat, announceOpenedEncoding, markSavedAsUtf8 } from '../../editor/ui/statusBarManager.js';
import { commitTabToFile } from '../../editor/io/tabCommit.js';
import { t } from '../../core/i18n.js';
import { confirmClose } from '../notifications/closeGuard.js';
import { getWorkspaceRoot } from '../../core/workspaceRoot';
import { commandManager, type CommandDefinition } from '../../core/commandManager';

let isMenuOpen = false;
let activeMenuItem: HTMLElement | null = null;

const OVERFLOW_ENTRY_CLASS = 'menu-overflow-entry';
const OVERFLOW_NEEDED_CLASS = 'menu-overflow-needed';
/** Menus moved into the overflow panel, in their original order (always the last ones of the bar). */
const overflowedEntries: HTMLElement[] = [];

/**
 * Keeps the header menus inside the window width. The menus that do not fit move, from the right,
 * into the » overflow panel; they return to the bar when there is room again.
 */
function fitMenuBar(menuBar: HTMLElement): void {
  const overflowItem = menuBar.querySelector<HTMLElement>('[data-menu="overflow"]');
  const overflowPanel = menuBar.querySelector<HTMLElement>('#menuDropdownOverflow');
  const header = menuBar.parentElement;
  if (!overflowItem || !overflowPanel || !header) return;

  overflowedEntries.splice(0).forEach((entry) => {
    entry.classList.remove(OVERFLOW_ENTRY_CLASS);
    menuBar.insertBefore(entry, overflowItem);
  });
  overflowItem.classList.remove(OVERFLOW_NEEDED_CLASS);

  const barEntries = (): HTMLElement[] =>
    Array.from(menuBar.children).filter((el): el is HTMLElement => el !== overflowItem && el instanceof HTMLElement);
  const limit = header.getBoundingClientRect().right;
  const edgeOf = (entries: HTMLElement[]): number => entries.at(-1)?.getBoundingClientRect().right ?? 0;

  if (edgeOf(barEntries()) <= limit) return;

  overflowItem.classList.add(OVERFLOW_NEEDED_CLASS);
  const reserve = overflowItem.getBoundingClientRect().width;
  while (edgeOf(barEntries()) > limit - reserve) {
    const entry = barEntries().at(-1);
    if (!entry) break;
    entry.classList.add(OVERFLOW_ENTRY_CLASS);
    overflowedEntries.unshift(entry);
    overflowPanel.insertBefore(entry, overflowPanel.firstChild);
  }
}

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
          markSavedAsUtf8();
          showToast(t('alert_file_saved', { path: savedPath }) || `Saved: ${savedPath}`, 'success');
        }
      }
    };

    if (!currentTab.filePath && !forceDialog) {
      const root = await getWorkspaceRoot();
      if (!root?.exists) {
        (showWorkspaceModal as any)('save', () => doSave(true));
        return;
      }
      await doSave(true);
    } else {
      await doSave(forceDialog);
    }
  };

  const executeOpenFile = async () => {
    const root = await getWorkspaceRoot();
    if (root && !root.exists) {
      showWorkspaceModal('open');
      return;
    }
    if (window.engineAPI?.openFile) {
      const res = await window.engineAPI.openFile();
      if (res && res.success && res.content !== undefined) {
        const fileName = res.fileName || res.filePath || res.path || 'untitled.md';
        (setEditorContent as any)(res.content, fileName);
        setDocumentFormat({ encoding: res.encoding || 'UTF-8', fileName });
        announceOpenedEncoding(res.encoding);
      }
    }
  };

  const executeSaveAll = async () => {
    const currentTabs = tabs || [];
    let savedCount = 0;
    let failedCount = 0;
    for (const tab of currentTabs) {
      if (!tab.model) continue;
      const result = await commitTabToFile(tab);
      if (result.ok) savedCount++;
      else if (!result.canceled) failedCount++;
    }
    if (failedCount) showToast(t('save_failed'), 'error');
    showToast(`Saved ${savedCount} document(s)`, 'success');
  };

  // Exit and Close Window end the same single window, so both ask first (the close-confirmation setting applies)
  const exitApplication = async () => {
    if (!(await confirmClose('app'))) return;
    window.engineAPI?.closeWindow?.();
  };

  // Register commands centrally
  const commandDefs: CommandDefinition[] = [
    // File Commands
    {
      id: 'file.new',
      title: 'New File',
      category: 'File',
      shortcut: 'Ctrl+N',
      handler: () => createBlankTab()
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
      handler: () => showWorkspaceModal('open')
    },
    {
      id: 'file.save',
      title: 'Save File',
      category: 'File',
      handler: () => executeSaveTab(false)
    },
    {
      id: 'file.saveAs',
      title: 'Save As',
      category: 'File',
      handler: () => executeSaveTab(true)
    },
    {
      id: 'file.saveAll',
      title: 'Save All',
      category: 'File',
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
      id: 'file.closeAllTabs',
      title: 'Close All Tabs',
      category: 'File',
      handler: async () => {
        for (const id of tabs.map((t) => t.id)) {
          await closeTab(id);
          // A cancelled save keeps its tab open, so the rest stay open too
          if (tabs.some((t) => t.id === id)) break;
        }
      }
    },
    {
      id: 'file.exit',
      title: 'Exit Application',
      category: 'File',
      handler: exitApplication
    },

    // Edit Commands
    {
      id: 'edit.undo',
      title: 'Undo',
      category: 'Edit',
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
        // The language lives in the settings page now (no header button): flip its select, which applies the language
        const langSelect = document.getElementById('modalLangSelect') as HTMLSelectElement | null;
        if (!langSelect) return;
        langSelect.value = langSelect.value === 'en' ? 'ja' : 'en';
        langSelect.dispatchEvent(new Event('change'));
      }
    },
    {
      id: 'view.toggleTheme',
      title: 'Toggle Theme',
      category: 'View',
      handler: () => {
        // Step to the next theme in the header select; its change listener applies it.
        const themeSelect = document.getElementById('themeSelect') as HTMLSelectElement | null;
        if (!themeSelect || themeSelect.options.length === 0) return;
        themeSelect.selectedIndex = (themeSelect.selectedIndex + 1) % themeSelect.options.length;
        themeSelect.dispatchEvent(new Event('change'));
      }
    },

    // Window Commands
    {
      id: 'window.minimize',
      title: 'Minimize Window',
      category: 'Window',
      handler: () => {
        if (window.engineAPI?.minimizeWindow) window.engineAPI.minimizeWindow();
      }
    },
    {
      id: 'window.maximize',
      title: 'Maximize Window',
      category: 'Window',
      handler: () => {
        if (window.engineAPI?.maximizeWindow) window.engineAPI.maximizeWindow();
      }
    },
    {
      id: 'window.close',
      title: 'Close Window',
      category: 'Window',
      handler: exitApplication
    },

    // Help Commands
    {
      id: 'help.aiSetup',
      title: 'First-run Setup',
      category: 'Help',
      handler: () => showAiSetupModal()
    },
    {
      id: 'help.settings',
      title: 'Preferences & Settings',
      category: 'Help',
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
      handler: () => showHelpPage()
    },
    {
      id: 'help.about',
      title: 'About VectOrEdit',
      category: 'Help',
      handler: () => showAboutModal()
    }
  ];
  commandManager.registerCommands(commandDefs);
  bindCommandShortcuts(commandDefs);
}

/**
 * Runs a command when its `Ctrl+<letter>` shortcut is pressed.
 * Only shortcuts declared on command definitions are bound, so the displayed labels match real behavior.
 */
function bindCommandShortcuts(defs: CommandDefinition[]): void {
  const commandByKey = new Map<string, string>();
  for (const def of defs) {
    const match = def.shortcut ? /^Ctrl\+([A-Za-z])$/.exec(def.shortcut) : null;
    if (match) commandByKey.set(match[1].toLowerCase(), def.id);
  }

  document.addEventListener('keydown', (e) => {
    if (!e.ctrlKey || e.shiftKey || e.altKey || e.metaKey || e.defaultPrevented) return;
    const commandId = commandByKey.get(e.key.toLowerCase());
    if (!commandId) return;
    e.preventDefault();
    void commandManager.executeCommand(commandId);
  });
}

/**
 * Initialize Menu Bar UI interactions and bind to CommandManager.
 */
export function initMenuBar(): void {
  // Ensure commands are registered
  registerAppCommands();

    const logoTrigger = document.getElementById('appHeaderLogoTrigger');
  logoTrigger?.addEventListener('click', () => showAboutModal());
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
      if (item.classList.contains(OVERFLOW_ENTRY_CLASS)) return;
      if (item.classList.contains('open')) {
        closeAllMenus();
      } else {
        openMenu(item);
      }
    });

    // Hover-switch when another menu is already open (VS Code style)
    item.addEventListener('mouseenter', () => {
      if (item.classList.contains(OVERFLOW_ENTRY_CLASS)) return;
      if (isMenuOpen && activeMenuItem !== item) {
        openMenu(item);
      }
    });
  });

  fitMenuBar(menuBar);
  new ResizeObserver(() => fitMenuBar(menuBar)).observe(menuBar.parentElement ?? menuBar);
  document.fonts?.ready.then(() => fitMenuBar(menuBar));

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

