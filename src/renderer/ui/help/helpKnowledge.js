/**
 * The built-in help knowledge: what the app can do, taken from the generated guide (the UI blueprint, ADR-11).
 *
 * The chat assistant answers questions about VectOrEdit ("what is Embedding?", "can I change the font?") from this text
 * and not from guesses: the best matching cards of the guide are put in front of the question, with an instruction to
 * answer from them. Nothing about the user's documents is added; the cards are the same text the Guide shows.
 */
import helpJa from '../../generated/ui_help.ja.json';
import helpEn from '../../generated/ui_help.en.json';
import { currentLang } from '../../core/i18n.js';

import lexicon from './helpLexicon.json';

// Words that mean the same thing for this app, and the phrases that mark a question about the app. They are data
// (helpLexicon.json), not code: a new language or word is a new entry in that file.
const SYNONYMS = lexicon.synonyms;

// A question about the app (and not, say, a request to rewrite a paragraph) mentions the app or asks "what / can I / how"
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const HELP_INTENT = new RegExp(`(${lexicon.intent.map(escapeRegex).join('|')})`, 'i');

// Runs of kana and kanji (U+3040-30FF, U+3400-9FFF), built from code points
const range = (from, to) => `${String.fromCharCode(from)}-${String.fromCharCode(to)}`;
const CJK_RUN = new RegExp(`[${range(0x3040, 0x30ff)}${range(0x3400, 0x9fff)}]+`, 'g');

const MIN_SCORE = 4;

const cache = new Map();

function normalize(text) {
  return String(text ?? '').normalize('NFKC').toLowerCase();
}

/** Tokens of a text: words of Latin letters, and overlapping pairs of characters for Japanese. */
function tokenize(text) {
  const tokens = new Set();
  const s = normalize(text);
  for (const word of s.match(/[a-z0-9][a-z0-9-]+/g) ?? []) tokens.add(word);
  for (const run of s.match(CJK_RUN) ?? []) {
    if (run.length === 1) tokens.add(run);
    for (let i = 0; i < run.length - 1; i += 1) tokens.add(run.slice(i, i + 2));
  }
  return tokens;
}

/** The synonym groups that a text touches, as tokens ("group:n"), so related words meet. */
function groupsOf(text) {
  const s = normalize(text);
  const found = new Set();
  SYNONYMS.forEach((group, index) => {
    if (group.some((word) => s.includes(normalize(word)))) found.add(`group:${index}`);
  });
  return found;
}

/** Plain text of a piece of generated HTML (the guide only uses simple inline tags and a few entities). */
function plain(html) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/[\s　]+/g, ' ')
    .trim();
}

function corpusFor(lang) {
  if (cache.has(lang)) return cache.get(lang);
  const guide = lang === 'ja' ? helpJa : helpEn;
  const entries = [];
  for (const [area, data] of Object.entries(guide.areas)) {
    // The generated tables are plain: <tr ...><td ...>text</td>...</tr>
    for (const [, rowHtml] of data.html.matchAll(/<tr[^>]*>([^]*?)<\/tr>/g)) {
      const cells = [...rowHtml.matchAll(/<td[^>]*>([^]*?)<\/td>/g)].map((m) => plain(m[1]));
      if (cells.length < 2) continue;
      const [title, ...rest] = cells;
      const text = [title, ...rest].filter(Boolean).join(' / ');
      entries.push({
        area,
        areaTitle: data.title,
        title,
        text,
        tokens: new Set([...tokenize(text), ...groupsOf(text)]),
        titleTokens: new Set([...tokenize(title), ...groupsOf(title)])
      });
    }
  }
  cache.set(lang, entries);
  return entries;
}

/** The best matching cards of the guide for a question. */
export function searchHelp(query, { limit = 6, lang = currentLang } = {}) {
  const queryTokens = new Set([...tokenize(query), ...groupsOf(query)]);
  if (!queryTokens.size) return [];
  const scored = corpusFor(lang === 'ja' ? 'ja' : 'en').map((entry) => {
    let score = 0;
    for (const token of queryTokens) {
      if (entry.titleTokens.has(token)) score += token.startsWith('group:') ? 5 : 3;
      else if (entry.tokens.has(token)) score += token.startsWith('group:') ? 3 : 1;
    }
    return { entry, score };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

export function isHelpQuestion(prompt) {
  return HELP_INTENT.test(String(prompt ?? ''));
}

const PREFACE = [
  'You are the built-in help of VectOrEdit, a desktop editor with vector (embedding) search and an optional cloud LLM.',
  'Answer the user\'s question about the app from the guide excerpts below, in the language of the question, briefly and concretely.',
  'Concepts: "Embedding" is the local vector model that finds similar knowledge by meaning; "LLM" is the cloud model (for example Gemini) for chat and rewriting; they are two independent switches (EMBED and LLM) in the header and the sidebar.',
  'Use only what the excerpts say. If they do not cover the question, say that you do not know and point to Settings or the Guide button; never invent buttons, menus or settings.'
].join('\n');

/**
 * The prompt for the LLM: when the question is about the app and the guide has matching cards, they go in front of it.
 * Any other prompt (a text to rewrite, a general question) is returned unchanged.
 */
export function withHelpContext(prompt) {
  if (!isHelpQuestion(prompt)) return prompt;
  const hits = searchHelp(prompt);
  if (!hits.length || hits[0].score < MIN_SCORE) return prompt;
  const excerpts = hits.map(({ entry }, i) => `[${i + 1}] (${entry.areaTitle}) ${entry.text}`).join('\n');
  return `${PREFACE}\n\nGuide excerpts:\n${excerpts}\n\nQuestion:\n${prompt}`;
}
