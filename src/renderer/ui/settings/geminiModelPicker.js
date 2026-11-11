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
  { key: 'id' },
  { key: 'input', direction: 'desc' },
  { key: 'tier' } // Pro first
];

// Proper names of the tiers; they are not translated. Rank 0 is the top tier, so an ascending sort puts Pro first.
const TIER_NAMES = { pro: 'Pro', flash: 'Flash', lite: 'Flash-Lite' };
const TIER_RANK = { pro: 0, flash: 1, lite: 2 };

/** "Gemini 3 series" for a family and a whole generation: the heading of a group and the label of its filter button */
function generationLabel({ family, major }) {
  return t(family === 'gemma' ? 'model_group_gemma' : 'model_group_gemini', { version: major });
}

/** What the family is: shown in its heading row (nothing for the models that belong to no family) */
function groupNote(group) {
  const series = group.major === null ? group.brand.key : group.family;
  if (series === 'gemma') return t('model_family_note_gemma');
  return series === 'gemini' ? t('model_family_note_gemini') : '';
}

function groupLabel(group) {
  if (group.major !== null) return generationLabel(group);
  // No generation number: named after the name series (an empty label means the series is not known)
  return group.brand.label ? t('model_group_series_other', { name: group.brand.label }) : t('model_group_other');
}

/** Tags of a model: NEW, what it is for (Text, Speech, ...), Preview, Thinking. Each has a stable kind for the filter. */
function tagsOf(m) {
  const tags = [];
  // The tier and the purpose are filtered from their own columns; their tags are only for the filter (the table shows them in those columns)
  tags.push({ kind: 'is-brand-' + m.brand.key, text: m.brand.label || t('model_group_other'), filterOnly: true });
  if (m.tier) tags.push({ kind: 'is-tier-' + m.tier, text: TIER_NAMES[m.tier], filterOnly: true });
  if (m.isNew) tags.push({ kind: 'is-new', text: t('model_badge_new') });
  tags.push({ kind: 'is-' + m.purpose, text: t('model_purpose_' + m.purpose), filterOnly: true });
  if (m.preview) tags.push({ kind: 'is-preview', text: t('model_badge_preview') });
  if (m.thinking) tags.push({ kind: 'is-thinking', text: t('model_badge_thinking') });
  return tags;
}

// One row per model. The name is the main text; the id column is shown with an eye button (hidden at first).
// Widths fit the text and the columns sit at the left; the spare room goes to the action column.
// The action column (favorite star and Use) is added by the part.
// Filters sit in the column headers. The name filter is the name series (Gemini, Gemma, Nano Banana, ...). One purpose and one tier per model, so several selected means any of them;
// the tier menu lists Pro > Flash > Flash-Lite. NEW, Preview and Thinking are marks in the notes column, right of the tier.
const COLUMNS = [
  { key: 'name', labelKey: 'model_col_name', width: 'auto', sort: 'name', filter: { prefix: 'is-brand-', mode: 'any' } },
  { key: 'id', labelKey: 'model_col_id', width: 'auto', toggle: true, sort: 'id' },
  { key: 'purpose', labelKey: 'model_col_purpose', width: 'auto', filter: { kinds: ['is-text', 'is-speech', 'is-image', 'is-live', 'is-other'], mode: 'any' } },
  { key: 'input', labelKey: 'model_col_input', width: 'auto', optional: true, sort: 'input' },
  { key: 'tier', labelKey: 'model_col_tier', width: 'auto', sort: 'tier', filter: { kinds: ['is-tier-pro', 'is-tier-flash', 'is-tier-lite'], mode: 'any' } },
  // Notes: the Preview, NEW and Thinking marks; no filter
  { key: 'tags', labelKey: 'model_col_notes', width: 'auto' }
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
          name: m.displayName || m.name,
          purpose: t('model_purpose_' + m.purpose),
          input: formatTokenLimit(m.inputTokenLimit),
          tier: m.tier ? (m.costGuide ? t('model_tier_cell', { tier: TIER_NAMES[m.tier], cost: t('model_cost_' + m.costGuide) }) : TIER_NAMES[m.tier]) : ''
        },
        group,
        sortValues: { name: m.displayName || m.name, id: m.name, input: m.inputTokenLimit, tier: m.tier ? TIER_RANK[m.tier] : undefined }
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
