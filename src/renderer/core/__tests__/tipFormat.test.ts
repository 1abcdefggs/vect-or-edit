import { describe, expect, it } from 'vitest';
import { BULLET_TIP_KEYS, formatTipText } from '../tipFormat';

describe('formatTipText', () => {
  it('puts each 、 of a listed key on its own bulleted line', () => {
    expect(formatTipText('tip_header_theme', '配色テーマ、明るい面、暗い面')).toBe('配色テーマ\n・明るい面\n・暗い面');
  });

  it('leaves a key that is not listed as it is', () => {
    expect(formatTipText('tip_menu_edit', '編集\n元に戻す、やり直し')).toBe('編集\n元に戻す、やり直し');
  });

  it('keeps text without 、 unchanged for a listed key', () => {
    expect(formatTipText('tip_vis_locked', '')).toBe('');
  });

  it('lists exactly the keys that were agreed', () => {
    expect(BULLET_TIP_KEYS.size).toBe(15);
  });
});
