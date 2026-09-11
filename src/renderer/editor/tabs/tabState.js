import { editorEvents } from '../core/editorEvents.js';
import { getEditorInstance, getMonaco } from '../core/editorCore.js';
import { triggerAdaptiveAutoSave } from '../ui/autoSaveManager.js';
import { t } from '../../core/i18n.js';

export let tabs = [];
export let activeTabId = null;
let tabCounter = 1;

export function getActiveTab() {
  return tabs.find(t => t.id === activeTabId) || null;
}

function generateDefaultDocumentTitle() {
  const existingNums = new Set();
  const pattern = /^Doc-(\d+)\.md$/i;
  for (const tab of tabs) {
    if (tab.title) {
      const match = tab.title.match(pattern);
      if (match) {
        existingNums.add(parseInt(match[1], 10));
      }
    }
  }
  let n = 1;
  while (existingNums.has(n)) {
    n++;
  }
  return `Doc-${n}.md`;
}

export function createNewTab(title = null, initialContent = '', filePath = null) {
  const monaco = getMonaco();
  if (!monaco) return null;

  const id = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const tabTitle = title || generateDefaultDocumentTitle();
  const model = monaco.editor.createModel(initialContent, 'markdown');

  model.onDidChangeContent((e) => {
    const tab = tabs.find(t => t.id === id);
    if (tab && !tab.isDirty) {
      tab.isDirty = true;
      editorEvents.emit('onTabRenderNeeded');
    }
    const hasLineBreak = e?.changes ? e.changes.some(c => c.text && c.text.includes('\n')) : false;
    if (tab) {
      triggerAdaptiveAutoSave(tab, hasLineBreak);
    }
    if (activeTabId === id) {
      editorEvents.emit('onStatusBarUpdateNeeded', tab ? tab.title : null);
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
  editorEvents.emit('onTabRenderNeeded');
  switchTab(id);
  return tabObj;
}

export function switchTab(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  const monacoEditorInstance = getEditorInstance();
  if (!tab || !monacoEditorInstance) return;

  activeTabId = tabId;
  monacoEditorInstance.setModel(tab.model);
  editorEvents.emit('onStatusBarUpdateNeeded', tab.title);
  editorEvents.emit('onTabRenderNeeded');
  monacoEditorInstance.focus();
}

export async function closeTab(tabId, e) {
  if (e) e.stopPropagation();
  const index = tabs.findIndex(t => t.id === tabId);
  if (index === -1) return;

  const closingTab = tabs[index];
  
  // Always prompt to save
  const shouldSave = window.confirm(t('prompt_save_on_close') || "Closing the tab. Do you want to save the content?\n\n[OK] Save and close\n[Cancel] Close without saving");

  if (shouldSave) {
    const text = closingTab.model.getValue();
    const { saveTextToFile } = await import('../io/fileIO.js');
    const res = await saveTextToFile(text, closingTab.title, 'md');
    if (!res.success) {
      return; // Abort close if saving fails or is cancelled
    }
  }

  tabs.splice(index, 1);
  if (closingTab && closingTab.model) {
    closingTab.model.dispose();
  }

  if (tabs.length === 0) {
    createNewTab();
  } else if (activeTabId === tabId) {
    const nextIndex = Math.max(0, index - 1);
    switchTab(tabs[nextIndex].id);
  } else {
    editorEvents.emit('onTabRenderNeeded');
  }
}

export function duplicateTab(tabId = activeTabId) {
  const sourceTab = tabs.find(t => t.id === tabId) || getActiveTab();
  if (!sourceTab || !sourceTab.model) return null;
  const content = sourceTab.model.getValue();
  const baseTitle = sourceTab.title.replace(/\.[^/.]+$/, '');
  const ext = sourceTab.title.includes('.') ? sourceTab.title.split('.').pop() : 'md';
  const newTitle = `${baseTitle}-copy.${ext}`;
  return createNewTab(newTitle, content, null);
}

export function markActiveTabSaved(savedFilePath) {
  const tab = getActiveTab();
  if (tab) {
    tab.isDirty = false;
    if (savedFilePath) {
      tab.filePath = savedFilePath;
      const baseName = savedFilePath.split(/[/\\]/).pop();
      if (baseName) tab.title = baseName;
    }
    editorEvents.emit('onTabRenderNeeded');
    editorEvents.emit('triggerRpgSavedExpFloat', tab.id);
    editorEvents.emit('onStatusBarUpdateNeeded', tab.title);
  }
}
