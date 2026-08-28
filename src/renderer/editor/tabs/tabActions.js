import { getEditorInstance } from '../core/editorCore.js';
import { getActiveTab, createNewTab } from './tabState.js';
import { editorEvents } from '../core/editorEvents.js';

export function extractSelectionToNewTab(mode = 'copy') {
  const monacoEditorInstance = getEditorInstance();
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

// Bind event bus listeners
editorEvents.on('extractSelectionToNewTab', (mode) => extractSelectionToNewTab(mode));
editorEvents.on('duplicateCurrentTab', () => duplicateCurrentTab());
