import { setLedStatus } from './statusManager.js';
import { STORAGE_KEYS, DEFAULTS } from './constants.js';
import jaLocale from '../locales/ja.json';
import enLocale from '../locales/en.json';

const LOCALES = {
  ja: jaLocale,
  en: enLocale
};

export let i18n = {};
export let currentLang = DEFAULTS.APP_LANG;

export async function loadLocales() {
  try {
    const savedLang = localStorage.getItem(STORAGE_KEYS.APP_LANG);
    const systemLang = (navigator.language || DEFAULTS.APP_LANG).split('-')[0];
    const lang = (savedLang || systemLang) === 'ja' ? 'ja' : 'en';
    currentLang = lang;
    
    i18n = LOCALES[lang] || LOCALES.en;
    applyI18n();
    setLedStatus('i18n', true, `5. Locale: ${lang}.json loaded`);
    window.dispatchEvent(new CustomEvent('app:languageChanged', { detail: { lang } }));
  } catch (err) {
    console.error('Failed to apply locale:', err);
    currentLang = 'en';
    i18n = LOCALES.en;
    applyI18n();
  }
}

export async function changeLanguage(langCode) {
  localStorage.setItem(STORAGE_KEYS.APP_LANG, langCode);
  await loadLocales();
}

export function t(key, params = {}) {
  const template = i18n[key] ?? key;
  return String(template).replace(/\{{1,2}\s*(\w+)\s*\}{1,2}/g, (_, p) => {
    return params[p] !== undefined ? params[p] : '';
  });
}

export function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    try {
      const key = el.getAttribute('data-i18n');
      if (i18n[key]) {
        if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
          el.placeholder = i18n[key];
        } else {
          el.textContent = i18n[key];
        }
      }
    } catch (e) {
      console.warn('Failed to apply i18n to element:', el, e);
    }
  });

  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    try {
      const key = el.getAttribute('data-i18n-title');
      if (i18n[key]) {
        el.title = i18n[key];
      }
    } catch (e) {
      console.warn('Failed to apply i18n-title to element:', el, e);
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    try {
      const key = el.getAttribute('data-i18n-placeholder');
      if (i18n[key]) {
        el.placeholder = i18n[key];
      }
    } catch (e) {
      console.warn('Failed to apply i18n-placeholder to element:', el, e);
    }
  });
}
