import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../..');
const THEMES_DIR = path.join(ROOT, 'src/renderer/themes');
const attribution: Record<string, { license?: string; origin?: string }> = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/shared/themeAttribution.json'), 'utf8')
);

// "Night Owl.light.json" and "Night Owl.json" both belong to the theme "Night Owl"
const familyOf = (file: string) => file.replace(/(\.(light|dark))?\.json$/, '');

describe('theme attribution coverage', () => {
  const families = [...new Set(fs.readdirSync(THEMES_DIR).filter((f) => f.endsWith('.json')).map(familyOf))];

  it('names every bundled theme, so the notices list it', () => {
    const missing = families.filter((name) => !attribution[name]);
    expect(missing).toEqual([]);
  });

  it('gives every entry a license and an origin', () => {
    for (const [name, entry] of Object.entries(attribution)) {
      expect(entry.license, `${name} needs a license`).toBeTruthy();
      expect(['original', 'third-party'], `${name} needs an origin`).toContain(entry.origin);
    }
  });

  it('drops entries for themes that are no longer bundled', () => {
    const stale = Object.keys(attribution).filter((name) => !families.includes(name));
    expect(stale).toEqual([]);
  });
});
