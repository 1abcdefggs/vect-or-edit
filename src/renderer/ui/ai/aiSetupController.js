/**
 * First-run setup (aiSetupModal.html): language and theme, save location, AI.
 * Shown during startup while the editor loads. Every field starts at its default, so "Next" all the way through
 * is a valid setup; language and theme apply at once, the rest is applied when the user finishes.
 * The step bar (stepTabs.js) and the switches (toggleSwitch.js) are shared parts; this file only decides what they show.
 */
import { STORAGE_KEYS, DEFAULTS } from '../../core/constants.js';
import { showToast } from '../notifications/toastManager.js';
import { applyI18n, currentLang, t } from '../../core/i18n';
import { applyColorMode, applyLanguageSetting, applyThemeSetting, getStoredThemeSetting, getThemeList, refreshColorModeControls } from '../settings/settingsFacade.js';
import { getThemePreview, hasBothFaces, isDarkModeActive } from '../../editor/core/themeLoader.js';
import { applyEditorCanvasTone } from '../../editor/editorManager.js';
import { AUTO_SAVE_DELAY_RANGE_MS, getAutoSaveDelayMs, isIdleAutoSaveEnabled, isNewlineAutoSaveEnabled, markAutoSaveLocationConfirmed, setAutoSaveDelayMs, setTriggers, updateAutoSaveUI } from '../../editor/ui/autoSaveManager.js';
import { syncSettingsToBackend } from '../settings/settingsState.js';
import { saveApiKey } from '../../core/apiKeyStore.js';
import { bindSaveLocationControls } from '../settings/saveLocation.js';
import { getDownloadedModelIds } from '../../search/embeddingModels.js';
import { createStepTabs } from '../components/stepTabs.js';
import { bindToggleSwitch } from '../components/toggleSwitch.js';
import { renderInfoTips } from '../components/infoTip.js';
import { renderMarkdownInto } from '../../editor/ui/markdownPreview.js';
import { applyFormatToUnsavedTabs, getDefaultDocumentFormat } from '../../editor/tabs/tabState.js';
import { toDocumentFormat } from '../../../shared/documentFormat';

// Dictionary keys of the step names, in order; they name the tabs and the Back / Next buttons
const STEP_KEYS = ['setup_step_appearance', 'setup_step_saving', 'setup_step_ai'];
const TOTAL_STEPS = STEP_KEYS.length;
// The one model the setup installs (the others are English-only or much larger); Settings still lists them all
const SETUP_MODEL = DEFAULTS.LOCAL_EMBEDDING_MODEL;

let setupCompleteCallback = null;
let isBound = false;
let currentStep = 1;
let editorReady = false;
// Set once finishSetup starts (it awaits the key save), so a second click on the last button does nothing
let isFinishing = false;
const readyQueue = [];

let stepTabs = null;
let autoSaveIdleSwitch = null;
let autoSaveNewlineSwitch = null;
// One switch for both triggers: on while either is on; the two stay folded away until the user opens them
let autoSaveAllSwitch = null;

/** The master switch shows ON while at least one trigger is on. */
function syncAutoSaveAllSwitch() {
  autoSaveAllSwitch?.sync(Boolean(autoSaveIdleSwitch?.isChecked() || autoSaveNewlineSwitch?.isChecked()));
}

/** The typed pause in seconds, kept to the allowed range and to half seconds; null when the field is not a number. */
function readDelaySeconds() {
  const raw = $('setupAutoSaveDelay')?.value.trim();
  const seconds = Number(raw);
  if (!raw || !Number.isFinite(seconds)) return null;
  const min = AUTO_SAVE_DELAY_RANGE_MS.min / 1000;
  const max = AUTO_SAVE_DELAY_RANGE_MS.max / 1000;
  return Math.min(max, Math.max(min, Math.round(seconds * 2) / 2));
}
let localAiSwitch = null;
let saveLocation = null;
// True while the Markdown format card shows its rendered view instead of its source
let isSamplePreviewing = false;

const $ = (id) => document.getElementById(id);
const stepName = (n) => t(STEP_KEYS[n - 1]);

export function initAiSetup(onComplete) {
  setupCompleteCallback = onComplete;
  bindSetup();
}

export function showAiSetupModal() {
  const overlay = $('aiSetupModalOverlay');
  if (!overlay) return;
  isFinishing = false;
  // The header shows only its brand while setup runs (see header.css)
  document.documentElement.classList.add('setup-active');
  bindSetup();
  applyI18n();
  renderTips();
  isSamplePreviewing = false;
  renderFormatSamples();

  const langRadio = document.querySelector(`input[name="setup_lang"][value="${currentLang}"]`);
  if (langRadio) langRadio.checked = true;
  refreshColorModeControls();
  renderThemeCards();
  const formatRadio = document.querySelector(`input[name="setup_format"][value="${getDefaultDocumentFormat()}"]`);
  if (formatRadio) formatRadio.checked = true;
  autoSaveIdleSwitch?.set(isIdleAutoSaveEnabled());
  autoSaveNewlineSwitch?.set(isNewlineAutoSaveEnabled());
  syncAutoSaveAllSwitch();
  const delayInput = $('setupAutoSaveDelay');
  if (delayInput) delayInput.value = String(getAutoSaveDelayMs() / 1000);
  // The embedding model is the core of the tool, so it starts switched on
  localAiSwitch?.set(true);
  saveLocation?.refresh();
  showInstallPath();
  renderLocalNotice();

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

  stepTabs = createStepTabs($('setupStepTabs'), {
    label: t('setup_step_label_nav'),
    onGo: (n) => goToStep(n)
  });

  // The appearance switch; the header button and the settings select stay in step through refreshColorModeControls
  document.querySelectorAll('input[name="setup_mode"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.checked) applyColorMode(radio.value);
    });
  });
  document.querySelectorAll('input[name="setup_lang"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.checked) applyLanguageSetting(radio.value);
    });
  });
  // Texts set from code follow the language; data-i18n texts are redrawn by applyI18n.
  window.addEventListener('app:languageChanged', () => {
    renderThemeCards();
    renderStep();
    renderLoadStatus();
    renderLocalNotice();
    renderTips();
    renderFormatSamples();
  });
  // The cards follow a theme chosen somewhere else (header, settings) and redraw their samples on every applied
  // theme, since a mode change (or the OS, in system mode) swaps the face they show
  window.addEventListener('app:themeApplied', renderThemeCards);

  saveLocation = bindSaveLocationControls({
    pathEl: $('setupSaveLocation'),
    changeBtn: $('btnSetupChangeLocation'),
    resetBtn: $('btnSetupResetLocation'),
    nameInput: $('setupFolderName'),
    nameHintEl: $('setupFolderNameHint'),
    idleHintKey: 'setup_folder_name_commit_hint',
    browserTextKey: 'setup_save_location_browser'
  });
  // The whole frame is the field: a click anywhere in it starts typing, so the pencil does not look like a separate button
  $('setupFolderName')?.closest('.first-run-name-box')?.addEventListener('click', () => $('setupFolderName').focus());

  // Both triggers start on: a pause saves, and so does each new line
  autoSaveIdleSwitch = bindToggleSwitch($('toggleSetupAutoSaveIdle'), { checked: true, onChange: syncAutoSaveAllSwitch });
  autoSaveNewlineSwitch = bindToggleSwitch($('toggleSetupAutoSaveNewline'), { checked: true, onChange: syncAutoSaveAllSwitch });
  autoSaveAllSwitch = bindToggleSwitch($('toggleSetupAutoSaveAll'), {
    checked: true,
    onChange: (on) => {
      autoSaveIdleSwitch.set(on);
      autoSaveNewlineSwitch.set(on);
    }
  });
  $('btnSetupAutoSaveDetails')?.addEventListener('click', (e) => {
    const open = e.currentTarget.getAttribute('aria-expanded') !== 'true';
    e.currentTarget.setAttribute('aria-expanded', String(open));
    $('setupAutoSaveDetails').hidden = !open;
  });
  // The pause is typed in seconds; it snaps to the allowed range and half-second steps when the user leaves the field
  $('setupAutoSaveDelay')?.addEventListener('change', () => {
    const input = $('setupAutoSaveDelay');
    const seconds = readDelaySeconds();
    input.classList.toggle('is-invalid', seconds === null);
    if (seconds !== null) input.value = String(seconds);
  });
  localAiSwitch = bindToggleSwitch($('toggleSetupInstallLocal'), {
    checked: true,
    onChange: () => {
      renderLocalNotice();
      renderStep();
    }
  });

  // The format cards: a click anywhere on a card chooses it (the buttons inside keep their own job)
  document.querySelectorAll('#setupFormatCardMarkdown, #setupFormatCardText').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button, label')) return;
      const radio = card.querySelector('input[type="radio"]');
      if (radio && !radio.checked) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  });
  $('btnSetupSampleToggle')?.addEventListener('click', () => {
    isSamplePreviewing = !isSamplePreviewing;
    renderFormatSamples();
  });

  renderModelId();

  const providerSelect = $('aiSetupCloudProvider');
  const inputKey = $('aiSetupCloudKey');
  const syncKeyField = () => {
    if (!inputKey) return;
    const locked = !providerSelect?.value;
    inputKey.disabled = locked;
    // The hint explains the lock; the attribute is swapped too so a language change redraws the right text
    const key = locked ? 'ai_setup_api_key_placeholder_locked' : 'ai_setup_api_key_placeholder';
    inputKey.setAttribute('data-i18n-placeholder', key);
    inputKey.placeholder = t(key);
  };
  providerSelect?.addEventListener('change', syncKeyField);
  syncKeyField();

  const btnToggleKey = $('btnToggleAiSetupKeyVisibility');
  btnToggleKey?.addEventListener('click', () => {
    const isPass = inputKey.type === 'password';
    inputKey.type = isPass ? 'text' : 'password';
    const icon = btnToggleKey.querySelector('.material-symbols-outlined');
    if (icon) icon.textContent = isPass ? 'visibility' : 'visibility_off';
  });

  $('btnSetupBack')?.addEventListener('click', () => goToStep(currentStep - 1));
  $('btnSetupNext')?.addEventListener('click', () => {
    if (currentStep < TOTAL_STEPS) goToStep(currentStep + 1);
    else finishSetup();
  });
}

/**
 * Moves to another step. Leaving the save step first applies the folder name, because a name with a problem
 * must not be left behind unnoticed: the field gets the focus and the user stays on the step.
 */
async function goToStep(n) {
  const target = Math.min(Math.max(n, 1), TOTAL_STEPS);
  if (target === currentStep || isFinishing) return;
  if (currentStep === 2 && saveLocation && !(await saveLocation.commit())) {
    saveLocation.focusName();
    return;
  }
  currentStep = target;
  renderStep();
}

function renderStep() {
  document.querySelectorAll('[data-setup-step]').forEach((el) => {
    el.hidden = Number(el.getAttribute('data-setup-step')) !== currentStep;
  });
  stepTabs?.render({ steps: STEP_KEYS.map((_, i) => stepName(i + 1)), current: currentStep });
  $('setupStepTabs')?.setAttribute('aria-label', t('setup_step_label_nav'));

  const btnBack = $('btnSetupBack');
  if (btnBack) {
    btnBack.hidden = currentStep === 1;
    // The buttons say where they lead, so the next action is clear without reading the tabs
    if (currentStep > 1) {
      $('btnSetupBackCaption').textContent = t('setup_btn_back_caption');
      $('btnSetupBackLabel').textContent = stepName(currentStep - 1);
    }
  }
  if (currentStep < TOTAL_STEPS) {
    $('btnSetupNextCaption').textContent = t('setup_btn_next_caption');
    $('btnSetupNextLabel').textContent = stepName(currentStep + 1);
  } else {
    // The last button has no caption: it finishes the setup
    $('btnSetupNextCaption').textContent = '';
    $('btnSetupNextLabel').textContent = t(localAiSwitch?.isChecked() === false ? 'setup_btn_finish_no_model' : 'setup_btn_finish');
  }
  const dialog = document.querySelector('.first-run-dialog');
  if (dialog) dialog.setAttribute('aria-description', t('setup_step_label', { current: currentStep, total: TOTAL_STEPS }));
}

/**
 * Fills the two format samples. The Markdown one is shown as source ("## heading" in the title, symbols in the list)
 * or, with the Preview button, as the rendered view made by the same renderer as the editor preview.
 */
async function renderFormatSamples() {
  const source = $('setupSampleMarkdownSource');
  const view = $('setupSampleMarkdownView');
  if (!source || !view) return;
  source.textContent = t('setup_format_sample_markdown');
  const textSample = $('setupSampleText');
  if (textSample) textSample.textContent = t('setup_format_sample_text');

  const previewing = isSamplePreviewing;
  if (previewing) {
    try {
      await renderMarkdownInto(view, t('setup_format_sample_markdown'));
    } catch (err) {
      console.warn('[Setup] Could not render the Markdown sample:', err);
      isSamplePreviewing = false;
    }
  }
  const showView = isSamplePreviewing;
  source.hidden = showView;
  view.hidden = !showView;
  $('setupFormatCardMarkdown')?.classList.toggle('is-previewing', showView);
  const toggle = $('btnSetupSampleToggle');
  if (toggle) toggle.setAttribute('aria-pressed', String(showView));
  // The same words as the status-bar button: "Preview" to look, "Edit" to go back to the symbols
  const label = $('setupSampleToggleLabel');
  if (label) label.textContent = t(showView ? 'btn_markdown_edit' : 'btn_markdown_preview');
}

/** The (i) icons beside the headings; their text follows the language. */
function renderTips() {
  renderInfoTips($('aiSetupModalOverlay'), t, t('setup_info_label'));
}

/** The status line shows only while the editor is still loading; once it is ready the line disappears. */
function renderLoadStatus() {
  const el = $('setupLoadStatus');
  if (el) el.textContent = editorReady ? '' : t('setup_loading');
}

function renderModelId() {
  const el = $('setupInstallModelId');
  if (el) el.textContent = SETUP_MODEL;
}

/** Shows where the model ends up: the app's own data folder (the browser build has none). */
async function showInstallPath() {
  const el = $('setupInstallPath');
  if (!el) return;
  try {
    el.textContent = (await window.engineAPI?.getUserDataPath?.()) || t('setup_ai_fact_place_browser');
  } catch {
    el.textContent = t('setup_ai_fact_place_browser');
  }
}

/** Without the embedding model nothing can be inferred, so the notice says so, and warns when it is switched off. */
function renderLocalNotice() {
  const notice = $('setupLocalNotice');
  const text = $('setupLocalNoticeText');
  if (!notice || !text) return;
  const installing = localAiSwitch ? localAiSwitch.isChecked() : true;
  text.textContent = t(installing ? 'setup_ai_notice_on' : 'setup_ai_notice_off');
  notice.classList.toggle('is-warning', !installing);
}

// --- Theme cards: a small editor sample in each theme's own colors ------------------------------------------------

function sampleLine(widths, colors) {
  const line = document.createElement('span');
  line.className = 'first-run-theme-line';
  widths.forEach((width, i) => {
    const bar = document.createElement('i');
    bar.style.width = width;
    bar.style.background = colors[i];
    line.append(bar);
  });
  return line;
}

/** The custom card is a background and text color pair, not a theme: it overrides the editor canvas of the selected theme. */
const CUSTOM_CARD = 'custom';

function customColors() {
  return {
    bg: localStorage.getItem(STORAGE_KEYS.CUSTOM_EDITOR_BG) || '#1e1e2e',
    fg: localStorage.getItem(STORAGE_KEYS.CUSTOM_EDITOR_FG) || '#cdd6f4',
  };
}

/** The custom card's sample: the chosen canvas with its text color on every line. */
function customSamplePreview() {
  const { bg, fg } = customColors();
  return { background: bg, lineNumber: fg, keyword: fg, foreground: fg, string: fg };
}

function isCustomToneOn() {
  return localStorage.getItem(STORAGE_KEYS.EDITOR_BG_TONE) === 'custom';
}

/** Keeps the editor tone selects of the settings in step with the setup cards. */
function setToneSelects(tone) {
  ['modalEditorBgSelect', 'quickEditorToneSelect'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = tone;
  });
}

async function selectCustomTone() {
  const { bg, fg } = customColors();
  localStorage.setItem(STORAGE_KEYS.CUSTOM_EDITOR_BG, bg);
  localStorage.setItem(STORAGE_KEYS.CUSTOM_EDITOR_FG, fg);
  localStorage.setItem(STORAGE_KEYS.EDITOR_BG_TONE, 'custom');
  setToneSelects('custom');
  await applyEditorCanvasTone('custom', bg, fg);
  syncSettingsToBackend();
  updateThemeCardState();
}

async function selectThemeCard(name) {
  if (isCustomToneOn()) {
    localStorage.setItem(STORAGE_KEYS.EDITOR_BG_TONE, 'default');
    setToneSelects('default');
    await applyEditorCanvasTone('default');
  }
  await applyThemeSetting(name);
}

function themeCard(name) {
  const isCustom = name === CUSTOM_CARD;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'first-run-theme-card';
  button.dataset.theme = name;

  // The sample shows the face the current mode uses; a theme with both faces gets the other face as a corner
  const p = isCustom ? customSamplePreview() : getThemePreview(name);
  const other = !isCustom && hasBothFaces(name) ? getThemePreview(name, isDarkModeActive() ? 'light' : 'dark') : null;
  const sample = document.createElement('span');
  sample.className = 'first-run-theme-sample';
  sample.setAttribute('aria-hidden', 'true');
  sample.style.background = other
    ? `linear-gradient(135deg, ${p.background} 78%, ${other.background} 78%)`
    : p.background;
  sample.append(
    sampleLine(['6px', '28%', '40%'], [p.lineNumber, p.keyword, p.foreground]),
    sampleLine(['6px', '22%', '50%'], [p.lineNumber, p.foreground, p.string]),
    sampleLine(['6px', '45%'], [p.lineNumber, p.keyword])
  );

  const label = document.createElement('span');
  label.className = 'first-run-theme-name';
  label.textContent = isCustom ? t('theme_custom') : name;
  button.append(sample, label);
  button.addEventListener('click', () => (isCustom ? selectCustomTone() : selectThemeCard(name)));
  return button;
}

function renderThemeCards() {
  const grid = $('setupThemeCards');
  if (!grid) return;
  grid.replaceChildren(...[...getThemeList(), CUSTOM_CARD].map(themeCard));
  updateThemeCardState();
}

/** Exactly one card is pressed: the custom card while its canvas is on, otherwise the chosen theme or auto. */
function updateThemeCardState() {
  const customOn = isCustomToneOn();
  const current = getStoredThemeSetting();
  document.querySelectorAll('#setupThemeCards .first-run-theme-card').forEach((card) => {
    const pressed = card.dataset.theme === CUSTOM_CARD ? customOn : !customOn && card.dataset.theme === current;
    card.setAttribute('aria-pressed', String(pressed));
  });
}

// --- Finishing ----------------------------------------------------------------------------------------------------

/** Stores the typed key encrypted in the main process. */
async function saveCloudKey() {
  const provider = $('aiSetupCloudProvider')?.value;
  const rawApiKey = $('aiSetupCloudKey')?.value?.trim() || '';
  if (!provider || !rawApiKey) return;
  const res = await saveApiKey(provider, rawApiKey);
  if (!res.success) {
    showToast(res.error || t('setup_key_failed'), 'error');
    return;
  }
  localStorage.setItem(STORAGE_KEYS.LLM_PROVIDER, provider);
  $('aiSetupCloudKey').value = '';
}

/** Installs the chosen local model in the background; progress shows in the log panel and the AI LED. */
function queueLocalModelInstall() {
  const model = SETUP_MODEL;
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

  // A model cached by an earlier run is only loaded, not downloaded again; the message says so
  const isCached = getDownloadedModelIds().has(model);
  whenEditorReady(() => {
    showToast(t(isCached ? 'setup_ai_cached' : 'setup_ai_queued', { model: model.split('/').pop() }), 'info');
    window.dispatchEvent(new CustomEvent('app:requestLocalAiInit', { detail: { model } }));
  });
}

/** Stores the saving and AI choices and closes the setup. Reached only from the last step's button. */
async function finishSetup() {
  if (isFinishing) return;
  isFinishing = true;

  // The default folder is part of the defaults, so the first keystroke never asks for a location.
  markAutoSaveLocationConfirmed();

  // New documents start in the chosen format; documents that were never saved (the welcome one) follow it now
  const format = toDocumentFormat(document.querySelector('input[name="setup_format"]:checked')?.value);
  localStorage.setItem(STORAGE_KEYS.DOCUMENT_FORMAT, format);
  applyFormatToUnsavedTabs(format);

  setTriggers({
    idle: autoSaveIdleSwitch ? autoSaveIdleSwitch.isChecked() : true,
    newline: autoSaveNewlineSwitch ? autoSaveNewlineSwitch.isChecked() : true
  });
  const delaySeconds = readDelaySeconds();
  if (delaySeconds !== null) setAutoSaveDelayMs(delaySeconds * 1000);
  updateAutoSaveUI();
  try {
    await saveCloudKey();
  } catch (err) {
    console.warn('[Setup] Could not store the API key:', err);
  }
  if (localAiSwitch?.isChecked()) queueLocalModelInstall();

  localStorage.setItem(STORAGE_KEYS.AI_SETUP_COMPLETED, 'true');
  syncSettingsToBackend();

  const overlay = $('aiSetupModalOverlay');
  if (overlay) overlay.style.display = 'none';
  document.documentElement.classList.remove('setup-active');
  const callback = setupCompleteCallback;
  setupCompleteCallback = null;
  if (callback) callback();

  window.dispatchEvent(new Event('app:settingsChanged'));
}
