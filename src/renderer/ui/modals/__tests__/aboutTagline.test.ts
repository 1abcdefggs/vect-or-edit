import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readJson = (relative: string) => JSON.parse(readFileSync(resolve(process.cwd(), relative), 'utf8'));

describe('About tagline', () => {
  const pkg = readJson('package.json');
  const en = readJson('src/renderer/locales/en.json');
  const ja = readJson('src/renderer/locales/ja.json');

  it('keeps the English tagline in package.json and en.json identical', () => {
    expect(en.about_tagline).toBe(pkg.description);
  });

  it('has a non-empty Japanese tagline', () => {
    expect(typeof ja.about_tagline).toBe('string');
    expect(ja.about_tagline.length).toBeGreaterThan(0);
  });
});
