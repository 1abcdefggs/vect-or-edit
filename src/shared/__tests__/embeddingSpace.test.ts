import { describe, it, expect } from 'vitest';
import { decideSpace, isMatryoshkaSpace, spaceOfModelId, truncateAndNormalize } from '../embeddingSpace';

// A small registry: two builds of one small model, one Matryoshka model that makes 768 and 384, one unrelated model
const models = [
  { id: 'Xenova/e5-small', spaceId: 'F.e5small' },
  { id: 'intfloat/e5-small', spaceId: 'F.e5small' },
  { id: 'org/mrl-base', spaceId: 'F.mrl', matryoshka: true },
  { id: 'org/other-384' }
];
const e5 = { id: 'Xenova/e5-small', dimensions: 384 };
const mrl768 = { id: 'org/mrl-base', dimensions: 768 };
const mrl384 = { id: 'org/mrl-base', dimensions: 384 };

describe('spaceOfModelId', () => {
  it('uses the registered space, else the id itself', () => {
    expect(spaceOfModelId('intfloat/e5-small', models)).toBe('F.e5small');
    expect(spaceOfModelId('org/other-384', models)).toBe('org/other-384');
    expect(spaceOfModelId('unknown/model', models)).toBe('unknown/model');
  });
});

describe('decideSpace', () => {
  it('same space, same length: use', () => {
    expect(decideSpace({ spaceId: 'F.e5small', dimension: 384 }, e5, models)).toEqual({ action: 'use' });
  });
  it('treats another build of the same model as the same space', () => {
    expect(decideSpace({ model: 'intfloat/e5-small', dimension: 384 }, e5, models)).toEqual({ action: 'use' });
  });
  it('another space is left out even when the length matches', () => {
    expect(decideSpace({ spaceId: 'org/other-384', dimension: 384 }, e5, models)).toEqual({ action: 'exclude', reason: 'space-mismatch' });
  });
  it('old dictionary (no space): used when the length matches', () => {
    expect(decideSpace({ dimension: 384 }, e5, models)).toEqual({ action: 'use' });
  });
  it('old dictionary (no space): left out when the length differs', () => {
    expect(decideSpace({ dimension: 768 }, e5, models)).toEqual({ action: 'exclude', reason: 'dim-mismatch-unknown-space' });
  });
  it('same space, longer dictionary, Matryoshka: cut the dictionary', () => {
    expect(decideSpace({ spaceId: 'F.mrl', dimension: 768 }, mrl384, models)).toEqual({ action: 'truncate-kb', to: 384 });
  });
  it('same space, shorter dictionary, Matryoshka: cut the query', () => {
    expect(decideSpace({ spaceId: 'F.mrl', dimension: 384 }, mrl768, models)).toEqual({ action: 'truncate-query', to: 384 });
  });
  it('same space, different length, not Matryoshka: left out', () => {
    expect(decideSpace({ spaceId: 'F.e5small', dimension: 768 }, e5, models)).toEqual({ action: 'exclude', reason: 'dim-not-truncatable' });
  });
});

describe('decideSpace with truncation switched off', () => {
  it('leaves out a dictionary that would need cutting', () => {
    expect(decideSpace({ spaceId: 'F.mrl', dimension: 768 }, mrl384, models, false)).toEqual({ action: 'exclude', reason: 'truncation-off' });
    expect(decideSpace({ spaceId: 'F.mrl', dimension: 384 }, mrl768, models, false)).toEqual({ action: 'exclude', reason: 'truncation-off' });
  });
  it('still uses a dictionary that needs no cutting', () => {
    expect(decideSpace({ spaceId: 'F.mrl', dimension: 768 }, mrl768, models, false)).toEqual({ action: 'use' });
  });
  it('keeps the other reasons as they are', () => {
    expect(decideSpace({ spaceId: 'F.e5small', dimension: 768 }, e5, models, false)).toEqual({ action: 'exclude', reason: 'dim-not-truncatable' });
  });
});

describe('isMatryoshkaSpace', () => {
  it('is true only for a registered Matryoshka space', () => {
    expect(isMatryoshkaSpace('F.mrl', models)).toBe(true);
    expect(isMatryoshkaSpace('F.e5small', models)).toBe(false);
    expect(isMatryoshkaSpace('nothing', models)).toBe(false);
  });
});

describe('truncateAndNormalize', () => {
  it('keeps the first N values and scales them to length 1', () => {
    const out = truncateAndNormalize([3, 4, 100, 100], 2);
    expect(out).toHaveLength(2);
    expect(out[0]).toBeCloseTo(0.6);
    expect(out[1]).toBeCloseTo(0.8);
  });
  it('leaves an all-zero head as zeros', () => {
    expect(truncateAndNormalize([0, 0, 5], 2)).toEqual([0, 0]);
  });
});
