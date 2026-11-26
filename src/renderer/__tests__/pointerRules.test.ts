import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Checks docs/pointer_rules.csv, the table of left and right click behaviour (standard vs current).
 * The table is the single source; these checks find omissions and contradictions in it.
 */
const file = path.resolve(__dirname, '..', '..', '..', 'docs', 'pointer_rules.csv');
const [header, ...lines] = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
const columns = header.split(',');
const rows = lines.map((line) => Object.fromEntries(line.split(',').map((v, i) => [columns[i], v])));

/** Every place a pointer can land, per region. Completeness is checked against this map. */
const TARGETS: Record<string, string[]> = {
  monaco: ['editable_text', 'selection', 'blank'],
  tab: ['control', 'blank'],
  header: ['control', 'blank'],
  toolbar: ['control', 'blank'],
  sidebar: ['control', 'editable_text', 'readonly_text', 'blank'],
  chat: ['control', 'editable_text', 'readonly_text', 'blank'],
  log: ['control', 'readonly_text', 'blank'],
  status: ['control', 'readonly_text', 'blank'],
  settings: ['control', 'editable_text', 'readonly_text', 'blank'],
  setup: ['control', 'editable_text', 'readonly_text', 'blank']
};
const MENUS = ['jump_menu', 'editor_menu', 'tab_menu'];
const STATUSES = ['match', 'gap', 'unverified'];

describe('pointer rules table', () => {
  it('has the expected columns and valid statuses', () => {
    expect(columns).toEqual(['region', 'target', 'button', 'standard_action', 'current_action', 'status', 'note']);
    for (const r of rows) expect(STATUSES, r.region + '/' + r.target + '/' + r.button).toContain(r.status);
  });

  it('covers every region, target and button exactly once', () => {
    const expected: string[] = [];
    for (const [region, targets] of Object.entries(TARGETS)) {
      for (const target of targets) for (const button of ['left', 'right']) expected.push(`${region}/${target}/${button}`);
    }
    for (const menu of MENUS) for (const button of ['esc', 'outside_press']) expected.push(`menu/${menu}/${button}`);
    const actual = rows.map((r) => `${r.region}/${r.target}/${r.button}`);
    expect(actual.slice().sort()).toEqual(expected.slice().sort());
  });

  it('never opens a menu on a left click', () => {
    for (const r of rows.filter((x) => x.button === 'left')) {
      expect(r.standard_action, r.region + '/' + r.target).not.toMatch(/menu/);
    }
  });

  it('offers an edit menu on right click in editable text and a copy menu on read-only text', () => {
    for (const r of rows.filter((x) => x.button === 'right' && x.target === 'editable_text')) {
      expect(r.standard_action, r.region).toMatch(/^edit_menu/);
    }
    for (const r of rows.filter((x) => x.button === 'right' && x.target === 'readonly_text')) {
      expect(r.standard_action, r.region).toBe('copy_menu');
    }
  });

  it('closes every menu on Esc and on an outside press', () => {
    for (const r of rows.filter((x) => x.region === 'menu')) expect(r.standard_action).toBe('close');
  });

  it('keeps status and note consistent: a gap names its fix, a match has no note', () => {
    for (const r of rows) {
      if (r.status === 'gap') expect(r.note, r.region + '/' + r.target + '/' + r.button).not.toBe('');
      if (r.status === 'match') expect(r.current_action, r.region + '/' + r.target + '/' + r.button).not.toBe('unknown');
    }
  });
});
