import { describe, it, expect } from 'vitest';
import { searchHelp, withHelpContext, isHelpQuestion } from '../helpKnowledge.js';
// Japanese questions live in the fixture file (data, not code), so the English-invariant guard stays strict
import cases from './helpKnowledge.cases.json';

// The chat answers questions about the app from the generated guide (ADR-11, item 33)
describe('helpKnowledge', () => {
  it('finds the zoom card for a question about enlarging the whole window', () => {
    const hits = searchHelp(cases.zoomQuestion, { lang: 'ja' });
    expect(hits.length).toBeGreaterThan(0);
    const zoom = new RegExp(cases.zoomPattern, 'i');
    expect(hits.slice(0, 3).some(({ entry }: { entry: { text: string } }) => zoom.test(entry.text))).toBe(true);
  });

  it('finds the embedding button for "what is Embedding"', () => {
    const hits = searchHelp(cases.embeddingQuestion, { lang: 'ja' });
    const embedding = new RegExp(cases.embeddingPattern, 'i');
    expect(hits.slice(0, 3).some(({ entry }: { entry: { text: string } }) => embedding.test(entry.text))).toBe(true);
  });

  it('finds font settings for a question in English', () => {
    const hits = searchHelp('can I change the font?', { lang: 'en' });
    expect(hits.slice(0, 3).some(({ entry }: { entry: { text: string } }) => /font/i.test(entry.text))).toBe(true);
  });

  it('puts the excerpts in front of a question about the app', () => {
    const prompt = cases.zoomQuestion;
    const wrapped = withHelpContext(prompt);
    expect(wrapped).not.toBe(prompt);
    expect(wrapped).toContain('Guide excerpts');
    expect(wrapped.endsWith(prompt)).toBe(true);
  });

  it('leaves a text to rewrite alone', () => {
    const prompt = cases.rewriteRequest;
    expect(isHelpQuestion(prompt)).toBe(false);
    expect(withHelpContext(prompt)).toBe(prompt);
  });
});
