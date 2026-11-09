/**
 * modelListArrange.test.ts
 *
 * Search, tag filter, sort and group headings for the shared model list part.
 */

import { describe, it, expect } from 'vitest';
import { arrangeModelItems, filterModelItems, type ModelListItem, type ModelListSort } from '../modelListArrange';

const sorts: ModelListSort[] = [
  { key: 'recommended', labelKey: 'k1', grouped: true },
  { key: 'name' },
  { key: 'input', direction: 'desc' }
];

const tag = (kind: string, text = kind) => ({ kind, text });

const item = (id: string, group: string, input: number | undefined, name: string, tags = [tag('is-text', 'Text')]): ModelListItem => ({
  id, cells: { name }, tags, group: { key: group, label: group }, sortValues: { name, input }
});

const items = [
  item('gemini-3.1-pro', 'g3', 1_000_000, 'Gemini 3.1 Pro', [tag('is-text', 'Text'), tag('is-preview', 'Preview')]),
  item('gemini-3.1-flash', 'g3', 200_000, 'Gemini 3.1 Flash'),
  item('gemini-2.5-flash', 'g2', undefined, 'Gemini 2.5 Flash'),
  item('gemma-4-it', 'gemma', 8000, 'Gemma 4', [tag('is-speech', 'Speech')])
];

const ids = (rows: ReturnType<typeof arrangeModelItems>['rows']) =>
  rows.map((r) => (r.type === 'heading' ? `#${r.key}` : r.item.id));

describe('arrangeModelItems', () => {
  it('keeps the incoming order and adds a heading when the group changes', () => {
    const out = arrangeModelItems(items, sorts, 'recommended', '');
    expect(ids(out.rows)).toEqual(['#g3', 'gemini-3.1-pro', 'gemini-3.1-flash', '#g2', 'gemini-2.5-flash', '#gemma', 'gemma-4-it']);
    expect(out).toMatchObject({ shown: 4, total: 4 });
  });

  it('searches the id, the cells and the tags case-insensitively, and drops headings with no match', () => {
    const out = arrangeModelItems(items, sorts, 'recommended', ' FLASH ');
    expect(ids(out.rows)).toEqual(['#g3', 'gemini-3.1-flash', '#g2', 'gemini-2.5-flash']);
    expect(out).toMatchObject({ shown: 2, total: 4 });
    expect(arrangeModelItems(items, sorts, 'recommended', 'speech').shown).toBe(1);
  });

  it('filters by tags: every selected tag must be present', () => {
    expect(arrangeModelItems(items, sorts, 'name', '', { tags: new Set(['is-text']) }).shown).toBe(3);
    expect(ids(arrangeModelItems(items, sorts, 'name', '', { tags: new Set(['is-text', 'is-preview']) }).rows)).toEqual(['gemini-3.1-pro']);
    expect(arrangeModelItems(items, sorts, 'name', '', { tags: new Set(['is-speech', 'is-preview']) }).shown).toBe(0);
    expect(arrangeModelItems(items, sorts, 'name', '', { tags: new Set() }).shown).toBe(4);
  });

  it('filters by a group where any one tag is enough, together with the all-tags filter', () => {
    const any = [new Set(['is-speech', 'is-preview'])];
    expect(ids(arrangeModelItems(items, sorts, 'name', '', { anyOf: any }).rows)).toEqual(['gemini-3.1-pro', 'gemma-4-it']);
    expect(ids(arrangeModelItems(items, sorts, 'name', '', { anyOf: any, tags: new Set(['is-text']) }).rows)).toEqual(['gemini-3.1-pro']);
    expect(arrangeModelItems(items, sorts, 'name', '', { anyOf: [new Set()] }).shown).toBe(4);
  });

  it('filterModelItems returns what passes the search and the filters, in the incoming order', () => {
    expect(filterModelItems(items, '', {}).map((i) => i.id)).toEqual(['gemini-3.1-pro', 'gemini-3.1-flash', 'gemini-2.5-flash', 'gemma-4-it']);
    expect(filterModelItems(items, 'flash', { tags: new Set(['is-text']) }).map((i) => i.id)).toEqual(['gemini-3.1-flash', 'gemini-2.5-flash']);
    expect(filterModelItems(items, '', { onlyIds: new Set(['gemma-4-it']), anyOf: [new Set(['is-speech'])] }).map((i) => i.id)).toEqual(['gemma-4-it']);
  });

  it('sorts by name without headings, and reverses with a direction', () => {
    expect(ids(arrangeModelItems(items, sorts, 'name', '').rows)).toEqual(['gemini-2.5-flash', 'gemini-3.1-flash', 'gemini-3.1-pro', 'gemma-4-it']);
    expect(ids(arrangeModelItems(items, sorts, 'name', '', { direction: 'desc' }).rows)[0]).toBe('gemma-4-it');
  });

  it('sorts by a number, largest first by default, with missing values last in either direction', () => {
    expect(ids(arrangeModelItems(items, sorts, 'input', '').rows)).toEqual(['gemini-3.1-pro', 'gemini-3.1-flash', 'gemma-4-it', 'gemini-2.5-flash']);
    expect(ids(arrangeModelItems(items, sorts, 'input', '', { direction: 'asc' }).rows)).toEqual(['gemma-4-it', 'gemini-3.1-flash', 'gemini-3.1-pro', 'gemini-2.5-flash']);
  });

  it('lists only the given ids, and still applies the search to them', () => {
    const only = new Set(['gemini-3.1-flash', 'gemma-4-it']);
    const out = arrangeModelItems(items, sorts, 'recommended', '', { onlyIds: only });
    expect(ids(out.rows)).toEqual(['#g3', 'gemini-3.1-flash', '#gemma', 'gemma-4-it']);
    expect(out).toMatchObject({ shown: 2, total: 4 });
    expect(ids(arrangeModelItems(items, sorts, 'name', 'gemma', { onlyIds: only }).rows)).toEqual(['gemma-4-it']);
    expect(arrangeModelItems(items, sorts, 'name', '', { onlyIds: new Set() }).shown).toBe(0);
  });

  it('falls back to the first sort for an unknown key and handles no items', () => {
    expect(ids(arrangeModelItems(items, sorts, 'nope', '').rows)[0]).toBe('#g3');
    expect(arrangeModelItems([], sorts, 'name', 'x')).toEqual({ rows: [], shown: 0, total: 0 });
  });
});
