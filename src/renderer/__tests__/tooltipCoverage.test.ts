import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Every control must explain itself on hover. The tooltip text lives in the locale files and is applied through
 * `data-i18n-title`; a control that cannot carry one says why with `data-tip-exempt` (a sibling label or card names it)
 * or `data-tip-dynamic` (code writes the live text).
 */
const RENDERER = path.resolve(__dirname, '..');
const COMPONENTS = path.join(RENDERER, 'components');

const htmlFiles = fs.readdirSync(COMPONENTS).filter((f) => f.endsWith('.html'));
const read = (p: string) => fs.readFileSync(p, 'utf8');
const locale = (lang: string): Record<string, string> => JSON.parse(read(path.join(RENDERER, 'locales', `${lang}.json`)));

const CONTROL_TAG = /<(button|select|input|textarea|a|summary)\b([^>]*)>/gis;
const ROLE_BUTTON = /<(div|span|li|img)\b([^>]*\brole="button"[^>]*)>/gis;
const ANY_TAG = /<[a-z0-9]+\b[^>]*>/gis;

const TIP_SOURCE = /data-i18n-title=|data-instant-tooltip=|data-tip-exempt=|data-tip-dynamic=/;

function lineOf(src: string, index: number): number {
  return src.slice(0, index).split('\n').length;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__' && e.name !== 'node_modules') walk(p, out);
    } else if (/\.(ts|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

describe('tooltip coverage (components)', () => {
  it('gives every control a tooltip source', () => {
    const missing: string[] = [];
    for (const file of htmlFiles) {
      const src = read(path.join(COMPONENTS, file));
      for (const re of [CONTROL_TAG, ROLE_BUTTON]) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(src))) {
          if (/type="hidden"/.test(m[2])) continue;
          if (!TIP_SOURCE.test(m[2])) {
            const id = m[2].match(/\bid="([^"]+)"/)?.[1] ?? '';
            missing.push(`${file}:${lineOf(src, m.index)} <${m[1]}${id ? ` id="${id}"` : ''}>`);
          }
        }
      }
    }
    expect(missing, `Controls without data-i18n-title / data-tip-exempt / data-tip-dynamic:\n${missing.join('\n')}`).toEqual([]);
  });

  it('keeps tooltip text in the locale files, not in a title attribute', () => {
    const plain: string[] = [];
    for (const file of htmlFiles) {
      const src = read(path.join(COMPONENTS, file));
      ANY_TAG.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = ANY_TAG.exec(src))) {
        if (/\stitle="/.test(m[0]) && !/data-tip-dynamic=/.test(m[0])) plain.push(`${file}:${lineOf(src, m.index)}`);
      }
    }
    expect(plain, `Use data-i18n-title instead of title=:\n${plain.join('\n')}`).toEqual([]);
  });

  it('defines every data-i18n-title key in both languages', () => {
    const en = locale('en');
    const ja = locale('ja');
    const problems: string[] = [];
    for (const file of htmlFiles) {
      const src = read(path.join(COMPONENTS, file));
      for (const m of src.matchAll(/data-i18n-title="([^"]+)"/g)) {
        for (const [lang, dict] of [['en', en], ['ja', ja]] as const) {
          if (!dict[m[1]]?.trim()) problems.push(`${file}: ${m[1]} missing in ${lang}.json`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

describe('tooltip locale entries', () => {
  const en = locale('en');
  const ja = locale('ja');
  const placeholders = (s: string) => [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();

  it('has every tip_ key in both languages with the same placeholders', () => {
    const keys = new Set([...Object.keys(en), ...Object.keys(ja)].filter((k) => k.startsWith('tip_')));
    const problems: string[] = [];
    for (const k of keys) {
      if (!en[k] || !ja[k]) problems.push(`${k}: missing in ${!en[k] ? 'en' : 'ja'}.json`);
      else if (placeholders(en[k]).join() !== placeholders(ja[k]).join()) problems.push(`${k}: placeholders differ`);
    }
    expect(problems).toEqual([]);
  });
});

describe('tooltip coverage (code)', () => {
  it('does not assign a literal string to .title', () => {
    const offenders: string[] = [];
    for (const file of walk(RENDERER)) {
      const src = read(file);
      src.split('\n').forEach((line, i) => {
        // A template that starts from t('...') is fine: its text still comes from the locale files
        if (/\b\w+\.title\s*=\s*['"`]/.test(line) && !/\bt\('/.test(line)) offenders.push(`${path.relative(RENDERER, file)}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders, `Use t('tip_...') for tooltip text:\n${offenders.join('\n')}`).toEqual([]);
  });
});
