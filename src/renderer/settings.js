import { icons } from './icons.js';
import { changeLanguage, currentLang } from './i18n.js';

let isLightTheme = false;
let updateEditorOptionsCallback = null;

export function initSettings(updateEditorCb) {
  updateEditorOptionsCallback = updateEditorCb;

  const fontFamilySelect = document.getElementById('fontFamilySelect');
  const fontSizeSelect = document.getElementById('fontSizeSelect');
  const editorInput = document.getElementById('editorInput');
  const btnTheme = document.getElementById('btnTheme');
  const btnLangToggle = document.getElementById('btnLangToggle');

  if (btnLangToggle) {
    btnLangToggle.textContent = currentLang.toUpperCase();
    btnLangToggle.addEventListener('click', async () => {
      const nextLang = currentLang === 'en' ? 'ja' : 'en';
      await changeLanguage(nextLang);
      btnLangToggle.textContent = nextLang.toUpperCase();
    });
  }

  function applySettings() {
    const fontFamily = fontFamilySelect.value;
    const fontSize = parseInt(fontSizeSelect.value, 10);

    editorInput.style.fontFamily = fontFamily;
    editorInput.style.fontSize = `${fontSize}px`;

    if (updateEditorOptionsCallback) {
      updateEditorOptionsCallback({ fontFamily, fontSize });
    }
  }

  if (fontFamilySelect) fontFamilySelect.addEventListener('change', applySettings);
  if (fontSizeSelect) fontSizeSelect.addEventListener('change', applySettings);

  if (btnTheme) {
    btnTheme.addEventListener('click', () => {
      isLightTheme = !isLightTheme;
      if (isLightTheme) {
        document.documentElement.classList.add('light-theme');
        btnTheme.innerHTML = icons.themeLight;
        if (updateEditorOptionsCallback) updateEditorOptionsCallback({ theme: 'vs' });
      } else {
        document.documentElement.classList.remove('light-theme');
        btnTheme.innerHTML = icons.themeDark;
        if (updateEditorOptionsCallback) updateEditorOptionsCallback({ theme: 'vs-dark' });
      }
    });
  }

  // Initial apply
  applySettings();
}

export function getTheme() {
  return isLightTheme ? 'vs' : 'vs-dark';
}

export function getFontFamily() {
  return document.getElementById('fontFamilySelect')?.value || "Georgia, 'Times New Roman', Times, serif";
}

export function getFontSize() {
  return parseInt(document.getElementById('fontSizeSelect')?.value || 16, 10);
}
