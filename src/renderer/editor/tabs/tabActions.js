import { getEditorInstance } from '../core/editorCore.js';
import { getActiveTab, createNewTab, getTabFormat, getDefaultDocumentFormat } from './tabState.js';
import { withFormatExtension } from '../../../shared/documentFormat';
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
  // The extracted text keeps the format of the document it came from
  const newTitle = withFormatExtension(`${sourceTitle}_extracted`, activeTab ? getTabFormat(activeTab) : getDefaultDocumentFormat());
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
