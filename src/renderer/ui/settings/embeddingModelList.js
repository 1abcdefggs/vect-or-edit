/**
 * Embedding model cards in Settings: Download / Use / Active.
 * Download fetches the model files only; Use switches the active model.
 */
import { i18n } from '../../core/i18n.js';
import { EMBEDDING_MODELS, getActiveModelId, getDownloadedModelIds } from '../../search/embeddingModels.js';
import { requestEmbeddingModelDownload } from '../../search/searchLocalAi.js';

/** modelId -> download percentage, for models being fetched right now */
const downloading = new Map();

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function actionButton(label, onClick, primary = false) {
  const btn = el('button', primary ? 'toolbar-btn primary' : 'toolbar-btn', label);
  btn.type = 'button';
  btn.addEventListener('click', onClick);
  return btn;
}

function renderCard(model, ctx) {
  const card = el('div', 'embedding-model-card');
  card.dataset.modelId = model.id;
  card.style.cssText = 'display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 12px; border: var(--border-width) solid var(--border-color); border-radius: 6px;';

  const info = el('div');
  const name = el('div', 'embedding-model-name', model.id);
  name.style.cssText = 'font-family: var(--font-mono, monospace); font-size: var(--fs-12); font-weight: 600;';
  const meta = el('div', 'embedding-model-meta', `${model.dim}-dim · ~${model.sizeMB} MB · ${model.language}`);
  meta.style.cssText = 'font-size: var(--fs-11); color: var(--text-muted);';
  info.append(name, meta);

  const action = el('div', 'embedding-model-action');
  action.style.cssText = 'display: flex; align-items: center; gap: 8px; white-space: nowrap;';
  if (model.id === ctx.activeId) {
    const badge = el('span', 'model-active-badge', i18n.embedding_model_active || 'Active');
    badge.style.cssText = 'background: rgba(16,185,129,0.2); color: #10b981; padding: 1px 6px; border-radius: 3px; font-size: var(--fs-10);';
    action.append(badge);
  } else if (downloading.has(model.id)) {
    action.append(el('span', 'embedding-model-progress', `${downloading.get(model.id)}%`));
  } else if (ctx.downloadedIds.has(model.id)) {
    action.append(actionButton(i18n.embedding_model_use || 'Use', () => ctx.onUse(model.id), true));
  } else {
    action.append(actionButton(i18n.embedding_model_download || 'Download', () => {
      downloading.set(model.id, 0);
      requestEmbeddingModelDownload(model.id);
      renderEmbeddingModelList(ctx.container, { onUse: ctx.onUse });
    }));
  }

  card.append(info, action);
  return card;
}

/**
 * Render the catalog into the container. Safe to call again on every state change.
 * @param {HTMLElement} container - the #embeddingModelList element
 * @param {{ onUse: (modelId: string) => void }} handlers
 */
export function renderEmbeddingModelList(container, { onUse }) {
  if (!container) return;
  const ctx = {
    container,
    onUse,
    activeId: getActiveModelId(),
    downloadedIds: getDownloadedModelIds()
  };
  container.replaceChildren(...EMBEDDING_MODELS.map(model => renderCard(model, ctx)));
}

/** Keep the cards in sync with worker download events and model changes. */
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
}
