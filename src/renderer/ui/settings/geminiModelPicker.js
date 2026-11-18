/**
 * Gemini model picker in Settings: the shared model list part filled with Gemini models.
 * The full list from the Gemini API is kept by the caller; this picker shows only models that can generate content,
 * so a user does not search for a model that the app cannot use.
 * Grouping, order and marks come from shared/geminiModels.ts (API fields and the id only: no price, no release date);
 * drawing, search and sort come from ui/components/modelList.js.
 * Public surface: createGeminiModelPicker(container, { onChange }) -> { setModels, setValue, getValue, visibleCount },
 * plus rememberGeminiModels, the one place that writes the model list cache.
 */
import { t } from '../../core/i18n.js';
import { readStorage, writeStorage } from '../../core/storage.js';
import { STORAGE_KEYS } from '../../core/constants.js';
import { createModelList } from '../components/modelList.js';
import { isValidGeminiModelId, usableGeminiModels, groupGeminiModels, formatTokenLimit } from '../../../shared/geminiModels';

export { isValidGeminiModelId, usableGeminiModels };

const MODEL_CACHE_KEY = 'cached_gemini_models';

/**
 * The one place that writes the model list cache. Keeps the full list (the picker hides unusable models)
 * and returns the usable models in display order, so every caller counts and picks from the same list.
 * A blocked storage must not lose the list for this session, so the write failure is swallowed.
 */
export function rememberGeminiModels(models) {
  const usable = groupGeminiModels(models).flatMap((g) => g.models); // display order: the first is the newest text model
  try {
    writeStorage(MODEL_CACHE_KEY, JSON.stringify(models));
  } catch (_) { /* cache is optional */ }
  return usable;
}

// The recommended order has a chip; the other orders are chosen by pressing a column header
const SORTS = [
  { key: 'recommended', labelKey: 'model_sort_recommended', grouped: true },
  { key: 'name' },
  { key: 'input', direction: 'desc' },
  { key: 'tier' } // high cost (Pro) first
];

// Rank 0 is the top tier, so an ascending sort puts the high cost (Pro) first.
// The table shows the cost guide, not the tier name: the tier name (Flash, Pro) is already in the model name.
const TIER_RANK = { pro: 0, flash: 1, lite: 2 };

/** "1M / 64K": the input limit, then the output limit; one side may be empty when the API leaves it out */
function limitsCell(m) {
  const input = formatTokenLimit(m.inputTokenLimit);
  const output = formatTokenLimit(m.outputTokenLimit);
  if (!input && !output) return '';
  return `${input || '–'} / ${output || '–'}`;
}

/** Series that have no generation number but are known by name: their heading drops "(other)" */
const NAMED_SERIES = new Set(['omni', 'deep-research', 'nano-banana', 'lyria']);

/** "Gemini 3 series" for a family and a whole generation: the heading of a group and the label of its filter button */
function generationLabel({ family, major }) {
  return t(family === 'gemma' ? 'model_group_gemma' : 'model_group_gemini', { version: major });
}

/** What the family is: shown in its heading row (nothing for the models that belong to no family) */
function groupNote(group) {
  const series = group.major === null ? group.brand.key : group.family;
  if (series === 'gemma') return t('model_family_note_gemma');
  if (series === 'gemini') return t('model_family_note_gemini');
  // A named series says what it makes, so a name such as Lyria or Omni is not a puzzle (owner, 2026-11-18)
  return NAMED_SERIES.has(series) ? t('model_family_note_' + series.replace(/-/g, '_')) : '';
}

function groupLabel(group) {
  if (group.major !== null) return generationLabel(group);
  // A known series of its own, not "other": all its models (numbered or not) are one group, "Gemini Omni series"
  if (NAMED_SERIES.has(group.brand.key)) return t('model_group_series', { name: group.brand.label });
  // No generation number: named after the name series (an empty label means the series is not known)
  return group.brand.label ? t('model_group_series_other', { name: group.brand.label }) : t('model_group_other');
}

/**
 * Tags of a model: NEW, what it is for (Text, Speech, ...), Thinking. Each has a stable kind for the filter.
 * No Preview mark: "preview" is already in the id and the name (owner, 2026-11-18).
 */
function tagsOf(m) {
  const tags = [];
  // The tier and the purpose are filtered from their own columns; their tags are only for the filter (the table shows them in those columns)
  tags.push({ kind: 'is-brand-' + m.brand.key, text: m.brand.label || t('model_group_other'), filterOnly: true });
  if (m.tier && m.costGuide) tags.push({ kind: 'is-tier-' + m.tier, text: t('model_cost_' + m.costGuide), filterOnly: true });
  if (m.isNew) tags.push({ kind: 'is-new', text: t('model_badge_new') });
  tags.push({ kind: 'is-' + m.purpose, text: t('model_purpose_' + m.purpose), filterOnly: true });
  if (m.thinking) tags.push({ kind: 'is-thinking', text: t('model_badge_thinking') });
  // Latest crosses the series (Gemini, Antigravity, ...), so it is a mark, not a group
  if (m.latest) tags.push({ kind: 'is-latest', text: t('model_badge_latest') });
  return tags;
}

// One row per model. The name is the main text; the id column is shown with an eye button (hidden at first).
// The name column is the widest and its header is the search field. The action column (favorite star and Use) is added by the part.
// Filters sit in the column headers. The name filter is the name series (Gemini, Gemma, Nano Banana, ...). One purpose and one cost per model, so several selected means any of them;
// the cost menu lists high > standard > low. NEW, Thinking and Latest are marks in the notes column, left of the cost.
// Each header has a hint (its tooltip) that says what the column means, so a short label such as "入力 / 出力" is enough.
const COLUMNS = [
  // The short-value columns (purpose, limits, cost) are exactly as wide as their longest text: a word such as "テキスト"
  // is not broken over two lines, and they take no spare room (owner, 2026-11-18, at about 1300px). The spare room goes
  // to the name, id and notes. The name column's minimum fits the search placeholder with the sort and filter buttons.
  { key: 'name', labelKey: 'model_col_name', hintKey: 'model_col_name_hint', width: 'minmax(16rem, 2.8fr)', search: true, keepGroups: true, sort: 'name', filter: { prefix: 'is-brand-', mode: 'any' } },
  // The model ID is a second line under the name, not a column: the name and the id are read together and the table
  // gets no extra column (owner, 2026-11-19). The ID button right of the search field shows or hides it.
  { key: 'id', labelKey: 'model_col_id', beneath: 'name', toggle: true, toggleLabelKey: 'model_col_id_short' },
  { key: 'purpose', labelKey: 'model_col_purpose', hintKey: 'model_col_purpose_hint', width: 'max-content', filter: { kinds: ['is-text', 'is-speech', 'is-image', 'is-video', 'is-music', 'is-live', 'is-other'], mode: 'any' } },
  { key: 'input', labelKey: 'model_col_input', hintKey: 'model_col_input_hint', width: 'max-content', optional: true, sort: 'input' },
  // Notes: the NEW, Thinking and Latest marks; its filter shows the models with any of the chosen marks
  { key: 'tags', labelKey: 'model_col_notes', hintKey: 'model_col_notes_hint', width: 'minmax(7rem, 1.6fr)', filter: { kinds: ['is-new', 'is-thinking', 'is-latest'], mode: 'any' } },
  // The cost is the last column, right before the star and Use: the cost is in sight when Use is pressed (owner, 2026-11-19)
  { key: 'tier', labelKey: 'model_col_cost', hintKey: 'model_col_cost_hint', width: 'max-content', sort: 'tier', filter: { kinds: ['is-tier-pro', 'is-tier-flash', 'is-tier-lite'], mode: 'any' } }
];
const TOGGLE_KEYS = COLUMNS.filter((c) => c.toggle).map((c) => c.key);

/** Which toggle columns are shown: only known column keys are accepted from storage */
function loadShownColumns() {
  try {
    const parsed = JSON.parse(readStorage(STORAGE_KEYS.GEMINI_MODEL_LIST_COLUMNS) || '[]');
    return Array.isArray(parsed) ? parsed.filter((key) => TOGGLE_KEYS.includes(key)) : [];
  } catch (_) {
    return [];
  }
}

function saveShownColumns(keys) {
  try {
    writeStorage(STORAGE_KEYS.GEMINI_MODEL_LIST_COLUMNS, JSON.stringify(keys.filter((key) => TOGGLE_KEYS.includes(key))));
  } catch (_) { /* storage blocked: the choice works for this session only */ }
}

const FAVORITES_MAX = 200;

/** Favorite ids come from localStorage: keep only plain ids, once each, and cap the count */
function loadFavorites() {
  try {
    const parsed = JSON.parse(readStorage(STORAGE_KEYS.GEMINI_FAVORITE_MODELS) || '[]');
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter(isValidGeminiModelId))].slice(0, FAVORITES_MAX);
  } catch (_) {
    return [];
  }
}

function saveFavorites(ids) {
  try {
    writeStorage(STORAGE_KEYS.GEMINI_FAVORITE_MODELS, JSON.stringify(ids.filter(isValidGeminiModelId).slice(0, FAVORITES_MAX)));
  } catch (_) { /* storage blocked: the favorites work for this session only */ }
}

/** In the list the family heading already says Gemini, so a row drops the leading "Gemini " ("Gemini 3.8 Flash" shows as "3.8 Flash"). Other names are kept. */
function shortName(name) {
  const short = name.replace(/^Gemini\s+/i, '');
  return short || name;
}

export function createGeminiModelPicker(container, { onChange } = {}) {
  let lastModels = [];
  let flat = []; // models in display order, headings excluded
  let selected = '';

  const list = createModelList(container, {
    columns: COLUMNS,
    sorts: SORTS,
    noticeKeys: ['model_list_guide', 'model_list_free_plan_note'],
    favorites: { ids: loadFavorites(), onChange: saveFavorites },
    columnPrefs: { shown: loadShownColumns(), onChange: saveShownColumns },
    // A text editor: only text models are listed at first; the other purposes are one press away
    defaultTags: ['is-text'],
    onUse: (name) => {
      selected = name;
      if (onChange) onChange(name);
    },
    // The choice is taken back: nothing is in use until the user chooses again
    onClear: () => {
      selected = '';
      if (onChange) onChange('');
    }
  });

  function draw() {
    const groups = groupGeminiModels(lastModels);
    flat = groups.flatMap((g) => g.models);
    // Nothing is chosen for the user: a selection that is not in the list is dropped, and no row is in use until one is chosen
    if (!flat.some((m) => m.name === selected)) selected = '';
    const items = groups.flatMap((g) => {
      const group = { key: g.key, label: groupLabel(g), note: groupNote(g) };
      return g.models.map((m) => ({
        id: m.name,
        tags: tagsOf(m),
        cells: {
          name: shortName(m.displayName || m.name),
          purpose: t('model_purpose_' + m.purpose),
          input: limitsCell(m),
          tier: m.costGuide ? t('model_cost_' + m.costGuide) : ''
        },
        // Google's description of the model (English, as the API gives it) is the tooltip of its name (owner, 2026-11-19)
        hints: m.description ? { name: m.description } : undefined,
        group,
        sortValues: { name: m.displayName || m.name, input: m.inputTokenLimit, tier: m.tier ? TIER_RANK[m.tier] : undefined }
      }));
    });
    list.setItems(items, selected);
  }

  // Group names, marks and cost guides are words, so a language change redraws them
  window.addEventListener('app:languageChanged', draw);

  return {
    /** Replaces the list with the usable models from the full list; keeps the current selection when it is still there. */
    setModels(models) {
      lastModels = Array.isArray(models) ? models : [];
      draw();
    },
    /** Selects a model without notifying; used when restoring the saved choice. An empty name clears the choice. */
    setValue(name) {
      if (name && !flat.some((m) => m.name === name)) return;
      selected = name;
      list.setActive(name);
    },
    getValue() {
      return selected;
    },
    visibleCount() {
      return flat.length;
    }
  };
}
