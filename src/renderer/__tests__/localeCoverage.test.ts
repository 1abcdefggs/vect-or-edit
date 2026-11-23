import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// A text that has a Japanese entry but no English one stays in Japanese after the language is switched to English:
// the page only redraws a text when the new dictionary has its key (the first-run setup showed a Japanese line under
// "Save location and folder name"). These tests keep the two dictionaries and the page markup in step.
const rendererDir = path.resolve(__dirname, '..');
const locales = {
  en: JSON.parse(fs.readFileSync(path.join(rendererDir, 'locales', 'en.json'), 'utf8')) as Record<string, string>,
  ja: JSON.parse(fs.readFileSync(path.join(rendererDir, 'locales', 'ja.json'), 'utf8')) as Record<string, string>,
};

// Keys used in the markup that neither dictionary has yet (the element keeps its English default text); fix them, then remove them here
const KNOWN_MARKUP_GAPS = new Set<string>();
// Language names in the UI language: the English side falls back to the registry's English names in code
const JAPANESE_ONLY_PREFIX = 'content_lang_';

function markupKeys(): Array<{ key: string; file: string }> {
  const files = ['index.html', ...fs.readdirSync(path.join(rendererDir, 'components')).filter((f) => f.endsWith('.html')).map((f) => `components/${f}`)];
  const found: Array<{ key: string; file: string }> = [];
  for (const file of files) {
    const text = fs.readFileSync(path.join(rendererDir, file), 'utf8');
    for (const m of text.matchAll(/data-i18n(?:-title|-placeholder|-aria)?="([^"]+)"/g)) found.push({ key: m[1], file });
  }
  return found;
}

describe('locale coverage', () => {
  it('has an English text for every key the markup uses', () => {
    const missing = markupKeys().filter(({ key }) => !(key in locales.en) && !KNOWN_MARKUP_GAPS.has(key));
    expect(missing.map(({ key, file }) => `${key} (${file})`)).toEqual([]);
  });

  it('has an English text for every Japanese key, except the language names', () => {
    const missing = Object.keys(locales.ja).filter((key) => !(key in locales.en) && !key.startsWith(JAPANESE_ONLY_PREFIX));
    expect(missing).toEqual([]);
  });

  it('lists only gaps that still exist', () => {
    for (const key of KNOWN_MARKUP_GAPS) {
      expect(key in locales.en || key in locales.ja, `${key} is no longer a gap: remove it from the list`).toBe(false);
    }
  });
});
