import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Every id the settings scripts look up with getElementById must exist in a renderer HTML component.
// A missing id is a silent no-op at runtime, so a new one is a failure here.
const rendererDir = path.resolve(__dirname, '..');
const settingsDir = path.join(rendererDir, 'ui', 'settings');

// Known gaps (2026-11-09): looked up by settings scripts, absent from the markup.
// Each one is guarded by a null check, so the gap is silent. Remove an entry when its markup or its lookup is removed.
const KNOWN_MISSING = new Set([
  'btnLangToggle',
  'langToggleLabel',
  'embeddingSourceCard',
  'embSrcActiveBadge',
  'embSrcLlmWarning',
]);

function readAll(dir: string, exts: string[]): string {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && exts.some((x) => e.name.endsWith(x)))
    .map((e) => fs.readFileSync(path.join(dir, e.name), 'utf8'))
    .join('\n');
}

describe('settings script element ids', () => {
  const scripts = readAll(settingsDir, ['.js', '.ts']);
  const markup = readAll(path.join(rendererDir, 'components'), ['.html']);
  const looked = new Set([...scripts.matchAll(/getElementById\(\s*['"]([A-Za-z0-9_-]+)['"]\s*\)/g)].map((m) => m[1]));

  it('finds the ids in the markup, except the known gaps', () => {
    const missing = [...looked]
      .filter((id) => !markup.includes(`id="${id}"`))
      .filter((id) => !KNOWN_MISSING.has(id))
      .sort();
    expect(missing).toEqual([]);
  });

  it('keeps the known-gap list honest: each listed id is still looked up and still absent', () => {
    for (const id of KNOWN_MISSING) {
      expect(looked.has(id), `${id} is no longer looked up; remove it from KNOWN_MISSING`).toBe(true);
      expect(markup.includes(`id="${id}"`), `${id} now exists in markup; remove it from KNOWN_MISSING`).toBe(false);
    }
  });
});
