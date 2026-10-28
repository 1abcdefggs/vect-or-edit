import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { settingRowClasses } from '../ui/settings/settingsStaticMarkup';

const RENDERER = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(RENDERER, 'components', 'settingsModal.html'), 'utf8');

describe('settings row frames', () => {
  it('gives a plain row the base class and a stack row the stack variant', () => {
    expect(settingRowClasses('')).toEqual(['setting-item']);
    expect(settingRowClasses(undefined)).toEqual(['setting-item']);
    expect(settingRowClasses('stack')).toEqual(['setting-item', 'setting-item--stack']);
  });

  it('marks every row in the settings page with data-setting-row, and no row keeps a hand-written setting-item class', () => {
    const rows = html.match(/<div[^>]*data-setting-row[^>]*>/g) ?? [];
    expect(rows.length).toBeGreaterThan(40);
    expect(html).not.toMatch(/<div class="setting-item[ "]/);
  });
});
