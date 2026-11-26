import { describe, expect, it } from 'vitest';
// @ts-ignore plain JS module
import { resolveContextMenuText } from '../editor/core/contextMenuText.js';

/** Right-click in the editor: a real selection is used as it is; with none, the word under the pointer is selected first. */
const selection = (empty: boolean) => ({ isEmpty: () => empty });
const model = (selected: string, word: { word: string; startColumn: number; endColumn: number } | null) => ({
  getValueInRange: () => selected,
  getWordAtPosition: () => word
});
const position = { lineNumber: 4, column: 7 };

describe('resolveContextMenuText', () => {
  it('uses a real selection as it is, trimmed, and selects nothing new', () => {
    const r = resolveContextMenuText(selection(false), position, model('  abstract sentences ', null));
    expect(r).toEqual({ text: 'abstract sentences', selectRange: null });
  });

  it('with no selection, selects the word under the pointer so Copy, Cut and Google act on it', () => {
    const r = resolveContextMenuText(selection(true), position, model('', { word: 'vector', startColumn: 5, endColumn: 11 }));
    expect(r.text).toBe('vector');
    expect(r.selectRange).toEqual({ startLineNumber: 4, startColumn: 5, endLineNumber: 4, endColumn: 11 });
  });

  it('with no selection and no word (blank space), the text is empty and nothing is selected', () => {
    expect(resolveContextMenuText(selection(true), position, model('', null))).toEqual({ text: '', selectRange: null });
  });

  it('with no pointer position, the text is empty', () => {
    expect(resolveContextMenuText(selection(true), undefined, model('', { word: 'x', startColumn: 1, endColumn: 2 }))).toEqual({
      text: '',
      selectRange: null
    });
  });

  it('a selection that is only blanks is empty text but still not replaced by a word', () => {
    expect(resolveContextMenuText(selection(false), position, model('   ', { word: 'x', startColumn: 1, endColumn: 2 }))).toEqual({
      text: '',
      selectRange: null
    });
  });
});
