import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { nameRowControls, rowLabelId } from '../ui/settings/settingsStaticMarkup.js';

// Minimal element stand-ins: enough for nameRowControls, which only reads and writes attributes
function fakeInput() {
  const attrs = new Map<string, string>();
  return {
    attrs,
    hasAttribute: (k: string) => attrs.has(k),
    setAttribute: (k: string, v: string) => attrs.set(k, v),
    getAttribute: (k: string) => attrs.get(k) ?? null,
  };
}

function fakeRow(label: { id: string } | null, inputs: ReturnType<typeof fakeInput>[]) {
  return {
    querySelector: (sel: string) => (sel === '.setting-label' ? label : null),
    querySelectorAll: () => inputs,
  };
}

describe('nameRowControls', () => {
  it('names each input of a row after the row label', () => {
    const label = { id: '' };
    const number = fakeInput();
    const password = fakeInput();
    const root = { querySelectorAll: () => [fakeRow(label, [number, password])] };
    nameRowControls(root as unknown as Document);
    expect(label.id).toMatch(/^setting-label-\d+$/);
    expect(number.getAttribute('aria-labelledby')).toBe(label.id);
    expect(password.getAttribute('aria-labelledby')).toBe(label.id);
  });

  it('keeps a control that already has a name', () => {
    const label = { id: 'existing' };
    const named = fakeInput();
    named.setAttribute('aria-label', 'Own name');
    const root = { querySelectorAll: () => [fakeRow(label, [named])] };
    nameRowControls(root as unknown as Document);
    expect(named.hasAttribute('aria-labelledby')).toBe(false);
    expect(named.getAttribute('aria-label')).toBe('Own name');
  });

  it('skips a row without a label', () => {
    const input = fakeInput();
    const root = { querySelectorAll: () => [fakeRow(null, [input])] };
    nameRowControls(root as unknown as Document);
    expect(input.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('keeps an existing label id', () => {
    const label = { id: '' };
    expect(rowLabelId(label)).toBe(rowLabelId(label));
    expect(label.id).not.toBe('');
  });
});

describe('settings markup', () => {
  it('makes the provider select accessible', () => {
    const html = readFileSync(join(__dirname, '../components/settingsModal.html'), 'utf8');
    const select = html.match(/<select id="modalAiProviderSelect"[^>]*>/);
    expect(select).not.toBeNull();
    if (select) expect(select[0]).toContain('data-ui-control="segmented"');
  });
});
