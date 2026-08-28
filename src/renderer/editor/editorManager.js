/**
 * Master Editor Facade & Orchestrator
 * Provides unified access to all deep modules in the editor subsystem.
 */

import { editorEvents } from './core/editorEvents.js';
import {
  tabs,
  activeTabId,
  createNewTab,
  switchTab,
  closeTab,
  renderTabs,
  getActiveTab,
  markActiveTabSaved,
  extractSelectionToNewTab,
  duplicateCurrentTab,
  triggerRpgSavedExpFloat
} from './tabs/tabManager.js';

import {
  initAutoSaveControls,
  triggerAdaptiveAutoSave,
  updateAutoSaveUI
} from './ui/autoSaveManager.js';

import {
  initEditor,
  toggleDiffMode,
  updateOptions as updateEditorOptions,
  applyCanvasTone as applyEditorCanvasTone,
  setEditorContent,
  insertTextIntoEditor,
  getEditorInstance,
  focusEditor,
  getCurrentContent,
  triggerRefreshLinter as refreshLinter,
  TONE_COLORS
} from './core/editorCore.js';

import { updateStatusBar } from './ui/statusBarManager.js';
import { initMemoryMonitor } from './monitor/memoryMonitor.js';
import { saveTextToFile } from './io/fileIO.js';
import { exportWorkspaceBundle, importWorkspaceBundle } from './io/bundleManager.js';

// Global Event Orchestration
editorEvents.on('createNewTab', () => {
  createNewTab();
});

editorEvents.on('setEditorContentRequest', ({ text, fileName }) => {
  const currentTab = getActiveTab();
  if (currentTab && currentTab.model.getValue().trim().length === 0) {
    currentTab.model.setValue(text);
    if (fileName) currentTab.title = fileName;
    currentTab.isDirty = false;
    renderTabs();
    updateStatusBar(currentTab.title);
  } else {
    createNewTab(fileName, text);
  }
  const ed = getEditorInstance();
  if (ed) ed.focus();
});

// Re-export full API surface for backwards compatibility
export {
  tabs,
  activeTabId,
  updateAutoSaveUI,
  initAutoSaveControls,
  triggerAdaptiveAutoSave,
  createNewTab,
  switchTab,
  closeTab,
  triggerRpgSavedExpFloat,
  renderTabs,
  getActiveTab,
  markActiveTabSaved,
  extractSelectionToNewTab,
  duplicateCurrentTab,
  initEditor,
  updateStatusBar,
  focusEditor,
  getEditorInstance,
  insertTextIntoEditor,
  setEditorContent,
  saveTextToFile,
  toggleDiffMode,
  updateEditorOptions,
  TONE_COLORS,
  applyEditorCanvasTone,
  initMemoryMonitor,
  getCurrentContent,
  refreshLinter,
  exportWorkspaceBundle,
  importWorkspaceBundle
};
