import { setLedStatus } from './statusManager';
import { STORAGE_KEYS, DEFAULTS } from './constants';
import jaLocale from '../locales/ja.json';
import enLocale from '../locales/en.json';

const LOCALES: Record<string, Record<string, string>> = {
  ja: jaLocale as Record<string, string>,
  en: enLocale as Record<string, string>
};

/**
 * Saved language; before the user picks one, the OS language when it is Japanese, else English (DEFAULTS.APP_LANG).
 * First-run setup starts with this language selected.
 */
function resolveLang(): string {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.APP_LANG) : null;
  if (saved && LOCALES[saved]) return saved;
  const osLang = typeof navigator !== 'undefined' ? (navigator.language || '').split('-')[0] : '';
  return osLang === 'ja' ? 'ja' : DEFAULTS.APP_LANG;
}

const initialLang = resolveLang();

export let currentLang: string = initialLang;
export let i18n: Record<string, string> = LOCALES[initialLang] || LOCALES.ja;

export async function loadLocales(): Promise<void> {
  try {
    const lang = resolveLang();
    currentLang = lang;
    // Keeps the document language in step with the UI language; the browser uses it to pick CJK fallback fonts.
    document.documentElement.lang = lang;

    i18n = LOCALES[lang] || LOCALES.en;
    console.log(`[i18n] Applying locale: ${lang} (keys: ${Object.keys(i18n).length})`);
    applyI18n();
    setLedStatus('i18n', true, `3. LOCALE: ${lang}.json loaded`);
    window.dispatchEvent(new CustomEvent('app:languageChanged', { detail: { lang } }));
  } catch (err) {
    console.error('[i18n] Failed to apply locale:', err);
    currentLang = 'en';
    i18n = LOCALES.en;
    applyI18n();
    setLedStatus('i18n', 'error', `3. LOCALE: Error`);
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

/**
 * Shows a settings row's description as a bullet list, one bullet per sentence.
 * Sentences end with "。" (ja) or ". " (en); a bullet drops the full stop at its end.
 */
function renderAsList(el: HTMLElement, text: string): void {
  const sentences = text.split(/。|(?<=[.!?])\s+/).map((s) => s.trim().replace(/[.。]$/, '')).filter(Boolean);
  const list = document.createElement('ul');
  list.className = 'desc-list';
  for (const sentence of sentences.length ? sentences : [text]) {
    const item = document.createElement('li');
    item.textContent = sentence;
    list.appendChild(item);
  }
  el.replaceChildren(list);
}

export function applyI18n(): void {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => {
    try {
      const key = el.getAttribute('data-i18n');
      if (key && i18n[key]) {
        if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
          el.placeholder = i18n[key];
        } else if (el.classList.contains('setting-desc') && el.closest('.setting-item') && !el.hasAttribute('data-no-list')) {
          renderAsList(el, i18n[key]);
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
