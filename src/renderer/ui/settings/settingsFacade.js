import { icons } from '../../core/icons.js';
import { readGeminiModel } from '../../core/geminiModel.js';
import { readStorage, removeStorage, writeStorage } from '../../core/storage.js';
import { changeLanguage, currentLang, i18n, t } from '../../core/i18n.js';
import { loadTheme, availableThemes, getMonacoThemeId, getStoredThemeSetting, COLOR_MODES, getColorMode, OVERLAY_COLORS, getOverlayColor } from '../../editor/core/themeLoader.js';
import { setLedStatus } from '../../core/statusManager.js';
import { STORAGE_KEYS, DEFAULTS } from '../../core/constants.js';
import { DOCUMENT_FORMATS } from '../../../shared/documentFormat';
import { NAME_TOKENS, composeName, sanitizeNameTokens } from '../../../shared/documentName';
import { EDITOR_DEFAULTS } from '../../editor/options/editorDefaults.js';
import { importDictionary } from '../../search/dictionary.js';
import { applyEditorCanvasTone, exportWorkspaceBundle, importWorkspaceBundle, hasUnsavedTabs, refreshLinter, updateAutoSaveUI } from '../../editor/editorManager.js';
import { syncSettingsToBackend } from './settingsState.js';
import { showToast } from '../notifications/toastManager.js';
import { notifyEmbeddingModelsChanged } from '../../search/searchLocalAi.js';
import { getActiveModelId, getDownloadedModelIds } from '../../search/embeddingModels.js';
import { bindEmbeddingModelEvents, renderEmbeddingModelList } from './embeddingModelList.js';
import { initEmbeddingSourceController } from './embeddingSourceController.js';
import settingsLayout from './settings-layout.json';
import { renderThemeCards, fitThemeCards } from '../components/themeCards.js';
import { pickCurrentCard } from './settingsNavCurrent.js';
import { fillToneSelect, renderToneCards } from './editorTonePicker.js';
import { renderFontCards } from './fontFamilyPicker.js';
import { renderLineHeightCards } from './lineHeightPicker.js';
import { createUserFontManager } from './userFontManager.js';
import { normalizeLineHeight } from './lineHeightOptions.js';
import { FONT_SIZE_MAX, FONT_SIZE_MIN, showFontSize } from './fontSizeOptions.js';
import { normalizeTone } from '../../editor/core/editorTonePairs.js';
import { clearApiKeyFor, isApiKeyConfigured, refreshApiKeyStatus, saveApiKey } from '../../core/apiKeyStore.js';
import { bindSaveLocationControls } from './saveLocation.js';
import { getDefaultDocumentFormat, getDefaultNameTokens } from '../../editor/tabs/tabState.js';
import { confirmClose } from '../notifications/closeGuard.js';
import { showConfirmModal } from '../notifications/confirmModal.js';
import { resetApp } from './resetApp.js';
import { initWindowFeatureSettings } from './windowFeatureSettings.js';
import { initChoiceControls } from './choiceControls.js';
import { initSettingsHelpPane } from './settingsHelpPane.js';
import { createGeminiModelPicker, usableGeminiModels, isValidGeminiModelId, rememberGeminiModels } from './geminiModelPicker.js';
import { initApiKeyInput } from './apiKeyInputBase.js';

function setAndSync(key, value) {
  writeStorage(key, value);
  syncSettingsToBackend();
}

let updateEditorOptionsCallback = null;

const FALLBACK_THEMES = ['GitHub', 'Cyberpink', 'Dracula', 'Monochrome', 'Monokai', 'Night Owl', 'Solarized', 'Tomorrow', 'Tukune'];
const THEME_SELECT_IDS = ['themeSelect'];

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
/** Shows the stored popup colour choice and sets the class that switches the overlay tokens (variables.css). */
export function refreshOverlayColorControl() {
  const value = getOverlayColor();
  document.querySelectorAll('#modalOverlayColorCards [data-overlay]').forEach((card) => {
    card.setAttribute('aria-pressed', String(card.dataset.overlay === value));
  });
  document.documentElement.classList.toggle('overlay-match-window', value === 'window');
}

/** One card per popup colour, each showing a small popup in that colour (the same tokens the real popups use). */
export function renderOverlayColorCards() {
  const box = document.getElementById('modalOverlayColorCards');
  if (!box) return;
  box.replaceChildren(...OVERLAY_COLORS.map((value) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `theme-card popup-color-card popup-color-card--${value}`;
    button.dataset.overlay = value;
    const sample = document.createElement('span');
    sample.className = 'theme-card-sample popup-color-sample';
    sample.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('span');
    copy.className = 'popup-color-item';
    copy.textContent = t('overlay_sample_copy');
    const paste = document.createElement('span');
    paste.className = 'popup-color-item is-hover';
    paste.textContent = t('overlay_sample_paste');
    sample.append(copy, paste);
    const name = document.createElement('span');
    name.className = 'theme-card-name';
    name.textContent = t(value === 'invert' ? 'overlay_color_invert' : 'overlay_color_window');
    button.append(sample, name);
    button.addEventListener('click', () => applyOverlayColor(value));
    return button;
  }));
  fitThemeCards(box);
  refreshOverlayColorControl();
}

export function applyOverlayColor(value) {
  if (!OVERLAY_COLORS.includes(value)) return;
  setAndSync(STORAGE_KEYS.OVERLAY_COLOR, value);
  refreshOverlayColorControl();
}

const KEY_TONES = ['inverse', 'accent'];

export function getKeyTone() {
  const stored = readStorage(STORAGE_KEYS.KEY_TONE);
  return KEY_TONES.includes(stored) ? stored : 'inverse';
}

export function applyKeyTone(tone) {
  if (!KEY_TONES.includes(tone)) return;
  setAndSync(STORAGE_KEYS.KEY_TONE, tone);
  document.documentElement.dataset.keyTone = tone;
}

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
  if (!readStorage(STORAGE_KEYS.COLOR_MODE)) setAndSync(STORAGE_KEYS.COLOR_MODE, getColorMode());
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
  const legacyTextColor = readStorage('undefined');
  if (legacyTextColor !== null) {
    // Best effort at startup: a failed move must not stop the rest of the settings from being wired up
    try {
      if (!readStorage(STORAGE_KEYS.CUSTOM_EDITOR_FG)) setAndSync(STORAGE_KEYS.CUSTOM_EDITOR_FG, legacyTextColor);
      removeStorage('undefined');
    } catch (err) {
      console.warn('[Settings] Could not move the legacy custom text color:', err);
    }
  }

  // Switches and segmented buttons wrap the selects first, so later `.value = ...` calls update them
  initChoiceControls();
  // The generated guide beside the settings follows the open tab
  initSettingsHelpPane();

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

  // Colour of the settings gear icons: inverse of the accent (default) or the accent itself
  const keyTonePicker = document.getElementById('modalKeyTonePicker');
  const paintKeyTonePicker = () => {
    const tone = getKeyTone();
    keyTonePicker?.querySelectorAll('.key-tone-option').forEach((button) => {
      const current = button.dataset.tone === tone;
      button.setAttribute('aria-checked', String(current));
      button.classList.toggle('is-selected', current);
    });
  };
  document.documentElement.dataset.keyTone = getKeyTone();
  paintKeyTonePicker();
  keyTonePicker?.querySelectorAll('.key-tone-option').forEach((button) => {
    button.addEventListener('click', () => {
      applyKeyTone(button.dataset.tone);
      paintKeyTonePicker();
    });
  });

  // Format new documents start in (Markdown or Text); documents already open keep theirs
  const documentFormatSelect = document.getElementById('modalDocumentFormatSelect');
  if (documentFormatSelect) {
    documentFormatSelect.value = getDefaultDocumentFormat();
    documentFormatSelect.addEventListener('change', () => setAndSync(STORAGE_KEYS.DOCUMENT_FORMAT, documentFormatSelect.value));
  }

  // Name new documents start with (Doc, Untitled or Memo, in the UI language); the number is added by the editor
  const documentNameSelect = document.getElementById('modalDocumentNameSelect');
  // The name's base, its parts (chosen and ordered) and the free text. The parts are drawn as the file name itself.
  const documentNameTokens = document.getElementById('documentNameTokens');
  const documentNameTextRow = document.getElementById('documentNameTextRow');
  const documentNameText = document.getElementById('documentNameText');

  const makeButton = (label, onClick) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ep-chip';
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  };

  // The file name a new document gets, as a row of pieces: each chosen part shows its value (with its name under it),
  // joined by "-" and followed by the extension. A piece is dragged onto another to move it there (or Left/Right on a
  // focused piece). The last piece has no remove button, so no control is ever dead. Parts not chosen are + buttons.
  const renderDocumentName = () => {
    if (!documentNameTokens || !documentNameSelect) return;
    const chosen = getDefaultNameTokens();
    const id = documentNameSelect.value || DEFAULTS.DOCUMENT_NAME;
    const format = documentFormatSelect?.value || getDefaultDocumentFormat();
    const parts = { name: t(`doc_name_${id}`), seq: 1, now: new Date(), text: documentNameText?.value ?? '' };
    const saveTokens = (next) => setAndSync(STORAGE_KEYS.DOCUMENT_NAME_TOKENS, JSON.stringify(sanitizeNameTokens(next)));
    const apply = (next) => () => { saveTokens(next); renderDocumentName(); };
    const heading = document.createElement('div');
    heading.className = 'setting-desc doc-name-parts__label';
    heading.textContent = t('name_parts_label');
    const file = document.createElement('div');
    file.className = 'doc-name-file';
    chosen.forEach((token, index) => {
      const name = t(`name_token_${token}`);
      const value = composeName([token], parts);
      if (index > 0) file.append(Object.assign(document.createElement('span'), { className: 'doc-name-file__sep', textContent: '-' }));
      const item = document.createElement('span');
      item.className = 'doc-name-part';
      const body = document.createElement('span');
      body.className = 'doc-name-part__body';
      body.append(
        Object.assign(document.createElement('span'), { className: `doc-name-part__value${value ? '' : ' is-empty'}`, textContent: value || '\u2026' }),
        Object.assign(document.createElement('span'), { className: 'doc-name-part__name', textContent: name })
      );
      item.append(body);
      const swap = (to) => { const next = [...chosen]; [next[index], next[to]] = [next[to], next[index]]; return next; };
      item.tabIndex = 0;
      item.setAttribute('aria-label', `${name} ${value}: ${t('name_part_keys')}`);
      item.addEventListener('keydown', (e) => {
        const to = e.key === 'ArrowLeft' ? index - 1 : e.key === 'ArrowRight' ? index + 1 : -1;
        if (to < 0 || to >= chosen.length) return;
        e.preventDefault();
        apply(swap(to))();
        documentNameTokens.querySelectorAll('.doc-name-part')[to]?.focus();
      });
      if (chosen.length > 1) {
        const btn = makeButton('\u00d7', apply(chosen.filter(x => x !== token)));
        btn.classList.add('doc-name-part__remove');
        btn.setAttribute('aria-label', `${name}: ${t('name_token_remove')}`);
        item.append(btn);
      }
      item.draggable = true;
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', String(index));
        e.dataTransfer.effectAllowed = 'move';
        item.classList.add('is-dragging');
      });
      item.addEventListener('dragend', () => item.classList.remove('is-dragging'));
      item.addEventListener('dragover', (e) => { e.preventDefault(); item.classList.add('is-drop-target'); });
      item.addEventListener('dragleave', (e) => { if (!item.contains(e.relatedTarget)) item.classList.remove('is-drop-target'); });
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('is-drop-target');
        const from = Number(e.dataTransfer.getData('text/plain'));
        if (!Number.isInteger(from) || from === index) return;
        const next = [...chosen];
        const [moved] = next.splice(from, 1);
        next.splice(index, 0, moved);
        apply(next)();
      });
      file.append(item);
    });
    file.append(Object.assign(document.createElement('span'), { className: 'doc-name-file__ext', textContent: DOCUMENT_FORMATS[format].extension }));
    const add = document.createElement('div');
    add.className = 'doc-name-parts';
    for (const token of NAME_TOKENS.filter(x => !chosen.includes(x))) {
      const btn = makeButton(`\uff0b ${t(`name_token_${token}`)}`, apply([...chosen, token]));
      btn.classList.add('doc-name-part-add');
      add.append(btn);
    }
    documentNameTokens.replaceChildren(heading, file, ...(add.childElementCount ? [add] : []));
    if (documentNameTextRow) documentNameTextRow.hidden = !chosen.includes('text');
  };

  if (documentNameSelect) {
    documentNameSelect.value = readStorage(STORAGE_KEYS.DOCUMENT_NAME) || DEFAULTS.DOCUMENT_NAME;
    if (documentNameText) {
      documentNameText.value = readStorage(STORAGE_KEYS.DOCUMENT_NAME_TEXT) || '';
      documentNameText.addEventListener('input', () => {
        setAndSync(STORAGE_KEYS.DOCUMENT_NAME_TEXT, documentNameText.value);
        renderDocumentName();
      });
    }
    documentNameSelect.addEventListener('change', () => {
      setAndSync(STORAGE_KEYS.DOCUMENT_NAME, documentNameSelect.value);
      renderDocumentName();
    });
    documentFormatSelect?.addEventListener('change', renderDocumentName);
    window.addEventListener('app:languageChanged', renderDocumentName);
    renderDocumentName();
  }

  // Whether × asks before closing; unsaved tabs are asked about either way
  const confirmCloseSelect = document.getElementById('modalConfirmCloseSelect');
  if (confirmCloseSelect) {
    confirmCloseSelect.value = readStorage(STORAGE_KEYS.CONFIRM_BEFORE_CLOSE) === 'off' ? 'off' : DEFAULTS.CONFIRM_BEFORE_CLOSE;
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
  const modalTabs = document.querySelectorAll('.settings-tab-btn');
  const modalTabContents = document.querySelectorAll('.settings-tab-content');
  const settingsTabDesc = document.getElementById('settingsTabDesc');
  const TAB_DESC_KEYS = {
    tabAppearance: 'tab_desc_appearance',
    tabEditor: 'tab_desc_editor',
    tabAiSearch: 'tab_desc_sidebar',
    tabSystem: 'tab_desc_system'
  };

  const modalFontFamilySelect = document.getElementById('modalFontFamilySelect');
  const modalFontSizeSelect = document.getElementById('modalFontSizeSelect');
  const modalFontSizeInput = document.getElementById('modalFontSizeInput');
  const sizeControls = { toolbarSelect: fontSizeSelect, modalSelect: modalFontSizeSelect, input: modalFontSizeInput };
  if (modalFontSizeInput) {
    modalFontSizeInput.min = String(FONT_SIZE_MIN);
    modalFontSizeInput.max = String(FONT_SIZE_MAX);
    modalFontSizeInput.addEventListener('change', handleEditorSettingChange);
  }
  const modalLineHeightSelect = document.getElementById('modalLineHeightSelect');
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
  const modalResultDescLinesSelect = document.getElementById('modalResultDescLinesSelect');
  const modalResultTitleLinesSelect = document.getElementById('modalResultTitleLinesSelect');
  const modalSuggestTriggerSelect = document.getElementById('modalSuggestTriggerSelect');



  populateThemeDropdown(themeSelect);

  const initialTheme = getStoredThemeSetting();
  if (themeSelect) themeSelect.value = initialTheme;
  loadTheme(initialTheme);

  if (themeSelect) {
    themeSelect.addEventListener('change', async () => {
      await applyThemeSetting(themeSelect.value);
    });
  }

  // Settings theme: the same sample cards as the first-run setup. The custom card uses the editor background
  // control, so both places run one code path for the custom colours.
  const modalThemeCards = document.getElementById('modalThemeCards');
  if (modalThemeCards) {
    const setEditorTone = (tone) => {
      const el = document.getElementById('modalEditorBgSelect');
      if (!el || el.value === tone) return;
      el.value = tone;
      el.dispatchEvent(new Event('change'));
    };
    const cards = renderThemeCards(modalThemeCards, {
      themes: getThemeList(),
      current: getStoredThemeSetting,
      isCustomOn: () => readStorage(STORAGE_KEYS.EDITOR_BG_TONE) === 'custom',
      customSample: () => {
        const bg = readStorage(STORAGE_KEYS.CUSTOM_EDITOR_BG) || '#1e1e2e';
        const fg = readStorage(STORAGE_KEYS.CUSTOM_EDITOR_FG) || '#cdd6f4';
        return { background: bg, lineNumber: fg, keyword: fg, foreground: fg, string: fg };
      },
      onPickTheme: async (name) => {
        setEditorTone('default');
        await applyThemeSetting(name);
        cards.refresh();
      },
      onPickCustom: () => {
        setEditorTone('custom');
        cards.refresh();
      },
    });
    window.addEventListener('app:themeChanged', cards.refresh);
  }
  refreshColorModeControls();
  document.getElementById('modalColorModeSelect')?.addEventListener('change', (e) => applyColorMode(e.target.value));
  document.querySelectorAll('#colorModeSwitch [data-mode]').forEach((seg) => seg.addEventListener('click', () => applyColorMode(seg.dataset.mode)));
  refreshOverlayColorControl();
  renderOverlayColorCards();
  window.addEventListener('app:languageChanged', renderOverlayColorCards);

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
    const lineHeight = normalizeLineHeight(modalLineHeightSelect?.value) ?? DEFAULTS.LINE_HEIGHT;
    const wordWrap = modalWordWrapSelect?.value || 'on';
    const lineNumbers = modalLineNumbersSelect?.value || 'on';
    const renderLineHighlight = modalLineHighlightSelect?.value || EDITOR_DEFAULTS.renderLineHighlight;
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
    showFontSize(fontSize, sizeControls);
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

  // The choices of both lists come from editorTonePairs.js; they must exist before a saved value is put back
  fillToneSelect(modalEditorBgSelect, 'opt_bg_default');
  fillToneSelect(quickEditorToneSelect);
  const savedBgTone = normalizeTone(readStorage(STORAGE_KEYS.EDITOR_BG_TONE));
  if (savedBgTone) {
    if (modalEditorBgSelect) modalEditorBgSelect.value = savedBgTone;
    if (quickEditorToneSelect) quickEditorToneSelect.value = savedBgTone;
  }
  let lastTone = modalEditorBgSelect?.value || 'default';
  const toneStatusEl = document.getElementById('editorToneStatus');
  const toneCardsEl = document.getElementById('modalToneCards');
  const toneCards = toneCardsEl
    ? renderToneCards(toneCardsEl, {
      getTone: () => modalEditorBgSelect?.value,
      statusEl: toneStatusEl,
      onPick: (tone) => {
        if (!modalEditorBgSelect || modalEditorBgSelect.value === tone) return;
        modalEditorBgSelect.value = tone;
        modalEditorBgSelect.dispatchEvent(new Event('change'));
      }
    })
    : null;
  const syncToneTitle = () => {
    if (quickEditorToneSelect && toneStatusEl) quickEditorToneSelect.title = toneStatusEl.textContent;
  };
  syncToneTitle();
  window.addEventListener('app:languageChanged', () => {
    fillToneSelect(modalEditorBgSelect, 'opt_bg_default');
    fillToneSelect(quickEditorToneSelect);
    toneCards?.rebuild();
    syncToneTitle();
  });
  // The first card shows the theme's own editor colours, so it follows a theme change
  window.addEventListener('app:themeApplied', () => toneCards?.rebuild());

  const savedCustomBg = readStorage(STORAGE_KEYS.CUSTOM_EDITOR_BG) || '#1e1e2e';
  const savedCustomFg = readStorage(STORAGE_KEYS.CUSTOM_EDITOR_FG) || '#cdd6f4';
  if (quickCustomBgPicker) quickCustomBgPicker.value = savedCustomBg;
  if (modalCustomBgPicker) modalCustomBgPicker.value = savedCustomBg;
  if (quickCustomFgPicker) quickCustomFgPicker.value = savedCustomFg;
  if (modalCustomFgPicker) modalCustomFgPicker.value = savedCustomFg;

  const savedFont = readStorage(STORAGE_KEYS.FONT_FAMILY);
  if (savedFont) {
    if (fontFamilySelect) fontFamilySelect.value = savedFont;
    if (modalFontFamilySelect) modalFontFamilySelect.value = savedFont;
  }
  const fontCardsEl = document.getElementById('modalFontCards');
  let userFontManager = null;
  const fontCards = fontCardsEl && modalFontFamilySelect
    ? renderFontCards(fontCardsEl, modalFontFamilySelect, { onRemove: (file) => userFontManager?.remove(file) })
    : null;
  // Fonts added from the PC: load them, list them as options, then redraw the cards and let the editor take the font
  userFontManager = createUserFontManager({
    selects: [fontFamilySelect, modalFontFamilySelect],
    onChange: () => {
      fontCards?.rebuild();
      applyEditorSettings();
    }
  });
  userFontManager.reload();
  document.getElementById('btnAddFonts')?.addEventListener('click', () => userFontManager.add());
  // The toolbar select changes the settings select by code (no event), so refresh after both selects have been synced
  [fontFamilySelect, modalFontFamilySelect].forEach((el) => {
    el?.addEventListener('change', () => queueMicrotask(() => fontCards?.refresh()));
  });
  window.addEventListener('app:languageChanged', () => fontCards?.rebuild());
  const savedSize = readStorage(STORAGE_KEYS.FONT_SIZE);
  showFontSize(savedSize || DEFAULTS.FONT_SIZE, sizeControls);
  const savedLineHeight = readStorage(STORAGE_KEYS.LINE_HEIGHT);
  const restoredLineHeight = normalizeLineHeight(savedLineHeight);
  if (restoredLineHeight && modalLineHeightSelect) modalLineHeightSelect.value = String(restoredLineHeight);
  const lineHeightCardsEl = document.getElementById('modalLineHeightCards');
  const lineHeightCards = lineHeightCardsEl && modalLineHeightSelect ? renderLineHeightCards(lineHeightCardsEl, modalLineHeightSelect) : null;
  modalLineHeightSelect?.addEventListener('change', () => lineHeightCards?.refresh());
  window.addEventListener('app:languageChanged', () => lineHeightCards?.rebuild());
  const savedWordWrap = readStorage(STORAGE_KEYS.WORD_WRAP);
  if (savedWordWrap && modalWordWrapSelect) modalWordWrapSelect.value = savedWordWrap;
  const savedLineNumbers = readStorage(STORAGE_KEYS.LINE_NUMBERS);
  if (savedLineNumbers && modalLineNumbersSelect) modalLineNumbersSelect.value = savedLineNumbers;
  const savedLineHighlight = readStorage(STORAGE_KEYS.LINE_HIGHLIGHT);
  if (savedLineHighlight && modalLineHighlightSelect) modalLineHighlightSelect.value = savedLineHighlight;
  const savedStickyScroll = readStorage(STORAGE_KEYS.STICKY_SCROLL);
  if (savedStickyScroll !== null && modalStickyScrollSelect) modalStickyScrollSelect.value = savedStickyScroll === 'true' ? 'on' : 'off';
  const savedWhitespace = readStorage(STORAGE_KEYS.RENDER_WHITESPACE);
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
    // The size can come from the toolbar, a preset segment or the number input; show it in all three
    const sizeSource = [fontSizeSelect, modalFontSizeSelect, modalFontSizeInput].find((el) => el === e.target);
    if (sizeSource && sizeSource.value !== '') showFontSize(sizeSource.value, sizeControls);
    if (e.target === quickEditorToneSelect && modalEditorBgSelect) {
      modalEditorBgSelect.value = quickEditorToneSelect.value;
    } else if (e.target === modalEditorBgSelect && quickEditorToneSelect) {
      quickEditorToneSelect.value = modalEditorBgSelect.value;
    }
    // A chosen colour pair overrides the theme: say so once, when it takes over from "Match theme"; otherwise name the new tone
    const tone = modalEditorBgSelect?.value;
    if (tone && tone !== lastTone) {
      if (lastTone === 'default') showToast(t('toast_editor_override'), 'info');
      else if (e.target === quickEditorToneSelect) {
        const selectedOption = quickEditorToneSelect.options[quickEditorToneSelect.selectedIndex];
        if (selectedOption) showToast(t('toast_editor_tone', { tone: selectedOption.text }), 'info');
      }
      lastTone = tone;
    }
    applyEditorSettings();
    toneCards?.refresh();
    syncToneTitle();
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
  const savedMinScore = readStorage(STORAGE_KEYS.MIN_SCORE_PCT);
  const savedLimit = readStorage(STORAGE_KEYS.SEARCH_LIMIT);
  [numMinScore, modalMinScoreInput].forEach(el => { if (el && savedMinScore) el.value = savedMinScore; });
  [selSearchLimit, modalLimitSelect].forEach(el => { if (el && savedLimit) el.value = savedLimit; });

  if (modalTruncationSelect) {
    modalTruncationSelect.value = readStorage(STORAGE_KEYS.EMBEDDING_TRUNCATION) === 'off' ? 'off' : 'on';
    modalTruncationSelect.addEventListener('change', () => {
      setAndSync(STORAGE_KEYS.EMBEDDING_TRUNCATION, modalTruncationSelect.value);
      window.dispatchEvent(new CustomEvent('app:embeddingTruncationChanged'));
    });
  }

  if (modalResultDescLinesSelect) {
    modalResultDescLinesSelect.value = readStorage(STORAGE_KEYS.RESULT_DESC_LINES) === '1' ? '1' : '2';
    modalResultDescLinesSelect.addEventListener('change', () => {
      setAndSync(STORAGE_KEYS.RESULT_DESC_LINES, modalResultDescLinesSelect.value);
      window.dispatchEvent(new CustomEvent('app:resultDescLinesChanged'));
    });
  }

  if (modalResultTitleLinesSelect) {
    const savedTitleLines = readStorage(STORAGE_KEYS.RESULT_TITLE_LINES);
    modalResultTitleLinesSelect.value = ['1', '3', 'full'].includes(savedTitleLines) ? savedTitleLines : '2';
    modalResultTitleLinesSelect.addEventListener('change', () => {
      setAndSync(STORAGE_KEYS.RESULT_TITLE_LINES, modalResultTitleLinesSelect.value);
      window.dispatchEvent(new CustomEvent('app:resultTitleLinesChanged'));
    });
  }

  if (modalLinterSelect) {
    modalLinterSelect.value = readStorage(STORAGE_KEYS.LINTER_ENABLED) === 'off' ? 'off' : 'on';
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
  const modalGeminiModelList = document.getElementById('modalGeminiModelList');

  const openaiSettingsBlock = document.getElementById('openaiSettingsBlock');
  const modalOpenAiKeyInput = document.getElementById('modalOpenAiKeyInput');
  const modalOpenAiModelSelect = document.getElementById('modalOpenAiModelSelect');

  const storedAiProvider = readStorage(STORAGE_KEYS.LLM_PROVIDER) || DEFAULTS.LLM_PROVIDER;
  const storedClaudeModel = readStorage(STORAGE_KEYS.CLAUDE_MODEL) || DEFAULTS.CLAUDE_MODEL;
  const storedGeminiModel = readGeminiModel();
  const storedOpenAiModel = readStorage(STORAGE_KEYS.OPENAI_MODEL) || DEFAULTS.OPENAI_MODEL;

  // Key inputs stay empty: stored keys are encrypted in the main process and never sent back to the page.
  const KEY_SET_PLACEHOLDER = '•••••••••••••••••••• (API Key Configured)';
  const keyInputs = { gemini: modalGeminiKeyInput, openai: modalOpenAiKeyInput, claude: modalClaudeKeyInput };
  const showKeyState = () => {
    Object.entries(keyInputs).forEach(([provider, input]) => {
      if (!input) return;
      if (!input.dataset.defaultPlaceholder) input.dataset.defaultPlaceholder = input.placeholder || '';
      input.placeholder = isApiKeyConfigured(provider) ? KEY_SET_PLACEHOLDER : input.dataset.defaultPlaceholder;
      // The delete button works only while a key is saved; when it does not, the reason is written beside it
      const clearBtn = document.querySelector(`[data-key-clear="${provider}"]`);
      const reason = document.querySelector(`[data-key-clear-reason="${provider}"]`);
      if (clearBtn) clearBtn.disabled = !isApiKeyConfigured(provider);
      if (reason) reason.textContent = isApiKeyConfigured(provider) ? '' : t('key_clear_none');
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
      showToast(result.error || 'Unable to save API key securely.', 'warning');
      return false;
    }
    input.setCustomValidity('');
    input.value = '';
    if (result.notice) showToast(result.notice, 'warning');
    showKeyState();
    window.dispatchEvent(new Event('app:settingsChanged'));
    return true;
  }

  if (modalAiProviderSelect) {
    modalAiProviderSelect.value = storedAiProvider;
    updateAiProviderVisibility(storedAiProvider);

    modalAiProviderSelect.addEventListener('change', () => {
      const val = modalAiProviderSelect.value;
      setAndSync(STORAGE_KEYS.LLM_PROVIDER, val);
      updateAiProviderVisibility(val);
      // choiceControls.js handles .active class and button rendering
    });
    document.getElementById('btnClearAiProvider')?.addEventListener('click', () => {
      modalAiProviderSelect.value = 'none';
      modalAiProviderSelect.dispatchEvent(new Event('change'));
    });
  }

  function updateAiProviderVisibility(provider) {
    // When in LLM tab, toggle the appropriate provider config block
    if (geminiSettingsBlock) geminiSettingsBlock.style.display = provider === 'gemini' ? 'flex' : 'none';
    if (openaiSettingsBlock) openaiSettingsBlock.style.display = provider === 'openai' ? 'flex' : 'none';
    if (claudeSettingsBlock) claudeSettingsBlock.style.display = provider === 'claude' ? 'flex' : 'none';
    // With no service chosen, say so in text and hide the button that clears the choice
    const chosen = ['gemini', 'openai', 'claude'].includes(provider);
    const hint = document.getElementById('aiProviderHint');
    const clearBtn = document.getElementById('btnClearAiProvider');
    if (hint) hint.hidden = chosen;
    if (clearBtn) clearBtn.hidden = !chosen;
  }

  const btnFetchGeminiModels = document.getElementById('btnFetchGeminiModels');
  const geminiModelsFetchStatus = document.getElementById('geminiModelsFetchStatus');

  // The picker shows only models that can generate content; the full list stays in the cache.
  const geminiModelPicker = modalGeminiModelList ? createGeminiModelPicker(modalGeminiModelList, {
    onChange: (name) => {
      setAndSync(STORAGE_KEYS.GEMINI_MODEL, name);
      window.dispatchEvent(new Event('app:settingsChanged'));
    }
  }) : null;

  /**
   * Draws the usable models and marks the model the user chose. Nothing is chosen for the user: with no choice no row is in use.
   * A fresh list (persist) that no longer has the chosen model clears the choice, so the user chooses again.
   */
  function showGeminiModels(models, { persist }) {
    if (!geminiModelPicker) return 0;
    const usable = usableGeminiModels(models);
    const saved = readGeminiModel();
    geminiModelPicker.setModels(models);
    if (usable.some((m) => m.name === saved)) {
      geminiModelPicker.setValue(saved);
    } else if (persist && saved && usable.length > 0) {
      setAndSync(STORAGE_KEYS.GEMINI_MODEL, '');
      window.dispatchEvent(new Event('app:settingsChanged'));
    }
    return usable.length;
  }

  async function fetchAndPopulateGeminiModels(explicitKey) {
    if (!geminiModelPicker) return;
    const keyToUse = explicitKey || modalGeminiKeyInput?.value?.trim();

    if (geminiModelsFetchStatus) {
      geminiModelsFetchStatus.textContent = t('gemini_keys_loading');
      geminiModelsFetchStatus.style.color = 'var(--accent-color, #38bdf8)';
    }

    try {
      const models = await window.engineAPI.listGeminiModels(keyToUse || undefined);
      if (Array.isArray(models) && models.length > 0) {
        // Draw first, then cache the full list; a blocked storage must not leave the picker empty
        const visible = showGeminiModels(models, { persist: true });
        rememberGeminiModels(models);

        if (geminiModelsFetchStatus) {
          geminiModelsFetchStatus.textContent = t(readGeminiModel() ? 'gemini_keys_loaded' : 'gemini_keys_loaded_choose', { count: visible });
          geminiModelsFetchStatus.style.color = 'var(--success-color, #10b981)';
        }
      } else {
        throw new Error('Google API Keys Error...');
      }
    } catch (err) {
      console.warn('[Gemini] Model list fetch error:', err);
      if (geminiModelsFetchStatus) {
        geminiModelsFetchStatus.textContent = t('gemini_keys_error');
        geminiModelsFetchStatus.style.color = '#ef4444';
      }
    }
  }

  // Until a list is fetched, show the saved model; then the cached list if there is one
  if (isValidGeminiModelId(storedGeminiModel)) {
    geminiModelPicker?.setModels([{ name: storedGeminiModel, canGenerate: true }]);
    geminiModelPicker?.setValue(storedGeminiModel);
  }
  try {
    const cached = readStorage('cached_gemini_models');
    if (cached && geminiModelPicker) {
      const models = JSON.parse(cached);
      if (Array.isArray(models) && models.length > 0) showGeminiModels(models, { persist: false });
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

    // Pressing the eye must only show or hide the text. A key field saves when it loses focus (its change event),
    // so keep the focus in the field while the eye is pressed with the mouse.
    btn.addEventListener('mousedown', (e) => e.preventDefault());
    // A toggle: the name is fixed, and aria-pressed says whether the key is shown
    btn.setAttribute('aria-label', t('show_api_key'));
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.setAttribute('aria-pressed', String(isPassword));
      if (icon) {
        icon.textContent = isPassword ? 'visibility' : 'visibility_off';
      }
      btn.title = isPassword ? (t('hide_api_key')) : (t('show_api_key'));
    });
  }

  // Initialize API key inputs using shared component
  initApiKeyInput('.api-key-field', 'modalGeminiKeyInput', 'btnToggleGeminiKeyVisibility');
  initApiKeyInput('.api-key-field', 'modalOpenAiKeyInput', 'btnToggleOpenAiKeyVisibility');
  initApiKeyInput('.api-key-field', 'modalClaudeKeyInput', 'btnToggleClaudeKeyVisibility');

  // Delete the stored key of one service, from the button under its key field
  document.querySelectorAll('[data-key-clear]').forEach((button) => {
    const provider = button.dataset.keyClear;
    button.addEventListener('click', async () => {
      const service = modalAiProviderSelect?.querySelector(`option[value="${provider}"]`)?.textContent.trim() || provider;
      const confirmed = await showConfirmModal({
        title: t('api_clear_title', { service }),
        message: t('api_clear_confirm', { service }),
        type: 'warning',
        confirmText: t('btn_key_clear_one')
      });
      if (!confirmed) return;

      // The key lives in the main process (an encrypted file), so it is removed there
      const clearRes = await clearApiKeyFor(provider);
      if (!clearRes.success) {
        showToast(`${t('api_clear_failed')}: ${clearRes.error || 'unknown error'}`, 'error');
        return;
      }
      if (keyInputs[provider]) keyInputs[provider].value = '';
      const resultEl = document.querySelector(`[data-key-check-result="${provider}"]`);
      if (resultEl) resultEl.textContent = '';
      showKeyState();
      // Recomputes modelConfigured, which turns the LLM master off when no key remains.
      window.dispatchEvent(new Event('app:settingsChanged'));
      showToast(t('api_clear_done', { service }), 'success');
    });
  });

  // The model is already on disk (downloaded in an earlier run or in setup): no download button, say what to do next
  if (btnInitLocalAi && getDownloadedModelIds().has(getActiveModelId())) {
    btnInitLocalAi.style.display = 'none';
    const localAiStatusBadge = document.getElementById('localAiStatusBadge');
    if (localAiStatusBadge) localAiStatusBadge.textContent = t('local_ai_downloaded_standby');
  }

  if (btnInitLocalAi) {
    btnInitLocalAi.addEventListener('click', () => {
      const targetModel = readStorage(STORAGE_KEYS.LOCAL_EMBEDDING_MODEL) || DEFAULTS.LOCAL_EMBEDDING_MODEL;
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
  const savedFullMeta = readStorage(STORAGE_KEYS.SHOW_FULL_METADATA) === 'true';
  if (chkShowFullMetadata) chkShowFullMetadata.checked = savedFullMeta;
  if (modalShowFullMetadataChk) modalShowFullMetadataChk.checked = savedFullMeta;

  const savedTriggerMode = readStorage(STORAGE_KEYS.SUGGEST_TRIGGER_MODE) || DEFAULTS.SUGGEST_TRIGGER_MODE;
  if (modalSuggestTriggerSelect) {
    modalSuggestTriggerSelect.value = savedTriggerMode;
    modalSuggestTriggerSelect.addEventListener('change', (e) => {
      setAndSync(STORAGE_KEYS.SUGGEST_TRIGGER_MODE, e.target.value);
    });
  }



  // Left nav under the tabs: one entry per visible card of the active tab, so the whole tab is seen at once
  // and a click scrolls the body to that card.
  let navCards = [];
  let navButtons = [];
  let navRows = []; // { row, button } for each setting listed under a card, in document order
  let navScrollBound = false;
  let navSpyPausedUntil = 0; // the current-item check waits while a nav click scrolls smoothly
  let navFrame = 0;

  function setNavCurrent(index) {
    navButtons.forEach((button, i) => {
      const current = i === index;
      button.classList.toggle('is-current', current);
      if (current) button.setAttribute('aria-current', 'location');
      else button.removeAttribute('aria-current');
    });
  }

  // The setting row at the top of the body is lit in the left nav, so the nav shows the exact place (not only the card)
  function setNavRowCurrent(index) {
    navRows.forEach(({ button }, i) => {
      const current = i === index;
      button.classList.toggle('is-current', current);
      if (current) button.setAttribute('aria-current', 'location');
      else button.removeAttribute('aria-current');
    });
  }

  function updateNavCurrent() {
    const body = settingsModal?.querySelector('.settings-modal-body');
    if (!body || !navCards.length || Date.now() < navSpyPausedUntil) return;
    const bodyTop = body.getBoundingClientRect().top;
    const tops = navCards.map(card => card.getBoundingClientRect().top - bodyTop);
    const atBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 2;
    setNavCurrent(pickCurrentCard(tops, 24, atBottom));
    // A row that is not shown (for example the custom colours while no custom colour is chosen) has no place in the nav
    navRows.forEach(({ row, button }) => { button.parentElement.hidden = row.offsetParent === null; });
    const shown = navRows.map((entry, index) => ({ ...entry, index })).filter(({ row }) => row.offsetParent !== null);
    const rowTops = shown.map(({ row }) => row.getBoundingClientRect().top - bodyTop);
    const picked = shown.length ? pickCurrentCard(rowTops, 24, atBottom) : -1;
    setNavRowCurrent(picked === -1 ? -1 : shown[picked].index);
  }

  // One scroll listener for the page, however often the nav is rebuilt
  function bindNavScrollOnce() {
    const body = settingsModal?.querySelector('.settings-modal-body');
    if (!body || navScrollBound) return;
    navScrollBound = true;
    // The custom colour row appears and goes with the background choice, so the nav follows it
    document.getElementById('modalEditorBgSelect')?.addEventListener('change', () => requestAnimationFrame(updateNavCurrent));
    body.addEventListener('scroll', () => {
      if (navFrame) return;
      navFrame = requestAnimationFrame(() => {
        navFrame = 0;
        updateNavCurrent();
      });
    }, { passive: true });
  }

  function renderSettingsNav() {
    const navList = document.getElementById('settingsNavItems');
    const body = settingsModal?.querySelector('.settings-modal-body');
    const active = settingsModal?.querySelector('.settings-tab-content.active');
    if (!navList || !body || !active) return;
    // Order and membership come from settings-layout.json; the card itself is found by its heading key
    const tabLayout = settingsLayout.tabs.find(t => t.tab === active.id);
    navCards = (tabLayout?.cards ?? [])
      .map(key => active.querySelector(`.settings-section-card > h4[data-key="${key}"]`)?.parentElement)
      .filter(card => card && card.offsetParent !== null);
    navButtons = [];
    navRows = [];
    navList.replaceChildren(...navCards.map(card => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'settings-nav-item';
      // The card heading holds the icon glyph and the label; the nav item shows the same two, copied from it
      const heading = card.querySelector(':scope > h4');
      const glyph = document.createElement('span');
      glyph.className = 'material-symbols-outlined settings-nav-icon';
      glyph.setAttribute('aria-hidden', 'true');
      glyph.textContent = heading.querySelector('.material-symbols-outlined')?.textContent.trim() ?? '';
      const labelSource = heading.cloneNode(true);
      labelSource.querySelectorAll('.material-symbols-outlined').forEach((el) => el.remove());
      const label = document.createElement('span');
      label.className = 'settings-nav-label';
      label.textContent = labelSource.textContent.trim();
      button.append(glyph, label);
      button.addEventListener('click', () => {
        navSpyPausedUntil = Date.now() + 700;
        const offset = card.getBoundingClientRect().top - body.getBoundingClientRect().top;
        body.scrollBy({ top: offset - 12, behavior: 'smooth' });
        setNavCurrent(navButtons.indexOf(button));
        // Once the smooth scroll has settled, the current item follows the scroll position again
        setTimeout(updateNavCurrent, 750);
      });
      navButtons.push(button);
      item.appendChild(button);
      // The settings of the card, one entry each, under the card's own entry (they scroll to the setting's row)
      const rows = [...card.querySelectorAll('[data-setting-row]')].filter(r => r.querySelector('.setting-label'));
      if (rows.length) {
        const sub = document.createElement('ul');
        sub.className = 'settings-nav-items settings-nav-rows';
        for (const row of rows) {
          const subItem = document.createElement('li');
          const subButton = document.createElement('button');
          subButton.type = 'button';
          subButton.className = 'settings-nav-item settings-nav-row';
          // The label only: the info button and the icon glyphs inside it are not part of the name
          const labelOnly = row.querySelector('.setting-label').cloneNode(true);
          labelOnly.querySelectorAll('.material-symbols-outlined, .setting-info-btn').forEach((el) => el.remove());
          subButton.textContent = labelOnly.textContent.trim();
          subButton.addEventListener('click', () => {
            navSpyPausedUntil = Date.now() + 700;
            const offset = row.getBoundingClientRect().top - body.getBoundingClientRect().top;
            body.scrollBy({ top: offset - 12, behavior: 'smooth' });
            setTimeout(updateNavCurrent, 750);
          });
          navRows.push({ row, button: subButton });
          subItem.append(subButton);
          sub.append(subItem);
        }
        item.append(sub);
      }
      return item;
    }));
    // The list stays in the left nav (under its title); the tabs are a row above the layout
    bindNavScrollOnce();
    updateNavCurrent();
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
    if (settingsTabDesc && TAB_DESC_KEYS[tabId]) {
      settingsTabDesc.textContent = t(TAB_DESC_KEYS[tabId]);
      settingsTabDesc.setAttribute('data-i18n', TAB_DESC_KEYS[tabId]);
    }
    // The cards can only be measured once their tab is shown
    fitThemeCards(document.getElementById('modalThemeCards'));
    fitThemeCards(document.getElementById('modalOverlayColorCards'));
    renderSettingsNav();
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

  // The one way out of settings (the back button and Esc): same confirmation as before
  let closeRequestPending = false;
  const requestCloseSettings = async () => {
    if (closeRequestPending) return; // a second Esc or click while the question is open must not ask again
    closeRequestPending = true;
    try {
      if (await confirmClose('settings')) closeSettingsView();
    } finally {
      closeRequestPending = false;
    }
  };

  // Back to the top of the settings page (the body scrolls, the tab row stays)
  document.getElementById('btnSettingsToTop')?.addEventListener('click', () => {
    settingsModal?.querySelector('.settings-modal-body')?.scrollTo({ top: 0, behavior: 'smooth' });
  });

  if (btnBackToEditor) {
    btnBackToEditor.addEventListener('click', requestCloseSettings);
  }

  // Editor options row: leave the settings and turn the right panel to Editor Options.
  // No close confirmation (owner decision 2026-11-17): the button says where it goes, unlike a stray click on × or Back
  const openEditorOptionsPanel = () => {
    closeSettingsView();
    const toggle = document.getElementById('btnEditorOptionsToggle');
    if (toggle && toggle.getAttribute('aria-pressed') !== 'true') toggle.click();
  };
  document.getElementById('btnOpenEditorOptions')?.addEventListener('click', openEditorOptionsPanel);

  // Keyboard shortcut Esc to return to editor (same confirmation as the back button)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && settingsModal && (settingsModal.style.display === 'flex' || settingsModal.style.display === 'block')) {
      requestCloseSettings();
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
      if (settingsTabDesc && TAB_DESC_KEYS[target]) {
        settingsTabDesc.textContent = t(TAB_DESC_KEYS[target]);
        settingsTabDesc.setAttribute('data-i18n', TAB_DESC_KEYS[target]);
      }
      const body = settingsModal?.querySelector('.settings-modal-body');
      if (body) body.scrollTop = 0;
      fitThemeCards(document.getElementById('modalThemeCards'));
    fitThemeCards(document.getElementById('modalOverlayColorCards'));
      renderSettingsNav();
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
      // Loading replaces every tab, so unsaved changes are asked about before the file is chosen
      if (hasUnsavedTabs()) {
        const proceed = await showConfirmModal({
          title: t('import_workspace_unsaved'),
          message: '',
          confirmText: t('btn_replace_tabs'),
          cancelText: t('btn_keep_open'),
          type: 'warning'
        });
        if (!proceed) return;
      }
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
        cancelText: t('common_cancel'),
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
        title: t(dev ? 'maint_reset_dev_btn' : 'maint_reset_label'),
        message: t(dev ? 'maint_reset_dev_confirm' : 'maint_reset_confirm'),
        confirmText: t(dev ? 'maint_reset_dev_btn' : 'maint_reset_btn'),
        cancelText: t('common_cancel'),
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
        cancelText: t('common_cancel'),
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
        cancelText: t('common_cancel'),
        type: 'warning'
      });
      if (confirmed) window.engineAPI.restartApp();
    });
  }

  // Initial apply
  applyEditorSettings();
  setLedStatus('conf', true, t('led_conf_restored'));
}

export function getTheme() {
  const themeSelect = typeof document !== 'undefined' ? document.getElementById('themeSelect') : null;
  const storedThemeName = typeof localStorage !== 'undefined' ? getStoredThemeSetting() : null;
  const currentChoice = (themeSelect && themeSelect.value) || storedThemeName;
  return currentChoice ? getMonacoThemeId(currentChoice) : 'vs-dark';
}

export function getFontFamily() {
  const defaultFont = DEFAULTS.FONT_FAMILY;
  return document.getElementById('fontFamilySelect')?.value || readStorage(STORAGE_KEYS.FONT_FAMILY) || defaultFont;
}

export function getFontSize() {
  return parseInt(document.getElementById('fontSizeSelect')?.value || readStorage(STORAGE_KEYS.FONT_SIZE) || String(DEFAULTS.FONT_SIZE), 10);
}
