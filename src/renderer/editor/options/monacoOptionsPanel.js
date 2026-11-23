/**
 * Editor Options panel (right sidebar card): every Monaco option as a control, applied to the main editor as you change it.
 * The list is generated from the catalog; values persist through monacoOptionsStore (Dual-Sync like every other setting).
 */
import { t, currentLang } from '../../core/i18n.js';
import { STORAGE_KEYS } from '../../core/constants.js';
import { el } from '../../ui/dom.js';
import { readStorage } from '../../core/storage.js';
import {
  loadControls,
  getOverrides,
  setOverride,
  resetOverride,
  resetAllOverrides,
  snapshotOptions,
  getBaseline
} from './monacoOptionsStore.js';
import {
  encodeValue,
  decodeValue,
  parseTyped,
  filterControls,
  groupControls,
  readPath,
  defaultValueOf,
  LOCK_SETTINGS
} from './monacoOptionsModel.js';

const SEARCH_DELAY_MS = 120;

const state = {
  built: false,
  controls: [],
  overrides: {},
  snapshot: {},
  rows: new Map(),
  groups: [],
  onlyChanged: false
};

const getEditor = () => window.__monacoEditorInstance || null;

/** Description in the UI language, from the dictionary (settings.editor.<option path>). */
function describe(control) {
  return t(`settings.editor.${control.path}`);
}

function tooltipOf(control) {
  const parent = control.member !== null && currentLang === 'ja' ? t(`settings.editor.${control.name}`) : '';
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

/** The value a reset returns to: what the app chose, else the option's default. */
function resetValueOf(control) {
  const chosen = readPath(getBaseline(), control.path);
  return chosen !== undefined ? chosen : defaultValueOf(control);
}

function refreshSnapshot() {
  state.snapshot = snapshotOptions(getEditor());
}

/**
 * The two count cells: the total first, then the changed ones, each a fixed-width cell whose last digits line up.
 * Only the top line names them (withLabels); the group headings show the bare numbers under the same columns.
 * "shown / all" appears only while a filter hides some options (otherwise both numbers are the same).
 */
function countCells(shown, total, changed, withLabels = false) {
  const cell = (cls, label, value) => {
    const node = el('span', `mo-count-cell ${cls}`);
    if (withLabels) node.append(el('span', 'mo-count-label', label));
    node.append(el('span', 'mo-count-num', value));
    return node;
  };
  return [
    cell('mo-count-items', t('monaco_label_items'), shown === total ? String(total) : `${shown} / ${total}`),
    changed ? cell('mo-count-changed', t('monaco_label_changed'), String(changed)) : el('span', 'mo-count-cell mo-count-changed')
  ];
}

function updateSummary() {
  const total = state.controls.length;
  let shown = 0;
  for (const row of state.rows.values()) if (!row.element.hidden) shown++;
  const changed = Object.keys(state.overrides).length;
  // Each group heading shows its own count in the same form as the total: shown / all, and the changed ones when there are any
  for (const { controls, countEl } of state.groups) {
    if (!countEl) continue;
    let groupShown = 0;
    let groupChanged = 0;
    for (const c of controls) {
      if (!state.rows.get(c.path)?.element.hidden) groupShown++;
      if (c.path in state.overrides) groupChanged++;
    }
    countEl.replaceChildren(...countCells(groupShown, controls.length, groupChanged));
  }
  const count = document.getElementById('monacoOptionsCount');
  if (count) count.replaceChildren(...(shown ? countCells(shown, total, changed, true) : [t('monaco_opts_empty')]));
  const resetAll = document.getElementById('btnMonacoOptionsResetAll');
  if (resetAll) resetAll.hidden = !changed;
  // The filter needs something changed to show; its tooltip says why it is off (the count line above reads "changed 0")
  const onlyBtn = document.getElementById('btnMonacoOptionsChangedOnly');
  if (onlyBtn) {
    onlyBtn.disabled = !changed && !state.onlyChanged;
    onlyBtn.title = onlyBtn.disabled ? t('tip_monaco_opts_changed_only_none') : t('tip_monaco_opts_changed_only');
  }
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
    input.dataset.menuClass = 'ui-select-menu--lg'; // the open list takes the panel's 16px text
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
    // A value equal to the reset value is no change: drop the override instead of storing it
    if (JSON.stringify(value) === JSON.stringify(resetValueOf(control))) {
      reset.click();
      return;
    }
    setOverride(getEditor(), control.path, value, { live: !control.createOnly });
    state.overrides[control.path] = value;
    row.dataset.overridden = 'true';
    reset.hidden = false;
    updateSummary();
    if (state.onlyChanged) applyFilter();
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
    if (state.onlyChanged) applyFilter();
  });

  const text = el('div', 'mo-desc', describe(control));
  const lockText = control.lock ? t('monaco_opt_lock_settings') : '';
  if (lockText) text.prepend(el('span', 'mo-lock', lockText));
  else if (control.createOnly) text.prepend(el('span', 'mo-lock', t('monaco_opt_restart')));

  const side = el('div', 'mo-side');
  side.append(holder, reset);
  row.append(name, side, text);
  // The default sits under the value column, so the value and what it started as are read together
  if (control.defaultText && !control.lock) {
    row.append(el('div', 'mo-default', t('monaco_opt_default', { value: control.defaultText })));
  }

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

/** A folding block (<details>) with a title and a right-aligned count; the caller adds its rows to `body`. */
function buildFold(className, titleText, controls) {
  const details = el('details', className);
  const summary = el('summary', className === 'mo-group' ? 'mo-group-title' : `mo-group-title ${className}-title`, titleText);
  const countEl = el('span', 'mo-group-count', '');
  summary.appendChild(countEl);
  details.appendChild(summary);
  const body = el('div', 'mo-group-body');
  details.appendChild(body);
  state.groups.push({ details, controls, countEl });
  return { details, body };
}

function addRows(body, controls) {
  for (const control of controls) {
    const row = buildRow(control);
    state.rows.set(control.path, row);
    body.appendChild(row.element);
    row.refresh();
  }
}

/** The options a writer may judge, then the weight-0 ones folded away under one heading (the search still opens it). */
function addSub(body, { main, rare }) {
  addRows(body, main);
  if (!rare.length) return;
  const fold = buildFold('mo-rare', t('monaco_rare'), rare);
  addRows(fold.body, rare);
  body.appendChild(fold.details);
}

function render() {
  const list = document.getElementById('monacoOptionsList');
  if (!list) return;
  list.textContent = '';
  state.rows.clear();
  state.groups = [];
  for (const { group, controls, subs } of groupControls(state.controls)) {
    const section = buildFold('mo-group', t(`monaco_group_${group}`), controls);
    // A group with one sub-heading (or none) shows its rows directly: a sub-heading that repeats the group name adds nothing
    for (const sub of subs) {
      if (subs.length === 1 || sub.sub === null) {
        addSub(section.body, sub);
      } else {
        const fold = buildFold('mo-sub', t(`monaco_sub_${sub.sub}`), sub.controls);
        addSub(fold.body, sub);
        section.body.appendChild(fold.details);
      }
    }
    list.appendChild(section.details);
  }
  applyFilter();
}

function applyFilter() {
  // With nothing left changed the filter would show an empty list, so it switches itself off
  if (state.onlyChanged && !Object.keys(state.overrides).length) {
    state.onlyChanged = false;
    document.getElementById('btnMonacoOptionsChangedOnly')?.setAttribute('aria-pressed', 'false');
  }
  const query = document.getElementById('monacoOptionsSearch')?.value || '';
  const matched = new Set(filterControls(state.controls, query, describe).map((c) => c.path));
  if (state.onlyChanged) for (const path of [...matched]) if (!(path in state.overrides)) matched.delete(path);
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
    const [{ controls }, overrides] = await Promise.all([loadControls(), getOverrides()]);
    // Only what a writer can change, or what the settings page owns (shown read-only). The options the app fixes
    // and the ones one input cannot express (the "managed" group of the layout) are not listed; MONACO_OPTIONS.md lists them.
    state.controls = controls.filter((c) => !c.lock || c.lock === LOCK_SETTINGS);
    state.overrides = overrides;
    refreshSnapshot();
    render();
  } catch (err) {
    state.built = false;
    console.error('[MonacoOptions] Could not build the panel:', err);
  }
}

/** Removes every panel override, then redraws the list and the summary from the empty state. */
async function resetEditorOptions() {
  await resetAllOverrides(getEditor());
  state.overrides = {};
  if (state.built) {
    refreshSnapshot();
    for (const row of state.rows.values()) row.refresh();
  }
  updateSummary();
  if (state.onlyChanged) applyFilter();
}

export function initMonacoOptionsPanel() {
  const card = document.getElementById('monacoOptionsCard');
  if (!card) return;

  // The header toggles the card (appActionEvents). Watch the card's class instead of the click: the two click handlers
  // share the header, and whichever runs first would otherwise read the state before or after the toggle
  const header = card.querySelector('.semantic-module-header');
  const syncOpen = () => {
    const open = !card.classList.contains('collapsed');
    header?.setAttribute('aria-expanded', String(open));
    if (open) ensureBuilt();
  };
  new MutationObserver(syncOpen).observe(card, { attributes: true, attributeFilter: ['class'] });
  syncOpen();
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

  const onlyBtn = document.getElementById('btnMonacoOptionsChangedOnly');
  onlyBtn?.addEventListener('click', () => {
    state.onlyChanged = !state.onlyChanged;
    onlyBtn.setAttribute('aria-pressed', String(state.onlyChanged));
    applyFilter();
  });

  // The panel's header button and the settings page row both put every panel change back to its default
  const resetAll = document.getElementById('btnMonacoOptionsResetAll');
  resetAll?.addEventListener('click', resetEditorOptions);
  document.getElementById('btnEditorOptionsReset')?.addEventListener('click', resetEditorOptions);
  // Overrides from an earlier session: show the reset button without loading the whole catalog
  if (resetAll && readStorage(STORAGE_KEYS.MONACO_OPTIONS)) resetAll.hidden = false;

  // The language changed or the editor was rebuilt: draw the list again from the current state
  window.addEventListener('app:languageChanged', () => {
    if (state.built) render();
  });
}
