import { icons } from './icons.js';
import { changeLanguage, currentLang } from './i18n.js';
import { loadTheme, availableThemes } from './themeLoader.js';
import { setLedStatus } from './statusManager.js';

// Light/Dark mode disabled
const isLightTheme = false; // placeholder to keep existing references
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

  const selLogDisplayPosition = document.getElementById('selLogDisplayPosition');

  // Theme list population
  const themeList = (availableThemes && availableThemes.length > 0)
    ? availableThemes
    : ['Dracula', 'GitHub Dark', 'Monokai', 'Night Owl'];

  function populateThemeDropdown(selectEl) {
    if (!selectEl) return;
    selectEl.innerHTML = '';
    themeList.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      selectEl.appendChild(opt);
    });
  }

  populateThemeDropdown(themeSelect);
  populateThemeDropdown(modalThemeSelect);

  const storedThemeName = localStorage.getItem('themeName');
  const initialTheme = (storedThemeName && themeList.includes(storedThemeName)) ? storedThemeName : (themeList[0] || 'Dracula');
  if (themeSelect) themeSelect.value = initialTheme;
  if (modalThemeSelect) modalThemeSelect.value = initialTheme;
  loadTheme(initialTheme);

  async function applyTheme(themeName) {
    if (!themeName) return;
    if (themeSelect) themeSelect.value = themeName;
    if (modalThemeSelect) modalThemeSelect.value = themeName;
    await loadTheme(themeName);
    localStorage.setItem('themeName', themeName);
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
      if (themeList.length === 0) return;
      const currentIndex = themeList.indexOf(themeSelect.value);
      const nextIndex = (currentIndex + 1) % themeList.length;
      const nextTheme = themeList[nextIndex];
      await applyTheme(nextTheme);
    });
  }

  // Language toggle & 2-way sync
  async function applyLanguage(lang) {
    await changeLanguage(lang);
    if (btnLangToggle) btnLangToggle.textContent = lang.toUpperCase();
    if (modalLangSelect) modalLangSelect.value = lang;
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
    const fontFamily = fontFamilySelect?.value || modalFontFamilySelect?.value || "Georgia, 'Times New Roman', Times, serif";
    const fontSize = parseInt(fontSizeSelect?.value || modalFontSizeSelect?.value || '16', 10);
    const lineHeight = parseInt(modalLineHeightSelect?.value || '26', 10);
    const wordWrap = modalWordWrapSelect?.value || 'on';
    const lineNumbers = modalLineNumbersSelect?.value || 'on';
    const renderLineHighlight = modalLineHighlightSelect?.value || 'line';
    const stickyScroll = (modalStickyScrollSelect?.value || 'on') === 'on';
    const renderWhitespace = modalWhitespaceSelect?.value || 'none';

    // Sync Front & Modal
    if (fontFamilySelect && modalFontFamilySelect) {
      fontFamilySelect.value = fontFamily;
      modalFontFamilySelect.value = fontFamily;
    }
    if (fontSizeSelect && modalFontSizeSelect) {
      fontSizeSelect.value = String(fontSize);
      modalFontSizeSelect.value = String(fontSize);
    }

    // Save preferences
    localStorage.setItem('editor_fontFamily', fontFamily);
    localStorage.setItem('editor_fontSize', String(fontSize));
    localStorage.setItem('editor_lineHeight', String(lineHeight));
    localStorage.setItem('editor_wordWrap', wordWrap);
    localStorage.setItem('editor_lineNumbers', lineNumbers);
    localStorage.setItem('editor_lineHighlight', renderLineHighlight);
    localStorage.setItem('editor_stickyScroll', String(stickyScroll));
    localStorage.setItem('editor_renderWhitespace', renderWhitespace);

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
  const savedFont = localStorage.getItem('editor_fontFamily');
  if (savedFont) {
    if (fontFamilySelect) fontFamilySelect.value = savedFont;
    if (modalFontFamilySelect) modalFontFamilySelect.value = savedFont;
  }
  const savedSize = localStorage.getItem('editor_fontSize');
  if (savedSize) {
    if (fontSizeSelect) fontSizeSelect.value = savedSize;
    if (modalFontSizeSelect) modalFontSizeSelect.value = savedSize;
  }
  const savedLineHeight = localStorage.getItem('editor_lineHeight');
  if (savedLineHeight && modalLineHeightSelect) modalLineHeightSelect.value = savedLineHeight;
  const savedWordWrap = localStorage.getItem('editor_wordWrap');
  if (savedWordWrap && modalWordWrapSelect) modalWordWrapSelect.value = savedWordWrap;
  const savedLineNumbers = localStorage.getItem('editor_lineNumbers');
  if (savedLineNumbers && modalLineNumbersSelect) modalLineNumbersSelect.value = savedLineNumbers;
  const savedLineHighlight = localStorage.getItem('editor_lineHighlight');
  if (savedLineHighlight && modalLineHighlightSelect) modalLineHighlightSelect.value = savedLineHighlight;
  const savedStickyScroll = localStorage.getItem('editor_stickyScroll');
  if (savedStickyScroll !== null && modalStickyScrollSelect) modalStickyScrollSelect.value = savedStickyScroll === 'true' ? 'on' : 'off';
  const savedWhitespace = localStorage.getItem('editor_renderWhitespace');
  if (savedWhitespace && modalWhitespaceSelect) modalWhitespaceSelect.value = savedWhitespace;

  // Event Listeners for Editor settings
  [fontFamilySelect, modalFontFamilySelect, fontSizeSelect, modalFontSizeSelect,
   modalLineHeightSelect, modalWordWrapSelect, modalLineNumbersSelect,
   modalLineHighlightSelect, modalStickyScrollSelect, modalWhitespaceSelect].forEach(el => {
    if (el) el.addEventListener('change', applyEditorSettings);
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
        localStorage.setItem('vect_show_full_metadata', String(chkShowFullMetadata.checked));
      }
    }
  }

  if (numMinScore) numMinScore.addEventListener('input', () => syncSearchSettings('front'));
  if (modalMinScoreInput) modalMinScoreInput.addEventListener('input', () => syncSearchSettings('modal'));
  if (selSearchLimit) selSearchLimit.addEventListener('change', () => syncSearchSettings('front'));
  if (modalLimitSelect) modalLimitSelect.addEventListener('change', () => syncSearchSettings('modal'));
  if (chkShowFullMetadata) chkShowFullMetadata.addEventListener('change', () => syncSearchSettings('front'));
  if (modalShowFullMetadataChk) modalShowFullMetadataChk.addEventListener('change', () => syncSearchSettings('modal'));

  // Restore Search Settings
  const savedFullMeta = localStorage.getItem('vect_show_full_metadata') === 'true';
  if (chkShowFullMetadata) chkShowFullMetadata.checked = savedFullMeta;
  if (modalShowFullMetadataChk) modalShowFullMetadataChk.checked = savedFullMeta;

  const savedTriggerMode = localStorage.getItem('vect_suggest_trigger_mode') || 'selection';
  if (modalSuggestTriggerSelect) {
    modalSuggestTriggerSelect.value = savedTriggerMode;
    modalSuggestTriggerSelect.addEventListener('change', (e) => {
      localStorage.setItem('vect_suggest_trigger_mode', e.target.value);
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
    });
  }

  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) {
        settingsModal.style.display = 'none';
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

  // Log Display Position
  if (selLogDisplayPosition) {
    const storedPos = localStorage.getItem('logDisplayPosition') || 'top';
    selLogDisplayPosition.value = storedPos;
    applyLogDisplayPosition(storedPos);

    selLogDisplayPosition.addEventListener('change', () => {
      const pos = selLogDisplayPosition.value;
      localStorage.setItem('logDisplayPosition', pos);
      applyLogDisplayPosition(pos);
    });
  }

  function applyLogDisplayPosition(pos) {
    const liveLogTicker = document.getElementById('liveLogTicker');
    const systemLogPanel = document.getElementById('systemLogPanel');
    if (pos === 'bottom') {
      if (liveLogTicker) liveLogTicker.classList.add('hidden');
      if (systemLogPanel) systemLogPanel.style.display = 'flex';
    } else {
      if (liveLogTicker) liveLogTicker.classList.remove('hidden');
      if (systemLogPanel) systemLogPanel.style.display = 'none';
    }
  }

  // Initial apply
  applyEditorSettings();
  setLedStatus('conf', true, `3. User Config: Font & Settings Restored`);
}

export function getTheme() {
  const themeSelect = document.getElementById('themeSelect');
  const storedThemeName = localStorage.getItem('themeName');
  return (themeSelect && themeSelect.value) || storedThemeName || 'Dracula';
}

export function getFontFamily() {
  return document.getElementById('fontFamilySelect')?.value || localStorage.getItem('editor_fontFamily') || "Georgia, 'Times New Roman', Times, serif";
}

export function getFontSize() {
  return parseInt(document.getElementById('fontSizeSelect')?.value || localStorage.getItem('editor_fontSize') || '16', 10);
}
