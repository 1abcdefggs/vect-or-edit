/**
 * Embedding model picker in Settings: content languages, license, filters, sort, search and the model list.
 * The model data and every rule (fit, ranking, filters, search) come from src/shared/embeddingCatalog.ts;
 * this file only keeps the picker state and draws it. The controls are built once, so the search fields keep focus;
 * each change redraws the chips and the list.
 * Download fetches the model files only; Use switches the active model. Only models in EMBEDDING_MODELS
 * (verified prefixes) can be downloaded or used; the others are listed for comparison.
 */
import { i18n, t, currentLang } from '../../core/i18n.js';
import { STORAGE_KEYS } from '../../core/constants.js';
import { EMBEDDING_MODELS, getActiveModelId, getDownloadedModelIds } from '../../search/embeddingModels.js';
import { requestEmbeddingModelDownload } from '../../search/searchLocalAi.js';
import {
  REGISTRY, EMPTY_FILTERS, QUICK_LANGUAGE_CODES, MORE_LANGUAGE_RESULTS,
  filterModels, sortModels, languageFit, languageLine, isActiveHidden, defaultContentLanguages, foldKana
} from '../../../shared/embeddingCatalog';

/** modelId -> download percentage, for models being fetched right now */
const downloading = new Map();
const RUNNABLE = new Set(EMBEDDING_MODELS.map(m => m.id));

const LICENSES = [['apache', 'Apache-2.0', 'ep_lic_apache_note'], ['mit', 'MIT', 'ep_lic_mit_note'], ['na', null, 'ep_lic_na_note']];
const DIMENSIONS = [['light', '≤512'], ['std', '768'], ['large', '≥1024'], ['na', null]];
const SCOPES = [['one', 'ep_scope_one'], ['few', 'ep_scope_few'], ['many', 'ep_scope_many'], ['unknown', 'ep_unknown']];
const USES = [['retrieval', 'ep_task_retrieval'], ['similarity', 'ep_task_similarity'], ['code', 'ep_task_code'], ['unknown', 'ep_task_unverified']];
const SORTS = [['fit', 'ep_sort_fit'], ['downloads', 'ep_sort_downloads'], ['dimensions', 'ep_sort_dimensions'], ['size', 'ep_sort_size'], ['name', 'ep_sort_name']];
const FIT_KEYS = { full: 'ep_fit_full', partial: 'ep_fit_partial', none: 'ep_fit_none', unknown: 'ep_fit_check', unselected: 'ep_fit_unselected' };

/** One picker per container: its state and the nodes that are redrawn */
const pickers = new WeakMap();

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.EMBEDDING_PICKER_PREFS);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function savePrefs(state) {
  try {
    localStorage.setItem(STORAGE_KEYS.EMBEDDING_PICKER_PREFS, JSON.stringify({ languages: state.languages, extra: state.extra, sort: state.sort }));
  } catch {
    // Storage unavailable: the picker works, the choices are only not remembered.
  }
}

function initialState() {
  const prefs = loadPrefs();
  return {
    languages: Array.isArray(prefs.languages) ? prefs.languages : defaultContentLanguages(currentLang),
    extra: Array.isArray(prefs.extra) ? prefs.extra : [],
    sort: SORTS.some(([k]) => k === prefs.sort) ? prefs.sort : 'fit',
    fullOnly: false, downloadedOnly: false, dimensions: [], scopes: [], uses: [], licenses: [], query: '',
    langsOpen: false, moreOpen: false, moreQuery: '', moreFilters: false
  };
}

/** Language name in the UI language, from the dictionary (content_lang_<code>); the registry's English name otherwise */
function langName(code) {
  return i18n[`content_lang_${code}`] || REGISTRY.languageNames[code] || code;
}

/** Aliases for search: the UI-language names from the dictionary. No dictionary entries, no aliases */
function searchAliases() {
  const aliases = {};
  for (const [key, value] of Object.entries(i18n)) {
    if (key.startsWith('content_lang_')) aliases[key.slice('content_lang_'.length)] = [value];
  }
  return aliases;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, onClick, className = 'ep-chip') {
  const btn = el('button', className, label);
  btn.type = 'button';
  btn.addEventListener('click', onClick);
  return btn;
}

function chip(label, on, onClick) {
  const btn = button(label, onClick);
  btn.setAttribute('aria-pressed', String(on));
  return btn;
}

function row(labelKey) {
  const wrap = el('div', 'ep-row');
  wrap.append(el('div', 'ep-row-label', t(labelKey)));
  const body = el('div', 'ep-row-body');
  wrap.append(body);
  return { wrap, body };
}

function formatCount(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e4) return `${Math.round(n / 1e3)}K`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

function toggleIn(list, value) {
  return list.includes(value) ? list.filter(x => x !== value) : list.concat([value]);
}

function licenseText(model) {
  if (model.license.repo) return model.license.repo;
  if (model.license.original) return t('ep_lic_original', { name: model.license.original });
  return t('ep_lic_not_stated');
}

function taskText(model) {
  if (model.tasks.evidence === 'unverified') return t('ep_tasks_unverified');
  const list = model.tasks.list.map(k => t(`ep_task_${k}`)).join(', ');
  return t('ep_tasks', { list }) + (model.tasks.evidence === 'inferred' ? t('ep_tasks_inferred') : '');
}

function langText(model, selected) {
  const n = model.languages.length;
  if (n === 0) return model.languageNote || t('ep_lang_unconfirmed');
  const { shown, more } = languageLine(model, selected);
  const list = shown.join(' ') + (more ? ' …' : '');
  return t(n === 1 ? 'ep_language_one' : 'ep_languages_n', { n, list });
}

function stateCell(model, ctx) {
  const cell = el('div', 'ep-state');
  const downloaded = ctx.downloadedIds.has(model.id);
  if (model.id === ctx.activeId) {
    cell.append(el('span', 'ep-badge ep-badge-active', t('ep_active')));
  } else if (downloading.has(model.id)) {
    const pct = downloading.get(model.id);
    cell.append(el('span', 'ep-progress-text', `${pct}%`));
    const bar = el('div', 'ep-progress');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuenow', String(pct));
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    const fill = el('div', 'ep-progress-fill');
    fill.style.width = `${pct}%`;
    bar.append(fill);
    cell.append(bar);
  } else if (!RUNNABLE.has(model.id)) {
    const off = el('span', 'ep-unavailable', t('ep_not_runnable'));
    off.title = t('ep_not_runnable_tip');
    cell.append(off);
  } else if (downloaded) {
    cell.append(button(t('ep_btn_use'), () => ctx.onUse(model.id), 'ep-chip ep-action is-primary'));
  } else {
    cell.append(button(t('ep_btn_download'), () => {
      downloading.set(model.id, 0);
      requestEmbeddingModelDownload(model.id);
      ctx.redraw();
    }, 'ep-chip ep-action'));
  }
  if (downloaded && model.id !== ctx.activeId && !downloading.has(model.id)) {
    cell.append(el('span', 'ep-downloaded', t('ep_downloaded')));
  }
  return cell;
}

function modelCard(model, ctx) {
  const card = el('div', 'ep-card');
  card.dataset.modelId = model.id;
  if (model.id === ctx.activeId) card.classList.add('is-active');
  if (downloading.has(model.id)) card.classList.add('is-loading');

  const main = el('div', 'ep-card-main');
  main.append(el('div', 'ep-model-id', model.id));
  const meta = [
    model.dimensions ? t('ep_dim', { n: model.dimensions }) : '—',
    model.sizeMB ? `~${model.sizeMB} MB` : '— MB',
    model.downloadsMonthly ? t('ep_downloads_month', { n: formatCount(model.downloadsMonthly) }) : null,
    licenseText(model)
  ].filter(Boolean).join(' · ');
  main.append(el('div', 'ep-meta', meta));
  main.append(el('div', 'ep-meta', taskText(model)));
  main.append(el('div', 'ep-blurb', model.blurb));
  main.append(el('div', 'ep-langs', langText(model, ctx.state.languages)));

  const fit = languageFit(model, ctx.state.languages);
  const fitCell = el('div', 'ep-fit');
  fitCell.append(el('span', `ep-fit-badge is-${fit}`, t(FIT_KEYS[fit])));

  card.append(main, fitCell, stateCell(model, ctx));
  return card;
}

/** Builds the controls once; returns the redraw function */
function mount(container, handlers) {
  const state = initialState();
  const root = el('div', 'embedding-picker');
  root.append(el('div', 'ep-source', t('ep_source_note')));

  const panel = el('div', 'ep-panel');
  // Content languages: collapsed to a summary with a Change button
  const langs = row('ep_content_languages');
  const langToggle = button('', () => {
    state.langsOpen = !state.langsOpen;
    state.moreOpen = false;
    state.moreQuery = '';
    redraw();
  });
  const langSummary = el('span', 'ep-summary');
  const langChips = el('div', 'ep-chips');
  const moreBox = el('div', 'ep-more');
  const moreInput = el('input', 'ep-input');
  moreInput.type = 'search';
  moreInput.placeholder = t('ep_search_languages');
  moreInput.setAttribute('aria-label', t('ep_search_languages'));
  moreInput.addEventListener('input', () => { state.moreQuery = moreInput.value; redraw(); });
  const moreList = el('div', 'ep-chips');
  moreBox.append(moreInput, moreList);
  langs.body.append(langToggle, langSummary, langChips);
  langs.wrap.append(moreBox);

  // License: chips plus a one-line explanation per option
  const lic = row('ep_license');
  const licChips = el('div', 'ep-chips');
  const licNotes = el('div', 'ep-notes');
  for (const [, name, noteKey] of LICENSES) {
    const note = el('div', 'ep-note');
    note.append(el('strong', '', name || t('ep_lic_na')), document.createTextNode(` ${t(noteKey)}`));
    licNotes.append(note);
  }
  lic.body.append(licChips);
  lic.wrap.append(licNotes);

  // Filter: full fit, downloaded, more filters, clear, search
  const filter = row('ep_filter');
  const fullOnlyBtn = button(t('ep_full_only'), () => { state.fullOnly = !state.fullOnly; redraw(); });
  const downloadedBtn = button(t('ep_downloaded_only'), () => { state.downloadedOnly = !state.downloadedOnly; redraw(); });
  const moreFiltersBtn = button('', () => { state.moreFilters = !state.moreFilters; redraw(); });
  const clearBtn = button(t('ep_clear'), () => clearFilters(), 'ep-link');
  const search = el('input', 'ep-input ep-search');
  search.type = 'search';
  search.placeholder = t('ep_search');
  search.setAttribute('aria-label', t('ep_search_label'));
  search.addEventListener('input', () => { state.query = search.value; redraw(); });
  filter.body.append(fullOnlyBtn, downloadedBtn, moreFiltersBtn, clearBtn, search);

  const more = el('div', 'ep-more-filters');
  const dims = row('ep_dimensions');
  const scopes = row('ep_languages_covered');
  const uses = row('ep_use');
  more.append(dims.wrap, scopes.wrap, uses.wrap);
  panel.append(langs.wrap, lic.wrap, filter.wrap, more);

  const sort = row('ep_sort_by');
  sort.wrap.classList.add('ep-sort');

  const status = el('div', 'ep-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const count = el('span', 'ep-count');
  const hiddenNote = el('span', 'ep-hidden-note');
  status.append(count, hiddenNote);

  const list = el('div', 'ep-list');
  root.append(panel, sort.wrap, status, list, el('div', 'ep-footer', t('ep_footer')));
  container.replaceChildren(root);

  function clearFilters() {
    Object.assign(state, { fullOnly: false, downloadedOnly: false, dimensions: [], scopes: [], uses: [], licenses: [], query: '' });
    search.value = '';
    redraw();
  }

  function fillChips(target, defs, key, label) {
    target.replaceChildren(...defs.map(([value, ...rest]) =>
      chip(label(value, ...rest), state[key].includes(value), () => { state[key] = toggleIn(state[key], value); redraw(); })));
  }

  function redraw() {
    const activeId = getActiveModelId();
    const downloadedIds = getDownloadedModelIds();
    const ctx = { state, activeId, downloadedIds, onUse: handlers.onUse, redraw };

    // Content languages
    langToggle.textContent = t(state.langsOpen ? 'ep_hide' : 'ep_change');
    langToggle.setAttribute('aria-expanded', String(state.langsOpen));
    langSummary.hidden = state.langsOpen;
    langSummary.textContent = state.languages.length
      ? state.languages.map(c => `${c} · ${langName(c)}`).join(', ')
      : t('ep_none_selected');
    langChips.hidden = !state.langsOpen;
    const quick = [currentLang].concat(QUICK_LANGUAGE_CODES.filter(c => c !== currentLang)).concat(state.extra);
    const quickChips = [...new Set(quick)].map(c => chip(c, state.languages.includes(c), () => {
      state.languages = toggleIn(state.languages, c);
      savePrefs(state);
      redraw();
    }));
    const moreToggle = button(t('ep_more_langs'), () => { state.moreOpen = !state.moreOpen; state.moreQuery = ''; moreInput.value = ''; redraw(); });
    moreToggle.setAttribute('aria-expanded', String(state.moreOpen));
    langChips.replaceChildren(...quickChips, moreToggle);
    moreBox.hidden = !(state.langsOpen && state.moreOpen);
    if (!moreBox.hidden) {
      const q = foldKana(state.moreQuery.trim());
      const taken = new Set(quick);
      const matches = Object.keys(REGISTRY.languageNames)
        .filter(c => !taken.has(c))
        .filter(c => q === '' || c.includes(q) || REGISTRY.languageNames[c].toLowerCase().includes(q) || foldKana(langName(c)).includes(q))
        .sort((a, b) => langName(a).localeCompare(langName(b), currentLang))
        .slice(0, MORE_LANGUAGE_RESULTS);
      moreList.replaceChildren(...(matches.length
        ? matches.map(c => button(`${c} · ${langName(c)}`, () => {
          state.extra = state.extra.concat([c]);
          state.languages = state.languages.concat([c]);
          state.moreOpen = false;
          state.moreQuery = '';
          moreInput.value = '';
          savePrefs(state);
          redraw();
        }))
        : [el('span', 'ep-muted', t('ep_no_languages'))]));
    }

    // License, more filters, sort
    fillChips(licChips, LICENSES, 'licenses', (_, name) => name || t('ep_lic_na'));
    fillChips(dims.body, DIMENSIONS, 'dimensions', (_, label) => label || t('ep_unknown'));
    fillChips(scopes.body, SCOPES, 'scopes', (_, key) => t(key));
    fillChips(uses.body, USES, 'uses', (_, key) => t(key));
    sort.body.replaceChildren(...SORTS.map(([key, labelKey]) =>
      chip(t(labelKey), state.sort === key, () => { state.sort = key; savePrefs(state); redraw(); })));

    // Filter row
    const fullDisabled = state.languages.length === 0;
    fullOnlyBtn.disabled = fullDisabled;
    fullOnlyBtn.title = fullDisabled ? t('ep_full_only_disabled') : '';
    fullOnlyBtn.setAttribute('aria-pressed', String(state.fullOnly && !fullDisabled));
    downloadedBtn.setAttribute('aria-pressed', String(state.downloadedOnly));
    const hiddenCount = state.dimensions.length + state.scopes.length + state.uses.length;
    moreFiltersBtn.textContent = hiddenCount ? t('ep_more_filters_n', { n: hiddenCount }) : t('ep_more_filters');
    moreFiltersBtn.setAttribute('aria-expanded', String(state.moreFilters));
    moreFiltersBtn.setAttribute('aria-pressed', String(state.moreFilters || hiddenCount > 0));
    more.hidden = !state.moreFilters;
    const hasFilters = hiddenCount + state.licenses.length > 0 || state.query.trim() !== '' ||
      (state.fullOnly && !fullDisabled) || state.downloadedOnly;
    clearBtn.hidden = !hasFilters;

    // List
    const downloadedOnlyIds = new Set([...downloadedIds, activeId]);
    const visible = sortModels(filterModels(REGISTRY.models, {
      ...EMPTY_FILTERS,
      languages: state.languages,
      fullOnly: state.fullOnly,
      onlyIds: state.downloadedOnly ? downloadedOnlyIds : null,
      dimensions: state.dimensions,
      scopes: state.scopes,
      uses: state.uses,
      licenses: state.licenses,
      query: state.query
    }, { aliases: searchAliases() }), state.sort, state.languages, currentLang);

    count.textContent = t('ep_count', { shown: visible.length, total: REGISTRY.models.length });
    const hidden = isActiveHidden(visible, activeId);
    hiddenNote.hidden = !hidden;
    hiddenNote.textContent = hidden ? t('ep_active_hidden', { name: activeId.split('/').pop() }) : '';

    if (visible.length === 0) {
      const empty = el('div', 'ep-empty');
      empty.append(el('span', '', t('ep_empty')), button(t('ep_clear'), () => clearFilters(), 'ep-chip'));
      list.replaceChildren(empty);
    } else {
      list.replaceChildren(...visible.map(m => modelCard(m, ctx)));
    }
  }

  redraw();
  return redraw;
}

/**
 * Render the picker into the container. The first call builds it; later calls redraw it.
 * @param {HTMLElement} container - the #embeddingModelList element
 * @param {{ onUse: (modelId: string) => void }} handlers
 */
export function renderEmbeddingModelList(container, handlers) {
  if (!container) return;
  const redraw = pickers.get(container);
  if (redraw) {
    redraw();
    return;
  }
  pickers.set(container, mount(container, handlers));
}

/** Keep the list in sync with worker download events, model changes and the UI language. */
export function bindEmbeddingModelEvents(container, handlers) {
  window.addEventListener('app:embeddingModelDownload', (ev) => {
    const { model, status, pct } = ev.detail || {};
    if (!model) return;
    if (status === 'complete' || status === 'error') {
      downloading.delete(model);
    } else {
      downloading.set(model, pct ?? 0);
    }
    renderEmbeddingModelList(container, handlers);
  });
  window.addEventListener('app:embeddingModelsChanged', () => renderEmbeddingModelList(container, handlers));
  // Labels are set when the controls are built, so a language change rebuilds them
  window.addEventListener('app:languageChanged', () => {
    pickers.delete(container);
    renderEmbeddingModelList(container, handlers);
  });
}
