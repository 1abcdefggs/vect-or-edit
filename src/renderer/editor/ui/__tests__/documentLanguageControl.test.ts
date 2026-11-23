import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../tabs/tabState.js', () => ({ getActiveTab: () => null }));
vi.mock('../../../core/i18n.js', () => ({
  t: (key: string, params?: { code?: string }) => (key === 'doc_lang_label_auto' ? `${params?.code} · auto` : key)
}));
vi.mock('../../options/documentLanguageSync.js', () => ({ setManualLanguageProvider: () => {}, requestLanguageCheck: () => {} }));

import { renderLanguageControl } from '../documentLanguageControl.js';

function fakeItem(language: string) {
  const attrs: Record<string, string> = {};
  const classes = new Set<string>();
  return {
    dataset: { language },
    attrs,
    classes,
    setAttribute: (k: string, v: string) => { attrs[k] = v; },
    classList: { toggle: (c: string, on: boolean) => (on ? classes.add(c) : classes.delete(c)) }
  };
}

let items: ReturnType<typeof fakeItem>[];
let label: { textContent: string };

beforeEach(() => {
  items = ['auto', 'ja', 'en'].map(fakeItem);
  label = { textContent: '' };
  (globalThis as any).document = {
    querySelectorAll: () => items,
    getElementById: (id: string) => (id === 'statusLanguageLabel' ? label : null)
  };
});

describe('renderLanguageControl', () => {
  it('lights Auto and shows the detected language with "auto" when nothing is chosen', () => {
    renderLanguageControl({ language: 'ja', manual: '' });
    expect(items.map((i) => i.attrs['aria-checked'])).toEqual(['true', 'false', 'false']);
    expect(label.textContent).toBe('JA · auto');
  });
  it('lights the manual choice and shows the bare code', () => {
    renderLanguageControl({ language: 'en', manual: 'en' });
    expect(items.map((i) => i.attrs['aria-checked'])).toEqual(['false', 'false', 'true']);
    expect(items[2].classes.has('is-current')).toBe(true);
    expect(label.textContent).toBe('EN');
  });
});
