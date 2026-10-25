import { editorEvents } from '../core/editorEvents.js';
import { getEditorInstance, getMonaco } from '../core/editorCore.js';
import { triggerAdaptiveAutoSave } from '../ui/autoSaveManager.js';
import { t } from '../../core/i18n.js';
import { STORAGE_KEYS } from '../../core/constants.js';
import { showToast } from '../../ui/notifications/toastManager.js';
import { showChoiceModal } from '../../ui/notifications/confirmModal.js';
import { confirmClose } from '../../ui/notifications/closeGuard.js';
import {
  DOCUMENT_FORMATS,
  formatOfName,
  otherFormat,
  toDocumentFormat,
  withFormatExtension
} from '../../../shared/documentFormat';
import jaLocale from '../../locales/ja.json';
import enLocale from '../../locales/en.json';

// The welcome document in every locale, read from the dictionaries (not hardcoded).
// Only an exact, unedited copy is swapped on a language change: anything the user typed must never be replaced.
const WELCOME_TEXTS = [enLocale, jaLocale].map(dict => dict.initial_document_content);

export let tabs = [];
export let activeTabId = null;
let tabCounter = 1;
/** True while the welcome document is swapped for another language (see the app:languageChanged listener). */
let isSwappingWelcomeText = false;

export function getActiveTab() {
  return tabs.find(t => t.id === activeTabId) || null;
}

/** The format new documents start in: the stored choice (first-run setup or Settings), Markdown when none. */
export function getDefaultDocumentFormat() {
  return toDocumentFormat(localStorage.getItem(STORAGE_KEYS.DOCUMENT_FORMAT));
}

function generateDefaultDocumentTitle() {
  const existingNums = new Set();
  const pattern = /^Doc-(\d+)\.(?:md|txt)$/i;
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
  return `Doc-${n}${DOCUMENT_FORMATS[getDefaultDocumentFormat()].extension}`;
}

/** A user's new document is empty; only the very first document of a session shows the welcome text. */
export function createBlankTab() {
  return createNewTab(null, '');
}

export function createNewTab(title = null, initialContent = null, filePath = null) {
  const monaco = getMonaco();
  if (!monaco) return null;

  const id = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const tabTitle = title || generateDefaultDocumentTitle();
    const contentToSet = initialContent !== null ? initialContent : (t('initial_document_content') || '');
  // The file name decides the format: .txt is plain text, everything else is Markdown
  const model = monaco.editor.createModel(contentToSet, DOCUMENT_FORMATS[formatOfName(tabTitle)].languageId);

  model.onDidChangeContent((e) => {
    if (isSwappingWelcomeText) return;
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

  // Unsaved changes are always asked about, whatever the "confirm before closing" setting says: Cancel keeps the tab.
  // A saved tab only gets the plain "close?" check, which that setting can turn off.
  let shouldSave = false;
  if (closingTab.isDirty) {
    const choice = await showChoiceModal({
      title: t('close_tab_unsaved_title'),
      message: t('close_tab_unsaved_message', { name: closingTab.title }),
      cancelText: t('btn_keep_open'),
      type: 'warning',
      choices: [
        { id: 'save', text: t('btn_save_and_close'), primary: true },
        { id: 'discard', text: t('btn_close_without_saving'), danger: true }
      ]
    });
    if (!choice) return;
    shouldSave = choice === 'save';
  } else if (!(await confirmClose('tab', { name: closingTab.title }))) {
    return;
  }

  if (shouldSave) {
    const text = closingTab.model.getValue();
    const { saveTextToFile } = await import('../io/fileIO.js');
    const res = await saveTextToFile(text, closingTab.title, formatOfName(closingTab.title) === 'text' ? 'txt' : 'md');
    if (!res.success) {
      return; // Abort close if saving fails or is cancelled
    }
  }

  tabs.splice(index, 1);
  if (closingTab && closingTab.model) {
    closingTab.model.dispose();
  }

  if (tabs.length === 0) {
    createBlankTab();
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

/** The format of a tab, from its language mode (the single source of truth, kept in step with the file name). */
export function getTabFormat(tab) {
  return tab?.model?.getLanguageId() === DOCUMENT_FORMATS.text.languageId ? 'text' : 'markdown';
}

/**
 * Switches one tab between Markdown and Text: the language mode, the extension of its name and, for a saved tab,
 * the extension of its path. A saved tab is marked as changed, so the next save writes the file under the new extension
 * (the old file is left where it is).
 * @returns {boolean} true when the format changed
 */
export function setTabFormat(tab, format, { notify = true } = {}) {
  const monaco = getMonaco();
  if (!monaco || !tab?.model || getTabFormat(tab) === format) return false;

  monaco.editor.setModelLanguage(tab.model, DOCUMENT_FORMATS[format].languageId);
  tab.title = withFormatExtension(tab.title, format);
  if (tab.filePath) {
    tab.filePath = withFormatExtension(tab.filePath, format);
    tab.isDirty = true;
  }
  editorEvents.emit('onTabRenderNeeded');
  editorEvents.emit('onStatusBarUpdateNeeded', tab.title);
  if (notify) showToast(t('format_switched', { name: tab.title }), 'info');
  return true;
}

/** The one-click switch: the active tab goes to the other format. */
export function toggleActiveTabFormat() {
  const tab = getActiveTab();
  if (tab) setTabFormat(tab, otherFormat(getTabFormat(tab)));
}

/** After first-run setup: documents that were never saved follow the chosen format (the welcome document included). */
export function applyFormatToUnsavedTabs(format) {
  tabs.filter((tab) => !tab.filePath && !tab.isDirty).forEach((tab) => setTabFormat(tab, format, { notify: false }));
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

// Listen for language switch and update welcome doc if user hasn't modified it
if (typeof window !== 'undefined') {
  window.addEventListener('app:languageChanged', () => {
    tabs.forEach(tab => {
      if (tab.model) {
        const currentVal = tab.model.getValue();
        if (WELCOME_TEXTS.includes(currentVal)) {
          const newContent = t('initial_document_content') || '';
          if (newContent === currentVal) return;
          // A language swap is not an edit: it must not mark the tab dirty or start AutoSave
          isSwappingWelcomeText = true;
          try {
            tab.model.setValue(newContent);
          } finally {
            isSwappingWelcomeText = false;
          }
          tab.isDirty = false;
          editorEvents.emit('onTabRenderNeeded');
        }
      }
    });
  });
}
