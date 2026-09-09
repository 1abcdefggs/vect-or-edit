/**
 * embeddingSourceController.test.ts
 *
 * Tests for Embedding Source Selector state transitions, badge configurations,
 * and interface contracts according to codebase-design principles.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getBadgeConfig,
  isLlmSource,
  BADGE_CONFIG,
  ACTIVE_STYLE,
  DEFAULT_STYLE,
  initEmbeddingSourceController
} from '../embeddingSourceController.js';

describe('Embedding Source Controller (Domain & Interface Logic)', () => {
  it('correctly maps local and LLM badge configuration', () => {
    expect(getBadgeConfig('local')).toEqual(BADGE_CONFIG.local);
    expect(getBadgeConfig('local').text).toBe('LOCAL');
    expect(getBadgeConfig('llm-embed-gemini')).toEqual(BADGE_CONFIG.llm);
    expect(getBadgeConfig('llm-embed-gemini').text).toBe('LLM');
    expect(getBadgeConfig('llm-embed-claude').text).toBe('LLM');
    expect(getBadgeConfig('llm-embed-openai').text).toBe('LLM');
  });

  it('determines whether an embedding source is LLM-based', () => {
    expect(isLlmSource('local')).toBe(false);
    expect(isLlmSource('llm-embed-gemini')).toBe(true);
    expect(isLlmSource('llm-embed-claude')).toBe(true);
    expect(isLlmSource('llm-embed-openai')).toBe(true);
  });

  it('defines distinct active and default visual styles', () => {
    expect(ACTIVE_STYLE.borderColor).toContain('var(--accent-color');
    expect(DEFAULT_STYLE.borderColor).toContain('var(--border-color');
    expect(ACTIVE_STYLE.background).not.toBe(DEFAULT_STYLE.background);
  });

  it('handles missing DOM gracefully (safe execution / idempotency)', () => {
    const fakeRegistry = {
      getActiveVectorizerId: vi.fn().mockReturnValue('local'),
      setActiveVectorizerId: vi.fn()
    };

    // When running outside a browser document without elements, it should not throw
    expect(() => initEmbeddingSourceController(fakeRegistry as any)).not.toThrow();
  });
});
