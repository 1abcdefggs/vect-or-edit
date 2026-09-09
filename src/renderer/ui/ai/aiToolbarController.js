import { aiManager } from '../../core/aiStateManager.js';
import { isAiModelConfigured } from '../settings/settingsState.js';
import { t } from '../../core/i18n.js';
import { showToast } from '../notifications/toastManager.js';
import { queryLlmChat } from '../../search/searchProviders.js';
import { applyAiOutputToEditor, insertTextIntoEditor } from '../../editor/editorManager.js';

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
      }).catch(() => { });
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

    const btnSidebarEmbeddingModel = document.getElementById('btnSidebarEmbeddingModel');
    if (btnSidebarEmbeddingModel) {
      btnSidebarEmbeddingModel.style.opacity = state.master ? '1' : '0.65';
    }
    if (activeAiModelStatusDot) {
      activeAiModelStatusDot.style.color = window.__isLocalAiModelReady ? 'var(--success-color, #10b981)' : '#f59e0b';
    }

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


    const sidebarEmbeddingNameEl = document.getElementById('sidebarEmbeddingModelName');
    if (sidebarEmbeddingNameEl) {
      const localModel = (localStorage.getItem('vect_local_embedding_model') || 'Xenova/multilingual-e5-small').split('/').pop();
      sidebarEmbeddingNameEl.textContent = window.__isLocalAiModelReady ? localModel : 'No Embedding';
      sidebarEmbeddingNameEl.style.opacity = window.__isLocalAiModelReady ? '1' : '0.65';
    }
  }

  function openAiSettingsTab() {
    window.dispatchEvent(new CustomEvent('app:openSettings', { detail: { tab: 'tabAiSearch' } }));
  }

  if (masterAiModelNameBadge) masterAiModelNameBadge.addEventListener('click', openAiSettingsTab);

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

  // Sidebar Embedding Model Badge Click: jump to settings embedding tab
  const btnSidebarEmbeddingModel = document.getElementById('btnSidebarEmbeddingModel');
  if (btnSidebarEmbeddingModel) {
    btnSidebarEmbeddingModel.addEventListener('click', () => {
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
    const provider = localStorage.getItem('ai_provider') || 'gemini';
    if (provider === 'gemini') {
      const model = localStorage.getItem('gemini_model') || '1.5-flash';
      modelBadge.textContent = `Gemini (${model.replace('gemini-', '')})`;
    } else if (provider === 'openai') {
      const model = localStorage.getItem('openai_model') || 'gpt-4o-mini';
      modelBadge.textContent = `OpenAI (${model})`;
    } else if (provider === 'claude') {
      const model = localStorage.getItem('claude_model') || '3.5-sonnet';
      modelBadge.textContent = `Claude (${model.includes('haiku') ? 'Haiku' : 'Sonnet'})`;
    } else {
      modelBadge.textContent = 'LLM (Cloud)';
    }
  }

  // Auto-init model badge on startup
  updateDockModelBadge();

  // Quick API Key Banner Logic
  function syncQuickApiKeyInput() {
    if (!selQuickProvider || !quickApiKeyInput) return;
    const provider = selQuickProvider.value;
    if (provider === 'openai') {
      quickApiKeyInput.value = localStorage.getItem('vect_openai_api_key') || '';
      quickApiKeyInput.placeholder = 'sk-proj-...';
    } else if (provider === 'claude') {
      quickApiKeyInput.value = localStorage.getItem('vect_claude_api_key') || '';
      quickApiKeyInput.placeholder = 'sk-ant-api03-...';
    } else {
      quickApiKeyInput.value = '';
      quickApiKeyInput.placeholder = 'AIzaSy... (Gemini)';
      if (window.engineAPI?.hasGeminiApiKey) {
        window.engineAPI.hasGeminiApiKey().then((hasKey) => {
          if (hasKey && !quickApiKeyInput.value) {
            quickApiKeyInput.placeholder = '•••••••••••••••••••• (API Key Configured)';
          }
        }).catch(() => { });
      }
    }
  }

  if (btnKeyConfig && quickApiBanner) {
    btnKeyConfig.addEventListener('click', () => {
      const isVisible = quickApiBanner.style.display === 'block';
      quickApiBanner.style.display = isVisible ? 'none' : 'block';
      if (!isVisible) {
        const currentProvider = localStorage.getItem('ai_provider') || 'gemini';
        if (selQuickProvider) selQuickProvider.value = (currentProvider === 'local') ? 'gemini' : currentProvider;
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
      btnToggleQuickVisibility.title = isPassword ? 'APIキーを隠す' : 'APIキーを表示';
    });
  }

  if (btnSaveQuickKey && quickApiKeyInput && selQuickProvider) {
    btnSaveQuickKey.addEventListener('click', async () => {
      const provider = selQuickProvider.value;
      const key = quickApiKeyInput.value.trim();

      if (!key && provider !== 'gemini') {
        showToast('Please enter an API key', 'warning');
        return;
      }

      localStorage.setItem('ai_provider', provider);
      if (provider === 'gemini') {
        if (key) {
          const res = await window.engineAPI.saveGeminiApiKey(key);
          if (!res.success) {
            showToast(res.error || 'Failed to save Gemini key', 'error');
            return;
          }
          window.__geminiApiKeyConfigured = true;

          // Automatically fetch and cache official Gemini models
          try {
            const models = await window.engineAPI.listGeminiModels(key);
            if (Array.isArray(models) && models.length > 0) {
              localStorage.setItem('cached_gemini_models', JSON.stringify(models));
              if (!localStorage.getItem('gemini_model')) {
                localStorage.setItem('gemini_model', models[0].name);
              }
              showToast(`Google公式から ${models.length} models has been loaded`, 'info');
            }
          } catch (modelErr) {
            console.warn('[Gemini] Automatic model fetch warning:', modelErr);
          }
        }
      } else if (provider === 'openai') {
        localStorage.setItem('vect_openai_api_key', key);
      } else if (provider === 'claude') {
        localStorage.setItem('vect_claude_api_key', key);
      }

      updateDockModelBadge();
      window.dispatchEvent(new Event('app:settingsChanged'));
      showToast(`${provider.toUpperCase()} API Key saved successfully!`, 'success');
      if (quickApiBanner) quickApiBanner.style.display = 'none';
    });
  }

  function openDock(initialPrompt = '') {
    // Only allow opening when Master AI is active
    const state = aiManager.getState?.() ?? {};
    if (!state.master) {
      showToast('LLM Chat is inactive. Activate Master AI to use.', 'warning');
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
  // Close LLM Chat dock automatically when Master AI is turned off
  window.addEventListener('app:aiStateChanged', (e) => {
    const state = e.detail;
    if (!state.master) {
      closeDock();
    }
  });

  if (btnClose) btnClose.addEventListener('click', closeDock);
  if (btnCollapse) btnCollapse.addEventListener('click', toggleCollapseDock);

  if (btnClear) {
    btnClear.addEventListener('click', () => {
      chatMessages.innerHTML = `
        <div class="llm-msg llm-msg-system">
          <span class="material-symbols-outlined" style="font-size: 0.95rem; color: var(--accent-color, #38bdf8);">&#xe88e;</span>
          <span>Conversation cleared. Type a prompt, question, or select text in Monaco Editor and right-click "LLM Chat" to converse or rewrite here.</span>
        </div>
      `;
    });
  }
  // Disable input when Master AI is OFF
  const updateChatInputState = () => {
    const state = aiManager.getState?.() ?? {};
    const disabled = !state.master;
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
          <span class="material-symbols-outlined" style="font-size: 0.85rem;">smart_toy</span>
          <span>Thinking...</span>
        </span>
      </div>
      <div class="llm-ai-body" style="opacity: 0.7; font-style: italic;">Generating response...</div>
    `;
    chatMessages.appendChild(aiMsgEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    btnSend.disabled = true;

    try {
      const response = await queryLlmChat(prompt);
      if (response && response.text) {
        const text = response.text;
        const modelName = response.model || 'AI Assistant';
        aiMsgEl.innerHTML = `
          <div class="llm-msg-ai-header">
            <span style="display: flex; align-items: center; gap: 4px;">
              <span class="material-symbols-outlined" style="font-size: 0.85rem;">smart_toy</span>
              <span>${modelName}</span>
            </span>
          </div>
          <div class="llm-ai-body" style="white-space: pre-wrap; word-break: break-word;">${escapeHtml(text)}</div>
          <div class="llm-msg-actions">
            <button class="llm-action-btn btn-action-insert" title="Insert output at editor cursor">
              <span class="material-symbols-outlined" style="font-size: 0.75rem;">input</span>
              <span>Insert</span>
            </button>
            <button class="llm-action-btn btn-action-rewrite" title="Replace selected text with this output (decorated)">
              <span class="material-symbols-outlined" style="font-size: 0.75rem;">auto_fix_high</span>
              <span>Replace (Rewrite)</span>
            </button>
            <button class="llm-action-btn btn-action-copy" title="Copy to clipboard">
              <span class="material-symbols-outlined" style="font-size: 0.75rem;">content_copy</span>
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
            <span class="material-symbols-outlined" style="font-size: 0.85rem;">error</span>
            <span>Error</span>
          </div>
          <div class="llm-ai-body" style="color: #ef4444;">${escapeHtml(err)}</div>
        `;
      }
    } catch (e) {
      aiMsgEl.innerHTML = `
        <div class="llm-msg-ai-header" style="color: #ef4444;">
          <span class="material-symbols-outlined" style="font-size: 0.85rem;">error</span>
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
