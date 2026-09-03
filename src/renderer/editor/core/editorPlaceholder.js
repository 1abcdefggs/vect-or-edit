import { t } from '../../core/i18n.js';
import { aiManager } from '../../core/aiStateManager.js';

export function updateCustomPlaceholder(monacoEditorInstance) {
  const model = monacoEditorInstance?.getModel();
  const domNode = monacoEditorInstance?.getDomNode();
  if (!domNode) return;

  let placeholderEl = domNode.querySelector('.monaco-custom-placeholder');
  if (!placeholderEl) {
    placeholderEl = document.createElement('div');
    placeholderEl.className = 'monaco-custom-placeholder';
    placeholderEl.style.cssText = 'position: absolute; top: 12px; left: 54px; right: 40px; color: var(--text-muted, #cbd5e1); opacity: 0.9; pointer-events: none; user-select: none; z-index: 1; transition: opacity 0.2s ease; display: flex; flex-direction: column; gap: 8px;';
    domNode.appendChild(placeholderEl);
  }

  const val = model?.getValue() || '';
  if (val.length > 0) {
    placeholderEl.style.display = 'none';
    return;
  }

  placeholderEl.style.display = 'flex';

  // 1. Get current typography settings
  const fontFamilySelect = document.getElementById('fontFamilySelect');
  const fontSizeSelect = document.getElementById('fontSizeSelect');
  const activeFontFamily = fontFamilySelect?.value || "'Source Serif 4', 'Noto Serif JP', serif";
  const activeFontSize = parseInt(fontSizeSelect?.value || '16', 10);
  const activeFontName = fontFamilySelect?.selectedOptions?.[0]?.text?.trim() || 'Source Serif 4';

  // 2. Resolve AI Status & Guidance
  const aiState = aiManager.getState();
  let aiStatusHtml = '';
  if (!aiState.modelConfigured) {
    aiStatusHtml = `<span style="color: #f59e0b; display: inline-flex; align-items: center; gap: 4px; background: rgba(245, 158, 11, 0.12); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(245, 158, 11, 0.3);">[ AI Model: ${t('ai_model_unset')} ] ${t('placeholder_ai_unset_hint')}</span>`;
  } else if (!aiState.master) {
    aiStatusHtml = `<span style="color: #94a3b8; display: inline-flex; align-items: center; gap: 4px; background: rgba(148, 163, 184, 0.1); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(148, 163, 184, 0.2);">[ Master AI: OFF ] ${t('placeholder_master_off_hint')}</span>`;
  } else {
    const editorStatus = aiState.editor ? '<span style="color: #10b981;">Editor AI: ON</span>' : '<span style="color: #94a3b8;">Editor AI: OFF</span>';
    const sidebarStatus = aiState.sidebar ? '<span style="color: #38bdf8;">Suggest AI: ON</span>' : '<span style="color: #94a3b8;">Suggest AI: OFF</span>';
    aiStatusHtml = `<span style="display: inline-flex; align-items: center; gap: 8px; background: rgba(16, 185, 129, 0.1); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.25);"><span style="font-weight: 700; color: #10b981;">[ Master AI: ON ]</span> (${editorStatus} / ${sidebarStatus})</span>`;
  }

  // 3. Knowledge Status
  const slotsCountEl = document.getElementById('knowledgeSlotsCountBadge');
  const slotCount = slotsCountEl ? parseInt(slotsCountEl.textContent, 10) || 0 : 0;
  const kbLine = slotCount > 0
    ? `<span style="color: #38bdf8;">- ${t('editor_placeholder_ready')}</span>`
    : `<span style="color: #94a3b8;">${t('placeholder_no_slots')}</span>`;

  // 4. Render Rich Interactive Placeholder & Typography Sample
  const sampleHeadingText = t('sample_heading', { font: activeFontName, size: Math.round(activeFontSize * 1.25) });
  const sampleBodyText = t('sample_body', { font: activeFontName, size: activeFontSize });

  placeholderEl.innerHTML = `
    <div style="opacity: 0.7; font-size: 0.72rem; font-family: var(--font-mono, monospace); color: var(--text-muted, #cbd5e1);">
      ${t('placeholder_hint')}
    </div>

    <!-- AI & Knowledge Live Status -->
    <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 0.75rem; margin-top: 2px;">
      ${aiStatusHtml}
    </div>

    <!-- Core Feature Hints -->
    <div style="display: flex; flex-direction: column; gap: 3px; font-size: 0.80rem; margin-top: 4px; line-height: 1.5;">
      <div>${kbLine}</div>
      <div>- ${t('editor_placeholder_intellisense')}</div>
      <div>- ${t('editor_placeholder_selection')}</div>
      <div>- ${t('editor_placeholder_contextmenu')}</div>
    </div>

    <!-- Typography Sample Preview (reflects current fontFamily & fontSize as dynamic text) -->
    <div style="font-family: ${activeFontFamily}; border: 1px dashed var(--border-color, rgba(255,255,255,0.15)); border-radius: 8px; padding: 10px 14px; background: rgba(0,0,0,0.15); margin-top: 6px; max-width: 680px;">
      <div style="font-size: 0.70rem; color: var(--text-muted); margin-bottom: 6px; font-family: var(--font-mono, monospace); letter-spacing: 0.5px;">
        [ ${t('sample_preview_title')} | ${t('sample_preview_family')}: <strong style="color: var(--accent-color, #38bdf8);">${activeFontName}</strong> | ${t('sample_preview_size')}: <strong style="color: var(--accent-color, #38bdf8);">${activeFontSize}px</strong> ]
      </div>
      <div style="font-size: ${Math.round(activeFontSize * 1.25)}px; font-weight: 700; color: var(--text-main); line-height: 1.35;">
        ${sampleHeadingText}
      </div>
      <div style="font-size: ${activeFontSize}px; color: var(--text-main); opacity: 0.92; margin-top: 6px; line-height: 1.6;">
        ${sampleBodyText}
      </div>
    </div>
  `;
}

export function bindPlaceholderEvents(monacoEditorInstance) {
  const handler = () => updateCustomPlaceholder(monacoEditorInstance);
  monacoEditorInstance.onDidChangeModelContent(handler);
  monacoEditorInstance.onDidChangeModel(handler);
  window.addEventListener('app:knowledgeSlotChanged', handler);
  window.addEventListener('app:languageChanged', handler);
  window.addEventListener('app:settingsChanged', handler);
  aiManager.addEventListener('app:aiStateChanged', handler);

  // Re-render sample when font family or font size selects change (direct & delegation)
  const fontFamilySelect = document.getElementById('fontFamilySelect');
  const fontSizeSelect = document.getElementById('fontSizeSelect');
  if (fontFamilySelect) fontFamilySelect.addEventListener('change', handler);
  if (fontSizeSelect) fontSizeSelect.addEventListener('change', handler);

  document.addEventListener('change', (e) => {
    if (e.target?.id === 'fontFamilySelect' || e.target?.id === 'fontSizeSelect' || e.target?.id === 'modalFontFamilySelect' || e.target?.id === 'modalFontSizeSelect') {
      handler();
    }
  });

  setTimeout(handler, 100);
}
