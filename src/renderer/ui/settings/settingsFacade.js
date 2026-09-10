import { icons } from '../../core/icons.js';
import { changeLanguage, currentLang, i18n } from '../../core/i18n.js';
import { loadTheme, availableThemes, getResolvedThemeName } from '../../editor/core/themeLoader.js';
import { setLedStatus } from '../../core/statusManager.js';
import { STORAGE_KEYS, DEFAULTS } from '../../core/constants.js';
import { importDictionary } from '../../search/dictionary.js';
import { applyEditorCanvasTone, exportWorkspaceBundle, importWorkspaceBundle, updateAutoSaveUI } from '../../editor/editorManager.js';
import { syncSettingsToBackend } from './settingsState.js';
import { showToast } from '../notifications/toastManager.js';
import { updateActiveModelBadgeInTable } from '../../search/searchLocalAi.js';
import { initEmbeddingSourceController } from './embeddingSourceController.js';

function setAndSync(key, value) {
  localStorage.setItem(key, value);
  syncSettingsToBackend();
}

let updateEditorOptionsCallback = null;

export function initSettings(updateEditorCb) {
  updateEditorOptionsCallback = updateEditorCb;

  // Init Embedding Source Selector (idempotent – safe to call on every modal open)
  initEmbeddingSourceController();

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
    const langToggleLabel = document.getElementById('langToggleLabel');
    if (langToggleLabel) {
      langToggleLabel.textContent = lang.toUpperCase();
    } else if (btnLangToggle) {
      btnLangToggle.textContent = lang.toUpperCase();
    }
    if (modalLangSelect) modalLangSelect.value = lang;
    populateThemeDropdown(themeSelect);
    populateThemeDropdown(modalThemeSelect);
    updateAutoSaveUI();
  }

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
  const storedGeminiKey = '';
  const storedGeminiModel = localStorage.getItem(STORAGE_KEYS.GEMINI_MODEL) || DEFAULTS.GEMINI_MODEL;
  const storedOpenAiKey = localStorage.getItem(STORAGE_KEYS.OPENAI_API_KEY) || '';
  const storedOpenAiModel = localStorage.getItem(STORAGE_KEYS.OPENAI_MODEL) || DEFAULTS.OPENAI_MODEL;
  const storedAiScope = localStorage.getItem(STORAGE_KEYS.AI_INFERENCE_SCOPE) || DEFAULTS.AI_INFERENCE_SCOPE;

  if (storedAiProvider === 'gemini' && window.engineAPI?.hasGeminiApiKey) {
    window.engineAPI.hasGeminiApiKey().then((configured) => {
      window.__geminiApiKeyConfigured = Boolean(configured);
      window.dispatchEvent(new Event('app:settingsChanged'));
    }).catch(() => {
      window.__geminiApiKeyConfigured = false;
    });
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
    // When in LLM tab, toggle the appropriate provider config block
    if (geminiSettingsBlock) geminiSettingsBlock.style.display = provider === 'gemini' ? 'flex' : 'none';
    if (openaiSettingsBlock) openaiSettingsBlock.style.display = provider === 'openai' ? 'flex' : 'none';
    if (claudeSettingsBlock) claudeSettingsBlock.style.display = provider === 'claude' ? 'flex' : 'none';
    // If provider is local or none, ensure gemini shows as default fallback in LLM tab if none selected
    if (provider === 'local' || provider === 'none') {
      if (geminiSettingsBlock) geminiSettingsBlock.style.display = 'flex';
    }
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
        const currentSavedModel = localStorage.getItem(STORAGE_KEYS.GEMINI_MODEL) || 'gemini-1.5-flash';
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
        }

        // Cache for offline/quick load
        localStorage.setItem('cached_gemini_models', JSON.stringify(models));

        if (geminiModelsFetchStatus) {
          geminiModelsFetchStatus.textContent = `Google API Keys loaded ${models.length} items.`;
          geminiModelsFetchStatus.style.color = 'var(--success-color, #10b981)';
        }
        updateAiModelBadge();
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
        const currentSavedModel = localStorage.getItem(STORAGE_KEYS.GEMINI_MODEL) || 'gemini-1.5-flash';
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
    modalGeminiKeyInput.value = storedGeminiKey;
    modalGeminiKeyInput.addEventListener('change', async () => {
      const keyVal = modalGeminiKeyInput.value.trim();
      if (keyVal) {
        const result = await window.engineAPI.saveGeminiApiKey(keyVal);
        localStorage.removeItem(STORAGE_KEYS.GEMINI_API_KEY);
        if (!result.success) {
          modalGeminiKeyInput.setCustomValidity(result.error || 'Unable to save API key securely.');
        } else {
          modalGeminiKeyInput.setCustomValidity('');
          window.__geminiApiKeyConfigured = true;
          // Automatically fetch official models from Google upon setting key
          fetchAndPopulateGeminiModels(keyVal);
        }
      }
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
      btn.title = isPassword ? 'APIキーを隠す' : 'APIキーを表示';
    });
  }

  setupPasswordToggle('modalGeminiKeyInput', 'btnToggleGeminiKeyVisibility');
  setupPasswordToggle('modalOpenAiKeyInput', 'btnToggleOpenAiKeyVisibility');
  setupPasswordToggle('modalClaudeKeyInput', 'btnToggleClaudeKeyVisibility');

  if (btnInitLocalAi) {
    btnInitLocalAi.addEventListener('click', () => {
      const targetModel = localStorage.getItem(STORAGE_KEYS.LOCAL_EMBEDDING_MODEL) || DEFAULTS.LOCAL_EMBEDDING_MODEL;
      window.dispatchEvent(new CustomEvent('app:requestLocalAiInit', { detail: { model: targetModel } }));
    });
  }

  // 384-dim Local Embedding Model Switching
  const selLocalEmbeddingModel = document.getElementById('selLocalEmbeddingModel');
  const storedLocalModel = localStorage.getItem(STORAGE_KEYS.LOCAL_EMBEDDING_MODEL) || DEFAULTS.LOCAL_EMBEDDING_MODEL;
  if (selLocalEmbeddingModel) {
    selLocalEmbeddingModel.value = storedLocalModel;
    selLocalEmbeddingModel.addEventListener('change', () => {
      const selectedModel = selLocalEmbeddingModel.value;
      setAndSync(STORAGE_KEYS.LOCAL_EMBEDDING_MODEL, selectedModel);
      const modelShortName = selectedModel.split('/').pop();
      showToast(`Switched model to ${modelShortName}. Initializing...`, 'info');
      window.dispatchEvent(new CustomEvent('app:requestLocalAiInit', { detail: { model: selectedModel } }));
      updateAiModelBadge();
    });
  }

  // Handle table "Use" action buttons
  document.querySelectorAll('.btn-switch-model').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetModel = btn.getAttribute('data-model');
      if (targetModel) {
        if (selLocalEmbeddingModel) selLocalEmbeddingModel.value = targetModel;
        setAndSync(STORAGE_KEYS.LOCAL_EMBEDDING_MODEL, targetModel);
        const modelShortName = targetModel.split('/').pop();
        showToast(`Selected ${modelShortName}. Initializing...`, 'info');
        window.dispatchEvent(new CustomEvent('app:requestLocalAiInit', { detail: { model: targetModel } }));
        updateAiModelBadge();
      }
    });
  });

  const btnModalImportDict = document.getElementById('btnModalImportDict');
  if (btnModalImportDict) {
    btnModalImportDict.addEventListener('click', async () => {
      await importDictionary();
    });
  }

  // AI MODEL Tab Switching (Embedding vs LLM)
  const aiModelTabBtns = document.querySelectorAll('.ai-model-tab-btn');
  const panelEmbedding = document.getElementById('panelEmbedding');
  const panelLlm = document.getElementById('panelLlm');
  const panelCapability = document.getElementById('panelCapability');

  function switchAiModelTab(targetTab) {
    aiModelTabBtns.forEach(btn => {
      if (btn.dataset.aimodelTab === targetTab) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (panelEmbedding) {
      if (targetTab === 'embedding') panelEmbedding.classList.add('active');
      else panelEmbedding.classList.remove('active');
    }
    if (panelLlm) {
      if (targetTab === 'llm') panelLlm.classList.add('active');
      else panelLlm.classList.remove('active');
    }
    if (panelCapability) {
      if (targetTab === 'capability') panelCapability.classList.add('active');
      else panelCapability.classList.remove('active');
    }
  }

  aiModelTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchAiModelTab(btn.dataset.aimodelTab);
    });
  });

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

  // Shortcut from Cloud Embedding subpanel to LLM tab
  const btnGoToLlmConfig = document.getElementById('btnGoToLlmConfig');
  if (btnGoToLlmConfig) {
    btnGoToLlmConfig.addEventListener('click', () => {
      switchAiModelTab('llm');
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
  function updateAiModelBadge() {
    const badgeEl = document.getElementById('activeAiModelBadge');
    const dotEl = document.getElementById('activeAiModelStatusDot');
    if (!badgeEl) return;
    const provider = localStorage.getItem(STORAGE_KEYS.AI_PROVIDER) || DEFAULTS.AI_PROVIDER;

    const state = (window.aiManager && window.aiManager.getState) ? window.aiManager.getState() : { sidebar: true };
    const isSidebarOn = state.sidebar !== false;

    if (provider === 'none') {
      if (dotEl) dotEl.style.color = '#ef4444';
      badgeEl.textContent = 'Suggest AI OFF';
      badgeEl.parentElement?.setAttribute('title', 'AI Suggestion is currently disabled. Click to enable in Settings.');
      return;
    }

    if (provider === 'local') {
      const currentModel = localStorage.getItem(STORAGE_KEYS.LOCAL_EMBEDDING_MODEL) || DEFAULTS.LOCAL_EMBEDDING_MODEL;
      const shortName = currentModel.split('/').pop();
      badgeEl.textContent = isSidebarOn ? `${shortName}` : `${shortName} (OFF)`;
      if (dotEl) dotEl.style.color = isSidebarOn ? 'var(--success-color, #10b981)' : '#ef4444';
      badgeEl.parentElement?.setAttribute('title', `Local AI Model: ${currentModel}. Click to configure.`);
      return;
    }

    if (dotEl) dotEl.style.color = isSidebarOn ? 'var(--success-color, #10b981)' : '#ef4444';
    badgeEl.textContent = isSidebarOn ? `${provider.toUpperCase()} AI ON` : `${provider.toUpperCase()} AI OFF`;
    badgeEl.parentElement?.setAttribute('title', `AI Suggestion: ${isSidebarOn ? 'ON' : 'OFF'}. Click to configure.`);
  }

  updateAiModelBadge();

  function openSettingsTab(tabId, subtab) {
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
          updateActiveModelBadgeInTable();
          if (subtab === 'llm' || subtab === 'embedding') {
            switchAiModelTab(subtab);
          }
        }
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

  window.addEventListener('app:openSettings', (e) => {
    const tabId = e.detail?.tab || 'tabAppearance';
    const subtab = e.detail?.subtab;
    openSettingsTab(tabId, subtab);
  });

  const btnBackToEditor = document.getElementById('btnBackToEditor');

  const closeSettingsView = () => {
    if (settingsModal) settingsModal.style.display = 'none';
    updateAiModelBadge();
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
    btnCloseSettingsModal.addEventListener('click', closeSettingsView);
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

  const btnClearAppCache = document.getElementById('btnClearAppCache');
  if (btnClearAppCache) {
    btnClearAppCache.addEventListener('click', async () => {
      if (!window.confirm('Clear the application cache? Documents and API keys will be kept.')) return;
      const result = await window.engineAPI.clearCache();
      window.alert(result.success ? 'Application cache cleared.' : (result.error || 'Unable to clear cache.'));
    });
  }

  const btnResetSettings = document.getElementById('btnResetSettings');
  if (btnResetSettings) {
    btnResetSettings.addEventListener('click', () => {
      if (!window.confirm('Restore default settings and reload the editor?')) return;
      localStorage.clear();
      window.location.reload();
    });
  }

  const btnReloadEditor = document.getElementById('btnReloadEditor');
  if (btnReloadEditor) {
    btnReloadEditor.addEventListener('click', () => {
      if (window.confirm('Reload the editor now?')) window.location.reload();
    });
  }

  const btnRestartApplication = document.getElementById('btnRestartApplication');
  if (btnRestartApplication) {
    btnRestartApplication.addEventListener('click', () => {
      if (window.confirm('Restart VectOrEdit now?')) window.engineAPI.restartApp();
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
