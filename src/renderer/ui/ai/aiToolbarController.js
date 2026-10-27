import { aiManager } from '../../core/aiStateManager.js';
import { STORAGE_KEYS, DEFAULTS } from '../../core/constants.js';
import { isApiKeyConfigured, saveApiKey } from '../../core/apiKeyStore.js';
import { isLlmConfigured, isEmbedConfigured } from '../settings/settingsState.js';
import { canUseLlm } from '../../core/aiAccess.js';
import { withHelpContext } from '../help/helpKnowledge.js';
import { t } from '../../core/i18n.js';
import { showToast } from '../notifications/toastManager.js';
import { showConfirmModal } from '../notifications/confirmModal.js';
import { confirmClose } from '../notifications/closeGuard.js';
import { queryLlmChat } from '../../search/searchProviders.js';
import { applyAiOutputToEditor, insertTextIntoEditor } from '../../editor/editorManager.js';

const KEY_PLACEHOLDERS = { openai: 'sk-proj-...', claude: 'sk-ant-api03-...', gemini: 'AIzaSy... (Gemini)' };

/** Draws an ON/OFF switch pill: the switch state (aria-checked on the whole button), the knob side and the lit word all follow `on`. */
function drawAiSwitch(button, on) {
  if (!button) return;
  button.setAttribute('aria-checked', String(on));
  button.querySelector('[data-side="on"]')?.classList.toggle('is-lit', on);
  button.querySelector('[data-side="off"]')?.classList.toggle('is-lit', !on);
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
      drawAiSwitch(btnSidebarEmbeddingModel, state.embed);
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
      const localModel = (localStorage.getItem('vect_local_embedding_model') || 'Xenova/multilingual-e5-small').split('/').pop();
      btnSidebarEmbeddingModel.title = t('tip_embed_model_status', { model: window.__isLocalAiModelReady ? localModel : 'Ready' });
    }
  }

  function openAiSettingsTab(tab = 'tabAiSearch') {
    window.dispatchEvent(new CustomEvent('app:openSettings', { detail: { tab } }));
  }

  updateSidebarEmbeddingLabel();
  drawAiSwitch(btnEditorAiToggle, aiManager.getState().llm);
  drawAiSwitch(document.getElementById('btnSidebarEmbeddingModel'), aiManager.getState().embed);
  updateSettingsOverview();
  window.addEventListener('app:settingsChanged', () => {
    aiManager.setConfigured({ llm: isLlmConfigured(), embed: isEmbedConfigured() });
    updateSidebarEmbeddingLabel();
    updateSettingsOverview();
  });

  // One announcer for every switch change, whoever caused it (header chip, sidebar, settings page, lost key):
  // the toast and the log carry the same sentence (ADR-11 section 2.5).
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
        title: t('ai_setup_required_title') || 'AI Setup Required',
        message: t('ai_setup_required_msg') || 'Cloud LLM / AI model is not configured yet.',
        detail: t('ai_setup_required_detail') || 'Would you like to navigate to Settings to configure your Gemini or OpenAI API key?',
        confirmText: t('btn_open_settings') || 'Open Settings',
        cancelText: t('btn_cancel') || 'Stay in Editor',
        type: 'info',
        icon: 'cloud'
      });
      if (confirmed) {
        // The LLM keys live in the Editor tab
        openAiSettingsTab('tabEditor');
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
  const btnClose = document.getElementById('btnLlmCloseChat');
  const btnCollapse = document.getElementById('btnLlmToggleCollapse');
  const collapseIcon = document.getElementById('llmCollapseIcon');
  const modelBadge = document.getElementById('llmDockModelBadge');
  const btnKeyConfig = document.getElementById('btnLlmKeyConfig');
  const quickApiBanner = document.getElementById('llmQuickApiKeyBanner');
  const selQuickProvider = document.getElementById('selLlmQuickProvider');
  const quickApiKeyInput = document.getElementById('llmQuickApiKeyInput');
  const btnToggleQuickVisibility = document.getElementById('btnToggleQuickKeyVisibility');
  const btnSaveQuickKey = document.getElementById('btnSaveQuickApiKey');

  if (!dock || !chatInput) return;

  function updateDockModelBadge() {
    if (!modelBadge) return;
    const provider = localStorage.getItem('llm_provider') || 'gemini';
    // The model the next request will use (same lookup as searchProviders.js)
    if (provider === 'gemini') {
      const model = localStorage.getItem(STORAGE_KEYS.GEMINI_MODEL) || DEFAULTS.GEMINI_MODEL;
      modelBadge.textContent = `Gemini (${model.replace('gemini-', '')})`;
    } else if (provider === 'openai') {
      const model = localStorage.getItem(STORAGE_KEYS.OPENAI_MODEL) || DEFAULTS.OPENAI_MODEL;
      modelBadge.textContent = `OpenAI (${model})`;
    } else if (provider === 'claude') {
      const model = localStorage.getItem(STORAGE_KEYS.CLAUDE_MODEL) || DEFAULTS.CLAUDE_MODEL;
      modelBadge.textContent = `Claude (${model.replace('claude-', '')})`;
    } else {
      modelBadge.textContent = 'LLM (Cloud)';
    }
  }

  // Auto-init model badge on startup, and follow model changes made in Settings
  updateDockModelBadge();
  window.addEventListener('app:settingsChanged', updateDockModelBadge);

  // The eye shows what was typed; with an empty field there is nothing to show (a saved key is never sent back to the window)
  function syncQuickKeyEye() {
    if (!btnToggleQuickVisibility || !quickApiKeyInput) return;
    btnToggleQuickVisibility.disabled = !quickApiKeyInput.value;
    btnToggleQuickVisibility.style.opacity = quickApiKeyInput.value ? '1' : '0.4';
  }
  quickApiKeyInput?.addEventListener('input', syncQuickKeyEye);

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
        const currentProvider = localStorage.getItem('llm_provider') || 'gemini';
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
      btnToggleQuickVisibility.title = isPassword ? (t('hide_api_key') || 'Hide API Key') : (t('show_api_key') || 'Show API Key');
    });
  }

  if (btnSaveQuickKey && quickApiKeyInput && selQuickProvider) {
    btnSaveQuickKey.addEventListener('click', async () => {
      const provider = selQuickProvider.value;
      const key = quickApiKeyInput.value.trim();

      if (!key) {
        showToast('Please enter an API key before saving.', 'warning');
        quickApiKeyInput.focus();
        return;
      }

      const res = await saveApiKey(provider, key);
      if (!res.success) {
        showToast(res.error || `Failed to save the ${provider} key`, 'error');
        return;
      }
      localStorage.setItem('llm_provider', provider);
      if (provider === 'gemini') {
          // Automatically fetch and cache official Gemini models
          try {
            const models = await window.engineAPI.listGeminiModels(key);
            if (Array.isArray(models) && models.length > 0) {
              localStorage.setItem('cached_gemini_models', JSON.stringify(models));
              if (!localStorage.getItem('gemini_model')) {
                localStorage.setItem('gemini_model', models[0].name);
              }
              const msg = t('toast_models_loaded', { count: models.length }) || `Successfully loaded ${models.length} models from Google official API`;
              showToast(msg, 'info');
            }
          } catch (modelErr) {
            console.warn('[Gemini] Automatic model fetch warning:', modelErr);
          }
      }
      quickApiKeyInput.value = '';

      updateDockModelBadge();
      window.dispatchEvent(new Event('app:settingsChanged'));
      showToast(`${provider.toUpperCase()} API Key saved successfully!`, 'success');
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
    if (collapseIcon) collapseIcon.innerHTML = '&#xe5cf;';
    updateDockModelBadge();
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
      collapseIcon.innerHTML = isCollapsed ? '&#xe5ce;' : '&#xe5cf;';
    }
  }

  window.addEventListener('app:openLlmChat', (e) => {
    const prompt = e.detail?.prompt || '';
    openDock(prompt);
  });
  // The dock follows the LLM switch: it closes as soon as the LLM goes off
  window.addEventListener('app:aiStateChanged', (e) => {
    const state = e.detail.state;
    if (!state.llm) {
      closeDock();
    }
  });

  if (btnClose) {
    btnClose.addEventListener('click', async () => {
      if (await confirmClose('chat')) closeDock();
    });
  }
  if (btnCollapse) btnCollapse.addEventListener('click', toggleCollapseDock);

  if (btnClear) {
    btnClear.addEventListener('click', () => {
      chatMessages.innerHTML = `
        <div class="llm-msg llm-msg-system">
          <span class="material-symbols-outlined" style="font-size: var(--icon-text-size); color: var(--accent-color, #38bdf8);">&#xe88e;</span>
          <span>Conversation cleared. Type a prompt, question, or select text in Monaco Editor and right-click "LLM Chat" to converse or rewrite here.</span>
        </div>
      `;
    });
  }
  // Disable input while the LLM is OFF
  const updateChatInputState = () => {
    // Input needs the LLM switch on and a configured provider (key present).
    const disabled = !canUseLlm();
    if (chatInput) chatInput.disabled = disabled;
    if (btnSend) btnSend.disabled = disabled;
    if (btnClear) btnClear.disabled = disabled;
    if (btnClose) btnClose.disabled = disabled;
    dock.style.opacity = disabled ? '0.5' : '1';
  };
  // Listen for AI state changes
  window.addEventListener('app:aiStateChanged', updateChatInputState);
  // Initial state sync
  updateChatInputState();

  async function handleSend() {
    const prompt = chatInput.value.trim();
    if (!prompt) return;

    // Without a configured key, keep the prompt in the input and point to setup instead of sending.
    if (!aiManager.getState?.().llmConfigured) {
      showToast(t('ai_setup_required_msg') || 'Cloud LLM / AI model is not configured yet.', 'warning');
      return;
    }
    if (!canUseLlm()) {
      showToast(t('llm_off_hint'), 'warning');
      return;
    }

    // Append User Message
    const userMsgEl = document.createElement('div');
    userMsgEl.className = 'llm-msg llm-msg-user';
    userMsgEl.textContent = prompt;
    chatMessages.appendChild(userMsgEl);

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

    btnSend.disabled = true;

    try {
      // A question about the app is answered from the guide: its best matching cards go in front of the question
      const response = await queryLlmChat(withHelpContext(prompt));
      if (response && response.text) {
        const text = response.text;
        const modelName = response.model || 'AI Assistant';
        aiMsgEl.innerHTML = `
          <div class="llm-msg-ai-header">
            <span style="display: flex; align-items: center; gap: 4px;">
              <span class="material-symbols-outlined" style="font-size: var(--fs-14);">smart_toy</span>
              <span>${modelName}</span>
            </span>
          </div>
          <div class="llm-ai-body" style="white-space: pre-wrap; word-break: break-word;">${escapeHtml(text)}</div>
          <div class="llm-msg-actions">
            <button class="llm-action-btn btn-action-insert" title="Insert output at editor cursor">
              <span class="material-symbols-outlined" style="font-size: var(--fs-12);">input</span>
              <span>Insert</span>
            </button>
            <button class="llm-action-btn btn-action-rewrite" title="Replace selected text with this output (decorated)">
              <span class="material-symbols-outlined" style="font-size: var(--fs-12);">auto_fix_high</span>
              <span>Replace (Rewrite)</span>
            </button>
            <button class="llm-action-btn btn-action-copy" title="Copy to clipboard">
              <span class="material-symbols-outlined" style="font-size: var(--fs-12);">content_copy</span>
              <span>Copy</span>
            </button>
          </div>
        `;

        const btnInsert = aiMsgEl.querySelector('.btn-action-insert');
        const btnRewrite = aiMsgEl.querySelector('.btn-action-rewrite');
        const btnCopy = aiMsgEl.querySelector('.btn-action-copy');

        if (btnInsert) {
          btnInsert.addEventListener('click', () => {
            applyAiOutputToEditor(text, 'insert', 'generate');
            showToast('Inserted AI output into editor', 'success');
          });
        }

        if (btnRewrite) {
          btnRewrite.addEventListener('click', () => {
            applyAiOutputToEditor(text, 'replace', 'rewrite');
            showToast('Replaced selection with AI rewritten output', 'success');
          });
        }

        if (btnCopy) {
          btnCopy.addEventListener('click', async () => {
            await navigator.clipboard.writeText(text);
            showToast('Copied AI text to clipboard', 'info');
          });
        }
      } else {
        const err = response?.error || 'No response from AI model. Please verify API key in Settings.';
        aiMsgEl.innerHTML = `
          <div class="llm-msg-ai-header" style="color: #ef4444;">
            <span class="material-symbols-outlined" style="font-size: var(--fs-14);">error</span>
            <span>Error</span>
          </div>
          <div class="llm-ai-body" style="color: #ef4444;">${escapeHtml(err)}</div>
        `;
      }
    } catch (e) {
      aiMsgEl.innerHTML = `
        <div class="llm-msg-ai-header" style="color: #ef4444;">
          <span class="material-symbols-outlined" style="font-size: var(--fs-14);">error</span>
          <span>Error</span>
        </div>
        <div class="llm-ai-body" style="color: #ef4444;">${escapeHtml(e.message || 'Request failed')}</div>
      `;
    } finally {
      btnSend.disabled = false;
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  if (btnSend) btnSend.addEventListener('click', handleSend);

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'Escape') {
      closeDock();
    }
  });

  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = `${Math.min(chatInput.scrollHeight, 120)}px`;
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
