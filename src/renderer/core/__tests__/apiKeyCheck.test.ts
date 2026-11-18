import { describe, expect, it } from 'vitest';
import { checkApiKey } from '../apiKeyCheck.js';

describe('checkApiKey', () => {
  it('trims the two ends and accepts a key of any length', () => {
    expect(checkApiKey('gemini', '  AIzaSyABC \n')).toEqual({ key: 'AIzaSyABC', hasInnerWhitespace: false, prefixMismatch: false });
    expect(checkApiKey('openai', 'sk-' + 'a'.repeat(300)).hasInnerWhitespace).toBe(false);
  });

  it('detects a space or line break inside the key', () => {
    expect(checkApiKey('claude', 'sk-ant-abc def').hasInnerWhitespace).toBe(true);
    expect(checkApiKey('claude', 'sk-ant-abc\ndef').hasInnerWhitespace).toBe(true);
  });

  it('reports an unexpected start without rejecting', () => {
    expect(checkApiKey('gemini', 'sk-abc').prefixMismatch).toBe(true);
    expect(checkApiKey('openai', 'sk-proj-abc').prefixMismatch).toBe(false);
    expect(checkApiKey('claude', 'sk-ant-api03-x').prefixMismatch).toBe(false);
  });

  it('does not report an empty input', () => {
    expect(checkApiKey('gemini', '   ').prefixMismatch).toBe(false);
  });
});
