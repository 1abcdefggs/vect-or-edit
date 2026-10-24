import { describe, it, expect, beforeEach } from 'vitest';
import { aiManager } from '../aiStateManager.js';
import { canUseLlm, canUseEmbedding, knowledgeSources } from '../aiAccess.js';

// ADR-11: LLM and Embedding are independent switches, and every AI feature asks aiAccess before it runs
describe('aiAccess (LLM / Embedding independence)', () => {
  beforeEach(() => {
    aiManager.init({ llm: true, embed: true });
    aiManager.setLlm(false);
    aiManager.setEmbed(false);
  });

  it('refuses everything while both switches are off, and keeps the dictionary on', () => {
    expect(canUseLlm()).toBe(false);
    expect(canUseEmbedding()).toBe(false);
    expect(knowledgeSources()).toEqual({ dictionary: true, vector: false, llm: false });
  });

  it('turning the LLM on does not turn the Embedding on', () => {
    aiManager.setLlm(true);
    expect(canUseLlm()).toBe(true);
    expect(canUseEmbedding()).toBe(false);
    expect(aiManager.getState().embed).toBe(false);
  });

  it('turning the Embedding on does not turn the LLM on', () => {
    aiManager.setEmbed(true);
    expect(canUseEmbedding()).toBe(true);
    expect(canUseLlm()).toBe(false);
    expect(aiManager.getState().llm).toBe(false);
  });

  it('turning one switch off leaves the other as it was', () => {
    aiManager.setLlm(true);
    aiManager.setEmbed(true);
    aiManager.setLlm(false);
    expect(canUseLlm()).toBe(false);
    expect(canUseEmbedding()).toBe(true);
  });

  it('lists the knowledge sources the way ADR-11 section 2.2 does', () => {
    aiManager.setLlm(true);
    expect(knowledgeSources()).toEqual({ dictionary: true, vector: false, llm: true });
    aiManager.setEmbed(true);
    expect(knowledgeSources()).toEqual({ dictionary: true, vector: true, llm: true });
    aiManager.setLlm(false);
    expect(knowledgeSources()).toEqual({ dictionary: true, vector: true, llm: false });
  });

  it('refuses to switch on without a configured provider or model', () => {
    aiManager.init({ llm: false, embed: false });
    expect(() => aiManager.setLlm(true)).toThrow();
    expect(() => aiManager.setEmbed(true)).toThrow();
    expect(canUseLlm()).toBe(false);
    expect(canUseEmbedding()).toBe(false);
  });

  it('switches a feature off when its configuration is lost, and leaves the other alone', () => {
    aiManager.setLlm(true);
    aiManager.setEmbed(true);
    aiManager.setConfigured({ llm: false });
    expect(canUseLlm()).toBe(false);
    expect(canUseEmbedding()).toBe(true);
  });

  it('announces each real change once, with its source', () => {
    const seen: Array<{ which: string; from: boolean; to: boolean; source: string }> = [];
    const listener = (e: Event) => seen.push((e as CustomEvent).detail.change);
    aiManager.addEventListener('app:aiSwitchChanged', listener);
    aiManager.setLlm(true, 'toolbar');
    aiManager.setLlm(true, 'toolbar');
    aiManager.setEmbed(true, 'sidebar');
    aiManager.setConfigured({ llm: false });
    aiManager.removeEventListener('app:aiSwitchChanged', listener);
    expect(seen).toEqual([
      { which: 'llm', from: false, to: true, source: 'toolbar' },
      { which: 'embed', from: false, to: true, source: 'sidebar' },
      { which: 'llm', from: true, to: false, source: 'config' }
    ]);
  });
});
