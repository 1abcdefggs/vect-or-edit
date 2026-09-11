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

    // 4. Resolve Tone-aware Canvas Contrast (Charcoal, Obsidian, OLED, Ivory, Paper, etc.)
    const currentTone = localStorage.getItem('editor_bg_tone') || 'default';
    const isCharcoal = currentTone === 'charcoal' || currentTone === 'dark_charcoal';
    const isLightTone = ['ivory', 'light_ivory', 'warmWhite', 'light_warm', 'snow', 'light_snow', 'paper', 'light_paper'].includes(currentTone);

    let boxBg = 'rgba(255, 255, 255, 0.03)';
    let boxBorder = '1px dashed var(--border-color, rgba(255, 255, 255, 0.18))';
    let boxTextMain = 'var(--text-main, #f8fafc)';
    let boxTextMuted = 'var(--text-muted, #94a3b8)';

    if (isCharcoal) {
      boxBg = 'rgba(255, 255, 255, 0.05)';
      boxBorder = '1px dashed rgba(255, 255, 255, 0.22)';
      boxTextMain = '#ffffff';
      boxTextMuted = '#a1a1aa';
    } else if (isLightTone) {
      boxBg = 'rgba(0, 0, 0, 0.02)';
      boxBorder = '1px dashed rgba(0, 0, 0, 0.16)';
      boxTextMain = '#18181b';
      boxTextMuted = '#71717a';
    }

    placeholderEl.style.fontFamily = activeFontFamily;

    placeholderEl.innerHTML = `
    <!-- 1. Top System Bar (Typography & Dismiss Hint) -->
    <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; font-family: var(--font-mono, monospace); font-size: 0.72rem; color: ${boxTextMuted}; padding-bottom: 6px; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
      <div style="display: inline-flex; align-items: center; gap: 8px;">
        <span style="color: var(--accent-color, #38bdf8); font-weight: 600;">[ ${activeFontName} | ${activeFontSize}px ]</span>
        <span style="opacity: 0.85;">${t('placeholder_hint')}</span>
      </div>
      <div style="display: inline-flex; align-items: center; gap: 8px;">
        ${aiStatusHtml}
      </div>
    </div>

    <!-- 2. Clean Compact Guidance List (Aligned with line numbers) -->
    <div style="display: flex; flex-direction: column; gap: 4px; font-size: 0.82rem; line-height: 1.55; color: ${boxTextMuted}; margin-top: 6px; font-family: var(--font-family, sans-serif);">
      <div>${kbLine}</div>
      <div><span style="color: var(--accent-color, #38bdf8); font-weight: 600;">- </span>${t('editor_placeholder_intellisense')}</div>
      <div><span style="color: var(--accent-color, #38bdf8); font-weight: 600;">- </span>${t('editor_placeholder_selection')}</div>
      <div><span style="color: var(--accent-color, #38bdf8); font-weight: 600;">- </span>${t('editor_placeholder_contextmenu')}</div>
      <div><span style="color: var(--accent-color, #38bdf8); font-weight: 600;">- </span>${t('editor_placeholder_aimodel')}</div>
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
  window.addEventListener('app:editorToneChanged', handler);
  aiManager.addEventListener('app:aiStateChanged', handler);

  // Re-render sample when font family or font size selects change (direct & delegation)
  const fontFamilySelect = document.getElementById('fontFamilySelect');
  const fontSizeSelect = document.getElementById('fontSizeSelect');
  if (fontFamilySelect) fontFamilySelect.addEventListener('change', handler);
  if (fontSizeSelect) fontSizeSelect.addEventListener('change', handler);

  const quickEditorToneSelect = document.getElementById('quickEditorToneSelect');
  if (quickEditorToneSelect) quickEditorToneSelect.addEventListener('change', handler);

  document.addEventListener('change', (e) => {
    if (e.target?.id === 'fontFamilySelect' || e.target?.id === 'fontSizeSelect' || e.target?.id === 'modalFontFamilySelect' || e.target?.id === 'modalFontSizeSelect' || e.target?.id === 'quickEditorToneSelect' || e.target?.id === 'modalEditorBgSelect') {
      handler();
    }
  });

  setTimeout(handler, 100);
}
