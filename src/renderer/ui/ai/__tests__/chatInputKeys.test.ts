import { describe, expect, it } from 'vitest';
import { shouldSendOnKey } from '../chatInputKeys';

describe('shouldSendOnKey', () => {
  it('sends on a plain Enter', () => {
    expect(shouldSendOnKey({ key: 'Enter', shiftKey: false })).toBe(true);
  });

  it('keeps Shift+Enter for a new line', () => {
    expect(shouldSendOnKey({ key: 'Enter', shiftKey: true })).toBe(false);
  });

  it('does not send while an input method is converting text', () => {
    expect(shouldSendOnKey({ key: 'Enter', shiftKey: false, isComposing: true })).toBe(false);
  });

  it('does not send on the input-method process key code', () => {
    expect(shouldSendOnKey({ key: 'Enter', shiftKey: false, isComposing: false, keyCode: 229 })).toBe(false);
  });

  it('ignores other keys, Escape included', () => {
    expect(shouldSendOnKey({ key: 'Escape', shiftKey: false })).toBe(false);
    expect(shouldSendOnKey({ key: 'a', shiftKey: false })).toBe(false);
  });
});
