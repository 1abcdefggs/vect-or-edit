import { t } from '../../core/i18n.js';

export function updateCustomPlaceholder(monacoEditorInstance) {
  const model = monacoEditorInstance?.getModel();
  const domNode = monacoEditorInstance?.getDomNode();
  if (!domNode) return;

  let placeholderEl = domNode.querySelector('.monaco-custom-placeholder');
  if (!placeholderEl) {
    placeholderEl = document.createElement('div');
    placeholderEl.className = 'monaco-custom-placeholder';
    placeholderEl.style.cssText = 'position: absolute; top: 12px; left: 54px; color: var(--text-muted, #cbd5e1); opacity: 0.85; font-size: 0.85rem; font-family: inherit; line-height: 1.6; pointer-events: none; user-select: none; z-index: 1; transition: opacity 0.2s ease; display: flex; flex-direction: column; gap: 4px;';
    domNode.appendChild(placeholderEl);
  }

  const val = model?.getValue() || '';
  if (val.length > 0) {
    placeholderEl.style.display = 'none';
    return;
  }

  placeholderEl.style.display = 'flex';
  const slotsCountEl = document.getElementById('knowledgeSlotsCountBadge');
  const slotCount = slotsCountEl ? parseInt(slotsCountEl.textContent, 10) || 0 : 0;

  const line1 = slotCount > 0
    ? t('editor_placeholder_ready')
    : t('editor_placeholder_no_slots');

  const line2 = t('editor_placeholder_intellisense');
  const line3 = t('editor_placeholder_selection');
  const line4 = t('editor_placeholder_contextmenu');
  const line5 = t('editor_placeholder_aimodel');

  placeholderEl.innerHTML = `
    <div style="opacity: 0.9; font-size: 0.78rem; margin-bottom: 8px; color: var(--text-muted, #cbd5e1); font-weight: 500;">(*This description will disappear once you start typing)</div>
    <div style="color: var(--accent-color, #38bdf8); font-weight: 700; margin-bottom: 2px;">${line1}</div>
    <div style="opacity: 0.85;">${line2}</div>
    <div style="opacity: 0.85;">${line3}</div>
    <div style="opacity: 0.85;">${line4}</div>
    <div style="opacity: 0.75;">${line5}</div>
  `;
}

export function bindPlaceholderEvents(monacoEditorInstance) {
  const handler = () => updateCustomPlaceholder(monacoEditorInstance);
  monacoEditorInstance.onDidChangeModelContent(handler);
  monacoEditorInstance.onDidChangeModel(handler);
  window.addEventListener('app:knowledgeSlotChanged', handler);
  window.addEventListener('app:languageChanged', handler);
  setTimeout(handler, 100);
}
