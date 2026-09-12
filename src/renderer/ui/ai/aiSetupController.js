import { STORAGE_KEYS, DEFAULTS } from '../../core/constants.js';
import { initLocalAiWorker } from '../../search/searchLocalAi.js';
import { showToast } from '../notifications/toastManager.js';
import { applyI18n, t } from '../../core/i18n';

let setupCompleteCallback = null;

export function initAiSetup(onComplete) {
  setupCompleteCallback = onComplete;

  const overlay = document.getElementById('aiSetupModalOverlay');
  if (!overlay) return;

  // Apply internationalization translations to modal components
  applyI18n();

  const radiosEmb = document.querySelectorAll('input[name="ai_setup_embedding"]');
  const localModelSelect = document.getElementById('aiSetupLocalModel');
  const selCloudProvider = document.getElementById('aiSetupCloudProvider');
  const inputCloudKey = document.getElementById('aiSetupCloudKey');
  const btnToggleKey = document.getElementById('btnToggleAiSetupKeyVisibility');

  const btnSave = document.getElementById('btnAiSetupSave');
  const btnCancel = document.getElementById('btnAiSetupCancel');

  // Key Visibility Toggle
  if (btnToggleKey && inputCloudKey) {
    btnToggleKey.addEventListener('click', () => {
      const isPass = inputCloudKey.type === 'password';
      inputCloudKey.type = isPass ? 'text' : 'password';
      const icon = btnToggleKey.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = isPass ? 'visibility' : 'visibility_off';
    });
  }

  // Dynamic button text based on Embedding radio selection
  const updateSaveButtonText = () => {
    const selectedEmb = document.querySelector('input[name="ai_setup_embedding"]:checked')?.value || 'local';
    if (btnSave) {
      if (selectedEmb === 'local') {
        btnSave.textContent = t('btn_download_start') || 'Download';
      } else {
        btnSave.textContent = t('btn_save_start') || 'Save & Start';
      }
    }
  };

  radiosEmb.forEach(radio => {
    radio.addEventListener('change', updateSaveButtonText);
  });
  updateSaveButtonText();

  // Save / Action Handlers
  btnSave.addEventListener('click', async () => {
    const selectedEmb = document.querySelector('input[name="ai_setup_embedding"]:checked')?.value || 'local';
    const chosenProvider = selCloudProvider?.value || 'gemini';
    const rawApiKey = inputCloudKey?.value?.trim() || '';

    // 1. Save LLM configuration if provided
    if (rawApiKey) {
      localStorage.setItem(STORAGE_KEYS.AI_PROVIDER, chosenProvider);
      if (chosenProvider === 'gemini') {
        if (window.engineAPI?.saveGeminiApiKey) {
          await window.engineAPI.saveGeminiApiKey(rawApiKey);
        }
        localStorage.removeItem(STORAGE_KEYS.GEMINI_API_KEY);
      } else if (chosenProvider === 'openai') {
        localStorage.setItem(STORAGE_KEYS.OPENAI_API_KEY, rawApiKey);
      } else if (chosenProvider === 'claude') {
        localStorage.setItem(STORAGE_KEYS.CLAUDE_API_KEY, rawApiKey);
      }
    }

    // 2. Handle Embedding Configuration
    if (selectedEmb === 'local') {
      const model = localModelSelect?.value || DEFAULTS.LOCAL_EMBEDDING_MODEL;
      localStorage.setItem(STORAGE_KEYS.LOCAL_EMBEDDING_MODEL, model);
      localStorage.setItem(STORAGE_KEYS.EMBEDDING_SOURCE, 'local');

      // Start Download / Init Process
      const progressArea = document.getElementById('aiSetupProgressArea');
      if (progressArea) progressArea.style.display = 'block';

      const handleAiProgress = (e) => {
        const { pct, status } = e.detail || {};
        if (status === 'initiate' || status === 'download' || status === 'progress') {
          const progress = pct !== undefined ? pct : 0;
          const pctEl = document.getElementById('aiSetupProgressPct');
          const barEl = document.getElementById('aiSetupProgressBar');
          if (pctEl) pctEl.textContent = `${Math.round(progress)}%`;
          if (barEl) barEl.style.width = `${progress}%`;
        } else if (status === 'ready' || status === 'done') {
          window.removeEventListener('app:aiModelProgress', handleAiProgress);
          finalizeSetup();
        } else if (status === 'error') {
          window.removeEventListener('app:aiModelProgress', handleAiProgress);
          showToast('Failed to download AI model.', 'error');
          if (progressArea) progressArea.style.display = 'none';
        }
      };

      window.addEventListener('app:aiModelProgress', handleAiProgress);
      window.dispatchEvent(new CustomEvent('app:requestLocalAiInit', { detail: { model } }));
    } else if (selectedEmb === 'cloud') {
      localStorage.setItem(STORAGE_KEYS.EMBEDDING_SOURCE, 'llm-embed-gemini');
      finalizeSetup();
    } else if (selectedEmb === 'none') {
      localStorage.setItem(STORAGE_KEYS.EMBEDDING_SOURCE, 'none');
      finalizeSetup();
    }
  });

  const btnOpenSettings = document.getElementById('btnAiSetupOpenSettings');
  if (btnOpenSettings) {
    btnOpenSettings.addEventListener('click', () => {
      overlay.style.display = 'none';
      if (setupCompleteCallback) setupCompleteCallback();
      window.dispatchEvent(new CustomEvent('app:openSettings', { detail: { tab: 'tabAiSearch' } }));
    });
  }

  // 'あとで設定' handler: Dismiss modal, mark setup completed to avoid blocking user
  if (btnCancel) {
    btnCancel.addEventListener('click', () => {
      finalizeSetup();
    });
  }
}

export function showAiSetupModal() {
  const overlay = document.getElementById('aiSetupModalOverlay');
  if (overlay) {
    applyI18n();
    overlay.style.display = 'flex';
  }
}

function finalizeSetup() {
  localStorage.setItem(STORAGE_KEYS.AI_SETUP_COMPLETED, 'true');
  const overlay = document.getElementById('aiSetupModalOverlay');
  if (overlay) overlay.style.display = 'none';

  if (setupCompleteCallback) setupCompleteCallback();

  // Update toolbar if it exists
  window.dispatchEvent(new Event('app:settingsChanged'));
}
