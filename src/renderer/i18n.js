import { setLedStatus } from './statusManager.js';
import { STORAGE_KEYS, DEFAULTS } from './constants.js';

export let i18n = {};
export let currentLang = DEFAULTS.APP_LANG;

export async function loadLocales() {
  try {
    const savedLang = localStorage.getItem(STORAGE_KEYS.APP_LANG);
    const systemLang = (navigator.language || DEFAULTS.APP_LANG).split('-')[0];
    const lang = savedLang || systemLang;
    currentLang = lang;
    
    const res = await fetch(`./locales/${lang}.json`);
    if (!res.ok) throw new Error(`Locale ${lang} not found`);
    i18n = await res.json();
    applyI18n();
    setLedStatus('i18n', true, `5. Locale: ${lang}.json loaded`);
  } catch (err) {
    console.warn(`Preferred locale not found, falling back to English.`, err);
    try {
      currentLang = 'en';
      const resFallback = await fetch('./locales/en.json');
      i18n = await resFallback.json();
      applyI18n();
      setLedStatus('i18n', true, `5. Locale: en.json (fallback)`);
    } catch (e) {
      console.error('Failed to load fallback locale:', e);
    }
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
    const key = el.getAttribute('data-i18n');
    if (i18n[key]) {
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        el.placeholder = i18n[key];
      } else {
        el.textContent = i18n[key];
      }
    }
  });

  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (i18n[key]) {
      el.title = i18n[key];
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (i18n[key]) {
      el.placeholder = i18n[key];
    }
  });
}
