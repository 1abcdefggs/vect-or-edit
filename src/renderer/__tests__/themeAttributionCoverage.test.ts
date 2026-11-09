import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Every theme file carries its own "attribution" object. The notices and the About dialog read it from there.
const ROOT = path.resolve(__dirname, '../../..');
const THEMES_DIR = path.join(ROOT, 'src/renderer/themes');

// "Night Owl.light.json" and "Night Owl.json" both belong to the theme "Night Owl"
const familyOf = (file: string) => file.replace(/(\.(light|dark))?\.json$/, '');

const files = fs.readdirSync(THEMES_DIR).filter((f) => f.endsWith('.json')).sort();
const read = (file: string) => JSON.parse(fs.readFileSync(path.join(THEMES_DIR, file), 'utf8'));

describe('theme attribution coverage', () => {
  it('every theme file has an attribution object', () => {
    const missing = files.filter((f) => !read(f).attribution);
    expect(missing).toEqual([]);
  });

  it('gives every attribution a licence and an origin', () => {
    for (const f of files) {
      const a = read(f).attribution;
      if (!a) continue;
      expect(a.license, `${f} needs a license`).toBeTruthy();
      expect(['original', 'third-party'], `${f} needs an origin`).toContain(a.origin);
      expect(a.note, `${f} needs a note`).toBeTruthy();
    }
  });

  it('gives both faces of a family the same licence, and a third-party family a copyright line', () => {
    const byFamily = new Map<string, Array<{ file: string; a: { license: string; origin: string; copyright?: string } }>>();
    for (const f of files) {
      const a = read(f).attribution;
      if (!a) continue;
      const family = familyOf(f);
      byFamily.set(family, [...(byFamily.get(family) ?? []), { file: f, a }]);
    }
    for (const [family, entries] of byFamily) {
      const licences = new Set(entries.map((e) => e.a.license));
      expect(licences.size, `${family} faces disagree on the licence`).toBe(1);
      for (const e of entries) {
        if (e.a.origin === 'third-party') expect(e.a.copyright, `${e.file} needs a copyright line`).toBeTruthy();
      }
    }
  });
});
