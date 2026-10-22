import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SETTINGS_REGISTRY } from '../core/settingsRegistry';
import { STORAGE_KEYS } from '../core/constants';

const RENDERER = path.resolve(__dirname, '..');
const locale = (lang: string): Record<string, string> =>
  JSON.parse(fs.readFileSync(path.join(RENDERER, 'locales', `${lang}.json`), 'utf8'));

function sources(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__' && e.name !== 'node_modules') sources(p, out);
    } else if (/\.(ts|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

describe('settings page coverage', () => {
  it('names every part of the window that can be shown or hidden, in both languages', () => {
    const en = locale('en');
    const ja = locale('ja');
    const missing: string[] = [];
    for (const item of SETTINGS_REGISTRY) {
      if (!item.visibilityKey) continue;
      for (const key of [`vis_${item.id}`, `vis_group_${item.category}`]) {
        if (!en[key]?.trim()) missing.push(`${key} (en)`);
        if (!ja[key]?.trim()) missing.push(`${key} (ja)`);
      }
    }
    expect(missing, `Add these names to the locale files (they label the "Parts of the window" list):\n${missing.join('\n')}`).toEqual([]);
  });

  it('only reads and writes storage keys that STORAGE_KEYS defines', () => {
    // A missing key reads as STORAGE_KEYS.X === undefined, so the value was stored under the key "undefined"
    const defined = new Set(Object.keys(STORAGE_KEYS));
    const undefinedKeys: string[] = [];
    for (const file of sources(RENDERER)) {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(/STORAGE_KEYS\.([A-Z0-9_]+)/g)) {
        if (!defined.has(m[1])) undefinedKeys.push(`${path.relative(RENDERER, file)}: STORAGE_KEYS.${m[1]}`);
      }
    }
    expect(undefinedKeys, `Define these in core/constants.ts:\n${undefinedKeys.join('\n')}`).toEqual([]);
  });
});

describe('window parts and the settings registry', () => {
  const COMPONENTS = path.join(RENDERER, 'components');
  const htmlKeys = new Set<string>();
  for (const f of fs.readdirSync(COMPONENTS).filter((n) => n.endsWith('.html'))) {
    for (const m of fs.readFileSync(path.join(COMPONENTS, f), 'utf8').matchAll(/data-ui="((?:hdr|edt|sbr|sys):[a-z-]+)"/g)) htmlKeys.add(m[1]);
  }
  const registryKeys = new Set(SETTINGS_REGISTRY.map((i) => i.visibilityKey).filter(Boolean) as string[]);

  it('registers every part of the window that carries a data-ui key', () => {
    const missing = [...htmlKeys].filter((k) => !registryKeys.has(k));
    expect(missing, `Add these to settingsRegistry.ts and types/settings.ts:\n${missing.join('\n')}`).toEqual([]);
  });

  it('has a part of the window for every registered key', () => {
    const dead = [...registryKeys].filter((k) => !htmlKeys.has(k));
    expect(dead, `No element carries these keys, so their eye buttons would do nothing:\n${dead.join('\n')}`).toEqual([]);
  });

  it('words the notice of every part that warns when hidden, in both languages', () => {
    const en = locale('en');
    const ja = locale('ja');
    const missing: string[] = [];
    for (const item of SETTINGS_REGISTRY) {
      if (!item.hideNoticeKey) continue;
      for (const key of [item.hideNoticeKey, 'hide_notice_restore']) {
        if (!en[key]?.trim()) missing.push(`${key} (en)`);
        if (!ja[key]?.trim()) missing.push(`${key} (ja)`);
      }
    }
    expect(missing, `Add these to the locale files:\n${missing.join('\n')}`).toEqual([]);
  });
});
