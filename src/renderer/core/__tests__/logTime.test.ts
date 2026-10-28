import { describe, expect, it } from 'vitest';
import { formatLogTime } from '../logTime';

describe('formatLogTime', () => {
  const iso = '2026-10-25T16:47:01.123Z';

  it('shows 24-hour HH:MM:SS by default', () => {
    expect(formatLogTime(iso)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('shows the UTC clock when the zone is utc', () => {
    expect(formatLogTime(iso, 'h24', 'utc')).toBe('16:47:01');
  });

  it('shows ISO 8601 in UTC whatever the zone', () => {
    expect(formatLogTime(iso, 'iso', 'local')).toBe(iso);
    expect(formatLogTime(iso, 'iso', 'utc')).toBe(iso);
  });

  it('shows 12-hour time with AM or PM', () => {
    expect(formatLogTime(iso, 'h12', 'utc')).toBe('04:47:01 PM');
  });

  it('passes unparseable legacy values through unchanged', () => {
    expect(formatLogTime('11:41:40')).toBe('11:41:40');
  });
});
