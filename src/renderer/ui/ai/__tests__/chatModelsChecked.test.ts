import { describe, expect, it } from 'vitest';
import { CHAT_MODELS_CHECKED_ON, formatEnglishDate } from '../../../../shared/chatModels';

describe('formatEnglishDate', () => {
  it('shows an ISO date as an English date', () => {
    expect(formatEnglishDate('2026-11-23')).toBe('Nov 23, 2026');
  });

  it('keeps the checked date of the fixed lists in ISO form', () => {
    expect(CHAT_MODELS_CHECKED_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
