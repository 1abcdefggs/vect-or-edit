import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as modelModule from '../monacoOptionsModel.js';
import catalog from '../monacoOptions.catalog.json';
import ja from '../monacoOptions.ja.json';

// The model is plain JS; its inferred types are narrower than the data it really handles
const model: any = modelModule;
const controls: any[] = model.buildControls(catalog);
const index = model.indexControls(controls);

describe('monaco option catalog', () => {
  it('was generated from the installed monaco-editor version', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../../node_modules/monaco-editor/package.json'), 'utf8'));
    expect(catalog.monacoVersion, 'Run: node scripts/extract-monaco-options.mjs').toBe(pkg.version);
  });

  it('has a Japanese description for every option and every member of an object option', () => {
    const dict = ja as Record<string, string>;
    const missing = controls.filter((c) => !dict[c.path]).map((c) => c.path);
    const missingParents = catalog.options.map((o: { name: string }) => o.name).filter((n: string) => !dict[n]);
    expect([...missing, ...missingParents], `Add these to monacoOptions.ja.json:\n${[...missing, ...missingParents].join('\n')}`).toEqual([]);
  });

  it('has no Japanese description for an option that does not exist', () => {
    const known = new Set<string>([...catalog.options.map((o: { name: string }) => o.name), ...controls.map((c) => c.path)]);
    const stale = Object.keys(ja).filter((k) => !known.has(k));
    expect(stale, `Remove these from monacoOptions.ja.json:\n${stale.join('\n')}`).toEqual([]);
  });
});

describe('monaco option controls', () => {
  it('gives every settable value exactly one control', () => {
    expect(controls.length).toBeGreaterThanOrEqual(catalog.count);
    expect(index.size).toBe(controls.length);
  });

  it('puts every control in a known group', () => {
    const known = new Set(model.GROUP_ORDER);
    expect(controls.filter((c: { group: string }) => !known.has(c.group)).map((c: { path: string }) => c.path)).toEqual([]);
  });

  it('expands an object option into one control per member', () => {
    expect(index.get('minimap.enabled')?.kind).toBe('boolean');
    expect(index.get('minimap.side')?.kind).toBe('enum');
    expect(index.get('minimap')).toBeUndefined();
  });

  it('keeps the options the settings page owns read-only', () => {
    for (const p of ['fontSize', 'fontFamily', 'lineHeight', 'wordWrap', 'lineNumbers', 'renderLineHighlight', 'renderWhitespace', 'stickyScroll.enabled']) {
      expect(index.get(p)?.lock, p).toBe(model.LOCK_SETTINGS);
    }
    // The members of stickyScroll that the settings page does not own stay editable
    expect(index.get('stickyScroll.maxLineCount')?.lock).toBeNull();
  });

  it('keeps the options the app depends on read-only', () => {
    for (const p of ['automaticLayout', 'contextmenu', 'fixedOverflowWidgets', 'readOnly', 'theme']) {
      expect(index.get(p)?.lock, p).toBe(model.LOCK_APP);
    }
  });

  it('does not offer a name that contains a dot as an editable path', () => {
    expect(index.get('semanticHighlighting.enabled')?.lock).toBe(model.LOCK_UNSUPPORTED);
  });

  it('marks the options Monaco reads only at creation', () => {
    const createOnly = controls.filter((c) => c.createOnly).map((c) => c.path).sort();
    expect(createOnly).toContain('scrollbar.arrowSize');
    expect(createOnly).toContain('scrollbar.useShadows');
    expect(index.get('minimap.enabled')?.createOnly).toBe(false);
  });

  it('does not offer the members of the read-only message as inputs', () => {
    expect(controls.filter((c) => c.name === 'readOnlyMessage').every((c) => c.lock === model.LOCK_UNSUPPORTED)).toBe(true);
  });

  it('offers true and false together with the named choices of a mixed option', () => {
    const mixed = controls.find((c: { kind: string; choices: unknown[] }) => c.kind === 'enum' && c.choices.includes(true) && c.choices.includes(false));
    if (mixed) expect(mixed.choices.length).toBeGreaterThan(2);
  });
});

describe('monaco option overrides', () => {
  it('keeps only settable values of the right type', () => {
    const clean = model.sanitizeOverrides(
      JSON.stringify({
        'minimap.enabled': true,
        'minimap.side': 'left',
        'minimap.maxColumn': 'wide', // wrong type
        fontSize: 30, // owned by the settings page
        contextmenu: true, // required by the app
        notAnOption: 1
      }),
      index
    );
    expect(clean).toEqual({ 'minimap.enabled': true, 'minimap.side': 'left' });
  });

  it('survives broken stored data', () => {
    expect(model.sanitizeOverrides('{not json', index)).toEqual({});
    expect(model.sanitizeOverrides('[1,2]', index)).toEqual({});
    expect(model.sanitizeOverrides(null, index)).toEqual({});
  });

  it('rejects a choice that the option does not offer', () => {
    expect(model.sanitizeOverrides({ 'minimap.side': 'middle' }, index)).toEqual({});
  });

  it('turns flat paths into the nested object that updateOptions takes', () => {
    expect(model.toEditorOptions({ 'minimap.enabled': true, 'minimap.side': 'left', rulers: [80] })).toEqual({
      minimap: { enabled: true, side: 'left' },
      rulers: [80]
    });
  });

  it('reads a path out of a resolved snapshot', () => {
    const snapshot = { minimap: { enabled: false }, wordWrap: 'on' };
    expect(model.readPath(snapshot, 'minimap.enabled')).toBe(false);
    expect(model.readPath(snapshot, 'wordWrap')).toBe('on');
    expect(model.readPath(snapshot, 'minimap.side')).toBeUndefined();
    expect(model.readPath(undefined, 'wordWrap')).toBeUndefined();
  });

  it('reads the documented default as a value the control can show', () => {
    expect(model.defaultValueOf({ kind: 'boolean', defaultText: 'true' })).toBe(true);
    expect(model.defaultValueOf({ kind: 'boolean', defaultText: 'false' })).toBe(false);
    expect(model.defaultValueOf({ kind: 'number', defaultText: '300' })).toBe(300);
    expect(model.defaultValueOf({ kind: 'number', defaultText: '12 (px)' })).toBe(12);
    expect(model.defaultValueOf({ kind: 'enum', choices: ['left', 'right'], defaultText: "'right'" })).toBe('right');
    expect(model.defaultValueOf({ kind: 'enum', choices: ['left', 'right'], defaultText: "'actual'" })).toBeUndefined();
    expect(model.defaultValueOf({ kind: 'boolean', defaultText: null })).toBeUndefined();
    expect(model.defaultValueOf({ kind: 'json', defaultText: 'empty array' })).toBeUndefined();
  });

  it('parses typed text by control kind', () => {
    expect(model.parseTyped({ kind: 'number' }, '12')).toEqual({ ok: true, value: 12 });
    expect(model.parseTyped({ kind: 'number' }, '')).toEqual({ ok: false });
    expect(model.parseTyped({ kind: 'number' }, 'abc')).toEqual({ ok: false });
    expect(model.parseTyped({ kind: 'json' }, '[80,120]')).toEqual({ ok: true, value: [80, 120] });
    expect(model.parseTyped({ kind: 'json' }, '[80,')).toEqual({ ok: false });
    expect(model.parseTyped({ kind: 'text' }, ' x ')).toEqual({ ok: true, value: ' x ' });
  });
});

describe('monaco option search and grouping', () => {
  it('finds options by name or description, ignoring case', () => {
    expect(model.filterControls(controls, 'MINIMAP').every((c: { path: string; doc: string }) => /minimap/i.test(c.path + c.doc))).toBe(true);
    expect(model.filterControls(controls, '').length).toBe(controls.length);
    expect(model.filterControls(controls, 'zzzz-no-such-option')).toEqual([]);
  });

  it('groups in display order without empty groups', () => {
    const groups = model.groupControls(controls);
    expect(groups.every((g: { controls: unknown[] }) => g.controls.length > 0)).toBe(true);
    expect(groups.reduce((n: number, g: { controls: unknown[] }) => n + g.controls.length, 0)).toBe(controls.length);
  });
});
