import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Keeps settings-layout.json in step with the markup in settingsModal.html.
// Until the page is generated from the JSON, the markup stays the content source and this test is the guard.
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const rendererDir = path.join(repoRoot, 'src', 'renderer');

interface LayoutTab {
  tab: string;
  icon: string;
  labelKey: string;
  titleKey: string;
  cards: string[];
}

const layout: { version: number; tabs: LayoutTab[] } = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'ui', 'settings', 'settings-layout.json'), 'utf8'),
);
const html = fs.readFileSync(path.join(rendererDir, 'components', 'settingsModal.html'), 'utf8');
const iconNames = fs.readFileSync(path.join(repoRoot, 'scripts', 'icon-font', 'icon-names.txt'), 'utf8')
  .split(/\r?\n/)
  .filter(Boolean);
const locales = {
  en: JSON.parse(fs.readFileSync(path.join(rendererDir, 'locales', 'en.json'), 'utf8')) as Record<string, string>,
  ja: JSON.parse(fs.readFileSync(path.join(rendererDir, 'locales', 'ja.json'), 'utf8')) as Record<string, string>,
};

// Tab buttons in the markup, in order: data-tab, icon glyph name, label key, title key
function markupTabs() {
  const buttons = [...html.matchAll(/<button class="settings-tab-btn[^"]*" data-tab="(\w+)"([^>]*)><span class="material-symbols-outlined settings-tab-icon"[^>]*>([^<]+)<\/span><span class="settings-tab-label" data-i18n="([^"]+)"/g)];
  return buttons.map((m) => {
    const titleKey = /data-i18n-title="([^"]+)"/.exec(m[2])?.[1] ?? '';
    return { tab: m[1], icon: m[3].trim(), labelKey: m[4], titleKey };
  });
}

// Headed cards per tab content block, in order: the data-key of each card heading
function markupCards(): Record<string, string[]> {
  const starts = [...html.matchAll(/id="(tab\w+)" class="settings-tab-content/g)];
  const end = html.indexOf('<aside id="settingsHelpPane"');
  const result: Record<string, string[]> = {};
  starts.forEach((m, i) => {
    const from = m.index ?? 0;
    const to = i + 1 < starts.length ? (starts[i + 1].index ?? end) : end;
    const block = html.slice(from, to);
    result[m[1]] = [...block.matchAll(/<h4 data-card-heading[^>]*data-key="([^"]+)"/g)].map((h) => h[1]);
  });
  return result;
}

describe('settings-layout.json', () => {
  it('is version 1 and lists each tab once', () => {
    expect(layout.version).toBe(1);
    const names = layout.tabs.map((t) => t.tab);
    expect(new Set(names).size).toBe(names.length);
  });

  it('lists the tabs in the same order, with the same icon and keys, as the markup', () => {
    const fromMarkup = markupTabs();
    expect(fromMarkup.map(({ tab, icon, labelKey, titleKey }) => ({ tab, icon, labelKey, titleKey })))
      .toEqual(layout.tabs.map(({ tab, icon, labelKey, titleKey }) => ({ tab, icon, labelKey, titleKey })));
  });

  it('lists the headed cards of each tab in the same order as the markup', () => {
    const cards = markupCards();
    for (const tab of layout.tabs) {
      expect(cards[tab.tab] ?? [], tab.tab).toEqual(tab.cards);
    }
  });

  it('has no card key in two places', () => {
    const keys = layout.tabs.flatMap((t) => t.cards);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('uses only icon names that the bundled icon font contains', () => {
    for (const tab of layout.tabs) {
      expect(iconNames, tab.icon).toContain(tab.icon);
    }
  });

  it('has a translation for every tab label and title in both locales', () => {
    for (const tab of layout.tabs) {
      for (const lang of ['en', 'ja'] as const) {
        expect(locales[lang][tab.labelKey], `${lang}:${tab.labelKey}`).toBeTruthy();
        expect(locales[lang][tab.titleKey], `${lang}:${tab.titleKey}`).toBeTruthy();
      }
    }
  });
});
