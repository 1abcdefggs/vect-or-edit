import { describe, expect, it } from 'vitest';
import { DEFAULT_CHAT_PLACEMENT, normalizeChatPlacement, otherChatPlacement } from '../chatPlacementRule';

describe('chatPlacementRule', () => {
  it('starts below the editor', () => {
    expect(DEFAULT_CHAT_PLACEMENT).toBe('below');
  });

  it('keeps the two known places', () => {
    expect(normalizeChatPlacement('sidebar')).toBe('sidebar');
    expect(normalizeChatPlacement('below')).toBe('below');
  });

  it('falls back to the default for anything else', () => {
    for (const value of [null, undefined, '', 'right', 'SIDEBAR', 3, {}]) {
      expect(normalizeChatPlacement(value)).toBe('below');
    }
  });

  it('names the other place', () => {
    expect(otherChatPlacement('below')).toBe('sidebar');
    expect(otherChatPlacement('sidebar')).toBe('below');
  });
});
