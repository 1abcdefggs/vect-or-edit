import { describe, it, expect } from 'vitest';
import { LLM_PROVIDERS, llmProviderName } from '../llmProviders';

// Owner decision 2026-11-17: the cloud providers are listed as Google Gemini, OpenAI, Claude everywhere
describe('llmProviders', () => {
  it('lists the three providers in display order', () => {
    expect(LLM_PROVIDERS.map((p) => p.id)).toEqual(['gemini', 'openai', 'claude']);
  });

  it('names each provider', () => {
    expect(llmProviderName('gemini')).toBe('Google Gemini');
    expect(llmProviderName('openai')).toBe('OpenAI');
    expect(llmProviderName('claude')).toBe('Claude');
  });

  it('returns an unknown id unchanged', () => {
    expect(llmProviderName('none')).toBe('none');
  });
});
