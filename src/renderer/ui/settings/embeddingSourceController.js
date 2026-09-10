/**
 * embeddingSourceController.js
 *
 * Manages the Embedding Source Selector UI inside the settings modal.
 * Reads/writes via adapterRegistry so the search pipeline picks up the
 * change immediately on the next query.
 *
 * Interface (deep module – callers only need to call initEmbeddingSourceController):
 *   initEmbeddingSourceController() → void
 *
 * DOM dependencies (ids must exist in settingsModal.html):
 *   #embeddingSourceCard   – container card
 *   .emb-src-card          – clickable source cards (data-src attribute)
 *   #embSrcActiveBadge     – status badge top-right of card
 *   #embSrcLlmWarning      – warning strip shown for LLM sources
 */

import { adapterRegistry } from '../../search/adapterRegistry.js';

export const BADGE_CONFIG = {
  local: { text: 'LOCAL', bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
  llm:   { text: 'LLM',   bg: 'rgba(56,189,248,0.15)',  color: '#38bdf8' }
};

export function getBadgeConfig(id) {
  return id === 'local' ? BADGE_CONFIG.local : BADGE_CONFIG.llm;
}

function applyBadge(el, cfg) {
  if (!el) return;
  el.textContent = cfg.text;
  el.style.background = cfg.bg;
  el.style.color = cfg.color;
}

// ---------------------------------------------------------------------------
// Card highlight
// ---------------------------------------------------------------------------

export const ACTIVE_STYLE  = { borderColor: 'var(--accent-color, #38bdf8)', background: 'rgba(56,189,248,0.10)' };
export const DEFAULT_STYLE = { borderColor: 'var(--border-color, rgba(148,163,184,0.2))', background: 'transparent' };

export function isLlmSource(id) {
  return id !== 'local';
}

function highlightActiveCard(cards, activeId) {
  cards.forEach(card => {
    const isActive = card.dataset.src === activeId;
    card.style.borderColor  = isActive ? ACTIVE_STYLE.borderColor  : DEFAULT_STYLE.borderColor;
    card.style.background   = isActive ? ACTIVE_STYLE.background   : DEFAULT_STYLE.background;
  });
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Initialise the Embedding Source Selector.
 * Safe to call multiple times (idempotent via data attribute guard).
 *
 * @param {typeof adapterRegistry} [registry=adapterRegistry] Seam injection for testing/custom registries
 */
export function initEmbeddingSourceController(registry = adapterRegistry) {
  if (typeof document === 'undefined') return;
  const card = document.getElementById('embeddingSourceCard');
  if (!card || card.dataset.initialized === 'true') return;
  card.dataset.initialized = 'true';

  const badge   = document.getElementById('embSrcActiveBadge');
  const warning = document.getElementById('embSrcLlmWarning');
  const cards   = Array.from(card.querySelectorAll('.emb-src-card'));

  if (cards.length === 0) return;

  // Restore persisted selection
  const current = registry.getActiveVectorizerId();
  highlightActiveCard(cards, current);
  applyBadge(badge, getBadgeConfig(current));
  if (warning) warning.style.display = isLlmSource(current) ? 'block' : 'none';

  // Wire click handlers
  cards.forEach(c => {
    c.addEventListener('click', () => {
      const src = c.dataset.src;
      registry.setActiveVectorizerId(src);

      highlightActiveCard(cards, src);
      applyBadge(badge, getBadgeConfig(src));
      if (warning) warning.style.display = isLlmSource(src) ? 'block' : 'none';
    });
  });

  // Sync if changed from outside (e.g. app:embeddingSourceChanged event)
  window.addEventListener('app:embeddingSourceChanged', (e) => {
    const id = e.detail?.id;
    if (!id) return;
    highlightActiveCard(cards, id);
    applyBadge(badge, getBadgeConfig(id));
    if (warning) warning.style.display = isLlmSource(id) ? 'block' : 'none';
  });
}
