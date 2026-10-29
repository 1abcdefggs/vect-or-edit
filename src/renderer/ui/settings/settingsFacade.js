import { icons } from '../../core/icons.js';
import { changeLanguage, currentLang, i18n, t } from '../../core/i18n.js';
import { loadTheme, availableThemes, getMonacoThemeId, getStoredThemeSetting, COLOR_MODES, getColorMode } from '../../editor/core/themeLoader.js';
import { setLedStatus } from '../../core/statusManager.js';
import { STORAGE_KEYS, DEFAULTS } from '../../core/constants.js';
import { importDictionary } from '../../search/dictionary.js';
import { applyEditorCanvasTone, exportWorkspaceBundle, importWorkspaceBundle, refreshLinter, updateAutoSaveUI } from '../../editor/editorManager.js';
import { syncSettingsToBackend } from './settingsState.js';
import { showToast } from '../notifications/toastManager.js';
import { notifyEmbeddingModelsChanged } from '../../search/searchLocalAi.js';
import { getActiveModelId, getDownloadedModelIds } from '../../search/embeddingModels.js';
import { bindEmbeddingModelEvents, renderEmbeddingModelList } from './embeddingModelList.js';
import { initEmbeddingSourceController } from './embeddingSourceController.js';
import { clearAllApiKeys, isApiKeyConfigured, refreshApiKeyStatus, saveApiKey } from '../../core/apiKeyStore.js';
import { bindSaveLocationControls } from './saveLocation.js';
import { getDefaultDocumentFormat } from '../../editor/tabs/tabState.js';
import { confirmClose } from '../notifications/closeGuard.js';
import { showConfirmModal } from '../notifications/confirmModal.js';
import { resetApp } from './resetApp.js';
import { initWindowFeatureSettings } from './windowFeatureSettings.js';
import { initChoiceControls } from './choiceControls.js';
import { initSettingsHelpPane } from './settingsHelpPane.js';
import { initSettingsAreaMap } from './settingsAreaMap.js';

function setAndSync(key, value) {
  localStorage.setItem(key, value);
  syncSettingsToBackend();
}

let updateEditorOptionsCallback = null;

const FALLBACK_THEMES = ['Dracula', 'GitHub', 'Monokai', 'Night Owl', 'Tukune'];
const THEME_SELECT_IDS = ['themeSelect', 'modalThemeSelect'];

/** Every theme the app can apply, in the order the pickers show them (the first-run theme cards use it too). */
export function getThemeList() {
  return (availableThemes && availableThemes.length > 0) ? availableThemes : FALLBACK_THEMES;
}

export { getStoredThemeSetting, getColorMode };

/** Fills a theme select with every theme, keeping its current value. A theme's light or dark face follows the mode. */
export function populateThemeDropdown(selectEl) {
  if (!selectEl) return;
  const currentVal = selectEl.value;
  selectEl.innerHTML = '';

  getThemeList().forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    selectEl.appendChild(opt);
  });

  if (currentVal) {
    selectEl.value = currentVal;
  }
}


/**
 * Shows the stored appearance mode on every control that sets it: the settings select (System / Light / Dark),
 * the header switch and the first-run switch.
 */
export function refreshColorModeControls() {
  const mode = getColorMode();
  const sel = document.getElementById('modalColorModeSelect');
  if (sel) {
    sel.innerHTML = '';
    COLOR_MODES.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = i18n[`color_mode_${m}`] || m;
      sel.appendChild(opt);
    });
    sel.value = mode;
  }
  document.querySelectorAll('#colorModeSwitch [data-mode]').forEach((seg) => {
    const lit = seg.dataset.mode === mode;
    seg.setAttribute('aria-checked', String(lit));
    seg.classList.toggle('is-lit', lit);
  });
  const radio = document.querySelector(`input[name="setup_mode"][value="${mode}"]`);
  if (radio) radio.checked = true;
}

/**
 * Switches the appearance mode. The theme stays; its light or dark face shows.
 * Anything else that shows the mode or the theme (the first-run cards) listens to app:themeChanged.
 */
export async function applyColorMode(mode) {
  if (!COLOR_MODES.includes(mode)) return;
  setAndSync(STORAGE_KEYS.COLOR_MODE, mode);
  refreshColorModeControls();
  await loadTheme(getStoredThemeSetting());
  window.dispatchEvent(new CustomEvent('app:themeChanged', { detail: { theme: getStoredThemeSetting(), mode } }));
}

/**
 * Applies and stores a theme, and keeps every theme select (header, settings) in step. The mode stays as it is.
 * Anything else that shows the theme (the first-run theme cards) listens to app:themeChanged.
 */
export async function applyThemeSetting(themeName) {
  if (!themeName) return;
  // A mode implied by a setting from before modes existed is stored first, so changing the theme cannot change it
  if (!localStorage.getItem(STORAGE_KEYS.COLOR_MODE)) setAndSync(STORAGE_KEYS.COLOR_MODE, getColorMode());
  THEME_SELECT_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = themeName;
  });
  await loadTheme(themeName);
  setAndSync(STORAGE_KEYS.LEGACY_THEME, themeName);
  setAndSync(STORAGE_KEYS.THEME, themeName);
  window.dispatchEvent(new CustomEvent('app:themeChanged', { detail: { theme: themeName, mode: getColorMode() } }));
}

/** Switches the UI language. Labels and selects follow through the app:languageChanged listener in initSettings. */
export async function applyLanguageSetting(lang) {
  await changeLanguage(lang);
  syncSettingsToBackend();
}

export function initSettings(updateEditorCb) {
  updateEditorOptionsCallback = updateEditorCb;

  // The custom text color used to be stored under the key "undefined" (CUSTOM_EDITOR_FG was missing): move it
  const legacyTextColor = localStorage.getItem('undefined');
  if (legacyTextColor !== null) {
    if (!localStorage.getItem(STORAGE_KEYS.CUSTOM_EDITOR_FG)) setAndSync(STORAGE_KEYS.CUSTOM_EDITOR_FG, legacyTextColor);
    localStorage.removeItem('undefined');
  }

  // Switches and segmented buttons wrap the selects first, so later `.value = ...` calls update them
  initChoiceControls();
  // The generated guide beside the settings follows the open tab
  initSettingsHelpPane();
  initSettingsAreaMap();

  // Autosave, AI assistants and the log panel: settings for features the window also has
  initWindowFeatureSettings();

  // Init Embedding Source Selector (idempotent – safe to call on every modal open)
  initEmbeddingSourceController();

  bindSaveLocationControls({
    pathEl: document.getElementById('settingsSaveLocationPath'),
    changeBtn: document.getElementById('btnSettingsChangeLocation'),
    resetBtn: document.getElementById('btnSettingsResetLocation'),
    nameInput: document.getElementById('settingsFolderName'),
    nameHintEl: document.getElementById('settingsFolderNameHint'),
    browserTextKey: 'setup_save_location_browser'
  });

  // Format new documents start in (Markdown or Text); documents already open keep theirs
  const documentFormatSelect = document.getElementById('modalDocumentFormatSelect');
  if (documentFormatSelect) {
    documentFormatSelect.value = getDefaultDocumentFormat();
    documentFormatSelect.addEventListener('change', () => setAndSync(STORAGE_KEYS.DOCUMENT_FORMAT, documentFormatSelect.value));
  }

  // Whether × asks before closing; unsaved tabs are asked about either way
  const confirmCloseSelect = document.getElementById('modalConfirmCloseSelect');
  if (confirmCloseSelect) {
    confirmCloseSelect.value = localStorage.getItem(STORAGE_KEYS.CONFIRM_BEFORE_CLOSE) === 'off' ? 'off' : DEFAULTS.CONFIRM_BEFORE_CLOSE;
    confirmCloseSelect.addEventListener('change', () => {
      // Turning the switch back on also brings back the clean-tab question that its checkbox turned off
      if (confirmCloseSelect.value === 'on') localStorage.removeItem(STORAGE_KEYS.CONFIRM_TAB_CLOSE);
      setAndSync(STORAGE_KEYS.CONFIRM_BEFORE_CLOSE, confirmCloseSelect.value);
    });
  }

  // Front UI Elements
  const fontFamilySelect = document.getElementById('fontFamilySelect');
  const fontSizeSelect = document.getElementById('fontSizeSelect');
  const btnLangToggle = document.getElementById('btnLangToggle');
  const themeSelect = document.getElementById('themeSelect');
  const numMinScore = document.getElementById('numMinScore');
  const selSearchLimit = document.getElementById('selSearchLimit');
  const chkShowFullMetadata = document.getElementById('chkShowFullMetadata');

  // Modal UI Elements
  const btnSettings = document.getElementById('btnSettings');
  const settingsModal = document.getElementById('settingsModal');
  const btnCloseSettingsModal = document.getElementById('btnCloseSettingsModal');
  const modalTabs = document.querySelectorAll('.settings-tab-btn');
  const modalTabContents = document.querySelectorAll('.settings-tab-content');

  const modalFontFamilySelect = document.getElementById('modalFontFamilySelect');
  const modalFontSizeSelect = document.getElementById('modalFontSizeSelect');
  const modalLineHeightSelect = document.getElementById('modalLineHeightSelect');
  const modalThemeSelect = document.getElementById('modalThemeSelect');
  const modalLangSelect = document.getElementById('modalLangSelect');

  const modalLineHighlightSelect = document.getElementById('modalLineHighlightSelect');
  const modalWordWrapSelect = document.getElementById('modalWordWrapSelect');
  const modalLineNumbersSelect = document.getElementById('modalLineNumbersSelect');
  const modalStickyScrollSelect = document.getElementById('modalStickyScrollSelect');
  const modalWhitespaceSelect = document.getElementById('modalWhitespaceSelect');

  const modalMinScoreInput = document.getElementById('modalMinScoreInput');
  const modalLimitSelect = document.getElementById('modalLimitSelect');
  const modalShowFullMetadataChk = document.getElementById('modalShowFullMetadataChk');
  const modalLinterSelect = document.getElementById('modalLinterSelect');
  const modalTruncationSelect = document.getElementById('modalTruncationSelect');
  const modalSuggestTriggerSelect = document.getElementById('modalSuggestTriggerSelect');



  populateThemeDropdown(themeSelect);
  populateThemeDropdown(modalThemeSelect);

  const initialTheme = getStoredThemeSetting();
  if (themeSelect) themeSelect.value = initialTheme;
  if (modalThemeSelect) modalThemeSelect.value = initialTheme;
  loadTheme(initialTheme);

  if (themeSelect) {
    themeSelect.addEventListener('change', async () => {
      await applyThemeSetting(themeSelect.value);
    });
  }
  if (modalThemeSelect) {
    modalThemeSelect.addEventListener('change', async () => {
      await applyThemeSetting(modalThemeSelect.value);
    });
  }
  refreshColorModeControls();
  document.getElementById('modalColorModeSelect')?.addEventListener('change', (e) => applyColorMode(e.target.value));
  document.querySelectorAll('#colorModeSwitch [data-mode]').forEach((seg) => seg.addEventListener('click', () => applyColorMode(seg.dataset.mode)));

  // Language toggle & 2-way sync. Any language change (header, settings, first-run setup) ends in app:languageChanged.
  const applyLanguage = (lang) => applyLanguageSetting(lang);
  window.addEventListener('app:languageChanged', (e) => {
    const lang = e.detail?.lang || currentLang;
    const langToggleLabel = document.getElementById('langToggleLabel');
    if (langToggleLabel) {
      langToggleLabel.textContent = lang.toUpperCase();
    } else if (btnLangToggle) {
      btnLangToggle.textContent = lang.toUpperCase();
    }
    if (modalLangSelect) modalLangSelect.value = lang;
    refreshColorModeControls();
    updateAutoSaveUI();
  });

  if (btnLangToggle) {
    const langToggleLabel = document.getElementById('langToggleLabel');
    if (langToggleLabel) {
      langToggleLabel.textContent = currentLang.toUpperCase();
    } else {
      btnLangToggle.textContent = currentLang.toUpperCase();
    }
    btnLangToggle.addEventListener('click', async () => {
      const nextLang = currentLang === 'en' ? 'ja' : 'en';
      await applyLanguage(nextLang);
    });
  }

  if (modalLangSelect) {
    modalLangSelect.value = currentLang;
    modalLangSelect.addEventListener('change', async () => {
      await applyLanguage(modalLangSelect.value);
    });
  }

  // Editor Options 2-way Sync & Apply
  function applyEditorSettings() {
    const defaultFont = DEFAULTS.FONT_FAMILY;
    const fontFamily = fontFamilySelect?.value || modalFontFamilySelect?.value || defaultFont;
    const fontSize = parseInt(fontSizeSelect?.value || modalFontSizeSelect?.value || String(DEFAULTS.FONT_SIZE), 10);
    const lineHeight = parseInt(modalLineHeightSelect?.value || String(DEFAULTS.LINE_HEIGHT), 10);
    const wordWrap = modalWordWrapSelect?.value || 'on';
    const lineNumbers = modalLineNumbersSelect?.value || 'on';
    const renderLineHighlight = modalLineHighlightSelect?.value || 'gutter';
    const stickyScroll = (modalStickyScrollSelect?.value || 'on') === 'on';
    const renderWhitespace = modalWhitespaceSelect?.value || 'none';
    const quickEditorToneSelect = document.getElementById('quickEditorToneSelect');
    const editorBgTone = quickEditorToneSelect?.value || modalEditorBgSelect?.value || 'default';

    const quickCustomColorGroup = document.getElementById('quickCustomColorGroup');
    const modalCustomColorSettings = document.getElementById('modalCustomColorSettings');
    const quickCustomBgPicker = document.getElementById('quickCustomBgPicker');
    const quickCustomFgPicker = document.getElementById('quickCustomFgPicker');
    const modalCustomBgPicker = document.getElementById('modalCustomBgPicker');
    const modalCustomFgPicker = document.getElementById('modalCustomFgPicker');

    const customBg = quickCustomBgPicker?.value || modalCustomBgPicker?.value || '#1e1e2e';
    const customFg = quickCustomFgPicker?.value || modalCustomFgPicker?.value || '#cdd6f4';

    // Show or hide custom color picker controls
    if (editorBgTone === 'custom') {
      if (quickCustomColorGroup) quickCustomColorGroup.style.display = 'inline-flex';
      if (modalCustomColorSettings) modalCustomColorSettings.style.display = 'flex';
    } else {
      if (quickCustomColorGroup) quickCustomColorGroup.style.display = 'none';
      if (modalCustomColorSettings) modalCustomColorSettings.style.display = 'none';
    }

    // Sync Front & Modal
    if (fontFamilySelect && modalFontFamilySelect) {
      fontFamilySelect.value = fontFamily;
      modalFontFamilySelect.value = fontFamily;
    }
    if (fontSizeSelect && modalFontSizeSelect) {
      fontSizeSelect.value = String(fontSize);
      modalFontSizeSelect.value = String(fontSize);
    }
    if (quickEditorToneSelect && modalEditorBgSelect) {
      quickEditorToneSelect.value = editorBgTone;
      modalEditorBgSelect.value = editorBgTone;
    }

    // Save preferences
    setAndSync(STORAGE_KEYS.FONT_FAMILY, fontFamily);
    setAndSync(STORAGE_KEYS.FONT_SIZE, String(fontSize));
    setAndSync(STORAGE_KEYS.LINE_HEIGHT, String(lineHeight));
    setAndSync(STORAGE_KEYS.WORD_WRAP, wordWrap);
    setAndSync(STORAGE_KEYS.LINE_NUMBERS, lineNumbers);
    setAndSync(STORAGE_KEYS.LINE_HIGHLIGHT, renderLineHighlight);
    setAndSync(STORAGE_KEYS.STICKY_SCROLL, String(stickyScroll));
    setAndSync(STORAGE_KEYS.RENDER_WHITESPACE, renderWhitespace);
    setAndSync(STORAGE_KEYS.EDITOR_BG_TONE, editorBgTone);
    setAndSync(STORAGE_KEYS.CUSTOM_EDITOR_BG, customBg);
    setAndSync(STORAGE_KEYS.CUSTOM_EDITOR_FG, customFg);

    applyEditorCanvasTone(editorBgTone, customBg, customFg);

    if (updateEditorOptionsCallback) {
      updateEditorOptionsCallback({
        fontFamily,
        fontSize,
        lineHeight,
        wordWrap,
        lineNumbers,
        renderLineHighlight,
        stickyScroll: { enabled: stickyScroll },
        renderWhitespace
      });
    }
  }

  // Restore saved editor settings
  const modalEditorBgSelect = document.getElementById('modalEditorBgSelect');
  const quickEditorToneSelect = document.getElementById('quickEditorToneSelect');
  const quickCustomBgPicker = document.getElementById('quickCustomBgPicker');
  const quickCustomFgPicker = document.getElementById('quickCustomFgPicker');
  const modalCustomBgPicker = document.getElementById('modalCustomBgPicker');
  const modalCustomFgPicker = document.getElementById('modalCustomFgPicker');

  const savedBgTone = localStorage.getItem(STORAGE_KEYS.EDITOR_BG_TONE);
  if (savedBgTone) {
    if (modalEditorBgSelect) modalEditorBgSelect.value = savedBgTone;
    if (quickEditorToneSelect) quickEditorToneSelect.value = savedBgTone;
  }

  const savedCustomBg = localStorage.getItem(STORAGE_KEYS.CUSTOM_EDITOR_BG) || '#1e1e2e';
  const savedCustomFg = localStorage.getItem(STORAGE_KEYS.CUSTOM_EDITOR_FG) || '#cdd6f4';
  if (quickCustomBgPicker) quickCustomBgPicker.value = savedCustomBg;
  if (modalCustomBgPicker) modalCustomBgPicker.value = savedCustomBg;
  if (quickCustomFgPicker) quickCustomFgPicker.value = savedCustomFg;
  if (modalCustomFgPicker) modalCustomFgPicker.value = savedCustomFg;

  const savedFont = localStorage.getItem(STORAGE_KEYS.FONT_FAMILY);
  if (savedFont) {
    if (fontFamilySelect) fontFamilySelect.value = savedFont;
    if (modalFontFamilySelect) modalFontFamilySelect.value = savedFont;
  }
  const savedSize = localStorage.getItem(STORAGE_KEYS.FONT_SIZE);
  if (savedSize) {
    if (fontSizeSelect) fontSizeSelect.value = savedSize;
    if (modalFontSizeSelect) modalFontSizeSelect.value = savedSize;
  }
  const savedLineHeight = localStorage.getItem(STORAGE_KEYS.LINE_HEIGHT);
  if (savedLineHeight && modalLineHeightSelect) modalLineHeightSelect.value = savedLineHeight;
  const savedWordWrap = localStorage.getItem(STORAGE_KEYS.WORD_WRAP);
  if (savedWordWrap && modalWordWrapSelect) modalWordWrapSelect.value = savedWordWrap;
  const savedLineNumbers = localStorage.getItem(STORAGE_KEYS.LINE_NUMBERS);
  if (savedLineNumbers && modalLineNumbersSelect) modalLineNumbersSelect.value = savedLineNumbers;
  const savedLineHighlight = localStorage.getItem(STORAGE_KEYS.LINE_HIGHLIGHT);
  if (savedLineHighlight && modalLineHighlightSelect) modalLineHighlightSelect.value = savedLineHighlight;
  const savedStickyScroll = localStorage.getItem(STORAGE_KEYS.STICKY_SCROLL);
  if (savedStickyScroll !== null && modalStickyScrollSelect) modalStickyScrollSelect.value = savedStickyScroll === 'true' ? 'on' : 'off';
  const savedWhitespace = localStorage.getItem(STORAGE_KEYS.RENDER_WHITESPACE);
  if (savedWhitespace && modalWhitespaceSelect) modalWhitespaceSelect.value = savedWhitespace;

  // Custom Color Pickers 2-Way Event Listeners
  [quickCustomBgPicker, modalCustomBgPicker].forEach(p => {
    if (p) p.addEventListener('input', (e) => {
      const val = e.target.value;
      if (quickCustomBgPicker) quickCustomBgPicker.value = val;
      if (modalCustomBgPicker) modalCustomBgPicker.value = val;
      applyEditorSettings();
    });
  });

  [quickCustomFgPicker, modalCustomFgPicker].forEach(p => {
    if (p) p.addEventListener('input', (e) => {
      const val = e.target.value;
      if (quickCustomFgPicker) quickCustomFgPicker.value = val;
      if (modalCustomFgPicker) modalCustomFgPicker.value = val;
      applyEditorSettings();
    });
  });

  // Event Listeners for Editor settings
  [fontFamilySelect, modalFontFamilySelect, fontSizeSelect, modalFontSizeSelect,
    modalLineHeightSelect, modalWordWrapSelect, modalLineNumbersSelect,
    modalLineHighlightSelect, modalStickyScrollSelect, modalWhitespaceSelect,
    modalEditorBgSelect, quickEditorToneSelect].forEach(el => {
      if (el) {
        el.addEventListener('change', handleEditorSettingChange);
        el.addEventListener('input', handleEditorSettingChange);
      }
    });

  function handleEditorSettingChange(e) {
    if (e.target === fontFamilySelect && modalFontFamilySelect) {
      modalFontFamilySelect.value = fontFamilySelect.value;
    } else if (e.target === modalFontFamilySelect && fontFamilySelect) {
      fontFamilySelect.value = modalFontFamilySelect.value;
    }
    if (e.target === fontSizeSelect && modalFontSizeSelect) {
      modalFontSizeSelect.value = fontSizeSelect.value;
    } else if (e.target === modalFontSizeSelect && fontSizeSelect) {
      fontSizeSelect.value = modalFontSizeSelect.value;
    }
    if (e.target === quickEditorToneSelect && modalEditorBgSelect) {
      modalEditorBgSelect.value = quickEditorToneSelect.value;
      const selectedOption = quickEditorToneSelect.options[quickEditorToneSelect.selectedIndex];
      if (selectedOption) showToast(`Editor ${selectedOption.text}`, 'info');
    } else if (e.target === modalEditorBgSelect && quickEditorToneSelect) {
      quickEditorToneSelect.value = modalEditorBgSelect.value;
    }
    applyEditorSettings();
  }

  [quickCustomBgPicker, quickCustomFgPicker, modalCustomBgPicker, modalCustomFgPicker].forEach(el => {
    if (el) el.addEventListener('input', () => applyEditorSettings());
  });

  // AI & Search Settings 2-Way Sync
  function syncSearchSettings(source) {
    if (source === 'front') {
      if (modalMinScoreInput && numMinScore) modalMinScoreInput.value = numMinScore.value;
      if (modalLimitSelect && selSearchLimit) modalLimitSelect.value = selSearchLimit.value;
      if (modalShowFullMetadataChk && chkShowFullMetadata) modalShowFullMetadataChk.checked = chkShowFullMetadata.checked;
    } else {
      if (numMinScore && modalMinScoreInput) numMinScore.value = modalMinScoreInput.value;
      if (selSearchLimit && modalLimitSelect) selSearchLimit.value = modalLimitSelect.value;
      if (chkShowFullMetadata && modalShowFullMetadataChk) {
        chkShowFullMetadata.checked = modalShowFullMetadataChk.checked;
        setAndSync('vect_show_full_metadata', String(chkShowFullMetadata.checked));
      }
    }
    // Both sides hold the same values now; keep them for the next start
    if (numMinScore) setAndSync(STORAGE_KEYS.MIN_SCORE_PCT, numMinScore.value);
    if (selSearchLimit) setAndSync(STORAGE_KEYS.SEARCH_LIMIT, selSearchLimit.value);
  }

  // Restore the score and limit on both the sidebar and the modal
  const savedMinScore = localStorage.getItem(STORAGE_KEYS.MIN_SCORE_PCT);
  const savedLimit = localStorage.getItem(STORAGE_KEYS.SEARCH_LIMIT);
  [numMinScore, modalMinScoreInput].forEach(el => { if (el && savedMinScore) el.value = savedMinScore; });
  [selSearchLimit, modalLimitSelect].forEach(el => { if (el && savedLimit) el.value = savedLimit; });

  if (modalTruncationSelect) {
    modalTruncationSelect.value = localStorage.getItem(STORAGE_KEYS.EMBEDDING_TRUNCATION) === 'off' ? 'off' : 'on';
    modalTruncationSelect.addEventListener('change', () => {
      setAndSync(STORAGE_KEYS.EMBEDDING_TRUNCATION, modalTruncationSelect.value);
      window.dispatchEvent(new CustomEvent('app:embeddingTruncationChanged'));
    });
  }

  if (modalLinterSelect) {
    modalLinterSelect.value = localStorage.getItem(STORAGE_KEYS.LINTER_ENABLED) === 'off' ? 'off' : 'on';
    modalLinterSelect.addEventListener('change', () => {
      setAndSync(STORAGE_KEYS.LINTER_ENABLED, modalLinterSelect.value);
      refreshLinter();
    });
  }

  if (numMinScore) numMinScore.addEventListener('input', () => syncSearchSettings('front'));
  if (modalMinScoreInput) modalMinScoreInput.addEventListener('input', () => syncSearchSettings('modal'));
  if (selSearchLimit) selSearchLimit.addEventListener('change', () => syncSearchSettings('front'));
  if (modalLimitSelect) modalLimitSelect.addEventListener('change', () => syncSearchSettings('modal'));
  if (chkShowFullMetadata) chkShowFullMetadata.addEventListener('change', () => syncSearchSettings('front'));
  if (modalShowFullMetadataChk) modalShowFullMetadataChk.addEventListener('change', () => syncSearchSettings('modal'));

  // Tab 3 AI Provider & Model Settings
  const modalAiProviderSelect = document.getElementById('modalAiProviderSelect');
  const localAiSettingsBlock = document.getElementById('localAiSettingsBlock');
  const claudeSettingsBlock = document.getElementById('claudeSettingsBlock');
  const modalClaudeKeyInput = document.getElementById('modalClaudeKeyInput');
  const modalClaudeModelSelect = document.getElementById('modalClaudeModelSelect');
  const btnInitLocalAi = document.getElementById('btnInitLocalAi');

  const geminiSettingsBlock = document.getElementById('geminiSettingsBlock');
  const modalGeminiKeyInput = document.getElementById('modalGeminiKeyInput');
  const modalGeminiModelSelect = document.getElementById('modalGeminiModelSelect');

  const openaiSettingsBlock = document.getElementById('openaiSettingsBlock');
  const modalOpenAiKeyInput = document.getElementById('modalOpenAiKeyInput');
  const modalOpenAiModelSelect = document.getElementById('modalOpenAiModelSelect');

  const modalAiScopeSelect = document.getElementById('modalAiScopeSelect');

  const storedAiProvider = localStorage.getItem(STORAGE_KEYS.LLM_PROVIDER) || DEFAULTS.LLM_PROVIDER;
  const storedClaudeModel = localStorage.getItem(STORAGE_KEYS.CLAUDE_MODEL) || DEFAULTS.CLAUDE_MODEL;
  const storedGeminiModel = localStorage.getItem(STORAGE_KEYS.GEMINI_MODEL) || DEFAULTS.GEMINI_MODEL;
  const storedOpenAiModel = localStorage.getItem(STORAGE_KEYS.OPENAI_MODEL) || DEFAULTS.OPENAI_MODEL;
  const storedAiScope = localStorage.getItem(STORAGE_KEYS.AI_INFERENCE_SCOPE) || DEFAULTS.AI_INFERENCE_SCOPE;

  // Key inputs stay empty: stored keys are encrypted in the main process and never sent back to the page.
  const KEY_SET_PLACEHOLDER = '•••••••••••••••••••• (API Key Configured)';
  const keyInputs = { gemini: modalGeminiKeyInput, openai: modalOpenAiKeyInput, claude: modalClaudeKeyInput };
  const showKeyState = () => {
    Object.entries(keyInputs).forEach(([provider, input]) => {
      if (!input) return;
      if (!input.dataset.defaultPlaceholder) input.dataset.defaultPlaceholder = input.placeholder || '';
      input.placeholder = isApiKeyConfigured(provider) ? KEY_SET_PLACEHOLDER : input.dataset.defaultPlaceholder;
    });
  };
  refreshApiKeyStatus().then(() => {
    showKeyState();
    window.dispatchEvent(new Event('app:settingsChanged'));
  });

  /** Encrypts and stores a key typed into the settings modal. */
  async function storeKeyFromInput(provider, input) {
    const keyVal = input.value.trim();
    if (!keyVal) return false;
    const result = await saveApiKey(provider, keyVal);
    if (!result.success) {
      input.setCustomValidity(result.error || 'Unable to save API key securely.');
      input.reportValidity();
      return false;
    }
    input.setCustomValidity('');
    input.value = '';
    showKeyState();
    window.dispatchEvent(new Event('app:settingsChanged'));
    return true;
  }

  if (modalAiScopeSelect) {
    modalAiScopeSelect.value = storedAiScope;
    modalAiScopeSelect.addEventListener('change', () => {
      setAndSync(STORAGE_KEYS.AI_INFERENCE_SCOPE, modalAiScopeSelect.value);
    });
  }

  if (modalAiProviderSelect) {
    modalAiProviderSelect.value = storedAiProvider;
    updateAiProviderVisibility(storedAiProvider);

    const providerCards = document.querySelectorAll('.provider-card');

    function updateActiveProviderCard(val) {
      providerCards.forEach(card => {
        const selected = card.dataset.provider === val;
        card.classList.toggle('active', selected);
        card.setAttribute('aria-pressed', String(selected));
      });
    }

    updateActiveProviderCard(storedAiProvider);

    providerCards.forEach(card => {
      card.addEventListener('click', () => {
        modalAiProviderSelect.value = card.dataset.provider;
        modalAiProviderSelect.dispatchEvent(new Event('change'));
      });
    });

    modalAiProviderSelect.addEventListener('change', () => {
      const val = modalAiProviderSelect.value;
      setAndSync(STORAGE_KEYS.LLM_PROVIDER, val);
      updateAiProviderVisibility(val);
      updateActiveProviderCard(val);
    });
  }

  function updateAiProviderVisibility(provider) {
    // When in LLM tab, toggle the appropriate provider config block
    if (geminiSettingsBlock) geminiSettingsBlock.style.display = provider === 'gemini' ? 'flex' : 'none';
    if (openaiSettingsBlock) openaiSettingsBlock.style.display = provider === 'openai' ? 'flex' : 'none';
    if (claudeSettingsBlock) claudeSettingsBlock.style.display = provider === 'claude' ? 'flex' : 'none';
  }

  const btnFetchGeminiModels = document.getElementById('btnFetchGeminiModels');
  const geminiModelsFetchStatus = document.getElementById('geminiModelsFetchStatus');

  async function fetchAndPopulateGeminiModels(explicitKey) {
    if (!modalGeminiModelSelect) return;
    const keyToUse = explicitKey || modalGeminiKeyInput?.value?.trim();

    if (geminiModelsFetchStatus) {
      geminiModelsFetchStatus.textContent = 'Google API Keys loading ...';
      geminiModelsFetchStatus.style.color = 'var(--accent-color, #38bdf8)';
    }

    try {
      const models = await window.engineAPI.listGeminiModels(keyToUse || undefined);
      if (Array.isArray(models) && models.length > 0) {
        modalGeminiModelSelect.innerHTML = '';
        const currentSavedModel = localStorage.getItem(STORAGE_KEYS.GEMINI_MODEL) || DEFAULTS.GEMINI_MODEL;
        let foundSaved = false;

        models.forEach((m) => {
          const opt = document.createElement('option');
          opt.value = m.name;
          const label = m.displayName ? `${m.name} (${m.displayName})` : m.name;
          opt.textContent = label;
          if (m.name === currentSavedModel) {
            opt.selected = true;
            foundSaved = true;
          }
          modalGeminiModelSelect.appendChild(opt);
        });

        if (!foundSaved && modalGeminiModelSelect.options.length > 0) {
          modalGeminiModelSelect.selectedIndex = 0;
          setAndSync(STORAGE_KEYS.GEMINI_MODEL, modalGeminiModelSelect.value);
          window.dispatchEvent(new Event('app:settingsChanged'));
        }

        // Cache for offline/quick load
        localStorage.setItem('cached_gemini_models', JSON.stringify(models));

        if (geminiModelsFetchStatus) {
          geminiModelsFetchStatus.textContent = `Google API Keys loaded ${models.length} items.`;
          geminiModelsFetchStatus.style.color = 'var(--success-color, #10b981)';
        }
      } else {
        throw new Error('Google API Keys Error...');
      }
    } catch (err) {
      console.warn('[Gemini] Model list fetch error:', err);
      if (geminiModelsFetchStatus) {
        geminiModelsFetchStatus.textContent = 'Google API Keys Error...';
        geminiModelsFetchStatus.style.color = '#ef4444';
      }
    }
  }

  // Restore cached models if available
  try {
    const cached = localStorage.getItem('cached_gemini_models');
    if (cached && modalGeminiModelSelect) {
      const models = JSON.parse(cached);
      if (Array.isArray(models) && models.length > 0) {
        modalGeminiModelSelect.innerHTML = '';
        const currentSavedModel = localStorage.getItem(STORAGE_KEYS.GEMINI_MODEL) || DEFAULTS.GEMINI_MODEL;
        models.forEach((m) => {
          const opt = document.createElement('option');
          opt.value = m.name;
          opt.textContent = m.displayName ? `${m.name} (${m.displayName})` : m.name;
          if (m.name === currentSavedModel) opt.selected = true;
          modalGeminiModelSelect.appendChild(opt);
        });
      }
    }
  } catch (_) { }

  if (modalGeminiKeyInput) {
    modalGeminiKeyInput.addEventListener('change', async () => {
      const keyVal = modalGeminiKeyInput.value.trim();
      // Automatically fetch official models from Google upon setting key
      if (await storeKeyFromInput('gemini', modalGeminiKeyInput)) fetchAndPopulateGeminiModels(keyVal);
    });
  }

  if (btnFetchGeminiModels) {
    btnFetchGeminiModels.addEventListener('click', () => {
      fetchAndPopulateGeminiModels();
    });
  }

  if (modalGeminiModelSelect) {
    modalGeminiModelSelect.value = storedGeminiModel;
    modalGeminiModelSelect.addEventListener('change', () => {
      setAndSync(STORAGE_KEYS.GEMINI_MODEL, modalGeminiModelSelect.value);
      window.dispatchEvent(new Event('app:settingsChanged'));
    });
  }

  // Saved on change (blur or Enter), not on every keystroke, so partial keys are never stored
  if (modalOpenAiKeyInput) {
    modalOpenAiKeyInput.addEventListener('change', () => storeKeyFromInput('openai', modalOpenAiKeyInput));
  }

  if (modalOpenAiModelSelect) {
    modalOpenAiModelSelect.value = storedOpenAiModel;
    modalOpenAiModelSelect.addEventListener('change', () => {
      setAndSync(STORAGE_KEYS.OPENAI_MODEL, modalOpenAiModelSelect.value);
      window.dispatchEvent(new Event('app:settingsChanged'));
    });
  }

  if (modalClaudeKeyInput) {
    modalClaudeKeyInput.addEventListener('change', () => storeKeyFromInput('claude', modalClaudeKeyInput));
  }

  if (modalClaudeModelSelect) {
    modalClaudeModelSelect.value = storedClaudeModel;
    // A stored id that is no longer offered (a retired model) falls back to the default and is saved again
    if (modalClaudeModelSelect.value !== storedClaudeModel) {
      modalClaudeModelSelect.value = DEFAULTS.CLAUDE_MODEL;
      setAndSync(STORAGE_KEYS.CLAUDE_MODEL, DEFAULTS.CLAUDE_MODEL);
    }
    modalClaudeModelSelect.addEventListener('change', () => {
      setAndSync(STORAGE_KEYS.CLAUDE_MODEL, modalClaudeModelSelect.value);
      window.dispatchEvent(new Event('app:settingsChanged'));
    });
  }

  // Setup Password Visibility Toggles
  function setupPasswordToggle(inputId, toggleBtnId) {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(toggleBtnId);
    if (!input || !btn) return;
    const icon = btn.querySelector('.material-symbols-outlined');

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      if (icon) {
        icon.textContent = isPassword ? 'visibility' : 'visibility_off';
      }
      btn.title = isPassword ? (t('hide_api_key') || 'Hide API Key') : (t('show_api_key') || 'Show API Key');
    });
  }

  setupPasswordToggle('modalGeminiKeyInput', 'btnToggleGeminiKeyVisibility');
  setupPasswordToggle('modalOpenAiKeyInput', 'btnToggleOpenAiKeyVisibility');
  setupPasswordToggle('modalClaudeKeyInput', 'btnToggleClaudeKeyVisibility');

  // Clear API Keys from Editor Settings Tab
  const btnEditorClearApiKey = document.getElementById('btnEditorClearApiKey');
  if (btnEditorClearApiKey) {
    btnEditorClearApiKey.addEventListener('click', async () => {
      const confirmed = await showConfirmModal({ title: t('api_clear_title'), message: t('api_clear_confirm'), type: 'warning', confirmText: t('api_keys_clear_btn') });
      if (!confirmed) return;

      // All keys live in the main process (encrypted files), so remove them there.
      const clearRes = await clearAllApiKeys();
      if (!clearRes.success) {
        showToast(`${t('api_clear_failed')}: ${clearRes.error || 'unknown error'}`, 'error');
        return;
      }
      if (modalGeminiKeyInput) modalGeminiKeyInput.value = '';
      if (modalOpenAiKeyInput) modalOpenAiKeyInput.value = '';
      if (modalClaudeKeyInput) modalClaudeKeyInput.value = '';
      showKeyState();
      // Recomputes modelConfigured, which turns the LLM master off when no key remains.
      window.dispatchEvent(new Event('app:settingsChanged'));
      showToast(t('api_clear_done'), 'success');
    });
  }

  // The model is already on disk (downloaded in an earlier run or in setup): no download button, say what to do next
  if (btnInitLocalAi && getDownloadedModelIds().has(getActiveModelId())) {
    btnInitLocalAi.style.display = 'none';
    const localAiStatusBadge = document.getElementById('localAiStatusBadge');
    if (localAiStatusBadge) localAiStatusBadge.textContent = t('local_ai_downloaded_standby');
  }

  if (btnInitLocalAi) {
    btnInitLocalAi.addEventListener('click', () => {
      const targetModel = localStorage.getItem(STORAGE_KEYS.LOCAL_EMBEDDING_MODEL) || DEFAULTS.LOCAL_EMBEDDING_MODEL;
      window.dispatchEvent(new CustomEvent('app:requestLocalAiInit', { detail: { model: targetModel } }));
    });
  }

  // Embedding model cards: Download (files only) / Use (switch active model) / Active
  const embeddingModelList = document.getElementById('embeddingModelList');
  const useEmbeddingModel = (modelId) => {
    setAndSync(STORAGE_KEYS.LOCAL_EMBEDDING_MODEL, modelId);
    showToast(`Selected ${modelId.split('/').pop()}. Initializing...`, 'info');
    window.dispatchEvent(new CustomEvent('app:requestLocalAiInit', { detail: { model: modelId } }));
    notifyEmbeddingModelsChanged();
  };
  if (embeddingModelList) {
    bindEmbeddingModelEvents(embeddingModelList, { onUse: useEmbeddingModel });
    renderEmbeddingModelList(embeddingModelList, { onUse: useEmbeddingModel });
  }

  const btnModalImportDict = document.getElementById('btnModalImportDict');
  if (btnModalImportDict) {
    btnModalImportDict.addEventListener('click', async () => {
      await importDictionary();
    });
  }

  // Embedding Subtab Switching (Local vs Cloud)
  const aiEmbSubtabBtns = document.querySelectorAll('.ai-model-subtab-btn');
  const subpanelEmbLocal = document.getElementById('subpanelEmbLocal');
  const subpanelEmbCloud = document.getElementById('subpanelEmbCloud');

  function switchEmbSubtab(targetSubtab) {
    aiEmbSubtabBtns.forEach(btn => {
      if (btn.dataset.embSubtab === targetSubtab) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (subpanelEmbLocal) {
      if (targetSubtab === 'local') subpanelEmbLocal.classList.add('active');
      else subpanelEmbLocal.classList.remove('active');
    }
    if (subpanelEmbCloud) {
      if (targetSubtab === 'cloud') subpanelEmbCloud.classList.add('active');
      else subpanelEmbCloud.classList.remove('active');
    }
  }

  aiEmbSubtabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchEmbSubtab(btn.dataset.embSubtab);
    });
  });

  // Shortcut from the Cloud Embedding subpanel to the LLM keys (Editor tab)
  const btnGoToLlmConfig = document.getElementById('btnGoToLlmConfig');
  if (btnGoToLlmConfig) {
    btnGoToLlmConfig.addEventListener('click', () => {
      openSettingsTab('tabEditor');
      document.getElementById('llmConfigCard')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }

  // Restore Search Settings
  const savedFullMeta = localStorage.getItem(STORAGE_KEYS.SHOW_FULL_METADATA) === 'true';
  if (chkShowFullMetadata) chkShowFullMetadata.checked = savedFullMeta;
  if (modalShowFullMetadataChk) modalShowFullMetadataChk.checked = savedFullMeta;

  const savedTriggerMode = localStorage.getItem(STORAGE_KEYS.SUGGEST_TRIGGER_MODE) || DEFAULTS.SUGGEST_TRIGGER_MODE;
  if (modalSuggestTriggerSelect) {
    modalSuggestTriggerSelect.value = savedTriggerMode;
    modalSuggestTriggerSelect.addEventListener('change', (e) => {
      setAndSync(STORAGE_KEYS.SUGGEST_TRIGGER_MODE, e.target.value);
    });
  }



  function openSettingsTab(tabId) {
    if (!settingsModal) return;
    settingsModal.style.display = 'flex';
    modalTabs.forEach(b => {
      if (b.getAttribute('data-tab') === tabId) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
    modalTabContents.forEach(c => {
      if (c.id === tabId) {
        c.classList.add('active');
        if (tabId === 'tabAiSearch') {
          notifyEmbeddingModelsChanged();
        }
      } else {
        c.classList.remove('active');
      }
    });
  }

  window.addEventListener('app:openSettings', (e) => {
    const tabId = e.detail?.tab || 'tabAppearance';
    openSettingsTab(tabId);
  });

  const btnBackToEditor = document.getElementById('btnBackToEditor');

  const closeSettingsView = () => {
    if (settingsModal) settingsModal.style.display = 'none';
  };

  // Modal / Full-Page View Open/Close & Tabs
  if (btnSettings && settingsModal) {
    btnSettings.addEventListener('click', () => {
      if (settingsModal.style.display === 'flex' || settingsModal.style.display === 'block') {
        closeSettingsView();
      } else {
        openSettingsTab('tabAppearance');
      }
    });
  }

  if (btnCloseSettingsModal) {
    btnCloseSettingsModal.addEventListener('click', async () => {
      if (await confirmClose('settings')) closeSettingsView();
    });
  }

  if (btnBackToEditor) {
    btnBackToEditor.addEventListener('click', closeSettingsView);
  }

  // Keyboard shortcut Esc to return to editor
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && settingsModal && (settingsModal.style.display === 'flex' || settingsModal.style.display === 'block')) {
      closeSettingsView();
    }
  });


  modalTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      modalTabs.forEach(b => b.classList.remove('active'));
      modalTabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.getAttribute('data-tab');
      const content = document.getElementById(target);
      if (content) content.classList.add('active');
    });
  });

  // Workspace Session (.vectorspace) Export & Import Handlers
  const btnExportWorkspace = document.getElementById('btnExportWorkspace');
  if (btnExportWorkspace) {
    btnExportWorkspace.addEventListener('click', async () => {
      await exportWorkspaceBundle();
    });
  }

  const btnImportWorkspace = document.getElementById('btnImportWorkspace');
  if (btnImportWorkspace) {
    btnImportWorkspace.addEventListener('click', async () => {
      if (window.engineAPI?.openFile) {
        const res = await window.engineAPI.openFile();
        if (res && res.success && res.content) {
          const importRes = await importWorkspaceBundle(res.content);
          if (importRes.success && settingsModal) {
            settingsModal.style.display = 'none';
          }
        }
      }
    });
  }

  const btnClearAppCache = document.getElementById('btnClearAppCache');
  if (btnClearAppCache) {
    btnClearAppCache.addEventListener('click', async () => {
      const confirmed = await showConfirmModal({
        title: t('maint_cache_label'),
        message: t('maint_cache_desc'),
        confirmText: t('maint_cache_btn'),
        cancelText: t('btn_cancel'),
        type: 'warning'
      });
      if (!confirmed) return;
      const result = await window.engineAPI.clearCache();
      window.alert(result.success ? t('maint_cache_done') : (result.error || t('maint_cache_failed')));
    });
  }

  // Both resets ask first and then call one shared function (ui/settings/resetApp.js)
  for (const [id, dev] of [['btnResetSettings', false], ['btnResetSettingsDev', true]]) {
    document.getElementById(id)?.addEventListener('click', async () => {
      const confirmed = await showConfirmModal({
        title: t(dev ? 'maint_reset_dev_label' : 'maint_reset_label'),
        message: t(dev ? 'maint_reset_dev_confirm' : 'maint_reset_confirm'),
        confirmText: t(dev ? 'maint_reset_dev_btn' : 'maint_reset_btn'),
        cancelText: t('btn_cancel'),
        type: 'warning'
      });
      if (confirmed) await resetApp({ dev });
    });
  }

  const btnReloadEditor = document.getElementById('btnReloadEditor');
  if (btnReloadEditor) {
    btnReloadEditor.addEventListener('click', async () => {
      const confirmed = await showConfirmModal({
        title: t('maint_reload_label'),
        message: t('maint_reload_confirm'),
        confirmText: t('maint_reload_btn'),
        cancelText: t('btn_cancel'),
        type: 'warning'
      });
      if (confirmed) window.location.reload();
    });
  }

  const btnRestartApplication = document.getElementById('btnRestartApplication');
  if (btnRestartApplication) {
    btnRestartApplication.addEventListener('click', async () => {
      const confirmed = await showConfirmModal({
        title: t('maint_restart_label'),
        message: t('maint_restart_confirm'),
        confirmText: t('maint_restart_btn'),
        cancelText: t('btn_cancel'),
        type: 'warning'
      });
      if (confirmed) window.engineAPI.restartApp();
    });
  }

  // Initial apply
  applyEditorSettings();
  setLedStatus('conf', true, `1. CONFIG: Settings Restored`);
}

export function getTheme() {
  const themeSelect = typeof document !== 'undefined' ? document.getElementById('themeSelect') : null;
  const storedThemeName = typeof localStorage !== 'undefined' ? getStoredThemeSetting() : null;
  const currentChoice = (themeSelect && themeSelect.value) || storedThemeName;
  return currentChoice ? getMonacoThemeId(currentChoice) : 'vs-dark';
}

export function getFontFamily() {
  const defaultFont = DEFAULTS.FONT_FAMILY;
  return document.getElementById('fontFamilySelect')?.value || localStorage.getItem(STORAGE_KEYS.FONT_FAMILY) || defaultFont;
}

export function getFontSize() {
  return parseInt(document.getElementById('fontSizeSelect')?.value || localStorage.getItem(STORAGE_KEYS.FONT_SIZE) || String(DEFAULTS.FONT_SIZE), 10);
}
