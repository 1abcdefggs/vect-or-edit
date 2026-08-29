import { icons } from '../../core/icons.js';
import { changeLanguage, currentLang, i18n } from '../../core/i18n.js';
import { loadTheme, availableThemes, getResolvedThemeName } from '../../editor/core/themeLoader.js';
import { setLedStatus } from '../../core/statusManager.js';
import { STORAGE_KEYS, DEFAULTS } from '../../core/constants.js';
import { importDictionary } from '../../search/dictionary.js';
import { applyEditorCanvasTone, exportWorkspaceBundle, importWorkspaceBundle, updateAutoSaveUI } from '../../editor/editorManager.js';
import { syncSettingsToBackend } from './settingsState.js';

function setAndSync(key, value) {
  localStorage.setItem(key, value);
  syncSettingsToBackend();
}

let updateEditorOptionsCallback = null;

export function initSettings(updateEditorCb) {
  updateEditorOptionsCallback = updateEditorCb;

  // Front UI Elements
  const fontFamilySelect = document.getElementById('fontFamilySelect');
  const fontSizeSelect = document.getElementById('fontSizeSelect');
  const btnTheme = document.getElementById('btnTheme');
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
  const modalSuggestTriggerSelect = document.getElementById('modalSuggestTriggerSelect');



  // Theme list population
  const themeList = (availableThemes && availableThemes.length > 0)
    ? availableThemes
    : ['Dracula', 'GitHub Dark', 'GitHub Light', 'Monokai', 'Night Owl'];

  function populateThemeDropdown(selectEl) {
    if (!selectEl) return;
    const currentVal = selectEl.value;
    selectEl.innerHTML = '';

    // Add System (Auto) option first
    const autoOpt = document.createElement('option');
    autoOpt.value = 'auto';
    autoOpt.textContent = i18n.theme_system_auto || 'System (Auto)';
    selectEl.appendChild(autoOpt);

    themeList.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      selectEl.appendChild(opt);
    });

    if (currentVal) {
      selectEl.value = currentVal;
    }
  }

  populateThemeDropdown(themeSelect);
  populateThemeDropdown(modalThemeSelect);

  const storedThemeName = localStorage.getItem(STORAGE_KEYS.LEGACY_THEME) || localStorage.getItem(STORAGE_KEYS.THEME) || 'auto';
  const initialTheme = (storedThemeName === 'auto' || themeList.includes(storedThemeName)) ? storedThemeName : 'auto';
  if (themeSelect) themeSelect.value = initialTheme;
  if (modalThemeSelect) modalThemeSelect.value = initialTheme;
  loadTheme(initialTheme);

  async function applyTheme(themeName) {
    if (!themeName) return;
    if (themeSelect) themeSelect.value = themeName;
    if (modalThemeSelect) modalThemeSelect.value = themeName;
    await loadTheme(themeName);
    setAndSync(STORAGE_KEYS.LEGACY_THEME, themeName);
    setAndSync(STORAGE_KEYS.THEME, themeName);
  }

  if (themeSelect) {
    themeSelect.addEventListener('change', async () => {
      await applyTheme(themeSelect.value);
    });
  }
  if (modalThemeSelect) {
    modalThemeSelect.addEventListener('change', async () => {
      await applyTheme(modalThemeSelect.value);
    });
  }

  if (btnTheme) {
    btnTheme.addEventListener('click', async () => {
      const allChoices = ['auto', ...themeList];
      if (allChoices.length === 0) return;
      const currentIndex = allChoices.indexOf(themeSelect.value);
      const nextIndex = (currentIndex + 1) % allChoices.length;
      const nextTheme = allChoices[nextIndex];
      await applyTheme(nextTheme);
    });
  }

  // Language toggle & 2-way sync
  async function applyLanguage(lang) {
    await changeLanguage(lang);
    if (btnLangToggle) btnLangToggle.textContent = lang.toUpperCase();
    if (modalLangSelect) modalLangSelect.value = lang;
    populateThemeDropdown(themeSelect);
    populateThemeDropdown(modalThemeSelect);
    updateAutoSaveUI();
  }

  if (btnLangToggle) {
    btnLangToggle.textContent = currentLang.toUpperCase();
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
    const renderLineHighlight = modalLineHighlightSelect?.value || 'line';
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

  const storedAiProvider = localStorage.getItem(STORAGE_KEYS.AI_PROVIDER) || DEFAULTS.AI_PROVIDER;
  const storedClaudeKey = localStorage.getItem(STORAGE_KEYS.CLAUDE_API_KEY) || '';
  const storedClaudeModel = localStorage.getItem(STORAGE_KEYS.CLAUDE_MODEL) || DEFAULTS.CLAUDE_MODEL;
  const storedGeminiKey = localStorage.getItem(STORAGE_KEYS.GEMINI_API_KEY) || '';
  const storedGeminiModel = localStorage.getItem(STORAGE_KEYS.GEMINI_MODEL) || DEFAULTS.GEMINI_MODEL;
  const storedOpenAiKey = localStorage.getItem(STORAGE_KEYS.OPENAI_API_KEY) || '';
  const storedOpenAiModel = localStorage.getItem(STORAGE_KEYS.OPENAI_MODEL) || DEFAULTS.OPENAI_MODEL;
  const storedAiScope = localStorage.getItem(STORAGE_KEYS.AI_INFERENCE_SCOPE) || DEFAULTS.AI_INFERENCE_SCOPE;

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
        if (card.dataset.provider === val) {
          card.style.borderColor = 'var(--accent-color, #38bdf8)';
          card.style.background = 'rgba(56, 189, 248, 0.1)';
        } else {
          card.style.borderColor = 'var(--border-color, rgba(148, 163, 184, 0.2))';
          card.style.background = 'transparent';
        }
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
      setAndSync(STORAGE_KEYS.AI_PROVIDER, val);
      updateAiProviderVisibility(val);
      updateAiModelBadge();
      updateActiveProviderCard(val);
    });
  }

  function updateAiProviderVisibility(provider) {
    if (localAiSettingsBlock) localAiSettingsBlock.style.display = provider === 'local' ? 'flex' : 'none';
    if (geminiSettingsBlock) geminiSettingsBlock.style.display = provider === 'gemini' ? 'flex' : 'none';
    if (openaiSettingsBlock) openaiSettingsBlock.style.display = provider === 'openai' ? 'flex' : 'none';
    if (claudeSettingsBlock) claudeSettingsBlock.style.display = provider === 'claude' ? 'flex' : 'none';
  }

  if (modalGeminiKeyInput) {
    modalGeminiKeyInput.value = storedGeminiKey;
    modalGeminiKeyInput.addEventListener('input', () => {
      setAndSync(STORAGE_KEYS.GEMINI_API_KEY, modalGeminiKeyInput.value.trim());
    });
  }

  if (modalGeminiModelSelect) {
    modalGeminiModelSelect.value = storedGeminiModel;
    modalGeminiModelSelect.addEventListener('change', () => {
      setAndSync(STORAGE_KEYS.GEMINI_MODEL, modalGeminiModelSelect.value);
      updateAiModelBadge();
    });
  }

  if (modalOpenAiKeyInput) {
    modalOpenAiKeyInput.value = storedOpenAiKey;
    modalOpenAiKeyInput.addEventListener('input', () => {
      setAndSync(STORAGE_KEYS.OPENAI_API_KEY, modalOpenAiKeyInput.value.trim());
    });
  }

  if (modalOpenAiModelSelect) {
    modalOpenAiModelSelect.value = storedOpenAiModel;
    modalOpenAiModelSelect.addEventListener('change', () => {
      setAndSync(STORAGE_KEYS.OPENAI_MODEL, modalOpenAiModelSelect.value);
      updateAiModelBadge();
    });
  }

  if (modalClaudeKeyInput) {
    modalClaudeKeyInput.value = storedClaudeKey;
    modalClaudeKeyInput.addEventListener('input', () => {
      setAndSync(STORAGE_KEYS.CLAUDE_API_KEY, modalClaudeKeyInput.value.trim());
    });
  }

  if (modalClaudeModelSelect) {
    modalClaudeModelSelect.value = storedClaudeModel;
    modalClaudeModelSelect.addEventListener('change', () => {
      setAndSync(STORAGE_KEYS.CLAUDE_MODEL, modalClaudeModelSelect.value);
      updateAiModelBadge();
    });
  }

  if (btnInitLocalAi) {
    btnInitLocalAi.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('app:requestLocalAiInit'));
    });
  }

  const btnModalImportDict = document.getElementById('btnModalImportDict');
  if (btnModalImportDict) {
    btnModalImportDict.addEventListener('click', async () => {
      await importDictionary();
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

  // AI Model Badge updater & switcher
  // AI Model Badge updater & switcher
  function updateAiModelBadge() {
    const badgeEl = document.getElementById('activeAiModelBadge');
    const dotEl = document.getElementById('activeAiModelStatusDot');
    if (!badgeEl) return;
    const provider = localStorage.getItem(STORAGE_KEYS.AI_PROVIDER) || DEFAULTS.AI_PROVIDER;

    if (provider === 'none') {
      if (dotEl) dotEl.style.color = 'var(--text-muted, #94a3b8)';
      badgeEl.textContent = 'OFF: Disabled';
      badgeEl.parentElement?.setAttribute('title', 'AI Suggestion is currently disabled. Click to enable in Settings.');
      return;
    }

    if (dotEl) dotEl.style.color = 'var(--success-color, #10b981)';

    if (provider === 'gemini') {
      const model = localStorage.getItem(STORAGE_KEYS.GEMINI_MODEL) || DEFAULTS.GEMINI_MODEL;
      const modelShort = model.replace('gemini-', '');
      badgeEl.textContent = `ON: Cloud (Gemini ${modelShort})`;
      badgeEl.parentElement?.setAttribute('title', `Active: Cloud AI (Gemini ${modelShort}). Click to configure.`);
    } else if (provider === 'openai') {
      const model = localStorage.getItem(STORAGE_KEYS.OPENAI_MODEL) || DEFAULTS.OPENAI_MODEL;
      badgeEl.textContent = `ON: Cloud (OpenAI ${model})`;
      badgeEl.parentElement?.setAttribute('title', `Active: Cloud AI (OpenAI ${model}). Click to configure.`);
    } else if (provider === 'claude') {
      const model = localStorage.getItem(STORAGE_KEYS.CLAUDE_MODEL) || DEFAULTS.CLAUDE_MODEL;
      const shortName = model.includes('haiku') ? 'Haiku' : 'Sonnet';
      badgeEl.textContent = `ON: Cloud (Claude ${shortName})`;
      badgeEl.parentElement?.setAttribute('title', `Active: Cloud AI (Claude ${shortName}). Click to configure.`);
    } else {
      badgeEl.textContent = `ON: Local (E5-Small ONNX)`;
      badgeEl.parentElement?.setAttribute('title', 'Active: Local On-Device AI (E5-Small ONNX / Zero Cloud Leak). Click to configure.');
    }
  }

  updateAiModelBadge();

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
      } else {
        c.classList.remove('active');
      }
    });
  }

  const btnChangeAiModel = document.getElementById('btnChangeAiModel');
  if (btnChangeAiModel) {
    btnChangeAiModel.addEventListener('click', () => {
      openSettingsTab('tabAiSearch');
    });
  }

  const btnOpenAiSettingsQuick = document.getElementById('btnOpenAiSettingsQuick');
  if (btnOpenAiSettingsQuick) {
    btnOpenAiSettingsQuick.addEventListener('click', () => {
      openSettingsTab('tabAiSearch');
    });
  }

  // Modal Open/Close & Tabs
  if (btnSettings && settingsModal) {
    btnSettings.addEventListener('click', () => {
      settingsModal.style.display = 'flex';
    });
  }

  if (btnCloseSettingsModal && settingsModal) {
    btnCloseSettingsModal.addEventListener('click', () => {
      settingsModal.style.display = 'none';
      updateAiModelBadge();
    });
  }

  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) {
        settingsModal.style.display = 'none';
        updateAiModelBadge();
      }
    });
  }

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

  // Log Display Position & Startup Visibility
  const chkLogCollapsedOnStartup = document.getElementById('chkLogCollapsedOnStartup');
  if (chkLogCollapsedOnStartup) {
    const isCollapsedOnStart = localStorage.getItem(STORAGE_KEYS.LOG_COLLAPSED_ON_STARTUP) === 'true';
    chkLogCollapsedOnStartup.checked = isCollapsedOnStart;
    chkLogCollapsedOnStartup.addEventListener('change', (e) => {
      setAndSync(STORAGE_KEYS.LOG_COLLAPSED_ON_STARTUP, String(e.target.checked));
    });
  }

  function applyLogDisplayPosition() {
    const systemLogPanel = document.getElementById('systemLogPanel');
    const isCollapsedOnStart = localStorage.getItem(STORAGE_KEYS.LOG_COLLAPSED_ON_STARTUP) === 'true';
    if (systemLogPanel) {
      systemLogPanel.style.display = isCollapsedOnStart ? 'none' : 'flex';
    }
  }

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

  // Initial apply
  applyEditorSettings();
  setLedStatus('conf', true, `1. CONFIG: Settings Restored`);
}

export function getTheme() {
  const themeSelect = typeof document !== 'undefined' ? document.getElementById('themeSelect') : null;
  const storedThemeName = typeof localStorage !== 'undefined' ? (localStorage.getItem(STORAGE_KEYS.LEGACY_THEME) || localStorage.getItem(STORAGE_KEYS.THEME)) : null;
  const currentChoice = (themeSelect && themeSelect.value) || storedThemeName || 'auto';
  const resolved = getResolvedThemeName(currentChoice);
  return resolved ? resolved.replace(/[^a-zA-Z0-9_-]/g, '-') : 'vs-dark';
}

export function getFontFamily() {
  const defaultFont = DEFAULTS.FONT_FAMILY;
  return document.getElementById('fontFamilySelect')?.value || localStorage.getItem(STORAGE_KEYS.FONT_FAMILY) || defaultFont;
}

export function getFontSize() {
  return parseInt(document.getElementById('fontSizeSelect')?.value || localStorage.getItem(STORAGE_KEYS.FONT_SIZE) || String(DEFAULTS.FONT_SIZE), 10);
}
