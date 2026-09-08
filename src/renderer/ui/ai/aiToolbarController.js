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

  function updateSettingsOverview(state = aiManager.getState()) {
    const embeddingStatus = document.getElementById('settingsEmbeddingStatus');
    const embeddingDetail = document.getElementById('settingsEmbeddingDetail');
    const embeddingCard = embeddingStatus?.closest('.ai-status-card');
    const generationStatus = document.getElementById('settingsGenerationStatus');
    const generationDetail = document.getElementById('settingsGenerationDetail');
    const knowledgeStatus = document.getElementById('settingsKnowledgeStatus');
    const knowledgeDetail = document.getElementById('settingsKnowledgeDetail');
    const knowledgeCard = knowledgeStatus?.closest('.ai-status-card');
    const structureEmbedding = document.getElementById('settingsStructureEmbedding');
    const structureKnowledge = document.getElementById('settingsStructureKnowledge');
    const structureAssist = document.getElementById('settingsStructureAssist');
    const provider = localStorage.getItem('ai_provider') || 'local';
    const localModel = (localStorage.getItem('vect_local_embedding_model') || 'Xenova/multilingual-e5-small').split('/').pop();

    if (embeddingStatus) embeddingStatus.textContent = window.__isLocalAiModelReady ? 'Ready' : 'Not ready';
    if (embeddingDetail) embeddingDetail.textContent = window.__isLocalAiModelReady ? localModel : 'Install a local vector model';
    if (embeddingCard) embeddingCard.dataset.statusTone = window.__isLocalAiModelReady ? 'ready' : 'neutral';
    if (structureEmbedding) structureEmbedding.textContent = window.__isLocalAiModelReady ? localModel : 'Model not ready';
    if (generationStatus) generationStatus.textContent = provider === 'local' ? 'Local AI' : provider.toUpperCase();
    if (generationDetail) generationDetail.textContent = provider === 'local' ? 'Embedding and local suggestions' : 'Cloud suggestion provider';
    if (knowledgeStatus && window.engineAPI?.getEngineStatus) {
      window.engineAPI.getEngineStatus().then((result) => {
        const count = Number(result?.count || 0);
        knowledgeStatus.textContent = count > 0 ? 'Loaded' : 'Not loaded';
        knowledgeDetail.textContent = count > 0 ? `${count} indexed items` : 'Add a JSON or VENC slot';
        if (knowledgeCard) knowledgeCard.dataset.statusTone = count > 0 ? 'ready' : 'neutral';
        if (structureKnowledge) structureKnowledge.textContent = count > 0 ? `HNSW index (${count})` : 'Knowledge not loaded';
      }).catch(() => {});
    }
    if (structureAssist) structureAssist.textContent = state.master ? 'Master AI ON' : 'Master AI OFF';
  }

  // Sync UI on State Change
  aiManager.addEventListener('app:aiStateChanged', (e) => {
    const state = e.detail;
    updateSettingsOverview(state);

    const settingsMasterStatus = document.getElementById('settingsMasterAiStatus');
    const settingsMasterDetail = document.getElementById('settingsMasterAiDetail');
    const settingsMasterCard = settingsMasterStatus?.closest('.ai-status-card');
    if (settingsMasterStatus) settingsMasterStatus.textContent = state.master ? 'ON' : 'OFF';
    if (settingsMasterDetail) settingsMasterDetail.textContent = state.modelConfigured ? 'Ready to assist' : 'Enable after a model is ready';
    if (settingsMasterCard) settingsMasterCard.dataset.statusTone = state.master ? 'ready' : 'off';
    
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
          if (icon) { icon.innerHTML = 'warning'; icon.style.color = ''; }
          if (text) {
            text.textContent = t('ai_model_unset') || 'No Model';
            text.style.color = '';
            text.style.fontWeight = '';
          }
          btnHeaderModelSettings.classList.remove('model-status-ready');
          btnHeaderModelSettings.classList.add('model-status-unconfigured');
          btnHeaderModelSettings.style.borderColor = '';
          btnHeaderModelSettings.style.background = '';
          btnHeaderModelSettings.title = t('ai_model_unset_toast') || 'No AI model configured. Click to configure.';
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
          else if (provider === 'gemini') modelName = localStorage.getItem('gemini_model') || 'Gemini 1.5';
          else if (provider === 'openai') modelName = localStorage.getItem('openai_model') || 'GPT-4o';
          else if (provider === 'claude') modelName = localStorage.getItem('claude_model') || 'Claude 3.5';

          if (icon) { icon.innerHTML = '&#xf3aa;'; icon.style.color = ''; }
          if (text) { text.textContent = modelName; text.style.color = ''; text.style.fontWeight = ''; }
          btnHeaderModelSettings.classList.remove('model-status-unconfigured');
          btnHeaderModelSettings.classList.add('model-status-ready');
          btnHeaderModelSettings.style.borderColor = '';
          btnHeaderModelSettings.style.background = '';
          btnHeaderModelSettings.title = t('ai_model_badge_tooltip') || 'AI Model Settings';
        }
      }
    }

    if (masterAiStatusDot) masterAiStatusDot.style.color = state.master ? 'var(--success-color, #10b981)' : '#ef4444';

    const monacoContainerEl = document.getElementById('monacoContainer');
    if (btnEditorAiToggle) {
      btnEditorAiToggle.style.opacity = state.master ? '1' : '0.5';
      if (state.editor) {
        btnEditorAiToggle.classList.add('active');
      } else {
        btnEditorAiToggle.classList.remove('active');
      }
      btnEditorAiToggle.style.background = '';
      btnEditorAiToggle.style.borderColor = '';
      btnEditorAiToggle.style.color = '';
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
        btnSidebarAiToggle.classList.add('active');
      } else {
        btnSidebarAiToggle.classList.remove('active');
      }
      btnSidebarAiToggle.style.background = '';
      btnSidebarAiToggle.style.borderColor = '';
      btnSidebarAiToggle.style.color = '';
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
    const provider = localStorage.getItem('ai_provider') || 'local';
    let modelName = t('ai_model_unset') || 'No Model';
    let isReady = false;

    if (provider === 'local') {
      if (window.__isLocalAiModelReady) {
        modelName = 'e5-small (Local)';
        isReady = true;
      }
    } else if (provider === 'claude') {
      const apiKey = localStorage.getItem('claude_api_key');
      if (apiKey) {
        modelName = 'Claude 3.5';
        isReady = true;
      }
    } else if (provider === 'gemini') {
      const apiKey = localStorage.getItem('gemini_api_key');
      if (apiKey) {
        modelName = 'Gemini 1.5';
        isReady = true;
      }
    } else if (provider === 'openai') {
      const apiKey = localStorage.getItem('openai_api_key');
      if (apiKey) {
        modelName = 'GPT-4o';
        isReady = true;
      }
    }

    if (masterAiModelNameText) {
      masterAiModelNameText.textContent = modelName;
      masterAiModelNameText.style.color = isReady ? '#38bdf8' : '#f59e0b';
    }

    const btnHeaderModelSettings = document.getElementById('btnHeaderModelSettings');
    if (btnHeaderModelSettings) {
      const icon = btnHeaderModelSettings.querySelector('.material-symbols-outlined');
      const text = btnHeaderModelSettings.querySelector('.icon-label-text');
      if (icon) {
        icon.innerHTML = isReady ? '&#xf3aa;' : 'warning';
        icon.style.color = '';
      }
      if (text) {
        text.textContent = modelName;
        text.style.color = '';
        text.style.fontWeight = '';
      }
      if (isReady) {
        btnHeaderModelSettings.classList.remove('model-status-unconfigured');
        btnHeaderModelSettings.classList.add('model-status-ready');
      } else {
        btnHeaderModelSettings.classList.remove('model-status-ready');
        btnHeaderModelSettings.classList.add('model-status-unconfigured');
      }
      btnHeaderModelSettings.style.borderColor = '';
      btnHeaderModelSettings.style.background = '';
      btnHeaderModelSettings.title = isReady ? (t('ai_model_badge_tooltip') || 'AI Model Settings') : (t('ai_model_unset_toast') || 'No AI model configured. Click to configure.');
    }
  }

  function openAiSettingsTab() {
    window.dispatchEvent(new CustomEvent('app:openSettings', { detail: { tab: 'tabAiSearch' } }));
  }

  if (masterAiModelNameBadge) masterAiModelNameBadge.addEventListener('click', openAiSettingsTab);
  const btnHeaderModelSettings = document.getElementById('btnHeaderModelSettings');
  if (btnHeaderModelSettings) btnHeaderModelSettings.addEventListener('click', openAiSettingsTab);

  updateMasterAiModelBadge();
  updateSettingsOverview();
  document.getElementById('btnOpenAiStructureSettings')?.addEventListener('click', () => {
    document.getElementById('aiProviderModelSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  window.addEventListener('app:settingsChanged', () => {
    const isConfigured = isAiModelConfigured();
    aiManager.setModelConfigured(isConfigured);
    updateMasterAiModelBadge();
    updateSettingsOverview();
  });

    if (masterAiTogglePill) {
      masterAiTogglePill.addEventListener('click', () => {
        const state = aiManager.getState();
        if (!state.master) {
          if (!state.modelConfigured) {
            showToast(t('ai_model_unset_toast'), 'warning', {
              label: t('btn_open_settings') || 'Open Settings',
              onClick: openAiSettingsTab
            });
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
      if (!state.modelConfigured) {
        showToast(t('ai_model_unset_toast'), 'warning', {
          label: t('btn_open_settings') || 'Open Settings',
          onClick: openAiSettingsTab
        });
        openAiSettingsTab();
        return;
      }
      if (!state.master) {
        // Auto-turn on Master AI when user wants to use Editor AI
        aiManager.setMasterAi(true);
        aiManager.setEditorAi(true);
        showToast(t('toast_editor_ai_auto_enabled'), 'success');
        return;
      }
      const nextEditor = !state.editor;
      aiManager.setEditorAi(nextEditor);
      showToast(nextEditor ? t('toast_editor_ai_on') : t('toast_editor_ai_off'), nextEditor ? 'success' : 'info');
    });
  }

  if (btnSidebarAiToggle) {
    btnSidebarAiToggle.addEventListener('click', () => {
      const state = aiManager.getState();
      if (!state.modelConfigured) {
        showToast(t('ai_model_unset_toast'), 'warning', {
          label: t('btn_open_settings') || 'Open Settings',
          onClick: openAiSettingsTab
        });
        openAiSettingsTab();
        return;
      }
      if (!state.master) {
        // Auto-turn on Master AI when user wants to use Suggest AI
        aiManager.setMasterAi(true);
        aiManager.setSidebarAi(true);
        showToast(t('toast_sidebar_ai_auto_enabled'), 'success');
        return;
      }
      const nextSidebar = !state.sidebar;
      aiManager.setSidebarAi(nextSidebar);
      showToast(nextSidebar ? t('toast_sidebar_ai_on') : t('toast_sidebar_ai_off'), nextSidebar ? 'success' : 'info');
    });
  }

  // Model Download Complete: Prompt to enable Master AI if it is currently OFF
  window.addEventListener('app:aiModelProgress', (e) => {
    const { status, model } = e.detail || {};
    if (status === 'ready' || status === 'done') {
      const state = aiManager.getState();
      if (!state.master) {
        const modelName = (model || 'Local Model').split('/').pop();
        const title = t('toast_model_downloaded_title') || `${modelName} is ready. Turn ON Master AI now?`;
        showToast(title, 'info', [
          {
            label: t('btn_enable_master_ai') || 'Turn ON Master AI',
            onClick: () => {
              aiManager.setMasterAi(true);
              aiManager.setEditorAi(true);
              showToast(t('toast_master_ai_activated') || 'Master AI: ON', 'success');
            }
          },
          {
            label: t('btn_keep_standby') || 'Keep Standby',
            secondary: true,
            onClick: () => {
              showToast(t('toast_master_ai_standby') || 'Master AI: Standby', 'info');
            }
          }
        ]);
      }
    }
  });
}
