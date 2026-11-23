/**
 * Document language for the language-dependent Monaco options.
 * Pure module (no Monaco, no DOM), so the priority rules can be tested without starting the editor.
 *
 * Priority: manual choice > front matter `lang:` > auto detection > UI language.
 * Exactly one source is chosen for every document; the UI language is always available as the last one.
 */

/** Auto detection looks at this many characters from the start of the document. */
export const AUTO_SAMPLE_LENGTH = 2000;
/** Below this many letters in the sample the text is too short to judge. */
export const AUTO_MIN_LETTERS = 200;
/** Kana share of the letters at or above which the text is read as Japanese. */
export const AUTO_KANA_RATIO = 0.05;

export const LANGUAGE_SOURCES = Object.freeze(['manual', 'frontMatter', 'auto', 'ui']);

const FRONT_MATTER = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;
const LANG_KEY = /^(?:lang|language)[ \t]*:[ \t]*(.*?)[ \t]*$/im;
const LETTER = /\p{L}/u;
const KANA = /[\u3040-\u30FF\u31F0-\u31FF\uFF66-\uFF9F]/u;

/** "ja-JP", "JA_jp" and "'ja'" all become "ja". Returns '' when nothing usable is left. */
export function normalizeLanguage(value) {
  if (typeof value !== 'string') return '';
  const primary = value.trim().replace(/^["']|["']$/g, '').split(/[-_]/)[0].toLowerCase();
  return /^[a-z]{2,3}$/.test(primary) ? primary : '';
}

/** The language named by `lang:` (or `language:`) in a leading YAML block, or ''. */
export function readFrontMatterLanguage(text) {
  if (typeof text !== 'string') return '';
  const block = FRONT_MATTER.exec(text);
  if (!block) return '';
  const key = LANG_KEY.exec(block[1]);
  return key ? normalizeLanguage(key[1]) : '';
}

/**
 * 'ja' when kana make up at least AUTO_KANA_RATIO of the letters in the first AUTO_SAMPLE_LENGTH characters,
 * 'other' when the text is long enough and below that, '' when it is too short to judge.
 * Latin-only text counts as 'other' (the caller falls back to the UI language), not as 'en': the UI language decides.
 */
export function detectAutoLanguage(text) {
  if (typeof text !== 'string') return '';
  let letters = 0;
  let kana = 0;
  for (const ch of text.slice(0, AUTO_SAMPLE_LENGTH)) {
    if (!LETTER.test(ch)) continue;
    letters += 1;
    if (KANA.test(ch)) kana += 1;
  }
  if (letters < AUTO_MIN_LETTERS) return '';
  return kana / letters >= AUTO_KANA_RATIO ? 'ja' : 'other';
}

/**
 * Chooses the language of a document and says where the choice came from.
 * `manual` is the per-document choice (status bar), `autoOn` the auto-detection switch, `uiLanguage` the last resort.
 * @returns {{ language: string, source: 'manual' | 'frontMatter' | 'auto' | 'ui' }}
 */
export function detectDocumentLanguage(text, { manual = '', autoOn = true, uiLanguage = 'en' } = {}) {
  const chosen = normalizeLanguage(manual);
  if (chosen) return { language: chosen, source: 'manual' };

  const declared = readFrontMatterLanguage(text);
  if (declared) return { language: declared, source: 'frontMatter' };

  if (autoOn && detectAutoLanguage(text) === 'ja') return { language: 'ja', source: 'auto' };

  return { language: normalizeLanguage(uiLanguage) || 'en', source: 'ui' };
}
