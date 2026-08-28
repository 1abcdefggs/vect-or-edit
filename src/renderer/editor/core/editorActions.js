import { triggerMonacoVectorSearch } from '../../search/vectorSearch.js';
import { saveTextToFile } from '../io/fileIO.js';
import { i18n } from '../../core/i18n.js';
import { editorEvents } from './editorEvents.js';

export function registerMonacoSuggestAction(editor, monacoRef) {
  if (!editor || !monacoRef) return;

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

export function registerTabManagementActions(editor) {
  if (!editor) return;

  editor.addAction({
    id: 'action-copy-to-new-tab',
    label: i18n.action_copy_to_new_tab || 'Copy Selection to New Tab',
    contextMenuGroupId: '9_cutcopypaste',
    contextMenuOrder: 1.5,
    run: () => editorEvents.emit('extractSelectionToNewTab', 'copy')
  });

  editor.addAction({
    id: 'action-cut-to-new-tab',
    label: i18n.action_cut_to_new_tab || 'Cut Selection to New Tab',
    contextMenuGroupId: '9_cutcopypaste',
    contextMenuOrder: 1.6,
    run: () => editorEvents.emit('extractSelectionToNewTab', 'cut')
  });

  editor.addAction({
    id: 'action-duplicate-tab',
    label: i18n.action_duplicate_tab || 'Duplicate Current Tab',
    contextMenuGroupId: '9_cutcopypaste',
    contextMenuOrder: 1.7,
    run: () => editorEvents.emit('duplicateCurrentTab')
  });
}
