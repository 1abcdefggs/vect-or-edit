import { describe, it, expect } from 'vitest';
import { textMenuKind } from '../textContextMenu.js';

describe('textMenuKind', () => {
  it('gives a text field the edit menu, even inside a read-only area or a selection', () => {
    expect(textMenuKind({ inTextField: true, inSelection: true, inReadonlyArea: true })).toBe('edit');
  });
  it('gives read-only text and selected text the copy menu', () => {
    expect(textMenuKind({ inTextField: false, inSelection: false, inReadonlyArea: true })).toBe('copy');
    expect(textMenuKind({ inTextField: false, inSelection: true, inReadonlyArea: false })).toBe('copy');
  });
  it('gives nothing to a control or blank space', () => {
    expect(textMenuKind({ inTextField: false, inSelection: false, inReadonlyArea: false })).toBeNull();
  });
});
