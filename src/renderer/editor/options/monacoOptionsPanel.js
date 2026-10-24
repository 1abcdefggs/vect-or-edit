/**
 * Editor Options panel (right sidebar card): every Monaco option as a control, applied to the main editor as you change it.
 * The list is generated from the catalog; values persist through monacoOptionsStore (Dual-Sync like every other setting).
 */
import { t, currentLang } from '../../core/i18n.js';
import { STORAGE_KEYS } from '../../core/constants.js';
import {
  loadCatalog,
  loadControls,
  getOverrides,
  setOverride,
  resetOverride,
  resetAllOverrides,
  snapshotOptions
} from './monacoOptionsStore.js';
import {
  encodeValue,
  decodeValue,
  parseTyped,
  filterControls,
  groupControls,
  readPath,
  defaultValueOf,
  LOCK_SETTINGS,
  LOCK_APP
} from './monacoOptionsModel.js';

const SEARCH_DELAY_MS = 120;

const state = {
  built: false,
  controls: [],
  ja: {},
  overrides: {},
  snapshot: {},
  rows: new Map(),
  groups: []
};

const getEditor = () => window.__monacoEditorInstance || null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Description in the UI language: Japanese text when we have it, the catalog's English documentation otherwise. */
function describe(control) {
  const own = currentLang === 'ja' ? state.ja[control.path] : null;
  if (own) return own;
  if (control.member === null) return currentLang === 'ja' && state.ja[control.name] ? state.ja[control.name] : control.doc;
  return control.doc;
}

function tooltipOf(control) {
  const parent = control.member !== null && currentLang === 'ja' ? state.ja[control.name] : '';
  return [parent, control.doc].filter(Boolean).join('\n');
}

function labelOf(control) {
  return control.member === null ? control.name : `${control.name} › ${control.member}`;
}

/** What the control shows: the user's override, else what the editor was given, else Monaco's documented default. */
function valueOf(control) {
  if (control.path in state.overrides) return state.overrides[control.path];
  const given = readPath(state.snapshot, control.path);
  return given !== undefined ? given : defaultValueOf(control);
}

function refreshSnapshot() {
  state.snapshot = snapshotOptions(getEditor());
}

function updateSummary() {
  const total = state.controls.length;
  let shown = 0;
  for (const row of state.rows.values()) if (!row.element.hidden) shown++;
  const changed = Object.keys(state.overrides).length;
  const count = document.getElementById('monacoOptionsCount');
  if (count) count.textContent = shown ? t('monaco_opts_count', { shown, total, changed }) : t('monaco_opts_empty');
  const resetAll = document.getElementById('btnMonacoOptionsResetAll');
  if (resetAll) resetAll.style.display = changed ? '' : 'none';
}

/** Builds the control for one option and returns {node, setValue}. */
function buildInput(control, onCommit) {
  const disabled = Boolean(control.lock);
  let input;
  let setValue;

  if (control.kind === 'boolean') {
    input = el('input', 'mo-switch');
    input.type = 'checkbox';
    // A value nobody knows (no default documented, not set by the app) shows as the third, indeterminate state
    setValue = (v) => {
      input.indeterminate = v === undefined;
      input.checked = Boolean(v);
    };
    input.addEventListener('change', () => onCommit(input.checked));
  } else if (control.kind === 'enum') {
    input = el('select', 'mo-select');
    const build = (current) => {
      input.textContent = '';
      // An unknown value gets a blank entry; a value outside the documented choices is listed first so it stays visible
      const values = control.choices.some((c) => c === current) ? control.choices : [current, ...control.choices];
      for (const choice of values) {
        const option = el('option', '', choice === undefined ? '—' : String(choice));
        option.value = choice === undefined ? '' : encodeValue(choice);
        input.appendChild(option);
      }
    };
    setValue = (v) => {
      build(v);
      input.value = v === undefined ? '' : encodeValue(v);
    };
    input.addEventListener('change', () => {
      if (input.value !== '') onCommit(decodeValue(input.value)); // the blank entry means "unknown", not a choice
    });
  } else {
    input = el('input', 'mo-input');
    input.type = control.kind === 'number' ? 'number' : 'text';
    input.spellcheck = false;
    setValue = (v) => {
      if (v === undefined || v === null) input.value = '';
      else input.value = control.kind === 'json' ? JSON.stringify(v) : String(v);
    };
    input.addEventListener('change', () => {
      const parsed = parseTyped(control, input.value);
      input.classList.toggle('invalid', !parsed.ok);
      if (parsed.ok) onCommit(parsed.value);
    });
  }
  input.disabled = disabled;
  // The visible name is a separate element; the control carries it as its accessible name
  input.setAttribute('aria-label', labelOf(control));
  return { node: input, setValue };
}

function buildRow(control) {
  const row = el('div', 'mo-row');
  row.dataset.path = control.path;
  if (control.lock) row.dataset.lock = control.lock;

  const name = el('div', 'mo-name', labelOf(control));
  name.title = tooltipOf(control);

  const { node, setValue } = buildInput(control, (value) => {
    setOverride(getEditor(), control.path, value, { live: !control.createOnly });
    state.overrides[control.path] = value;
    row.dataset.overridden = 'true';
    reset.hidden = false;
    updateSummary();
  });
  const holder = el('div', 'mo-control');
  holder.appendChild(node);

  const reset = el('button', 'mo-reset');
  reset.type = 'button';
  reset.textContent = '↺';
  reset.title = t('tip_monaco_opt_reset');
  reset.setAttribute('aria-label', `${t('tip_monaco_opt_reset')}: ${labelOf(control)}`);
  reset.hidden = true;
  reset.addEventListener('click', () => {
    resetOverride(getEditor(), control.path, { live: !control.createOnly });
    delete state.overrides[control.path];
    delete row.dataset.overridden;
    reset.hidden = true;
    refreshSnapshot();
    setValue(valueOf(control));
    updateSummary();
  });

  const text = el('div', 'mo-desc', describe(control));
  const lockText = control.lock === LOCK_SETTINGS ? t('monaco_opt_lock_settings')
    : control.lock === LOCK_APP ? t('monaco_opt_lock_app')
    : control.lock ? t('monaco_opt_lock_unsupported') : '';
  if (lockText) text.prepend(el('span', 'mo-lock', lockText));
  else if (control.createOnly) text.prepend(el('span', 'mo-lock', t('monaco_opt_restart')));
  if (control.defaultText && !control.lock) {
    const hint = el('span', 'mo-default', t('monaco_opt_default', { value: control.defaultText }));
    text.appendChild(hint);
  }

  const side = el('div', 'mo-side');
  side.append(holder, reset);
  row.append(name, side, text);

  return {
    element: row,
    control,
    refresh() {
      setValue(valueOf(control));
      const overridden = control.path in state.overrides;
      if (overridden) row.dataset.overridden = 'true';
      else delete row.dataset.overridden;
      reset.hidden = !overridden;
    }
  };
}

function render() {
  const list = document.getElementById('monacoOptionsList');
  if (!list) return;
  list.textContent = '';
  state.rows.clear();
  state.groups = [];
  for (const { group, controls } of groupControls(state.controls)) {
    const details = el('details', 'mo-group');
    const summary = el('summary', 'mo-group-title', t(`monaco_group_${group}`));
    details.appendChild(summary);
    const body = el('div', 'mo-group-body');
    for (const control of controls) {
      const row = buildRow(control);
      state.rows.set(control.path, row);
      body.appendChild(row.element);
      row.refresh();
    }
    details.appendChild(body);
    list.appendChild(details);
    state.groups.push({ details, controls });
  }
  applyFilter();
}

function applyFilter() {
  const query = document.getElementById('monacoOptionsSearch')?.value || '';
  const matched = new Set(filterControls(state.controls, query, describe).map((c) => c.path));
  for (const [path, row] of state.rows) row.element.hidden = !matched.has(path);
  for (const { details, controls } of state.groups) {
    const any = controls.some((c) => matched.has(c.path));
    details.hidden = !any;
    if (query) details.open = any;
  }
  updateSummary();
}

function refreshValues() {
  refreshSnapshot();
  for (const row of state.rows.values()) row.refresh();
}

async function ensureBuilt() {
  if (state.built) {
    refreshValues();
    return;
  }
  state.built = true;
  try {
    const [{ ja }, { controls }, overrides] = await Promise.all([loadCatalog(), loadControls(), getOverrides()]);
    state.ja = ja;
    state.controls = controls;
    state.overrides = overrides;
    refreshSnapshot();
    render();
  } catch (err) {
    state.built = false;
    console.error('[MonacoOptions] Could not build the panel:', err);
  }
}

export function initMonacoOptionsPanel() {
  const card = document.getElementById('monacoOptionsCard');
  if (!card) return;

  // The header toggles the card (appActionEvents); build the list the first time it opens
  const header = card.querySelector('.semantic-module-header');
  header?.addEventListener('click', (e) => {
    if (e.target.closest('.semantic-module-actions')) return;
    const open = !card.classList.contains('collapsed');
    header.setAttribute('aria-expanded', String(open));
    if (open) ensureBuilt();
  });
  // The header is a button for the keyboard too: Enter and Space do what a click does
  header?.addEventListener('keydown', (e) => {
    if (e.target !== header || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    header.click();
  });

  header?.setAttribute('aria-label', t('monaco_opts_title'));

  // Icon-only and placeholder-only controls get an accessible name from the same texts as their tooltips
  document.getElementById('monacoOptionsSearch')?.setAttribute('aria-label', t('tip_monaco_opts_search'));
  document.getElementById('btnMonacoOptionsResetAll')?.setAttribute('aria-label', t('tip_monaco_opts_reset_all'));

  let timer = null;
  document.getElementById('monacoOptionsSearch')?.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(applyFilter, SEARCH_DELAY_MS);
  });

  const resetAll = document.getElementById('btnMonacoOptionsResetAll');
  resetAll?.addEventListener('click', async () => {
    await resetAllOverrides(getEditor());
    state.overrides = {};
    if (state.built) {
      refreshSnapshot();
      for (const row of state.rows.values()) row.refresh();
    }
    updateSummary();
  });
  // Overrides from an earlier session: show the reset button without loading the whole catalog
  if (resetAll && localStorage.getItem(STORAGE_KEYS.MONACO_OPTIONS)) resetAll.style.display = '';

  // The language changed or the editor was rebuilt: draw the list again from the current state
  window.addEventListener('app:languageChanged', () => {
    if (state.built) render();
  });
}
