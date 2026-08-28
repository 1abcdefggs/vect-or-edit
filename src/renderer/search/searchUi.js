import { icons } from '../core/icons.js';
import { i18n, t } from '../core/i18n.js';
import { STORAGE_KEYS, DEFAULTS } from '../core/constants.js';
import { insertTextIntoEditor } from '../editor/editorManager.js';
import { resolveItemCode, resolveItemTitle, resolveItemDescription } from './searchUtils.js';
import { removeContextMenu } from '../editor/ui/contextMenuManager.js';

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
        <div class="spinner"></div>
        <span>${label || i18n.vector_computing || "Vectorizing..."}</span>
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

  // Global hook for inline insert button
  if (typeof window !== 'undefined' && !window.__insertVectorItem) {
    window.__insertVectorItem = (text) => {
      insertTextIntoEditor(text);
    };
  }

  // Global copy JSON helper
  if (typeof window !== 'undefined' && !window.__copyVectorCardJson) {
    window.__copyVectorCardJson = (btn, encodedJson) => {
      try {
        const decoded = decodeURIComponent(encodedJson);
        navigator.clipboard.writeText(decoded);
        const originalHtml = btn.innerHTML;
        btn.innerHTML = icons.checkGreen;
        setTimeout(() => {
          btn.innerHTML = originalHtml;
        }, 1500);
      } catch (err) {
        console.warn('Copy failed:', err);
      }
    };
  }
}

function renderSingleCard(r, isPreliminary = false) {
  const title = resolveItemTitle(r);
  const code = resolveItemCode(r);
  const desc = resolveItemDescription(r);
  const score = typeof r.score === 'number' ? r.score : 0;
  const scorePct = Math.round(score * 100);
  const metaObj = r.metadata || {};
  const tooltipParts = [];
  let metadataHtml = '';

  for (const [k, v] of Object.entries(metaObj)) {
    if (v !== undefined && v !== null && v !== '') {
      const valStr = typeof v === 'object' ? JSON.stringify(v) : String(v);
      tooltipParts.push(`${k}: ${valStr}`);
    }
  }

  const reservedKeys = new Set(['id', 'code', 'key', '@id', 'name', 'title', 'label', 'prefLabel', 'term', 'text', 'score', 'vector', 'description', 'comment', 'summary', 'definition', 'metadata']);
  for (const [k, v] of Object.entries(r)) {
    if (!reservedKeys.has(k) && v !== undefined && v !== null && v !== '') {
      const valStr = typeof v === 'object' ? JSON.stringify(v) : String(v);
      tooltipParts.push(`${k}: ${valStr}`);
    }
  }

  if (showFullMetadata && tooltipParts.length > 0) {
    metadataHtml = `<div class="metadata-grid" style="margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 3px;">`;
    for (const part of tooltipParts) {
      metadataHtml += `<div class="item-subtitle" style="font-size: 0.75rem; line-height: 1.35; color: var(--text-muted);">${part}</div>`;
    }
    metadataHtml += `</div>`;
  }

  const tooltip = tooltipParts.join('\n').replace(/"/g, '&quot;');
  const isCodePresent = Boolean(code);
  const insertPayload = (isCodePresent && !title.includes(code)) ? `${title} (${code})` : title;
  const btnInsertText = t('btn_insert') || "Insert";

  const encodedJson = encodeURIComponent(JSON.stringify(r, null, 2));

  return `
    <div class="result-card vector-widget-card" data-insert-text="${insertPayload.replace(/"/g, '&quot;')}" title="${tooltip}" style="padding: 6px 8px; margin-bottom: 6px; border-radius: 6px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); cursor: pointer; position: relative; overflow: hidden; transition: all 0.2s ease; ${isPreliminary ? 'opacity: 0.85; border-left: 3px solid #818cf8;' : ''}">
      <div class="score-progress-bar" style="width: ${scorePct}%;"></div>
      <!-- Line 1: Code + Score + Title (Left) and Action Buttons (Right) -->
      <div class="card-header" style="position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; min-width: 0; flex: 1;">
          ${code ? `<span class="item-code" style="flex-shrink: 0; font-family: monospace; font-size: 0.7rem; padding: 1px 5px; border-radius: 3px; background: rgba(56, 189, 248, 0.15); color: var(--accent-color, #38bdf8); font-weight: 700;">${code}</span>` : ''}
          <span class="similarity-score" style="flex-shrink: 0; font-size: 0.72rem; font-weight: 800; color: #10b981;">${isPreliminary ? (t('vector_computing') || "Computing...") : `${scorePct}%`}</span>
          ${title ? `<span class="item-title" style="font-size: 0.86rem; font-weight: 700; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${title}">${title}</span>` : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
          <button class="btn-item-insert" onclick="event.stopPropagation(); window.__insertVectorItem && window.__insertVectorItem('${insertPayload.replace(/'/g, "\\'")}');" style="background: rgba(129,140,248,0.15); border: 1px solid rgba(129,140,248,0.4); color: var(--accent-color); border-radius: 4px; padding: 1px 6px; font-size: 0.68rem; font-weight: bold; cursor: pointer;" title="${btnInsertText}">
            ${btnInsertText}
          </button>
          <button onclick="event.stopPropagation(); window.__copyVectorCardJson && window.__copyVectorCardJson(this, '${encodedJson}');" style="background: none; border: none; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; padding: 2px;" title="Copy JSON">
            ${icons.copy}
          </button>
        </div>
      </div>
      <!-- Line 2: Description & Extended Metadata -->
      <div style="position: relative; z-index: 1; margin-top: 3px;">
        ${desc ? `<div class="item-desc" style="font-size: 0.75rem; line-height: 1.35; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${desc}">${desc}</div>` : ''}
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
    resultsList.innerHTML = `<div class="empty-state" data-i18n="vector_no_match">${t('vector_no_match')}</div>`;
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

  for (const [groupName, items] of categoryGroups.entries()) {
    html += `
    <div class="inspector-collapsible-section open">
      <div class="inspector-section-header" onclick="this.parentElement.classList.toggle('open')">
        <span class="inspector-section-title">
          <span>${groupName}</span>
          <span class="inspector-section-badge">${items.length}</span>
        </span>
        <span class="inspector-arrow" style="display: flex; align-items: center;">
          ${icons.chevronDown}
        </span>
      </div>
      <div class="inspector-section-body">
        ${items.map(r => renderSingleCard(r, isPreliminary)).join('')}
      </div>
    </div>`;
  }

  resultsList.innerHTML = html;

  const btnCopyAll = document.getElementById('btnCopyAllResults');
  if (btnCopyAll) {
    btnCopyAll.style.display = (results && results.length > 0) ? 'inline-flex' : 'none';
  }

  // Attach card click to insert into editor
  const cards = resultsList.querySelectorAll('.vector-widget-card');
  cards.forEach(c => {
    c.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
      const text = c.getAttribute('data-insert-text');
      if (text) {
        insertTextIntoEditor(text);
      }
    });
  });
}
