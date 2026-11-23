import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { settingRowClasses, settingTextMarkup } from '../ui/settings/settingsStaticMarkup';

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

  it('puts an inactive reason inside the row text, hidden, between the description and the jump link', () => {
    const markup = settingTextMarkup({
      labelKey: 'l', labelText: 'L', descKey: 'd', descText: 'D',
      reason: { id: 'r1', key: 'rk', text: 'R', ui: 'set:r' },
      jump: { key: 'jk', text: 'J', tab: 'tabX' }
    });
    expect(markup).toContain('<div class="setting-reason" id="r1" data-ui="set:r" hidden data-i18n="rk">R</div>');
    expect(markup.indexOf('data-i18n="d"')).toBeLessThan(markup.indexOf('id="r1"'));
    expect(markup.indexOf('id="r1"')).toBeLessThan(markup.indexOf('data-i18n="jk"'));
    expect(settingTextMarkup({ labelKey: 'l', labelText: 'L', descKey: 'd', descText: 'D' })).not.toContain('setting-reason');
  });

  it('keeps the Autosave reasons inside their rows, with the ids the lock code looks up', () => {
    for (const id of ["autoSaveOffReason", "autoSaveDelayReason", "tooltipOffReason", "llmSwitchReason"]) {
      expect(html).toContain(`data-reason-id="${id}"`);
      expect(html).not.toMatch(new RegExp(`<div[^>]*\\sid="${id}"`));
    }
  });

  it('never repeats a card heading as the label of the first row under it', () => {
    const readLocale = (name: string): Record<string, string> =>
      JSON.parse(fs.readFileSync(path.join(RENDERER, 'locales', `${name}.json`), 'utf8'));
    const locales = [readLocale('ja'), readLocale('en')];
    // Each chunk starts at a card heading and runs to the next one
    const chunks = html.split(/(?=<h4 data-card-heading)/).slice(1);
    let checked = 0;
    for (const chunk of chunks) {
      const headingKey = /data-key="([^"]+)"/.exec(chunk)?.[1];
      const rowKey = /data-label-key="([^"]+)"/.exec(chunk)?.[1];
      if (!headingKey || !rowKey) continue;
      checked++;
      expect(rowKey, `heading ${headingKey} and its first row share a key`).not.toBe(headingKey);
      for (const dict of locales) {
        if (dict[headingKey] && dict[rowKey]) {
          expect(dict[rowKey], `heading ${headingKey} and first row ${rowKey} read the same`).not.toBe(dict[headingKey]);
        }
      }
    }
    expect(checked).toBeGreaterThan(5);
  });
});
