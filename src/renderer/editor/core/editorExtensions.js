import { allDictEntries } from '../../search/dictionary.js';
import { i18n } from '../../core/i18n.js';

let linterTimeout = null;

export function runEngineLinter(editor, monacoRef) {
  if (!editor || !monacoRef) return;
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

export function registerEngineCompletionProvider(monacoRef) {
  if (!monacoRef?.languages) return;
  if (monacoRef.languages._isKnowledgeProviderRegistered) return;
  monacoRef.languages._isKnowledgeProviderRegistered = true;

  monacoRef.languages.registerCompletionItemProvider('markdown', {
    triggerCharacters: [' ', ':', '、', '。'],
    provideCompletionItems: function (model, position) {
      const word = model.getWordUntilPosition(position);

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

      return { suggestions };
    }
  });
}

export function initializeKnowledgeExtensions(editor, monacoRef) {
  registerEngineCompletionProvider(monacoRef);
  runEngineLinter(editor, monacoRef);
  editor.onDidChangeModelContent(() => {
    runEngineLinter(editor, monacoRef);
  });
}

export function refreshLinter(editor, diffEditor, monacoRef) {
  if (editor && monacoRef) {
    runEngineLinter(editor, monacoRef);
  }
  if (diffEditor && monacoRef) {
    const modifiedEditor = diffEditor.getModifiedEditor();
    if (modifiedEditor) {
      runEngineLinter(modifiedEditor, monacoRef);
    }
  }
}
