import { icons } from './icons.js';
import { changeLanguage, currentLang } from './i18n.js';
import { loadTheme } from './themeLoader.js';

// Light/Dark mode disabled
const isLightTheme = false; // placeholder to keep existing references
let updateEditorOptionsCallback = null;

export function initSettings(updateEditorCb) {
  updateEditorOptionsCallback = updateEditorCb;

  const fontFamilySelect = document.getElementById('fontFamilySelect');
  const fontSizeSelect = document.getElementById('fontSizeSelect');
  const editorInput = document.getElementById('editorInput');
  const btnTheme = document.getElementById('btnTheme');
  const btnLangToggle = document.getElementById('btnLangToggle');
  const themeSelect = document.getElementById('themeSelect');

// Light/Dark mode initialization removed (handled via theme JSON only)

  // Dynamically load available theme JSON files and populate the selector
  let availableThemes = [];
  try {
    // Vite/Electron dev environment – use import.meta.globEager
    if (import.meta && typeof import.meta.globEager === 'function') {
      const themeModules = import.meta.globEager('./themes/*.json');
      availableThemes = Object.keys(themeModules)
        .map(p => p.replace(/^\.\/themes\//, '').replace(/\.json$/i, ''))
        .sort();
    }
  } catch (_) {
    // Fallback for packaged Electron where import.meta may not work
    try {
      const fs = window.require ? window.require('fs') : require('fs');
      const path = window.require ? window.require('path') : require('path');
      const themeDir = path.join(__dirname, 'themes');
      availableThemes = fs.readdirSync(themeDir)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace(/\.json$/i, ''))
        .sort();
    } catch (e) {
      console.error('Failed to load theme files:', e);
    }
  }

  // Clear any existing options and add a placeholder
  themeSelect.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Select Theme';
  placeholder.disabled = true;
  placeholder.hidden = true;
  themeSelect.appendChild(placeholder);

  // Populate selector with available themes
  availableThemes.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    themeSelect.appendChild(opt);
  });

  // Set initial theme from stored name or first available
  const storedThemeName = localStorage.getItem('themeName');
  themeSelect.value = (storedThemeName && availableThemes.includes(storedThemeName)) ? storedThemeName : (availableThemes[0] || '');
  loadTheme(themeSelect.value);


  // Theme selector change handler – update theme and persist mode
  themeSelect.addEventListener('change', async () => {
    const selected = themeSelect.value;
    await loadTheme(selected);
    localStorage.setItem('themeName', selected);
  });

  // Language toggle (unchanged)
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



  // Initial apply
  applySettings();
}

export function getTheme() {
  // Editor theme is fixed to dark mode
  return 'vs-dark';
}

export function getFontFamily() {
  return document.getElementById('fontFamilySelect')?.value || "Georgia, 'Times New Roman', Times, serif";
}

export function getFontSize() {
  return parseInt(document.getElementById('fontSizeSelect')?.value || 16, 10);
}
