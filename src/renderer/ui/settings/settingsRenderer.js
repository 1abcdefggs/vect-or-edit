import { i18n } from '../../core/i18n.js';

export function populateThemeDropdown(selectEl, availableThemes, currentVal) {
  if (!selectEl) return;
  selectEl.innerHTML = '';

  const autoOpt = document.createElement('option');
  autoOpt.value = 'auto';
  autoOpt.textContent = i18n.theme_system_auto || 'System (Auto)';
  selectEl.appendChild(autoOpt);

  availableThemes.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    selectEl.appendChild(opt);
  });

  if (currentVal) {
    selectEl.value = currentVal;
  }
}

export function syncUIWithSettings(settings, elements) {
  const { fontFamily, fontSize, editorBgTone, customBg, customFg } = settings;
  const {
    fontFamilySelect, modalFontFamilySelect,
    fontSizeSelect, modalFontSizeSelect,
    quickEditorToneSelect, modalEditorBgSelect,
    quickCustomBgPicker, modalCustomBgPicker,
    quickCustomFgPicker, modalCustomFgPicker,
    quickCustomColorGroup, modalCustomColorSettings
  } = elements;

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

  if (editorBgTone === 'custom') {
    if (quickCustomColorGroup) quickCustomColorGroup.style.display = 'inline-flex';
    if (modalCustomColorSettings) modalCustomColorSettings.style.display = 'flex';
  } else {
    if (quickCustomColorGroup) quickCustomColorGroup.style.display = 'none';
    if (modalCustomColorSettings) modalCustomColorSettings.style.display = 'none';
  }
}
