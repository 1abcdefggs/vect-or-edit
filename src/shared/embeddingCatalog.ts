/**
 * Pure logic of the embedding model picker: language fit, ranking, filters and search.
 * It reads the registry (embeddingRegistry.json, the one source of the model data) and holds no UI, Electron or storage code,
 * so the renderer and the tests use the same functions. Every result is a function of its arguments only.
 */
import registryData from './embeddingRegistry.json';

export type TaskKey = 'retrieval' | 'similarity' | 'code';
export type TaskEvidence = 'verified' | 'inferred' | 'unverified';
export type LanguageFit = 'full' | 'partial' | 'none' | 'unknown' | 'unselected';

export interface EmbeddingModelEntry {
  id: string;
  /** null: not checked against the model card yet */
  dimensions: number | null;
  sizeMB: number | null;
  /** Language codes from the model card. Empty when the card gives no list (see languageNote) */
  languages: string[];
  languageNote: string | null;
  blurb: string;
  /** An empty list with evidence "unverified" means not stated, not unsupported */
  tasks: { list: TaskKey[]; evidence: TaskEvidence };
  /** repo: the converted repo's own license field; original: the original model's license, shown separately */
  license: { repo: string | null; original: string | null; /** Date both were compared with the Hugging Face pages; absent: not compared, or no license is stated there */ verifiedAt?: string | null };
  downloadsMonthly: number | null;
  prefixes: { query: string; passage: string } | null;
  maxTokens: number | null;
  crossLingual: boolean | null;
  sourceUrls: { model: string };
  checkedAt: string;
}

export interface EmbeddingRegistry {
  checkedAt: string;
  languageNames: Record<string, string>;
  models: EmbeddingModelEntry[];
}

export const REGISTRY = registryData as EmbeddingRegistry;

/**
 * Search words up to this length are "short": they match the model id by substring, and language codes, license tokens
 * and dimensions exactly. Never lower it to 2 or 1, and never make the short tier a substring match:
 * "ja" would match Javanese ("jv") and any text with "ja" inside a word again.
 */
export const SHORT_TERM_MAX_LEN = 3;

/** Upper bounds (inclusive) of the dimension groups, smallest first; a larger value falls in the last group */
export const DIMENSION_GROUPS: ReadonlyArray<{ key: string; max: number }> = [
  { key: 'light', max: 512 },
  { key: 'std', max: 768 },
  { key: 'large', max: Infinity }
];

/** Upper bounds (inclusive) of the language-count groups; one language is its own group */
export const SCOPE_GROUPS: ReadonlyArray<{ key: string; max: number }> = [
  { key: 'one', max: 1 },
  { key: 'few', max: 9 },
  { key: 'many', max: Infinity }
];

/** How many covered languages a row lists before "…" */
export const LANGUAGE_LIST_LIMIT = 10;

/** Language chips shown without searching, after the Step 1 language */
export const QUICK_LANGUAGE_CODES: readonly string[] = ['en', 'ja', 'zh', 'ko', 'de', 'fr', 'es', 'pt', 'it', 'ru', 'ar', 'hi'];

/** How many matches the "+ More" language search lists */
export const MORE_LANGUAGE_RESULTS = 12;

/** Content languages before the user picks any: only the display language (English when the display language is English) */
export function defaultContentLanguages(displayLanguage: string): string[] {
  return [displayLanguage || 'en'];
}

/** Covered languages, the selected ones first, cut at LANGUAGE_LIST_LIMIT */
export function languageLine(model: EmbeddingModelEntry, selected: readonly string[]): { shown: string[]; more: boolean } {
  const ordered = model.languages.filter(c => selected.includes(c)).concat(model.languages.filter(c => !selected.includes(c)));
  return { shown: ordered.slice(0, LANGUAGE_LIST_LIMIT), more: ordered.length > LANGUAGE_LIST_LIMIT };
}

/** Weight of the Step 1 (display) language in the fit ranking, above any fit level */
const PRIMARY_LANGUAGE_BONUS = 10;
const FIT_RANK: Record<LanguageFit, number> = { full: 2, partial: 1, unknown: 0.5, none: 0, unselected: 0 };

export function dimensionGroup(dimensions: number | null): string {
  if (dimensions == null) return 'na';
  return DIMENSION_GROUPS.find(g => dimensions <= g.max)!.key;
}

export function scopeGroup(model: EmbeddingModelEntry): string {
  const n = model.languages.length;
  if (n === 0) return 'unknown';
  return SCOPE_GROUPS.find(g => n <= g.max)!.key;
}

/** The license as a filter token: lower case, version dropped ("Apache-2.0" -> "apache"); "na" when none is stated */
export function licenseToken(model: EmbeddingModelEntry): string {
  const name = model.license.repo ?? model.license.original;
  return name ? name.toLowerCase().split(/[-\s]/)[0] : 'na';
}

export function languageFit(model: EmbeddingModelEntry, selected: readonly string[]): LanguageFit {
  if (model.languages.length === 0) return 'unknown';
  if (selected.length === 0) return 'unselected';
  const hit = selected.filter(code => model.languages.includes(code)).length;
  return hit === selected.length ? 'full' : hit === 0 ? 'none' : 'partial';
}

/** Higher ranks first: the Step 1 language covered, then Full > Partial > Unknown > None */
export function fitRank(model: EmbeddingModelEntry, selected: readonly string[], primary: string): number {
  const covered = selected.includes(primary) && model.languages.includes(primary);
  return (covered ? PRIMARY_LANGUAGE_BONUS : 0) + FIT_RANK[languageFit(model, selected)];
}

/** Katakana block that has a hiragana twin (small A to small KE), and the distance between the two blocks */
const KATAKANA_FIRST = 0x30a1;
const KATAKANA_LAST = 0x30f6;
const KATAKANA_TO_HIRAGANA = 0x60;

/** Katakana folded to hiragana, lower case, so a name typed in either script matches */
export function foldKana(text: string): string {
  return Array.from(text.toLowerCase(), ch => {
    const code = ch.charCodeAt(0);
    return code >= KATAKANA_FIRST && code <= KATAKANA_LAST ? String.fromCharCode(code - KATAKANA_TO_HIRAGANA) : ch;
  }).join('');
}

export interface SearchContext {
  /** UI-language aliases per language code, from the i18n dictionary. Missing or empty: no aliases */
  aliases?: Readonly<Record<string, readonly string[]>>;
}

/** Every word must match (AND). See SHORT_TERM_MAX_LEN for the two tiers. */
export function matchesSearch(model: EmbeddingModelEntry, query: string, ctx: SearchContext = {}): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const aliases = ctx.aliases ?? {};
  const id = model.id.toLowerCase();
  const dimension = model.dimensions == null ? '' : String(model.dimensions);
  const licenseText = model.license.repo ?? model.license.original ?? '';
  const token = licenseToken(model);
  const haystack = [
    model.id,
    model.blurb,
    model.languages.map(code => REGISTRY.languageNames[code] ?? '').join(' '),
    licenseText,
    dimension ? `${dimension}-dim` : '',
    model.languageNote ?? ''
  ].join(' ').toLowerCase();
  const aliasText = model.languages.map(code => (aliases[code] ?? []).map(foldKana).join(' ')).join(' ');
  return terms.every(term => {
    const direct = term.length <= SHORT_TERM_MAX_LEN
      ? id.includes(term) || model.languages.includes(term) || token === term || dimension === term
      : haystack.includes(term);
    return direct || (aliasText !== '' && aliasText.includes(foldKana(term)));
  });
}

export interface PickerFilters {
  /** Languages the user's content is in, as codes */
  languages: readonly string[];
  /** Keep only models whose language list covers every selected language. Ignored while no language is selected */
  fullOnly: boolean;
  /** Keep only these model ids ("Downloaded only"); null means no such filter */
  onlyIds: ReadonlySet<string> | null;
  dimensions: readonly string[];
  scopes: readonly string[];
  /** Task keys, plus "unknown" for models whose tasks are unverified */
  uses: readonly string[];
  licenses: readonly string[];
  query: string;
}

export const EMPTY_FILTERS: PickerFilters = {
  languages: [], fullOnly: false, onlyIds: null, dimensions: [], scopes: [], uses: [], licenses: [], query: ''
};

/** AND across groups, OR within a group. An empty group does not filter. */
export function filterModels(models: readonly EmbeddingModelEntry[], f: PickerFilters, ctx: SearchContext = {}): EmbeddingModelEntry[] {
  return models.filter(m => {
    if (f.fullOnly && f.languages.length > 0 && languageFit(m, f.languages) !== 'full') return false;
    if (f.onlyIds && !f.onlyIds.has(m.id)) return false;
    if (f.dimensions.length > 0 && !f.dimensions.includes(dimensionGroup(m.dimensions))) return false;
    if (f.scopes.length > 0 && !f.scopes.includes(scopeGroup(m))) return false;
    if (f.uses.length > 0) {
      const unverified = m.tasks.evidence === 'unverified';
      if (!(f.uses.includes('unknown') && unverified) && !m.tasks.list.some(t => f.uses.includes(t))) return false;
    }
    if (f.licenses.length > 0 && !f.licenses.includes(licenseToken(m))) return false;
    return matchesSearch(m, f.query, ctx);
  });
}

export type SortKey = 'fit' | 'downloads' | 'dimensions' | 'size' | 'name';

/** Returns a new array. Ties fall back to the model id, so the order is stable. */
export function sortModels(
  models: readonly EmbeddingModelEntry[],
  key: SortKey,
  selected: readonly string[] = [],
  primary = ''
): EmbeddingModelEntry[] {
  const small = (v: number | null) => (v == null ? Infinity : v);
  const downloads = (m: EmbeddingModelEntry) => m.downloadsMonthly ?? -1;
  return [...models].sort((a, b) => {
    if (key === 'fit') {
      const d = fitRank(b, selected, primary) - fitRank(a, selected, primary);
      if (d !== 0) return d;
    }
    if (key === 'size' && small(a.sizeMB) !== small(b.sizeMB)) return small(a.sizeMB) - small(b.sizeMB);
    if (key === 'dimensions' && small(a.dimensions) !== small(b.dimensions)) return small(a.dimensions) - small(b.dimensions);
    if ((key === 'downloads' || key === 'fit') && downloads(a) !== downloads(b)) return downloads(b) - downloads(a);
    return a.id.localeCompare(b.id);
  });
}

/** True when the active model is hidden by the current filters, so the picker can say so */
export function isActiveHidden(visible: readonly EmbeddingModelEntry[], activeId: string): boolean {
  return !visible.some(m => m.id === activeId);
}
