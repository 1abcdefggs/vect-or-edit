import { setLedStatus, led } from './statusManager';
import { readStorage, writeStorage } from './storage.js';
import { STORAGE_KEYS, DEFAULTS } from './constants';
import { formatTipText } from './tipFormat';
import jaLocale from '../locales/ja.json';
import enLocale from '../locales/en.json';
import { GEAR_TOKEN, withGearIcons } from './gearToken';

const LOCALES: Record<string, Record<string, string>> = {
  ja: jaLocale as Record<string, string>,
  en: enLocale as Record<string, string>
};

/**
 * Saved language; before the user picks one, the OS language when it is Japanese, else English (DEFAULTS.APP_LANG).
 * First-run setup starts with this language selected.
 */
function resolveLang(): string {
  const saved = typeof localStorage !== 'undefined' ? readStorage(STORAGE_KEYS.APP_LANG) : null;
  if (saved && LOCALES[saved]) return saved;
  const osLang = typeof navigator !== 'undefined' ? (navigator.language || '').split('-')[0] : '';
  return osLang === 'ja' ? 'ja' : DEFAULTS.APP_LANG;
}

const initialLang = resolveLang();

export let currentLang: string = initialLang;
/**
 * Active dictionary: the chosen language layered over English, so a key missing from the chosen language
 * falls back to English everywhere (t(), applyI18n and direct lookups alike).
 */
function composeDictionary(lang: string): Record<string, string> {
  const chosen = LOCALES[lang] || LOCALES.en;
  return { ...LOCALES.en, ...chosen };
}

export let i18n: Record<string, string> = composeDictionary(initialLang);

export async function loadLocales(): Promise<void> {
  try {
    const lang = resolveLang();
    currentLang = lang;
    // Keeps the document language in step with the UI language; the browser uses it to pick CJK fallback fonts.
    document.documentElement.lang = lang;

    i18n = composeDictionary(lang);
    console.log(`[i18n] Applying locale: ${lang} (keys: ${Object.keys(i18n).length})`);
    applyI18n();
    setLedStatus('i18n', true, led('led_i18n_loaded', { lang }));
    window.dispatchEvent(new CustomEvent('app:languageChanged', { detail: { lang } }));
  } catch (err) {
    console.error('[i18n] Failed to apply locale:', err);
    currentLang = 'en';
    i18n = LOCALES.en;
    applyI18n();
    setLedStatus('i18n', 'error', led('led_i18n_error'));
  }
}

export async function changeLanguage(langCode: string): Promise<void> {
  try {
    writeStorage(STORAGE_KEYS.APP_LANG, langCode);
  } catch (err) {
    // The language still applies for this session; only the choice for the next start is lost
    console.warn('[i18n] Could not save the language choice:', err);
  }
  await loadLocales();
}

function fill(template: string, params: Record<string, any>): string {
  return String(template).replace(/\{{1,2}\s*(\w+)\s*\}{1,2}/g, (_, p) => {
    return params[p] !== undefined ? String(params[p]) : '';
  });
}

export function t(key: string, params: Record<string, any> = {}): string {
  return fill(i18n[key] ?? key, params);
}

/** Where the log language setting is read from (registered by the console module, which owns the settings store). */
let logLanguageSource: () => string | undefined = () => undefined;
export function setLogLanguageSource(source: () => string | undefined): void { logLanguageSource = source; }

/** Text for the system log: English by default; the log language setting 'ui' follows the UI language instead. */
export function tLog(key: string, params: Record<string, any> = {}): string {
  return logLanguageSource() === 'ui' ? t(key, params) : tEn(key, params);
}

/** English text whatever the UI language is: the system log is always written in English, so a pasted log reads the same everywhere. */
export function tEn(key: string, params: Record<string, any> = {}): string {
  return fill(LOCALES.en[key] ?? key, params);
}

/**
 * Parses [link text](https://...) into safe <a> elements.
 * Returns a DocumentFragment containing text and links.
 */
function linkify(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const re = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
  let last = 0;
  let match;

  while ((match = re.exec(text)) !== null) {
    // Append text before the link
    if (match.index > last) {
      frag.append(withGearIcons(text.slice(last, match.index)));
    }

    // Create and append the link
    const a = document.createElement('a');
    a.href = match[2];
    a.textContent = match[1];
    a.target = '_blank';
    // Opens in the OS browser (the main process sends the URL to shell.openExternal, so no Referer header is sent);
    // the attributes keep the page from leaking its address or window if the link is ever opened another way
    a.rel = 'noopener noreferrer';
    a.referrerPolicy = 'no-referrer';
    a.title = t('tip_external_link');
    // The class draws the external-link icon after the text
    a.className = 'settings-link--inline settings-link--external';
    frag.append(a);

    last = re.lastIndex;
  }

  // Append remaining text
  if (last < text.length) {
    frag.append(withGearIcons(text.slice(last)));
  }

  return frag;
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
    item.append(linkify(sentence));
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
        } else if (i18n[key].includes(GEAR_TOKEN)) {
          el.replaceChildren(withGearIcons(i18n[key]));
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
        el.title = formatTipText(key, i18n[key]);
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

  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach(el => {
    try {
      const key = el.getAttribute('data-i18n-aria');
      if (key && i18n[key]) {
        el.setAttribute('aria-label', i18n[key]);
      }
    } catch (e) {
      console.warn('Failed to apply i18n-aria to element:', el, e);
    }
  });
}
