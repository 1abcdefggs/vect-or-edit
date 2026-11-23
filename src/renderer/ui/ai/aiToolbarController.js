import { aiManager } from '../../core/aiStateManager.js';
import { readStorage, writeStorage } from '../../core/storage.js';
import { STORAGE_KEYS, DEFAULTS } from '../../core/constants.js';
import { llmSetupTargetId } from '../settings/llmSwitchLock.js';
import { icons } from '../../core/icons.js';
import { isApiKeyConfigured, saveApiKey } from '../../core/apiKeyStore.js';
import { isLlmConfigured, isEmbedConfigured } from '../settings/settingsState.js';
import { canUseLlm } from '../../core/aiAccess.js';
import { withHelpContext } from '../help/helpKnowledge.js';
import { t } from '../../core/i18n.js';
import { escapeHtml } from '../../core/escape.js';
import { rememberGeminiModels } from '../settings/geminiModelPicker.js';
import { readGeminiModel } from '../../core/geminiModel.js';
import { llmProviderName } from '../../../shared/llmProviders';
import { showToast } from '../notifications/toastManager.js';
import { showConfirmModal } from '../notifications/confirmModal.js';
import { shouldSendOnKey } from './chatInputKeys.js';
import { openModelQuickMenu } from './modelQuickMenu.js';
import { queryLlmChat } from '../../search/searchProviders.js';
import { buildChatMarkdown, chatExportFileName } from './chatExport.js';
import { applyAiOutputToEditor, insertTextIntoEditor } from '../../editor/editorManager.js';

const KEY_PLACEHOLDERS = { openai: 'sk-proj-...', claude: 'sk-ant-api03-...', gemini: 'AIzaSy... (Gemini)' };

/** Draws an ON/OFF switch pill: the switch state (aria-checked on the whole button), the knob side and the lit word all follow `on`. */
function drawAiSwitch(button, on) {
  if (!button) return;
  button.setAttribute('aria-checked', String(on));
  button.querySelector('[data-side="on"]')?.classList.toggle('is-lit', on);
  button.querySelector('[data-side="off"]')?.classList.toggle('is-lit', !on);
}

/**
 * The embedding switch while its model is still being installed: neither word is lit, and the OFF word says it is preparing.
 * Showing OFF lit would read as "switched off by the user", which is not the case.
 */
function paintEmbedSwitch(button, on) {
  if (!button) return;
  const installing = button.dataset.installing === 'true';
  drawAiSwitch(button, on);
  if (installing) {
    button.querySelectorAll('.toggle-switch-word').forEach((word) => word.classList.remove('is-lit'));
  }
  const offWord = button.querySelector('[data-side="off"]');
  if (offWord) offWord.textContent = installing ? t('embed_switch_preparing') : t('opt_toggle_off');
}

/** Opens the settings page at a card. Module level: both the chat dock and the switch use it */
function openAiSettingsTab(tab = 'tabAiSearch', card, focus) {
  window.dispatchEvent(new CustomEvent('app:openSettings', { detail: { tab, card, focus } }));
}

/** Shown in the chat when a send needs a model that is not chosen yet. The prompt stays in the input */
function showModelNeededNotice(chatMessages) {
  const note = document.createElement('div');
  note.className = 'llm-msg llm-msg-system';
  note.innerHTML = `
    <span class="material-symbols-outlined" style="font-size: var(--icon-text-size); color: var(--accent-color, #38bdf8);">info</span>
    <span>${escapeHtml(t('llm_model_needed_msg'))}</span>
    <button type="button" class="llm-action-btn btn-open-model-list">${escapeHtml(t('llm_open_model_list'))}</button>
  `;
  note.querySelector('.btn-open-model-list')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('app:openLogModels')));
  chatMessages.appendChild(note);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

export function initAiControls() {
  aiManager.init({ llm: isLlmConfigured(), embed: isEmbedConfigured() });

  const btnEditorAiToggle = document.getElementById('btnEditorAiToggle');
  const editorAiStatusDot = document.getElementById('editorAiStatusDot');
  const activeAiModelStatusDot = document.getElementById('activeAiModelStatusDot');

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
    // The LLM card shows the cloud LLM provider (llm_provider), not the search generator key (ai_provider)
    const llmProvider = readStorage(STORAGE_KEYS.LLM_PROVIDER) || DEFAULTS.LLM_PROVIDER;
    const hasLlmProvider = llmProvider !== 'none';
    const localModel = (readStorage('vect_local_embedding_model') || 'Xenova/multilingual-e5-small').split('/').pop();

    if (embeddingStatus) embeddingStatus.textContent = window.__isLocalAiModelReady ? t('ai_status_ready') : t('ai_status_not_ready');
    if (embeddingDetail) embeddingDetail.textContent = window.__isLocalAiModelReady ? localModel : t('ai_detail_install_model');
    if (embeddingCard) embeddingCard.dataset.statusTone = window.__isLocalAiModelReady ? 'ready' : 'neutral';
    if (structureEmbedding) structureEmbedding.textContent = window.__isLocalAiModelReady ? localModel : t('ai_structure_model_not_ready');
    if (generationStatus) generationStatus.textContent = hasLlmProvider ? llmProviderName(llmProvider) : t('ai_status_not_configured');
    if (generationDetail) generationDetail.textContent = hasLlmProvider ? t('ai_status_cloud_suggest') : t('ai_detail_local_suggest');
    if (knowledgeStatus && window.engineAPI?.getEngineStatus) {
      window.engineAPI.getEngineStatus().then((result) => {
        const count = Number(result?.count || 0);
        knowledgeStatus.textContent = count > 0 ? t('ai_status_loaded') : t('ai_status_not_loaded');
        knowledgeDetail.textContent = count > 0 ? t('ai_status_indexed_items', { count }) : t('ai_status_add_slot');
        if (knowledgeCard) knowledgeCard.dataset.statusTone = count > 0 ? 'ready' : 'neutral';
        if (structureKnowledge) structureKnowledge.textContent = count > 0 ? t('ai_structure_hnsw_count', { count }) : t('ai_structure_knowledge_missing');
      }).catch(() => { });
    }
  }

  // Sync UI on State Change
  aiManager.addEventListener('app:aiStateChanged', (e) => {
    const state = e.detail.state;
    updateSettingsOverview(state);

    const monacoContainerEl = document.getElementById('monacoContainer');
    if (btnEditorAiToggle) {
      // Only the lamp is dimmed while nothing is set up; the label and the button stay fully readable and pressable
      btnEditorAiToggle.style.opacity = '';
      if (state.llm) {
        btnEditorAiToggle.classList.add('active');
      } else {
        btnEditorAiToggle.classList.remove('active');
      }
      btnEditorAiToggle.style.background = '';
      btnEditorAiToggle.style.borderColor = '';
      btnEditorAiToggle.style.color = '';
      drawAiSwitch(btnEditorAiToggle, state.llm);
    }
    // Lamp colours follow status_lamps.csv: green = on, grey = switched off on purpose (red is for errors only)
    if (editorAiStatusDot) editorAiStatusDot.style.opacity = state.llmConfigured ? '1' : '0.45';
    if (editorAiStatusDot) editorAiStatusDot.style.color = state.llm ? 'var(--success-color, #10b981)' : 'var(--text-muted, #94a3b8)';
    if (monacoContainerEl) {
      if (state.llm) monacoContainerEl.classList.add('glow-editor-active');
      else monacoContainerEl.classList.remove('glow-editor-active');
    }

    const btnSidebarEmbeddingModel = document.getElementById('btnSidebarEmbeddingModel');
    if (btnSidebarEmbeddingModel) {
      btnSidebarEmbeddingModel.style.opacity = '';
      if (state.embed) {
        btnSidebarEmbeddingModel.classList.add('active');
      } else {
        btnSidebarEmbeddingModel.classList.remove('active');
      }
      btnSidebarEmbeddingModel.style.background = '';
      btnSidebarEmbeddingModel.style.borderColor = '';
      btnSidebarEmbeddingModel.style.color = '';
      paintEmbedSwitch(btnSidebarEmbeddingModel, state.embed);
    }
    if (activeAiModelStatusDot) {
      activeAiModelStatusDot.style.opacity = state.embedConfigured ? '1' : '0.45';
      activeAiModelStatusDot.style.color = state.embed ? 'var(--success-color, #10b981)' : 'var(--text-muted, #94a3b8)';
    }

    if (state.llm || state.embed) {
      document.body.classList.add('ai-active');
      document.body.classList.remove('ai-standby');
    } else {
      document.body.classList.remove('ai-active');
      document.body.classList.add('ai-standby');
    }

    const editorContainer = document.querySelector('.editor-section');
    if (editorContainer) {
      if (state.llm) editorContainer.classList.add('glow-editor-active');
      else editorContainer.classList.remove('glow-editor-active');
    }
  });

  function updateSidebarEmbeddingLabel() {
    const btnSidebarEmbeddingModel = document.getElementById('btnSidebarEmbeddingModel');
    if (btnSidebarEmbeddingModel) {
      const localModel = (readStorage('vect_local_embedding_model') || 'Xenova/multilingual-e5-small').split('/').pop();
      btnSidebarEmbeddingModel.title = t('tip_embed_model_status', { model: window.__isLocalAiModelReady ? localModel : 'Ready' });
    }
  }

  updateSidebarEmbeddingLabel();
  drawAiSwitch(btnEditorAiToggle, aiManager.getState().llm);
  const sidebarEmbedButton = document.getElementById('btnSidebarEmbeddingModel');
  paintEmbedSwitch(sidebarEmbedButton, aiManager.getState().embed);
  // The model download reports its progress as app:aiModelProgress; the switch is "preparing" until the model is ready or failed
  window.addEventListener('app:aiModelProgress', (e) => {
    const status = e.detail?.status;
    if (!sidebarEmbedButton) return;
    sidebarEmbedButton.dataset.installing = String(!['ready', 'done', 'error'].includes(status));
    paintEmbedSwitch(sidebarEmbedButton, aiManager.getState().embed);
  });
  updateSettingsOverview();
  window.addEventListener('app:languageChanged', () => {
    updateSettingsOverview();
    updateSidebarEmbeddingLabel();
    paintEmbedSwitch(sidebarEmbedButton, aiManager.getState().embed);
  });
  window.addEventListener('app:settingsChanged', () => {
    aiManager.setConfigured({ llm: isLlmConfigured(), embed: isEmbedConfigured() });
    updateSidebarEmbeddingLabel();
    updateSettingsOverview();
  });

  // One announcer for every switch change, whoever caused it (header chip, sidebar, settings page, lost key):
  // the toast and the log carry the same sentence.
  window.addEventListener('app:aiSwitchChanged', (e) => {
    const { which, from, to, source } = e.detail.change;
    const name = which === 'llm' ? 'LLM' : 'Embedding';
    const label = (on) => (on ? 'ON' : 'OFF');
    window.appendSystemLog?.(`[AI] ${name}: ${label(from)} → ${label(to)} (${source})`, 'info');
    const toastKey = which === 'llm' ? (to ? 'toast_editor_ai_on' : 'toast_editor_ai_off') : (to ? 'toast_sidebar_ai_on' : 'toast_sidebar_ai_off');
    showToast(t(toastKey) || `${name}: ${label(to)}`, to ? 'success' : 'info');
  });

  // The header chip is the LLM switch: ON opens the chat dock, OFF closes it (the dock follows the state).
  // It does not touch the Embedding switch.
  async function handleLlmToggleClick() {
    const state = aiManager.getState();
    if (!state.llmConfigured) {
      const confirmed = await showConfirmModal({
        title: t('ai_setup_required_title'),
        message: t('ai_setup_required_msg'),
        detail: t('ai_setup_required_detail'),
        confirmText: t('btn_open_settings'),
        cancelText: t('common_cancel'),
        type: 'info',
        icon: 'cloud'
      });
      if (confirmed) {
        // The LLM keys live in the Editor tab, in the AI chat card. The page lands on what is missing: the key field of the chosen provider, or the provider choice
        openAiSettingsTab('tabEditor', 'grp_llm_assistant', llmSetupTargetId(readStorage(STORAGE_KEYS.LLM_PROVIDER)));
      }
      return;
    }
    if (state.llm) {
      aiManager.setLlm(false, 'toolbar');
      return;
    }
    aiManager.setLlm(true, 'toolbar');
    window.dispatchEvent(new CustomEvent('app:openLlmChat', { detail: {} }));
  }

  btnEditorAiToggle?.addEventListener('click', handleLlmToggleClick);

  // Sidebar Embedding pill: the Embedding switch. It does not touch the LLM switch.
  const btnSidebarEmbeddingModel = document.getElementById('btnSidebarEmbeddingModel');
  if (btnSidebarEmbeddingModel) {
    btnSidebarEmbeddingModel.addEventListener('click', () => {
      const state = aiManager.getState();
      if (state.embed) {
        aiManager.setEmbed(false, 'sidebar');
        return;
      }
      if (!state.embedConfigured) {
        // No ready model: say so and go to where it is installed
        showToast(t('toast_embed_not_ready'), 'warning');
        openAiSettingsTab('tabAiSearch');
        return;
      }
      aiManager.setEmbed(true, 'sidebar');
    });
  }

  // Settings Gear Icon on Sidebar: Jump to settings embedding tab
  const btnSidebarQuickSettings = document.getElementById('btnSidebarQuickSettings');
  if (btnSidebarQuickSettings) {
    btnSidebarQuickSettings.addEventListener('click', () => {
      openAiSettingsTab();
    });
  }

  // --- LLM Chat & Rewrite Dock Controller ---
  initLlmChatDock();
}

function initLlmChatDock() {
  const dock = document.getElementById('editorLlmChatDock');
  const chatMessages = document.getElementById('llmChatMessages');
  const chatInput = document.getElementById('llmChatInput');
  const btnSend = document.getElementById('btnLlmSend');
  const btnClear = document.getElementById('btnLlmClearChat');
  const btnCollapse = document.getElementById('btnLlmToggleCollapse');
  const collapseIcon = document.getElementById('llmCollapseIcon');
  const modelButton = document.getElementById('btnLlmModel');
  const dockSwitch = document.getElementById('btnLlmDockSwitch');
  const btnDockSettings = document.getElementById('btnLlmQuickSettings');
  const btnKeyConfig = document.getElementById('btnLlmKeyConfig');
  const quickApiBanner = document.getElementById('llmQuickApiKeyBanner');
  const selQuickProvider = document.getElementById('selLlmQuickProvider');
  const quickApiKeyInput = document.getElementById('llmQuickApiKeyInput');
  const btnToggleQuickVisibility = document.getElementById('btnToggleQuickKeyVisibility');
  const btnSaveQuickKey = document.getElementById('btnSaveQuickApiKey');
  const chatStatus = document.getElementById('llmChatStatus');
  const chatStatusText = document.getElementById('llmChatStatusText');
  const btnExport = document.getElementById('btnLlmExportChat');
  const sendIcon = btnSend?.querySelector('.llm-send-icon');
  const sendLabel = document.getElementById('llmSendLabel');
  const destination = document.getElementById('llmChatDestination');
  // The send that is waiting for its reply, if any: { requestId, stopped }
  let activeSend = null;
  // The conversation as sent and received, kept for saving. Cleared only by a confirmed reset
  const chatLog = [];

  if (!dock || !chatInput) return;

  function updateDockModelButton() {
    if (!modelButton) return;
    const provider = readStorage('llm_provider') || 'gemini';
    // The model the next request will use (same lookup as searchProviders.js)
    if (provider === 'gemini') {
      const model = readGeminiModel();
      modelButton.textContent = `Gemini (${model ? model.replace('gemini-', '') : t('gemini_model_unselected')})`;
    } else if (provider === 'openai') {
      const model = readStorage(STORAGE_KEYS.OPENAI_MODEL) || DEFAULTS.OPENAI_MODEL;
      modelButton.textContent = `OpenAI (${model})`;
    } else if (provider === 'claude') {
      const model = readStorage(STORAGE_KEYS.CLAUDE_MODEL) || DEFAULTS.CLAUDE_MODEL;
      modelButton.textContent = `Claude (${model.replace('claude-', '')})`;
    } else {
      modelButton.textContent = t('llm_badge_cloud');
    }
    // The line under the input names where the next message goes, so a change of service is always visible
    if (destination) destination.textContent = t('llm_destination', { name: modelButton.textContent });
  }

  // Auto-init the model button on startup, and follow model changes made in Settings
  updateDockModelButton();
  window.addEventListener('app:settingsChanged', updateDockModelButton);
  // The button shows the model in use; a click opens a short menu to pick another one. The long list stays in the Models tab
  // of the log panel (the last item of the menu). Not while a reply is awaited: the pending send keeps its model.
  modelButton?.addEventListener('click', () => openModelQuickMenu(modelButton, {
    canOpen: () => !activeSend,
    onSetup: () => openAiSettingsTab('tabEditor', 'grp_llm_assistant')
  }));
  window.addEventListener('app:languageChanged', updateDockModelButton);

  // Update API Key button status icon (configured/unconfigured)
  function updateApiKeyButtonStatus() {
    if (!btnKeyConfig) return;
    const statusIcon = btnKeyConfig.querySelector('#llmKeyStatusIcon');
    if (!statusIcon) return;

    const currentProvider = readStorage('llm_provider') || 'gemini';
    const isConfigured = currentProvider !== 'none' && isApiKeyConfigured(currentProvider);

    // Change icon: configured = check_circle, unconfigured = key
    if (isConfigured) {
      statusIcon.textContent = 'check_circle';
      statusIcon.style.color = 'var(--success-color, #10b981)';
    } else {
      statusIcon.textContent = 'key';
      statusIcon.style.color = 'var(--accent-text, var(--accent-color))';
    }
  }

  // The eye shows what was typed; with an empty field there is nothing to show (a saved key is never sent back to the window)
  function syncQuickKeyEye() {
    if (!btnToggleQuickVisibility || !quickApiKeyInput) return;
    btnToggleQuickVisibility.disabled = !quickApiKeyInput.value;
    btnToggleQuickVisibility.style.opacity = quickApiKeyInput.value ? '1' : '0.4';
  }
  quickApiKeyInput?.addEventListener('input', syncQuickKeyEye);

  // Update API key button status on startup and when settings change
  updateApiKeyButtonStatus();
  window.addEventListener('app:settingsChanged', updateApiKeyButtonStatus);

  // Update chat status bar (shows warning if provider/key not set)
  function updateChatStatusBar() {
    if (!chatStatus) return;
    const currentProvider = readStorage('llm_provider') || 'none';
    const isConfigured = currentProvider !== 'none' && isApiKeyConfigured(currentProvider);

    if (isConfigured) {
      chatStatus.style.display = 'none';
      chatInput.disabled = false;
      btnSend.disabled = false;
    } else {
      chatStatus.style.display = 'flex';
      chatInput.disabled = true;
      btnSend.disabled = true;
      if (chatStatusText) {
        if (currentProvider === 'none') {
          chatStatusText.textContent = t('llm_provider_not_set');
        } else {
          chatStatusText.textContent = t('llm_setup_required');
        }
      }
    }
  }

  updateChatStatusBar();
  window.addEventListener('app:settingsChanged', updateChatStatusBar);
  window.addEventListener('app:languageChanged', updateChatStatusBar);

  // Quick API Key Banner Logic
  function syncQuickApiKeyInput() {
    if (!selQuickProvider || !quickApiKeyInput) return;
    // Stored keys are encrypted in the main process and never shown again; the placeholder only says one is set.
    const provider = selQuickProvider.value;
    quickApiKeyInput.value = '';
    syncQuickKeyEye();
    quickApiKeyInput.placeholder = isApiKeyConfigured(provider)
      ? `•••••••• ${t('api_key_saved_placeholder')}`
      : (KEY_PLACEHOLDERS[provider] || KEY_PLACEHOLDERS.gemini);
  }

  if (btnKeyConfig && quickApiBanner) {
    btnKeyConfig.addEventListener('click', () => {
      const isVisible = quickApiBanner.style.display === 'block';
      quickApiBanner.style.display = isVisible ? 'none' : 'block';
      if (!isVisible) {
        const currentProvider = readStorage('llm_provider') || 'gemini';
        if (selQuickProvider) selQuickProvider.value = (currentProvider === 'none') ? 'gemini' : currentProvider;
        syncQuickApiKeyInput();
        setTimeout(() => quickApiKeyInput?.focus(), 50);
      }
    });
  }

  if (selQuickProvider) {
    selQuickProvider.addEventListener('change', syncQuickApiKeyInput);
  }

  if (btnToggleQuickVisibility && quickApiKeyInput) {
    btnToggleQuickVisibility.addEventListener('click', (e) => {
      e.preventDefault();
      const isPassword = quickApiKeyInput.type === 'password';
      quickApiKeyInput.type = isPassword ? 'text' : 'password';
      const icon = btnToggleQuickVisibility.querySelector('.material-symbols-outlined');
      if (icon) {
        icon.textContent = isPassword ? 'visibility' : 'visibility_off';
      }
      btnToggleQuickVisibility.title = isPassword ? (t('hide_api_key')) : (t('show_api_key'));
    });
  }

  if (btnSaveQuickKey && quickApiKeyInput && selQuickProvider) {
    btnSaveQuickKey.addEventListener('click', async () => {
      const provider = selQuickProvider.value;
      const key = quickApiKeyInput.value.trim();

      if (!key) {
        showToast(t('toast_api_key_required'), 'warning');
        quickApiKeyInput.focus();
        return;
      }

      const res = await saveApiKey(provider, key);
      if (!res.success) {
        showToast(res.error || `Failed to save the ${provider} key`, 'error');
        return;
      }
      try {
        writeStorage('llm_provider', provider);
      } catch (err) {
        // The key is saved but the provider choice is not: report it instead of looking complete
        console.error('[AI] Could not save the provider choice:', err);
        showToast(t('save_failed'), 'error');
        return;
      }
      if (provider === 'gemini') {
          // Automatically fetch and cache official Gemini models
          try {
            const models = await window.engineAPI.listGeminiModels(key);
            // Only models that can generate text are counted or picked; the full list stays in the cache
            const usable = rememberGeminiModels(models);
            if (usable.length > 0) {
              // The model is the user's choice: nothing is picked here
              showToast(t(readGeminiModel() ? 'toast_models_loaded' : 'toast_models_loaded_choose', { count: usable.length }), 'info');
            }
          } catch (modelErr) {
            console.warn('[Gemini] Automatic model fetch warning:', modelErr);
          }
      }
      quickApiKeyInput.value = '';

      updateDockModelButton();
      window.dispatchEvent(new Event('app:settingsChanged'));
      showToast(t('toast_api_key_saved', { provider: llmProviderName(provider) }), 'success');
      if (quickApiBanner) quickApiBanner.style.display = 'none';
    });
  }

  function openDock(initialPrompt = '') {
    // The chat only opens while the LLM is ON (Ctrl+K, the right-click menu and the /ai command all come through here)
    if (!canUseLlm()) {
      showToast(t('llm_off_hint'), 'warning');
      return;
    }
    dock.style.display = 'flex';
    dock.classList.remove('collapsed');
    if (collapseIcon) collapseIcon.innerHTML = icons.minus;
    updateDockModelButton();
    if (initialPrompt) {
      chatInput.value = initialPrompt;
      chatInput.style.height = 'auto';
      chatInput.style.height = `${Math.min(chatInput.scrollHeight, 100)}px`;
    }
    setTimeout(() => {
      chatInput.focus();
      if (initialPrompt) chatInput.select();
    }, 50);
  }

  function closeDock() {
    dock.style.display = 'none';
  }

  function toggleCollapseDock() {
    const isCollapsed = dock.classList.toggle('collapsed');
    if (collapseIcon) {
      collapseIcon.innerHTML = isCollapsed ? icons.unfold : icons.minus;
    }
  }

  window.addEventListener('app:openLlmChat', (e) => {
    const prompt = e.detail?.prompt || '';
    openDock(prompt);
  });
  // The dock follows the LLM switch: it closes as soon as the LLM goes off, and its own switch shows the same state
  const paintDockSwitch = (on) => {
    drawAiSwitch(dockSwitch, on);
    dockSwitch?.classList.toggle('active', on);
  };
  window.addEventListener('app:aiStateChanged', (e) => {
    const state = e.detail.state;
    paintDockSwitch(state.llm);
    if (!state.llm) {
      closeDock();
    }
  });
  paintDockSwitch(aiManager.getState().llm);
  // The dock is shown only while the LLM is on, so its switch turns it off. It is the same value as the title-bar button and the settings row
  dockSwitch?.addEventListener('click', () => {
    if (aiManager.getState().llm) aiManager.setLlm(false, 'dock');
  });
  // The gear opens the AI chat card of the settings page, where the detailed settings are
  btnDockSettings?.addEventListener('click', () => openAiSettingsTab('tabEditor', 'grp_llm_assistant'));

  if (btnCollapse) btnCollapse.addEventListener('click', toggleCollapseDock);

  if (btnClear) {
    btnClear.addEventListener('click', async () => {
      // Clearing removes the conversation for good, so it asks first; Cancel keeps it
      const ok = await showConfirmModal({
        title: t('llm_reset_confirm_title'),
        message: t('llm_reset_confirm_message'),
        confirmText: t('llm_reset_confirm_ok'),
        cancelText: t('common_cancel'),
        type: 'warning'
      });
      if (!ok) return;
      chatLog.length = 0;
      chatMessages.innerHTML = `
        <div class="llm-msg llm-msg-system">
          <span class="material-symbols-outlined" style="font-size: var(--icon-text-size); color: var(--accent-color, #38bdf8);">info</span>
          <span>${t('llm_clear_chat_msg')}</span>
        </div>
      `;
    });
  }
  if (btnExport) {
    btnExport.addEventListener('click', async () => {
      if (!chatLog.length) {
        // Shown in the chat itself: a toast disappears after 10 seconds and was missed
        const note = document.createElement('div');
        note.className = 'llm-msg llm-msg-system';
        note.innerHTML = `
          <span class="material-symbols-outlined" style="font-size: var(--icon-text-size); color: var(--accent-color, #38bdf8);">info</span>
          <span>${escapeHtml(t('llm_export_empty'))}</span>
        `;
        chatMessages.appendChild(note);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return;
      }
      const content = buildChatMarkdown(chatLog, {
        title: t('llm_export_title'),
        youLabel: t('llm_export_you'),
        assistantLabel: t('llm_export_assistant')
      });
      // forceDialog: the user always picks the place, so nothing is written to an earlier path
      const res = await window.engineAPI?.saveFile?.(content, chatExportFileName(), true);
      if (res?.success) showToast(t('toast_llm_chat_exported'), 'success');
      else if (!res?.canceled) showToast(t('toast_llm_chat_export_failed'), 'warning');
    });
  }
  // Disable input while the LLM is OFF
  const updateChatInputState = () => {
    // Input needs the LLM switch on and a configured provider (key present).
    const disabled = !canUseLlm();
    if (chatInput) chatInput.disabled = disabled;
    if (btnSend) btnSend.disabled = disabled;
    if (btnClear) btnClear.disabled = disabled;
    dock.style.opacity = disabled ? '0.5' : '1';
  };
  // Listen for AI state changes
  window.addEventListener('app:aiStateChanged', updateChatInputState);
  // Initial state sync
  updateChatInputState();

  /** While a send waits for its reply the Send button is a Stop button */
  function showSendingState(on) {
    btnSend.classList.toggle('is-stop', on);
    btnSend.title = t(on ? 'tip_llm_stop' : 'tip_llm_send');
    btnSend.dataset.i18nTitle = on ? 'tip_llm_stop' : 'tip_llm_send';
    if (sendIcon) sendIcon.innerHTML = on ? icons.stop : icons.arrowUp;
    if (sendLabel) {
      sendLabel.dataset.i18n = on ? 'btn_stop' : 'btn_send';
      sendLabel.textContent = t(on ? 'btn_stop' : 'btn_send');
    }
    btnSend.disabled = false;
    chatInput.setAttribute('aria-busy', String(on));
  }

  function stopSend() {
    if (!activeSend || activeSend.stopped) return;
    activeSend.stopped = true;
    window.engineAPI?.cancelAiSend?.(activeSend.requestId);
  }

  async function handleSend() {
    // One send at a time: Enter while waiting does not send a second message
    if (activeSend) return;
    const prompt = chatInput.value.trim();
    if (!prompt) return;

    // Without a configured key, keep the prompt in the input and point to setup instead of sending.
    if (!aiManager.getState?.().llmConfigured) {
      showToast(t('ai_setup_required_msg'), 'warning');
      return;
    }
    if (!canUseLlm()) {
      showToast(t('llm_off_hint'), 'warning');
      return;
    }
    // Gemini needs a model the user has chosen in the model list; send nothing until then
    if (readStorage(STORAGE_KEYS.LLM_PROVIDER) === 'gemini' && !readGeminiModel()) {
      showModelNeededNotice(chatMessages);
      return;
    }

    // Append User Message
    const userMsgEl = document.createElement('div');
    userMsgEl.className = 'llm-msg llm-msg-user';
    userMsgEl.textContent = prompt;
    chatMessages.appendChild(userMsgEl);
    chatLog.push({ role: 'user', text: prompt });

    chatInput.value = '';
    chatInput.style.height = '32px';

    // Append Pending AI Message
    const aiMsgEl = document.createElement('div');
    aiMsgEl.className = 'llm-msg llm-msg-ai';
    aiMsgEl.innerHTML = `
      <div class="llm-msg-ai-header">
        <span style="display: flex; align-items: center; gap: 4px;">
          <span class="material-symbols-outlined" style="font-size: var(--fs-14);">smart_toy</span>
          <span>Thinking...</span>
        </span>
      </div>
      <div class="llm-ai-body" style="opacity: 0.7; font-style: italic;">Generating response...</div>
    `;
    chatMessages.appendChild(aiMsgEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    const requestId = crypto.randomUUID();
    activeSend = { requestId, stopped: false };
    showSendingState(true);

    try {
      // A question about the app is answered from the guide: its best matching cards go in front of the question
      const response = await queryLlmChat(withHelpContext(prompt), null, { requestId });
      if (response && response.cancelled) {
        // Stopped by the user: say so, and give the text back so it can be edited and sent again
        aiMsgEl.innerHTML = `
          <div class="llm-msg-ai-header">
            <span class="material-symbols-outlined" style="font-size: var(--fs-14);">info</span>
            <span>${escapeHtml(t('llm_send_stopped_title'))}</span>
          </div>
          <div class="llm-ai-body">${escapeHtml(t('llm_send_stopped'))}</div>
        `;
        if (!chatInput.value) chatInput.value = prompt;
      } else if (response && response.text) {
        const text = response.text;
        const modelName = response.model || 'AI Assistant';
        chatLog.push({ role: 'assistant', text, model: response.model });
        aiMsgEl.innerHTML = `
          <div class="llm-msg-ai-header">
            <span style="display: flex; align-items: center; gap: 4px;">
              <span class="material-symbols-outlined" style="font-size: var(--fs-14);">smart_toy</span>
              <span>${escapeHtml(modelName)}</span>
            </span>
          </div>
          <div class="llm-ai-body" style="white-space: pre-wrap; word-break: break-word;">${escapeHtml(text)}</div>
          <div class="llm-msg-actions">
            <button class="llm-action-btn btn-action-insert" title="${t('llm_action_insert_tip')}">
              <span class="material-symbols-outlined" style="font-size: var(--fs-12);">input</span>
              <span>${t('llm_action_insert')}</span>
            </button>
            <button class="llm-action-btn btn-action-rewrite" title="${t('llm_action_rewrite_tip')}">
              <span class="material-symbols-outlined" style="font-size: var(--fs-12);">auto_awesome</span>
              <span>${t('llm_action_rewrite')}</span>
            </button>
            <button class="llm-action-btn btn-action-copy" title="${t('llm_action_copy_tip')}">
              <span class="material-symbols-outlined" style="font-size: var(--fs-12);">content_copy</span>
              <span>${t('llm_action_copy')}</span>
            </button>
          </div>
        `;

        const btnInsert = aiMsgEl.querySelector('.btn-action-insert');
        const btnRewrite = aiMsgEl.querySelector('.btn-action-rewrite');
        const btnCopy = aiMsgEl.querySelector('.btn-action-copy');

        if (btnInsert) {
          btnInsert.addEventListener('click', () => {
            applyAiOutputToEditor(text, 'insert', 'generate');
            showToast(t('toast_ai_inserted'), 'success');
          });
        }

        if (btnRewrite) {
          btnRewrite.addEventListener('click', () => {
            applyAiOutputToEditor(text, 'replace', 'rewrite');
            showToast(t('toast_ai_replaced'), 'success');
          });
        }

        if (btnCopy) {
          btnCopy.addEventListener('click', async () => {
            await navigator.clipboard.writeText(text);
            showToast(t('toast_ai_copied'), 'info');
          });
        }
      } else {
        const err = response?.error || t('llm_error_default');
        aiMsgEl.innerHTML = `
          <div class="llm-msg-ai-header" style="color: #ef4444;">
            <span class="material-symbols-outlined" style="font-size: var(--fs-14);">error</span>
            <span>${t('common_error')}</span>
          </div>
          <div class="llm-ai-body" style="color: #ef4444;">${escapeHtml(err)}</div>
        `;
      }
    } catch (e) {
      aiMsgEl.innerHTML = `
        <div class="llm-msg-ai-header" style="color: #ef4444;">
          <span class="material-symbols-outlined" style="font-size: var(--fs-14);">error</span>
          <span>${t('common_error')}</span>
        </div>
        <div class="llm-ai-body" style="color: #ef4444;">${escapeHtml(e.message || t('llm_request_failed'))}</div>
      `;
    } finally {
      const stopped = activeSend?.stopped;
      activeSend = null;
      showSendingState(false);
      updateChatInputState();
      chatMessages.scrollTop = chatMessages.scrollHeight;
      // Lets the sidebar tab of the chat show a dot when another tab is shown
      if (!stopped) window.dispatchEvent(new CustomEvent('app:llmReply'));
    }
  }

  if (btnSend) btnSend.addEventListener('click', () => (activeSend ? stopSend() : handleSend()));

  // Enter sends, but not while an input method converts text. Escape does nothing here, so a habitual Escape cannot hide the chat
  chatInput.addEventListener('keydown', (e) => {
    if (shouldSendOnKey(e)) {
      e.preventDefault();
      handleSend();
    }
  });

  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = `${Math.min(chatInput.scrollHeight, 120)}px`;
  });
}

