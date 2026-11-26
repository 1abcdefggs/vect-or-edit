import { describe, expect, it } from 'vitest';
import { shouldClearFocus } from '../ui/components/blankPressFocus.js';

/** A fake element: closest() answers true when the matching selector part is in the given set. */
const el = (kind: string) => ({
  closest: (selector: string) => (selector.split(',').map((s) => s.trim()).includes(kind) ? {} : null)
});

describe('blank press clears focus (pointer_rules clear_focus)', () => {
  it('clears focus on a left press on blank space', () => {
    expect(shouldClearFocus(el('div.blank'), 0)).toBe(true);
  });
  it('leaves the right and middle buttons alone', () => {
    expect(shouldClearFocus(el('div.blank'), 2)).toBe(false);
    expect(shouldClearFocus(el('div.blank'), 1)).toBe(false);
  });
  it('keeps focus handling for controls, text fields and the editor', () => {
    for (const kind of ['input', 'textarea', 'select', 'button', '#monacoContainer', '.monaco-editor', '[tabindex]']) {
      expect(shouldClearFocus(el(kind), 0), kind).toBe(false);
    }
  });
  it('ignores a missing target', () => {
    expect(shouldClearFocus(null, 0)).toBe(false);
  });
});
