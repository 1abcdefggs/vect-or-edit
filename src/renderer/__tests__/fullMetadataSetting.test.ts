import { describe, expect, it } from 'vitest';
import { parseFullMetadata } from '../search/fullMetadataSetting.js';

describe('parseFullMetadata', () => {
  it('reads the current stored form', () => {
    expect(parseFullMetadata('on')).toBe(true);
    expect(parseFullMetadata('off')).toBe(false);
  });

  it('still reads the form stored before 2026-11-20', () => {
    expect(parseFullMetadata('true')).toBe(true);
    expect(parseFullMetadata('false')).toBe(false);
  });

  it('treats a missing or unknown value as off, the default', () => {
    expect(parseFullMetadata(null)).toBe(false);
    expect(parseFullMetadata('')).toBe(false);
    expect(parseFullMetadata('yes')).toBe(false);
  });
});
