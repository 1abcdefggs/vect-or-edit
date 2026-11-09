/**
 * Gemini model list rules shared by main and renderer, so the checks live in one place.
 * Model ids and names come from the Gemini API and from localStorage, so both are treated as untrusted:
 * ids are limited to plain id characters, and text fields are length-capped.
 * Public surface: isValidGeminiModelId, toGeminiModelInfo, usableGeminiModels (the model to use is always the user's choice: there is no default).
 */

export interface GeminiModelInfo {
  name: string;
  displayName?: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  /** Version string from the API (for example "001"); not a release date */
  version?: string;
  /** From the API; undefined when the API does not say */
  thinking?: boolean;
  /** false for models that cannot generate content (embedding-only, etc.); the settings picker hides them */
  canGenerate: boolean;
}

const MODEL_ID_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;
const DISPLAY_NAME_MAX = 200;
const DESCRIPTION_MAX = 500;

export function isValidGeminiModelId(name: unknown): name is string {
  return typeof name === 'string' && MODEL_ID_PATTERN.test(name);
}

function cappedText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function supportsGenerateContent(raw: any): boolean {
  const actions = raw.supportedActions || raw.supportedGenerationMethods || [];
  return Array.isArray(actions) && (actions.includes('generateContent') || actions.includes('generate_content'));
}

/**
 * Maps one model entry from the API (SDK or REST) to GeminiModelInfo.
 * Returns null when the entry should not be listed: no valid id, or neither a Gemini model nor able to generate.
 */
export function toGeminiModelInfo(raw: unknown): GeminiModelInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  const entry = raw as any;
  if (typeof entry.name !== 'string') return null;
  const name = entry.name.replace(/^models\//, '');
  if (!isValidGeminiModelId(name)) return null;
  const canGenerate = supportsGenerateContent(entry);
  if (!name.includes('gemini') && !canGenerate) return null;
  return {
    name,
    displayName: cappedText(entry.displayName, DISPLAY_NAME_MAX) || name,
    description: cappedText(entry.description, DESCRIPTION_MAX),
    inputTokenLimit: finiteNumber(entry.inputTokenLimit),
    outputTokenLimit: finiteNumber(entry.outputTokenLimit),
    version: cappedText(entry.version, 50) || undefined,
    thinking: typeof entry.thinking === 'boolean' ? entry.thinking : undefined,
    canGenerate
  };
}

/** Models the app can use for text: a valid id and canGenerate not false. Returns only name and displayName. */
export function usableGeminiModels(models: unknown): Array<{ name: string; displayName: string }> {
  if (!Array.isArray(models)) return [];
  return models
    .filter((m: any) => m && isValidGeminiModelId(m.name) && m.canGenerate !== false)
    .map((m: any) => ({
      name: m.name,
      displayName: cappedText(m.displayName, DISPLAY_NAME_MAX)
    }));
}

// ---------------------------------------------------------------------------------------------
// Grouping and marks for the settings picker. Everything here is read from the API fields and the model id;
// the API returns no price and no release date, so neither is shown (a price table would go stale).
// ---------------------------------------------------------------------------------------------

export type GeminiFamily = 'gemini' | 'gemma' | 'other';
export type GeminiPurpose = 'text' | 'speech' | 'image' | 'live' | 'other';
/** Capability and cost step of a Gemini model, read from the id: Pro > Flash > Flash-Lite */
export type GeminiTier = 'pro' | 'flash' | 'lite';
/** Rough cost guide taken from the tier in the id (Pro > Flash > Flash-Lite); not an amount */
export type GeminiCostGuide = 'high' | 'standard' | 'low' | null;

/** The name series of a model for the name filter (Gemini, Gemma, Nano Banana, ...). An empty label means "other": the caller words it. */
export interface GeminiBrand {
  /** Plain characters only (a-z, 0-9, "-"), so it is safe inside a tag kind */
  key: string;
  label: string;
}

export interface GeminiModelView {
  name: string;
  displayName: string;
  family: GeminiFamily;
  brand: GeminiBrand;
  /** Whole number of the generation ("3" for 3.1), or null when the id has none (aliases such as -latest) */
  major: number | null;
  /** Generation as a number (3.1), or null */
  generation: number | null;
  /** Null for models without a tier in the id (Gemma, aliases, and so on) */
  tier: GeminiTier | null;
  costGuide: GeminiCostGuide;
  purpose: GeminiPurpose;
  preview: boolean;
  thinking: boolean;
  inputTokenLimit?: number;
  /** Newest generation of the Gemini text models */
  isNew: boolean;
}

export interface GeminiModelGroup {
  key: string;
  family: GeminiFamily;
  /** The name series of the first model; for a group without a generation it is what the group is named after */
  brand: GeminiBrand;
  major: number | null;
  models: GeminiModelView[];
}

const GENERATION_PATTERN = /^(gemini|gemma)-(\d+(?:\.\d+)?)/;

function purposeOf(name: string): GeminiPurpose {
  if (/(^|-)(tts|transcribe)(-|$)/.test(name)) return 'speech';
  if (/(^|-)image(-|$)/.test(name)) return 'image';
  if (/(^|-)(live|native-audio|audio)(-|$)/.test(name)) return 'live';
  if (/(computer-use|robotics)/.test(name)) return 'other';
  return 'text';
}

/**
 * The name series, read from the display name and the id. Nano Banana models have a Gemini id, so they are checked first.
 * A series that the app does not know takes the first word of its display name, so the filter does not need an update for it.
 */
export function brandOf(name: string, displayName: string): GeminiBrand {
  if (/nano[\s-]*banana/i.test(displayName) || /^gemini-.*-image(-|$)/.test(name)) return { key: 'nano-banana', label: 'Nano Banana' };
  if (name.startsWith('gemma')) return { key: 'gemma', label: 'Gemma' };
  if (name.startsWith('gemini')) return { key: 'gemini', label: 'Gemini' };
  const word = displayName.trim().split(/\s+/)[0] ?? '';
  const key = word.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return key ? { key, label: word } : { key: 'other', label: '' };
}

function tierRank(name: string): number {
  if (/(^|-)pro(-|$)/.test(name)) return 0;
  if (/flash-lite/.test(name)) return 2;
  if (/(^|-)flash(-|$)/.test(name)) return 1;
  return 3;
}

function tierOf(name: string, family: GeminiFamily): GeminiTier | null {
  if (family !== 'gemini') return null;
  const rank = tierRank(name);
  return rank === 0 ? 'pro' : rank === 1 ? 'flash' : rank === 2 ? 'lite' : null;
}

const COST_OF_TIER: Record<GeminiTier, GeminiCostGuide> = { pro: 'high', flash: 'standard', lite: 'low' };

/** Compact size for a token limit: 1048576 -> "1M", 200000 -> "200K" */
export function formatTokenLimit(n: number | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return '';
  if (n >= 1_000_000) return `${Number((n / 1_000_000).toFixed(1))}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

/** Usable models, grouped by family and generation, newest first. Hidden models (canGenerate false) are not in the result. */
export function groupGeminiModels(models: unknown): GeminiModelGroup[] {
  if (!Array.isArray(models)) return [];
  const views: GeminiModelView[] = [];
  for (const m of models as any[]) {
    if (!m || !isValidGeminiModelId(m.name) || m.canGenerate === false) continue;
    const match = GENERATION_PATTERN.exec(m.name);
    const family: GeminiFamily = match ? (match[1] as GeminiFamily) : 'other';
    const generation = match ? parseFloat(match[2]) : null;
    const displayName = cappedText(m.displayName, DISPLAY_NAME_MAX);
    views.push({
      name: m.name,
      displayName,
      family,
      brand: brandOf(m.name, displayName),
      major: generation === null ? null : Math.floor(generation),
      generation,
      tier: tierOf(m.name, family),
      costGuide: (() => { const tier = tierOf(m.name, family); return tier ? COST_OF_TIER[tier] : null; })(),
      purpose: purposeOf(m.name),
      preview: /(^|-)(preview|exp)(-|$)/.test(m.name),
      thinking: m.thinking === true,
      inputTokenLimit: finiteNumber(m.inputTokenLimit),
      isNew: false
    });
  }

  const geminiTextGenerations = views
    .filter((v) => v.family === 'gemini' && v.purpose === 'text' && v.generation !== null)
    .map((v) => v.generation as number);
  const newest = geminiTextGenerations.length ? Math.max(...geminiTextGenerations) : null;
  for (const v of views) {
    v.isNew = newest !== null && v.family === 'gemini' && v.purpose === 'text' && v.generation === newest;
  }

  const familyRank = (f: GeminiFamily) => (f === 'gemini' ? 0 : f === 'gemma' ? 1 : 2);
  const compare = (a: GeminiModelView, b: GeminiModelView) =>
    Number(a.purpose !== 'text') - Number(b.purpose !== 'text') ||
    (b.generation ?? -1) - (a.generation ?? -1) ||
    tierRank(a.name) - tierRank(b.name) ||
    Number(a.preview) - Number(b.preview) ||
    a.name.localeCompare(b.name);

  const groups = new Map<string, GeminiModelGroup>();
  for (const v of views) {
    // Models without a generation number are grouped by their name series, not into one "other" group
    const key = v.major === null ? `other-${v.brand.key}` : `${v.family}-${v.major}`;
    if (!groups.has(key)) groups.set(key, { key, family: v.major === null ? 'other' : v.family, brand: v.brand, major: v.major, models: [] });
    groups.get(key)!.models.push(v);
  }
  const result = [...groups.values()];
  for (const g of result) g.models.sort(compare);
  // Groups without a generation come last: the ones with a known series first (by name), the unknown series at the very end
  const brandRank = (x: GeminiModelGroup) => (x.brand.key === 'other' ? 1 : 0);
  result.sort((a, b) => familyRank(a.family) - familyRank(b.family) || (b.major ?? -1) - (a.major ?? -1) || brandRank(a) - brandRank(b) || a.brand.key.localeCompare(b.brand.key));
  return result;
}
