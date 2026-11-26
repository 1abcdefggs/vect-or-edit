// What a right-click in the editor acts on (owner decision 20261127):
// a real selection is used as it is; with no selection, the word under the pointer is selected first,
// so Copy, Cut and Google all act on the same text and Cut really deletes it.

/**
 * @param {{ isEmpty: () => boolean } | null | undefined} selection  the editor selection
 * @param {{ lineNumber: number, column: number } | null | undefined} position  the position under the pointer
 * @param {{ getValueInRange: (range: unknown) => string, getWordAtPosition: (p: unknown) => ({ word: string, startColumn: number, endColumn: number } | null) } | null | undefined} model
 * @returns {{ text: string, selectRange: { startLineNumber: number, startColumn: number, endLineNumber: number, endColumn: number } | null }}
 */
export function resolveContextMenuText(selection, position, model) {
  if (selection && !selection.isEmpty()) {
    return { text: model?.getValueInRange(selection)?.trim() || '', selectRange: null };
  }
  const word = position ? model?.getWordAtPosition(position) : null;
  if (!word?.word) return { text: '', selectRange: null };
  return {
    text: word.word,
    selectRange: {
      startLineNumber: position.lineNumber,
      startColumn: word.startColumn,
      endLineNumber: position.lineNumber,
      endColumn: word.endColumn
    }
  };
}
