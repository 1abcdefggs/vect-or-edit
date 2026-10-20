/**
 * First-run setup (aiSetupModal.html): language and theme, saving, AI.
 * Shown during startup while the editor loads. Every field starts at its default, so any step can be skipped;
 * language and theme apply at once, the rest is applied when the user finishes.
 */
import { STORAGE_KEYS, DEFAULTS } from '../../core/constants.js';
import { showToast } from '../notifications/toastManager.js';
import { applyI18n, currentLang, t } from '../../core/i18n';
import { applyLanguageSetting, applyThemeSetting, getStoredThemeSetting, populateThemeDropdown } from '../settings/settingsFacade.js';
import { isAutoSaveEnabled, markAutoSaveLocationConfirmed, updateAutoSaveUI } from '../../editor/ui/autoSaveManager.js';
import { syncSettingsToBackend } from '../settings/settingsState.js';
import { saveApiKey } from '../../core/apiKeyStore.js';
import { bindSaveLocationControls } from '../settings/saveLocation.js';

const TOTAL_STEPS = 3;

let setupCompleteCallback = null;
let isBound = false;
let currentStep = 1;
let editorReady = false;
// Set while finishSetup awaits the key save, so a second Finish / Skip click does nothing
let isFinishing = false;
const readyQueue = [];

const $ = (id) => document.getElementById(id);

export function initAiSetup(onComplete) {
  setupCompleteCallback = onComplete;
  bindSetup();
}

export function showAiSetupModal() {
  const overlay = $('aiSetupModalOverlay');
  if (!overlay) return;
  isFinishing = false;
  bindSetup();
  applyI18n();

  const langRadio = document.querySelector(`input[name="setup_lang"][value="${currentLang}"]`);
  if (langRadio) langRadio.checked = true;
  const themeSelect = $('setupThemeSelect');
  populateThemeDropdown(themeSelect);
  if (themeSelect) themeSelect.value = getStoredThemeSetting();
  const chkAutoSave = $('chkSetupAutoSave');
  if (chkAutoSave) chkAutoSave.checked = isAutoSaveEnabled();
  renderSaveLocation();

  currentStep = 1;
  renderStep();
  renderLoadStatus();
  overlay.style.display = 'flex';
  $('btnSetupNext')?.focus();
}

/** Called by the startup flow once the editor and settings have loaded. */
export function markSetupEditorReady() {
  editorReady = true;
  renderLoadStatus();
  readyQueue.splice(0).forEach((fn) => fn());
}

function whenEditorReady(fn) {
  if (editorReady) fn();
  else readyQueue.push(fn);
}

function bindSetup() {
  if (isBound || !$('aiSetupModalOverlay')) return;
  isBound = true;

  document.querySelectorAll('input[name="setup_lang"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.checked) applyLanguageSetting(radio.value);
    });
  });
  // Texts set from code follow the language; data-i18n texts are redrawn by applyI18n.
  window.addEventListener('app:languageChanged', () => {
    populateThemeDropdown($('setupThemeSelect'));
    renderStep();
    renderLoadStatus();
  });

  $('setupThemeSelect')?.addEventListener('change', (e) => applyThemeSetting(e.target.value));

  refreshSaveLocation = bindSaveLocationControls({
    pathEl: $('setupSaveLocation'),
    changeBtn: $('btnSetupChangeLocation'),
    resetBtn: $('btnSetupResetLocation'),
    browserTextKey: 'setup_save_location_browser'
  });

  const chkInstall = $('chkSetupInstallLocal');
  chkInstall?.addEventListener('change', () => {
    const details = $('setupAiInstallDetails');
    if (details) details.hidden = !chkInstall.checked;
  });
  const modelSelect = $('aiSetupLocalModel');
  modelSelect?.addEventListener('change', renderModelId);
  renderModelId();

  const btnToggleKey = $('btnToggleAiSetupKeyVisibility');
  const inputKey = $('aiSetupCloudKey');
  btnToggleKey?.addEventListener('click', () => {
    const isPass = inputKey.type === 'password';
    inputKey.type = isPass ? 'text' : 'password';
    const icon = btnToggleKey.querySelector('.material-symbols-outlined');
    if (icon) icon.textContent = isPass ? 'visibility' : 'visibility_off';
  });

  $('btnSetupBack')?.addEventListener('click', () => {
    if (currentStep > 1) { currentStep -= 1; renderStep(); }
  });
  $('btnSetupNext')?.addEventListener('click', () => {
    if (currentStep < TOTAL_STEPS) { currentStep += 1; renderStep(); }
    else finishSetup(true);
  });
  // Skip keeps the defaults for everything not applied yet.
  $('btnAiSetupCancel')?.addEventListener('click', () => finishSetup(false));
}

function renderStep() {
  document.querySelectorAll('[data-setup-step]').forEach((el) => {
    el.hidden = Number(el.getAttribute('data-setup-step')) !== currentStep;
  });
  document.querySelectorAll('[data-setup-dot]').forEach((el) => {
    const n = Number(el.getAttribute('data-setup-dot'));
    el.classList.toggle('is-current', n === currentStep);
    el.classList.toggle('is-done', n < currentStep);
  });
  const btnBack = $('btnSetupBack');
  if (btnBack) btnBack.hidden = currentStep === 1;
  const btnNext = $('btnSetupNext');
  if (btnNext) btnNext.textContent = t(currentStep === TOTAL_STEPS ? 'setup_btn_finish' : 'setup_btn_next');
  const dialog = document.querySelector('.first-run-dialog');
  if (dialog) dialog.setAttribute('aria-description', t('setup_step_label', { current: currentStep, total: TOTAL_STEPS }));
}

function renderLoadStatus() {
  const el = $('setupLoadStatus');
  if (!el) return;
  el.textContent = t(editorReady ? 'setup_ready' : 'setup_loading');
  el.classList.toggle('is-ready', editorReady);
}

function renderModelId() {
  const el = $('setupInstallModelId');
  if (el) el.textContent = $('aiSetupLocalModel')?.value || DEFAULTS.LOCAL_EMBEDDING_MODEL;
}

let refreshSaveLocation = () => {};

function renderSaveLocation() {
  refreshSaveLocation();
  const hintEl = $('setupSaveLocationHint');
  if (hintEl) hintEl.hidden = !window.engineAPI?.getDefaultWorkspace;
}

/** Stores the typed key encrypted in the main process. */
async function saveCloudKey() {
  const rawApiKey = $('aiSetupCloudKey')?.value?.trim() || '';
  if (!rawApiKey) return;
  const provider = $('aiSetupCloudProvider')?.value || 'gemini';
  const res = await saveApiKey(provider, rawApiKey);
  if (!res.success) {
    showToast(res.error || t('setup_key_failed'), 'error');
    return;
  }
  localStorage.setItem(STORAGE_KEYS.AI_PROVIDER, provider);
  $('aiSetupCloudKey').value = '';
}

/** Installs the chosen local model in the background; progress shows in the log panel and the AI LED. */
function queueLocalModelInstall() {
  const model = $('aiSetupLocalModel')?.value || DEFAULTS.LOCAL_EMBEDDING_MODEL;
  localStorage.setItem(STORAGE_KEYS.LOCAL_EMBEDDING_MODEL, model);
  localStorage.setItem(STORAGE_KEYS.EMBEDDING_SOURCE, 'local');

  const onProgress = (e) => {
    const status = e.detail?.status;
    if (status === 'ready' || status === 'done') {
      window.removeEventListener('app:aiModelProgress', onProgress);
    } else if (status === 'error') {
      window.removeEventListener('app:aiModelProgress', onProgress);
      showToast(t('setup_ai_failed'), 'error');
    }
  };
  window.addEventListener('app:aiModelProgress', onProgress);

  whenEditorReady(() => {
    showToast(t('setup_ai_queued', { model: model.split('/').pop() }), 'info');
    window.dispatchEvent(new CustomEvent('app:requestLocalAiInit', { detail: { model } }));
  });
}

/** apply = true stores the saving and AI choices; false (Skip setup) keeps their defaults. */
async function finishSetup(apply) {
  if (isFinishing) return;
  isFinishing = true;

  // The default folder is part of the defaults, so the first keystroke never asks for a location.
  markAutoSaveLocationConfirmed();

  if (apply) {
    localStorage.setItem(STORAGE_KEYS.AUTO_SAVE, String($('chkSetupAutoSave')?.checked !== false));
    updateAutoSaveUI();
    try {
      await saveCloudKey();
    } catch (err) {
      console.warn('[Setup] Could not store the API key:', err);
    }
    if ($('chkSetupInstallLocal')?.checked) queueLocalModelInstall();
  }

  localStorage.setItem(STORAGE_KEYS.AI_SETUP_COMPLETED, 'true');
  syncSettingsToBackend();

  const overlay = $('aiSetupModalOverlay');
  if (overlay) overlay.style.display = 'none';
  const callback = setupCompleteCallback;
  setupCompleteCallback = null;
  if (callback) callback();

  window.dispatchEvent(new Event('app:settingsChanged'));
}
