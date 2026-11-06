import { icons } from '../core/icons.js';
import { i18n, t } from '../core/i18n.js';
import { STORAGE_KEYS, DEFAULTS } from '../core/constants.js';
import { insertTextIntoEditor } from '../editor/editorManager.js';
import { resolveItemCode, resolveItemTitle, resolveItemDescription, escapeHtml } from './searchUtils.js';
import { removeContextMenu } from '../editor/ui/contextMenuManager.js';
import { aiManager } from '../core/aiStateManager.js';

// Number of loaded knowledge slots, pushed by dictionary.js after each state read (0 until the first read)
let loadedSlotCount = 0;
// Of those, the slots whose vectors fit the selected embedding model (the rest are left out of the vector index)
let usableSlotCount = 0;

export function setLoadedSlotCount(count, usable = count) {
  loadedSlotCount = count;
  usableSlotCount = usable;
}

// Why the list is empty: no knowledge file is set, the EMBED switch is off, the model is not ready,
// every dictionary was made for another model, or nothing matched
function emptyStateKey() {
  if (loadedSlotCount === 0) return 'no_slots_hint';
  const state = aiManager.getState();
  if (!state.embed) return 'embed_off_hint';
  if (!state.embedConfigured) return 'embed_not_ready_hint';
  if (usableSlotCount === 0) return 'slots_all_excluded_hint';
  return 'vector_no_match';
}

let currentResults = [];
let lastRawResults = [];

export function getResultsListEl() {
  return typeof document !== 'undefined' ? document.getElementById('vectorResultsList') : null;
}

export function getIconVectorEl() {
  return typeof document !== 'undefined' ? document.getElementById('iconNeuroContainer') : null;
}

export function setVectorIconActive(active) {
  const iconEl = getIconVectorEl();
  if (iconEl) {
    if (active) {
      iconEl.classList.add('active');
    } else {
      iconEl.classList.remove('active');
    }
  }
}

export function getSearchLimit() {
  const sel = document.getElementById('selSearchLimit');
  return sel ? (parseInt(sel.value, 10) || 5) : 5;
}

export function getMinScore() {
  const num = document.getElementById('numMinScore');
  return num ? ((parseFloat(num.value) || DEFAULTS.MIN_SCORE_PCT) / 100.0) : (DEFAULTS.MIN_SCORE_PCT / 100.0);
}

export function getSkeletonLoadingHtml(label) {
  return `
    <div class="loading-state">
      <div class="loading-header">
        <div class="spinner" role="status" title="${escapeHtml(label || i18n.vector_computing || 'Vectorizing...')}" aria-label="${escapeHtml(label || i18n.vector_computing || 'Vectorizing...')}"></div>
      </div>
      <div class="neural-glow-line"></div>
    </div>
  `;
}

export function getCurrentResults() {
  return currentResults;
}

export function resetVectorSearchResultsUi(debounceTimer, backendTimer) {
  currentResults = [];
  lastRawResults = [];
  setVectorIconActive(false);
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  if (backendTimer) {
    clearTimeout(backendTimer);
  }
  const resultsList = getResultsListEl();
  if (resultsList) {
    resultsList.innerHTML = '';
  }
  const btnCopyAll = document.getElementById('btnCopyAllResults');
  if (btnCopyAll) {
    btnCopyAll.style.display = 'none';
  }
  removeContextMenu();
}

let showFullMetadata = typeof localStorage !== 'undefined' ? (localStorage.getItem(STORAGE_KEYS.SHOW_FULL_METADATA) === 'true') : false;

// Field names ticked in the field list (shown on every card even when Full Meta is off)
const selectedMetaFields = new Set((() => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.META_FIELDS) || '[]'); } catch { return []; }
})());

export function reRenderWithCurrentResults() {
  if (lastRawResults && lastRawResults.length > 0) {
    const minScore = getMinScore();
    const filtered = lastRawResults.filter(r => (r.score || 0) >= minScore);
    renderResults(filtered.length > 0 ? filtered : lastRawResults.slice(0, 1), false);
  }
}

export function initSearchUi() {
  if (typeof document === 'undefined') return;

  document.getElementById('btnCopyAllResults')?.addEventListener('click', () => {
    if (currentResults.length > 0) {
      const rawJsonStr = JSON.stringify(currentResults, null, 2);
      navigator.clipboard.writeText(rawJsonStr);

      const btn = document.getElementById('btnCopyAllResults');
      if (btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = icons.checkGreen;
        setTimeout(() => { btn.innerHTML = originalText; }, 1500);
      }
    }
  });

  const numMinScoreInput = document.getElementById('numMinScore');
  const selSearchLimitInput = document.getElementById('selSearchLimit');
  if (numMinScoreInput) {
    numMinScoreInput.addEventListener('input', reRenderWithCurrentResults);
  }
  if (selSearchLimitInput) {
    selSearchLimitInput.addEventListener('change', reRenderWithCurrentResults);
  }

  window.addEventListener('app:resultDescLinesChanged', reRenderWithCurrentResults);
  window.addEventListener('app:resultTitleLinesChanged', reRenderWithCurrentResults);

  const chkFullMeta = document.getElementById('chkShowFullMetadata');
  if (chkFullMeta) {
    chkFullMeta.checked = showFullMetadata;
    chkFullMeta.addEventListener('change', (e) => {
      showFullMetadata = e.target.checked;
      localStorage.setItem(STORAGE_KEYS.SHOW_FULL_METADATA, showFullMetadata ? 'true' : 'false');
      reRenderWithCurrentResults();
    });
  }

}

// Knowledge items come from imported files, so every value is escaped (escapeHtml) before it goes into HTML.
// Buttons get listeners after rendering: the CSP allows no inline handlers.
function copyCardJson(btn, item) {
  try {
    navigator.clipboard.writeText(JSON.stringify(item, null, 2));
    const originalHtml = btn.innerHTML;
    btn.innerHTML = icons.checkGreen;
    setTimeout(() => {
      btn.innerHTML = originalHtml;
    }, 1500);
  } catch (err) {
    console.warn('Copy failed:', err);
  }
}

const RESERVED_KEYS = new Set(['id', 'code', 'key', '@id', 'name', 'title', 'label', 'prefLabel', 'term', 'text', 'score', 'vector', 'description', 'comment', 'summary', 'definition', 'metadata']);
// Fields the user does not read on a card: engine bookkeeping
const HIDDEN_FIELDS = new Set(['inEditor', 'idx', 'layer', 'layerName']);

// Flattened [key, value] pairs of an item's metadata, in the order the format gives them
function collectMetaFields(r) {
  const parts = [];
  const push = (k, v) => {
    if (HIDDEN_FIELDS.has(k) || v === undefined || v === null || v === '') return;
    if (Array.isArray(v)) { if (v.length) parts.push([k, v.join(', ')]); return; }
    if (typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) push(`${k}.${sk}`, sv); return; }
    parts.push([k, String(v)]);
  };
  for (const [k, v] of Object.entries(r.metadata || {})) push(k, v);
  for (const [k, v] of Object.entries(r)) if (!RESERVED_KEYS.has(k)) push(k, v);
  return parts;
}

// One checkbox per field name found in the current results (plus any ticked earlier), so each field can be shown on its own
function renderMetaFieldChecks(results) {
  const box = document.getElementById('metaFieldChecks');
  if (!box) return;
  const names = new Set(selectedMetaFields);
  for (const r of results || []) for (const [k] of collectMetaFields(r)) names.add(k);
  box.replaceChildren();
  box.style.display = names.size ? 'flex' : 'none';
  for (const name of [...names].sort()) {
    const label = document.createElement('label');
    label.style.cssText = 'display: flex; align-items: center; gap: 4px; font-size: var(--fs-11); color: var(--text-muted); cursor: pointer; user-select: none;';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = showFullMetadata || selectedMetaFields.has(name);
    chk.disabled = showFullMetadata;
    chk.style.cssText = 'accent-color: var(--accent-color, #818cf8); cursor: pointer;';
    chk.addEventListener('change', () => {
      if (chk.checked) selectedMetaFields.add(name); else selectedMetaFields.delete(name);
      try { localStorage.setItem(STORAGE_KEYS.META_FIELDS, JSON.stringify([...selectedMetaFields])); } catch { /* storage unavailable */ }
      reRenderWithCurrentResults();
    });
    const text = document.createElement('span');
    text.textContent = name;
    label.append(chk, text);
    box.append(label);
  }
}

// Kind of an item, from the scheme in a v2 concept id ("c:ui-setting:x" -> "ui-setting"); the label comes from the dictionary
function resolveKindLabel(code) {
  const m = /^c:([^:]+):/.exec(code || '');
  if (!m) return '';
  const key = 'result_kind_' + m[1].replace(/-/g, '_');
  const label = t(key);
  return label && label !== key ? label : m[1];
}

// 'vect_result_desc_lines': 1 or 2 lines of description on a card (2 by default)
function getResultDescLines() {
  try { return localStorage.getItem(STORAGE_KEYS.RESULT_DESC_LINES) === '1' ? '1' : '2'; } catch { return '2'; }
}

// 'vect_result_title_lines': '1' | '2' | '3' | 'full' (2 by default); 'full' shows the whole heading
function getResultTitleLines() {
  try {
    const v = localStorage.getItem(STORAGE_KEYS.RESULT_TITLE_LINES);
    return ['1', '3', 'full'].includes(v) ? v : '2';
  } catch { return '2'; }
}

function renderSingleCard(r, index, isPreliminary = false) {
  const title = resolveItemTitle(r);
  const code = resolveItemCode(r);
  const desc = resolveItemDescription(r);
  const score = typeof r.score === 'number' ? r.score : 0;
  const scorePct = Math.round(score * 100);
  let metadataHtml = '';

  // "Full Meta" shows every field; otherwise only the fields ticked in the field list
  const visibleParts = collectMetaFields(r).filter(([k]) => showFullMetadata || selectedMetaFields.has(k));

  if (visibleParts.length > 0) {
    metadataHtml = `<div class="metadata-grid" style="margin-top: 6px; padding-top: 6px; border-top: var(--border-width) solid var(--border-color); display: grid; user-select: text; cursor: text; grid-template-columns: max-content 1fr; align-items: start; column-gap: 12px; row-gap: 3px;">`;
    for (const [k, v] of visibleParts) {
      metadataHtml += `<div class="item-subtitle" style="font-size: var(--fs-12); line-height: 1.35; color: var(--text-muted); font-weight: 600;">${escapeHtml(k)}</div>`
        + `<div class="item-subtitle" style="font-size: var(--fs-12); line-height: 1.35; color: var(--text-muted); min-width: 0; overflow-wrap: anywhere;">${escapeHtml(v)}</div>`;
    }
    metadataHtml += `</div>`;
  }

  // An AI suggestion inserts its answer; the name and id on the card are only labels (they must never reach the document)
  const insertPayload = typeof r.insertText === 'string' ? r.insertText : (title || code || '');
  const btnInsertText = escapeHtml(t('btn_insert'));
  const kind = resolveKindLabel(code);

  const scoreHtml = isPreliminary
    ? `<span class="spinner result-card__score" role="status" title="${escapeHtml(t('vector_computing'))}" aria-label="${escapeHtml(t('vector_computing'))}"></span>`
    : `<span class="similarity-score result-card__score">${scorePct}%</span>`;
  // The kind tag and the ID share one row; the ID is hidden until hover or focus, but keeps its space so the card does not jump
  const metaRowHtml = (kind || code)
    ? `<div class="result-card__meta">${kind ? `<span class="result-card__kind">${escapeHtml(kind)}</span>` : ''}${code ? `<span class="item-code result-card__id" title="${escapeHtml(code)}">${escapeHtml(code)}</span>` : ''}</div>`
    : '';

  return `
    <div class="result-card vector-widget-card result-card--compact${isPreliminary ? ' result-card--preliminary' : ''}" data-result-index="${index}" data-insert-text="${escapeHtml(insertPayload)}">
      <div class="score-progress-bar" style="width: ${scorePct}%;"></div>
      <div class="card-header result-card__header">
        <div class="result-card__main">
          ${title ? `<span class="item-title result-card__title" data-lines="${getResultTitleLines()}" title="${escapeHtml(title)}">${escapeHtml(title)}</span>` : ''}
          ${scoreHtml}
        </div>
        <div class="result-card__actions">
          <button type="button" class="btn-item-insert" title="${btnInsertText}">${btnInsertText}</button>
          <button type="button" class="btn-item-copy-json" title="${t('btn_copy_json')}">${icons.copy}</button>
        </div>
      </div>
      <div class="result-card__body">
        ${desc ? `<div class="item-desc result-card__desc" data-lines="${getResultDescLines()}" title="${escapeHtml(desc)}">${escapeHtml(desc)}</div>` : ''}
        ${metadataHtml}
      </div>
      ${metaRowHtml}
    </div>`;
}

export function renderResults(results, isPreliminary = false) {
  currentResults = results || [];
  if (!isPreliminary) lastRawResults = currentResults;
  renderMetaFieldChecks(currentResults);

  const resultsList = getResultsListEl();
  if (!resultsList) return;

  if (!results || results.length === 0) {
    setVectorIconActive(false);
    const emptyKey = emptyStateKey();
    // Not ready, or no dictionary fits the model: say where to fix it, in one click
    const action = emptyKey === 'embed_not_ready_hint' || emptyKey === 'slots_all_excluded_hint'
      ? `<button type="button" class="empty-state__action" data-open-ai-settings>${t('embed_open_settings')}</button>`
      : '';
    resultsList.innerHTML = `<div class="empty-state" data-i18n="${emptyKey}">${t(emptyKey)}</div>${action}`;
    resultsList.querySelector('[data-open-ai-settings]')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('app:openSettings', { detail: { tab: 'tabAiSearch' } }));
    });
    return;
  }
  setVectorIconActive(true);

  // Dynamic Category Grouping - Schema & Category Driven (Domain-Agnostic)
  const categoryGroups = new Map();

  for (const r of results) {
    const rawCat = r.category || r.metadata?.category || r.type || r.metadata?.type || '';
    const catName = rawCat ? String(rawCat) : (t('sec_general'));

    if (!categoryGroups.has(catName)) {
      categoryGroups.set(catName, []);
    }
    categoryGroups.get(catName).push(r);
  }

  // Build Dynamic Sections HTML
  let html = '';
  const renderedItems = [];

  for (const [groupName, items] of categoryGroups.entries()) {
    const isRanked = items.some(r => typeof r.score === 'number' && r.score > 0);
    const iconCode = isRanked ? '&#xe242;' : '&#xe241;';
    html += `
    <div class="inspector-collapsible-section open">
      <div class="inspector-section-header">
        <span class="inspector-section-title" style="display: flex; align-items: center;">
          <span class="material-symbols-outlined" style="font-size: var(--icon-text-size);">${iconCode}</span>
          <span>${escapeHtml(groupName)}</span>
          <span class="inspector-section-badge">${items.length}</span>
        </span>
        <span class="inspector-arrow" style="display: flex; align-items: center;">
          ${icons.chevronDown}
        </span>
      </div>
      <div class="inspector-section-body">
        ${items.map(r => renderSingleCard(r, renderedItems.push(r) - 1, isPreliminary)).join('')}
      </div>
    </div>`;
  }

  // With EMBED off the results are text matches only; say so, so the scores are not read as meaning.
  // With EMBED on but no model ready, or no dictionary fitting the model, the same applies and the reason is shown.
  const embedState = aiManager.getState();
  const embedNoteKey = !embedState.embed ? 'embed_text_match_note'
    : !embedState.embedConfigured ? 'embed_not_ready_hint'
    : (loadedSlotCount > 0 && usableSlotCount === 0) ? 'slots_all_excluded_hint' : '';
  const embedOffNote = embedNoteKey
    ? `<div class="embed-off-note" style="color: var(--text-muted); font-size: var(--fs-11); line-height: 1.5; padding: 2px 6px 6px;">${escapeHtml(t(embedNoteKey))}</div>`
    : '';
  resultsList.innerHTML = embedOffNote + html;

  const btnCopyAll = document.getElementById('btnCopyAllResults');
  if (btnCopyAll) {
    btnCopyAll.style.display = (results && results.length > 0) ? 'inline-flex' : 'none';
  }

  resultsList.querySelectorAll('.inspector-section-header').forEach((header) => {
    header.addEventListener('click', () => header.parentElement.classList.toggle('open'));
  });

  // Card click and the Insert button insert into the editor; the copy button copies the item as JSON
  const cards = resultsList.querySelectorAll('.vector-widget-card');
  cards.forEach(c => {
    const insert = () => {
      const text = c.getAttribute('data-insert-text');
      if (text) insertTextIntoEditor(text);
    };
    c.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      // The detail table is for reading and selecting; a click or drag there must not insert
      if (e.target.closest('.metadata-grid')) return;
      if (String(window.getSelection() || '')) return;
      insert();
    });
    c.querySelector('.btn-item-insert')?.addEventListener('click', (e) => {
      e.stopPropagation();
      insert();
    });
    c.querySelector('.btn-item-copy-json')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = renderedItems[Number(c.getAttribute('data-result-index'))];
      if (item) copyCardJson(e.currentTarget, item);
    });
  });
}
