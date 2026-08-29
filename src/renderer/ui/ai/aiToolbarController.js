import { aiManager } from '../../core/aiStateManager.js';
import { isAiModelConfigured } from '../settings/settingsState.js';
import { t } from '../../core/i18n.js';
import { showToast } from '../notifications/toastManager.js';

export function initAiControls() {
  const isMasterAiOn = isAiModelConfigured();
  aiManager.init(isMasterAiOn);

  const masterAiTogglePill = document.getElementById('masterAiTogglePill');
  const masterAiStatusDot = document.getElementById('masterAiStatusDot');
  const btnEditorAiToggle = document.getElementById('btnEditorAiToggle');
  const editorAiStatusDot = document.getElementById('editorAiStatusDot');
  const editorAiLabel = document.getElementById('editorAiLabel');
  const btnSidebarAiToggle = document.getElementById('btnSidebarAiToggle');
  const activeAiModelStatusDot = document.getElementById('activeAiModelStatusDot');
  const activeAiModelBadge = document.getElementById('activeAiModelBadge');
  const consoleAiInputGroup = document.getElementById('consoleAiInputGroup');
  const masterAiModelNameBadge = document.getElementById('masterAiModelNameBadge');
  const masterAiModelNameText = document.getElementById('masterAiModelNameText');
  const btnMasterAiReload = document.getElementById('btnMasterAiReload');

  // Sync UI on State Change
  aiManager.addEventListener('app:aiStateChanged', (e) => {
    const state = e.detail;
    
    if (masterAiTogglePill) {
      if (state.master) masterAiTogglePill.classList.add('active');
      else masterAiTogglePill.classList.remove('active');

      const btnHeaderModelSettings = document.getElementById('btnHeaderModelSettings');
      
      if (!state.modelConfigured) {
        masterAiTogglePill.classList.add('disabled');
        masterAiTogglePill.setAttribute('data-instant-tooltip', t('ai_model_unset_toast') || 'AI Model is not set.\nPlease select a model from settings.');
        masterAiTogglePill.removeAttribute('title');
        
        if (btnHeaderModelSettings) {
          const icon = btnHeaderModelSettings.querySelector('.material-symbols-outlined');
          const text = btnHeaderModelSettings.querySelector('.icon-label-text');
          if (icon) { icon.innerHTML = 'error'; icon.style.color = '#ef4444'; }
          if (text) { text.textContent = 'No Model'; text.style.color = '#ef4444'; text.style.fontWeight = 'bold'; }
        }
      } else {
        masterAiTogglePill.classList.remove('disabled');
        masterAiTogglePill.removeAttribute('data-instant-tooltip');
        masterAiTogglePill.title = t('toggle_master_ai') || 'Toggle Master AI';
        
        if (btnHeaderModelSettings) {
          const icon = btnHeaderModelSettings.querySelector('.material-symbols-outlined');
          const text = btnHeaderModelSettings.querySelector('.icon-label-text');
          
          let modelName = 'Model';
          const provider = localStorage.getItem('ai_provider') || 'local';
          if (provider === 'local') modelName = 'e5-small (Local)';
          else if (provider === 'gemini') modelName = localStorage.getItem('gemini_model') || 'Gemini';
          else if (provider === 'openai') modelName = localStorage.getItem('openai_model') || 'GPT-4o';
          else if (provider === 'claude') modelName = localStorage.getItem('claude_model') || 'Claude';

          if (icon) { icon.innerHTML = '&#xf3aa;'; icon.style.color = 'var(--accent-color, #38bdf8)'; }
          if (text) { text.textContent = modelName; text.style.color = ''; text.style.fontWeight = ''; }
        }
      }
    }

    if (masterAiStatusDot) masterAiStatusDot.style.color = state.master ? 'var(--success-color, #10b981)' : '#ef4444';

    const monacoContainerEl = document.getElementById('monacoContainer');
    if (btnEditorAiToggle) {
      btnEditorAiToggle.style.opacity = state.master ? '1' : '0.5';
      if (state.editor) {
        btnEditorAiToggle.style.background = 'rgba(16, 185, 129, 0.12)';
        btnEditorAiToggle.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        btnEditorAiToggle.style.color = '#10b981';
      } else {
        btnEditorAiToggle.style.background = 'rgba(255, 255, 255, 0.05)';
        btnEditorAiToggle.style.borderColor = 'var(--border-color, rgba(148, 163, 184, 0.2))';
        btnEditorAiToggle.style.color = 'var(--text-muted, #94a3b8)';
      }
      if (editorAiLabel) {
        editorAiLabel.textContent = state.editor ? (t('editor_ai_on') || 'Editor AI ON') : (t('editor_ai_off') || 'Editor AI OFF');
      }
    }
    if (editorAiStatusDot) editorAiStatusDot.style.color = state.editor ? 'var(--success-color, #10b981)' : '#ef4444';
    if (monacoContainerEl) {
      if (state.editor) monacoContainerEl.classList.add('glow-editor-active');
      else monacoContainerEl.classList.remove('glow-editor-active');
    }

    if (btnSidebarAiToggle) {
      btnSidebarAiToggle.style.opacity = state.master ? '1' : '0.5';
      if (state.sidebar) {
        btnSidebarAiToggle.style.background = 'rgba(16, 185, 129, 0.12)';
        btnSidebarAiToggle.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        btnSidebarAiToggle.style.color = '#10b981';
      } else {
        btnSidebarAiToggle.style.background = 'rgba(255, 255, 255, 0.05)';
        btnSidebarAiToggle.style.borderColor = 'var(--border-color, rgba(148, 163, 184, 0.2))';
        btnSidebarAiToggle.style.color = 'var(--text-muted, #94a3b8)';
      }
      if (activeAiModelBadge) activeAiModelBadge.textContent = state.sidebar ? (t('sidebar_ai_on') || 'SUGGEST AI ON') : (t('sidebar_ai_off') || 'SUGGEST AI OFF');
    }
    if (activeAiModelStatusDot) activeAiModelStatusDot.style.color = state.sidebar ? 'var(--success-color, #10b981)' : '#ef4444';

    if (state.master) {
      document.body.classList.add('master-ai-active', 'glow-master-active');
      document.body.classList.remove('master-ai-standby');
      if (consoleAiInputGroup) consoleAiInputGroup.style.display = 'flex';
    } else {
      document.body.classList.remove('master-ai-active', 'glow-master-active');
      document.body.classList.add('master-ai-standby');
      if (consoleAiInputGroup) consoleAiInputGroup.style.display = 'none';
    }

    const editorContainer = document.querySelector('.editor-section');
    if (editorContainer) {
      if (state.editor) editorContainer.classList.add('glow-editor-active');
      else editorContainer.classList.remove('glow-editor-active');
    }
  });

  function updateMasterAiModelBadge() {
    if (!masterAiModelNameText) return;
    const provider = localStorage.getItem('ai_provider') || 'local';
    if (provider === 'local') {
      if (window.__isLocalAiModelReady) {
        masterAiModelNameText.textContent = 'e5-small (Local)';
        masterAiModelNameText.style.color = '#38bdf8';
      } else {
        masterAiModelNameText.textContent = t('ai_model_unset');
        masterAiModelNameText.style.color = '#f59e0b';
      }
    } else if (provider === 'claude') {
      const apiKey = localStorage.getItem('claude_api_key');
      masterAiModelNameText.textContent = apiKey ? 'Claude 3.5' : t('ai_model_unset');
      masterAiModelNameText.style.color = apiKey ? '#38bdf8' : '#f59e0b';
    } else if (provider === 'gemini') {
      const apiKey = localStorage.getItem('gemini_api_key');
      masterAiModelNameText.textContent = apiKey ? 'Gemini 1.5' : t('ai_model_unset');
      masterAiModelNameText.style.color = apiKey ? '#38bdf8' : '#f59e0b';
    } else if (provider === 'openai') {
      const apiKey = localStorage.getItem('openai_api_key');
      masterAiModelNameText.textContent = apiKey ? 'GPT-4o' : t('ai_model_unset');
      masterAiModelNameText.style.color = apiKey ? '#38bdf8' : '#f59e0b';
    } else {
      masterAiModelNameText.textContent = t('ai_model_unset');
      masterAiModelNameText.style.color = '#f59e0b';
    }
  }

  function openAiSettingsTab() {
    const btnSettings = document.getElementById('btnSettings');
    if (btnSettings) {
      btnSettings.click();
      setTimeout(() => {
        const aiTabBtn = document.querySelector('.settings-tab-btn[data-tab="ai"]');
        if (aiTabBtn) aiTabBtn.click();
      }, 60);
    }
  }

  if (masterAiModelNameBadge) masterAiModelNameBadge.addEventListener('click', openAiSettingsTab);
  const btnHeaderModelSettings = document.getElementById('btnHeaderModelSettings');
  if (btnHeaderModelSettings) btnHeaderModelSettings.addEventListener('click', openAiSettingsTab);

  updateMasterAiModelBadge();
  window.addEventListener('app:settingsChanged', () => {
    const isConfigured = isAiModelConfigured();
    aiManager.setModelConfigured(isConfigured);
    updateMasterAiModelBadge();
  });

  if (masterAiTogglePill) {
    masterAiTogglePill.addEventListener('click', () => {
      const state = aiManager.getState();
      if (!state.master) {
        if (!state.modelConfigured) {
          showToast(t('ai_model_unset_toast'), 'warning');
          openAiSettingsTab();
          return;
        }
        aiManager.setMasterAi(true);
        showToast(t('toast_master_ai_activated'), 'success');
      } else {
        aiManager.setMasterAi(false);
        showToast(t('toast_master_ai_standby'), 'info');
      }
    });
  }

  if (btnEditorAiToggle) {
    btnEditorAiToggle.addEventListener('click', () => {
      const state = aiManager.getState();
      if (!state.master) {
        showToast(t('toast_turn_master_ai_on_first'), 'warning');
        return;
      }
      aiManager.setEditorAi(!state.editor);
    });
  }

  if (btnSidebarAiToggle) {
    btnSidebarAiToggle.addEventListener('click', () => {
      const state = aiManager.getState();
      if (!state.master) {
        showToast(t('toast_turn_master_ai_on_first'), 'warning');
        return;
      }
      aiManager.setSidebarAi(!state.sidebar);
    });
  }
}
