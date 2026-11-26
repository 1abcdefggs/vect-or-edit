import { describe, it, expect } from 'vitest';
import { findSameWordRanges } from '../sameWordUnderline.js';

/** A minimal editor: one text, a caret, an optional selection; findMatches counts plain occurrences. */
function fakeEditor(text: string, caretWord: string, selectionEmpty = true) {
  const matches = () => {
    const out: { range: number }[] = [];
    let i = text.indexOf(caretWord);
    while (i >= 0) { out.push({ range: i }); i = text.indexOf(caretWord, i + 1); }
    return out;
  };
  return {
    getModel: () => ({
      getWordAtPosition: () => ({ word: caretWord }),
      findMatches: () => matches()
    }),
    getSelection: () => ({ isEmpty: () => selectionEmpty, getStartPosition: () => ({}) }),
    getRawOptions: () => ({})
  } as never;
}

describe('findSameWordRanges', () => {
  it('returns every place when the word appears twice or more', () => {
    expect(findSameWordRanges(fakeEditor('LLM and LLM', 'LLM'))).toHaveLength(2);
  });
  it('returns nothing when the word appears once', () => {
    expect(findSameWordRanges(fakeEditor('vague words', 'vague'))).toEqual([]);
  });
  it('returns nothing while text is selected', () => {
    expect(findSameWordRanges(fakeEditor('LLM and LLM', 'LLM', false))).toEqual([]);
  });
});
