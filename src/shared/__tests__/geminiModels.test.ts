/**
 * geminiModels.test.ts
 *
 * Model ids and names come from the Gemini API and from localStorage. The shared rules reject ids that are not
 * plain id characters, cap text lengths, and hide models that cannot generate content.
 */

import { describe, it, expect } from 'vitest';
import { isValidGeminiModelId, toGeminiModelInfo, usableGeminiModels, groupGeminiModels, brandOf, formatTokenLimit } from '../geminiModels';

describe('isValidGeminiModelId', () => {
  it('accepts plain Gemini ids, including the default', () => {
    expect(isValidGeminiModelId('gemini-3.1-flash-lite')).toBe(true);
    expect(isValidGeminiModelId('gemini-2.5-pro_preview')).toBe(true);
  });

  it('rejects ids with path, query or markup characters, empty and non-string values', () => {
    expect(isValidGeminiModelId('models/../x')).toBe(false);
    expect(isValidGeminiModelId('gemini?key=1')).toBe(false);
    expect(isValidGeminiModelId('<img src=x>')).toBe(false);
    expect(isValidGeminiModelId('')).toBe(false);
    expect(isValidGeminiModelId(42)).toBe(false);
    expect(isValidGeminiModelId('a'.repeat(101))).toBe(false);
  });
});

describe('toGeminiModelInfo', () => {
  it('strips the models/ prefix and reads canGenerate from supportedActions or supportedGenerationMethods', () => {
    const a = toGeminiModelInfo({ name: 'models/gemini-x', supportedActions: ['generateContent'] });
    const b = toGeminiModelInfo({ name: 'models/gemini-y', supportedGenerationMethods: ['generateContent'] });
    expect(a).toMatchObject({ name: 'gemini-x', displayName: 'gemini-x', canGenerate: true });
    expect(b).toMatchObject({ name: 'gemini-y', canGenerate: true });
  });

  it('keeps a gemini model that cannot generate, flagged canGenerate false', () => {
    const info = toGeminiModelInfo({ name: 'models/gemini-embedding-001', supportedGenerationMethods: ['embedContent'] });
    expect(info).toMatchObject({ name: 'gemini-embedding-001', canGenerate: false });
  });

  it('drops non-gemini models that cannot generate, and entries without a valid name', () => {
    expect(toGeminiModelInfo({ name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] })).toBeNull();
    expect(toGeminiModelInfo({ name: 'models/../../evil', supportedActions: ['generateContent'] })).toBeNull();
    expect(toGeminiModelInfo({ displayName: 'no name' })).toBeNull();
    expect(toGeminiModelInfo({ name: 42 })).toBeNull();
    expect(toGeminiModelInfo(null)).toBeNull();
    expect(toGeminiModelInfo('gemini-x')).toBeNull();
  });

  it('caps display name and description and ignores non-numeric limits', () => {
    const info = toGeminiModelInfo({
      name: 'gemini-a',
      displayName: 'x'.repeat(500),
      description: 'y'.repeat(900),
      inputTokenLimit: '1000',
      outputTokenLimit: 8192
    });
    expect(info?.displayName?.length).toBe(200);
    expect(info?.description?.length).toBe(500);
    expect(info?.inputTokenLimit).toBeUndefined();
    expect(info?.outputTokenLimit).toBe(8192);
  });
});

describe('usableGeminiModels', () => {
  it('hides models that cannot generate content and keeps the rest', () => {
    const result = usableGeminiModels([
      { name: 'gemini-3.1-flash-lite', displayName: 'Gemini 3.1 Flash-Lite', canGenerate: true },
      { name: 'text-embedding-004', displayName: 'Embedding', canGenerate: false },
      { name: 'gemini-embedding-001', displayName: 'Gemini Embedding', canGenerate: false }
    ]);
    expect(result.map((m) => m.name)).toEqual(['gemini-3.1-flash-lite']);
  });

  it('drops entries with an invalid id and returns only the known fields', () => {
    const result = usableGeminiModels([
      { name: 'gemini-x', displayName: 'ok', canGenerate: true, extra: 'ignored' },
      { name: '../../evil', canGenerate: true },
      null
    ]);
    expect(result).toEqual([{ name: 'gemini-x', displayName: 'ok' }]);
  });

  it('caps the display name length and tolerates a non-array input', () => {
    const [item] = usableGeminiModels([{ name: 'gemini-a', displayName: 'x'.repeat(500), canGenerate: true }]);
    expect(item.displayName.length).toBe(200);
    expect(usableGeminiModels(null)).toEqual([]);
    expect(usableGeminiModels(undefined)).toEqual([]);
  });
});

const M = (name: string, extra: Record<string, unknown> = {}) => ({ name, displayName: name, canGenerate: true, ...extra });

describe('groupGeminiModels', () => {
  const list = [
    M('gemini-2.5-flash'),
    M('gemma-4-26b-a4b-it'),
    M('gemini-2.5-flash-preview-tts'),
    M('gemini-3.1-flash-lite-preview'),
    M('gemini-3.1-pro-preview', { thinking: true, inputTokenLimit: 1048576 }),
    M('gemini-2.5-pro'),
    M('gemini-flash-latest'),
    M('gemini-embedding-001', { canGenerate: false })
  ];

  it('orders groups Gemini newest first, then Gemma, then ids without a generation; hides non-generating models', () => {
    const groups = groupGeminiModels(list);
    expect(groups.map((g) => g.key)).toEqual(['gemini-3', 'gemini-2', 'gemma-4', 'other-gemini']);
    expect(groups.flatMap((g) => g.models).some((m) => m.name === 'gemini-embedding-001')).toBe(false);
  });

  it('splits the models without a generation by name series, and keeps an unknown series last', () => {
    const groups = groupGeminiModels([M('gemini-flash-latest'), M('imagen-4', { displayName: 'Imagen 4' }), M('veo-3', { displayName: 'Veo 3' }), M('x-1', { displayName: '' }), M('gemini-3-pro')]);
    expect(groups.map((x) => x.key)).toEqual(['gemini-3', 'other-gemini', 'other-imagen', 'other-veo', 'other-other']);
  });

  it('sorts text models first, then newer generation, then Pro before Flash before Flash-Lite', () => {
    const [g3, g2] = groupGeminiModels(list);
    expect(g3.models.map((m) => m.name)).toEqual(['gemini-3.1-pro-preview', 'gemini-3.1-flash-lite-preview']);
    expect(g2.models.map((m) => m.name)).toEqual(['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-preview-tts']);
  });

  it('marks purpose, preview, thinking, cost guide and NEW from the id and API fields only', () => {
    const all = Object.fromEntries(groupGeminiModels(list).flatMap((g) => g.models).map((m) => [m.name, m]));
    expect(all['gemini-3.1-pro-preview']).toMatchObject({ isNew: true, preview: true, thinking: true, costGuide: 'high', purpose: 'text' });
    expect(all['gemini-3.1-flash-lite-preview']).toMatchObject({ isNew: true, costGuide: 'low' });
    expect(all['gemini-2.5-flash']).toMatchObject({ isNew: false, preview: false, thinking: false, costGuide: 'standard' });
    expect(all['gemini-2.5-flash-preview-tts']).toMatchObject({ purpose: 'speech', isNew: false });
    expect(all['gemma-4-26b-a4b-it']).toMatchObject({ family: 'gemma', costGuide: null, isNew: false });
  });

  it('reads the tier from the id: Pro, Flash, Flash-Lite, and none for Gemma or aliases without a tier', () => {
    const all = Object.fromEntries(groupGeminiModels([M('gemini-3.1-pro'), M('gemini-3.1-flash'), M('gemini-3.1-flash-lite'), M('gemma-4-it'), M('gemini-3-argon')]).flatMap((g) => g.models).map((m) => [m.name, m]));
    expect(all['gemini-3.1-pro']).toMatchObject({ tier: 'pro', costGuide: 'high' });
    expect(all['gemini-3.1-flash']).toMatchObject({ tier: 'flash', costGuide: 'standard' });
    expect(all['gemini-3.1-flash-lite']).toMatchObject({ tier: 'lite', costGuide: 'low' });
    expect(all['gemma-4-it']).toMatchObject({ tier: null, costGuide: null });
    expect(all['gemini-3-argon']).toMatchObject({ tier: null, costGuide: null });
  });

  it('treats transcription models as speech, not text', () => {
    const [g] = groupGeminiModels([M('gemini-3.5-transcribe'), M('gemini-3.5-flash')]);
    expect(g.models.map((m) => [m.name, m.purpose])).toEqual([['gemini-3.5-flash', 'text'], ['gemini-3.5-transcribe', 'speech']]);
  });

  it('tolerates a non-array input and drops invalid ids', () => {
    expect(groupGeminiModels(null)).toEqual([]);
    expect(groupGeminiModels([M('../../evil')])).toEqual([]);
  });
});

describe('formatTokenLimit', () => {
  it('shortens limits and ignores missing values', () => {
    expect(formatTokenLimit(1048576)).toBe('1M');
    expect(formatTokenLimit(200000)).toBe('200K');
    expect(formatTokenLimit(512)).toBe('512');
    expect(formatTokenLimit(undefined)).toBe('');
    expect(formatTokenLimit(0)).toBe('');
  });
});

describe('brandOf', () => {
  it('names the series: Gemini, Gemma, and Nano Banana (which has a Gemini id)', () => {
    expect(brandOf('gemini-3-flash', 'Gemini 3 Flash').key).toBe('gemini');
    expect(brandOf('gemma-4-31b', 'Gemma 4 31B').key).toBe('gemma');
    expect(brandOf('gemini-2.5-flash-image', 'Gemini 2.5 Flash Image').key).toBe('nano-banana');
    expect(brandOf('gemini-3-pro-image-preview', 'Nano Banana Pro').key).toBe('nano-banana');
  });

  it('takes the first word of an unknown series and keeps the key to plain characters', () => {
    expect(brandOf('imagen-4', 'Imagen 4')).toEqual({ key: 'imagen', label: 'Imagen' });
    expect(brandOf('x', '<b>Hack</b> 1').key).toMatch(/^[a-z0-9-]+$/);
    expect(brandOf('x', '')).toEqual({ key: 'other', label: '' });
  });
});
