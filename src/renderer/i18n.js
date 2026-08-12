export let i18n = {};
export let currentLang = 'en';

export async function loadLocales() {
  try {
    const savedLang = localStorage.getItem('app_lang');
    const systemLang = (navigator.language || 'en').split('-')[0];
    const lang = savedLang || systemLang;
    currentLang = lang;
    
    const res = await fetch(`./locales/${lang}.json`);
    if (!res.ok) throw new Error(`Locale ${lang} not found`);
    i18n = await res.json();
    applyI18n();
  } catch (err) {
    console.warn(`Preferred locale not found, falling back to English.`, err);
    try {
      currentLang = 'en';
      const resFallback = await fetch('./locales/en.json');
      i18n = await resFallback.json();
      applyI18n();
    } catch (e) {
      console.error('Failed to load fallback locale:', e);
    }
  }
}

export async function changeLanguage(langCode) {
  localStorage.setItem('app_lang', langCode);
  await loadLocales();
}

export function t(key, params = {}) {
  const template = i18n[key] ?? key;
  return template.replace(/{{\s*(\w+)\s*}}/g, (_, p) => {
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
}
