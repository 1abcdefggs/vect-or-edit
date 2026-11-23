import { describe, expect, it } from 'vitest';
import { resolveJump } from '../jumpContextMenu.js';
import { buildJumpMap, parseCsv } from '../../../../../scripts/build-jump-targets.mjs';

const map = {
  'hdr:menu-bar': { tab: 'tabAppearance', card: 'grp_menu_bar', control: '' },
  'edt:save': { tab: 'tabEditor', card: 'autosave_menu_item', control: 'modalAutoSaveSelect' },
};

describe('resolveJump', () => {
  it('returns the row for a known part key', () => {
    expect(resolveJump('edt:save', map)).toEqual(map['edt:save']);
  });

  it('returns null for an unknown or missing key', () => {
    expect(resolveJump('hdr:unknown', map)).toBeNull();
    expect(resolveJump(null, map)).toBeNull();
    expect(resolveJump('constructor', map)).toBeNull();
  });
});

describe('buildJumpMap', () => {
  it('keeps only rows with a target tab and maps the three target columns', () => {
    const csv = '﻿part_key,area,name_ja,target_tab,target_card_id,target_control_id,basis,note_ja\r\n'
      + 'hdr:logo,Header,App name,tabAppearance,grp_menu_bar,,manual,\r\n'
      + 'hdr:minimize,Header,Minimize,,,,none,Window operation\r\n';
    expect(buildJumpMap(csv)).toEqual({
      'hdr:logo': { tab: 'tabAppearance', card: 'grp_menu_bar', control: '' },
    });
  });

  it('handles quoted fields with commas and doubled quotes', () => {
    const rows = parseCsv('a,b\r\n"x, y","say ""hi"""\r\n');
    expect(rows).toEqual([{ a: 'x, y', b: 'say "hi"' }]);
  });
});
