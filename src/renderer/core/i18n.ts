import { setLedStatus } from './statusManager';
import { STORAGE_KEYS, DEFAULTS } from './constants';
import jaLocale from '../locales/ja.json';
import enLocale from '../locales/en.json';

const LOCALES: Record<string, Record<string, string>> = {
  ja: jaLocale as Record<string, string>,
  en: enLocale as Record<string, string>
};

export let i18n: Record<string, string> = {};
export let currentLang: string = DEFAULTS.APP_LANG;

export async function loadLocales(): Promise<void> {
  try {
    const savedLang = localStorage.getItem(STORAGE_KEYS.APP_LANG);
    const systemLang = (navigator.language || DEFAULTS.APP_LANG).split('-')[0];
    const lang = (savedLang || systemLang) === 'ja' ? 'ja' : 'en';
    currentLang = lang;
    
    i18n = LOCALES[lang] || LOCALES.en;
    applyI18n();
    setLedStatus('i18n', true, `3. LOCALE: ${lang}.json loaded`);
    window.dispatchEvent(new CustomEvent('app:languageChanged', { detail: { lang } }));
  } catch (err) {
    console.error('Failed to apply locale:', err);
    currentLang = 'en';
    i18n = LOCALES.en;
    applyI18n();
    setLedStatus('i18n', false, `3. LOCALE: Error`);
  }
}

export async function changeLanguage(langCode: string): Promise<void> {
  localStorage.setItem(STORAGE_KEYS.APP_LANG, langCode);
  await loadLocales();
}

export function t(key: string, params: Record<string, any> = {}): string {
  const template = i18n[key] ?? key;
  return String(template).replace(/\{{1,2}\s*(\w+)\s*\}{1,2}/g, (_, p) => {
    return params[p] !== undefined ? String(params[p]) : '';
  });
}

export function applyI18n(): void {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => {
    try {
      const key = el.getAttribute('data-i18n');
      if (key && i18n[key]) {
        if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
          el.placeholder = i18n[key];
        } else {
          el.textContent = i18n[key];
        }
      }
    } catch (e) {
      console.warn('Failed to apply i18n to element:', el, e);
    }
  });

  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach(el => {
    try {
      const key = el.getAttribute('data-i18n-title');
      if (key && i18n[key]) {
        el.title = i18n[key];
      }
    } catch (e) {
      console.warn('Failed to apply i18n-title to element:', el, e);
    }
  });

  document.querySelectorAll<HTMLElement>('[data-i18n-placeholder]').forEach(el => {
    try {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key && i18n[key] && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
        el.placeholder = i18n[key];
      }
    } catch (e) {
      console.warn('Failed to apply i18n-placeholder to element:', el, e);
    }
  });
}
