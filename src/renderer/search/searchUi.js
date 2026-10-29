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

function renderSingleCard(r, index, isPreliminary = false) {
  const title = resolveItemTitle(r);
  const code = resolveItemCode(r);
  const desc = resolveItemDescription(r);
  const score = typeof r.score === 'number' ? r.score : 0;
  const scorePct = Math.round(score * 100);
  const metaObj = r.metadata || {};
  let metadataHtml = '';

  const reservedKeys = new Set(['id', 'code', 'key', '@id', 'name', 'title', 'label', 'prefLabel', 'term', 'text', 'score', 'vector', 'description', 'comment', 'summary', 'definition', 'metadata']);
  // Fields the user does not read on a card: engine bookkeeping
  const hiddenFields = new Set(['inEditor', 'idx', 'layer', 'layerName']);
  const visibleParts = [];
  const pushField = (k, v) => {
    if (hiddenFields.has(k) || v === undefined || v === null || v === '') return;
    if (Array.isArray(v)) { if (v.length) visibleParts.push(`${k}: ${v.join(', ')}`); return; }
    if (typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) pushField(`${k}.${sk}`, sv); return; }
    visibleParts.push(`${k}: ${v}`);
  };
  for (const [k, v] of Object.entries(metaObj)) pushField(k, v);
  for (const [k, v] of Object.entries(r)) if (!reservedKeys.has(k)) pushField(k, v);

  if (showFullMetadata && visibleParts.length > 0) {
    metadataHtml = `<div class="metadata-grid" style="margin-top: 6px; padding-top: 6px; border-top: var(--border-width) solid var(--border-color); display: flex; flex-direction: column; gap: 3px;">`;
    for (const part of visibleParts) {
      metadataHtml += `<div class="item-subtitle" style="font-size: var(--fs-12); line-height: 1.35; color: var(--text-muted);">${escapeHtml(part)}</div>`;
    }
    metadataHtml += `</div>`;
  }

  const isCodePresent = Boolean(code);
  // An AI suggestion inserts its answer; the name and id on the card are only labels (they must never reach the document)
  const insertPayload = typeof r.insertText === 'string' ? r.insertText : ((isCodePresent && !title.includes(code)) ? `${title} (${code})` : title);
  const btnInsertText = escapeHtml(t('btn_insert') || "Insert");

  return `
    <div class="result-card vector-widget-card" data-result-index="${index}" data-insert-text="${escapeHtml(insertPayload)}" style="padding: 6px 8px; margin-bottom: 6px; border-radius: 6px; background: rgba(255, 255, 255, 0.02); border: var(--border-width) solid var(--border-color); cursor: pointer; position: relative; overflow: hidden; transition: all 0.2s ease; ${isPreliminary ? 'opacity: 0.85; border-left: 3px solid #818cf8;' : ''}">
      <div class="score-progress-bar" style="position: absolute; left: 0; bottom: 0; height: 2px; width: ${scorePct}%; background: var(--success-color, #10b981);"></div>
      <!-- Line 1: Code + Score + Title (Left) and Action Buttons (Right) -->
      <div class="card-header" style="position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; min-width: 0; flex: 1;">
          ${code ? `<span class="item-code" style="flex-shrink: 0; font-family: monospace; font-size: var(--fs-11); padding: 1px 5px; border-radius: 3px; background: rgba(56, 189, 248, 0.15); color: var(--accent-color, #38bdf8); ">${escapeHtml(code)}</span>` : ''}
          ${isPreliminary
            ? `<span class="spinner" role="status" style="flex-shrink: 0;" title="${escapeHtml(t('vector_computing') || 'Computing...')}" aria-label="${escapeHtml(t('vector_computing') || 'Computing...')}"></span>`
            : `<span class="similarity-score" style="flex-shrink: 0; font-size: var(--fs-12);  color: #10b981;">${scorePct}%</span>`}
          ${title ? `<span class="item-title" style="font-size: var(--fs-14);  color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(title)}">${escapeHtml(title)}</span>` : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
          <button type="button" class="btn-item-insert" style="background: rgba(129,140,248,0.15); border: 1px solid rgba(129,140,248,0.4); color: var(--accent-color); border-radius: 4px; padding: 1px 6px; font-size: var(--fs-11);  cursor: pointer;" title="${btnInsertText}">
            ${btnInsertText}
          </button>
          <button type="button" class="btn-item-copy-json" style="background: none; border: none; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; padding: 2px;" title="Copy JSON">
            ${icons.copy}
          </button>
        </div>
      </div>
      <!-- Line 2: Description & Extended Metadata -->
      <div style="position: relative; z-index: 1; margin-top: 3px;">
        ${desc ? `<div class="item-desc" style="font-size: var(--fs-12); line-height: 1.35; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(desc)}">${escapeHtml(desc)}</div>` : ''}
        ${metadataHtml}
      </div>
    </div>`;
}

export function renderResults(results, isPreliminary = false) {
  currentResults = results || [];
  if (!isPreliminary) lastRawResults = currentResults;

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
    const catName = rawCat ? String(rawCat) : (t('sec_general') || 'Knowledge Items');

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
