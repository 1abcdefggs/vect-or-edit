import { describe, it, expect } from 'vitest';
import {
  REGISTRY, SHORT_TERM_MAX_LEN, EMPTY_FILTERS, filterModels, sortModels, matchesSearch, languageFit, fitRank,
  foldKana, dimensionGroup, scopeGroup, licenseToken, isActiveHidden, type PickerFilters
} from '../embeddingCatalog';

const models = REGISTRY.models;
const byId = (id: string) => models.find(m => m.id === id)!;
const search = (query: string, ctx = {}) => filterModels(models, { ...EMPTY_FILTERS, query }, ctx);
const filter = (patch: Partial<PickerFilters>) => filterModels(models, { ...EMPTY_FILTERS, ...patch });

describe('registry', () => {
  it('holds 50 models with unique ids', () => {
    expect(models).toHaveLength(50);
    expect(new Set(models.map(m => m.id)).size).toBe(50);
  });

  it('has a size for every model', () => {
    expect(models.filter(m => m.sizeMB == null)).toEqual([]);
  });

  it('counts tasks as 42 verified + 7 inferred + 1 unverified, and the task filters together cover all 50', () => {
    const count = (e: string) => models.filter(m => m.tasks.evidence === e).length;
    expect([count('verified'), count('inferred'), count('unverified')]).toEqual([42, 7, 1]);
    expect(filter({ uses: ['retrieval', 'similarity', 'code', 'unknown'] })).toHaveLength(50);
  });

  it('knows a language name for every language code it lists', () => {
    const missing = models.flatMap(m => m.languages).filter(code => !(code in REGISTRY.languageNames));
    expect(missing).toEqual([]);
  });

  it('keeps the prefixes the embedder already relies on', () => {
    expect(byId('Xenova/multilingual-e5-small').prefixes).toEqual({ query: 'query: ', passage: 'passage: ' });
  });
});

describe('search tiers', () => {
  it('"ja" matches only models with the ja code or "ja" in the id (15 of 50), never Javanese-only text', () => {
    const hits = search('ja');
    expect(hits).toHaveLength(15);
    expect(hits.every(m => m.languages.includes('ja') || m.id.toLowerCase().includes('ja'))).toBe(true);
    expect(hits.some(m => m.languages.includes('jv') && !m.languages.includes('ja'))).toBe(false);
  });

  it('keeps the short-word limit at 3', () => {
    expect(SHORT_TERM_MAX_LEN).toBe(3);
  });

  it('matches "mit" as a license token only, not inside another word', () => {
    const hits = search('mit');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every(m => licenseToken(m) === 'mit' || m.id.toLowerCase().includes('mit'))).toBe(true);
  });

  it('matches "384" as a dimension exactly', () => {
    const hits = search('384');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every(m => m.dimensions === 384 || m.id.includes('384'))).toBe(true);
  });

  it('matches "e5" by substring in the id', () => {
    const hits = search('e5');
    expect(hits.map(m => m.id)).toContain('Xenova/multilingual-e5-small');
    expect(hits.every(m => m.id.toLowerCase().includes('e5'))).toBe(true);
  });

  it('matches longer words in names and descriptions, and every word must match', () => {
    expect(search('japanese').length).toBeGreaterThan(0);
    expect(search('japanese apache').every(m => licenseToken(m) === 'apache')).toBe(true);
    expect(search('japanese zzzzzz')).toHaveLength(0);
  });

  it('uses dictionary aliases with katakana folded to hiragana, and none without a dictionary', () => {
    // "nihongo" in hiragana (the dictionary alias) and in katakana (what the user types)
    const hiragana = String.fromCharCode(0x306b, 0x307b, 0x3093, 0x3054);
    const katakana = String.fromCharCode(0x30cb, 0x30db, 0x30f3, 0x30b4);
    const aliases = { ja: [hiragana] };
    expect(search(katakana, { aliases }).length).toBe(models.filter(m => m.languages.includes('ja')).length);
    expect(search(katakana)).toHaveLength(0);
    expect(foldKana(katakana)).toBe(hiragana);
  });
});

describe('language fit and ranking', () => {
  it('classifies full, partial, none and unknown', () => {
    const e5 = byId('Xenova/multilingual-e5-small');
    const en = byId('Xenova/all-MiniLM-L6-v2');
    expect(languageFit(e5, ['en', 'ja'])).toBe('full');
    expect(languageFit(en, ['en', 'ja'])).toBe('partial');
    expect(languageFit(en, ['ja'])).toBe('none');
    expect(languageFit(byId('Xenova/bge-m3'), ['ja'])).toBe('unknown');
    expect(languageFit(en, [])).toBe('unselected');
  });

  it('ranks a model that covers the Step 1 language above any fit level without it', () => {
    const ja = byId('sirasagi62/ruri-v3-30m-ONNX');
    const e5 = byId('Xenova/multilingual-e5-small');
    expect(fitRank(ja, ['ja', 'en'], 'ja')).toBeGreaterThan(fitRank(byId('Xenova/all-MiniLM-L6-v2'), ['ja', 'en'], 'ja'));
    expect(fitRank(e5, ['ja'], 'ja')).toBe(12);
  });

  it('is a pure function of its inputs (same input, same order)', () => {
    const a = sortModels(models, 'fit', ['ja'], 'ja').map(m => m.id);
    const b = sortModels([...models].reverse(), 'fit', ['ja'], 'ja').map(m => m.id);
    expect(a).toEqual(b);
  });
});

describe('filters', () => {
  it('ORs inside a group and ANDs across groups', () => {
    const light = filter({ dimensions: ['light'] });
    const std = filter({ dimensions: ['std'] });
    expect(filter({ dimensions: ['light', 'std'] })).toHaveLength(light.length + std.length);
    const both = filter({ dimensions: ['light', 'std'], licenses: ['mit'] });
    expect(both.every(m => licenseToken(m) === 'mit' && ['light', 'std'].includes(dimensionGroup(m.dimensions)))).toBe(true);
  });

  it('partitions the models by every group', () => {
    const total = (key: 'dimensions' | 'scopes' | 'licenses', values: string[]) =>
      values.reduce((n, v) => n + filter({ [key]: [v] }).length, 0);
    expect(total('dimensions', ['light', 'std', 'large', 'na'])).toBe(50);
    expect(total('scopes', ['one', 'few', 'many', 'unknown'])).toBe(50);
    expect(total('licenses', ['apache', 'mit', 'na'])).toBe(50);
  });

  it('puts the 12 models with an unchecked dimension in the "na" group', () => {
    expect(filter({ dimensions: ['na'] }).every(m => m.dimensions == null)).toBe(true);
    expect(scopeGroup(byId('Xenova/bge-m3'))).toBe('unknown');
  });

  it('ignores "full fit only" while no language is selected, and applies it afterwards', () => {
    expect(filter({ fullOnly: true, languages: [] })).toHaveLength(50);
    const full = filter({ fullOnly: true, languages: ['ja'] });
    expect(full.length).toBeGreaterThan(0);
    expect(full.every(m => languageFit(m, ['ja']) === 'full')).toBe(true);
  });

  it('keeps only the given ids for "Downloaded only"', () => {
    const only = new Set(['Xenova/all-MiniLM-L6-v2']);
    expect(filter({ onlyIds: only }).map(m => m.id)).toEqual(['Xenova/all-MiniLM-L6-v2']);
  });

  it('reports a hidden active model', () => {
    const visible = filter({ licenses: ['apache'] });
    expect(isActiveHidden(visible, 'Xenova/bge-m3')).toBe(true);
    expect(isActiveHidden(visible, 'Xenova/all-MiniLM-L6-v2')).toBe(false);
  });
});

describe('sort', () => {
  it('puts unknown sizes and dimensions last, and breaks ties by id', () => {
    const bySize = sortModels(models, 'size');
    expect(bySize[0].sizeMB!).toBeLessThanOrEqual(bySize[1].sizeMB!);
    const byDim = sortModels(models, 'dimensions');
    expect(byDim[byDim.length - 1].dimensions).toBeNull();
    expect(sortModels(models, 'name').map(m => m.id)).toEqual(models.map(m => m.id).sort((a, b) => a.localeCompare(b)));
  });

  it('sorts by downloads, most first, with unknown last', () => {
    const list = sortModels(models, 'downloads');
    expect(list[0].id).toBe('Xenova/all-MiniLM-L6-v2');
  });
});

describe('matchesSearch', () => {
  it('matches everything for an empty query', () => {
    expect(matchesSearch(models[0], '   ')).toBe(true);
  });
});
