import { STORAGE_KEYS, DEFAULTS } from '../../core/constants.js';
import { initLocalAiWorker } from '../../search/searchLocalAi.js';
import { showToast } from '../notifications/toastManager.js';

let setupCompleteCallback = null;

export function initAiSetup(onComplete) {
  setupCompleteCallback = onComplete;

  const overlay = document.getElementById('aiSetupModalOverlay');
  if (!overlay) return;

  const radios = document.querySelectorAll('input[name="ai_setup_provider"]');
  const cloudOptions = document.getElementById('aiSetupCloudOptions');
  const localOptions = document.getElementById('aiSetupLocalOptions');

  const btnSave = document.getElementById('btnAiSetupSave');
  const btnCancel = document.getElementById('btnAiSetupCancel');

  radios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const val = e.target.value;
      cloudOptions.style.display = val === 'cloud' ? 'flex' : 'none';
      localOptions.style.display = val === 'local' ? 'flex' : 'none';
      
      // Update button text dynamically
      if (val === 'local') {
        btnSave.textContent = 'Download & Start';
      } else {
        btnSave.textContent = 'Save & Start';
      }
    });
  });

  // Set initial button text based on default selection
  const initialSelected = document.querySelector('input[name="ai_setup_provider"]:checked')?.value;
  if (initialSelected === 'local') {
    btnSave.textContent = 'Download & Start';
  }

  btnSave.addEventListener('click', async () => {
    const selected = document.querySelector('input[name="ai_setup_provider"]:checked')?.value;
    if (!selected) return;

    if (selected === 'cloud') {
      const provider = document.getElementById('aiSetupCloudProvider').value;
      const key = document.getElementById('aiSetupCloudKey').value;

      if (!key) {
        showToast('API Key is required for Cloud AI.', 'error');
        return;
      }

      localStorage.setItem(STORAGE_KEYS.AI_PROVIDER, provider);
      if (provider === 'gemini') localStorage.setItem(STORAGE_KEYS.GEMINI_API_KEY, key);
      if (provider === 'openai') localStorage.setItem(STORAGE_KEYS.OPENAI_API_KEY, key);
      if (provider === 'claude') localStorage.setItem(STORAGE_KEYS.CLAUDE_API_KEY, key);

      finalizeSetup();
    } else if (selected === 'local') {
      const model = document.getElementById('aiSetupLocalModel').value;
      localStorage.setItem(STORAGE_KEYS.AI_PROVIDER, 'local');
      localStorage.setItem(STORAGE_KEYS.LOCAL_EMBEDDING_MODEL, model);

      // Start Download / Init Process
      const progressArea = document.getElementById('aiSetupProgressArea');
      progressArea.style.display = 'block';

      // Hook up to worker download events (a bit hacky but works for UI)
      window.addEventListener('ai_progress', (e) => {
        const { progress } = e.detail;
        document.getElementById('aiSetupProgressPct').textContent = `${Math.round(progress)}%`;
        document.getElementById('aiSetupProgressBar').style.width = `${progress}%`;
      });

      window.addEventListener('ai_ready', () => {
        finalizeSetup();
      });

      // trigger initialization
      initLocalAiWorker(() => { });
      window.dispatchEvent(new CustomEvent('app:requestLocalAiInit'));
    } else if (selected === 'none') {
      localStorage.setItem(STORAGE_KEYS.AI_PROVIDER, 'none');
      finalizeSetup();
    }
  });

  if (btnCancel) {
    btnCancel.addEventListener('click', () => {
      overlay.style.display = 'none';
      if (setupCompleteCallback) setupCompleteCallback();
    });
  }
}

export function showAiSetupModal() {
  const overlay = document.getElementById('aiSetupModalOverlay');
  if (overlay) {
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
